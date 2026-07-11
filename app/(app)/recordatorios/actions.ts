"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";

export async function confirmReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;

  const reminder = await prisma.reminder.update({
    where: { id },
    data: {
      estado: "programado",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true
    }
  });
  await reevaluateProactiveAfterMutation({ entityType: "reminder", entityId: id, clientId: reminder.clienteId, workId: reminder.obraId, invoiceId: reminder.facturaId, budgetId: reminder.presupuestoId, reason: "reminder_confirmed" });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function cancelReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;

  const reminder = await prisma.reminder.update({
    where: { id },
    data: { estado: "cancelado" }
  });
  await reevaluateProactiveAfterMutation({ entityType: "reminder", entityId: id, clientId: reminder.clienteId, workId: reminder.obraId, invoiceId: reminder.facturaId, budgetId: reminder.presupuestoId, reason: "reminder_cancelled" });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function markReminderDone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;

  const reminder = await prisma.reminder.update({
    where: { id },
    data: {
      estado: "realizado",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true
    }
  });
  await reevaluateProactiveAfterMutation({ entityType: "reminder", entityId: id, clientId: reminder.clienteId, workId: reminder.obraId, invoiceId: reminder.facturaId, budgetId: reminder.presupuestoId, reason: "reminder_completed" });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}
