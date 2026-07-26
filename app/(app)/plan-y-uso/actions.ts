"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { changeLocalPlan as changeLocalPlanUseCase } from "@/lib/application/billing/plan-use-case";

export async function changeLocalPlan(formData:FormData) {
  return executeNextAction({ operation: "app/(app)/plan-y-uso/actions.ts#changeLocalPlan" }, () => changeLocalPlanUseCase(formData));
}
