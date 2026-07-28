"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { dismissSignalAction as dismissSignalActionUseCase, snoozeSignalAction as snoozeSignalActionUseCase, resolveSignalAction as resolveSignalActionUseCase } from "@/lib/application/operations/alert-use-cases";

export async function dismissSignalAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/alertas/actions.ts#dismissSignalAction" }, () => dismissSignalActionUseCase(formData));
}

export async function snoozeSignalAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/alertas/actions.ts#snoozeSignalAction" }, () => snoozeSignalActionUseCase(formData));
}

export async function resolveSignalAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/alertas/actions.ts#resolveSignalAction" }, () => resolveSignalActionUseCase(formData));
}
