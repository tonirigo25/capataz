import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui-primitives";
import { prisma } from "@/lib/prisma";
import { createTaskAction, completeTaskAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    now = new Date(),
    tomorrow = new Date(now.getTime() + 86400000),
    week = new Date(now.getTime() + 7 * 86400000);
  const filter = query.filtro ?? "open";
  const date =
    filter === "today"
      ? { gte: start(now), lte: end(now) }
      : filter === "tomorrow"
        ? { gte: start(tomorrow), lte: end(tomorrow) }
        : filter === "week"
          ? { gte: start(now), lte: week }
          : filter === "overdue"
            ? { lt: start(now) }
            : undefined;
  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      ...(date ? { dueAt: date } : {}),
      ...(filter === "blocked"
        ? { status: "blocked" }
        : filter === "completed"
          ? { status: "completed" }
          : filter === "automatic"
            ? { origin: "automation" }
            : { status: { notIn: ["completed", "cancelled", "archived"] } }),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.workId ? { workId: query.workId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.budgetId ? { budgetId: query.budgetId } : {}),
    },
    include: { checklist: true, subtasks: true, dependencies: true },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return (
    <main className="screen space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Tareas"
        description="Bandeja, planificación, bloqueos, recurrencia y trabajo automático."
      />
      <nav
        className="flex gap-2 overflow-x-auto pb-2"
        aria-label="Filtros de tareas"
      >
        {[
          ["open", "Bandeja"],
          ["today", "Hoy"],
          ["tomorrow", "Mañana"],
          ["week", "Semana"],
          ["overdue", "Atrasadas"],
          ["blocked", "Bloqueadas"],
          ["completed", "Completadas"],
          ["automatic", "Automáticas"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={`/tareas?filtro=${id}`}
            aria-current={filter === id ? "page" : undefined}
            className={
              filter === id
                ? "primary-button shrink-0"
                : "secondary-button shrink-0"
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <form
        action={createTaskAction}
        className="card grid gap-3 p-4 md:grid-cols-4"
      >
        <label className="text-sm font-bold">
          Título
          <input className="field mt-1" name="title" required />
        </label>
        <label className="text-sm font-bold">
          Descripción
          <input className="field mt-1" name="description" />
        </label>
        <label className="text-sm font-bold">
          Vencimiento
          <input className="field mt-1" name="dueAt" type="datetime-local" />
        </label>
        <label className="text-sm font-bold">
          Prioridad
          <select className="field mt-1" name="priority">
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
            <option value="low">Baja</option>
          </select>
        </label>
        <button className="primary-button md:col-span-4">Crear tarea</button>
      </form>
      {tasks.length ? (
        <section className="grid gap-3" aria-live="polite">
          {tasks.map((task) => (
            <article className="card p-4" key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    className="text-lg font-black underline-offset-4 hover:underline"
                    href={`/tareas/${task.id}`}
                  >
                    {task.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">
                    {task.status} · {task.priority} · {task.origin}
                    {task.dueAt
                      ? ` · ${task.dueAt.toLocaleString("es-ES")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    {task.checklist.length
                      ? `Checklist ${task.checklist.filter((i) => i.completed).length}/${task.checklist.length}`
                      : "Sin checklist"}{" "}
                    · {task.subtasks.length} subtareas ·{" "}
                    {task.dependencies.length} dependencias
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    className="secondary-button"
                    href={`/tareas/${task.id}`}
                  >
                    Abrir
                  </Link>
                  {task.status !== "completed" ? (
                    <form action={completeTaskAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <button className="primary-button">Completar</button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Sin tareas"
          description="No hay tareas para este filtro."
        />
      )}
    </main>
  );
}
const start = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const end = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
