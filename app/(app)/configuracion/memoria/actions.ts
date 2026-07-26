"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { changeMemory as changeMemoryUseCase } from "@/lib/application/company/memory-use-case";

export async function changeMemory(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/memoria/actions.ts#changeMemory" }, () => changeMemoryUseCase(formData));
}
