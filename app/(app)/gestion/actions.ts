"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { saveManualRecord as saveManualRecordUseCase } from "@/lib/application/operations/management-use-cases";

export async function saveManualRecord(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/gestion/actions.ts#saveManualRecord" }, () => saveManualRecordUseCase(formData));
}
