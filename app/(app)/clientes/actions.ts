"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { scheduleBudgetFollowUp as scheduleBudgetFollowUpUseCase, archiveClient as archiveClientUseCase, restoreClient as restoreClientUseCase } from "@/lib/application/operations/client-use-cases";

export async function scheduleBudgetFollowUp(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/clientes/actions.ts#scheduleBudgetFollowUp" }, () => scheduleBudgetFollowUpUseCase(formData));
}

export async function archiveClient(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/clientes/actions.ts#archiveClient" }, () => archiveClientUseCase(formData));
}

export async function restoreClient(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/clientes/actions.ts#restoreClient" }, () => restoreClientUseCase(formData));
}
