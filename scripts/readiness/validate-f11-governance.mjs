import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");
let passed = 0;
const check = (name, operation) => {
  operation();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
};

const required = [
  "LICENSE", "NOTICE", "CONTRIBUTING.md", "THIRD_PARTY_NOTICES.md",
  "docs/governance/KNOWN_ISSUES.md", "docs/governance/TECHNICAL_DEBT.md",
  "docs/governance/ASSET_TRANSFER_REGISTER.md", "docs/governance/IP_CHAIN_REGISTER.md",
  "docs/data-room/README.md", "docs/data-room/public/INDEX.md", "docs/data-room/public/ARCHITECTURE_AND_FLOWS.md",
  "docs/data-room/public/OPERATIONS_AND_RECOVERY.md", "docs/data-room/public/COMMAND_CATALOG.md",
  "docs/data-room/public/SUPPORT_MATRIX.md", "docs/data-room/public/TRANSITION_PACKAGE.md",
  "docs/adr/0009-privacy-governance.md", "docs/adr/0010-release-and-supply-chain-governance.md",
  ".github/workflows/ci.yml", ".github/workflows/security.yml", ".github/workflows/railway-preview.yml",
  ".github/workflows/release-candidate.yml", "vitest.config.ts", "playwright.config.ts",
];

for (const path of required) check(`required:${path}`, () => assert.ok(existsSync(join(root, path)), path));

const workflows = readdirSync(join(root, ".github/workflows")).filter((name) => name.endsWith(".yml"));
check("workflow-count", () => assert.equal(workflows.length, 4));
for (const name of workflows) {
  const source = read(`.github/workflows/${name}`);
  check(`${name}:minimum-permissions`, () => {
    assert.match(source, /^permissions:\n  contents: read$/mu);
    assert.doesNotMatch(source, /write-all/u);
  });
  check(`${name}:actions-pinned`, () => {
    for (const line of source.match(/^\s*- uses:.+$/gmu) ?? []) assert.match(line, /@[a-f0-9]{40}\s*$/u, line);
  });
}

const envExample = read(".env.example");
check("launch-flags-closed", () => {
  for (const value of ["PUBLIC_INDEXING_ENABLED=false", "PUBLIC_PRICING_ENABLED=false", "AI_ENABLED=false", "AI_PROVIDER_MODE=off", "BILLING_ENABLED=false", "EMAIL_LIVE_ENABLED=false"]) assert.ok(envExample.includes(value), value);
});
check("private-data-room-ignored", () => assert.ok(read(".gitignore").includes("docs/data-room/private/")));
check("private-data-room-absent", () => assert.equal(existsSync(join(root, "docs/data-room/private")), false));
check("adrs-cover-core-decisions", () => assert.ok(readdirSync(join(root, "docs/adr")).filter((name) => name.endsWith(".md")).length >= 10));

const gates = JSON.parse(read("docs/readiness/external-gates.json")).gates;
check("external-gates-versioned", () => assert.ok(gates.length >= 16));
check("external-gate-ids-generic-and-unique", () => {
  assert.equal(new Set(gates.map(({ id }) => id)).size, gates.length);
  for (const gate of gates) assert.match(gate.id, /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3}$/u);
});
check("railway-workflow-does-not-mutate", () => assert.doesNotMatch(read(".github/workflows/railway-preview.yml"), /railway\s+(?:up|delete|environment\s+delete)/iu));
check("release-workflow-evidence-only", () => assert.ok(read(".github/workflows/release-candidate.yml").includes("confirm_no_deploy")));
check("ci-compiles-canonical-ledger", () => assert.ok(read(".github/workflows/ci.yml").includes("readiness:compile-requirements && git diff --exit-code -- docs/readiness/requirements.yaml")));
check("ci-runs-cross-phase-static-regression", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.ok(ci.includes("readiness:validate-all-static"));
  const scripts = JSON.parse(read("package.json")).scripts;
  for (const gate of ["readiness:validate-f1", "readiness:validate-f2", "readiness:validate-f3", "readiness:validate-f4", "readiness:validate-f5", "readiness:validate-f6", "readiness:validate-f7", "readiness:validate-f8", "readiness:validate-f9", "mobile:validate", "readiness:validate-f11"]) {
    assert.ok(scripts["readiness:validate-all-static"].includes(`npm run ${gate}`), gate);
  }
});
check("ci-cross-phase-regression-has-full-history", () => {
  const applicationJob = read(".github/workflows/ci.yml").split("\n  critical-database:", 1)[0];
  assert.ok(applicationJob.includes("fetch-depth: 0"));
});
check("codeql-and-gitleaks", () => {
  const security = read(".github/workflows/security.yml");
  assert.ok(security.includes("github/codeql-action"));
  assert.ok(security.includes("gitleaks/gitleaks-action"));
});
check("sbom-license-audit", () => {
  const security = read(".github/workflows/security.yml");
  assert.ok(security.includes("security:sbom"));
  assert.ok(security.includes("audit-ci --high"));
  assert.ok(security.includes("readiness:licenses"));
});

process.stdout.write(`${JSON.stringify({ ok: true, phase: "F11", checks: passed, workflows: workflows.length, productionWrites: 0, stagingWrites: 0 })}\n`);
