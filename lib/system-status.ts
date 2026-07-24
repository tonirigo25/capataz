import { getAppMode } from "@/lib/app-mode";
import { getCapatazAIStatus } from "@/lib/ai/capataz-ai";
import { getEmailProviderStatus } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const requiredPublicVars = [
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_APP_MODE",
  "NEXT_PUBLIC_WEB_BASE_URL"
];

const recommendedServerVars = ["CAPATAZ_MOBILE_SERVER_URL"];
const requiredAIProductionVars = ["OPENAI_API_KEY"];

export type SystemStatus = {
  app: "ok" | "degraded";
  environment: string;
  timestamp: string;
  appEnv: string;
  appMode: string;
  webBaseUrl: string;
  mobileServerConfigured: boolean;
  internalApiPath: string;
  ai: {
    openai: "ok" | "missing";
    model: string;
    fastModel: string;
    reasoningModel: string;
    reasoningEffort: string;
    fastTimeoutMs: number;
    reasoningTimeoutMs: number;
    required: boolean;
  };
  database: "ok" | "error";
  providers: {
    billing: "local";
    email: "local" | "resend" | "missing";
  };
  missingPublicVars: string[];
  missingServerVars: string[];
  missingRecommendedVars: string[];
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const database = await checkDatabase();
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "sin configurar";
  const missingPublicVars = requiredPublicVars.filter((key) => !process.env[key]);
  const aiStatus = getCapatazAIStatus();
  const openAIRequired = appEnv === "production";

  return {
    app: database === "ok" ? "ok" : "degraded",
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || appEnv,
    timestamp: new Date().toISOString(),
    appEnv,
    appMode: getAppMode(),
    webBaseUrl: process.env.NEXT_PUBLIC_WEB_BASE_URL || "sin configurar",
    mobileServerConfigured: Boolean(process.env.CAPATAZ_MOBILE_SERVER_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL),
    internalApiPath: "/api/status",
    ai: {
      openai: aiStatus.configured ? "ok" : "missing",
      model: aiStatus.model,
      fastModel: aiStatus.fastModel,
      reasoningModel: aiStatus.reasoningModel,
      reasoningEffort: aiStatus.reasoningEffort,
      fastTimeoutMs: aiStatus.fastTimeoutMs,
      reasoningTimeoutMs: aiStatus.reasoningTimeoutMs,
      required: openAIRequired
    },
    database,
    providers: {
      billing: "local",
      email: getEmailProviderStatus()
    },
    missingPublicVars,
    missingServerVars: openAIRequired ? requiredAIProductionVars.filter((key) => !process.env[key]) : [],
    missingRecommendedVars: recommendedServerVars.filter((key) => !process.env[key] && !process.env.NEXT_PUBLIC_WEB_BASE_URL)
  };
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}
