"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { validWorkStatus } from "@/lib/works";

export async function updateWorkStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = validWorkStatus(String(formData.get("estado") ?? ""));
  if (!id || !estado) return;

  const work = await prisma.work.findUnique({ where: { id }, include: { invoices: true } });
  if (!work) return;

  if (estado === "cerrada" && work.invoices.some((invoice) => invoice.pendiente > 0)) {
    await prisma.work.update({ where: { id }, data: { estado: "pendiente_cobro" } });
  } else {
    await prisma.work.update({
      where: { id },
      data: {
        estado,
        fechaInicioReal: estado === "en_curso" && !work.fechaInicioReal ? new Date() : undefined,
        fechaFinReal: ["finalizada", "cerrada", "cobrada"].includes(estado) && !work.fechaFinReal ? new Date() : undefined,
        archivada: estado === "archivada" ? true : undefined,
        archivadaAt: estado === "archivada" ? new Date() : undefined
      }
    });
  }

  await reevaluateProactiveAfterMutation({ entityType: "work", entityId: id, clientId: work.clienteId, workId: id, reason: "work_status_updated" });

  revalidatePath("/obras");
  revalidatePath(`/obras/${id}`);
  revalidatePath("/hoy");
}
