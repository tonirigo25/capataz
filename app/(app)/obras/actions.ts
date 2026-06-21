"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function updateWorkStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !estado) return;

  const work = await prisma.work.findUnique({ where: { id }, include: { invoices: true } });
  if (!work) return;

  if (estado === "cerrada" && work.invoices.some((invoice) => invoice.pendiente > 0)) {
    await prisma.work.update({ where: { id }, data: { estado: "pendiente_cobro" } });
  } else {
    await prisma.work.update({ where: { id }, data: { estado: estado as any } });
  }

  revalidatePath("/obras");
  revalidatePath("/hoy");
}
