import type { PrismaClient } from "@prisma/client";
import { aeatHash } from "./aeat";
import { canonicalJson, sha256Hex } from "./canonical";
import { electronicInvoiceStatusEventHash } from "./artifacts";
import { fiscalEventHash } from "./engine";

export async function exportFiscalEvidence(prisma: PrismaClient, companyId: string) {
  const [documents, records, events, artifacts, deliveries, statusEvents, declarations] = await Promise.all([
    prisma.fiscalDocument.findMany({ where: { companyId }, orderBy: [{ issueDate: "asc" }, { number: "asc" }] }),
    prisma.fiscalRecord.findMany({ where: { companyId }, orderBy: { sequence: "asc" } }),
    prisma.fiscalEvent.findMany({ where: { companyId }, orderBy: { sequence: "asc" } }),
    prisma.electronicInvoiceArtifact.findMany({ where: { companyId }, orderBy: { generatedAt: "asc" } }),
    prisma.electronicInvoiceDelivery.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    prisma.electronicInvoiceStatusEvent.findMany({ where: { companyId }, orderBy: [{ artifactId: "asc" }, { sequence: "asc" }] }),
    prisma.fiscalSoftwareDeclaration.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
  ]);
  const manifest = {
    version: "orqena-fiscal-evidence-1.0.0",
    companyId,
    documents,
    records,
    events,
    artifacts,
    deliveries,
    statusEvents,
    declarations,
  };
  return { manifest, manifestHash: sha256Hex(canonicalJson(manifest)) };
}

export function verifyFiscalEvidence(exported: Awaited<ReturnType<typeof exportFiscalEvidence>>) {
  if (sha256Hex(canonicalJson(exported.manifest)) !== exported.manifestHash) throw new Error("FISCAL_EVIDENCE_MANIFEST_HASH_INVALID");
  let previousRecordHash: string | null = null;
  const nativeRecords = exported.manifest.records.filter((record) => record.chainScope === "company");
  for (const record of nativeRecords) {
    if ((record.previousHash ?? null) !== previousRecordHash) throw new Error("FISCAL_RECORD_CHAIN_BROKEN");
    if (aeatHash(record.canonicalInput) !== record.recordHash) throw new Error("FISCAL_RECORD_HASH_INVALID");
    previousRecordHash = record.recordHash;
  }
  let previousEventHash: string | null = null;
  const nativeEvents = exported.manifest.events.filter((event) => event.sequence !== null && event.eventHash !== null);
  for (const event of nativeEvents) {
    if (event.sequence === null || !event.eventHash) throw new Error("FISCAL_EVENT_CHAIN_INCOMPLETE");
    if ((event.previousHash ?? null) !== previousEventHash) throw new Error("FISCAL_EVENT_CHAIN_BROKEN");
    const calculated = fiscalEventHash({ sequence: event.sequence, previousHash: event.previousHash, eventType: event.eventType, occurredAt: event.occurredAt, payload: event.payload });
    if (calculated !== event.eventHash) throw new Error("FISCAL_EVENT_HASH_INVALID");
    previousEventHash = event.eventHash;
  }
  const priorByArtifact = new Map<string, string | null>();
  for (const event of exported.manifest.statusEvents) {
    if (event.sequence === null || !event.eventHash) throw new Error("EINVOICE_STATUS_CHAIN_INCOMPLETE");
    const previous = priorByArtifact.get(event.artifactId) ?? null;
    if ((event.previousHash ?? null) !== previous) throw new Error("EINVOICE_STATUS_CHAIN_BROKEN");
    const calculated = electronicInvoiceStatusEventHash({ sequence: event.sequence, previousHash: event.previousHash, eventType: event.eventType, occurredAt: event.occurredAt, payload: event.payload });
    if (calculated !== event.eventHash) throw new Error("EINVOICE_STATUS_HASH_INVALID");
    priorByArtifact.set(event.artifactId, event.eventHash);
  }
  return { valid: true as const, counts: {
    documents: exported.manifest.documents.length,
    records: exported.manifest.records.length,
    events: exported.manifest.events.length,
    artifacts: exported.manifest.artifacts.length,
    deliveries: exported.manifest.deliveries.length,
    declarations: exported.manifest.declarations.length,
    legacyRecords: exported.manifest.records.length - nativeRecords.length,
    legacyEvents: exported.manifest.events.length - nativeEvents.length,
  } };
}
