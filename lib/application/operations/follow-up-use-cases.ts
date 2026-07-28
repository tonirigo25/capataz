import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import {
  createFollowUp,
  addFollowUpAttempt,
  recordFollowUpOutcome,
  editFollowUp,
  changeFollowUpStatus,
  archiveFollowUp,
} from "@/lib/followups/followup-engine";
import { prisma } from "@/lib/prisma";
import {
  assertScopedEntityAccess,
  requireCapability,
} from "@/lib/commercial/authorization";
async function followUpGuard(data: FormData) {
  const auth = await requireCapability("followups.manage");
  const id = String(data.get("followUpId") ?? data.get("id") ?? "");
  if (id) {
    const item = await prisma.followUp.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, workId: true, clientId: true },
    });
    if (!item) throw new Error("FOLLOWUP_NOT_AVAILABLE");
    if (item.workId)
      await assertScopedEntityAccess(
        auth,
        "followups.manage",
        "Work",
        item.workId,
      );
    else if (item.clientId)
      await assertScopedEntityAccess(
        auth,
        "followups.manage",
        "Client",
        item.clientId,
      );
    else if (auth.scope !== "COMPANY")
      throw new Error("SCOPED_ENTITY_FORBIDDEN");
  }
  return auth;
}
export async function createFollowUpAction(data: FormData) {
  const auth = await requireCapability("followups.manage");
  const workId = String(data.get("workId") ?? "") || undefined;
  const clientId = String(data.get("clientId") ?? "") || undefined;
  if (!workId && !clientId && auth.scope !== "COMPANY")
    throw new Error("SCOPED_ENTITY_REQUIRED");
  if (auth.scope === "SELECTED_WORKS" && !workId)
    throw new Error("SCOPED_ENTITY_REQUIRED");
  if (workId) {
    await assertScopedEntityAccess(auth, "followups.manage", "Work", workId);
    const work = await prisma.work.findFirst({
      where: { id: workId, companyId: auth.companyId },
      select: { clienteId: true },
    });
    if (!work || (clientId && work.clienteId !== clientId))
      throw new Error("FOLLOWUP_RELATION_INVALID");
  } else if (clientId)
    await assertScopedEntityAccess(
      auth,
      "followups.manage",
      "Client",
      clientId,
    );
  const title = String(data.get("title") ?? "").trim();
  if (!title) return;
  await createFollowUp({
    companyId: auth.companyId,
    title,
    type: String(data.get("type") ?? "general"),
    workId,
    clientId,
    nextActionAt: data.get("nextActionAt")
      ? new Date(String(data.get("nextActionAt")))
      : undefined,
  });
  revalidatePath("/seguimientos");
}
export async function addAttemptAction(data: FormData) {
  await followUpGuard(data);
  await addFollowUpAttempt(String(data.get("id")), {
    channel: "internal",
    summary: "Intento registrado desde el centro",
  });
  revalidatePath("/seguimientos");
}
export async function completeFollowUpAction(data: FormData) {
  await followUpGuard(data);
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
  await followUpGuard(data);
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
  await followUpGuard(data);
  const id = String(data.get("id"));
  await changeFollowUpStatus(
    id,
    String(data.get("status")) as never,
    String(data.get("summary") ?? "") || undefined,
  );
  refresh(id);
}
export async function registerAttemptAction(data: FormData) {
  const auth = await followUpGuard(data);
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
        companyId: auth.companyId,
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
  await followUpGuard(data);
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
  await followUpGuard(data);
  const id = String(data.get("id"));
  await archiveFollowUp(id);
  refresh(id);
}
