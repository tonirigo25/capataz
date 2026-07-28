"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { markNotificationReadAction as markNotificationReadActionUseCase, markAllNotificationsReadAction as markAllNotificationsReadActionUseCase } from "@/lib/application/operations/notification-use-cases";

export async function markNotificationReadAction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/notificaciones/actions.ts#markNotificationReadAction" }, () => markNotificationReadActionUseCase(formData));
}

export async function markAllNotificationsReadAction() {
  return executeNextAction({ operation: "app/(app)/notificaciones/actions.ts#markAllNotificationsReadAction" }, () => markAllNotificationsReadActionUseCase());
}
