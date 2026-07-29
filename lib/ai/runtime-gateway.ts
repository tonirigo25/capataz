import { AiGatewayError, type AiTransport, type GovernedAiRequest } from "@/lib/ai/contracts";
import { FakeGovernedAiTransport } from "@/lib/ai/fake-transport";
import { executeGovernedAiRequest, type AiGovernanceStore, type GovernedAiDependencies } from "@/lib/ai/governed-gateway";
import { OpenAiResponsesTransport } from "@/lib/ai/openai-transport";
import { PrismaAiGovernanceStore } from "@/lib/ai/prisma-store";
import { prisma } from "@/lib/prisma";

export type RuntimeAiOptions = {
  environment?: NodeJS.ProcessEnv;
  store?: AiGovernanceStore;
  transport?: AiTransport;
  dependencies?: Partial<Pick<GovernedAiDependencies, "now" | "monotonicNow" | "sleep" | "random">>;
};

function expectedLiveApproval(environment: NodeJS.ProcessEnv): string {
  const name = (environment.NEXT_PUBLIC_APP_ENV ?? environment.APP_ENV ?? "development").trim().toLowerCase();
  if (name === "production") return "approved-production";
  if (name === "staging") return "approved-staging";
  if (name === "review" || name === "preview") return "approved-review";
  return "approved-local";
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function positiveNumber(value: string | undefined, fallback: number, code: string): number {
  const parsed = value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new AiGatewayError(code);
  return parsed;
}

function positiveInteger(value: string | undefined, fallback: number, code: string): number {
  const parsed = positiveNumber(value, fallback, code);
  if (!Number.isInteger(parsed)) throw new AiGatewayError(code);
  return parsed;
}

function capped(value: number, maximum: number, code: string): number {
  if (value > maximum) throw new AiGatewayError(code);
  return value;
}

export function readRuntimeAiControl(environment: NodeJS.ProcessEnv = process.env) {
  const providerMode = (environment.AI_PROVIDER_MODE?.trim().toLowerCase() || "off") as "off" | "fake" | "openai";
  if (!(["off", "fake", "openai"] as const).includes(providerMode)) throw new AiGatewayError("AI_PROVIDER_MODE_INVALID");
  const companyAllowlist = [...new Set((environment.AI_COMPANY_ALLOWLIST ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
  const fastModel = environment.OPENAI_MODEL_FAST?.trim() || "gpt-5-mini";
  const reasoningModel = environment.OPENAI_MODEL_REASONING?.trim() || "gpt-5.1";
  const transcriptionModel = environment.OPENAI_MODEL_TRANSCRIPTION?.trim()
    || environment.OPENAI_TRANSCRIPTION_MODEL?.trim()
    || "gpt-4o-mini-transcribe";
  const transcriptionSnapshot = environment.OPENAI_MODEL_TRANSCRIPTION_SNAPSHOT?.trim() || "";
  const providerConfigured = enabled(environment.AI_PROVIDER_CONFIGURED);
  const globalEnabled = enabled(environment.AI_ENABLED) && enabled(environment.AI_GLOBAL_ENABLED) && providerConfigured;
  const liveConfigurationComplete = providerMode === "openai"
    && Boolean(environment.OPENAI_API_KEY?.trim())
    && Boolean(environment.OPENAI_DATA_PROFILE?.trim())
    && Boolean(environment.OPENAI_MODEL_FAST_SNAPSHOT?.trim())
    && Boolean(environment.OPENAI_MODEL_REASONING_SNAPSHOT?.trim())
    && Boolean(transcriptionSnapshot)
    && (environment.OPENAI_STORE?.trim().toLowerCase() || "false") === "false"
    && environment.AI_LIVE_APPROVAL?.trim() === expectedLiveApproval(environment);
  return Object.freeze({
    providerMode,
    providerConfigured,
    globalEnabled,
    companyAllowlist,
    globalMonthlyBudgetEur: capped(positiveNumber(environment.AI_GLOBAL_MONTHLY_BUDGET_EUR, 25, "AI_GLOBAL_BUDGET_INVALID"), 25, "AI_GLOBAL_BUDGET_EXCEEDS_AUTHORIZED_CAP"),
    defaultCompanyMonthlyBudgetEur: capped(positiveNumber(environment.AI_DEFAULT_COMPANY_MONTHLY_BUDGET_EUR, 5, "AI_COMPANY_BUDGET_INVALID"), 5, "AI_COMPANY_BUDGET_EXCEEDS_AUTHORIZED_CAP"),
    userDailyRequestLimit: capped(positiveInteger(environment.AI_DEFAULT_USER_DAILY_REQUEST_LIMIT, 50, "AI_USER_DAILY_LIMIT_INVALID"), 50, "AI_USER_DAILY_LIMIT_EXCEEDS_AUTHORIZED_CAP"),
    maxInputTokens: capped(positiveInteger(environment.AI_MAX_INPUT_TOKENS_PER_REQUEST, 4096, "AI_INPUT_LIMIT_INVALID"), 4096, "AI_INPUT_LIMIT_EXCEEDS_AUTHORIZED_CAP"),
    maxOutputTokens: capped(positiveInteger(environment.AI_MAX_OUTPUT_TOKENS_PER_REQUEST, 1024, "AI_OUTPUT_LIMIT_INVALID"), 1024, "AI_OUTPUT_LIMIT_EXCEEDS_AUTHORIZED_CAP"),
    fastModel,
    reasoningModel,
    transcriptionModel,
    transcriptionSnapshot,
    liveConfigurationComplete,
  });
}

export function runtimeAiStatus(environment: NodeJS.ProcessEnv = process.env) {
  const control = readRuntimeAiControl(environment);
  return {
    configured: control.providerConfigured && control.providerMode !== "off",
    enabled: control.globalEnabled,
    providerMode: control.providerMode,
    allowlistedCompanyCount: control.companyAllowlist.length,
    globalMonthlyBudgetEur: control.globalMonthlyBudgetEur,
    defaultCompanyMonthlyBudgetEur: control.defaultCompanyMonthlyBudgetEur,
    userDailyRequestLimit: control.userDailyRequestLimit,
    maxInputTokens: control.maxInputTokens,
    maxOutputTokens: control.maxOutputTokens,
    fastModel: control.fastModel,
    reasoningModel: control.reasoningModel,
    transcriptionModel: control.transcriptionModel,
    liveConfigurationComplete: control.liveConfigurationComplete,
  };
}

export async function executeRuntimeAiRequest(request: GovernedAiRequest, options: RuntimeAiOptions = {}) {
  const environment = options.environment ?? process.env;
  const control = readRuntimeAiControl(environment);
  if (!control.globalEnabled) throw new AiGatewayError("AI_DISABLED_FAIL_CLOSED");
  if (!control.companyAllowlist.includes(request.companyId)) throw new AiGatewayError("AI_COMPANY_NOT_ALLOWLISTED");
  const transport = options.transport ?? (control.providerMode === "openai"
    ? new OpenAiResponsesTransport({
        apiKey: environment.OPENAI_API_KEY ?? "",
        baseUrl: environment.OPENAI_BASE_URL,
        projectId: environment.OPENAI_PROJECT_ID,
      })
    : control.providerMode === "fake"
      ? new FakeGovernedAiTransport()
      : undefined);
  if (!transport) throw new AiGatewayError("AI_PROVIDER_DISABLED");
  return executeGovernedAiRequest(request, {
    store: options.store ?? new PrismaAiGovernanceStore(prisma),
    transport,
    environment: environment.NEXT_PUBLIC_APP_ENV?.trim() || environment.APP_ENV?.trim() || "unknown",
    globalEnabled: control.globalEnabled,
    companyAllowlist: control.companyAllowlist,
    globalMonthlyBudgetEur: control.globalMonthlyBudgetEur,
    userDailyRequestLimit: control.userDailyRequestLimit,
    companyMonthlyBudgetEur: control.defaultCompanyMonthlyBudgetEur,
    maxInputTokensPerRequest: control.maxInputTokens,
    maxOutputTokensPerRequest: control.maxOutputTokens,
    liveConfigurationComplete: transport.mode === "fake" || control.liveConfigurationComplete,
    modelEnvironment: environment,
    ...options.dependencies,
  });
}
