import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui-primitives";
import {
  changeTaskStatusAction,
  updateTaskAction,
  addTaskCommentAction,
  addChecklistAction,
  toggleChecklistAction,
  editChecklistAction,
  moveChecklistAction,
  createSubtaskAction,
  addDependencyAction,
  removeDependencyAction,
  saveRecurrenceAction,
  editSeriesAction,
  archiveTaskAction,
} from "../actions";
export const dynamic = "force-dynamic";
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      checklist: { orderBy: { order: "asc" } },
      subtasks: { orderBy: { createdAt: "asc" } },
      parentTask: true,
      dependencies: { include: { dependsOnTask: true } },
      blocking: { include: { task: true } },
      comments: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" } },
      recurrence: true,
      automationRun: { include: { definition: true } },
    },
  });
  if (!task) notFound();
  const [client, work, budget, invoice, candidates] = await Promise.all([
    task.clientId
      ? prisma.client.findUnique({
          where: { id: task.clientId },
          select: { nombre: true },
        })
      : null,
    task.workId
      ? prisma.work.findUnique({
          where: { id: task.workId },
          select: { titulo: true },
        })
      : null,
    task.budgetId
      ? prisma.budget.findUnique({
          where: { id: task.budgetId },
          select: { numero: true, titulo: true },
        })
      : null,
    task.invoiceId
      ? prisma.invoice.findUnique({
          where: { id: task.invoiceId },
          select: { numero: true, concepto: true },
        })
      : null,
    prisma.task.findMany({
      where: { id: { not: id }, archivedAt: null },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 100,
    }),
  ]);
  const done = task.checklist.filter((i) => i.completed).length;
  return (
    <main className="screen space-y-5">
      <Link href="/tareas" className="secondary-button">
        Volver a tareas
      </Link>
      <PageHeader
        eyebrow={task.origin}
        title={task.title}
        description={task.description ?? "Sin descripción"}
      />
      <section className="card grid gap-4 p-4 md:grid-cols-2">
        <div>
          <h2 className="font-black">Estado y planificación</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Estado" value={task.status} />
            <Row label="Prioridad" value={task.priority} />
            <Row
              label="Responsable"
              value={task.assigneeId ? "Responsable asignado" : "Sin asignar"}
            />
            <Row label="Inicio" value={format(task.startsAt)} />
            <Row label="Vencimiento" value={format(task.dueAt)} />
            <Row label="Bloqueo" value={task.blockedReason ?? "No bloqueada"} />
          </dl>
        </div>
        <div>
          <h2 className="font-black">Relaciones</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Cliente" value={client?.nombre ?? "Sin cliente"} />
            <Row label="Obra" value={work?.titulo ?? "Sin obra"} />
            <Row
              label="Presupuesto"
              value={
                budget
                  ? `${budget.numero} · ${budget.titulo}`
                  : "Sin presupuesto"
              }
            />
            <Row
              label="Factura"
              value={
                invoice
                  ? `${invoice.numero} · ${invoice.concepto}`
                  : "Sin factura"
              }
            />
            <Row
              label="Automatización"
              value={
                task.automationRun?.definition.name ?? "Origen no automatizado"
              }
            />
            <Row
              label="Recurrencia"
              value={task.recurrence?.rrule ?? "No recurrente"}
            />
          </dl>
        </div>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Acciones</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["in_progress", "Iniciar"],
            ["planned", "Desbloquear/reabrir"],
            ["completed", "Completar"],
            ["cancelled", "Cancelar"],
          ].map(([status, label]) => (
            <form action={changeTaskStatusAction} key={status}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="status" value={status} />
              <button className="secondary-button">{label}</button>
            </form>
          ))}
          <form action={archiveTaskAction}>
            <input type="hidden" name="id" value={task.id} />
            <button className="danger-button">Archivar</button>
          </form>
        </div>
        <form action={changeTaskStatusAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value="blocked" />
          <label className="min-w-0 flex-1 text-sm font-bold">
            Motivo del bloqueo
            <input className="field mt-1" name="reason" required defaultValue={task.blockedReason ?? ""} />
          </label>
          <button className="secondary-button self-end">Marcar bloqueada</button>
        </form>
        <form
          action={updateTaskAction}
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="id" value={task.id} />
          <label className="text-sm font-bold sm:col-span-2">
            Título
            <input className="field mt-1" name="title" defaultValue={task.title} required />
          </label>
          <label className="text-sm font-bold sm:col-span-3">
            Descripción
            <textarea className="field mt-1" name="description" rows={3} defaultValue={task.description ?? ""} />
          </label>
          <label className="text-sm font-bold">
            Prioridad
            <select
              className="field mt-1"
              name="priority"
              defaultValue={task.priority}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Fecha
            <input
              className="field mt-1"
              type="datetime-local"
              name="dueAt"
              defaultValue={inputDate(task.dueAt)}
            />
          </label>
          <label className="text-sm font-bold">
            Responsable
            <input className="field mt-1" name="assigneeId" defaultValue={task.assigneeId ?? ""} placeholder="Nombre o referencia interna" />
          </label>
          <button className="primary-button self-end">
            Guardar planificación
          </button>
        </form>
      </section>
      <section className="card p-4">
        <h2 className="font-black">
          Checklist{" "}
          {task.checklist.length ? `· ${done}/${task.checklist.length}` : ""}
        </h2>
        <form action={addChecklistAction} className="mt-3 flex gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <label className="sr-only" htmlFor="check-title">
            Nuevo elemento
          </label>
          <input id="check-title" className="field" name="title" required />
          <button className="primary-button">Añadir</button>
        </form>
        {task.checklist.length ? (
          <ul className="mt-3 space-y-2">
            {task.checklist.map((item) => (
              <li className="rounded-lg border p-3" key={item.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={toggleChecklistAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="completed"
                      value={String(item.completed)}
                    />
                    <button className="secondary-button">
                      {item.completed ? "Reabrir" : "Completar"}
                    </button>
                  </form>
                  <form
                    action={editChecklistAction}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <label className="sr-only" htmlFor={`check-${item.id}`}>
                      Título
                    </label>
                    <input
                      id={`check-${item.id}`}
                      name="title"
                      className="field"
                      defaultValue={item.title}
                    />
                    <button className="secondary-button">Guardar</button>
                  </form>
                  {["up", "down"].map((direction) => (
                    <form action={moveChecklistAction} key={direction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="direction" value={direction} />
                      <button
                        className="secondary-button"
                        aria-label={
                          direction === "up" ? "Mover arriba" : "Mover abajo"
                        }
                      >
                        {direction === "up" ? "↑" : "↓"}
                      </button>
                    </form>
                  ))}
                </div>
                {item.completedAt ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Completado {format(item.completedAt)} por{" "}
                    {item.completedBy ?? "actor desconocido"}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Sin elementos; no se calcula progreso.
          </p>
        )}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-black">Subtareas</h2>
          {task.parentTask ? (
            <p className="mt-2 text-sm">
              Tarea padre:{" "}
              <Link
                className="underline"
                href={`/tareas/${task.parentTask.id}`}
              >
                {task.parentTask.title}
              </Link>
            </p>
          ) : null}
          <form action={createSubtaskAction} className="mt-3 grid gap-2">
            <input type="hidden" name="parentTaskId" value={task.id} />
            <label className="text-sm font-bold">
              Nueva subtarea
              <input className="field mt-1" name="title" required />
            </label>
            <button className="primary-button">Crear subtarea</button>
          </form>
          {task.subtasks.length ? (
            <ul className="mt-3 space-y-2">
              {task.subtasks.map((item) => (
                <li key={item.id}>
                  <Link className="underline" href={`/tareas/${item.id}`}>
                    {item.title}
                  </Link>{" "}
                  · {item.status}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="card p-4">
          <h2 className="font-black">Dependencias</h2>
          <form action={addDependencyAction} className="mt-3 grid gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <label className="text-sm font-bold">
              Depende de
              <select className="field mt-1" name="dependsOnTaskId" required>
                <option value="">Selecciona tarea</option>
                {candidates.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Tipo de dependencia
              <select className="field mt-1" name="type">
              <option value="finish_to_start">Finalizar para empezar</option>
              <option value="blocks">Bloquea</option>
              <option value="related">Relacionada</option>
              </select>
            </label>
            <button className="primary-button">Añadir dependencia</button>
          </form>
          {task.dependencies.map((dep) => (
            <div
              className="mt-2 flex items-center justify-between gap-2"
              key={dep.id}
            >
              <Link
                className="underline"
                href={`/tareas/${dep.dependsOnTask.id}`}
              >
                {dep.dependsOnTask.title}
              </Link>
              <form action={removeDependencyAction}>
                <input type="hidden" name="id" value={dep.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <button className="secondary-button">Retirar</button>
              </form>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-4">
        <h2 className="font-black">Recurrencia</h2>
        <form
          action={saveRecurrenceAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="taskId" value={task.id} />
          <label className="text-sm font-bold">
            Frecuencia
            <select
              className="field mt-1"
              name="frequency"
              defaultValue={task.recurrence?.frequency ?? "weekly"}
            >
              <option value="daily">Diaria</option>
              <option value="workdays">Días laborables</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
              <option value="custom">Personalizada</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Inicio
            <input
              className="field mt-1"
              type="datetime-local"
              name="startsAt"
              defaultValue={inputDate(task.recurrence?.startsAt ?? task.dueAt)}
            />
          </label>
          <label className="text-sm font-bold">
            Zona horaria
            <input
              className="field mt-1"
              name="timezone"
              defaultValue={task.recurrence?.timezone ?? "Europe/Madrid"}
            />
          </label>
          <label className="text-sm font-bold">
            RRULE avanzada
            <input
              className="field mt-1"
              name="rrule"
              required
              defaultValue={task.recurrence?.rrule ?? "FREQ=WEEKLY;BYDAY=MO"}
            />
          </label>
          <p className="text-sm text-slate-500 md:col-span-2">
            Ejemplo: cada semana los lunes. COUNT y UNTIL limitan la serie; las
            filas se generan dentro de una ventana.
          </p>
          <button className="primary-button md:col-span-2">
            Guardar recurrencia
          </button>
        </form>
        {task.recurrence ? (
          <form
            action={editSeriesAction}
            className="mt-4 grid gap-3 md:grid-cols-3"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <label className="text-sm font-bold">
              Aplicar a
              <select className="field mt-1" name="scope">
                <option value="this">Solo esta ocurrencia</option>
                <option value="following">Esta y siguientes</option>
                <option value="all">Toda la serie futura</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Nuevo título
              <input
                className="field mt-1"
                name="title"
                defaultValue={task.title}
              />
            </label>
            <button className="secondary-button self-end">
              Editar serie con confirmación
            </button>
          </form>
        ) : null}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-black">Comentarios</h2>
          <form action={addTaskCommentAction} className="mt-3 flex gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <label className="sr-only" htmlFor="comment">
              Comentario
            </label>
            <input id="comment" className="field" name="content" required />
            <button className="primary-button">Añadir</button>
          </form>
          {task.comments.map((item) => (
            <article className="mt-3 border-t pt-3 text-sm" key={item.id}>
              <p>{item.content}</p>
              <p className="text-xs text-slate-500">{format(item.createdAt)}</p>
            </article>
          ))}
        </div>
        <div className="card p-4">
          <h2 className="font-black">Historial</h2>
          {task.history.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {task.history.map((item) => (
                <li key={item.id}>
                  {item.previousStatus ?? "creada"} → {item.newStatus} ·{" "}
                  {format(item.createdAt)}
                  {item.reason ? ` · ${item.reason}` : ""}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="Sin cambios de estado"
              description="El historial aparecerá tras la primera transición."
            />
          )}
        </div>
      </section>
    </main>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-bold">{label}</dt>
      <dd className="text-right text-slate-600">{value}</dd>
    </div>
  );
}
const format = (date: Date | null | undefined) =>
  date ? date.toLocaleString("es-ES") : "Sin fecha";
const inputDate = (date: Date | null | undefined) =>
  date
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
