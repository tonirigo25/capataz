"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { updateWorkStatus as updateWorkStatusUseCase } from "@/lib/application/operations/work-use-cases";

export async function updateWorkStatus(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/obras/actions.ts#updateWorkStatus" }, () => updateWorkStatusUseCase(formData));
}
