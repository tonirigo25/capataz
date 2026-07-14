"use server";

import { revalidatePath } from "next/cache";
import type { EventoAgendaEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { requireCompanyContext } from "@/lib/auth/session";
import { companyCore } from "@/lib/tenant/core";

export async function updateAgendaEventStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "") as EventoAgendaEstado;
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !estado || !confirmado) return;
  const { companyId } = await requireCompanyContext();
  const core = companyCore(prisma, companyId);
  if (!(await core.getAgendaEvent(id))) return;

  const event = await core.updateAgendaEvent(id, {
      estado,
      confirmadoPorUsuario: ["confirmado", "realizado"].includes(estado),
      requiereConfirmacion: false
  });
  await reevaluateProactiveAfterMutation({ companyId, entityType: "agenda", entityId: id, clientId: event.clienteId, workId: event.obraId, invoiceId: event.facturaId, budgetId: event.presupuestoId, reason: "agenda_status_updated" });

  revalidateAgenda();
}

export async function reprogramAgendaEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fechaInicio = String(formData.get("fechaInicio") ?? "");
  const fechaFin = String(formData.get("fechaFin") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !fechaInicio || !confirmado) return;
  const { companyId } = await requireCompanyContext();
  const core = companyCore(prisma, companyId);
  if (!(await core.getAgendaEvent(id))) return;

  const start = new Date(fechaInicio);
  const end = fechaFin ? new Date(fechaFin) : null;

  const event = await core.updateAgendaEvent(id, {
      fechaInicio: start,
      fechaFin: end,
      horaInicio: timeValue(start),
      horaFin: end ? timeValue(end) : null,
      estado: "reprogramado",
      confirmadoPorUsuario: true,
      requiereConfirmacion: false
  });
  await reevaluateProactiveAfterMutation({ companyId, entityType: "agenda", entityId: id, clientId: event.clienteId, workId: event.obraId, invoiceId: event.facturaId, budgetId: event.presupuestoId, reason: "agenda_reprogrammed" });

  revalidateAgenda();
}

function revalidateAgenda() {
  revalidatePath("/agenda");
  revalidatePath("/hoy");
  revalidatePath("/clientes");
  revalidatePath("/obras");
  revalidatePath("/capataz");
}

function timeValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
