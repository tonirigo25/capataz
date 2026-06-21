"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

  const existing = await prisma.reminder.findFirst({
    where: {
      clienteId,
      presupuestoId,
      tipo: "seguimiento_presupuesto",
      estado: { in: ["borrador", "pendiente_confirmacion"] }
    },
    orderBy: { fechaProgramada: "asc" }
  });

  const data = {
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
      where: { id: existing.id },
      data
    });
  } else {
    await prisma.reminder.create({ data });
  }

  await prisma.client.update({
    where: { id: clienteId },
    data: { ultimaInteraccion: new Date() }
  });

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
  redirect("/recordatorios");
}
