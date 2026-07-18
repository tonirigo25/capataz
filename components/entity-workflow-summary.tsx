import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";

export async function EntityWorkflowSummary({
  clientId,
  workId,
  invoiceId,
  budgetId
}: {
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  budgetId?: string;
}) {
  const { companyId } = await requireCompanyContext();
  const entityWhere = {
    ...(clientId ? { clientId } : {}),
    ...(workId ? { workId } : {}),
    ...(invoiceId ? { invoiceId } : {}),
    ...(budgetId ? { budgetId } : {})
  };
  const [tasks, followups] = await Promise.all([
    prisma.task.findMany({
      where: { companyId, ...entityWhere, archivedAt: null, status: { notIn: ["completed", "cancelled", "archived"] } },
      include: { checklist: true },
      orderBy: { dueAt: "asc" },
      take: 3
    }),
    prisma.followUp.findMany({
      where: { companyId, ...entityWhere, archivedAt: null, status: { notIn: ["completed", "cancelled", "archived"] } },
      orderBy: { nextActionAt: "asc" },
      take: 3
    })
  ]);
  const query = new URLSearchParams(entityWhere);

  return (
    <section className="surface p-4" aria-labelledby="workflow-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="workflow-summary" className="type-section-title text-content">Trabajo y seguimientos</h2>
          <p className="type-secondary mt-1">Prioridades y próximas acciones vinculadas a esta entidad.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="secondary-button" href={`/tareas?${query}`}>Ver tareas</Link>
          <Link className="secondary-button" href={`/seguimientos?${query}`}>Ver seguimientos</Link>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <WorkflowList title="Prioridades" empty="Sin tareas abiertas." items={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          meta: `${task.status}${task.dueAt ? ` · ${task.dueAt.toLocaleDateString("es-ES")}` : ""}${task.checklist.length ? ` · ${task.checklist.filter((item) => item.completed).length}/${task.checklist.length}` : ""}`
        }))} />
        <WorkflowList title="Próximas acciones" empty="Sin seguimientos abiertos." items={followups.map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${item.status}${item.nextActionAt ? ` · ${item.nextActionAt.toLocaleDateString("es-ES")}` : ""}`
        }))} />
      </div>
    </section>
  );
}

function WorkflowList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; meta: string }> }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      {items.length ? (
        <ul className="mt-2 grid gap-2 text-sm">
          {items.map((item) => <li key={item.id}><span className="font-semibold text-content">{item.title}</span><span className="block text-content-secondary">{item.meta}</span></li>)}
        </ul>
      ) : <p className="type-secondary mt-2">{empty}</p>}
    </div>
  );
}
