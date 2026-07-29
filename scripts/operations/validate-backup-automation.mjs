import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("../..", import.meta.url)));
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const backup = read("scripts/operations/backup-postgres.sh");
const fallback = read("scripts/operations/local-backup-fallback.ps1");
const configure = read("scripts/operations/configure-local-backup-fallback.ps1");
const restore = read("scripts/operations/restore-drill.sh");
const backupWorkflow = read(".github/workflows/backup-production.yml");
const maintenanceWorkflow = read(".github/workflows/backup-maintenance.yml");
const extractorPath = join(root, "scripts", "operations", "extract-prisma-migration-metadata.mjs");

assert.match(backup, /extract-prisma-migration-metadata\.mjs/u);
assert.doesNotMatch(backup, /select count\(\*\) from \\"_prisma_migrations\\"/u);
assert.match(fallback, /^#requires -Version 7\.0$/mu);
assert.match(configure, /^#requires -Version 7\.0$/mu);
assert.match(configure, /-Execute \$pwshPath/u);
assert.doesNotMatch(configure, /-Execute "powershell\.exe"/u);
assert.match(configure, /-CredentialPath `"\$credentialPath`"/u);
assert.match(configure, /-MigrationMetadataScript `"\$installedMetadataScript`"/u);
assert.doesNotMatch(configure, /git rev-parse origin\/main/u);
assert.match(fallback, /RAILWAY_CURRENT_SUCCESS/u);
assert.match(fallback, /RAILWAY_LAST_KNOWN_AT_INSTALL/u);
for (const field of ["postgresVersion", "migrationCount", "migrationHead", "applicationSha", "applicationShaSource"]) {
  assert.match(fallback, new RegExp(`${field} =`, "u"), `FALLBACK_MANIFEST_${field.toUpperCase()}_MISSING`);
}
for (const script of [backup, fallback]) {
  assert.match(script, /PG_DUMP_ARCHIVE/u);
  assert.match(script, /Dumped from database version/u);
}
assert.match(backup, /\^;\[\[:space:\]\]\*Dumped from database version:/u);
assert.match(fallback, /\^;\\s\*Dumped from database version:/u);
assert.match(restore, /restic restore "\$\{snapshot_id\}"/u);
assert.doesNotMatch(restore, /restic restore latest/u);
for (const workflow of [backupWorkflow, maintenanceWorkflow]) {
  assert.match(workflow, /group: production-backup-repository/u);
}
assert.match(backupWorkflow, /^\s+pull_request:$/mu);
assert.match(backupWorkflow, /^\s+backup-contract:$/mu);
assert.match(backupWorkflow, /^\s+encrypted-production-snapshot:$/mu);
assert.match(backupWorkflow, /^\s+production-backup:$/mu);
assert.match(backupWorkflow, /needs:\s*\n\s+- backup-contract\s*\n\s+- encrypted-production-snapshot/u);
assert.match(backupWorkflow, /EVENT_NAME: \$\{\{ github\.event_name \}\}/u);
assert.doesNotMatch(backupWorkflow, /pull_request_target/u);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "orqena-migration-metadata-"));
try {
  const sqlPath = join(temporaryDirectory, "migrations.sql");
  writeFileSync(sqlPath, [
    'COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;',
    'id-1\thash-1\t2026-07-27 10:00:00+00\t20260727100000_first\t\\N\t\\N\t2026-07-27 09:59:00+00\t1',
    'id-2\thash-2\t2026-07-28 18:01:00+00\t20260728180000_add_stripe_billing_foundation\t\\N\t\\N\t2026-07-28 18:00:00+00\t1',
    'id-3\thash-3\t2026-07-29 08:00:00+00\t20260729080000_rolled_back\t\\N\t2026-07-29 08:01:00+00\t2026-07-29 07:59:00+00\t0',
    'id-4\thash-4\t\\N\t20260729090000_pending\t\\N\t\\N\t2026-07-29 09:00:00+00\t0',
    '\\.',
    '',
  ].join("\n"), "utf8");
  const result = spawnSync(process.execPath, [extractorPath, sqlPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    migrationCount: 2,
    migrationHead: "20260728180000_add_stripe_billing_foundation",
  });

  writeFileSync(sqlPath, "SELECT 1;\n", "utf8");
  const invalid = spawnSync(process.execPath, [extractorPath, sqlPath], { encoding: "utf8" });
  assert.notEqual(invalid.status, 0, "MALFORMED_MIGRATION_SQL_MUST_FAIL");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write("Backup automation contracts passed.\n");
