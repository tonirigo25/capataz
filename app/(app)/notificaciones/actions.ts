"use server";

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

export async function markNotificationReadAction(formData: FormData) {
  const sourceKey = String(formData.get("sourceKey") ?? "");
  if (!sourceKey) return;
  await markNotificationRead(sourceKey);
  revalidatePath("/notificaciones");
}

export async function markAllNotificationsReadAction() {
  await markAllNotificationsRead();
  revalidatePath("/notificaciones");
}
