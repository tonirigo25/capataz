import { z } from "zod";
import { readAppEnvironment, readBoolean, readCsv } from "./environment";

const optionalSecret = z.string().trim().min(1).optional();
const optionalUrl = z.string().trim().url().optional();
const optionalIntegerString = z.string().trim().regex(/^\d+$/).optional();
const optionalDecimalString = z.string().trim().regex(/^\d+(?:\.\d{1,6})?$/).optional();
const mailbox = z.string().trim().refine((value) => {
  const address = value.match(/<([^<>]+)>$/)?.[1] ?? value;
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address);
}, "must be an email address or a display name with an email address").optional();

const canonicalStripePriceVariables = [
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_ANNUAL",
] as const;

const rawSchema = z.object({
  APP_BASE_URL: z.string().trim().url().default("http://localhost:3000"),
  DATABASE_URL: optionalSecret,
  PRODUCT_NAME: z.string().trim().min(1).default("Orqena"),
  LEGAL_ENTITY_NAME: z.string().trim().min(1).optional(),
  LEGAL_TAX_ID: z.string().trim().min(1).optional(),
  EMAIL_FROM: mailbox,
  EMAIL_REPLY_TO: z.string().trim().email().optional(),
  EMAIL_SENDING_DOMAIN: z.string().trim().min(1).optional(),
  EMAIL_DKIM_STATUS: z.enum(["verified"]).optional(),
  EMAIL_SPF_STATUS: z.enum(["verified"]).optional(),
  EMAIL_DMARC_POLICY: z.enum(["none", "quarantine", "reject"]).optional(),
  EMAIL_TRACKING_ENABLED: z.enum(["false"]).default("false"),
  EMAIL_TOKEN_DERIVATION_SECRET: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_WEBHOOK_SECRET: optionalSecret,
  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  STRIPE_PRICE_STARTER_MONTHLY: optionalSecret,
  STRIPE_PRICE_STARTER_ANNUAL: optionalSecret,
  STRIPE_PRICE_PRO_MONTHLY: optionalSecret,
  STRIPE_PRICE_PRO_ANNUAL: optionalSecret,
  STRIPE_PRICE_BUSINESS_MONTHLY: optionalSecret,
  STRIPE_PRICE_BUSINESS_ANNUAL: optionalSecret,
  STRIPE_PORTAL_CONFIGURATION_ID: optionalSecret,
  STRIPE_PRICE_STARTER: optionalSecret,
  STRIPE_PRICE_PRO: optionalSecret,
  STRIPE_PRICE_BUSINESS: optionalSecret,
  STRIPE_TRIAL_DAYS: optionalIntegerString.default("3"),
  BILLING_PAST_DUE_GRACE_DAYS: optionalIntegerString.default("3"),
  BILLING_ALLOWED_COUNTRIES: z.string().trim().min(1).default("ES"),
  EU_B2B_CROSS_BORDER_ENABLED: z.enum(["true", "false"]).default("false"),
  APP_ENCRYPTION_KEYS: optionalSecret,
  APP_ACTIVE_KEY_VERSION: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_PROJECT_ID: optionalSecret,
  OPENAI_DATA_PROFILE: z.string().trim().min(1).optional(),
  OPENAI_MODEL_FAST: z.string().trim().min(1).optional(),
  OPENAI_MODEL_REASONING: z.string().trim().min(1).optional(),
  OPENAI_MODEL_TRANSCRIPTION: z.string().trim().min(1).optional(),
  OPENAI_MODEL_FAST_SNAPSHOT: z.string().trim().min(1).optional(),
  OPENAI_MODEL_REASONING_SNAPSHOT: z.string().trim().min(1).optional(),
  OPENAI_MODEL_TRANSCRIPTION_SNAPSHOT: z.string().trim().min(1).optional(),
  OPENAI_STORE: z.enum(["false"]).default("false"),
  AI_PROVIDER_MODE: z.enum(["off", "fake", "openai"]).default("off"),
  AI_PROVIDER_CONFIGURED: z.enum(["true", "false"]).default("false"),
  AI_GLOBAL_ENABLED: z.enum(["true", "false"]).default("false"),
  AI_LIVE_APPROVAL: z.enum(["approved-local", "approved-review", "approved-staging", "approved-production"]).optional(),
  AI_COMPANY_ALLOWLIST: z.string().trim().optional(),
  AI_GLOBAL_MONTHLY_BUDGET_EUR: optionalDecimalString,
  AI_DEFAULT_COMPANY_MONTHLY_BUDGET_EUR: optionalDecimalString,
  AI_DEFAULT_USER_DAILY_REQUEST_LIMIT: optionalIntegerString,
  AI_MAX_INPUT_TOKENS_PER_REQUEST: optionalIntegerString,
  AI_MAX_OUTPUT_TOKENS_PER_REQUEST: optionalIntegerString,
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().trim().min(1).optional(),
  S3_BUCKET: z.string().trim().min(1).optional(),
  S3_ACCESS_KEY_ID: optionalSecret,
  S3_SECRET_ACCESS_KEY: optionalSecret,
  STORAGE_SIGNING_SECRET: optionalSecret,
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  ERROR_TRACKING_DSN: optionalUrl,
  JOB_RUNNER_SECRET: optionalSecret,
  FISCAL_MODE: z.enum(["off", "sandbox", "live"]).default("off"),
  FISCAL_PROVIDER: z.string().trim().min(1).optional(),
  FISCAL_CERTIFICATE_REF: z.string().trim().min(1).optional(),
  FISCAL_SOFTWARE_VERSION: z.string().trim().min(1).optional(),
  ANALYTICS_PROVIDER: z.string().trim().min(1).optional(),
});

export type ConfigValidationPhase = "build" | "ready" | "runtime";

export type ServerConfig = ReturnType<typeof parseServerConfig>;

function safeIssue(path: string, message: string) {
  return { path: [path], message, code: z.ZodIssueCode.custom } as const;
}

function expectedAiLiveApproval(env: NodeJS.ProcessEnv): string {
  const name = (env.NEXT_PUBLIC_APP_ENV ?? env.APP_ENV ?? "development").trim().toLowerCase();
  if (name === "production") return "approved-production";
  if (name === "staging") return "approved-staging";
  if (name === "review" || name === "preview") return "approved-review";
  return "approved-local";
}

export function parseServerConfig(
  env: NodeJS.ProcessEnv = process.env,
  phase: ConfigValidationPhase = "runtime",
) {
  const environment = readAppEnvironment(env.NEXT_PUBLIC_APP_ENV ?? env.APP_ENV);
  const parsed = rawSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }

  const config = {
    environment,
    phase,
    ...parsed.data,
    flags: {
      fiscal: readBoolean(env.FISCAL_ENGINE_ENABLED),
      billing: readBoolean(env.BILLING_ENABLED),
      emailLive: readBoolean(env.EMAIL_LIVE_ENABLED),
      ai: readBoolean(env.AI_ENABLED),
      analytics: readBoolean(env.ANALYTICS_ENABLED),
      publicIndexing: readBoolean(env.PUBLIC_INDEXING_ENABLED),
      publicRegistration: readBoolean(env.ORQENA_PUBLIC_REGISTRATION_ENABLED),
    },
    stripePriceKeys: readCsv(env.STRIPE_PRICE_KEYS),
    stripePrices: {
      starter: {
        monthly: parsed.data.STRIPE_PRICE_STARTER_MONTHLY,
        annual: parsed.data.STRIPE_PRICE_STARTER_ANNUAL,
      },
      pro: {
        monthly: parsed.data.STRIPE_PRICE_PRO_MONTHLY,
        annual: parsed.data.STRIPE_PRICE_PRO_ANNUAL,
      },
      business: {
        monthly: parsed.data.STRIPE_PRICE_BUSINESS_MONTHLY,
        annual: parsed.data.STRIPE_PRICE_BUSINESS_ANNUAL,
      },
    },
    stripeTrialDays: Number(parsed.data.STRIPE_TRIAL_DAYS),
    billingPastDueGraceDays: Number(parsed.data.BILLING_PAST_DUE_GRACE_DAYS),
    billingAllowedCountries: readCsv(parsed.data.BILLING_ALLOWED_COUNTRIES).map((country) => country.toUpperCase()),
    euB2bCrossBorderEnabled: readBoolean(parsed.data.EU_B2B_CROSS_BORDER_ENABLED),
    aiCompanyAllowlist: readCsv(parsed.data.AI_COMPANY_ALLOWLIST),
    aiGlobalMonthlyBudgetEur: parsed.data.AI_GLOBAL_MONTHLY_BUDGET_EUR === undefined ? undefined : Number(parsed.data.AI_GLOBAL_MONTHLY_BUDGET_EUR),
    aiDefaultCompanyMonthlyBudgetEur: parsed.data.AI_DEFAULT_COMPANY_MONTHLY_BUDGET_EUR === undefined ? undefined : Number(parsed.data.AI_DEFAULT_COMPANY_MONTHLY_BUDGET_EUR),
    aiUserDailyRequestLimit: parsed.data.AI_DEFAULT_USER_DAILY_REQUEST_LIMIT === undefined ? undefined : Number(parsed.data.AI_DEFAULT_USER_DAILY_REQUEST_LIMIT),
    aiMaxInputTokens: parsed.data.AI_MAX_INPUT_TOKENS_PER_REQUEST === undefined ? undefined : Number(parsed.data.AI_MAX_INPUT_TOKENS_PER_REQUEST),
    aiMaxOutputTokens: parsed.data.AI_MAX_OUTPUT_TOKENS_PER_REQUEST === undefined ? undefined : Number(parsed.data.AI_MAX_OUTPUT_TOKENS_PER_REQUEST),
  };

  const issues: Array<ReturnType<typeof safeIssue>> = [];
  const configuredCanonicalPrices = canonicalStripePriceVariables.filter((name) => Boolean(config[name]));
  const hasCanonicalStripePrices = configuredCanonicalPrices.length > 0;
  if (hasCanonicalStripePrices && configuredCanonicalPrices.length !== canonicalStripePriceVariables.length) {
    issues.push(safeIssue("STRIPE_PRICE_STARTER_MONTHLY", "all six canonical plan and interval prices must be configured together"));
  }
  if (
    configuredCanonicalPrices.length === canonicalStripePriceVariables.length
    && new Set(configuredCanonicalPrices.map((name) => config[name])).size !== canonicalStripePriceVariables.length
  ) {
    issues.push(safeIssue("STRIPE_PRICE_STARTER_MONTHLY", "each canonical plan and interval must resolve to one unique Stripe Price"));
  }
  if (hasCanonicalStripePrices && config.stripePriceKeys.length > 0) {
    issues.push(safeIssue("STRIPE_PRICE_KEYS", "deprecated aggregate price source conflicts with canonical plan and interval prices"));
  }
  for (const [legacy, canonical] of [
    ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_STARTER_MONTHLY"],
    ["STRIPE_PRICE_PRO", "STRIPE_PRICE_PRO_MONTHLY"],
    ["STRIPE_PRICE_BUSINESS", "STRIPE_PRICE_BUSINESS_MONTHLY"],
  ] as const) {
    if (config[legacy] && config[canonical] && config[legacy] !== config[canonical]) {
      issues.push(safeIssue(legacy, `deprecated alias conflicts with ${canonical}`));
    }
  }

  const validatesStripeReadiness = config.flags.billing || hasCanonicalStripePrices;
  if (validatesStripeReadiness) {
    if (config.stripeTrialDays !== 3) issues.push(safeIssue("STRIPE_TRIAL_DAYS", "must be 3 for the approved Capataz v1 trial"));
    if (config.billingPastDueGraceDays !== 3) issues.push(safeIssue("BILLING_PAST_DUE_GRACE_DAYS", "must be 3 for the approved Capataz v1 grace period"));
    if (config.billingAllowedCountries.length !== 1 || config.billingAllowedCountries[0] !== "ES") {
      issues.push(safeIssue("BILLING_ALLOWED_COUNTRIES", "must remain ES until cross-border authorization"));
    }
    if (config.euB2bCrossBorderEnabled) {
      issues.push(safeIssue("EU_B2B_CROSS_BORDER_ENABLED", "must remain false until ROI/VIES and fiscal gates are approved"));
    }
    if (config.flags.publicRegistration) {
      issues.push(safeIssue("ORQENA_PUBLIC_REGISTRATION_ENABLED", "must remain false while Stripe v1 awaits final authorization"));
    }
  }
  if (environment === "production") {
    const baseUrl = new URL(config.APP_BASE_URL);
    if (baseUrl.origin !== "https://app.orqenatech.com") {
      issues.push(safeIssue("APP_BASE_URL", "must be the approved HTTPS production domain"));
    }
    if (phase !== "build" && !config.DATABASE_URL) issues.push(safeIssue("DATABASE_URL", "is required"));
    if (config.STORAGE_PROVIDER === "local") issues.push(safeIssue("STORAGE_PROVIDER", "must be private object storage"));
    if (phase !== "build" && (!config.APP_ENCRYPTION_KEYS || !config.APP_ACTIVE_KEY_VERSION)) issues.push(safeIssue("APP_ENCRYPTION_KEYS", "and active key version are required"));
    if (phase !== "build" && !config.JOB_RUNNER_SECRET) issues.push(safeIssue("JOB_RUNNER_SECRET", "is required"));
  }
  if (config.flags.emailLive && (!config.EMAIL_FROM || !config.EMAIL_REPLY_TO || !config.EMAIL_SENDING_DOMAIN || !config.RESEND_API_KEY || !config.RESEND_WEBHOOK_SECRET || !config.EMAIL_DKIM_STATUS || !config.EMAIL_SPF_STATUS || !config.EMAIL_DMARC_POLICY || !config.EMAIL_TOKEN_DERIVATION_SECRET)) {
    issues.push(safeIssue("EMAIL_LIVE_ENABLED", "requires verified sender domain, reply-to, webhook, DMARC and token derivation secret"));
  }
  if (config.flags.emailLive && config.EMAIL_FROM && config.EMAIL_SENDING_DOMAIN) {
    const address = config.EMAIL_FROM.match(/<([^<>]+)>$/)?.[1] ?? config.EMAIL_FROM;
    if (!address.toLowerCase().endsWith(`@${config.EMAIL_SENDING_DOMAIN.toLowerCase()}`)) {
      issues.push(safeIssue("EMAIL_FROM", "must use the verified sending domain"));
    }
  }
  if (config.flags.billing && (
    !config.STRIPE_SECRET_KEY
    || !config.STRIPE_WEBHOOK_SECRET
    || !config.STRIPE_PORTAL_CONFIGURATION_ID
    || configuredCanonicalPrices.length !== canonicalStripePriceVariables.length
  )) {
    issues.push(safeIssue("BILLING_ENABLED", "requires Stripe credentials, Portal configuration, and all six canonical plan and interval prices"));
  }
  if (config.flags.fiscal && config.FISCAL_MODE === "live" && (!config.FISCAL_PROVIDER || !config.FISCAL_CERTIFICATE_REF || !config.FISCAL_SOFTWARE_VERSION)) {
    issues.push(safeIssue("FISCAL_ENGINE_ENABLED", "requires provider, certificate reference, and software version"));
  }
  if (config.flags.ai && config.AI_PROVIDER_CONFIGURED !== "true") {
    issues.push(safeIssue("AI_PROVIDER_CONFIGURED", "must be true when AI is enabled"));
  }
  if (config.flags.ai && config.AI_GLOBAL_ENABLED !== "true") {
    issues.push(safeIssue("AI_GLOBAL_ENABLED", "must be true when AI is enabled"));
  }
  if (config.AI_GLOBAL_ENABLED === "true" && !config.flags.ai) {
    issues.push(safeIssue("AI_ENABLED", "must be true when AI_GLOBAL_ENABLED is true"));
  }
  if (config.flags.ai && config.AI_PROVIDER_MODE === "off") {
    issues.push(safeIssue("AI_PROVIDER_MODE", "must be fake or openai when AI is enabled"));
  }
  if (config.flags.ai && (!config.AI_GLOBAL_MONTHLY_BUDGET_EUR || !config.AI_DEFAULT_COMPANY_MONTHLY_BUDGET_EUR || !config.AI_DEFAULT_USER_DAILY_REQUEST_LIMIT || !config.AI_MAX_INPUT_TOKENS_PER_REQUEST || !config.AI_MAX_OUTPUT_TOKENS_PER_REQUEST)) {
    issues.push(safeIssue("AI_ENABLED", "requires explicit global, company, daily request and token limits"));
  }
  if (config.flags.ai && ((config.aiGlobalMonthlyBudgetEur ?? Infinity) > 25 || (config.aiDefaultCompanyMonthlyBudgetEur ?? Infinity) > 5 || (config.aiUserDailyRequestLimit ?? Infinity) > 50 || (config.aiMaxInputTokens ?? Infinity) > 4096 || (config.aiMaxOutputTokens ?? Infinity) > 1024)) {
    issues.push(safeIssue("AI_GLOBAL_MONTHLY_BUDGET_EUR", "exceeds the authorized initial AI limits"));
  }
  if (config.AI_PROVIDER_CONFIGURED === "true" && config.AI_PROVIDER_MODE === "openai" && (!config.OPENAI_API_KEY || !config.OPENAI_DATA_PROFILE || !config.OPENAI_MODEL_FAST || !config.OPENAI_MODEL_REASONING || !config.OPENAI_MODEL_TRANSCRIPTION || !config.OPENAI_MODEL_FAST_SNAPSHOT || !config.OPENAI_MODEL_REASONING_SNAPSHOT || !config.OPENAI_MODEL_TRANSCRIPTION_SNAPSHOT || config.OPENAI_STORE !== "false" || !config.AI_LIVE_APPROVAL)) {
    issues.push(safeIssue("AI_ENABLED", "live AI requires an environment-scoped key, approved data profile, pinned models, store=false and explicit environment approval"));
  }
  if (config.flags.ai && config.AI_PROVIDER_MODE === "openai" && config.AI_LIVE_APPROVAL !== expectedAiLiveApproval(env)) {
    issues.push(safeIssue("AI_LIVE_APPROVAL", "must match the current application environment"));
  }
  if (environment === "production" && config.flags.ai && (config.aiCompanyAllowlist.length === 0 || config.aiCompanyAllowlist.includes("*"))) {
    issues.push(safeIssue("AI_COMPANY_ALLOWLIST", "production AI requires an explicit company allowlist"));
  }
  if (environment === "production" && config.flags.ai && config.AI_LIVE_APPROVAL !== "approved-production") {
    issues.push(safeIssue("AI_LIVE_APPROVAL", "must explicitly approve production"));
  }
  if (environment === "production" && config.AI_PROVIDER_MODE === "fake") {
    issues.push(safeIssue("AI_PROVIDER_MODE", "fake mode is forbidden in production runtime"));
  }
  if (config.STORAGE_PROVIDER === "s3" && (!config.S3_REGION || !config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY || !config.STORAGE_SIGNING_SECRET)) {
    issues.push(safeIssue("STORAGE_PROVIDER", "requires complete S3 configuration"));
  }
  if (issues.length > 0) {
    throw new Error(`Invalid server configuration: ${issues.map((issue) => issue.path[0]).join(", ")}`);
  }

  return Object.freeze(config);
}

let cachedServerConfig: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  cachedServerConfig ??= parseServerConfig();
  return cachedServerConfig;
}
