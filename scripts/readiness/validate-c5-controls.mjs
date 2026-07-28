import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const config = read("playwright.config.ts");
for (const engine of ["chromium", "firefox", "webkit"]) assert.ok(config.includes(`name: "${engine}"`), engine);
const ci = read(".github/workflows/ci.yml");
assert.ok(ci.includes("chromium firefox webkit"));
assert.ok(ci.includes("readiness:lighthouse"));
const matrix = JSON.parse(read("contracts/qa/v1/surface-matrix.json"));
assert.equal(matrix.schemaVersion, "orqena-surface-audit-v1");
assert.deepEqual(matrix.viewports, [320, 390, 768, 1024, 1440, 1920]);
assert.ok(matrix.publicRoutes.length >= 24);
assert.ok(matrix.authenticatedFamilies.length >= 14);
assert.ok(matrix.profiles.length >= 12);
for (const family of matrix.authenticatedFamilies) {
  for (const route of family.routes) {
    const routePath = route.slice(1).split("/").map((segment) => segment === ":id" ? "[id]" : segment).join("/");
    const candidates = [
      join(process.cwd(), "app", "(app)", routePath, "page.tsx"),
      join(process.cwd(), "app", routePath, "page.tsx"),
      join(process.cwd(), "app", "(auth)", routePath, "page.tsx"),
    ];
    assert.ok(candidates.some((candidate) => existsSync(candidate)), `authenticated surface route is stale: ${route}`);
  }
}
const baseline = JSON.parse(read("contracts/visual/v1/baseline-approval.json"));
assert.equal(baseline.approved, false);
assert.equal(baseline.status, "READY_FOR_EXTERNAL_INPUT");
const authenticatedEvidence = JSON.parse(read("docs/readiness/evidence/c5/remote-authenticated-summary.json"));
assert.equal(authenticatedEvidence.automatedVerdict, "PASS");
assert.equal(authenticatedEvidence.phaseC5, "READY_FOR_EXTERNAL_INPUT");
assert.equal(authenticatedEvidence.summary.profiles, 11);
assert.equal(authenticatedEvidence.summary.profileViewportCases, 66);
assert.equal(authenticatedEvidence.summary.ownerSurfaceFamilies, 46);
assert.equal(authenticatedEvidence.summary.stateCasesPassed, 6);
assert.equal(authenticatedEvidence.summary.blockingFindings, 0);
assert.ok(authenticatedEvidence.externalInputStillRequired.includes("NVDA"));
assert.ok(authenticatedEvidence.externalInputStillRequired.includes("VoiceOver"));
const today = read("app/(app)/hoy/page.tsx");
assert.ok(today.includes("__orqena_review_state"));
assert.ok(today.includes('process.env.NEXT_PUBLIC_APP_ENV === "preview"'));
assert.ok(today.includes('process.env.CREDENTIAL_SCOPE === "preview"'));
for (const file of [
  "scripts/readiness/validate-c5-low-end.mjs",
  "scripts/readiness/validate-review-capacity.mjs",
  "scripts/readiness/validate-review-auth-matrix.mjs",
  "scripts/readiness/run-review-auth-audit.ps1",
  "lighthouserc.cjs",
]) assert.ok(read(file).length > 500, file);
process.stdout.write(`${JSON.stringify({ ok: true, control: "C5-static", browsers: 3, viewports: matrix.viewports.length, publicRoutes: matrix.publicRoutes.length, authenticatedFamilies: matrix.authenticatedFamilies.length, automatedAuthenticated: authenticatedEvidence.automatedVerdict, manualEvidence: authenticatedEvidence.phaseC5, visualBaseline: baseline.status })}\n`);
