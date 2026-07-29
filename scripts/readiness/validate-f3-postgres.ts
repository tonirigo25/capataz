import assert from "node:assert/strict";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createDraftSoftwareDeclaration, issueFiscalDocument, voidFiscalDocument, classifyLegacyFiscalDocument, type IssueFiscalDocumentInput } from "../../lib/fiscal/engine";
import { deliverElectronicInvoice, FakeElectronicInvoiceDeliveryAdapter, generateAndStoreElectronicInvoice, recordElectronicInvoiceBusinessStatus } from "../../lib/fiscal/artifacts";
import { exportFiscalEvidence, verifyFiscalEvidence } from "../../lib/fiscal/evidence-export";
import { transmitFiscalDocument } from "../../lib/fiscal/transmission";
import { FakeStorageProvider } from "../../lib/platform/providers/fake";
import type { FiscalTransmissionProvider } from "../../lib/platform/providers/contracts";

const prisma = new PrismaClient();
const activation = { enabled: true, allowLiveIssuance: false, allowLiveQr: false, allowLiveTransmission: false };
const companyA = "f3-company-a";
const companyB = "f3-company-b";
const releaseSha = "d5e1af3a26bac103e7ff403b7eec414c6c1da597";
const configurationHash = "a".repeat(64);

function issueInput(index: number, overrides: Partial<IssueFiscalDocumentInput> = {}): IssueFiscalDocumentInput {
  return {
    companyId: companyA,
    issuanceKey: `f3-issue-${index}`,
    documentType: "F1",
    series: "F26",
    mode: "sandbox",
    softwareVersion: "orqena-fiscal-1.0.0",
    releaseSha,
    configurationHash,
    qrMode: "verifactu",
    qrEnvironment: "sandbox",
    issueDate: "2026-07-26",
    dueDate: "2026-08-25",
    currency: "EUR",
    seller: { legalName: "Orqena Test SL", taxId: "B12345678", countryCode: "ES", addressLine: "Calle Uno 1", postalCode: "28001", city: "Madrid" },
    buyer: { legalName: `Cliente ${index} SL`, taxId: `B${String(87000000 + index)}`, countryCode: "ES", addressLine: "Calle Dos 2", postalCode: "46001", city: "Valencia" },
    lines: [{ id: "1", description: "Servicio", quantity: "1", unitPrice: `${100 + index}.00`, discountAmount: "0", taxRate: "21" }],
    withholdingAmount: "0",
    ...overrides,
  };
}

async function rejected(operation: () => Promise<unknown>, expected: RegExp) {
  try {
    await operation();
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), expected);
    return true;
  }
  return false;
}

async function main() {
  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations[0]?.count, 45);
  await prisma.company.createMany({ data: [
    { id: companyA, slug: companyA, nombreComercial: "F3 A", razonSocial: "Orqena Test SL", taxId: "B12345678" },
    { id: companyB, slug: companyB, nombreComercial: "F3 B", razonSocial: "Other Test SL", taxId: "B87654321" },
  ] });

  assert.equal(await rejected(() => issueFiscalDocument(prisma, issueInput(99, { seller: { ...issueInput(99).seller, taxId: "" } }), activation), /FISCAL_REQUIRED:seller.taxId/u), true);
  assert.equal(await prisma.companyDocumentSequence.count({ where: { companyId: companyA, type: "fiscal" } }), 0);
  assert.equal(await prisma.fiscalDocument.count({ where: { companyId: companyA } }), 0);

  const issued = await Promise.all(Array.from({ length: 8 }, (_, index) => issueFiscalDocument(
    prisma,
    issueInput(index + 1),
    activation,
    () => new Date(`2026-07-26T12:00:${String(index + 1).padStart(2, "0")}.000+02:00`),
  )));
  const numbers = issued.map((item) => item.document.number).sort();
  assert.deepEqual(numbers, Array.from({ length: 8 }, (_, index) => `F26-${String(index + 1).padStart(6, "0")}`));
  assert.equal(new Set(numbers).size, 8);
  const sequence = await prisma.companyDocumentSequence.findUniqueOrThrow({ where: { companyId_type_scope: { companyId: companyA, type: "fiscal", scope: "fiscal:F26" } } });
  assert.equal(sequence.nextValue, 9);

  const replay = await issueFiscalDocument(prisma, issueInput(1), activation);
  assert.equal(replay.replayed, true);
  assert.equal(await prisma.fiscalDocument.count({ where: { companyId: companyA } }), 8);
  assert.equal(await rejected(() => issueFiscalDocument(prisma, issueInput(1, { lines: [{ id: "1", description: "Changed", quantity: "1", unitPrice: "1", taxRate: "21" }] }), activation), /ISSUANCE_KEY_CONFLICT/u), true);
  assert.equal((await prisma.companyDocumentSequence.findUniqueOrThrow({ where: { companyId_type_scope: { companyId: companyA, type: "fiscal", scope: "fiscal:F26" } } })).nextValue, 9);

  const original = issued[0].document;
  const correctionInput = issueInput(9, {
    documentType: "R1",
    correction: { kind: "differences", reason: "Tax base correction", originalFiscalDocumentId: original.id, originalInvoiceNumber: original.number },
  });
  const correction = await issueFiscalDocument(prisma, correctionInput, activation, () => new Date("2026-07-26T12:01:00.000+02:00"));
  assert.equal(correction.document.originalFiscalDocumentId, original.id);
  assert.equal((await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: original.id } })).status, "ISSUED");

  assert.equal(await rejected(() => voidFiscalDocument(prisma, { companyId: companyB, fiscalDocumentId: original.id, releaseSha, reason: "cross tenant" }), /CROSS_TENANT/u), true);

  const storage = new FakeStorageProvider();
  const artifactResult = await generateAndStoreElectronicInvoice(prisma, { companyId: companyA, fiscalDocumentId: original.id, format: "UBL", storage, retentionUntil: new Date("2036-07-26T00:00:00Z") });
  const artifactReplay = await generateAndStoreElectronicInvoice(prisma, { companyId: companyA, fiscalDocumentId: original.id, format: "UBL", storage, retentionUntil: new Date("2036-07-26T00:00:00Z") });
  assert.equal(artifactReplay.replayed, true);
  const restored = await storage.get({ companyId: companyA, objectKey: artifactResult.artifact.storageKey });
  assert.deepEqual(restored, artifactResult.generated.bytes);
  const privateAdapter = new FakeElectronicInvoiceDeliveryAdapter("PRIVATE_EXCHANGE");
  const delivery = await deliverElectronicInvoice(prisma, { companyId: companyA, artifactId: artifactResult.artifact.id, recipient: "buyer@example.invalid", idempotencyKey: "f3-private-delivery", adapter: privateAdapter });
  const deliveryReplay = await deliverElectronicInvoice(prisma, { companyId: companyA, artifactId: artifactResult.artifact.id, recipient: "buyer@example.invalid", idempotencyKey: "f3-private-delivery", adapter: privateAdapter });
  assert.equal(delivery.replayed, false);
  assert.equal(deliveryReplay.replayed, true);
  assert.equal(privateAdapter.attempts, 1);
  assert.equal(await rejected(() => deliverElectronicInvoice(prisma, { companyId: companyA, artifactId: artifactResult.artifact.id, recipient: "public@example.invalid", idempotencyKey: "f3-public-delivery", adapter: new FakeElectronicInvoiceDeliveryAdapter("PUBLIC_SOLUTION") }), /PUBLIC_DELIVERY_DISABLED/u), true);
  await recordElectronicInvoiceBusinessStatus(prisma, { companyId: companyA, artifactId: artifactResult.artifact.id, eventType: "ACCEPTED", effectiveAt: new Date("2026-07-27T10:00:00Z") });
  await recordElectronicInvoiceBusinessStatus(prisma, { companyId: companyA, artifactId: artifactResult.artifact.id, eventType: "PAYMENT_FULL", effectiveAt: new Date("2026-07-30T10:00:00Z"), amount: original.total.toFixed(2) });
  assert.equal((await prisma.electronicInvoiceArtifact.findUniqueOrThrow({ where: { id: artifactResult.artifact.id } })).status, "PAID");

  const voided = await voidFiscalDocument(prisma, { companyId: companyA, fiscalDocumentId: original.id, releaseSha, reason: "Administrative cancellation" }, () => new Date("2026-07-26T12:02:00.000+02:00"));
  assert.equal(voided.document.status, "VOIDED");
  assert.equal((await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: original.id }, include: { records: true, electronicArtifacts: true } })).records.length, 2);
  assert.equal(await prisma.electronicInvoiceArtifact.count({ where: { fiscalDocumentId: original.id } }), 1);

  const firstRecordId = (await prisma.fiscalRecord.findFirstOrThrow({ where: { companyId: companyA } })).id;
  assert.equal(await rejected(() => prisma.fiscalRecord.update({ where: { id: firstRecordId }, data: { eventType: "TAMPER" } }), /FISCAL_APPEND_ONLY_VIOLATION/u), true);
  assert.equal(await rejected(() => prisma.fiscalDocument.delete({ where: { id: original.id } }), /FISCAL_DOCUMENT_DELETE_FORBIDDEN/u), true);
  assert.equal(await rejected(() => prisma.electronicInvoiceArtifact.update({ where: { id: artifactResult.artifact.id }, data: { contentHash: "0".repeat(64) } }), /EINVOICE_ARTIFACT_IMMUTABLE_FIELDS/u), true);

  let providerCalls = 0;
  let acceptedEffects = 0;
  const flakyProvider: FiscalTransmissionProvider = {
    name: "f3-flaky-fake",
    mode: "fake",
    async transmit(input) {
      providerCalls += 1;
      if (providerCalls === 1) throw new Error("FAKE_TRANSIENT_FAILURE");
      acceptedEffects += 1;
      return { provider: this.name, mode: this.mode, reference: "fake-ack-1", idempotencyKey: input.idempotencyKey, acceptedAt: "2026-07-26T10:03:00.000Z" };
    },
  };
  const transmissionInput = { companyId: companyA, fiscalDocumentId: issued[1].document.id, artifactHash: "b".repeat(64), idempotencyKey: "f3-transmission" };
  assert.equal(await rejected(() => transmitFiscalDocument(prisma, transmissionInput, flakyProvider, activation), /FAKE_TRANSIENT_FAILURE/u), true);
  const transmission = await transmitFiscalDocument(prisma, transmissionInput, flakyProvider, activation);
  const transmissionReplay = await transmitFiscalDocument(prisma, transmissionInput, flakyProvider, activation);
  assert.equal(transmission.replayed, false);
  assert.equal(transmissionReplay.replayed, true);
  assert.equal(providerCalls, 2);
  assert.equal(acceptedEffects, 1);

  const declaration = await createDraftSoftwareDeclaration(prisma, { companyId: companyA, softwareName: "Orqena", softwareVersion: "1.0.0", provider: "Orqena", mode: "sandbox", releaseSha, configurationHash, capabilities: { verifactu: true, nonVerifiable: true, publicB2B: false }, validFrom: new Date("2026-07-26T00:00:00Z") });
  assert.equal(declaration.approvalStatus, "DRAFT");
  assert.match(JSON.stringify(declaration.payload), /REQUIRES_INDEPENDENT_SPECIALIST_APPROVAL/u);
  assert.deepEqual(classifyLegacyFiscalDocument({ legacySource: true, softwareVersion: null, snapshotHash: null }), { classification: "LEGACY_NOT_RETRO_CERTIFIED", eligibleForTransmission: false });

  const exported = await exportFiscalEvidence(prisma, companyA);
  const verification = verifyFiscalEvidence(exported);
  assert.equal(verification.valid, true);
  const tampered = {
    manifest: {
      ...exported.manifest,
      records: exported.manifest.records.map((record, index) => index === 0 ? { ...record, canonicalInput: `${record.canonicalInput}&tampered=true` } : record),
    },
    manifestHash: "",
  } as typeof exported;
  tampered.manifestHash = (await import("../../lib/fiscal/canonical")).sha256Hex((await import("../../lib/fiscal/canonical")).canonicalJson(tampered.manifest));
  assert.throws(() => verifyFiscalEvidence(tampered), /FISCAL_RECORD_HASH_INVALID/u);

  const chain = await prisma.fiscalRecord.findMany({ where: { companyId: companyA }, orderBy: { sequence: "asc" } });
  assert.equal(chain.every((record, index) => (record.previousHash ?? null) === (index === 0 ? null : chain[index - 1].recordHash)), true);
  assert.equal(await prisma.businessEvent.count({ where: { companyId: companyA, type: { in: ["fiscal.document.issued.v1", "fiscal.document.voided.v1"] } } }), 10);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    migrations: migrations[0].count,
    concurrentIssuance: { requested: 8, unique: new Set(numbers).size, numbers, nextValue: sequence.nextValue },
    invalidConfigurationConsumedNumber: false,
    idempotentIssueReplay: replay.replayed,
    correctionPreservedOriginal: true,
    cancellationPreservedArtifact: true,
    appendOnlyDatabaseTriggers: true,
    chainRecords: chain.length,
    tamperDetected: true,
    transmission: { providerCalls, acceptedEffects, replayed: transmissionReplay.replayed },
    deliveryReplay: deliveryReplay.replayed,
    publicDeliveryBlocked: true,
    evidence: verification.counts,
    declarationStatus: declaration.approvalStatus,
    legacyClassification: "LEGACY_NOT_RETRO_CERTIFIED",
  }, null, 2)}\n`);
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
