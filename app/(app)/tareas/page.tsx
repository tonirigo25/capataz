import Link from "next/link";
import { Plus } from "lucide-react";
import { CompactFilterBar, PageHeader, EmptyState, ResultCount } from "@/components/ui-primitives";
import { prisma } from "@/lib/prisma";
import { createTaskAction, completeTaskAction } from "./actions";
import { requireCapability, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { ListWorkspace } from "@/components/workspaces";
import type { Prisma } from "@prisma/client";
export const dynamic = "force-dynamic";
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    now = new Date();
  const auth = await requireCapability("tasks.view");
  const canManage=(await resolveAuthorization(auth,"tasks.manage")).allowed;
  const scopedWorkIds = await resolveScopedEntityIds(auth, "work.view", "Work");
  const taskScope: Prisma.TaskWhereInput = auth.scope === "COMPANY" ? {} : { OR: [{ assigneeId: auth.userId }, { workId: { in: scopedWorkIds ?? [] } }] };
  const filter = query.filtro ?? "mine";
  const stateScope: Prisma.TaskWhereInput =
    filter === "blocked"
      ? { status: "blocked" }
      : filter === "completed"
        ? { status: "completed" }
        : { status: { notIn: ["completed", "cancelled", "archived"] } };
  const ownershipScope: Prisma.TaskWhereInput =
    filter === "mine"
      ? { OR: [{ assigneeId: auth.userId }, { createdById: auth.userId }] }
      : {};
  const tasks = await prisma.task.findMany({
    where: {
      companyId: auth.companyId,
      archivedAt: null,
      AND: [taskScope, stateScope, ownershipScope],
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
    <ListWorkspace className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Tareas"
        description="Trabajo propio y de equipo con bloqueos, dependencias y recurrencia siempre visibles."
        action={canManage ? (
          <Link className="primary-button" href={`/tareas?filtro=${filter}&nuevo=1`}>
            <Plus size={18} />
            Nueva tarea
          </Link>
        ) : undefined}
      />
      <CompactFilterBar><nav
        className="flex gap-2 overflow-x-auto pb-2"
        aria-label="Filtros de tareas"
      >
        {[
          ["mine", "Mías"],
          ["team", "Equipo"],
          ["blocked", "Bloqueadas"],
          ["completed", "Completadas"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={`/tareas?filtro=${id}`}
            aria-current={filter === id ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${
              filter === id
                ? "bg-obra-ink text-white"
                : "border border-slate-200 bg-white text-obra-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav></CompactFilterBar>
      <ResultCount shown={tasks.length} total={tasks.length} noun="tareas" />
      {canManage && query.nuevo === "1" ? <form
        action={createTaskAction}
        className="card grid gap-3 p-4 md:grid-cols-4"
        aria-label="Nueva tarea"
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
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <button className="primary-button">Crear tarea</button>
          <Link className="secondary-button" href={`/tareas?filtro=${filter}`}>Cancelar</Link>
        </div>
      </form> : null}
      {tasks.length ? (
        tasks.length >= 6 && !["blocked", "completed"].includes(filter) ? (
          <section className="grid gap-4 lg:grid-cols-3" aria-live="polite" data-task-view="board">
            {[
              ["Hoy", tasks.filter((task) => task.status !== "blocked" && task.dueAt && task.dueAt <= end(now))],
              ["Próximas", tasks.filter((task) => task.status !== "blocked" && (!task.dueAt || task.dueAt > end(now)))],
              ["Bloqueadas", tasks.filter((task) => task.status === "blocked")],
            ].map(([title, columnTasks]) => (
              <section className="rounded-xl bg-slate-100/80 p-3" key={String(title)}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-black text-obra-ink">{String(title)}</h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{(columnTasks as typeof tasks).length}</span>
                </div>
                <div className="grid gap-3">
                  {(columnTasks as typeof tasks).map((task) => <TaskCard canManage={canManage} key={task.id} task={task} />)}
                  {!(columnTasks as typeof tasks).length ? <p className="rounded-lg bg-white p-3 text-sm text-slate-500">Sin tareas en esta columna.</p> : null}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <section className="grid gap-3" aria-live="polite" data-task-view="list">
            {tasks.map((task) => <TaskCard canManage={canManage} key={task.id} task={task} />)}
          </section>
        )
      ) : (
        <EmptyState
          title="Sin tareas"
          description="No hay tareas para este filtro."
        />
      )}
    </ListWorkspace>
  );
}

type TaskListItem = Prisma.TaskGetPayload<{
  include: { checklist: true; subtasks: true; dependencies: true };
}>;

function TaskCard({ canManage, task }: { canManage: boolean; task: TaskListItem }) {
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="text-lg font-black underline-offset-4 hover:underline" href={`/tareas/${task.id}`}>
            {task.title}
          </Link>
          <p className="mt-1 text-sm text-slate-500">
            {task.status} · {task.priority} · {task.origin}
            {task.dueAt ? ` · ${task.dueAt.toLocaleString("es-ES")}` : ""}
          </p>
          <p className="mt-1 text-sm">
            {task.checklist.length
              ? `Checklist ${task.checklist.filter((item) => item.completed).length}/${task.checklist.length}`
              : "Sin checklist"}{" "}
            · {task.subtasks.length} subtareas · {task.dependencies.length} dependencias
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="secondary-button" href={`/tareas/${task.id}`}>Abrir</Link>
          {canManage && task.status !== "completed" ? (
            <form action={completeTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <button className="secondary-button">Completar</button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const end = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
