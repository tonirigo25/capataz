"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { markRecommendationViewedAction as markRecommendationViewedActionUseCase, snoozeRecommendationAction as snoozeRecommendationActionUseCase, dismissRecommendationAction as dismissRecommendationActionUseCase, acceptRecommendationAction as acceptRecommendationActionUseCase, executeRecommendationAction as executeRecommendationActionUseCase } from "@/lib/application/intelligence/recommendation-use-cases";

export async function markRecommendationViewedAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recomendaciones/actions.ts#markRecommendationViewedAction" }, () => markRecommendationViewedActionUseCase(formData));
}

export async function snoozeRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recomendaciones/actions.ts#snoozeRecommendationAction" }, () => snoozeRecommendationActionUseCase(formData));
}

export async function dismissRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recomendaciones/actions.ts#dismissRecommendationAction" }, () => dismissRecommendationActionUseCase(formData));
}

export async function acceptRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recomendaciones/actions.ts#acceptRecommendationAction" }, () => acceptRecommendationActionUseCase(formData));
}

export async function executeRecommendationAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recomendaciones/actions.ts#executeRecommendationAction" }, () => executeRecommendationActionUseCase(formData));
}
