"use server";

import { revalidatePath } from "next/cache";
import type { EventoAgendaEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function updateAgendaEventStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "") as EventoAgendaEstado;
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !estado || !confirmado) return;

  await prisma.eventoAgenda.update({
    where: { id },
    data: {
      estado,
      confirmadoPorUsuario: ["confirmado", "realizado"].includes(estado),
      requiereConfirmacion: false
    }
  });

  revalidateAgenda();
}

export async function reprogramAgendaEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fechaInicio = String(formData.get("fechaInicio") ?? "");
  const fechaFin = String(formData.get("fechaFin") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !fechaInicio || !confirmado) return;

  const start = new Date(fechaInicio);
  const end = fechaFin ? new Date(fechaFin) : null;

  await prisma.eventoAgenda.update({
    where: { id },
    data: {
      fechaInicio: start,
      fechaFin: end,
      horaInicio: timeValue(start),
      horaFin: end ? timeValue(end) : null,
      estado: "reprogramado",
      confirmadoPorUsuario: true,
      requiereConfirmacion: false
    }
  });

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
