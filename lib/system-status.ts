import { getAppMode } from "@/lib/app-mode";
import { prisma } from "@/lib/prisma";

const requiredPublicVars = [
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_APP_MODE",
  "NEXT_PUBLIC_WEB_BASE_URL"
];

const recommendedServerVars = ["CAPATAZ_MOBILE_SERVER_URL"];

export type SystemStatus = {
  app: "ok" | "degraded";
  environment: string;
  timestamp: string;
  appEnv: string;
  appMode: string;
  webBaseUrl: string;
  mobileServerConfigured: boolean;
  internalApiPath: string;
  database: "ok" | "error";
  missingPublicVars: string[];
  missingRecommendedVars: string[];
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const database = await checkDatabase();
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "sin configurar";
  const missingPublicVars = requiredPublicVars.filter((key) => !process.env[key]);

  return {
    app: database === "ok" ? "ok" : "degraded",
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || appEnv,
    timestamp: new Date().toISOString(),
    appEnv,
    appMode: getAppMode(),
    webBaseUrl: process.env.NEXT_PUBLIC_WEB_BASE_URL || "sin configurar",
    mobileServerConfigured: Boolean(process.env.CAPATAZ_MOBILE_SERVER_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL),
    internalApiPath: "/api/status",
    database,
    missingPublicVars,
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
