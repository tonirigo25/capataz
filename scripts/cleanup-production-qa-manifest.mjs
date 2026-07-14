import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertProductionTarget, EXCLUDED_REAL_TASK_ID } from "./production-fixture-cleanup-guards.mjs";

const MANIFEST_SHA256 = "d254c661524e65620f29a07c0c4d6c03f7beaae3f1d3842048ffbde5b58dc4e3";
const APPROVAL = `DELETE-24-${MANIFEST_SHA256}`;
const AUDIT_REPORT = resolve(process.cwd(), ".codex-backup", "fixture-closure", "audit-1.json");
const BACKUP_PATH = resolve(process.cwd(), ".codex-backup", "production-fixture-backups", `fixtures-24-${MANIFEST_SHA256}.json`);
const execute = process.argv.includes("--execute");
const expectedCounts = { Budget: 1, BusinessRecommendation: 4, BusinessSignalState: 4, Client: 1, Invoice: 1, ProactiveAuditEvent: 12, Work: 1 };
const deletionOrder = [
  ["proactiveAuditEvent", "ProactiveAuditEvent"],
  ["businessRecommendation", "BusinessRecommendation"],
  ["businessSignalState", "BusinessSignalState"],
  ["invoice", "Invoice"],
  ["budget", "Budget"],
  ["work", "Work"],
  ["client", "Client"],
];

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function quoteIdent(value) { return `"${value.replaceAll('"', '""')}"`; }
function assertTarget() {
  assertProductionTarget(process.env);
  const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!raw || !/(?:railway|rlwy)/i.test(new URL(raw).hostname)) throw new Error("CLEANUP_REQUIRES_RAILWAY_DATABASE");
  return raw;
}
function auditOnce(label) {
  const result = spawnSync(process.execPath, ["scripts/audit-production-fixture-closure.mjs", `--output=.codex-backup/fixture-closure/${label}.json`], {
    cwd: process.cwd(), env: process.env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`AUDIT_PREFLIGHT_FAILED:${label}`);
  const summary = JSON.parse(result.stdout);
  if (summary.total !== 0 && (summary.total !== 24 || summary.manifestSha256 !== MANIFEST_SHA256)) throw new Error(`MANIFEST_MISMATCH:${label}`);
  if (summary.total === 24 && (summary.ambiguities?.length || summary.externalReferences?.length || summary.fingerprintExternalHits?.length || !summary.realExcluded?.[0]?.preserved)) throw new Error(`AUDIT_GUARD_FAILED:${label}`);
  return summary;
}
function readManifest() {
  const report = JSON.parse(readFileSync(AUDIT_REPORT, "utf8"));
  if (report.manifestSha256 !== MANIFEST_SHA256 || report.total !== 24 || report.ambiguities.length || report.externalReferences.length) throw new Error("LOCAL_MANIFEST_REPORT_INVALID");
  const manifest = {};
  for (const line of report.manifestLines) {
    const split = line.indexOf(":");
    const table = line.slice(0, split);
    const id = line.slice(split + 1);
    (manifest[table] ??= []).push(id);
  }
  for (const [table, count] of Object.entries(expectedCounts)) if ((manifest[table]?.length ?? 0) !== count) throw new Error(`MANIFEST_COUNT_MISMATCH:${table}`);
  return manifest;
}
async function backupRows(prisma, manifest) {
  const tables = {};
  for (const [table, ids] of Object.entries(manifest)) {
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(",");
    const rows = await prisma.$queryRawUnsafe(`SELECT row_to_json(candidate) AS row FROM ${quoteIdent(table)} candidate WHERE id IN (${placeholders}) ORDER BY id`, ...ids);
    if (rows.length !== ids.length) throw new Error(`BACKUP_ROW_COUNT_MISMATCH:${table}`);
    tables[table] = rows.map((item) => item.row);
  }
  return tables;
}
async function main() {
  const databaseUrl = assertTarget();
  if (execute && process.env.CAPATAZ_QA_CLEANUP_APPROVAL !== APPROVAL) throw new Error("EXPLICIT_QA_CLEANUP_APPROVAL_MISSING");
  const first = auditOnce("cleanup-preflight-1");
  const second = auditOnce("cleanup-preflight-2");
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("CONSECUTIVE_AUDITS_DIFFER");
  if (first.total === 0) {
    console.log(JSON.stringify({ mode: "exact-qa-cleanup", execution: { requested: execute, performed: false, deleted: 0, alreadyClean: true }, manifestSha256: MANIFEST_SHA256, total: 0 }, null, 2));
    return;
  }
  const manifest = readManifest();
  const prisma = new PrismaClient({ log: [], datasources: { db: { url: databaseUrl } } });
  try {
    const tables = await backupRows(prisma, manifest);
    const payload = { format: "capataz-production-qa-manifest-logical-backup-v1", manifestSha256: MANIFEST_SHA256, expectedRows: 24, excludedTaskId: EXCLUDED_REAL_TASK_ID, counts: expectedCounts, tables };
    const serialized = JSON.stringify(payload, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
    const backupSha256 = sha256(serialized);
    if (execute) {
      mkdirSync(dirname(BACKUP_PATH), { recursive: true });
      writeFileSync(BACKUP_PATH, serialized, { encoding: "utf8", flag: "wx" });
      if (sha256(readFileSync(BACKUP_PATH)) !== backupSha256) throw new Error("BACKUP_SHA256_MISMATCH");
      const deleted = await prisma.$transaction(async (tx) => {
        let total = 0;
        for (const [delegate, table] of deletionOrder) {
          const ids = manifest[table] ?? [];
          if (!ids.length) continue;
          const before = await tx[delegate].count({ where: { id: { in: ids } } });
          if (before !== ids.length) throw new Error(`PREDELETE_COUNT_MISMATCH:${table}:${before}:${ids.length}`);
          const result = await tx[delegate].deleteMany({ where: { id: { in: ids } } });
          if (result.count !== ids.length) throw new Error(`DELETE_COUNT_MISMATCH:${table}:${result.count}:${ids.length}`);
          total += result.count;
        }
        if (total !== 24) throw new Error(`DELETE_TOTAL_MISMATCH:${total}`);
        return total;
      }, { isolationLevel: "Serializable", timeout: 120_000 });
      console.log(JSON.stringify({ mode: "exact-qa-cleanup", manifestSha256: MANIFEST_SHA256, total: 24, backup: { path: BACKUP_PATH, sha256: backupSha256, verified: true }, execution: { requested: true, performed: true, deleted } }, null, 2));
    } else {
      console.log(JSON.stringify({ mode: "exact-qa-cleanup", manifestSha256: MANIFEST_SHA256, total: 24, counts: expectedCounts, backup: { path: BACKUP_PATH, prepared: true, wouldSha256: backupSha256 }, execution: { requested: false, performed: false, deleted: 0 } }, null, 2));
    }
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "EXACT_QA_CLEANUP_FAILED"); process.exitCode = 1; });
