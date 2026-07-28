"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { confirmReminder as confirmReminderUseCase, cancelReminder as cancelReminderUseCase, markReminderDone as markReminderDoneUseCase } from "@/lib/application/operations/reminder-use-cases";

export async function confirmReminder(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recordatorios/actions.ts#confirmReminder" }, () => confirmReminderUseCase(formData));
}

export async function cancelReminder(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recordatorios/actions.ts#cancelReminder" }, () => cancelReminderUseCase(formData));
}

export async function markReminderDone(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/recordatorios/actions.ts#markReminderDone" }, () => markReminderDoneUseCase(formData));
}
