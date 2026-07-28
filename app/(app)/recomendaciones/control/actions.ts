"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { runProactiveEvaluationAction as runProactiveEvaluationActionUseCase } from "@/lib/application/intelligence/proactive-control-use-case";

export async function runProactiveEvaluationAction() {
  return executeNextAction({ operation: "app/(app)/recomendaciones/control/actions.ts#runProactiveEvaluationAction" }, () => runProactiveEvaluationActionUseCase());
}
