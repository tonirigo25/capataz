import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED !== "true") {
  throw new Error("D10_ISOLATED_DATABASE_FLAG_REQUIRED");
}
const embeddedRoot = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!embeddedRoot || !embeddedRoot.includes("embedded-postgres-qa")) {
  throw new Error("D10_EMBEDDED_POSTGRES_ROOT_REQUIRED");
}

const gates = [
  { key: "F2", script: "readiness:validate-f2-postgres" },
  { key: "F3", script: "readiness:validate-f3-postgres" },
  { key: "F4", script: "readiness:validate-f4-postgres" },
  { key: "F6", script: "readiness:validate-f6-postgres" },
  { key: "F7", script: "readiness:validate-f7-postgres" },
  { key: "F8", script: "readiness:validate-f8-postgres" },
  { key: "C2", script: "readiness:validate-c2-postgres" },
  { key: "F11_TENANT_PENTEST", script: "readiness:validate-f11-tenant" },
];
const results = [];

for (const gate of gates) {
  const startedAt = Date.now();
  process.stdout.write(`[design-d10-postgres] START ${gate.key} ${gate.script}\n`);
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("D10_NPM_EXEC_PATH_REQUIRED");
  const result = spawnSync(process.execPath, [npmCli, "run", gate.script], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 12 * 60_000,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  const record = {
    key: gate.key,
    script: gate.script,
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    elapsedMs: Date.now() - startedAt,
    ok: result.status === 0,
  };
  results.push(record);
  process.stdout.write(`[design-d10-postgres] END ${gate.key} ok=${record.ok} elapsedMs=${record.elapsedMs}\n`);
  if (!record.ok) break;
}

const outputRoot = process.env.ORQENA_D10_POSTGRES_OUTPUT_DIR
  ?? join(process.cwd(), "artifacts", "design-d10-postgres");
mkdirSync(outputRoot, { recursive: true });
const report = {
  schemaVersion: 1,
  phase: "D10",
  target: "critical isolated PostgreSQL and tenant pentest",
  generatedAt: new Date().toISOString(),
  isolated: true,
  localhostOnly: true,
  databaseNamePolicy: "capataz_test*",
  productionWrites: 0,
  stagingWrites: 0,
  externalCalls: 0,
  gates,
  results,
  ok: results.length === gates.length && results.every(({ ok }) => ok),
};
const output = join(outputRoot, "postgres-gates.json");
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  ok: report.ok,
  gatesPassed: results.filter(({ ok }) => ok).length,
  gatesTotal: gates.length,
  output: relative(process.cwd(), output),
})}\n`);
if (!report.ok) process.exitCode = 1;
