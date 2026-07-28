import { createHash } from "node:crypto";

const MANAGED_ENVIRONMENTS = new Set(["preview", "staging", "production"]);

export function validateEnvironmentIsolation(env = process.env) {
  const environment = String(env.NEXT_PUBLIC_APP_ENV || env.APP_ENV || "development").trim().toLowerCase();
  if (!MANAGED_ENVIRONMENTS.has(environment)) return { ok: true, environment, managed: false };
  const errors = [];
  for (const name of ["DEPLOYMENT_ENVIRONMENT_ID", "DATABASE_RESOURCE_ID", "STORAGE_RESOURCE_ID", "CREDENTIAL_SCOPE"]) if (!env[name]?.trim()) errors.push(`missing ${name}`);
  if (env.CREDENTIAL_SCOPE?.trim().toLowerCase() !== environment) errors.push("CREDENTIAL_SCOPE does not match APP_ENV");
  const actualDatabaseFingerprint = env.DATABASE_URL ? sha256(env.DATABASE_URL) : "";
  if (environment !== "production") {
    for (const [actualName, blockedName] of [["DATABASE_RESOURCE_ID", "PRODUCTION_DATABASE_RESOURCE_ID"], ["STORAGE_RESOURCE_ID", "PRODUCTION_STORAGE_RESOURCE_ID"]]) {
      if (!env[blockedName]?.trim()) errors.push(`missing ${blockedName}`);
      else if (env[actualName]?.trim() === env[blockedName]?.trim()) errors.push(`${actualName} reuses production`);
    }
    if (!env.PRODUCTION_DATABASE_URL_SHA256?.trim()) errors.push("missing PRODUCTION_DATABASE_URL_SHA256");
    else if (actualDatabaseFingerprint && actualDatabaseFingerprint === env.PRODUCTION_DATABASE_URL_SHA256.trim()) errors.push("DATABASE_URL reuses production");
  }
  if (environment === "preview") {
    for (const [actualName, blockedName] of [["DATABASE_RESOURCE_ID", "STAGING_DATABASE_RESOURCE_ID"], ["STORAGE_RESOURCE_ID", "STAGING_STORAGE_RESOURCE_ID"]]) {
      if (!env[blockedName]?.trim()) errors.push(`missing ${blockedName}`);
      else if (env[actualName]?.trim() === env[blockedName]?.trim()) errors.push(`${actualName} reuses staging`);
    }
    if (!env.STAGING_DATABASE_URL_SHA256?.trim()) errors.push("missing STAGING_DATABASE_URL_SHA256");
    else if (actualDatabaseFingerprint && actualDatabaseFingerprint === env.STAGING_DATABASE_URL_SHA256.trim()) errors.push("DATABASE_URL reuses staging");
  }
  return { ok: errors.length === 0, environment, managed: true, errors };
}

export function assertEnvironmentIsolation(env = process.env) {
  const result = validateEnvironmentIsolation(env);
  if (!result.ok) throw new Error(`[environment-isolation] ${result.errors.join("; ")}`);
  return result;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
