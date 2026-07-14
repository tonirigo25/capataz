"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { requireCompanyContext } from "@/lib/auth/session";

export async function scheduleBudgetFollowUp(formData: FormData) {
  const clienteId = String(formData.get("clienteId") ?? "");
  const presupuestoId = String(formData.get("presupuestoId") ?? "");
  const obraId = String(formData.get("obraId") ?? "") || null;
  const canal = String(formData.get("canal") ?? "whatsapp") as ReminderChannel;
  const mensaje = String(formData.get("mensaje") ?? "");
  const fecha = String(formData.get("fechaProgramada") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";

  if (!clienteId || !presupuestoId || !mensaje || !fecha || !confirmado) {
    throw new Error("Faltan datos para programar el seguimiento.");
  }
  const { companyId } = await requireCompanyContext();
  const client = await prisma.client.findFirst({ where: { id: clienteId, companyId }, select: { id: true } });
  const budget = await prisma.budget.findFirst({ where: { id: presupuestoId, companyId }, select: { id: true } });
  if (!client || !budget || (obraId && !(await prisma.work.findFirst({ where: { id: obraId, companyId }, select: { id: true } })))) throw new Error("Entidad no disponible.");

  const existing = await prisma.reminder.findFirst({
    where: {
      companyId,
      clienteId,
      presupuestoId,
      tipo: "seguimiento_presupuesto",
      estado: { in: ["borrador", "pendiente_confirmacion"] }
    },
    orderBy: { fechaProgramada: "asc" }
  });

  const data = {
    companyId,
    clienteId,
    obraId,
    presupuestoId,
    tipo: "seguimiento_presupuesto" as const,
    canal,
    mensaje,
    fechaProgramada: new Date(fecha),
    estado: "programado" as const,
    requiereConfirmacion: false,
    confirmadoPorUsuario: true
  };

  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id, companyId },
      data
    });
  } else {
    await prisma.reminder.create({ data });
  }

  await prisma.client.updateMany({
    where: { id: clienteId, companyId },
    data: { ultimaInteraccion: new Date() }
  });
  await reevaluateProactiveAfterMutation({ companyId, entityType: "budget", entityId: presupuestoId, clientId: clienteId, workId: obraId, budgetId: presupuestoId, reason: "budget_followup_scheduled" });

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
  redirect("/recordatorios");
}

export async function archiveClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Falta el cliente.");
  const { companyId } = await requireCompanyContext();

  await prisma.client.updateMany({
    where: { id, companyId },
    data: { archivadoAt: new Date() }
  });
  await reevaluateProactiveAfterMutation({ companyId, entityType: "client", entityId: id, clientId: id, reason: "client_archived" });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/hoy");
  redirect("/clientes?archivo=archivados");
}

export async function restoreClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Falta el cliente.");
  const { companyId } = await requireCompanyContext();

  await prisma.client.updateMany({
    where: { id, companyId },
    data: { archivadoAt: null }
  });
  await reevaluateProactiveAfterMutation({ companyId, entityType: "client", entityId: id, clientId: id, reason: "client_restored" });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/hoy");
  redirect(`/clientes/${id}`);
}
