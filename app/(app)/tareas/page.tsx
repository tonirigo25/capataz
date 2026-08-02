import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderKanban,
  MoreHorizontal,
  Plus,
  UserRound,
} from "lucide-react";
import { TaskFilters } from "@/components/portal/modules-a/task-filters";
import { EmptyState } from "@/components/ui-primitives";
import { requireCapability, resolveAuthorization, resolveScopedEntityIds, resolveScopedTaskIds } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { completeTaskAction, createTaskAction } from "./actions";

export const dynamic = "force-dynamic";

const terminalStates = new Set(["completed", "cancelled", "archived"]);
const pageSize = 7;

type TaskQuery = {
  filtro?: string;
  estado?: string;
  tipo?: string;
  prioridad?: string;
  relacion?: string;
  responsable?: string;
  buscar?: string;
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  budgetId?: string;
  nuevo?: string;
  pagina?: string;
  periodo?: string;
};

const taskListInclude = {
  checklist: true,
  subtasks: true,
  dependencies: true,
  recurrence: true,
} satisfies Prisma.TaskInclude;

type TaskListItem = Prisma.TaskGetPayload<{ include: typeof taskListInclude }>;

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskQuery> }) {
  const query = await searchParams;
  const auth = await requireCapability("tasks.view");
  const canManage = (await resolveAuthorization(auth, "tasks.manage")).allowed;
  const scopedWorkIds = await resolveScopedEntityIds(auth, "work.view", "Work");
  const clientAccess = await resolveAuthorization(auth, "clients.view");
  const scopedClientIds = clientAccess.allowed
    ? await resolveScopedEntityIds(auth, "clients.view", "Client")
    : [];
  const scopedTaskIds = await resolveScopedTaskIds(auth, "tasks.view");
  const taskScope: Prisma.TaskWhereInput = scopedTaskIds === null ? {} : { id: { in: scopedTaskIds } };

  const allTasks = await prisma.task.findMany({
    where: {
      companyId: auth.companyId,
      archivedAt: null,
      AND: [taskScope],
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.workId ? { workId: query.workId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.budgetId ? { budgetId: query.budgetId } : {}),
    },
    include: taskListInclude,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  const legacyFilter = query.filtro ?? (auth.scope === "COMPANY" ? "team" : "mine");
  const values = {
    estado: query.estado ?? (legacyFilter === "blocked" ? "blocked" : legacyFilter === "completed" ? "completed" : "pending"),
    tipo: query.tipo ?? "all",
    prioridad: query.prioridad ?? "all",
    relacion: query.relacion ?? "all",
    responsable: query.responsable ?? (legacyFilter === "mine" ? "mine" : "team"),
    buscar: query.buscar?.trim() ?? "",
    periodo: query.periodo ?? "all",
  };

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const endWeek = new Date(endToday);
  endWeek.setDate(endWeek.getDate() + 7);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const memberRecords = await prisma.companyMembership.findMany({
    where: { companyId: auth.companyId, status: "active" },
    select: { userId: true, user: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const memberNames = new Map(memberRecords.map((membership) => [membership.userId, membership.user.displayName]));
  const safeWorkIds = [...new Set(allTasks.map((task) => task.workId).filter((id): id is string => Boolean(id)))]
    .filter((id) => scopedWorkIds === null || scopedWorkIds.includes(id));
  const safeClientIds = [...new Set(allTasks.map((task) => task.clientId).filter((id): id is string => Boolean(id)))]
    .filter((id) => scopedClientIds === null || scopedClientIds.includes(id));
  const [works, clients] = await Promise.all([
    safeWorkIds.length ? prisma.work.findMany({
      where: { companyId: auth.companyId, id: { in: safeWorkIds } },
      select: { id: true, titulo: true, codigo: true, numeroInterno: true },
    }) : [],
    clientAccess.allowed && safeClientIds.length ? prisma.client.findMany({
      where: { companyId: auth.companyId, id: { in: safeClientIds } },
      select: { id: true, nombre: true },
    }) : [],
  ]);
  const workMap = new Map(works.map((work) => [work.id, work]));
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const filteredTasks = allTasks.filter((task) => {
    if (!matchesState(task, values.estado)) return false;
    if (values.tipo !== "all" && task.category !== values.tipo) return false;
    if (values.prioridad !== "all" && task.priority !== values.prioridad) return false;
    if (!matchesRelation(task, values.relacion)) return false;
    if (!matchesResponsible(task, values.responsable, auth.userId)) return false;
    if (!matchesPeriod(task, values.periodo, startToday, endToday, endWeek, startMonth)) return false;
    if (values.buscar) {
      const relation = relationMeta(task, workMap, clientMap);
      const assignee = task.assigneeId ? memberNames.get(task.assigneeId) : "";
      const haystack = `${task.title} ${task.description ?? ""} ${relation.title} ${relation.detail} ${assignee ?? ""}`.toLocaleLowerCase("es-ES");
      if (!haystack.includes(values.buscar.toLocaleLowerCase("es-ES"))) return false;
    }
    return true;
  });

  const pendingTasks = allTasks.filter((task) => !terminalStates.has(task.status));
  const overdue = pendingTasks.filter((task) => task.dueAt && task.dueAt < startToday);
  const today = pendingTasks.filter((task) => task.dueAt && task.dueAt >= startToday && task.dueAt <= endToday);
  const week = pendingTasks.filter((task) => task.dueAt && task.dueAt > endToday && task.dueAt <= endWeek);
  const completedThisMonth = allTasks.filter((task) => task.status === "completed" && task.completedAt && task.completedAt >= startMonth);
  const urgentToday = today.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const withoutDate = pendingTasks.filter((task) => !task.dueAt).length;

  const requestedPage = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleTasks = filteredTasks.slice((page - 1) * pageSize, page * pageSize);
  const typeOptions = [["all", "Todos"], ...[...new Set(allTasks.map((task) => task.category))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((category) => [category, statusLabel(category)] as const)] as Array<readonly [string, string]>;
  const responsibleOptions = [
    ["mine", "Mías"],
    ["team", "Todo el equipo"],
    ["unassigned", "Sin asignar"],
    ...memberRecords.map((membership) => [membership.userId, membership.user.displayName] as const),
  ] as Array<readonly [string, string]>;

  return (
    <main className="tasks-page">
      <nav className="tasks-breadcrumbs" aria-label="Ruta interna">
        <Link href="/obras">Trabajo</Link><ChevronRight size={12} aria-hidden="true" /><span>Tareas</span>
      </nav>

      <header className="tasks-page__header">
        <div>
          <h1>Tareas</h1>
          <p>Coordina pendientes, responsables y vencimientos sin perder el contexto de cada trabajo.</p>
        </div>
        {canManage ? <Link className="tasks-create-button" href={newTaskHref(query)}><Plus size={17} aria-hidden="true" />Nueva tarea</Link> : null}
      </header>

      {canManage && query.nuevo === "1" ? (
        <form action={createTaskAction} className="tasks-create-panel" aria-label="Nueva tarea">
          {query.workId ? <input type="hidden" name="workId" value={query.workId} /> : null}
          {query.clientId ? <input type="hidden" name="clientId" value={query.clientId} /> : null}
          <label><span>Título</span><input name="title" required autoFocus /></label>
          <label><span>Descripción</span><input name="description" /></label>
          <label><span>Vencimiento</span><input name="dueAt" type="datetime-local" /></label>
          <label><span>Prioridad</span><select name="priority" defaultValue="medium"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
          <div><button className="primary-button">Crear tarea</button><Link className="secondary-button" href="/tareas">Cancelar</Link></div>
        </form>
      ) : null}

      <section className="tasks-kpis" aria-label="Indicadores de tareas">
        <TaskKpi icon={ClipboardCheck} tone="green" label="Pendientes" value={pendingTasks.length} detail={`${overdue.length} vencidas`} detailTone={overdue.length ? "danger" : "success"} href="/tareas?estado=pending&responsable=team" />
        <TaskKpi icon={Clock3} tone="orange" label="Hoy" value={today.length} detail={`${urgentToday} prioritarias`} detailTone={urgentToday ? "warning" : "success"} href="/tareas?estado=pending&responsable=team&periodo=today" />
        <TaskKpi icon={CalendarDays} tone="blue" label="Esta semana" value={week.length} detail={`${withoutDate} sin fecha`} detailTone={withoutDate ? "blue" : "success"} href="/tareas?estado=pending&responsable=team&periodo=week" />
        <TaskKpi icon={CheckCircle2} tone="gray" label="Completadas" value={completedThisMonth.length} detail="Este mes" detailTone="success" href="/tareas?estado=completed&responsable=team&periodo=month" />
      </section>

      <TaskFilters
        values={values}
        typeOptions={typeOptions}
        responsibleOptions={responsibleOptions}
        context={{ clientId: query.clientId, workId: query.workId, invoiceId: query.invoiceId, budgetId: query.budgetId }}
      />

      {visibleTasks.length ? (
        <section className="tasks-table-shell" aria-label="Listado de tareas">
          <div className="tasks-table-scroll">
            <div className="tasks-table" role="table" aria-rowcount={filteredTasks.length}>
              <div className="tasks-table__header" role="row">
                <span role="columnheader">Tarea</span><span role="columnheader">Relación</span><span role="columnheader">Tipo</span><span role="columnheader">Fecha</span><span role="columnheader">Prioridad</span><span role="columnheader">Responsable</span><span role="columnheader">Estado</span><span aria-hidden="true" />
              </div>
              {visibleTasks.map((task) => (
                <TaskRow key={task.id} task={task} canManage={canManage} assignee={task.assigneeId ? memberNames.get(task.assigneeId) : undefined} relation={relationMeta(task, workMap, clientMap)} now={now} />
              ))}
            </div>
          </div>
          <footer className="tasks-pagination">
            <span>Mostrando {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + visibleTasks.length} de {filteredTasks.length} tareas</span>
            <nav aria-label="Páginas de tareas">
              {page > 1 ? <Link href={pageHref(query, page - 1)} aria-label="Página anterior"><ChevronLeft size={15} /></Link> : <span aria-hidden="true"><ChevronLeft size={15} /></span>}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((number) => number === page ? <span key={number} aria-current="page">{number}</span> : <Link key={number} href={pageHref(query, number)}>{number}</Link>)}
              {page < totalPages ? <Link href={pageHref(query, page + 1)} aria-label="Página siguiente"><ChevronRight size={15} /></Link> : <span aria-hidden="true"><ChevronRight size={15} /></span>}
            </nav>
          </footer>
        </section>
      ) : (
        <EmptyState title="Sin tareas para estos filtros" description="Ajusta los filtros o crea una tarea vinculada al trabajo correspondiente." icon={ClipboardCheck} action={canManage ? <Link href={newTaskHref(query)} className="primary-button">Crear tarea</Link> : undefined} />
      )}
    </main>
  );
}

function TaskKpi({ icon: Icon, tone, label, value, detail, detailTone, href }: { icon: typeof ClipboardCheck; tone: string; label: string; value: number; detail: string; detailTone: string; href: string }) {
  return <Link href={href} className="tasks-kpi" data-tone={tone}><span className="tasks-kpi__icon"><Icon size={23} aria-hidden="true" /></span><span><strong>{value}</strong><span>{label}</span><small data-tone={detailTone}>{detail}</small></span></Link>;
}

function TaskRow({ task, canManage, assignee, relation, now }: { task: TaskListItem; canManage: boolean; assignee?: string; relation: TaskRelation; now: Date }) {
  const due = dueMeta(task.dueAt, now);
  const RelationIcon = relation.icon;
  return (
    <article className="tasks-table__row" role="row">
      <div className="tasks-table__task" role="cell"><Link href={`/tareas/${task.id}`}>{task.title}</Link><span>{task.description ?? task.blockedReason ?? checklistSummary(task)}</span></div>
      <div className="tasks-table__relation" role="cell"><span className="tasks-relation-icon"><RelationIcon size={16} aria-hidden="true" /></span>{relation.href ? <Link href={relation.href}><strong>{relation.title}</strong><small>{relation.detail}</small></Link> : <span><strong>{relation.title}</strong><small>{relation.detail}</small></span>}</div>
      <div role="cell"><span className="tasks-pill" data-tone={categoryTone(task.category)}>{statusLabel(task.category)}</span></div>
      <div className="tasks-table__date" role="cell"><strong>{due.primary}</strong><small data-tone={due.tone}>{due.secondary}</small></div>
      <div role="cell"><span className="tasks-pill" data-tone={priorityTone(task.priority)}>{statusLabel(task.priority)}</span></div>
      <div className="tasks-table__assignee" role="cell"><span className="tasks-avatar"><UserRound size={14} aria-hidden="true" /></span><span>{assignee ?? "Sin asignar"}</span></div>
      <div role="cell"><span className="tasks-pill" data-tone={statusTone(task.status)}>{statusLabel(task.status)}</span></div>
      <div className="tasks-row-actions" role="cell">
        <details><summary aria-label={`Acciones de ${task.title}`}><MoreHorizontal size={17} /></summary><div><Link href={`/tareas/${task.id}`}>Abrir detalle</Link>{canManage && !terminalStates.has(task.status) ? <form action={completeTaskAction}><input type="hidden" name="id" value={task.id} /><button>Completar</button></form> : null}</div></details>
      </div>
    </article>
  );
}

type TaskRelation = { title: string; detail: string; icon: typeof FolderKanban; href?: string };

function relationMeta(task: TaskListItem, works: Map<string, { id: string; titulo: string; codigo: string | null; numeroInterno: string | null }>, clients: Map<string, { id: string; nombre: string }>): TaskRelation {
  if (task.workId) { const work = works.get(task.workId); return { title: "Trabajo", detail: work ? `${work.titulo} · ${work.codigo ?? work.numeroInterno ?? "Sin código"}` : "Trabajo vinculado", icon: FolderKanban, href: work ? `/obras/${task.workId}` : undefined }; }
  if (task.clientId) { const client = clients.get(task.clientId); return { title: "Cliente", detail: client?.nombre ?? "Cliente vinculado", icon: CircleUserRound, href: client ? `/clientes/${task.clientId}` : undefined }; }
  if (task.budgetId) return { title: "Presupuesto", detail: "Presupuesto vinculado", icon: FileText };
  if (task.invoiceId) return { title: "Factura", detail: "Factura vinculada", icon: FileText };
  if (task.documentId) return { title: "Documento", detail: "Documento vinculado", icon: FileText };
  return { title: "General", detail: task.origin === "manual" ? "Creada manualmente" : `Origen: ${statusLabel(task.origin)}`, icon: ClipboardCheck };
}

function matchesState(task: TaskListItem, state: string) {
  if (state === "all") return true;
  if (state === "pending") return !terminalStates.has(task.status);
  return task.status === state;
}

function matchesRelation(task: TaskListItem, relation: string) {
  if (relation === "all") return true;
  if (relation === "none") return !task.workId && !task.clientId && !task.budgetId && !task.invoiceId && !task.documentId;
  return relation === "work" ? Boolean(task.workId) : relation === "client" ? Boolean(task.clientId) : relation === "budget" ? Boolean(task.budgetId) : relation === "invoice" ? Boolean(task.invoiceId) : Boolean(task.documentId);
}

function matchesResponsible(task: TaskListItem, responsible: string, userId: string) {
  if (responsible === "team") return true;
  if (responsible === "mine") return task.assigneeId === userId || task.createdById === userId;
  if (responsible === "unassigned") return !task.assigneeId;
  return task.assigneeId === responsible;
}

function matchesPeriod(task: TaskListItem, period: string, startToday: Date, endToday: Date, endWeek: Date, startMonth: Date) {
  if (period === "all") return true;
  if (period === "month") return Boolean(task.completedAt && task.completedAt >= startMonth);
  if (!task.dueAt) return false;
  if (period === "today") return task.dueAt >= startToday && task.dueAt <= endToday;
  if (period === "week") return task.dueAt > endToday && task.dueAt <= endWeek;
  if (period === "overdue") return task.dueAt < startToday;
  return true;
}

function dueMeta(date: Date | null, now: Date) {
  if (!date) return { primary: "Sin fecha", secondary: "Planificación pendiente", tone: "muted" };
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const time = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (date < start) return { primary: date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }), secondary: "Vencida", tone: "danger" };
  if (date <= end) return { primary: `Hoy, ${time}`, secondary: "Vence hoy", tone: "danger" };
  const tomorrow = new Date(end); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date <= tomorrow) return { primary: `Mañana, ${time}`, secondary: "Próxima", tone: "warning" };
  return { primary: date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }), secondary: time, tone: "muted" };
}

function checklistSummary(task: TaskListItem) {
  if (!task.checklist.length) return `${task.subtasks.length} subtareas · ${task.dependencies.length} dependencias`;
  return `Checklist ${task.checklist.filter((item) => item.completed).length}/${task.checklist.length}`;
}

function categoryTone(category: string) { return category.includes("incid") ? "danger" : category.includes("comercial") ? "purple" : category.includes("document") ? "orange" : "blue"; }
function priorityTone(priority: string) { return priority === "urgent" || priority === "high" ? "danger" : priority === "medium" ? "warning" : "success"; }
function statusTone(status: string) { return status === "completed" ? "success" : status === "blocked" ? "danger" : status === "in_progress" ? "blue" : "muted"; }

function newTaskHref(query: TaskQuery) {
  const params = new URLSearchParams();
  if (query.workId) params.set("workId", query.workId);
  if (query.clientId) params.set("clientId", query.clientId);
  params.set("nuevo", "1");
  return `/tareas?${params.toString()}`;
}

function pageHref(query: TaskQuery, page: number) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value && key !== "pagina") params.set(key, value); });
  params.set("pagina", String(page));
  return `/tareas?${params.toString()}`;
}
