"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { requireCapability } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import {
  acceptRecommendationAction as acceptRecommendationUseCase,
  dismissRecommendationAction as dismissRecommendationUseCase,
  snoozeRecommendationAction as snoozeRecommendationUseCase,
} from "@/lib/application/intelligence/recommendation-use-cases";

export async function acceptTodayRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/hoy/actions.ts#acceptTodayRecommendationAction" }, async () => {
    const auth = await assertTodayRecommendation(formData);
    await acceptRecommendationUseCase(formData);
    await auditTodayAction(auth, formData, "accepted");
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
    where: { fingerprint, companyId: auth.companyId },
    select: { id: true },
  });
  if (!recommendation) throw new Error("TODAY_RECOMMENDATION_NOT_FOUND");
  return { ...auth, recommendationId: recommendation.id, fingerprint };
}

async function auditTodayAction(
  auth: Awaited<ReturnType<typeof assertTodayRecommendation>>,
  formData: FormData,
  outcome: "accepted" | "snoozed" | "dismissed",
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
