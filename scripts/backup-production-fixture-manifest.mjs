import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertProductionTarget, EXPECTED_FIXTURE_TOTAL } from "./production-fixture-cleanup-guards.mjs";

assertProductionTarget(process.env);
const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!databaseUrl || !/(?:railway|rlwy)/i.test(new URL(databaseUrl).hostname)) {
  throw new Error("BACKUP_REQUIRES_RAILWAY_DATABASE");
}

const audit = spawnSync(process.execPath, ["scripts/audit-production-fixtures.mjs", "--summary"], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
if (audit.status !== 0) throw new Error(`BACKUP_PREFLIGHT_FAILED:${audit.stderr.trim()}`);
const manifest = JSON.parse(audit.stdout);
if (
  manifest.total !== EXPECTED_FIXTURE_TOTAL
  || !manifest.cleanupManifestMatches
  || !manifest.companyValidationPassed
  || !manifest.manifestHashMatches
  || manifest.fingerprintExtrasCount !== 0
  || !manifest.excludedTaskPreserved
  || manifest.execution.performed
) {
  throw new Error("BACKUP_MANIFEST_GUARD_FAILED");
}

const prisma = new PrismaClient({ log: [], datasources: { db: { url: databaseUrl } } });
try {
  const tables = {};
  for (const [table, ids] of Object.entries(manifest.recordIds)) {
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
    const result = await prisma.$queryRawUnsafe(
      `SELECT row_to_json(candidate) AS row FROM "${table}" candidate WHERE id IN (${placeholders}) ORDER BY id`,
      ...ids,
    );
    if (result.length !== ids.length) throw new Error(`BACKUP_ROW_COUNT_MISMATCH:${table}`);
    tables[table] = result.map((item) => item.row);
  }

  const payload = {
    format: "capataz-production-fixture-logical-backup-v1",
    createdAt: new Date().toISOString(),
    manifestSha256: manifest.manifestSha256,
    expectedRows: EXPECTED_FIXTURE_TOTAL,
    excludedTaskId: "cmrhm95u80004vd84gufttv29",
    counts: manifest.counts,
    tables,
  };
  const serialized = JSON.stringify(payload, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
  const backupSha256 = createHash("sha256").update(serialized).digest("hex");
  const output = join(process.cwd(), ".codex-backup", "production-fixture-backups", `fixtures-${manifest.manifestSha256}.json`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serialized, { encoding: "utf8", flag: "wx" });
  const verified = createHash("sha256").update(readFileSync(output)).digest("hex") === backupSha256;
  if (!verified) throw new Error("BACKUP_CHECKSUM_VERIFICATION_FAILED");
  console.log(JSON.stringify({
    ok: true,
    format: payload.format,
    rows: Object.values(tables).reduce((sum, rows) => sum + rows.length, 0),
    manifestSha256: manifest.manifestSha256,
    backupSha256,
    bytes: Buffer.byteLength(serialized),
    verified,
    output,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
