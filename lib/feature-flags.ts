import type { PrismaClient } from "@prisma/client";
import { publicConfig } from "./config/public";
import { readBoolean } from "./config/environment";

export const FEATURE_FLAG_KEYS = [
  "fiscal",
  "billing",
  "emailLive",
  "ai",
  "analytics",
  "publicIndexing",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlagSnapshot = Readonly<Record<FeatureFlagKey, boolean>>;

export function getEnvironmentFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlagSnapshot {
  return Object.freeze({
    fiscal: readBoolean(env.FISCAL_ENGINE_ENABLED, false),
    billing: readBoolean(env.BILLING_ENABLED, false),
    emailLive: readBoolean(env.EMAIL_LIVE_ENABLED, false),
    ai: readBoolean(env.AI_ENABLED, false),
    analytics: readBoolean(env.ANALYTICS_ENABLED, false),
    publicIndexing: readBoolean(env.PUBLIC_INDEXING_ENABLED, publicConfig.publicIndexingEnabled),
  });
}

export async function getCompanyFeatureFlags(
  prisma: Pick<PrismaClient, "featureFlag">,
  companyId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FeatureFlagSnapshot> {
  const defaults = getEnvironmentFeatureFlags(env);
  const overrides = await prisma.featureFlag.findMany({
    where: { companyId },
    select: { key: true, enabled: true },
  });
  const merged = { ...defaults };
  for (const override of overrides) {
    if ((FEATURE_FLAG_KEYS as readonly string[]).includes(override.key)) {
      merged[override.key as FeatureFlagKey] = override.enabled;
    }
  }
  return Object.freeze(merged);
}
