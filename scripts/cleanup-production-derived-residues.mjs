import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  CLEANUP_APPROVAL,
  EXPECTED_MANIFEST_SHA256,
  MANIFEST_LINES,
  MANIFEST_SHA256,
  PARENT_IDS,
  RECOMMENDATION_FINGERPRINTS,
  RECOMMENDATION_IDS,
  SIGNAL_FINGERPRINTS,
  SIGNAL_IDS,
} from "./derived-residue-manifest.mjs";

const EXCLUDED_TASK_ID = "cmrhm95u80004vd84gufttv29";
const FIXTURE_BACKUP_SHA256 = "99430534df8d51dc28022f57adea4915ee7800cadd3eb18831eacaf151d8c9a7";
const executeRequested = process.argv.includes("--execute");
const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ log: [], datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined });

function assertProductionTarget() {
  const expected = {
    RAILWAY_PROJECT_ID: "ca7ec244-e961-42dc-8573-23835e6db5f5",
    RAILWAY_ENVIRONMENT_ID: "42c14ac1-e933-485b-9b44-01272af389e0",
    RAILWAY_SERVICE_ID: "0f485ee7-0ab3-430d-9abd-791b8e3e2907",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_SERVICE_NAME: "Postgres",
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] !== value) throw new Error(`PRODUCTION_TARGET_MISMATCH:${name}`);
  }
  if (!databaseUrl || !/(?:railway|rlwy)/i.test(new URL(databaseUrl).hostname)) {
    throw new Error("RESIDUE_CLEANUP_REQUIRES_RAILWAY_DATABASE");
  }
  if (MANIFEST_SHA256 !== EXPECTED_MANIFEST_SHA256) throw new Error("AUTHORIZED_MANIFEST_HASH_MISMATCH");
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function publicTableNames(client) {
  const rows = await client.$queryRawUnsafe(`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `);
  return rows.map((row) => row.name);
}

async function tableCount(client, table, where = "", params = []) {
  const rows = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)} candidate${where ? ` WHERE ${where}` : ""}`,
    ...params,
  );
  return Number(rows[0]?.count ?? 0);
}

async function operationalNullCount(client) {
  const tables = [
    "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material", "Document",
    "InternalNote", "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "CashMovement",
    "RecurringExpense", "ExpectedCashFlow", "ChatConversation", "BusinessSignalState", "BusinessRecommendation",
    "AutomationDefinition", "AutomationRun", "Task", "FollowUp",
  ];
  const byTable = {};
  for (const table of tables) byTable[table] = await tableCount(client, table, '"companyId" IS NULL');
  return { byTable, total: Object.values(byTable).reduce((sum, value) => sum + value, 0) };
}

async function allTableCounts(client) {
  const result = {};
  for (const table of await publicTableNames(client)) result[table] = await tableCount(client, table);
  return result;
}

async function globalFingerprintCount(client) {
  let total = 0;
  for (const table of await publicTableNames(client)) {
    total += await tableCount(
      client,
      table,
      "row_to_json(candidate)::text ILIKE $1 OR row_to_json(candidate)::text ILIKE $2",
      ["%4a33f773%", "%7a3b51a7%"],
    );
  }
  return total;
}

async function referenceHits(client) {
  const needles = [
    ...SIGNAL_IDS, ...RECOMMENDATION_IDS, ...SIGNAL_FINGERPRINTS, ...RECOMMENDATION_FINGERPRINTS,
    ...Object.values(PARENT_IDS),
  ];
  const hits = {};
  for (const table of await publicTableNames(client)) {
    const predicates = needles.map((_, index) => `row_to_json(candidate)::text ILIKE $${index + 1}`).join(" OR ");
    const rows = await client.$queryRawUnsafe(
      `SELECT id FROM ${quoteIdentifier(table)} candidate WHERE ${predicates} ORDER BY id`,
      ...needles.map((needle) => `%${needle}%`),
    );
    if (rows.length) hits[table] = rows.map((row) => row.id);
  }
  const authorized = new Set([...SIGNAL_IDS, ...RECOMMENDATION_IDS]);
  const external = Object.fromEntries(Object.entries(hits)
    .map(([table, ids]) => [table, ids.filter((id) => !authorized.has(id))])
    .filter(([, ids]) => ids.length));
  return { hits, external, externalCount: Object.values(external).reduce((sum, ids) => sum + ids.length, 0) };
}

function validateEvidence(signals, recommendations) {
  const expectedSignals = new Map([
    [SIGNAL_IDS[0], { fingerprint: SIGNAL_FINGERPRINTS[0], entityId: PARENT_IDS.invoiceId, clientId: PARENT_IDS.clientId, workId: PARENT_IDS.workId, invoiceId: PARENT_IDS.invoiceId }],
    [SIGNAL_IDS[1], { fingerprint: SIGNAL_FINGERPRINTS[1], entityId: PARENT_IDS.clientId, clientId: PARENT_IDS.clientId, workId: null, invoiceId: null }],
  ]);
  const expectedRecommendations = new Map([
    [RECOMMENDATION_IDS[0], { fingerprint: RECOMMENDATION_FINGERPRINTS[0], signalFingerprint: SIGNAL_FINGERPRINTS[0], entityId: PARENT_IDS.invoiceId, clientId: PARENT_IDS.clientId, workId: PARENT_IDS.workId, invoiceId: PARENT_IDS.invoiceId }],
    [RECOMMENDATION_IDS[1], { fingerprint: RECOMMENDATION_FINGERPRINTS[1], signalFingerprint: SIGNAL_FINGERPRINTS[1], entityId: PARENT_IDS.clientId, clientId: PARENT_IDS.clientId, workId: null, invoiceId: null }],
  ]);
  for (const row of signals) {
    const expected = expectedSignals.get(row.id);
    if (!expected || Object.entries(expected).some(([field, value]) => row[field] !== value) || row.companyId !== null) {
      throw new Error(`SIGNAL_EVIDENCE_MISMATCH:${row.id}`);
    }
  }
  for (const row of recommendations) {
    const expected = expectedRecommendations.get(row.id);
    if (!expected || Object.entries(expected).some(([field, value]) => row[field] !== value) || row.companyId !== null) {
      throw new Error(`RECOMMENDATION_EVIDENCE_MISMATCH:${row.id}`);
    }
  }
}

function verifyParentProvenance() {
  const path = join(process.cwd(), ".codex-backup", "production-fixture-backups", "fixtures-2e245d34ca11f4fc23ee665594ca4178bdc048edae496fa4e0973325ac5eb881.json");
  const bytes = readFileSync(path);
  if (createHash("sha256").update(bytes).digest("hex") !== FIXTURE_BACKUP_SHA256) {
    throw new Error("FIXTURE_BACKUP_HASH_MISMATCH");
  }
  const backup = JSON.parse(bytes.toString("utf8"));
  const checks = {
    client: backup.tables.Client?.some((row) => row.id === PARENT_IDS.clientId),
    work: backup.tables.Work?.some((row) => row.id === PARENT_IDS.workId),
    invoice: backup.tables.Invoice?.some((row) => row.id === PARENT_IDS.invoiceId),
  };
  if (Object.values(checks).some((value) => !value)) throw new Error("PARENT_FIXTURE_PROVENANCE_MISSING");
  return { verified: true, checks, backupSha256: FIXTURE_BACKUP_SHA256 };
}

async function auditState(client) {
  const signals = await client.businessSignalState.findMany({ where: { id: { in: SIGNAL_IDS } }, orderBy: { id: "asc" } });
  const recommendations = await client.businessRecommendation.findMany({ where: { id: { in: RECOMMENDATION_IDS } }, orderBy: { id: "asc" } });
  const total = signals.length + recommendations.length;
  if (![0, 4].includes(total) || (total === 4 && (signals.length !== 2 || recommendations.length !== 2))) {
    throw new Error(`AUTHORIZED_RESIDUE_PARTIAL_STATE:${signals.length}:${recommendations.length}`);
  }
  const candidateSignals = await client.businessSignalState.findMany({
    where: { OR: [
      { fingerprint: { in: SIGNAL_FINGERPRINTS } }, { entityId: { in: Object.values(PARENT_IDS) } },
      { clientId: PARENT_IDS.clientId }, { workId: PARENT_IDS.workId }, { invoiceId: PARENT_IDS.invoiceId },
    ] },
    select: { id: true },
  });
  const candidateRecommendations = await client.businessRecommendation.findMany({
    where: { OR: [
      { fingerprint: { in: RECOMMENDATION_FINGERPRINTS } }, { signalFingerprint: { in: SIGNAL_FINGERPRINTS } },
      { entityId: { in: Object.values(PARENT_IDS) } }, { clientId: PARENT_IDS.clientId },
      { workId: PARENT_IDS.workId }, { invoiceId: PARENT_IDS.invoiceId },
    ] },
    select: { id: true },
  });
  const candidateIds = [...candidateSignals, ...candidateRecommendations].map((row) => row.id).sort();
  const authorizedIds = [...SIGNAL_IDS, ...RECOMMENDATION_IDS].sort();
  const alreadyClean = total === 0;
  if (!alreadyClean && JSON.stringify(candidateIds) !== JSON.stringify(authorizedIds)) throw new Error("UNAUTHORIZED_FIFTH_CANDIDATE");
  if (alreadyClean && candidateIds.length !== 0) throw new Error("EXTERNAL_RESIDUE_REMAINS");
  if (!alreadyClean) validateEvidence(signals, recommendations);

  const parentRowsRemaining = {
    Client: await client.client.count({ where: { id: PARENT_IDS.clientId } }),
    Work: await client.work.count({ where: { id: PARENT_IDS.workId } }),
    Invoice: await client.invoice.count({ where: { id: PARENT_IDS.invoiceId } }),
  };
  if (Object.values(parentRowsRemaining).some(Boolean)) throw new Error("FIXTURE_PARENT_STILL_PRESENT");
  const references = await referenceHits(client);
  if (references.externalCount !== 0) throw new Error(`EXTERNAL_REFERENCES_PRESENT:${JSON.stringify(references.external)}`);
  const task = await client.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
  if (!task) throw new Error("EXCLUDED_TASK_MISSING");
  const companyCount = await client.company.count();
  const empresaCount = await client.empresa.count();
  if (companyCount !== 0 || empresaCount !== 1) throw new Error(`COMPANY_EMPRESA_COUNT_MISMATCH:${companyCount}:${empresaCount}`);
  const operationalNulls = await operationalNullCount(client);
  const expectedNulls = alreadyClean ? 236 : 240;
  if (operationalNulls.total !== expectedNulls) throw new Error(`OPERATIONAL_NULL_COUNT_MISMATCH:${operationalNulls.total}:${expectedNulls}`);
  const globalFingerprints = await globalFingerprintCount(client);
  if (globalFingerprints !== (alreadyClean ? 0 : 4)) throw new Error(`GLOBAL_FINGERPRINT_COUNT_MISMATCH:${globalFingerprints}`);
  return {
    signals, recommendations, total, alreadyClean, candidateIds, references, task,
    companyCount, empresaCount, operationalNulls, globalFingerprints, parentRowsRemaining,
  };
}

function assertOnlyAuthorizedDeleted(before, after) {
  for (const [table, count] of Object.entries(before)) {
    const expected = table === "BusinessRecommendation" ? count - 2 : table === "BusinessSignalState" ? count - 2 : count;
    if (after[table] !== expected) throw new Error(`UNAUTHORIZED_TABLE_COUNT_CHANGE:${table}:${count}:${after[table]}`);
  }
}

async function main() {
  assertProductionTarget();
  const provenance = verifyParentProvenance();
  const before = await auditState(prisma);
  let execution = { requested: executeRequested, performed: false, deleted: 0, byTable: { BusinessRecommendation: 0, BusinessSignalState: 0 } };
  if (executeRequested) {
    if (process.env.CAPATAZ_DERIVED_RESIDUE_CLEANUP_APPROVAL !== CLEANUP_APPROVAL) {
      throw new Error("EXPLICIT_DERIVED_CLEANUP_APPROVAL_MISSING");
    }
    if (!before.alreadyClean) {
      execution = await prisma.$transaction(async (tx) => {
        const inside = await auditState(tx);
        if (inside.total !== 4) throw new Error("DERIVED_CLEANUP_PREDELETE_MISMATCH");
        const countsBefore = await allTableCounts(tx);
        const recommendations = await tx.businessRecommendation.deleteMany({ where: { id: { in: RECOMMENDATION_IDS } } });
        if (recommendations.count !== 2) throw new Error(`RECOMMENDATION_DELETE_MISMATCH:${recommendations.count}`);
        const signals = await tx.businessSignalState.deleteMany({ where: { id: { in: SIGNAL_IDS } } });
        if (signals.count !== 2) throw new Error(`SIGNAL_DELETE_MISMATCH:${signals.count}`);
        const after = await auditState(tx);
        if (!after.alreadyClean || after.total !== 0) throw new Error("DERIVED_CLEANUP_POSTDELETE_MISMATCH");
        const countsAfter = await allTableCounts(tx);
        assertOnlyAuthorizedDeleted(countsBefore, countsAfter);
        return {
          requested: true,
          performed: true,
          deleted: 4,
          byTable: { BusinessRecommendation: recommendations.count, BusinessSignalState: signals.count },
        };
      }, { isolationLevel: "Serializable", timeout: 120_000 });
    }
  }
  const after = await auditState(prisma);
  console.log(JSON.stringify({
    ok: true,
    mode: executeRequested ? "controlled-cleanup" : "dry-run",
    manifest: MANIFEST_LINES,
    manifestSha256: MANIFEST_SHA256,
    manifestHashMatches: MANIFEST_SHA256 === EXPECTED_MANIFEST_SHA256,
    provenance,
    counts: { BusinessSignalState: before.signals.length, BusinessRecommendation: before.recommendations.length, total: before.total },
    records: {
      BusinessSignalState: before.signals.map(({ id, createdAt, updatedAt, fingerprint, type, entityType, entityId, clientId, workId, invoiceId, companyId }) => ({ id, createdAt, updatedAt, fingerprint, type, entityType, entityId, clientId, workId, invoiceId, companyId })),
      BusinessRecommendation: before.recommendations.map(({ id, createdAt, updatedAt, fingerprint, signalFingerprint, type, entityType, entityId, clientId, workId, invoiceId, companyId }) => ({ id, createdAt, updatedAt, fingerprint, signalFingerprint, type, entityType, entityId, clientId, workId, invoiceId, companyId })),
    },
    externalReferences: before.references.external,
    externalReferenceCount: before.references.externalCount,
    companyBefore: before.companyCount,
    empresaBefore: before.empresaCount,
    operationalNullsBefore: before.operationalNulls.total,
    fingerprintsBefore: before.globalFingerprints,
    excludedTaskPresentBefore: Boolean(before.task),
    execution,
    post: {
      total: after.total,
      alreadyClean: after.alreadyClean,
      company: after.companyCount,
      empresa: after.empresaCount,
      operationalNulls: after.operationalNulls.total,
      fingerprints: after.globalFingerprints,
      externalReferenceCount: after.references.externalCount,
      excludedTaskPresent: Boolean(after.task),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DERIVED_RESIDUE_CLEANUP_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
