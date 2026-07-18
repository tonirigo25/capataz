import Link from "next/link";
import type { FollowUpStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function TodayWorkflowSummary({ companyId }: { companyId: string }) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const closedTaskStatuses: TaskStatus[] = ["completed", "cancelled", "archived"];
  const closedFollowUpStatuses: FollowUpStatus[] = ["completed", "cancelled", "archived"];
  const [today, overdue, followups, failed, next] = await Promise.all([
    prisma.task.count({
      where: { companyId, dueAt: { gte: start, lte: end }, status: { notIn: closedTaskStatuses } }
    }),
    prisma.task.count({
      where: { companyId, dueAt: { lt: start }, status: { notIn: closedTaskStatuses } }
    }),
    prisma.followUp.count({
      where: { companyId, nextActionAt: { lt: now }, status: { notIn: closedFollowUpStatuses } }
    }),
    prisma.automationRun.count({
      where: {
        companyId,
        status: "failed",
        startedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) }
      }
    }),
    prisma.automationSchedule.findFirst({
      where: {
        active: true,
        nextRunAt: { gte: now },
        definition: { companyId }
      },
      orderBy: { nextRunAt: "asc" },
      include: { definition: true }
    })
  ]);

  return (
    <section className="mt-4 rounded-xl bg-subtle p-4 sm:p-5" aria-labelledby="today-workflows">
      <h2 id="today-workflows" className="type-object-title text-content">Trabajo organizado</h2>
      <p className="type-secondary mt-1">
        Tienes {today} tareas para hoy, {overdue} atrasadas y {followups} seguimientos vencidos.
        {failed ? ` Hay ${failed} automatizaciones fallidas esta semana.` : ""}
      </p>
      {next?.nextRunAt ? (
        <p className="type-meta mt-1">
          Próxima automatización: {next.definition.name}, {next.nextRunAt.toLocaleString("es-ES")}.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/tareas" className="ghost-button">Ver tareas</Link>
        <Link href="/seguimientos" className="ghost-button">Ver seguimientos</Link>
        <Link href="/automatizaciones" className="ghost-button">Ver automatizaciones</Link>
      </div>
    </section>
  );
}
