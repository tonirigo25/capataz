import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "lib/prisma.ts"), "utf8");
const evidence = JSON.parse(readFileSync(join(process.cwd(), "docs/readiness/evidence/c3/review-runtime-pool.json"), "utf8"));

assert.equal(
  (source.match(/new PrismaClient\(/gu) ?? []).length,
  1,
  "The shared runtime module must construct at most one Prisma client",
);
assert.match(
  source,
  /globalForPrisma\.prisma\s*\?\?\s*createPrismaClient\(\)/u,
  "The runtime must reuse the process-global Prisma client",
);
assert.match(
  source,
  /globalForPrisma\.prisma\s*=\s*prisma/u,
  "The runtime must persist the client in the process-global slot",
);
assert.doesNotMatch(
  source,
  /if\s*\(\s*process\.env\.NODE_ENV\s*!==\s*["']production["']\s*\)\s*\{[\s\S]*globalForPrisma\.prisma\s*=\s*prisma/u,
  "Standalone production route bundles must share the same process-global pool",
);
assert.equal(evidence.verdict, "PASS_REVIEW_RUNTIME_AND_SYNTHETIC_CAPACITY");
assert.equal(evidence.productionCapacityClaim, false);
assert.equal(evidence.availabilityClaim, false);
assert.equal(evidence.phaseC3, "PASS");
assert.ok(evidence.remoteWebVitals.review.median.LCP <= evidence.remoteWebVitals.budget.LCP);
assert.ok(evidence.remoteWebVitals.review.median.CLS <= evidence.remoteWebVitals.budget.CLS);
assert.ok(evidence.remoteWebVitals.review.median.INP <= evidence.remoteWebVitals.budget.INP);
assert.ok(evidence.remoteWebVitals.staging.median.LCP <= evidence.remoteWebVitals.budget.LCP);
assert.ok(evidence.remoteWebVitals.staging.median.CLS <= evidence.remoteWebVitals.budget.CLS);
assert.ok(evidence.remoteWebVitals.staging.median.INP <= evidence.remoteWebVitals.budget.INP);
assert.ok(evidence.measurements.some(({ name, idleInTransaction }) => name === "after-authenticated-audit" && idleInTransaction === 0));

process.stdout.write(`${JSON.stringify({
  ok: true,
  control: "C3",
  runtimePool: "PROCESS_GLOBAL_SINGLETON",
  reviewEvidence: evidence.verdict,
  phaseC3: evidence.phaseC3,
  regression: "standalone route bundles cannot allocate one pool per bundle",
})}\n`);
