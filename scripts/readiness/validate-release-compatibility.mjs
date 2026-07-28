import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const contract = JSON.parse(read("contracts/release/v1/feature-flags.json"));
const expected = [
  "ORQENA_PUBLIC_REGISTRATION_ENABLED",
  "PUBLIC_INDEXING_ENABLED",
  "PUBLIC_PRICING_ENABLED",
  "FISCAL_ENGINE_ENABLED",
  "BILLING_ENABLED",
  "EMAIL_LIVE_ENABLED",
  "AI_ENABLED",
  "ANALYTICS_ENABLED"
];

assert.equal(contract.schemaVersion, "orqena-release-flags-v1");
assert.equal(contract.defaultPolicy, "fail-closed");
assert.deepEqual(contract.flags.map((flag) => flag.key), expected);
for (const flag of contract.flags) {
  for (const environment of ["local", "preview", "staging", "production"]) {
    assert.equal(flag[environment], false, `${flag.key}:${environment}`);
  }
  for (const field of ["owner", "activationEvidence", "killSwitch", "rollback"]) {
    assert.equal(typeof flag[field], "string", `${flag.key}:${field}`);
    assert.ok(flag[field].length >= 8, `${flag.key}:${field}`);
  }
}

for (const file of [".env.example", ".env.staging.example", ".env.production.example"]) {
  const source = read(file);
  for (const key of expected.filter((value) => value !== "PUBLIC_PRICING_ENABLED" || file === ".env.example")) {
    assert.ok(source.includes(`${key}=false`), `${file}:${key}`);
  }
}

const matrix = read("docs/readiness/RELEASE_COMPATIBILITY_MATRIX.md");
for (const token of ["CAPATAZ_*", "PWA client", "Forward-only schema", "Canary and rollback"]) {
  assert.ok(matrix.includes(token), token);
}

process.stdout.write(`${JSON.stringify({ ok: true, control: "D2", flags: expected.length, defaultPolicy: contract.defaultPolicy })}\n`);
