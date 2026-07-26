"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { changeAiKillSwitchUseCase, reviewAiResultUseCase } from "@/lib/application/ai/governance-use-cases";

export async function reviewAiResult(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/ia/actions.ts#reviewAiResult" }, () => reviewAiResultUseCase(formData));
}

export async function changeAiKillSwitch(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/ia/actions.ts#changeAiKillSwitch" }, () => changeAiKillSwitchUseCase(formData));
}
