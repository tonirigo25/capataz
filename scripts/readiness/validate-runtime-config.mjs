import { validateEnvironmentIsolation } from "./environment-isolation.mjs";

const TRUE = "true";

function enabled(name) {
  return process.env[name]?.trim().toLowerCase() === TRUE;
}

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function requireNames(errors, reason, names) {
  const missing = names.filter((name) => !present(name));
  if (missing.length) errors.push(`${reason}: ${missing.join(", ")}`);
}

export function validateRuntimeConfig(phase = "runtime") {
  const environment = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "development").trim().toLowerCase();
  const errors = [];

  if (["staging", "production"].includes(environment) && phase !== "build") {
    requireNames(errors, "runtime database configuration is incomplete", ["DATABASE_URL", "APP_BASE_URL"]);
  }

  if (environment === "production") {
    requireNames(errors, "production identity is incomplete", ["PRODUCT_NAME", "LEGAL_ENTITY_NAME", "LEGAL_TAX_ID"]);
    if (present("APP_BASE_URL")) {
      const appUrl = new URL(process.env.APP_BASE_URL);
      if (appUrl.protocol !== "https:" || /localhost|127\.0\.0\.1|railway\.app$/i.test(appUrl.hostname)) {
        errors.push("production APP_BASE_URL must be the approved HTTPS canonical domain");
      }
    }
    if ((process.env.STORAGE_PROVIDER || "local").trim().toLowerCase() === "local") {
      errors.push("production STORAGE_PROVIDER must use private object storage");
    }
    if (phase !== "build") {
      requireNames(errors, "production security configuration is incomplete", ["APP_ENCRYPTION_KEYS", "APP_ACTIVE_KEY_VERSION", "JOB_RUNNER_SECRET"]);
    }
  }

  if (enabled("EMAIL_LIVE_ENABLED")) {
    requireNames(errors, "live email gate is incomplete", ["EMAIL_FROM", "EMAIL_SENDING_DOMAIN", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET"]);
  }
  if (enabled("BILLING_ENABLED")) {
    requireNames(errors, "billing gate is incomplete", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_KEYS"]);
  }
  if (enabled("FISCAL_ENGINE_ENABLED") && process.env.FISCAL_MODE?.trim().toLowerCase() === "live") {
    requireNames(errors, "live fiscal gate is incomplete", ["FISCAL_PROVIDER", "FISCAL_CERTIFICATE_REF", "FISCAL_SOFTWARE_VERSION"]);
  }
  if (enabled("AI_ENABLED")) {
    requireNames(errors, "AI gate is incomplete", ["OPENAI_API_KEY", "OPENAI_DATA_PROFILE"]);
  }
  if (process.env.STORAGE_PROVIDER?.trim().toLowerCase() === "s3") {
    requireNames(errors, "S3 storage configuration is incomplete", ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "MALWARE_SCAN_ENDPOINT", "MALWARE_SCAN_AUTHORIZATION"]);
  }

  if (phase !== "build") {
    const isolation = validateEnvironmentIsolation(process.env);
    if (!isolation.ok) errors.push(...isolation.errors.map((error) => `environment isolation: ${error}`));
  }

  if (errors.length) {
    throw new Error(`[runtime-config] ${errors.join("; ")}`);
  }
  return { ok: true, environment, phase };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const result = validateRuntimeConfig(process.argv[2] || "runtime");
  console.log(JSON.stringify(result));
}
