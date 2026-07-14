export const EXPECTED_FIXTURE_TOTAL = 252;
export const EXPECTED_FIXTURE_APPROVAL = "DELETE-252-4a33f773-7a3b51a7";
export const EXCLUDED_REAL_TASK_ID = "cmrhm95u80004vd84gufttv29";

export const EXPECTED_PRODUCTION_TARGET = Object.freeze({
  projectId: "ca7ec244-e961-42dc-8573-23835e6db5f5",
  environmentId: "42c14ac1-e933-485b-9b44-01272af389e0",
  serviceId: "0f485ee7-0ab3-430d-9abd-791b8e3e2907",
  environmentName: "production",
  serviceName: "Postgres",
});

export function assertProductionTarget(env) {
  const checks = {
    projectId: env.RAILWAY_PROJECT_ID,
    environmentId: env.RAILWAY_ENVIRONMENT_ID,
    serviceId: env.RAILWAY_SERVICE_ID,
    environmentName: env.RAILWAY_ENVIRONMENT_NAME,
    serviceName: env.RAILWAY_SERVICE_NAME,
  };

  for (const [field, expected] of Object.entries(EXPECTED_PRODUCTION_TARGET)) {
    if (checks[field] !== expected) throw new Error(`PRODUCTION_TARGET_MISMATCH:${field}`);
  }
}

export function assertCleanupExecution(input) {
  if (input.approval !== EXPECTED_FIXTURE_APPROVAL) throw new Error("EXPLICIT_CLEANUP_APPROVAL_MISSING");
  if (!input.alreadyClean && input.total !== EXPECTED_FIXTURE_TOTAL) throw new Error("CLEANUP_TOTAL_MISMATCH");
  if (!input.cleanupManifestMatches) throw new Error("CLEANUP_MANIFEST_MISMATCH");
  if (!input.manifestHashMatches) throw new Error("CLEANUP_MANIFEST_HASH_MISMATCH");
  if (input.fingerprintExtrasCount !== 0) throw new Error("CLEANUP_UNMANIFESTED_FINGERPRINTS");
  if (!input.excludedTaskPreserved) throw new Error("CLEANUP_EXCLUDED_TASK_GUARD_FAILED");
  if (!input.companyValidationPassed || input.companyIds.length !== 0) {
    throw new Error("CLEANUP_COMPANY_VALIDATION_FAILED");
  }
}
