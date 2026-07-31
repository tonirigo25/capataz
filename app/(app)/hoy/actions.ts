"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { getEffectiveCapabilities, requireCapability } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import { getPersistedTodayRailRecommendation } from "@/lib/application/intelligence/today-recommendation";
import {
  acceptRecommendationAction as acceptRecommendationUseCase,
  dismissRecommendationAction as dismissRecommendationUseCase,
  executeRecommendationAction as executeRecommendationUseCase,
  snoozeRecommendationAction as snoozeRecommendationUseCase,
} from "@/lib/application/intelligence/recommendation-use-cases";

export async function acceptTodayRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/hoy/actions.ts#acceptTodayRecommendationAction" }, async () => {
    const auth = await assertTodayRecommendation(formData);
    const actionId = clean(formData.get("actionId"));
    if (actionId) await executeRecommendationUseCase(formData);
    else await acceptRecommendationUseCase(formData);
    await auditTodayAction(auth, formData, actionId ? "executed" : "accepted");
  });
}

export async function snoozeTodayRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/hoy/actions.ts#snoozeTodayRecommendationAction" }, async () => {
    const auth = await assertTodayRecommendation(formData);
    await snoozeRecommendationUseCase(formData);
    await auditTodayAction(auth, formData, "snoozed");
  });
}

export async function dismissTodayRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/hoy/actions.ts#dismissTodayRecommendationAction" }, async () => {
    const auth = await assertTodayRecommendation(formData);
    await dismissRecommendationUseCase(formData);
    await auditTodayAction(auth, formData, "dismissed");
  });
}

async function assertTodayRecommendation(formData: FormData) {
  const auth = await requireCapability("orqena.execute");
  const fingerprint = clean(formData.get("fingerprint"));
  if (!fingerprint) throw new Error("TODAY_RECOMMENDATION_REQUIRED");
  const recommendation = await prisma.businessRecommendation.findFirst({
    where: {
      fingerprint,
      companyId: auth.companyId,
      status: { in: ["active", "viewed"] },
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: new Date() } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
    select: { id: true },
  });
  if (!recommendation) throw new Error("TODAY_RECOMMENDATION_NOT_FOUND");
  const capabilities = await getEffectiveCapabilities(auth);
  const visible = await getPersistedTodayRailRecommendation(auth, capabilities);
  if (!visible || visible.fingerprint !== fingerprint) throw new Error("TODAY_RECOMMENDATION_NOT_VISIBLE");
  const actionId = clean(formData.get("actionId"));
  if (actionId && visible.preferredActionId !== actionId) throw new Error("TODAY_RECOMMENDATION_ACTION_INVALID");
  return { ...auth, recommendationId: recommendation.id, fingerprint };
}

async function auditTodayAction(
  auth: Awaited<ReturnType<typeof assertTodayRecommendation>>,
  formData: FormData,
  outcome: "accepted" | "executed" | "snoozed" | "dismissed",
) {
  await prisma.auditLog.create({
    data: {
      companyId: auth.companyId,
      userActorId: auth.userId,
      membershipId: auth.membershipId,
      actorType: "user",
      action: `today.recommendation.${outcome}`,
      targetType: "BusinessRecommendation",
      targetId: auth.recommendationId,
      metadata: {
        source: "hoy-context-rail",
        preset: outcome === "snoozed" ? clean(formData.get("preset")) : undefined,
      },
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "unknown",
    },
  });
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
