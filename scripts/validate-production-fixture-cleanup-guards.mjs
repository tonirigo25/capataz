import assert from "node:assert/strict";
import {
  EXPECTED_FIXTURE_APPROVAL,
  assertCleanupExecution,
  assertProductionTarget,
} from "./production-fixture-cleanup-guards.mjs";

const productionEnv = {
  RAILWAY_PROJECT_ID: "ca7ec244-e961-42dc-8573-23835e6db5f5",
  RAILWAY_ENVIRONMENT_ID: "42c14ac1-e933-485b-9b44-01272af389e0",
  RAILWAY_SERVICE_ID: "0f485ee7-0ab3-430d-9abd-791b8e3e2907",
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_SERVICE_NAME: "Postgres",
};
assert.doesNotThrow(() => assertProductionTarget(productionEnv));
for (const field of Object.keys(productionEnv)) {
  assert.throws(() => assertProductionTarget({ ...productionEnv, [field]: "wrong" }), /PRODUCTION_TARGET_MISMATCH/);
}

const valid = {
  approval: EXPECTED_FIXTURE_APPROVAL,
  alreadyClean: false,
  total: 252,
  cleanupManifestMatches: true,
  manifestHashMatches: true,
  fingerprintExtrasCount: 0,
  excludedTaskPreserved: true,
  companyValidationPassed: true,
  companyIds: [],
};
assert.doesNotThrow(() => assertCleanupExecution(valid));
assert.throws(() => assertCleanupExecution({ ...valid, approval: "" }), /EXPLICIT_CLEANUP_APPROVAL_MISSING/);
assert.throws(() => assertCleanupExecution({ ...valid, total: 251 }), /CLEANUP_TOTAL_MISMATCH/);
assert.throws(() => assertCleanupExecution({ ...valid, total: 253 }), /CLEANUP_TOTAL_MISMATCH/);
assert.throws(() => assertCleanupExecution({ ...valid, manifestHashMatches: false }), /CLEANUP_MANIFEST_HASH_MISMATCH/);
assert.throws(() => assertCleanupExecution({ ...valid, fingerprintExtrasCount: 1 }), /CLEANUP_UNMANIFESTED_FINGERPRINTS/);
assert.throws(() => assertCleanupExecution({ ...valid, excludedTaskPreserved: false }), /CLEANUP_EXCLUDED_TASK_GUARD_FAILED/);
assert.throws(() => assertCleanupExecution({ ...valid, companyIds: ["company-real"] }), /CLEANUP_COMPANY_VALIDATION_FAILED/);

console.log("[production-fixture-cleanup-guards] OK target, approval, totals, manifest, exclusions and company isolation");
