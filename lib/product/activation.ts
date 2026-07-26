import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type ActivationMilestone = {
  key: "company" | "client" | "budget" | "document";
  label: string;
  description: string;
  href: string;
  completedAt: Date | null;
};

export type ActivationStatus = {
  startedAt: Date;
  deadlineAt: Date;
  completedAt: Date | null;
  completedWithinSevenDays: boolean | null;
  milestones: ActivationMilestone[];
};

export async function getAndMeasureActivationStatus(
  prisma: PrismaClient,
  input: { companyId: string; actorId: string },
): Promise<ActivationStatus> {
  return prisma.$transaction(async (transaction) => {
    const [company, firstClient, firstBudget, firstDocument] = await Promise.all([
      transaction.company.findUniqueOrThrow({
        where: { id: input.companyId },
        select: { createdAt: true, onboardingCompletedAt: true },
      }),
      transaction.client.findFirst({
        where: { companyId: input.companyId, archivadoAt: null },
        orderBy: { fechaCreacion: "asc" },
        select: { fechaCreacion: true },
      }),
      transaction.budget.findFirst({
        where: { companyId: input.companyId },
        orderBy: { fechaCreacion: "asc" },
        select: { fechaCreacion: true },
      }),
      transaction.document.findFirst({
        where: { companyId: input.companyId, archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const startedAt = company.onboardingCompletedAt ?? company.createdAt;
    const deadlineAt = new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1_000);
    const milestones: ActivationMilestone[] = [
      { key: "company", label: "Configura tu empresa", description: "Actividad, nombre y forma de trabajar.", href: "/onboarding", completedAt: company.onboardingCompletedAt },
      { key: "client", label: "Crea o importa un cliente", description: "Añade la primera relación comercial.", href: "/clientes", completedAt: firstClient?.fechaCreacion ?? null },
      { key: "budget", label: "Prepara un presupuesto", description: "Crea una propuesta revisable antes de enviarla.", href: "/gestion?tipo=presupuesto&returnTo=/hoy", completedAt: firstBudget?.fechaCreacion ?? null },
      { key: "document", label: "Registra un documento", description: "Sube o importa un documento con su clasificación.", href: "/documentos", completedAt: firstDocument?.createdAt ?? null },
    ];
    const completedDates = milestones.flatMap((milestone) => milestone.completedAt ? [milestone.completedAt] : []);
    const completedAt = completedDates.length === milestones.length
      ? new Date(Math.max(...completedDates.map((date) => date.getTime())))
      : null;
    const actorHash = createHash("sha256").update(input.actorId).digest("hex").slice(0, 24);
    const measured: Array<{ name: string; occurredAt: Date; properties: { milestone: string; withinSevenDays: boolean; measurementVersion: string } }> = milestones
      .filter((milestone) => milestone.completedAt)
      .map((milestone) => ({
        name: `activation.${milestone.key}.completed`,
        occurredAt: milestone.completedAt as Date,
        properties: { milestone: milestone.key, withinSevenDays: (milestone.completedAt as Date) <= deadlineAt, measurementVersion: "f7-v1" },
      }));
    if (completedAt) measured.push({ name: "activation.completed", occurredAt: completedAt, properties: { milestone: "all", withinSevenDays: completedAt <= deadlineAt, measurementVersion: "f7-v1" } });
    const existing = measured.length ? await transaction.productEvent.findMany({
      where: { companyId: input.companyId, eventName: { in: measured.map((event) => event.name) } },
      select: { eventName: true },
    }) : [];
    const existingNames = new Set(existing.map((event) => event.eventName));
    const missing = measured.filter((event) => !existingNames.has(event.name));
    if (missing.length) await transaction.productEvent.createMany({ data: missing.map((event) => ({
      companyId: input.companyId,
      actorHash,
      eventName: event.name,
      schemaVersion: 1,
      properties: event.properties,
      occurredAt: event.occurredAt,
    })) });

    return { startedAt, deadlineAt, completedAt, completedWithinSevenDays: completedAt ? completedAt <= deadlineAt : null, milestones };
  });
}
