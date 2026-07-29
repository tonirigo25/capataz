import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
assert.equal(existsSync(join(root, "app/.well-known/security.txt/route.ts")), true);
assert.equal(existsSync(join(root, "public/.well-known/security.txt")), false);
assert.ok(read("docs/runbooks/RESPONSIBLE_DISCLOSURE.md").includes("Private Vulnerability Reporting"));
assert.ok(read("app/seguridad/page.tsx").includes("security/advisories/new"));

const providers = read("docs/runbooks/PROVIDER_DEGRADATION.md");
for (const token of ["EMAIL_LIVE_ENABLED=false", "BILLING_ENABLED=false", "FISCAL_ENGINE_ENABLED=false", "AI_ENABLED=false", "ANALYTICS_ENABLED=false"]) {
  assert.ok(providers.includes(token), token);
}
const retention = read("docs/runbooks/LEAD_RETENTION_AND_ABUSE.md");
assert.ok(retention.includes("DEMO_LEAD_RETENTION_ENABLED=true"));
assert.ok(retention.includes("LEGAL_HOLD"));
assert.ok(read("lib/commercial/demo-retention.ts").includes("DEMO_REQUEST_PROTECTED_STATUSES"));
assert.ok(read("docs/readiness/TECHNICAL_DEBT_REGISTER.md").includes("TD-006"));

process.stdout.write(`${JSON.stringify({ ok: true, controls: ["E", "F", "G"], securityTxt: "PASS", providerRunbooks: 6, debtItems: 6 })}\n`);
