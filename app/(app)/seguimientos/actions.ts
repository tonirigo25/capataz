"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createFollowUpAction as createFollowUpActionUseCase, addAttemptAction as addAttemptActionUseCase, completeFollowUpAction as completeFollowUpActionUseCase, editFollowUpAction as editFollowUpActionUseCase, changeFollowUpStatusAction as changeFollowUpStatusActionUseCase, registerAttemptAction as registerAttemptActionUseCase, recordOutcomeAction as recordOutcomeActionUseCase, archiveFollowUpAction as archiveFollowUpActionUseCase } from "@/lib/application/operations/follow-up-use-cases";

export async function createFollowUpAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#createFollowUpAction" }, () => createFollowUpActionUseCase(data));
}

export async function addAttemptAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#addAttemptAction" }, () => addAttemptActionUseCase(data));
}

export async function completeFollowUpAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#completeFollowUpAction" }, () => completeFollowUpActionUseCase(data));
}

export async function editFollowUpAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#editFollowUpAction" }, () => editFollowUpActionUseCase(data));
}

export async function changeFollowUpStatusAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#changeFollowUpStatusAction" }, () => changeFollowUpStatusActionUseCase(data));
}

export async function registerAttemptAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#registerAttemptAction" }, () => registerAttemptActionUseCase(data));
}

export async function recordOutcomeAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#recordOutcomeAction" }, () => recordOutcomeActionUseCase(data));
}

export async function archiveFollowUpAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/seguimientos/actions.ts#archiveFollowUpAction" }, () => archiveFollowUpActionUseCase(data));
}
