import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const contract = JSON.parse(read("contracts/release/v1/provider-activation-gates.json"));
const expectedProviders = ["openai", "email", "billing", "storage", "observability", "fiscal"];

assert.equal(contract.schemaVersion, "orqena-provider-activation-gates-v1");
assert.equal(contract.policy, "independent-fail-closed-waves");
assert.deepEqual(contract.providers.map(({ id }) => id), expectedProviders);
for (const provider of contract.providers) {
  assert.equal(provider.status, "READY_FOR_EXTERNAL_INPUT", `${provider.id}:status`);
  assert.equal(provider.liveEnabled, false, `${provider.id}:live`);
  for (const field of ["activationControl", "externalInput", "killSwitch", "rollback"]) {
    assert.equal(typeof provider[field], "string", `${provider.id}:${field}`);
    assert.ok(provider[field].length >= 8, `${provider.id}:${field}:length`);
  }
  assert.ok(provider.technicalEvidence.length >= 3, `${provider.id}:evidence`);
  for (const evidence of provider.technicalEvidence) {
    assert.ok(existsSync(join(root, evidence)), `${provider.id}:${evidence}`);
  }
}

const flags = JSON.parse(read("contracts/release/v1/feature-flags.json"));
for (const key of ["AI_ENABLED", "EMAIL_LIVE_ENABLED", "BILLING_ENABLED", "FISCAL_ENGINE_ENABLED"]) {
  const flag = flags.flags.find((item) => item.key === key);
  assert.ok(flag, key);
  for (const environment of ["preview", "staging", "production"]) assert.equal(flag[environment], false, `${key}:${environment}`);
}
assert.match(read("docs/readiness/C6_PROVIDER_ACTIVATION_LEDGER.md"), /Success in one wave cannot authorize any\s+other wave/u);

process.stdout.write(`${JSON.stringify({
  ok: true,
  control: "C6",
  providers: expectedProviders.length,
  liveEnabled: 0,
  status: "READY_FOR_EXTERNAL_INPUT"
})}\n`);
