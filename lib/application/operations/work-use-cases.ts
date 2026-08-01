import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { validWorkStatus } from "@/lib/works";
import { assertScopedEntityAccess, requireCapability } from "@/lib/commercial/authorization";

export async function updateWorkStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const rawStatus = formData.get("estado");
  const estado = typeof rawStatus === "string" ? validWorkStatus(rawStatus) : null;
  if (!id || !estado) return;

  const auth = await requireCapability("work.update");
  const { companyId } = auth;
  await assertScopedEntityAccess(auth, "work.update", "Work", id);
  const work = await prisma.work.findFirst({ where: { id, companyId }, include: { invoices: true } });
  if (!work) return;

  if (estado === "cerrada" && work.invoices.some((invoice) => invoice.pendiente > 0)) {
    await prisma.work.updateMany({ where: { id, companyId }, data: { estado: "pendiente_cobro" } });
  } else {
    await prisma.work.updateMany({
      where: { id, companyId },
      data: {
        estado,
        fechaInicioReal: estado === "en_curso" && !work.fechaInicioReal ? new Date() : undefined,
        fechaFinReal: ["finalizada", "cerrada", "cobrada"].includes(estado) && !work.fechaFinReal ? new Date() : undefined,
        archivada: estado === "archivada" ? true : undefined,
        archivadaAt: estado === "archivada" ? new Date() : undefined
      }
    });
  }

  await reevaluateProactiveAfterMutation({ companyId, entityType: "work", entityId: id, clientId: work.clienteId, workId: id, reason: "work_status_updated" });

  revalidatePath("/obras");
  revalidatePath(`/obras/${id}`);
  revalidatePath("/hoy");
}
