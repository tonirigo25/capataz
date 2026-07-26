"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createAutomationAction as createAutomationActionUseCase, publishAutomationAction as publishAutomationActionUseCase, runAutomationAction as runAutomationActionUseCase, toggleAutomationAction as toggleAutomationActionUseCase, duplicateAutomationAction as duplicateAutomationActionUseCase, newAutomationVersionAction as newAutomationVersionActionUseCase, archiveAutomationAction as archiveAutomationActionUseCase, disableAutomationAction as disableAutomationActionUseCase, saveDraftVersionAction as saveDraftVersionActionUseCase, saveAutomationScheduleAction as saveAutomationScheduleActionUseCase, retryRunNowAction as retryRunNowActionUseCase, cancelRunAction as cancelRunActionUseCase, confirmStepAction as confirmStepActionUseCase } from "@/lib/application/automation/automation-use-cases";

export async function createAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#createAutomationAction" }, () => createAutomationActionUseCase(data));
}

export async function publishAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#publishAutomationAction" }, () => publishAutomationActionUseCase(data));
}

export async function runAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#runAutomationAction" }, () => runAutomationActionUseCase(data));
}

export async function toggleAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#toggleAutomationAction" }, () => toggleAutomationActionUseCase(data));
}

export async function duplicateAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#duplicateAutomationAction" }, () => duplicateAutomationActionUseCase(data));
}

export async function newAutomationVersionAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#newAutomationVersionAction" }, () => newAutomationVersionActionUseCase(data));
}

export async function archiveAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#archiveAutomationAction" }, () => archiveAutomationActionUseCase(data));
}

export async function disableAutomationAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#disableAutomationAction" }, () => disableAutomationActionUseCase(data));
}

export async function saveDraftVersionAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#saveDraftVersionAction" }, () => saveDraftVersionActionUseCase(data));
}

export async function saveAutomationScheduleAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#saveAutomationScheduleAction" }, () => saveAutomationScheduleActionUseCase(data));
}

export async function retryRunNowAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#retryRunNowAction" }, () => retryRunNowActionUseCase(data));
}

export async function cancelRunAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#cancelRunAction" }, () => cancelRunActionUseCase(data));
}

export async function confirmStepAction(data: FormData) {
  return executeNextAction({ operation: "app/(app)/automatizaciones/actions.ts#confirmStepAction" }, () => confirmStepActionUseCase(data));
}
