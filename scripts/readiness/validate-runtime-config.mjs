import { validateEnvironmentIsolation } from "./environment-isolation.mjs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TRUE = "true";
const CANONICAL_STRIPE_PRICES = [
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_ANNUAL",
];

function enabled(name) {
  return process.env[name]?.trim().toLowerCase() === TRUE;
}

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function requireNames(errors, reason, names) {
  const missing = names.filter((name) => !present(name));
  if (missing.length) errors.push(`${reason}: ${missing.join(", ")}`);
}

function validateStripeBilling(errors) {
  const configuredCanonical = CANONICAL_STRIPE_PRICES.filter(present);
  const hasCanonical = configuredCanonical.length > 0;
  if (hasCanonical && configuredCanonical.length !== CANONICAL_STRIPE_PRICES.length) {
    requireNames(errors, "canonical Stripe price configuration is incomplete", CANONICAL_STRIPE_PRICES);
  }
  if (
    configuredCanonical.length === CANONICAL_STRIPE_PRICES.length
    && new Set(configuredCanonical.map(value)).size !== CANONICAL_STRIPE_PRICES.length
  ) {
    errors.push("canonical Stripe plan and interval prices must be unique");
  }
  if (hasCanonical && present("STRIPE_PRICE_KEYS")) {
    errors.push("deprecated STRIPE_PRICE_KEYS conflicts with canonical plan and interval prices");
  }
  for (const [legacy, canonical] of [
    ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_STARTER_MONTHLY"],
    ["STRIPE_PRICE_PRO", "STRIPE_PRICE_PRO_MONTHLY"],
    ["STRIPE_PRICE_BUSINESS", "STRIPE_PRICE_BUSINESS_MONTHLY"],
  ]) {
    if (present(legacy) && present(canonical) && value(legacy) !== value(canonical)) {
      errors.push(`deprecated ${legacy} conflicts with ${canonical}`);
    }
  }

  const validatesReadiness = enabled("BILLING_ENABLED") || hasCanonical;
  if (validatesReadiness) {
    if (value("STRIPE_TRIAL_DAYS") !== "3") errors.push("STRIPE_TRIAL_DAYS must be 3");
    if (value("BILLING_PAST_DUE_GRACE_DAYS") !== "3") errors.push("BILLING_PAST_DUE_GRACE_DAYS must be 3");
    const allowedCountries = value("BILLING_ALLOWED_COUNTRIES")
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean);
    if (allowedCountries.length !== 1 || allowedCountries[0] !== "ES") {
      errors.push("BILLING_ALLOWED_COUNTRIES must remain ES until cross-border authorization");
    }
    if (value("EU_B2B_CROSS_BORDER_ENABLED") !== "false") {
      errors.push("EU_B2B_CROSS_BORDER_ENABLED must remain false until ROI/VIES and fiscal gates are approved");
    }
    if (enabled("ORQENA_PUBLIC_REGISTRATION_ENABLED")) {
      errors.push("ORQENA_PUBLIC_REGISTRATION_ENABLED must remain false while Stripe v1 awaits final authorization");
    }
  }

  if (enabled("BILLING_ENABLED")) {
    requireNames(errors, "billing gate is incomplete", [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PORTAL_CONFIGURATION_ID",
      ...CANONICAL_STRIPE_PRICES,
      "STRIPE_TRIAL_DAYS",
      "BILLING_PAST_DUE_GRACE_DAYS",
      "BILLING_ALLOWED_COUNTRIES",
      "EU_B2B_CROSS_BORDER_ENABLED",
    ]);
  }
}

export function validateRuntimeConfig(phase = "runtime") {
  const environment = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "development").trim().toLowerCase();
  const errors = [];

  if (["staging", "production"].includes(environment) && phase !== "build") {
    requireNames(errors, "runtime database configuration is incomplete", ["DATABASE_URL", "APP_BASE_URL"]);
  }

  if (environment === "production") {
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
  validateStripeBilling(errors);
  if (enabled("FISCAL_ENGINE_ENABLED") && process.env.FISCAL_MODE?.trim().toLowerCase() === "live") {
    requireNames(errors, "live fiscal gate is incomplete", ["FISCAL_PROVIDER", "FISCAL_CERTIFICATE_REF", "FISCAL_SOFTWARE_VERSION"]);
  }
  if (enabled("AI_ENABLED")) {
    requireNames(errors, "AI gate is incomplete", ["OPENAI_API_KEY", "OPENAI_PROJECT_ID", "OPENAI_DATA_PROFILE", "OPENAI_MODEL_FAST_SNAPSHOT", "OPENAI_MODEL_REASONING_SNAPSHOT", "AI_LIVE_APPROVAL"]);
    if (process.env.AI_PROVIDER_MODE?.trim().toLowerCase() !== "openai") errors.push("AI_PROVIDER_MODE must be openai when AI_ENABLED=true");
    if ((process.env.OPENAI_STORE || "false").trim().toLowerCase() !== "false") errors.push("OPENAI_STORE must remain false");
    if (environment === "production" && process.env.AI_LIVE_APPROVAL !== "approved-production") errors.push("production live AI requires approved-production");
  }
  if (environment === "production" && process.env.AI_PROVIDER_MODE?.trim().toLowerCase() === "fake") {
    errors.push("fake AI provider is forbidden in production runtime");
  }
  if (process.env.STORAGE_PROVIDER?.trim().toLowerCase() === "s3") {
    requireNames(errors, "S3 storage configuration is incomplete", ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = validateRuntimeConfig(process.argv[2] || "runtime");
  console.log(JSON.stringify(result));
}
