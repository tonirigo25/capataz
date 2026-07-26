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
for (const file of [
  "scripts/readiness/validate-c5-low-end.mjs",
  "scripts/readiness/validate-review-capacity.mjs",
  "scripts/readiness/validate-review-auth-matrix.mjs",
  "scripts/readiness/run-review-auth-audit.ps1",
  "lighthouserc.cjs",
]) assert.ok(read(file).length > 500, file);
process.stdout.write(`${JSON.stringify({ ok: true, control: "C5-static", browsers: 3, viewports: matrix.viewports.length, publicRoutes: matrix.publicRoutes.length, authenticatedFamilies: matrix.authenticatedFamilies.length, visualBaseline: baseline.status })}\n`);
