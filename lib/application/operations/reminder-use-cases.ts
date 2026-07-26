import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { assertScopedEntityAccess, requireCapability } from "@/lib/commercial/authorization";
import { companyCore } from "@/lib/tenant/core";

async function ownedReminder(id: string) {
  const auth = await requireCapability("agenda.manage");
  const { companyId } = auth;
  const core = companyCore(prisma, companyId);
  const reminder = await core.getReminder(id);
  if (reminder?.obraId) await assertScopedEntityAccess(auth, "agenda.manage", "Work", reminder.obraId);
  else if (reminder?.clienteId) await assertScopedEntityAccess(auth, "agenda.manage", "Client", reminder.clienteId);
  else if (reminder && auth.scope !== "COMPANY") throw new Error("SCOPED_ENTITY_FORBIDDEN");
  return { companyId, core, reminder };
}

export async function confirmReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;
  const owned = await ownedReminder(id);
  if (!owned.reminder) return;

  const reminder = await owned.core.updateReminder(id, {
      estado: "programado",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true
  });
  await reevaluateProactiveAfterMutation({ companyId: owned.companyId, entityType: "reminder", entityId: id, clientId: reminder.clienteId, workId: reminder.obraId, invoiceId: reminder.facturaId, budgetId: reminder.presupuestoId, reason: "reminder_confirmed" });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function cancelReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;
  const owned = await ownedReminder(id);
  if (!owned.reminder) return;

  const reminder = await owned.core.updateReminder(id, { estado: "cancelado" });
  await reevaluateProactiveAfterMutation({ companyId: owned.companyId, entityType: "reminder", entityId: id, clientId: reminder.clienteId, workId: reminder.obraId, invoiceId: reminder.facturaId, budgetId: reminder.presupuestoId, reason: "reminder_cancelled" });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function markReminderDone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;
  const owned = await ownedReminder(id);
  if (!owned.reminder) return;

  const reminder = await owned.core.updateReminder(id, {
      estado: "realizado",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true
  });
  await reevaluateProactiveAfterMutation({ companyId: owned.companyId, entityType: "reminder", entityId: id, clientId: reminder.clienteId, workId: reminder.obraId, invoiceId: reminder.facturaId, budgetId: reminder.presupuestoId, reason: "reminder_completed" });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}
