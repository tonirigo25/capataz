"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import {
  acceptTodayRecommendationAction as acceptTodayRecommendationActionUseCase,
  dismissTodayRecommendationAction as dismissTodayRecommendationActionUseCase,
  snoozeTodayRecommendationAction as snoozeTodayRecommendationActionUseCase,
} from "@/lib/application/intelligence/today-action-use-cases";

export async function acceptTodayRecommendationAction(formData: FormData) {
  return executeNextAction(
    { operation: "app/(app)/hoy/actions.ts#acceptTodayRecommendationAction" },
    () => acceptTodayRecommendationActionUseCase(formData),
  );
}

export async function snoozeTodayRecommendationAction(formData: FormData) {
  return executeNextAction(
    { operation: "app/(app)/hoy/actions.ts#snoozeTodayRecommendationAction" },
    () => snoozeTodayRecommendationActionUseCase(formData),
  );
}

export async function dismissTodayRecommendationAction(formData: FormData) {
  return executeNextAction(
    { operation: "app/(app)/hoy/actions.ts#dismissTodayRecommendationAction" },
    () => dismissTodayRecommendationActionUseCase(formData),
  );
}
