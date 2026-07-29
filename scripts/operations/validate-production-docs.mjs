import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("../..", import.meta.url)));
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const currentDocuments = [
  "docs/readiness/PRODUCTION_STATE.md",
  "docs/releases/2026-07-28-production-release.md",
  "docs/operations/POST_LAUNCH_CLOSURE.md",
  "README.md",
];

for (const relativePath of currentDocuments) {
  assert.ok(existsSync(join(root, relativePath)), `${relativePath} must exist`);
  const contents = read(relativePath);
  assert.doesNotMatch(contents, /\b43 migraciones\b/iu, `${relativePath} must not claim 43 migrations`);
  assert.doesNotMatch(contents, /\bProduction changed:\s*no\b/iu, `${relativePath} must not claim Production is unchanged`);
  assert.doesNotMatch(contents, /\bNO[- ]GO para producci[oó]n\b/iu, `${relativePath} must not declare the current release NO-GO`);
}

const productionState = read("docs/readiness/PRODUCTION_STATE.md");
for (const required of [
  "6b96f7c5004f4066b7b3167c6d2fe9ee76a4cdae",
  "daaef968-b01a-4896-9208-74b498e7be51",
  "44",
  "20260728180000_add_stripe_billing_foundation",
  "ORQENA_PUBLIC_REGISTRATION_ENABLED=false",
  "BILLING_ENABLED=false",
  "AI_ENABLED=false",
  "FISCAL_ENGINE_ENABLED=false",
  "ANALYTICS_ENABLED=false",
  "PUBLIC_INDEXING_ENABLED=false",
]) {
  assert.ok(productionState.includes(required), `PRODUCTION_STATE.md must include ${required}`);
}
assert.match(productionState, /0\s+(?:migraciones\s+)?pendientes/iu, "PRODUCTION_STATE.md must declare zero pending migrations");

for (const historicalPath of [
  "docs/readiness/C10_GO_NO_GO.md",
  "docs/readiness/LATEST_REVIEW.md",
]) {
  const heading = read(historicalPath).split(/\r?\n/u).slice(0, 8).join("\n");
  assert.match(heading, /\b(?:HISTORICAL|SUPERSEDED)\b/u, `${historicalPath} must be marked historical or superseded`);
}

const releaseDocument = read("docs/releases/2026-07-28-production-release.md");
assert.match(releaseDocument, /production-2026-07-28/u, "the current release document must reference the immutable tag");

const readme = read("README.md");
assert.match(readme, /https:\/\/app\.orqenatech\.com/u, "README.md must identify the current production application host");
assert.match(readme, /docs\/readiness\/PRODUCTION_STATE\.md/u, "README.md must link the canonical production state");

console.log("Production documentation drift validation passed.");
