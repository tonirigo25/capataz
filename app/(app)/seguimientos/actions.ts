"use server";
import { revalidatePath } from "next/cache";
import {
  createFollowUp,
  addFollowUpAttempt,
  recordFollowUpOutcome,
  editFollowUp,
  changeFollowUpStatus,
  archiveFollowUp,
} from "@/lib/followups/followup-engine";
import { prisma } from "@/lib/prisma";
export async function createFollowUpAction(data: FormData) {
  const title = String(data.get("title") ?? "").trim();
  if (!title) return;
  await createFollowUp({
    title,
    type: String(data.get("type") ?? "general"),
    nextActionAt: data.get("nextActionAt")
      ? new Date(String(data.get("nextActionAt")))
      : undefined,
  });
  revalidatePath("/seguimientos");
}
export async function addAttemptAction(data: FormData) {
  await addFollowUpAttempt(String(data.get("id")), {
    channel: "internal",
    summary: "Intento registrado desde el centro",
  });
  revalidatePath("/seguimientos");
}
export async function completeFollowUpAction(data: FormData) {
  await recordFollowUpOutcome(
    String(data.get("id")),
    "completed",
    "Completado desde el centro",
  );
  revalidatePath("/seguimientos");
}
const refresh = (id: string) => {
  revalidatePath("/seguimientos");
  revalidatePath(`/seguimientos/${id}`);
  revalidatePath("/hoy");
};
export async function editFollowUpAction(data: FormData) {
  const id = String(data.get("id"));
  await editFollowUp(id, {
    title: String(data.get("title") ?? ""),
    type: String(data.get("type") ?? "general"),
    priority: String(data.get("priority") ?? "medium") as never,
    nextActionAt: data.get("nextActionAt")
      ? new Date(String(data.get("nextActionAt")))
      : null,
    expectedOutcome: String(data.get("expectedOutcome") ?? "") || null,
  });
  refresh(id);
}
export async function changeFollowUpStatusAction(data: FormData) {
  const id = String(data.get("id"));
  await changeFollowUpStatus(
    id,
    String(data.get("status")) as never,
    String(data.get("summary") ?? "") || undefined,
  );
  refresh(id);
}
export async function registerAttemptAction(data: FormData) {
  const id = String(data.get("followUpId")),
    nextActionAt = data.get("nextActionAt")
      ? new Date(String(data.get("nextActionAt")))
      : undefined;
  await addFollowUpAttempt(id, {
    channel: String(data.get("channel") ?? "internal"),
    summary: String(data.get("summary") ?? "") || undefined,
    response: String(data.get("response") ?? "") || undefined,
    nextActionAt,
  });
  if (data.get("createReminder") === "true" && nextActionAt)
    await prisma.reminder.create({
      data: {
        tipo: "recordatorio_interno",
        mensaje: `Seguimiento: ${String(data.get("summary") ?? "próxima acción")}`,
        fechaProgramada: nextActionAt,
        requiereConfirmacion: false,
        confirmadoPorUsuario: true,
      },
    });
  refresh(id);
}
export async function recordOutcomeAction(data: FormData) {
  const id = String(data.get("followUpId"));
  await recordFollowUpOutcome(
    id,
    String(data.get("type") ?? "resolved"),
    String(data.get("summary") ?? "") || undefined,
    String(data.get("status") ?? "completed") as never,
  );
  refresh(id);
}
export async function archiveFollowUpAction(data: FormData) {
  const id = String(data.get("id"));
  await archiveFollowUp(id);
  refresh(id);
}
