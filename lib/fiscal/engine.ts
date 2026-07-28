import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateAeatCancellationHash, calculateAeatRegistrationHash, buildAeatQrPayload } from "./aeat";
import {
  canonicalInvoiceHash,
  canonicalJson,
  createCanonicalInvoice,
  sha256Hex,
  type CanonicalInvoice,
  type CanonicalInvoiceInput,
} from "./canonical";
import { enqueueBusinessEvent } from "@/lib/platform/outbox";

type Transaction = Prisma.TransactionClient;
type Clock = () => Date;

export type FiscalEngineMode = "shadow" | "sandbox" | "live";

export type FiscalActivation = {
  enabled: boolean;
  allowLiveIssuance?: boolean;
  allowLiveQr?: boolean;
  allowLiveTransmission?: boolean;
};

export type IssueFiscalDocumentInput = Omit<CanonicalInvoiceInput, "documentId"> & {
  companyId: string;
  invoiceId?: string;
  issuanceKey: string;
  series: string;
  mode: FiscalEngineMode;
  softwareVersion: string;
  releaseSha: string;
  configurationHash: string;
  retentionUntil?: Date;
  qrMode: "verifactu" | "non-verifiable";
  qrEnvironment: "sandbox" | "live";
};

function requiredToken(value: string, field: string, pattern = /^[A-Za-z0-9._:/-]+$/u) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 180 || !pattern.test(normalized)) throw new Error(`FISCAL_CONFIG_INVALID:${field}`);
  return normalized;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizedIssueInput(input: IssueFiscalDocumentInput) {
  const companyId = requiredToken(input.companyId, "companyId");
  const issuanceKey = requiredToken(input.issuanceKey, "issuanceKey");
  const series = requiredToken(input.series, "series", /^[A-Za-z0-9._/-]+$/u);
  const softwareVersion = requiredToken(input.softwareVersion, "softwareVersion");
  const releaseSha = requiredToken(input.releaseSha, "releaseSha", /^[a-f0-9]{7,64}$/iu);
  const configurationHash = requiredToken(input.configurationHash, "configurationHash", /^[a-f0-9]{64}$/iu).toLowerCase();
  if (input.currency !== "EUR") throw new Error("FISCAL_CURRENCY_UNSUPPORTED");
  const canonical = createCanonicalInvoice({ ...input, documentId: "PENDING" });
  return { companyId, issuanceKey, series, softwareVersion, releaseSha, configurationHash, canonical };
}

function assertActivation(input: IssueFiscalDocumentInput, activation: FiscalActivation) {
  if (!activation.enabled) throw new Error("FISCAL_ENGINE_DISABLED");
  if (input.mode === "live" && !activation.allowLiveIssuance) throw new Error("FISCAL_LIVE_ISSUANCE_BLOCKED");
  if (input.qrEnvironment === "live" && !activation.allowLiveQr) throw new Error("FISCAL_LIVE_QR_BLOCKED");
}

async function lockCompany(transaction: Transaction, companyId: string) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fiscal:${companyId}`}, 0))`;
}

async function reserveFiscalNumber(transaction: Transaction, companyId: string, series: string) {
  const scope = `fiscal:${series}`;
  const sequence = await transaction.companyDocumentSequence.findUnique({
    where: { companyId_type_scope: { companyId, type: "fiscal", scope } },
  });
  const next = sequence?.nextValue ?? 1;
  if (sequence) {
    await transaction.companyDocumentSequence.update({ where: { id: sequence.id }, data: { nextValue: next + 1 } });
  } else {
    await transaction.companyDocumentSequence.create({ data: { companyId, type: "fiscal", scope, nextValue: 2 } });
  }
  return `${series}-${String(next).padStart(6, "0")}`;
}

async function lastFiscalRecord(transaction: Transaction, companyId: string) {
  return transaction.fiscalRecord.findFirst({ where: { companyId }, orderBy: { sequence: "desc" } });
}

async function lastFiscalEvent(transaction: Transaction, companyId: string) {
  return transaction.fiscalEvent.findFirst({ where: { companyId }, orderBy: { sequence: "desc" } });
}

function eventHash(input: { sequence: bigint; previousHash: string | null; eventType: string; occurredAt: Date; payload: unknown }) {
  return sha256Hex(canonicalJson({
    sequence: input.sequence,
    previousHash: input.previousHash,
    eventType: input.eventType,
    occurredAt: input.occurredAt.toISOString(),
    payload: input.payload,
  }));
}

function withDocumentId(invoice: CanonicalInvoice, documentId: string): CanonicalInvoice {
  return { ...invoice, documentId };
}

export async function issueFiscalDocument(
  prisma: PrismaClient,
  input: IssueFiscalDocumentInput,
  activation: FiscalActivation,
  clock: Clock = () => new Date(),
) {
  const normalized = normalizedIssueInput(input);
  assertActivation(input, activation);
  return prisma.$transaction(async (transaction) => {
    await lockCompany(transaction, normalized.companyId);
    await transaction.company.findUniqueOrThrow({ where: { id: normalized.companyId }, select: { id: true } });
    if (input.invoiceId) {
      const invoice = await transaction.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, select: { companyId: true } });
      if (invoice.companyId !== normalized.companyId) throw new Error("FISCAL_CROSS_TENANT_INVOICE");
    }
    if (normalized.canonical.correction) {
      const original = await transaction.fiscalDocument.findUniqueOrThrow({
        where: { id: normalized.canonical.correction.originalFiscalDocumentId },
        select: { companyId: true, number: true },
      });
      if (original.companyId !== normalized.companyId) throw new Error("FISCAL_CROSS_TENANT_CORRECTION");
      if (original.number !== normalized.canonical.correction.originalInvoiceNumber) throw new Error("FISCAL_CORRECTION_ORIGINAL_MISMATCH");
    }

    const existing = await transaction.fiscalDocument.findUnique({
      where: { companyId_issuanceKey: { companyId: normalized.companyId, issuanceKey: normalized.issuanceKey } },
      include: { records: { orderBy: { sequence: "asc" } }, events: { orderBy: { sequence: "asc" } } },
    });
    if (existing) {
      const candidate = withDocumentId(normalized.canonical, existing.number);
      if (existing.snapshotHash !== canonicalInvoiceHash(candidate)) throw new Error("FISCAL_ISSUANCE_KEY_CONFLICT");
      return { document: existing, replayed: true };
    }

    const number = await reserveFiscalNumber(transaction, normalized.companyId, normalized.series);
    const snapshot = withDocumentId(normalized.canonical, number);
    const snapshotHash = canonicalInvoiceHash(snapshot);
    const occurredAt = clock();
    const qr = buildAeatQrPayload({
      mode: input.qrMode,
      environment: input.qrEnvironment,
      issuerTaxId: snapshot.seller.taxId,
      invoiceNumber: number,
      issueDate: snapshot.issueDate,
      totalAmount: snapshot.totals.payableAmount,
    });
    const priorRecord = await lastFiscalRecord(transaction, normalized.companyId);
    const sequence = (priorRecord?.sequence ?? BigInt(0)) + BigInt(1);
    const registration = calculateAeatRegistrationHash({
      issuerTaxId: snapshot.seller.taxId,
      invoiceNumber: number,
      issueDate: snapshot.issueDate,
      invoiceType: snapshot.documentType,
      taxAmount: snapshot.totals.taxAmount,
      totalAmount: snapshot.totals.payableAmount,
      previousHash: priorRecord?.recordHash,
      generatedAt: occurredAt.toISOString(),
    });
    const document = await transaction.fiscalDocument.create({
      data: {
        companyId: normalized.companyId,
        invoiceId: input.invoiceId,
        issuanceKey: normalized.issuanceKey,
        documentType: snapshot.documentType,
        series: normalized.series,
        number,
        issueDate: new Date(`${snapshot.issueDate}T00:00:00.000Z`),
        currency: snapshot.currency,
        taxableBase: snapshot.totals.taxableBase,
        discountAmount: snapshot.totals.discountAmount,
        taxAmount: snapshot.totals.taxAmount,
        withholdingAmount: snapshot.totals.withholdingAmount,
        total: snapshot.totals.payableAmount,
        status: "ISSUED",
        mode: input.mode,
        schemaVersion: 1,
        sourceSnapshot: json(snapshot),
        snapshotHash,
        qrPayload: qr.payload,
        qrVersion: qr.version,
        correctionKind: snapshot.correction?.kind,
        correctionReason: snapshot.correction?.reason,
        originalFiscalDocumentId: snapshot.correction?.originalFiscalDocumentId,
        softwareVersion: normalized.softwareVersion,
        releaseSha: normalized.releaseSha,
        configurationHash: normalized.configurationHash,
        retentionUntil: input.retentionUntil,
        issuedAt: occurredAt,
      },
    });
    const recordPayload = { snapshotHash, qrVersion: qr.version, mode: input.mode };
    await transaction.fiscalRecord.create({
      data: {
        companyId: normalized.companyId,
        fiscalDocumentId: document.id,
        sequence,
        chainScope: "company",
        eventType: "REGISTRATION",
        schemaVersion: 1,
        payload: json(recordPayload),
        canonicalInput: registration.canonicalInput,
        previousHash: priorRecord?.recordHash,
        recordHash: registration.hash,
        algorithm: registration.algorithm,
        softwareVersion: normalized.softwareVersion,
        releaseSha: normalized.releaseSha,
        configurationHash: normalized.configurationHash,
        occurredAt,
      },
    });
    const priorEvent = await lastFiscalEvent(transaction, normalized.companyId);
    const eventSequence = (priorEvent?.sequence ?? BigInt(0)) + BigInt(1);
    const fiscalEventPayload = { number, snapshotHash, recordHash: registration.hash };
    const chainedEventHash = eventHash({ sequence: eventSequence, previousHash: priorEvent?.eventHash ?? null, eventType: "FISCAL_DOCUMENT_ISSUED", occurredAt, payload: fiscalEventPayload });
    await transaction.fiscalEvent.create({
      data: {
        companyId: normalized.companyId,
        fiscalDocumentId: document.id,
        eventType: "FISCAL_DOCUMENT_ISSUED",
        schemaVersion: 1,
        payload: json(fiscalEventPayload),
        sequence: eventSequence,
        previousHash: priorEvent?.eventHash,
        eventHash: chainedEventHash,
        releaseSha: normalized.releaseSha,
        source: "orqena-fiscal-engine",
        occurredAt,
      },
    });
    await enqueueBusinessEvent(transaction, {
      companyId: normalized.companyId,
      type: "fiscal.document.issued.v1",
      entityType: "FiscalDocument",
      entityId: document.id,
      destination: "fiscal-projection",
      idempotencyKey: `fiscal-issued:${document.id}`,
      payload: json({ number, snapshotHash, recordHash: registration.hash }),
    });
    return { document: { ...document, records: [], events: [] }, replayed: false };
  }, { isolationLevel: "ReadCommitted" });
}

export async function voidFiscalDocument(
  prisma: PrismaClient,
  input: { companyId: string; fiscalDocumentId: string; releaseSha: string; reason: string },
  clock: Clock = () => new Date(),
) {
  const companyId = requiredToken(input.companyId, "companyId");
  const documentId = requiredToken(input.fiscalDocumentId, "fiscalDocumentId");
  const releaseSha = requiredToken(input.releaseSha, "releaseSha", /^[a-f0-9]{7,64}$/iu);
  const reason = input.reason.trim();
  if (!reason) throw new Error("FISCAL_VOID_REASON_REQUIRED");
  return prisma.$transaction(async (transaction) => {
    await lockCompany(transaction, companyId);
    const document = await transaction.fiscalDocument.findUniqueOrThrow({ where: { id: documentId } });
    if (document.companyId !== companyId) throw new Error("FISCAL_CROSS_TENANT_DOCUMENT");
    if (document.status === "VOIDED") return { document, replayed: true };
    if (document.status !== "ISSUED") throw new Error("FISCAL_DOCUMENT_NOT_VOIDABLE");
    const snapshot = document.sourceSnapshot as unknown as CanonicalInvoice;
    const occurredAt = clock();
    const priorRecord = await lastFiscalRecord(transaction, companyId);
    const sequence = (priorRecord?.sequence ?? BigInt(0)) + BigInt(1);
    const cancellation = calculateAeatCancellationHash({
      issuerTaxId: snapshot.seller.taxId,
      invoiceNumber: document.number,
      issueDate: snapshot.issueDate,
      previousHash: priorRecord?.recordHash,
      generatedAt: occurredAt.toISOString(),
    });
    await transaction.fiscalRecord.create({
      data: {
        companyId,
        fiscalDocumentId: document.id,
        sequence,
        chainScope: "company",
        eventType: "CANCELLATION",
        payload: json({ reason }),
        canonicalInput: cancellation.canonicalInput,
        previousHash: priorRecord?.recordHash,
        recordHash: cancellation.hash,
        algorithm: cancellation.algorithm,
        softwareVersion: document.softwareVersion,
        releaseSha,
        configurationHash: document.configurationHash,
        occurredAt,
      },
    });
    const priorEvent = await lastFiscalEvent(transaction, companyId);
    const eventSequence = (priorEvent?.sequence ?? BigInt(0)) + BigInt(1);
    const payload = { reason, recordHash: cancellation.hash };
    const chainedEventHash = eventHash({ sequence: eventSequence, previousHash: priorEvent?.eventHash ?? null, eventType: "FISCAL_DOCUMENT_VOIDED", occurredAt, payload });
    await transaction.fiscalEvent.create({
      data: {
        companyId,
        fiscalDocumentId: document.id,
        eventType: "FISCAL_DOCUMENT_VOIDED",
        payload: json(payload),
        sequence: eventSequence,
        previousHash: priorEvent?.eventHash,
        eventHash: chainedEventHash,
        releaseSha,
        source: "orqena-fiscal-engine",
        occurredAt,
      },
    });
    const updated = await transaction.fiscalDocument.update({ where: { id: document.id }, data: { status: "VOIDED", voidedAt: occurredAt } });
    await enqueueBusinessEvent(transaction, {
      companyId,
      type: "fiscal.document.voided.v1",
      entityType: "FiscalDocument",
      entityId: document.id,
      destination: "fiscal-projection",
      idempotencyKey: `fiscal-voided:${document.id}`,
      payload: json({ reason, recordHash: cancellation.hash }),
    });
    return { document: updated, replayed: false };
  }, { isolationLevel: "ReadCommitted" });
}

export async function createDraftSoftwareDeclaration(prisma: PrismaClient, input: {
  companyId: string;
  softwareName: string;
  softwareVersion: string;
  provider: string;
  mode: FiscalEngineMode;
  releaseSha: string;
  configurationHash: string;
  capabilities: Record<string, boolean>;
  validFrom: Date;
}) {
  const payload = {
    softwareName: input.softwareName.trim(),
    softwareVersion: input.softwareVersion.trim(),
    provider: input.provider.trim(),
    mode: input.mode,
    releaseSha: input.releaseSha.trim(),
    configurationHash: input.configurationHash.trim().toLowerCase(),
    capabilities: input.capabilities,
    legalStatus: "DRAFT_REQUIRES_INDEPENDENT_SPECIALIST_APPROVAL",
  };
  if (!payload.softwareName || !payload.softwareVersion || !payload.provider) throw new Error("FISCAL_DECLARATION_INVALID");
  const declarationHash = sha256Hex(canonicalJson(payload));
  return prisma.fiscalSoftwareDeclaration.create({
    data: {
      companyId: input.companyId,
      softwareName: payload.softwareName,
      softwareVersion: payload.softwareVersion,
      provider: payload.provider,
      mode: payload.mode,
      declarationHash,
      releaseSha: payload.releaseSha,
      configurationHash: payload.configurationHash,
      capabilities: json(payload.capabilities),
      approvalStatus: "DRAFT",
      payload: json(payload),
      validFrom: input.validFrom,
    },
  });
}

export function renderDraftSoftwareDeclaration(input: {
  softwareName: string;
  softwareVersion: string;
  providerIdentity: string;
  providerContactReference: string;
  mode: FiscalEngineMode;
  releaseSha: string;
  configurationHash: string;
  capabilities: Record<string, boolean>;
  implementationSummary: string;
  place: string;
  date: string;
}) {
  const declaration = {
    documentStatus: "DRAFT_REQUIRES_INDEPENDENT_FISCAL_SPECIALIST_SIGNATURE",
    softwareName: input.softwareName.trim(),
    softwareVersion: input.softwareVersion.trim(),
    providerIdentity: input.providerIdentity.trim(),
    providerContactReference: input.providerContactReference.trim(),
    mode: input.mode,
    releaseSha: input.releaseSha.trim(),
    configurationHash: input.configurationHash.trim(),
    capabilities: input.capabilities,
    implementationSummary: input.implementationSummary.trim(),
    place: input.place.trim(),
    date: input.date.trim(),
  };
  if (Object.entries(declaration).some(([key, value]) => key !== "capabilities" && typeof value === "string" && !value)) {
    throw new Error("FISCAL_DECLARATION_FIELD_REQUIRED");
  }
  const declarationHash = sha256Hex(canonicalJson(declaration));
  return [
    "# Borrador de declaración responsable del sistema de facturación",
    "",
    `Estado: ${declaration.documentStatus}`,
    `Producto y versión: ${declaration.softwareName} ${declaration.softwareVersion}`,
    `Productor: ${declaration.providerIdentity}`,
    `Contacto (referencia, no secreto): ${declaration.providerContactReference}`,
    `Modalidad técnica: ${declaration.mode}`,
    `Release: ${declaration.releaseSha}`,
    `Configuración: ${declaration.configurationHash}`,
    `Capacidades declaradas: ${canonicalJson(declaration.capabilities)}`,
    `Implementación técnica: ${declaration.implementationSummary}`,
    `Lugar y fecha: ${declaration.place}, ${declaration.date}`,
    `Hash del borrador: ${declarationHash}`,
    "",
    "Este borrador técnico no constituye conformidad jurídica ni declaración firmada.",
  ].join("\n");
}

export function classifyLegacyFiscalDocument(document: { legacySource: boolean; softwareVersion: string | null; snapshotHash: string | null }) {
  return document.legacySource || !document.softwareVersion || !document.snapshotHash
    ? { classification: "LEGACY_NOT_RETRO_CERTIFIED" as const, eligibleForTransmission: false }
    : { classification: "NATIVE_CHAINED" as const, eligibleForTransmission: true };
}

export const fiscalEventHash = eventHash;
