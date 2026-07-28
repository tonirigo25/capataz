import { z } from "zod";
import { readAppEnvironment, readBoolean, readCsv } from "./environment";

const optionalSecret = z.string().trim().min(1).optional();
const optionalUrl = z.string().trim().url().optional();

const rawSchema = z.object({
  APP_BASE_URL: z.string().trim().url().default("http://localhost:3000"),
  DATABASE_URL: optionalSecret,
  PRODUCT_NAME: z.string().trim().min(1).default("Orqena"),
  LEGAL_ENTITY_NAME: z.string().trim().min(1).optional(),
  LEGAL_TAX_ID: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().trim().email().optional(),
  EMAIL_REPLY_TO: z.string().trim().email().optional(),
  EMAIL_SENDING_DOMAIN: z.string().trim().min(1).optional(),
  EMAIL_DKIM_STATUS: z.enum(["verified"]).optional(),
  EMAIL_SPF_STATUS: z.enum(["verified"]).optional(),
  EMAIL_DMARC_POLICY: z.enum(["quarantine", "reject"]).optional(),
  EMAIL_TRACKING_ENABLED: z.enum(["false"]).default("false"),
  EMAIL_TOKEN_DERIVATION_SECRET: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_WEBHOOK_SECRET: optionalSecret,
  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  APP_ENCRYPTION_KEYS: optionalSecret,
  APP_ACTIVE_KEY_VERSION: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_PROJECT_ID: optionalSecret,
  OPENAI_DATA_PROFILE: z.string().trim().min(1).optional(),
  OPENAI_MODEL_FAST_SNAPSHOT: z.string().trim().min(1).optional(),
  OPENAI_MODEL_REASONING_SNAPSHOT: z.string().trim().min(1).optional(),
  OPENAI_STORE: z.enum(["false"]).default("false"),
  AI_PROVIDER_MODE: z.enum(["off", "fake", "openai"]).default("off"),
  AI_LIVE_APPROVAL: z.enum(["approved-local", "approved-staging", "approved-production"]).optional(),
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
  };

  const issues: Array<ReturnType<typeof safeIssue>> = [];
  if (environment === "production") {
    const baseUrl = new URL(config.APP_BASE_URL);
    if (baseUrl.protocol !== "https:" || /localhost|127\.0\.0\.1|railway\.app$/i.test(baseUrl.hostname)) {
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
  if (config.flags.billing && (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET || config.stripePriceKeys.length === 0)) {
    issues.push(safeIssue("BILLING_ENABLED", "requires Stripe credentials and price mappings"));
  }
  if (config.flags.fiscal && config.FISCAL_MODE === "live" && (!config.FISCAL_PROVIDER || !config.FISCAL_CERTIFICATE_REF || !config.FISCAL_SOFTWARE_VERSION)) {
    issues.push(safeIssue("FISCAL_ENGINE_ENABLED", "requires provider, certificate reference, and software version"));
  }
  if (config.flags.ai && config.AI_PROVIDER_MODE !== "openai") {
    issues.push(safeIssue("AI_PROVIDER_MODE", "must be openai when live AI is enabled"));
  }
  if (config.flags.ai && (!config.OPENAI_API_KEY || !config.OPENAI_PROJECT_ID || !config.OPENAI_DATA_PROFILE || !config.OPENAI_MODEL_FAST_SNAPSHOT || !config.OPENAI_MODEL_REASONING_SNAPSHOT || config.OPENAI_STORE !== "false" || !config.AI_LIVE_APPROVAL)) {
    issues.push(safeIssue("AI_ENABLED", "requires a scoped project key, approved data profile, pinned model snapshots, store=false and explicit environment approval"));
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
