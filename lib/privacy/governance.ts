import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { StorageProvider } from "@/lib/platform/providers/contracts";
import { appendSensitiveAuditLog, sha256, stableJson } from "@/lib/security/audit-chain";

export const privacyRequestTypes = ["ACCESS", "RECTIFICATION", "ERASURE", "OBJECTION", "RESTRICTION", "PORTABILITY"] as const;
export const dataClassifications = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export const privacySafeTelemetryFields = new Set(["requestId", "correlationId", "operation", "route", "status", "durationMs", "jobKey", "provider", "errorCode", "release", "environment", "companyHash", "actorHash"]);

export type ProcessingActivityInput = {
  key: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories: string[];
  subjectTypes: string[];
  recipients: string[];
  transferDetails?: Prisma.InputJsonValue | null;
  retentionKey: string;
  owner: string;
};

export async function upsertProcessingActivity(prisma: PrismaClient, companyId: string, input: ProcessingActivityInput) {
  validateCatalogKey(input.key);
  if (!input.purpose.trim() || !input.lawfulBasis.trim() || !input.retentionKey.trim() || !input.owner.trim()) throw new Error("PROCESSING_ACTIVITY_INCOMPLETE");
  return prisma.processingActivity.upsert({
    where: { companyId_key: { companyId, key: input.key } },
    update: { purpose: input.purpose, lawfulBasis: input.lawfulBasis, dataCategories: input.dataCategories, subjectTypes: input.subjectTypes, recipients: input.recipients, transferDetails: input.transferDetails ?? Prisma.JsonNull, retentionKey: input.retentionKey, owner: input.owner, active: true },
    create: { companyId, key: input.key, purpose: input.purpose, lawfulBasis: input.lawfulBasis, dataCategories: input.dataCategories, subjectTypes: input.subjectTypes, recipients: input.recipients, transferDetails: input.transferDetails ?? Prisma.JsonNull, retentionKey: input.retentionKey, owner: input.owner },
  });
}

export async function exportProcessingActivities(prisma: PrismaClient, companyId: string) {
  const activities = await prisma.processingActivity.findMany({ where: { companyId, active: true }, orderBy: { key: "asc" } });
  const payload = activities.map((activity) => ({ key: activity.key, purpose: activity.purpose, lawfulBasis: activity.lawfulBasis, dataCategories: activity.dataCategories, subjectTypes: activity.subjectTypes, recipients: activity.recipients, transferDetails: activity.transferDetails, retentionKey: activity.retentionKey, owner: activity.owner, updatedAt: activity.updatedAt.toISOString() }));
  return { schemaVersion: 1, companyId, activities: payload, sha256: sha256(stableJson(payload)) };
}

export async function registerLegalDocumentVersion(prisma: PrismaClient, input: { documentKey: string; locale?: string; version: string; content: string; storageKey: string; effectiveAt: Date }) {
  const contentHash = sha256(input.content);
  return prisma.legalDocumentVersion.create({ data: { documentKey: input.documentKey, locale: input.locale ?? "es-ES", version: input.version, contentHash, storageKey: input.storageKey, effectiveAt: input.effectiveAt } });
}

export async function recordConsent(prisma: PrismaClient, input: { companyId: string; subjectId: string; purpose: string; granted: boolean; policyVersion: string; source: string; evidence?: Prisma.InputJsonValue; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.consentRecord.create({ data: { companyId: input.companyId, subjectId: input.subjectId, purpose: input.purpose, granted: input.granted, policyVersion: input.policyVersion, source: input.source, evidence: input.evidence, grantedAt: input.granted ? now : null, withdrawnAt: input.granted ? null : now } });
}

export async function upsertSubprocessor(prisma: PrismaClient, input: { key: string; name: string; purpose: string; dataCategories: string[]; processingLocations: string[]; safeguards?: string[]; privacyUrl?: string; effectiveAt: Date; reviewedAt?: Date }) {
  validateCatalogKey(input.key);
  const versioned = { key: input.key, name: input.name, purpose: input.purpose, dataCategories: input.dataCategories, processingLocations: input.processingLocations, safeguards: input.safeguards ?? [], privacyUrl: input.privacyUrl ?? null, effectiveAt: input.effectiveAt.toISOString() };
  const versionHash = sha256(stableJson(versioned));
  return prisma.subprocessor.upsert({ where: { key: input.key }, update: { name: input.name, purpose: input.purpose, dataCategories: input.dataCategories, processingLocations: input.processingLocations, safeguards: input.safeguards ?? [], privacyUrl: input.privacyUrl, effectiveAt: input.effectiveAt, lastReviewedAt: input.reviewedAt ?? new Date(), versionHash, status: "ACTIVE" }, create: { key: input.key, name: input.name, purpose: input.purpose, dataCategories: input.dataCategories, processingLocations: input.processingLocations, safeguards: input.safeguards ?? [], privacyUrl: input.privacyUrl, effectiveAt: input.effectiveAt, lastReviewedAt: input.reviewedAt ?? new Date(), versionHash } });
}

export async function recordSubprocessorChange(prisma: PrismaClient, input: { subprocessorKey: string; changeType: string; summary: string; noticeDueAt?: Date; noticeRequired?: boolean }) {
  const subprocessor = await prisma.subprocessor.findUniqueOrThrow({ where: { key: input.subprocessorKey } });
  const contentHash = sha256(stableJson({ subprocessor: subprocessor.versionHash, changeType: input.changeType, summary: input.summary, noticeDueAt: input.noticeDueAt?.toISOString() ?? null }));
  return prisma.subprocessorChange.create({ data: { subprocessorId: subprocessor.id, changeType: input.changeType, summary: input.summary, noticeRequired: input.noticeRequired ?? true, noticeDueAt: input.noticeDueAt, contentHash } });
}

export async function createPrivacyRiskAssessment(prisma: PrismaClient, input: { companyId: string; processingActivityId?: string; assessmentType: "RISK" | "DPIA"; version: string; highRisk: boolean; risks: Prisma.InputJsonValue; safeguards: Prisma.InputJsonValue; residualRisk: Prisma.InputJsonValue; owner: string; nextReviewAt?: Date }) {
  const contentHash = sha256(stableJson({ activity: input.processingActivityId ?? null, type: input.assessmentType, version: input.version, highRisk: input.highRisk, risks: input.risks, safeguards: input.safeguards, residualRisk: input.residualRisk, owner: input.owner }));
  return prisma.privacyRiskAssessment.create({ data: { companyId: input.companyId, processingActivityId: input.processingActivityId, assessmentType: input.assessmentType, version: input.version, highRisk: input.highRisk, risks: input.risks, safeguards: input.safeguards, residualRisk: input.residualRisk, owner: input.owner, nextReviewAt: input.nextReviewAt, contentHash } });
}

export async function planSubjectErasure(prisma: PrismaClient, input: { companyId: string; subjectReference: string; now?: Date }) {
  const now = input.now ?? new Date();
  const user = await prisma.user.findFirst({ where: { OR: [{ id: input.subjectReference }, { emailNormalized: input.subjectReference.trim().toLowerCase() }], memberships: { some: { companyId: input.companyId } } }, include: { memberships: { select: { companyId: true } } } });
  if (!user) throw new Error("PRIVACY_SUBJECT_NOT_FOUND");
  const [holds, fiscalDocuments, invoices] = await Promise.all([
    prisma.legalHold.findMany({ where: { companyId: input.companyId, status: "ACTIVE", subjectReference: input.subjectReference, startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.fiscalDocument.count({ where: { companyId: input.companyId } }),
    prisma.invoice.count({ where: { companyId: input.companyId } }),
  ]);
  const manifest = { subjectId: user.id, subjectReference: input.subjectReference, legalHold: holds.length > 0, companyMemberships: user.memberships.length, protectedRecords: { fiscalDocuments, invoices }, actions: holds.length ? [] : ["revoke_company_membership", ...(user.memberships.length === 1 ? ["anonymize_user_identity"] : ["retain_shared_identity"])] };
  const execution = await prisma.dataGovernanceExecution.create({ data: { companyId: input.companyId, executionType: "SUBJECT_ERASURE", mode: "DRY_RUN", status: holds.length ? "BLOCKED" : "COMPLETED", candidateCount: 1, blockedCount: holds.length ? 1 : 0, manifest, manifestHash: sha256(stableJson(manifest)), completedAt: now } });
  return { execution, manifest };
}

export async function applySubjectErasure(prisma: PrismaClient, input: { companyId: string; executionId: string; confirmation: string; actorReference: string; now?: Date }) {
  const now = input.now ?? new Date();
  const plan = await prisma.dataGovernanceExecution.findFirstOrThrow({ where: { id: input.executionId, companyId: input.companyId, executionType: "SUBJECT_ERASURE", mode: "DRY_RUN", status: "COMPLETED" } });
  const manifest = plan.manifest as { subjectId: string; subjectReference: string; legalHold: boolean; companyMemberships: number; protectedRecords: Prisma.InputJsonValue; actions: string[] };
  if (manifest.legalHold) throw new Error("SUBJECT_ERASURE_LEGAL_HOLD");
  if (input.confirmation !== `ERASE SUBJECT ${manifest.subjectId}`) throw new Error("SUBJECT_ERASURE_HUMAN_CONFIRMATION_REQUIRED");
  const activeHold = await prisma.legalHold.findFirst({ where: { companyId: input.companyId, status: "ACTIVE", startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], subjectReference: { in: [manifest.subjectId, manifest.subjectReference] } } });
  if (activeHold) throw new Error("SUBJECT_ERASURE_LEGAL_HOLD");
  const pseudonym = `erased-${sha256(`${input.companyId}:${manifest.subjectId}`).slice(0, 20)}`;
  return prisma.$transaction(async (transaction) => {
    await transaction.companyMembership.updateMany({ where: { companyId: input.companyId, userId: manifest.subjectId }, data: { status: "revoked", revokedAt: now, revokedReason: "privacy_erasure" } });
    if (manifest.companyMemberships === 1) await transaction.user.update({ where: { id: manifest.subjectId }, data: { email: `${pseudonym}@example.invalid`, emailNormalized: `${pseudonym}@example.invalid`, displayName: "Usuario anonimizado", status: "archived", activeCompanyId: null } });
    const appliedManifest = { ...manifest, appliedAt: now.toISOString(), actorReference: input.actorReference, financialAndFiscalRecordsPreserved: true };
    const execution = await transaction.dataGovernanceExecution.create({ data: { companyId: input.companyId, executionType: "SUBJECT_ERASURE", mode: "APPLY", status: "COMPLETED", policyKey: plan.id, candidateCount: 1, affectedCount: 1, manifest: appliedManifest, manifestHash: sha256(stableJson(appliedManifest)), completedAt: now } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.subject_erasure_applied", targetType: "DataGovernanceExecution", targetId: execution.id, metadata: { planId: plan.id, sharedIdentityRetained: manifest.companyMemberships > 1, protectedRecords: manifest.protectedRecords }, actorType: "user" });
    return execution;
  });
}

export async function createPrivacyRequest(prisma: PrismaClient, input: { companyId: string; requestType: typeof privacyRequestTypes[number]; subjectReference: string; now?: Date }) {
  if (!privacyRequestTypes.includes(input.requestType)) throw new Error("PRIVACY_REQUEST_TYPE_INVALID");
  const now = input.now ?? new Date();
  const dueAt = addCalendarMonths(now, 1);
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.privacyRequest.create({ data: { companyId: input.companyId, requestType: input.requestType, subjectReference: input.subjectReference, dueAt } });
    await transaction.privacyRequestEvent.create({ data: { companyId: input.companyId, privacyRequestId: request.id, eventType: "RECEIVED", metadata: { dueAt: dueAt.toISOString() } } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.request_received", targetType: "PrivacyRequest", targetId: request.id, metadata: { requestType: input.requestType, dueAt: dueAt.toISOString() } });
    return request;
  });
}

export async function verifyPrivacyRequestIdentity(prisma: PrismaClient, input: { companyId: string; requestId: string; actorReference: string; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.privacyRequest.findFirstOrThrow({ where: { id: input.requestId, companyId: input.companyId } });
    await transaction.privacyRequest.update({ where: { id: request.id }, data: { identityVerifiedAt: now, status: "VERIFIED" } });
    await transaction.privacyRequestEvent.create({ data: { companyId: input.companyId, privacyRequestId: request.id, eventType: "IDENTITY_VERIFIED", actorReference: input.actorReference, occurredAt: now } });
    return request;
  });
}

export async function extendPrivacyRequestDeadline(prisma: PrismaClient, input: { companyId: string; requestId: string; months: 1 | 2; reason: string; communicationRef: string; now?: Date }) {
  if (!input.reason.trim() || !input.communicationRef.trim()) throw new Error("PRIVACY_EXTENSION_COMMUNICATION_REQUIRED");
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.privacyRequest.findFirstOrThrow({ where: { id: input.requestId, companyId: input.companyId, completedAt: null } });
    const dueAt = addCalendarMonths(request.dueAt, input.months);
    await transaction.privacyRequest.update({ where: { id: request.id }, data: { dueAt, status: "EXTENDED" } });
    await transaction.privacyRequestEvent.create({ data: { companyId: input.companyId, privacyRequestId: request.id, eventType: "DEADLINE_EXTENDED", communicationRef: input.communicationRef, metadata: { months: input.months, reason: input.reason, dueAt: dueAt.toISOString() }, occurredAt: input.now ?? new Date() } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.request_deadline_extended", targetType: "PrivacyRequest", targetId: request.id, reason: input.reason, metadata: { months: input.months, communicationRef: input.communicationRef, dueAt: dueAt.toISOString() } });
    return { requestId: request.id, dueAt };
  });
}

export async function privacyDeadlineAlerts(prisma: PrismaClient, input: { companyId: string; now?: Date; warningDays?: number }) {
  const now = input.now ?? new Date();
  const warningAt = new Date(now.getTime() + (input.warningDays ?? 7) * 86_400_000);
  return prisma.privacyRequest.findMany({ where: { companyId: input.companyId, completedAt: null, dueAt: { lte: warningAt } }, orderBy: { dueAt: "asc" } });
}

export async function completePrivacyRequest(prisma: PrismaClient, input: { companyId: string; requestId: string; resolution: Prisma.InputJsonValue; communicationRef: string; actorReference?: string; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.privacyRequest.findFirstOrThrow({ where: { id: input.requestId, companyId: input.companyId, identityVerifiedAt: { not: null }, completedAt: null } });
    await transaction.privacyRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: now, resolution: input.resolution } });
    await transaction.privacyRequestEvent.create({ data: { companyId: input.companyId, privacyRequestId: request.id, eventType: "COMPLETED", actorReference: input.actorReference, communicationRef: input.communicationRef, occurredAt: now } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.request_completed", targetType: "PrivacyRequest", targetId: request.id, metadata: { communicationRef: input.communicationRef } });
    return request;
  });
}

export async function planStoredObjectRetention(prisma: PrismaClient, input: { companyId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const [objects, holds] = await Promise.all([
    prisma.storedObject.findMany({ where: { companyId: input.companyId, deletedAt: null, status: { in: ["READY", "BLOCKED", "QUARANTINED"] }, retainUntil: { lte: now } }, orderBy: { id: "asc" } }),
    prisma.legalHold.findMany({ where: { companyId: input.companyId, status: "ACTIVE", startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
  ]);
  const candidates = objects.map((object) => ({ id: object.id, sha256: object.sha256, objectKey: object.objectKey, blocked: holds.some((hold) => (hold.resourceType === "StoredObject" && (!hold.resourceId || hold.resourceId === object.id))) || Boolean(object.legalHoldUntil && object.legalHoldUntil > now) }));
  const publicManifest = candidates.map(({ id, sha256: digest, blocked }) => ({ id, sha256: digest, blocked }));
  const manifestHash = sha256(stableJson(publicManifest));
  const execution = await prisma.dataGovernanceExecution.create({ data: { companyId: input.companyId, executionType: "RETENTION", mode: "DRY_RUN", status: "COMPLETED", candidateCount: candidates.length, blockedCount: candidates.filter((item) => item.blocked).length, manifest: publicManifest, manifestHash, completedAt: now } });
  return { execution, candidates };
}

export async function applyStoredObjectRetention(prisma: PrismaClient, provider: StorageProvider, input: { companyId: string; executionId: string; confirmation: string; now?: Date }) {
  const now = input.now ?? new Date();
  const execution = await prisma.dataGovernanceExecution.findFirstOrThrow({ where: { id: input.executionId, companyId: input.companyId, executionType: "RETENTION", mode: "DRY_RUN", status: "COMPLETED" } });
  const manifest = execution.manifest as Array<{ id: string; sha256: string; blocked: boolean }>;
  const eligible = manifest.filter((item) => !item.blocked);
  if (input.confirmation !== `DELETE ${eligible.length} OBJECTS`) throw new Error("RETENTION_HUMAN_CONFIRMATION_REQUIRED");
  const receipts: Array<{ id: string; reference: string; evidenceHash: string }> = [];
  for (const candidate of eligible) {
    const object = await prisma.storedObject.findFirstOrThrow({ where: { id: candidate.id, companyId: input.companyId, deletedAt: null, sha256: candidate.sha256 } });
    const activeHold = await prisma.legalHold.findFirst({ where: { companyId: input.companyId, status: "ACTIVE", resourceType: "StoredObject", OR: [{ resourceId: null }, { resourceId: object.id }], startsAt: { lte: now }, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] } });
    if (activeHold || (object.legalHoldUntil && object.legalHoldUntil > now)) continue;
    const receipt = await provider.delete({ companyId: input.companyId, objectKey: object.objectKey, idempotencyKey: `retention:${execution.id}:${object.id}` });
    const evidenceHash = sha256(stableJson({ objectId: object.id, objectHash: object.sha256, provider: receipt.provider, reference: receipt.reference, deletedAt: now.toISOString() }));
    await prisma.storedObject.update({ where: { id: object.id }, data: { status: "DELETED", deletedAt: now, deletionEvidenceHash: evidenceHash } });
    receipts.push({ id: object.id, reference: receipt.reference, evidenceHash });
  }
  const applyManifest = receipts.map(({ id, evidenceHash }) => ({ id, evidenceHash }));
  return prisma.$transaction(async (transaction) => {
    const applied = await transaction.dataGovernanceExecution.create({ data: { companyId: input.companyId, executionType: "RETENTION", mode: "APPLY", status: "COMPLETED", policyKey: execution.id, candidateCount: manifest.length, affectedCount: receipts.length, blockedCount: manifest.length - receipts.length, manifest: applyManifest, manifestHash: sha256(stableJson(applyManifest)), completedAt: now } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.retention_applied", targetType: "DataGovernanceExecution", targetId: applied.id, metadata: { dryRunId: execution.id, affectedCount: receipts.length, blockedCount: manifest.length - receipts.length } });
    return { execution: applied, receipts };
  });
}

type CompanyExportObject = {
  id: string;
  sha256: string;
  sizeBytes: string;
  mimeType: string;
  classification: string;
  safeName: string | null;
  contentBase64: string;
};

type CompanyExportPackage = {
  manifest: unknown;
  records: Record<string, unknown[]>;
  objects: CompanyExportObject[];
};

export async function createCompanyExport(prisma: PrismaClient, input: { companyId: string; exportType?: "COMPANY" | "SUBJECT"; subjectReference?: string; privacyRequestId?: string; readObject?: (objectId: string) => Promise<Uint8Array>; now?: Date }) {
  const now = input.now ?? new Date();
  const exportType = input.exportType ?? "COMPANY";
  const records = exportType === "COMPANY" ? await collectCompanyRecords(prisma, input.companyId) : await collectSubjectRecords(prisma, input.companyId, input.subjectReference ?? "");
  const storedObjects = exportType === "COMPANY" ? await prisma.storedObject.findMany({ where: { companyId: input.companyId, deletedAt: null, status: "READY" }, select: { id: true, sha256: true, sizeBytes: true, mimeType: true, classification: true, safeName: true }, orderBy: { id: "asc" } }) : [];
  if (storedObjects.length && !input.readObject) throw new Error("COMPANY_EXPORT_OBJECT_READER_REQUIRED");
  const objects: CompanyExportObject[] = [];
  for (const object of storedObjects) {
    const bytes = await input.readObject!(object.id);
    const digest = sha256(bytes);
    if (digest !== object.sha256 || BigInt(bytes.byteLength) !== object.sizeBytes) throw new Error(`COMPANY_EXPORT_OBJECT_INTEGRITY_INVALID:${object.id}`);
    objects.push({ id: object.id, sha256: digest, sizeBytes: object.sizeBytes.toString(), mimeType: object.mimeType, classification: object.classification, safeName: object.safeName, contentBase64: Buffer.from(bytes).toString("base64") });
  }
  const objectManifest = objects.map((object) => ({ id: object.id, sha256: object.sha256, sizeBytes: object.sizeBytes, mimeType: object.mimeType, classification: object.classification, safeName: object.safeName }));
  const manifest = { schemaVersion: 1, exportType, companyId: input.companyId, generatedAt: now.toISOString(), records: Object.fromEntries(Object.entries(records).map(([model, rows]) => [model, { count: rows.length, sha256: sha256(stableJson(rows)) }])), objects: objectManifest, externalProviderKeysIncluded: false };
  const manifestHash = sha256(stableJson(manifest));
  const packagePayload: CompanyExportPackage = { manifest, records, objects };
  const packageHash = sha256(stableJson(packagePayload));
  assertNoExportSecrets(packagePayload);
  const recordCount = Object.values(records).reduce((sum, rows) => sum + rows.length, 0);
  const record = await prisma.companyDataExport.create({ data: { companyId: input.companyId, privacyRequestId: input.privacyRequestId, exportType, subjectReference: input.subjectReference, status: "COMPLETED", manifest, manifestHash, packageHash, recordCount, objectCount: objects.length, completedAt: now, expiresAt: new Date(now.getTime() + 7 * 86_400_000) } });
  return { record, package: packagePayload, manifestHash, packageHash };
}

export function verifyCompanyExportPackage(input: CompanyExportPackage, expectedPackageHash: string) {
  assertNoExportSecrets(input);
  const manifest = input.manifest as { records?: Record<string, { count: number; sha256: string }>; objects?: Array<Omit<CompanyExportObject, "contentBase64">>; externalProviderKeysIncluded?: boolean };
  if (manifest.externalProviderKeysIncluded !== false) throw new Error("EXPORT_EXTERNAL_KEYS_PRESENT");
  for (const [model, summary] of Object.entries(manifest.records ?? {})) {
    const rows = input.records[model] ?? [];
    if (rows.length !== summary.count || sha256(stableJson(rows)) !== summary.sha256) throw new Error(`EXPORT_MODEL_HASH_INVALID:${model}`);
  }
  if ((manifest.objects ?? []).length !== input.objects.length) throw new Error("EXPORT_OBJECT_COUNT_INVALID");
  for (const summary of manifest.objects ?? []) {
    const object = input.objects.find((candidate) => candidate.id === summary.id);
    if (!object || sha256(Buffer.from(object.contentBase64, "base64")) !== summary.sha256 || object.sizeBytes !== summary.sizeBytes) throw new Error(`EXPORT_OBJECT_HASH_INVALID:${summary.id}`);
  }
  if (sha256(stableJson(input)) !== expectedPackageHash) throw new Error("EXPORT_PACKAGE_HASH_INVALID");
  return { valid: true, models: Object.keys(manifest.records ?? {}).length, objects: input.objects.length };
}

export function prepareCompanyExportRestore(input: CompanyExportPackage, targetCompanyId: string) {
  assertNoExportSecrets(input);
  if (!targetCompanyId || targetCompanyId === (input.manifest as { companyId?: string }).companyId) throw new Error("RESTORE_TARGET_MUST_BE_NEW");
  const ids = new Map<string, string>();
  for (const rows of Object.values(input.records)) for (const row of rows) {
    if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
      const oldId = (row as { id: string }).id;
      ids.set(oldId, `restore-${sha256(`${targetCompanyId}:${oldId}`).slice(0, 24)}`);
    }
  }
  const records: Record<string, unknown[]> = {};
  for (const [model, rows] of Object.entries(input.records)) records[model] = rows.map((row) => remapRestoreValue(row, ids, targetCompanyId));
  const references = [...ids.entries()].map(([sourceId, restoredId]) => ({ sourceId, restoredId }));
  const objects = input.objects.map((object) => ({ ...object, id: ids.get(object.id) ?? `restore-${sha256(`${targetCompanyId}:${object.id}`).slice(0, 24)}` }));
  return { targetCompanyId, records, objects, references, checksum: sha256(stableJson({ targetCompanyId, records, objects, references })) };
}

export function classifyDataField(field: string) {
  if (/password|token|secret|cipher|authenticationTag|iban|taxId|nif|certificate/i.test(field)) return "RESTRICTED" as const;
  if (/email|phone|telefono|address|direccion|name|nombre|content|description|notes/i.test(field)) return "CONFIDENTIAL" as const;
  if (/id|status|createdAt|updatedAt|count|amount|total/i.test(field)) return "INTERNAL" as const;
  return "PUBLIC" as const;
}

export function assertPrivacySafeTelemetry(fields: Record<string, unknown>) {
  const forbidden = Object.keys(fields).filter((field) => !privacySafeTelemetryFields.has(field));
  if (forbidden.length) throw new Error(`TELEMETRY_FIELDS_FORBIDDEN:${forbidden.join(",")}`);
  return true;
}

export function fixtureContainsPersonalData(value: string) {
  const allowInvalid = /@(?:[a-z0-9.-]+\.invalid|(?:[a-z0-9.-]+\.)?example\.(?:com|net|org)|[a-z0-9.-]+\.example)\b/giu;
  const scrubbed = value.replace(allowInvalid, "");
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(scrubbed) || /(?:\+34\s*)?(?:6|7|8|9)\d{8}\b/u.test(scrubbed) || /\b\d{8}[A-Z]\b/iu.test(scrubbed);
}

function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function validateCatalogKey(value: string) {
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/u.test(value)) throw new Error("CATALOG_KEY_INVALID");
}

async function collectCompanyRecords(prisma: PrismaClient, companyId: string) {
  const records: Record<string, unknown[]> = {};
  const modelNames = Prisma.dmmf.datamodel.models.filter((model) => model.fields.some((field) => field.name === "companyId") && model.name !== "EncryptedCredential").map((model) => model.name).sort();
  const delegates = prisma as unknown as Record<string, { findMany(args: unknown): Promise<unknown[]> }>;
  for (const modelName of modelNames) {
    const delegate = delegates[modelName[0].toLowerCase() + modelName.slice(1)];
    if (!delegate?.findMany) continue;
    const rows = await delegate.findMany({ where: { companyId }, orderBy: { id: "asc" } }).catch(() => delegate.findMany({ where: { companyId } }));
    records[modelName] = rows.map((row) => sanitizeExportValue(row));
  }
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  records.Company = [sanitizeExportValue(company)];
  return records;
}

async function collectSubjectRecords(prisma: PrismaClient, companyId: string, subjectReference: string) {
  const normalized = subjectReference.trim().toLowerCase();
  if (!normalized) throw new Error("SUBJECT_REFERENCE_REQUIRED");
  const users = await prisma.user.findMany({ where: { memberships: { some: { companyId } }, OR: [{ id: subjectReference }, { emailNormalized: normalized }] }, select: { id: true, emailNormalized: true, displayName: true, status: true, createdAt: true, updatedAt: true } });
  const userIds = users.map((user) => user.id);
  const [memberships, consents, requests] = await Promise.all([
    prisma.companyMembership.findMany({ where: { companyId, userId: { in: userIds } }, select: { id: true, userId: true, companyId: true, role: true, status: true, createdAt: true, updatedAt: true } }),
    prisma.consentRecord.findMany({ where: { companyId, subjectId: { in: [subjectReference, ...userIds] } } }),
    prisma.privacyRequest.findMany({ where: { companyId, subjectReference } }),
  ]);
  return { User: users.map(sanitizeExportValue), CompanyMembership: memberships.map(sanitizeExportValue), ConsentRecord: consents.map(sanitizeExportValue), PrivacyRequest: requests.map(sanitizeExportValue) };
}

function sanitizeExportValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeExportValue);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (/passwordHash|tokenHash|ciphertext|initializationVector|authenticationTag|objectKey|bucket|providerVersion|providerCustomerId|providerSubscriptionId|providerPriceId|externalEventId|providerMessageId/i.test(key)) continue;
    result[key] = sanitizeExportValue(item);
  }
  return result;
}

function assertNoExportSecrets(value: unknown) {
  const text = stableJson(value);
  if (/passwordHash|tokenHash|ciphertext|authenticationTag|secretAccessKey|objectKey|providerCustomerId|providerSubscriptionId/i.test(text)) throw new Error("EXPORT_SECRET_FIELD_PRESENT");
}

function remapRestoreValue(value: unknown, ids: Map<string, string>, targetCompanyId: string, fieldName?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => remapRestoreValue(item, ids, targetCompanyId, fieldName));
  if (!value || typeof value !== "object") {
    if (fieldName === "companyId") return targetCompanyId;
    if (typeof value === "string" && ids.has(value) && (fieldName === "id" || fieldName?.endsWith("Id"))) return ids.get(value);
    return value;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, remapRestoreValue(item, ids, targetCompanyId, key)]));
}

export function contentHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}
