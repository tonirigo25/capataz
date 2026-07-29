import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { PrismaClient } from "@prisma/client";
import { generate } from "otplib";
import { withCompanyContext, type CompanyContext } from "../../lib/auth/session";
import { appendSensitiveAuditLog, verifySensitiveAuditChain } from "../../lib/security/audit-chain";
import { confirmTotpEnrollment, isSecondFactorFresh, startTotpEnrollment, verifySessionSecondFactor } from "../../lib/security/mfa";
import type { EncryptionKeyring } from "../../lib/platform/encryption";
import { endSupportAccess, startSupportAccess } from "../../lib/commercial/platform-service";
import { resolveSupportAccess } from "../../lib/commercial/platform";
import { FakeStorageProvider } from "../../lib/platform/providers/fake";
import {
  cleanupExpiredPresignedUploads,
  presignedUploadReservationData,
  PrivateStorageService,
} from "../../lib/private-storage";
import { LocalDeterministicMalwareScanner, type MalwareScanner } from "../../lib/security/malware-scanner";
import type { DocumentStorage } from "../../lib/document-storage";
import { getConversationForCompany } from "../../lib/orqena/conversation-repository";
import { globalSearch } from "../../lib/search";
import { createAuthenticatedCustomerPortal } from "../../lib/commercial/subscription-service";
import { claimEmailItem } from "../../lib/email/outbox";
import {
  applyStoredObjectRetention,
  applySubjectErasure,
  completePrivacyRequest,
  createCompanyExport,
  createPrivacyRequest,
  createPrivacyRiskAssessment,
  exportProcessingActivities,
  extendPrivacyRequestDeadline,
  planStoredObjectRetention,
  planSubjectErasure,
  prepareCompanyExportRestore,
  privacyDeadlineAlerts,
  recordConsent,
  registerLegalDocumentVersion,
  verifyCompanyExportPackage,
  verifyPrivacyRequestIdentity,
} from "../../lib/privacy/governance";
import { seedCompanyPrivacyCatalog } from "../../lib/privacy/catalog";
import { closeIncidentWithPostmortem, detectStaleHeartbeats, evaluateOperationalAlerts, recordJobHeartbeat, recordOperationalMetric, runSyntheticSmoke } from "../../lib/observability/operations";
import { decideBreachNotification, recordBreachNotification, registerDataBreach } from "../../lib/privacy/breaches";

const prisma = new PrismaClient();
const now = new Date("2026-07-26T14:00:00.000Z");

async function main() {
  let passed = 0;
  async function check(name: string, operation: () => unknown | Promise<unknown>) {
    await operation();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  }

  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations[0]?.count, 45);

  const suffix = Date.now().toString(36);
  const [companyA, companyB, auditCompany] = await Promise.all([
    prisma.company.create({ data: { slug: `f5-a-${suffix}`, nombreComercial: "F5 Company Alpha", email: "billing-alpha@example.invalid" } }),
    prisma.company.create({ data: { slug: `f5-b-${suffix}`, nombreComercial: "F5 Company Beta", email: "billing-beta@example.invalid" } }),
    prisma.company.create({ data: { slug: `f5-audit-${suffix}`, nombreComercial: "F5 Audit Chain" } }),
  ]);
  const [userA, userB, subject] = await Promise.all([
    prisma.user.create({ data: { email: `alpha-${suffix}@example.invalid`, emailNormalized: `alpha-${suffix}@example.invalid`, passwordHash: "test-only", displayName: "Alpha Owner", status: "active", emailVerifiedAt: now } }),
    prisma.user.create({ data: { email: `beta-${suffix}@example.invalid`, emailNormalized: `beta-${suffix}@example.invalid`, passwordHash: "test-only", displayName: "Beta Owner", status: "active", emailVerifiedAt: now } }),
    prisma.user.create({ data: { email: `subject-${suffix}@example.invalid`, emailNormalized: `subject-${suffix}@example.invalid`, passwordHash: "test-only", displayName: "Privacy Subject", status: "active", emailVerifiedAt: now } }),
  ]);
  const [membershipA, membershipB] = await Promise.all([
    prisma.companyMembership.create({ data: { userId: userA.id, companyId: companyA.id, role: "OWNER", functionalProfileKey: "OWNER", status: "active", acceptedAt: now } }),
    prisma.companyMembership.create({ data: { userId: userB.id, companyId: companyB.id, role: "OWNER", functionalProfileKey: "OWNER", status: "active", acceptedAt: now } }),
    prisma.companyMembership.create({ data: { userId: subject.id, companyId: companyA.id, role: "MEMBER", functionalProfileKey: "WORKER", status: "active", acceptedAt: now } }),
  ]);
  const session = await prisma.session.create({ data: { userId: userA.id, tokenHash: `f5-session-${suffix}`, expiresAt: new Date(now.getTime() + 86_400_000) } });
  const platform = await prisma.platformAccount.create({ data: { userId: userA.id, role: "PLATFORM_OWNER" } });
  const contextA: CompanyContext = { sessionId: session.id, userId: userA.id, email: userA.email, displayName: userA.displayName, expiresAt: session.expiresAt, secondFactorVerifiedAt: null, companyId: companyA.id, membershipId: membershipA.id, role: "OWNER", functionalProfileKey: "OWNER", isDemo: false, companyName: companyA.nombreComercial, companyStatus: companyA.status, commercialStatus: companyA.commercialStatus ?? "ACTIVE" };

  const [clientA, clientB] = await Promise.all([
    prisma.client.create({ data: { companyId: companyA.id, nombre: `Alpha Unique ${suffix}`, telefono: "000", direccion: "Alpha", tipo: "Empresa", origen: "test" } }),
    prisma.client.create({ data: { companyId: companyB.id, nombre: `Beta Secret ${suffix}`, telefono: "000", direccion: "Beta", tipo: "Empresa", origen: "test" } }),
  ]);
  const [invoiceA, invoiceB] = await Promise.all([
    prisma.invoice.create({ data: { companyId: companyA.id, clienteId: clientA.id, numero: `F5-A-${suffix}`, concepto: "Alpha", importeBase: 100, iva: 21, total: 121, pendiente: 121, fechaEmision: now, fechaVencimiento: new Date(now.getTime() + 86_400_000) } }),
    prisma.invoice.create({ data: { companyId: companyB.id, clienteId: clientB.id, numero: `F5-B-${suffix}`, concepto: "Beta", importeBase: 100, iva: 21, total: 121, pendiente: 121, fechaEmision: now, fechaVencimiento: new Date(now.getTime() + 86_400_000) } }),
  ]);
  const conversationB = await prisma.chatConversation.create({ data: { companyId: companyB.id, ownerUserId: userB.id, title: `Beta chat ${suffix}` } });

  await check("MFA secret is encrypted and privileged session challenge becomes fresh", async () => {
    const keyring: EncryptionKeyring = { activeVersion: "test-v1", keys: new Map([["test-v1", Buffer.alloc(32, 7)]]) };
    const enrollment = await startTotpEnrollment({ prisma, userId: userA.id, email: userA.email, keyring });
    const uri = new URL(enrollment.uri);
    const secret = uri.searchParams.get("secret");
    assert(secret);
    const factor = await prisma.mfaFactor.findUniqueOrThrow({ where: { id: enrollment.factorId } });
    assert.doesNotMatch(`${factor.ciphertext}${factor.authenticationTag}`, new RegExp(secret, "u"));
    const token = await generate({ secret, epoch: Math.floor(now.getTime() / 1_000) });
    await confirmTotpEnrollment({ prisma, userId: userA.id, factorId: factor.id, token, keyring, now });
    await verifySessionSecondFactor({ prisma, userId: userA.id, sessionId: session.id, token, keyring, now });
    const verified = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(isSecondFactorFresh(verified.secondFactorVerifiedAt, new Date(now.getTime() + 60_000)), true);
  });

  await check("sensitive audit chain detects historical tampering", async () => {
    await prisma.$transaction((transaction) => appendSensitiveAuditLog(transaction, { companyId: auditCompany.id, userActorId: userA.id, action: "test.first", targetType: "Control", targetId: "1", metadata: { safe: true } }));
    await prisma.$transaction((transaction) => appendSensitiveAuditLog(transaction, { companyId: auditCompany.id, userActorId: userA.id, action: "test.second", targetType: "Control", targetId: "2", metadata: { safe: true } }));
    assert.equal((await verifySensitiveAuditChain(prisma, `company:${auditCompany.id}`)).valid, true);
    const first = await prisma.auditLog.findFirstOrThrow({ where: { chainScope: `company:${auditCompany.id}` }, orderBy: { createdAt: "asc" } });
    await prisma.auditLog.update({ where: { id: first.id }, data: { reason: "tampered" } });
    const invalid = await verifySensitiveAuditChain(prisma, `company:${auditCompany.id}`);
    assert.equal(invalid.valid, false);
    assert.equal(invalid.reason, "ENTRY_HASH_INVALID");
  });

  await check("temporary support is minimal expiring closable and chained", async () => {
    const grant = await startSupportAccess({ platformAccountId: platform.id, platformRole: platform.role }, { companyId: companyA.id, reason: "F5 isolated support test", ticket: "F5-TEST", minutes: 5 });
    const active = await resolveSupportAccess(platform.id, companyA.id);
    assert.equal(active?.id, grant.id);
    assert.deepEqual(active?.capabilityKeys, ["company.view", "company.configuration.view"]);
    await endSupportAccess({ platformAccountId: platform.id, platformRole: platform.role }, grant.id);
    assert.equal(await resolveSupportAccess(platform.id, companyA.id), null);
    const chain = await verifySensitiveAuditChain(prisma, `company:${companyA.id}`);
    assert.equal(chain.valid, true);
  });

  await check("two-tenant negative suite covers PDFs search chat jobs billing storage and exports", async () => {
    const results = await withCompanyContext(contextA, () => globalSearch(`Beta Secret ${suffix}`));
    assert.equal(Object.values(results).flat().length, 0);
    assert.equal(await getConversationForCompany({ companyId: companyA.id, userId: userA.id, membershipId: membershipA.id }, conversationB.id), null);
    const pdf = await import("../../app/(app)/dinero/[id]/pdf/route");
    await assert.rejects(() => withCompanyContext(contextA, () => pdf.GET(new Request(`http://localhost/dinero/${invoiceB.id}/pdf`), { params: Promise.resolve({ id: invoiceB.id }) })), /404|not found|NEXT_HTTP_ERROR_FALLBACK/iu);

    const outboxB = await prisma.emailOutbox.create({ data: { companyId: companyB.id, eventKey: "billing_payment_failed", templateKey: "billing_payment_failed", templateVersion: 1, recipient: userB.email, subject: "F5 isolated", payload: {}, idempotencyKey: `f5-job-${suffix}`, availableAt: new Date(now.getTime() - 1_000) } });
    assert.equal(await claimEmailItem(prisma, { id: outboxB.id, companyId: companyA.id, now }), null);

    const plan = await prisma.plan.upsert({ where: { key: "STARTER" }, update: {}, create: { key: "STARTER", name: "Starter", description: "Test", audience: "test" } });
    await Promise.all([
      prisma.subscription.create({ data: { companyId: companyA.id, planId: plan.id, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000) } }),
      prisma.subscription.create({ data: { companyId: companyB.id, planId: plan.id, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000) } }),
      prisma.billingCustomer.create({ data: { companyId: companyA.id, provider: "spy", externalCustomerId: `customer-a-${suffix}` } }),
      prisma.billingCustomer.create({ data: { companyId: companyB.id, provider: "spy", externalCustomerId: `customer-b-${suffix}` } }),
    ]);
    let portalCompany = ""; let portalCustomer = "";
    await createAuthenticatedCustomerPortal(prisma, { context: { companyId: companyA.id, userId: userA.id, role: "OWNER" }, returnUrl: "https://example.invalid/plan", idempotencyKey: `portal-${suffix}`, provider: { name: "spy", mode: "fake", async createCheckout() { throw new Error("unused"); }, async createPortal(input) { portalCompany = input.companyId; portalCustomer = input.customerId; return { provider: "spy", mode: "fake", reference: "portal-a", idempotencyKey: input.idempotencyKey, acceptedAt: now.toISOString() }; } } });
    assert.equal(portalCompany, companyA.id);
    assert.equal(portalCustomer, `customer-a-${suffix}`);
    assert.notEqual(portalCustomer, `customer-b-${suffix}`);
    assert(invoiceA.id);
  });

  await check("presigned upload reservations avoid quota and clean abandoned objects", async () => {
    const staleCreatedAt = new Date(now.getTime() - 16 * 60_000);
    const recentCreatedAt = new Date(now.getTime() - 5 * 60_000);
    const staleReservation = presignedUploadReservationData({
      companyId: companyA.id,
      userId: userA.id,
      filename: "stale.pdf",
      mimeType: "application/pdf",
      checksum: "a".repeat(64),
      now: staleCreatedAt,
    });
    assert.equal(staleReservation.status, "PROCESSING");
    assert.equal(staleReservation.size, null);
    const [stale, recent, otherTenant] = await Promise.all([
      prisma.document.create({
        data: {
          ...staleReservation,
          size: 4_096,
          storageKey: `companies/${companyA.id}/documentos/stale/stale.pdf`,
          createdAt: staleCreatedAt,
        },
      }),
      prisma.document.create({
        data: {
          ...presignedUploadReservationData({
            companyId: companyA.id,
            userId: userA.id,
            filename: "recent.pdf",
            mimeType: "application/pdf",
            checksum: "b".repeat(64),
            now: recentCreatedAt,
          }),
          storageKey: `companies/${companyA.id}/documentos/recent/recent.pdf`,
          createdAt: recentCreatedAt,
        },
      }),
      prisma.document.create({
        data: {
          ...presignedUploadReservationData({
            companyId: companyB.id,
            userId: userB.id,
            filename: "other.pdf",
            mimeType: "application/pdf",
            checksum: "c".repeat(64),
            now: staleCreatedAt,
          }),
          size: 8_192,
          storageKey: `companies/${companyB.id}/documentos/other/other.pdf`,
          createdAt: staleCreatedAt,
        },
      }),
    ]);
    const deletedStorageKeys: string[] = [];
    const cleanupStorage: DocumentStorage = {
      kind: "local",
      async put() { throw new Error("unused"); },
      async get() { throw new Error("unused"); },
      async delete(input) { deletedStorageKeys.push(input.storageKey); },
      async presignPut() { throw new Error("unused"); },
      async presignGet() { return null; },
      async verify() {},
    };
    const cleanup = await cleanupExpiredPresignedUploads(
      prisma,
      cleanupStorage,
      { companyId: companyA.id, now },
    );
    assert.deepEqual(cleanup, {
      expiredReservations: 1,
      storageObjectsDeleted: 1,
    });
    assert.deepEqual(deletedStorageKeys, [
      `companies/${companyA.id}/documentos/stale/stale.pdf`,
    ]);
    const [cleaned, preservedRecent, preservedOtherTenant] = await Promise.all([
      prisma.document.findUniqueOrThrow({ where: { id: stale.id } }),
      prisma.document.findUniqueOrThrow({ where: { id: recent.id } }),
      prisma.document.findUniqueOrThrow({ where: { id: otherTenant.id } }),
    ]);
    assert.equal(cleaned.status, "CANCELLED");
    assert(cleaned.archivedAt);
    assert.equal(cleaned.size, null);
    assert.equal(cleaned.storageKey, null);
    assert.equal(preservedRecent.status, "PROCESSING");
    assert.equal(preservedRecent.archivedAt, null);
    assert.equal(preservedRecent.size, null);
    assert.equal(preservedOtherTenant.status, "PROCESSING");
    assert.equal(preservedOtherTenant.archivedAt, null);
    assert.equal(preservedOtherTenant.size, 8_192);
    assert.equal(
      await prisma.document.count({
        where: {
          id: { in: [stale.id, recent.id] },
          companyId: companyA.id,
          archivedAt: null,
        },
      }),
      1,
    );
    const storageUsage = await prisma.document.aggregate({
      where: {
        id: { in: [stale.id, recent.id] },
        companyId: companyA.id,
        archivedAt: null,
        storedObjectId: null,
      },
      _sum: { size: true },
    });
    assert.equal(storageUsage._sum.size, null);
  });

  const storageProvider = new FakeStorageProvider();
  const storage = new PrivateStorageService(prisma, storageProvider, "f5-private", "f5-storage-signing-secret-32-bytes!!", new LocalDeterministicMalwareScanner());
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  let alphaObjectId = ""; let heldObjectId = ""; let betaObjectId = "";
  await check("quarantine scan blocks infected files and releases clean files", async () => {
    const clean = await storage.put({ companyId: companyA.id, bytes: png, originalName: "clean.png", mimeType: "image/png", classification: "CONFIDENTIAL", idempotencyKey: `clean-${suffix}` });
    alphaObjectId = clean.id;
    assert.equal(clean.status, "READY");
    const infected = new Uint8Array([...png, ...new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE")]);
    await assert.rejects(() => storage.put({ companyId: companyA.id, bytes: infected, originalName: "infected.png", mimeType: "image/png", classification: "RESTRICTED", idempotencyKey: `infected-${suffix}` }), /QUARANTINED/u);
    const blocked = await prisma.storedObject.findFirstOrThrow({ where: { companyId: companyA.id, status: "BLOCKED" } });
    await assert.rejects(() => storage.readVerified({ companyId: companyA.id, objectId: blocked.id }));
    assert.equal((await prisma.uploadScan.findFirstOrThrow({ where: { storedObjectId: blocked.id } })).status, "INFECTED");
  });

  await check("quarantined replay resumes scanning while blocked replay stays denied", async () => {
    let recoveryScans = 0;
    const recoveringScanner: MalwareScanner = {
      async scan(input) {
        recoveryScans += 1;
        if (recoveryScans === 1) throw new Error("TRANSIENT_SCANNER_FAILURE");
        return {
          status: "CLEAN",
          engine: "f5-recovery-scanner",
          engineVersion: "1",
          reference: input.sha256.slice(0, 24),
        };
      },
    };
    const recoveringStorage = new PrivateStorageService(
      prisma,
      storageProvider,
      "f5-private",
      "f5-storage-signing-secret-32-bytes!!",
      recoveringScanner,
    );
    const recoveryInput = {
      companyId: companyA.id,
      bytes: png,
      originalName: "resume.png",
      mimeType: "image/png",
      classification: "CONFIDENTIAL",
      idempotencyKey: `resume-${suffix}`,
    };
    await assert.rejects(
      () => recoveringStorage.put(recoveryInput),
      /STORAGE_OBJECT_QUARANTINED/u,
    );
    const quarantined = await prisma.storedObject.findFirstOrThrow({
      where: {
        companyId: companyA.id,
        safeName: "resume.png",
        status: "QUARANTINED",
      },
    });
    const recovered = await recoveringStorage.put(recoveryInput);
    assert.equal(recovered.id, quarantined.id);
    assert.equal(recovered.status, "READY");
    assert.equal(recoveryScans, 2);
    const replayedReady = await recoveringStorage.put(recoveryInput);
    assert.equal(replayedReady.id, recovered.id);
    assert.equal(recoveryScans, 2);
    assert.deepEqual(
      new Set(
        (
          await prisma.uploadScan.findMany({
            where: { storedObjectId: recovered.id },
            select: { status: true },
          })
        ).map((scan) => scan.status),
      ),
      new Set(["ERROR", "CLEAN"]),
    );

    let blockedScans = 0;
    const blockedScanner: MalwareScanner = {
      async scan(input) {
        blockedScans += 1;
        return new LocalDeterministicMalwareScanner().scan(input);
      },
    };
    const blockedStorage = new PrivateStorageService(
      prisma,
      storageProvider,
      "f5-private",
      "f5-storage-signing-secret-32-bytes!!",
      blockedScanner,
    );
    const infected = new Uint8Array([
      ...png,
      ...new TextEncoder().encode(
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
      ),
    ]);
    const blockedInput = {
      companyId: companyA.id,
      bytes: infected,
      originalName: "blocked-replay.png",
      mimeType: "image/png",
      classification: "RESTRICTED",
      idempotencyKey: `blocked-replay-${suffix}`,
    };
    await assert.rejects(
      () => blockedStorage.put(blockedInput),
      /STORAGE_OBJECT_QUARANTINED/u,
    );
    const blocked = await prisma.storedObject.findFirstOrThrow({
      where: {
        companyId: companyA.id,
        safeName: "blocked-replay.png",
        status: "BLOCKED",
      },
    });
    await assert.rejects(
      () => blockedStorage.put(blockedInput),
      new RegExp(`STORAGE_OBJECT_BLOCKED:${blocked.id}`, "u"),
    );
    assert.equal(blockedScans, 1);
    for (const fixtureObject of [recovered, blocked]) {
      await storageProvider.delete({
        companyId: companyA.id,
        objectKey: fixtureObject.objectKey,
        idempotencyKey: `cleanup-${fixtureObject.id}`,
      });
      await prisma.storedObject.update({
        where: { id: fixtureObject.id },
        data: { status: "DELETED", deletedAt: now },
      });
    }
  });

  await check("storage and grants deny cross-tenant reads", async () => {
    const beta = await storage.put({ companyId: companyB.id, bytes: png, originalName: "beta.png", mimeType: "image/png", classification: "CONFIDENTIAL", idempotencyKey: `beta-${suffix}` });
    betaObjectId = beta.id;
    await assert.rejects(() => storage.readVerified({ companyId: companyA.id, objectId: beta.id }));
    await assert.rejects(() => storage.authorizeDownload({ companyId: companyA.id, objectId: beta.id, baseUrl: "https://example.invalid" }));
  });

  await check("retention dry-run legal hold and verified deletion preserve evidence", async () => {
    const held = await storage.put({ companyId: companyA.id, bytes: png, originalName: "held.png", mimeType: "image/png", classification: "RESTRICTED", idempotencyKey: `held-${suffix}` });
    heldObjectId = held.id;
    await prisma.storedObject.updateMany({ where: { id: { in: [alphaObjectId, heldObjectId] } }, data: { retainUntil: new Date(now.getTime() - 1_000), retentionKey: "private_documents" } });
    await prisma.legalHold.create({ data: { companyId: companyA.id, resourceType: "StoredObject", resourceId: heldObjectId, reason: "F5 test hold", startsAt: new Date(now.getTime() - 10_000) } });
    const plan = await planStoredObjectRetention(prisma, { companyId: companyA.id, now });
    assert.equal(plan.candidates.filter((item) => !item.blocked).length, 1);
    assert.equal(plan.candidates.filter((item) => item.blocked).length, 1);
    await assert.rejects(() => applyStoredObjectRetention(prisma, storageProvider, { companyId: companyA.id, executionId: plan.execution.id, confirmation: "DELETE EVERYTHING", now }), /HUMAN_CONFIRMATION/u);
    const applied = await applyStoredObjectRetention(prisma, storageProvider, { companyId: companyA.id, executionId: plan.execution.id, confirmation: "DELETE 1 OBJECTS", now });
    assert.equal(applied.receipts.length, 1);
    assert.equal((await prisma.storedObject.findUniqueOrThrow({ where: { id: alphaObjectId } })).status, "DELETED");
    assert.equal((await prisma.storedObject.findUniqueOrThrow({ where: { id: heldObjectId } })).status, "READY");
  });

  await check("company export excludes other tenant and provider secrets and restores references", async () => {
    await assert.rejects(() => createCompanyExport(prisma, { companyId: companyA.id, now }), /OBJECT_READER_REQUIRED/u);
    const exported = await createCompanyExport(prisma, { companyId: companyA.id, now, readObject: async (objectId) => (await storage.readVerified({ companyId: companyA.id, objectId })).bytes });
    const serialized = JSON.stringify(exported.package);
    assert.doesNotMatch(serialized, new RegExp(`Beta Secret ${suffix}`, "u"));
    assert.doesNotMatch(serialized, /objectKey|providerCustomerId|ciphertext|tokenHash/u);
    const verified = verifyCompanyExportPackage(exported.package, exported.packageHash);
    assert.equal(verified.valid, true);
    assert.equal(verified.objects, 1);
    const restored = prepareCompanyExportRestore(exported.package, `restored-${companyA.id}`);
    assert(restored.references.length > 0);
    assert.doesNotMatch(JSON.stringify(restored), /objectKey|providerCustomerId/u);
    const tampered = structuredClone(exported.package);
    ((tampered.records as Record<string, unknown[]>).Company[0] as Record<string, unknown>).nombreComercial = "tampered";
    assert.throws(() => verifyCompanyExportPackage(tampered, exported.packageHash), /HASH_INVALID/u);
    const tamperedObject = structuredClone(exported.package);
    tamperedObject.objects[0].contentBase64 = Buffer.from("tampered-object", "utf8").toString("base64");
    assert.throws(() => verifyCompanyExportPackage(tamperedObject, exported.packageHash), /OBJECT_HASH_INVALID/u);
    assert(betaObjectId);
  });

  await check("RAT legal versions consent rights SLA export and closure are traceable", async () => {
    const seeded = await seedCompanyPrivacyCatalog(prisma, companyA.id);
    assert.equal(seeded.processingActivities, 6);
    const rat = await exportProcessingActivities(prisma, companyA.id);
    assert(rat.activities.every((item) => item.purpose && item.lawfulBasis && item.retentionKey));
    const legal = await registerLegalDocumentVersion(prisma, { documentKey: "privacy", version: "1.0-draft", content: "F5 isolated privacy draft", storageKey: "docs/legal/templates/PRIVACY.v1.md", effectiveAt: now });
    await prisma.legalAcceptance.create({ data: { companyId: companyA.id, userId: userA.id, legalDocumentVersionId: legal.id, purpose: "privacy_notice", acceptedAt: now } });
    assert.equal((await prisma.legalAcceptance.findFirstOrThrow({ where: { userId: userA.id } })).legalDocumentVersionId, legal.id);
    await recordConsent(prisma, { companyId: companyA.id, subjectId: userA.id, purpose: "optional_analytics", granted: true, policyVersion: "1.0-draft", source: "settings", now });
    await recordConsent(prisma, { companyId: companyA.id, subjectId: userA.id, purpose: "optional_analytics", granted: false, policyVersion: "1.0-draft", source: "settings", now: new Date(now.getTime() + 1_000) });
    assert.deepEqual((await prisma.consentRecord.findMany({ where: { companyId: companyA.id, subjectId: userA.id }, orderBy: { createdAt: "asc" } })).map((item) => item.granted), [true, false]);
    const request = await createPrivacyRequest(prisma, { companyId: companyA.id, requestType: "PORTABILITY", subjectReference: userA.emailNormalized, now });
    assert.equal(request.dueAt.toISOString(), "2026-08-26T14:00:00.000Z");
    await verifyPrivacyRequestIdentity(prisma, { companyId: companyA.id, requestId: request.id, actorReference: userA.id, now });
    const extension = await extendPrivacyRequestDeadline(prisma, { companyId: companyA.id, requestId: request.id, months: 2, reason: "Complex isolated request", communicationRef: "local-message-1", now });
    assert.equal(extension.dueAt.toISOString(), "2026-10-26T14:00:00.000Z");
    assert.equal((await privacyDeadlineAlerts(prisma, { companyId: companyA.id, now: new Date("2026-10-20T14:00:00.000Z") })).some((item) => item.id === request.id), true);
    const subjectExport = await createCompanyExport(prisma, { companyId: companyA.id, exportType: "SUBJECT", subjectReference: userA.emailNormalized, privacyRequestId: request.id, now });
    assert.doesNotMatch(JSON.stringify(subjectExport.package), /passwordHash|tokenHash/u);
    await completePrivacyRequest(prisma, { companyId: companyA.id, requestId: request.id, resolution: { exported: subjectExport.record.id }, communicationRef: "local-message-2", actorReference: userA.id, now });
    assert.equal((await prisma.privacyRequestEvent.count({ where: { privacyRequestId: request.id } })) >= 4, true);
  });

  await check("subject erasure is dry-run first blocked by hold and preserves fiscal records", async () => {
    const hold = await prisma.legalHold.create({ data: { companyId: companyA.id, resourceType: "PrivacySubject", subjectReference: subject.id, reason: "F5 legal hold", startsAt: new Date(now.getTime() - 1_000) } });
    const blocked = await planSubjectErasure(prisma, { companyId: companyA.id, subjectReference: subject.id, now });
    assert.equal(blocked.execution.status, "BLOCKED");
    await prisma.legalHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedAt: now } });
    const plan = await planSubjectErasure(prisma, { companyId: companyA.id, subjectReference: subject.id, now });
    await assert.rejects(() => applySubjectErasure(prisma, { companyId: companyA.id, executionId: plan.execution.id, confirmation: "ERASE", actorReference: userA.id, now }), /HUMAN_CONFIRMATION/u);
    const applied = await applySubjectErasure(prisma, { companyId: companyA.id, executionId: plan.execution.id, confirmation: `ERASE SUBJECT ${subject.id}`, actorReference: userA.id, now });
    assert.equal(applied.status, "COMPLETED");
    const anonymized = await prisma.user.findUniqueOrThrow({ where: { id: subject.id } });
    assert.match(anonymized.emailNormalized, /^erased-.*@example\.invalid$/u);
    assert.equal(await prisma.invoice.count({ where: { companyId: companyA.id } }), 1);
  });

  await check("risk DPIA and breach workflow produce decision timeline and postmortem", async () => {
    const activity = await prisma.processingActivity.findFirstOrThrow({ where: { companyId: companyA.id, key: "ai_assistance" } });
    const assessment = await createPrivacyRiskAssessment(prisma, { companyId: companyA.id, processingActivityId: activity.id, assessmentType: "DPIA", version: "1", highRisk: true, risks: [{ key: "data_disclosure", inherent: "HIGH" }], safeguards: [{ key: "minimization" }], residualRisk: { level: "MEDIUM", externalApprovalRequired: true }, owner: "privacy", nextReviewAt: new Date("2027-01-26T00:00:00.000Z") });
    assert.equal(assessment.highRisk, true);
    const registered = await registerDataBreach(prisma, { companyId: companyA.id, title: "F5 simulated breach", severity: "SEV2", detectedAt: now, categories: ["contact"], subjectCategories: ["users"], estimatedSubjects: 2, initialMeasures: ["isolated"], actor: userA.id });
    assert.equal(registered.authorityDecisionDueAt.toISOString(), "2026-07-29T14:00:00.000Z");
    await decideBreachNotification(prisma, { companyId: companyA.id, breachId: registered.breach.id, risk: "HIGH_RISK", reason: "Simulated high-risk decision", actor: userA.id, now });
    await recordBreachNotification(prisma, { companyId: companyA.id, breachId: registered.breach.id, audience: "AUTHORITY", communicationRef: "simulated-authority-no-send", actor: userA.id, now });
    await recordBreachNotification(prisma, { companyId: companyA.id, breachId: registered.breach.id, audience: "SUBJECTS", communicationRef: "simulated-subjects-no-send", actor: userA.id, now });
    const closed = await closeIncidentWithPostmortem(prisma, { incidentId: registered.incident.id, rootCause: "F5 simulation", resolution: "Contained without external transmission", actor: userA.id, actions: [{ description: "Review detector threshold", owner: "security", dueAt: new Date(now.getTime() + 7 * 86_400_000) }], now });
    assert.equal(closed.status, "CLOSED");
    assert(closed.timeline.length >= 4);
    assert.equal(closed.actions.length, 1);
  });

  await check("metrics alerts heartbeat incidents and synthetic history are persisted", async () => {
    await recordOperationalMetric(prisma, { metricKey: "http.errors.rate", value: 0.04, measuredAt: now, dimensions: { environment: "test", route: "/api/test", forbidden: "drop" } });
    const alerts = await evaluateOperationalAlerts(prisma, { environment: "test", since: new Date(now.getTime() - 60_000), now });
    assert.equal(alerts[0]?.severity, "SEV2");
    await recordJobHeartbeat(prisma, { jobKey: "email-outbox", environment: "test", outcome: "SUCCEEDED", expectedEverySeconds: 300, deadLetterCount: 1, now: new Date(now.getTime() - 1_000_000) });
    const stale = await detectStaleHeartbeats(prisma, { environment: "test", now });
    assert.equal(stale.some((item) => item.jobKey === "email-outbox"), true);
    const synthetic = await runSyntheticSmoke(prisma, { baseUrl: "https://example.invalid", environment: "test", release: "f5-local", now, fetcher: async () => new Response("ok", { status: 200 }), authenticatedProbe: async () => undefined });
    assert.equal(synthetic.record.status, "PASS");
    assert.equal(synthetic.record.assertionCount, 5);
  });

  const companyChain = await verifySensitiveAuditChain(prisma, `company:${companyA.id}`);
  assert.equal(companyChain.valid, true);
  process.stdout.write(`${JSON.stringify({ ok: true, passed, migrations: migrations[0]?.count, companies: 3, users: 3, tenantNegativeDomains: ["pdf", "export", "search", "chat", "jobs", "billing", "storage"], auditChainEntries: companyChain.checked, externalCalls: 0, productionWrites: 0 }, null, 2)}\n`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
