"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function confirmReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;

  await prisma.reminder.update({
    where: { id },
    data: {
      estado: "programado",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true
    }
  });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function cancelReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;

  await prisma.reminder.update({
    where: { id },
    data: { estado: "cancelado" }
  });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function markReminderDone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!id || !confirmado) return;

  await prisma.reminder.update({
    where: { id },
    data: {
      estado: "realizado",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true
    }
  });

  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}
