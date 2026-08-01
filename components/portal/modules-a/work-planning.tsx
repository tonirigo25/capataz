"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Filter,
  GitBranch,
  Minus,
  Package,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";

export type PlanningTaskView = {
  id: string;
  title: string;
  status: string;
  parentTaskId: string | null;
  startsAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  assigneeName: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  progress: number | null;
  dependencies: Array<{ taskId: string; type: string }>;
};

type PlanningWorkView = {
  id: string;
  clientId: string;
  startsAt: string | null;
  dueAt: string | null;
  responsible: string | null;
  materials: Array<{ id: string; name: string; status: string; quantity: string }>;
  events: Array<{ id: string; title: string; startsAt: string; endsAt: string | null }>;
};

type PlanningProps = { work: PlanningWorkView; tasks: PlanningTaskView[]; canManage: boolean };

const terminalStatuses = new Set(["completed", "cancelled", "archived"]);
const DAY = 86_400_000;

function dateValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function taskIsLate(task: PlanningTaskView, now = new Date()) {
  const dueAt = dateValue(task.dueAt);
  return Boolean(dueAt && dueAt < now && !terminalStatuses.has(task.status));
}

function planningRange(tasks: PlanningTaskView[], work: PlanningWorkView) {
  const dates = [work.startsAt, work.dueAt, ...tasks.flatMap((task) => [task.startsAt, task.dueAt])]
    .map(dateValue)
    .filter((date): date is Date => Boolean(date));
  const today = new Date();
  const min = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const max = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : new Date(min.getTime() + 42 * DAY);
  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate() - 3);
  const rawEnd = new Date(max.getFullYear(), max.getMonth(), max.getDate() + 7);
  const end = rawEnd.getTime() <= start.getTime() ? new Date(start.getTime() + 42 * DAY) : rawEnd;
  return { start, end, days: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY)) };
}

function taskProgress(task: PlanningTaskView) {
  return task.progress ?? (task.status === "completed" ? 100 : null);
}

function taskTone(task: PlanningTaskView) {
  if (taskIsLate(task)) return "late";
  if (task.status === "completed") return "done";
  if (task.status === "blocked") return "blocked";
  if (task.status === "in_progress") return "active";
  return "planned";
}

function formatCompactDate(value: string | null) {
  if (!value) return "Sin fecha";
  return formatDate(new Date(value));
}

function buildHierarchy(tasks: PlanningTaskView[]) {
  const byParent = new Map<string | null, PlanningTaskView[]>();
  for (const task of tasks) {
    const key = task.parentTaskId && tasks.some((item) => item.id === task.parentTaskId) ? task.parentTaskId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), task]);
  }
  const result: Array<{ task: PlanningTaskView; depth: number; hasChildren: boolean }> = [];
  const visit = (parentId: string | null, depth: number, visited: Set<string>) => {
    for (const task of byParent.get(parentId) ?? []) {
      if (visited.has(task.id)) continue;
      visited.add(task.id);
      const children = byParent.get(task.id) ?? [];
      result.push({ task, depth, hasChildren: children.length > 0 });
      visit(task.id, depth + 1, visited);
    }
  };
  visit(null, 0, new Set());
  return result;
}

function axisLabels(start: Date, end: Date, stepDays: number) {
  const result: Date[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += stepDays * DAY) result.push(new Date(time));
  return result.slice(0, 36);
}

function PlanningTimeline({ tasks, compact = false, query = "", status = "all", zoom = 1 }: { tasks: PlanningTaskView[]; compact?: boolean; query?: string; status?: string; zoom?: number }) {
  const workStub: PlanningWorkView = { id: "", clientId: "", startsAt: null, dueAt: null, responsible: null, materials: [], events: [] };
  const range = planningRange(tasks, workStub);
  const filtered = tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase()) && (status === "all" || task.status === status));
  const hierarchy = buildHierarchy(filtered).slice(0, compact ? 11 : 30);
  const timelineWidth = Math.max(compact ? 570 : 760, Math.round(range.days * (compact ? 8 : 12) * zoom));
  const labels = axisLabels(range.start, range.end, range.days > 120 ? 14 : 7);
  const dayWidth = timelineWidth / range.days;
  const rowHeight = compact ? 25 : 31;
  return (
    <div className="planning-gantt-shell" style={{ "--planning-row": `${rowHeight}px` } as React.CSSProperties}>
      <div className="planning-gantt-table" aria-label="Tareas planificadas">
        <div className="planning-gantt-heading"><span>Actividad</span><span>Responsable</span><span>Inicio</span><span>Fin</span></div>
        {hierarchy.length ? hierarchy.map(({ task, depth, hasChildren }, index) => <Link key={task.id} href={`/tareas/${task.id}`} className="planning-gantt-task-row" style={{ "--task-depth": depth } as React.CSSProperties}>
          <span className="planning-gantt-task-title"><span className={`planning-task-dot planning-task-dot--${taskTone(task)}`} />{hasChildren ? <ChevronDown size={12} aria-hidden="true" /> : <span className="planning-leaf-index">{String(index + 1).padStart(2, "0")}</span>}<strong>{task.title}</strong></span>
          <span>{task.assigneeName ?? "Sin asignar"}</span><span>{formatCompactDate(task.startsAt)}</span><span>{formatCompactDate(task.dueAt)}</span>
        </Link>) : <div className="planning-gantt-empty">No hay tareas que coincidan con los filtros.</div>}
      </div>
      <div className="planning-gantt-scroll" tabIndex={0} aria-label="Cronograma desplazable">
        <div className="planning-gantt-canvas" style={{ width: timelineWidth }}>
          <div className="planning-gantt-axis">{labels.map((date) => <span key={date.toISOString()} style={{ left: Math.max(0, ((date.getTime() - range.start.getTime()) / DAY) * dayWidth) }}>{date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>)}</div>
          <div className="planning-today-line" style={{ left: Math.max(0, Math.min(timelineWidth, ((Date.now() - range.start.getTime()) / DAY) * dayWidth)) }}><span>Hoy</span></div>
          {hierarchy.map(({ task }, index) => {
            const start = dateValue(task.startsAt);
            const end = dateValue(task.dueAt);
            const left = start ? Math.max(0, ((start.getTime() - range.start.getTime()) / DAY) * dayWidth) : 6;
            const width = start && end ? Math.max(18, ((end.getTime() - start.getTime()) / DAY + 1) * dayWidth) : Math.max(58, timelineWidth * .08);
            const progress = taskProgress(task);
            return <Link key={task.id} href={`/tareas/${task.id}`} className={`planning-gantt-bar planning-gantt-bar--${taskTone(task)}`} style={{ top: 34 + index * rowHeight, left, width }} title={`${task.title} · ${formatCompactDate(task.startsAt)} — ${formatCompactDate(task.dueAt)}`}><span style={{ width: `${progress ?? 0}%` }} /><strong>{task.title}</strong></Link>;
          })}
        </div>
      </div>
    </div>
  );
}

function PlanningMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <article className={`planning-metric planning-metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function PlanningCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="planning-card"><header><h2>{title}</h2>{action}</header>{children}</section>;
}

export function WorkPlanningSummary({ work, tasks, canManage }: PlanningProps) {
  const completed = tasks.filter((task) => task.status === "completed");
  const late = tasks.filter((task) => taskIsLate(task));
  const notStarted = tasks.filter((task) => ["todo", "pending", "planned"].includes(task.status));
  const progressValues = tasks.map(taskProgress).filter((value): value is number => value != null);
  const verifiedProgress = progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : null;
  const dependencies = tasks.flatMap((task) => task.dependencies.map((dependency) => ({ task, dependency }))).slice(0, 4);
  const upcoming = tasks.filter((task) => task.dueAt && !terminalStatuses.has(task.status)).sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime()).slice(0, 5);
  const people = Array.from(new Set(tasks.map((task) => task.assigneeName).filter(Boolean))) as string[];
  const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta", "en_transito"].includes(material.status)).slice(0, 4);
  return <div className="planning-summary-grid">
    <section className="planning-card planning-summary-timeline"><header><div><p className="planning-eyebrow">Cronograma de la obra</p><h2>Planificación registrada</h2></div><div className="planning-legend"><span data-tone="done">Completada</span><span data-tone="active">En curso</span><span data-tone="late">Retraso</span></div></header><PlanningTimeline tasks={tasks} compact /></section>
    <section className="planning-card planning-summary-metrics"><header><h2>Resumen de planificación</h2></header><div className="planning-metric-grid"><PlanningMetric label="Avance verificado" value={verifiedProgress == null ? "—" : `${verifiedProgress}%`} detail={verifiedProgress == null ? "Sin checklist suficiente" : `${progressValues.length} tareas con señal`} tone="success" /><PlanningMetric label="Actividades totales" value={String(tasks.length)} detail="Tareas vinculadas" /><PlanningMetric label="Completadas" value={String(completed.length)} detail="Estado confirmado" tone="success" /><PlanningMetric label="Con retraso" value={String(late.length)} detail="Vencimiento superado" tone={late.length ? "danger" : "success"} /><PlanningMetric label="Sin empezar" value={String(notStarted.length)} detail="Estado persistido" /><PlanningMetric label="Fin estimado" value={formatCompactDate(work.dueAt)} detail="Fecha de la obra" /></div></section>

    <PlanningCard title="Estado de tareas" action={<Link href={`/obras/${work.id}/planificacion/gantt`}>Abrir Gantt</Link>}><div className="planning-list">{tasks.slice(0, 6).map((task) => <Link key={task.id} href={`/tareas/${task.id}`}><span className={`planning-task-dot planning-task-dot--${taskTone(task)}`} /><strong>{task.title}</strong><span>{taskProgress(task) == null ? statusLabel(task.status) : `${taskProgress(task)}%`}</span></Link>)}</div></PlanningCard>
    <PlanningCard title="Próximas fechas" action={<Link href={`/obras/${work.id}/planificacion/hitos`}>Ver hitos</Link>}><div className="planning-list">{upcoming.length ? upcoming.map((task) => <Link key={task.id} href={`/tareas/${task.id}`}><CalendarDays size={14} /><strong>{task.title}</strong><span>{formatCompactDate(task.dueAt)}</span></Link>) : <p className="planning-honest-empty">Hay {tasks.filter((task) => !terminalStatuses.has(task.status)).length} tareas activas sin vencimiento registrado.</p>}</div></PlanningCard>
    <PlanningCard title="Dependencias registradas" action={<Link href={`/obras/${work.id}/planificacion/dependencias`}>Ver mapa</Link>}><div className="planning-list">{dependencies.length ? dependencies.map(({ task, dependency }) => <Link key={`${task.id}-${dependency.taskId}`} href={`/tareas/${task.id}`}><GitBranch size={14} /><strong>{tasks.find((item) => item.id === dependency.taskId)?.title ?? "Tarea predecesora"}</strong><span>→ {task.title}</span></Link>) : <p className="planning-honest-empty">Aún no hay relaciones persistidas. La secuencia no se inventa.</p>}</div></PlanningCard>

    <PlanningCard title="Agenda de la obra" action={<Link href={`/obras/${work.id}/planificacion/calendario`}>Ver agenda</Link>}><div className="planning-list planning-list--compact">{work.events.slice(0, 4).map((event) => <Link key={event.id} href="/agenda"><CalendarDays size={13} /><strong>{event.title}</strong><span>{formatCompactDate(event.startsAt)}</span></Link>)}{work.events.length === 0 ? <p className="planning-honest-empty">Sin eventos registrados para esta obra.</p> : null}</div></PlanningCard>
    <PlanningCard title="Recursos asignados" action={<Link href={`/obras/${work.id}/planificacion/recursos`}>Ver recursos</Link>}><div className="planning-donut-row"><div className="planning-count-orb"><strong>{people.length}</strong><span>personas</span></div><ul>{people.slice(0, 4).map((person) => <li key={person}><Users size={13} />{person}</li>)}{people.length === 0 ? <li><Users size={13} />{work.responsible ?? "Sin responsables asignados"}</li> : null}</ul></div></PlanningCard>
    <PlanningCard title="Entrega de materiales" action={<Link href={`/obras/${work.id}/planificacion/recursos`}>Ver materiales</Link>}><div className="planning-list planning-list--compact">{pendingMaterials.map((material) => <span key={material.id}><Package size={13} /><strong>{material.name}</strong><em>{statusLabel(material.status)}</em></span>)}{pendingMaterials.length === 0 ? <p className="planning-honest-empty">No hay materiales pendientes registrados.</p> : null}</div></PlanningCard>
    <PlanningCard title="Controles e inspecciones" action={<Link href={`/obras/${work.id}/documentos`}>Abrir expediente</Link>}><div className="planning-control-state"><CheckCircle2 size={20} /><strong>Expediente disponible</strong><p>Las inspecciones sólo aparecen cuando existe un evento o documento trazable.</p></div></PlanningCard>
    <PlanningCard title="Permisos y decisiones" action={canManage ? <Link href={`/gestion?tipo=documento&clientId=${work.clientId}&workId=${work.id}`}>Registrar</Link> : undefined}><div className="planning-control-state"><CircleDot size={20} /><strong>Control humano activo</strong><p>No se atribuyen permisos, licencias ni decisiones inexistentes.</p></div></PlanningCard>
  </div>;
}

export function WorkPlanningGantt({ work, tasks, canManage }: PlanningProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [zoom, setZoom] = useState(1);
  const visibleCount = useMemo(() => tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase()) && (status === "all" || task.status === status)).length, [query, status, tasks]);
  const late = tasks.filter((task) => taskIsLate(task));
  const dependencies = tasks.flatMap((task) => task.dependencies.map((dependency) => ({ task, dependency })));
  return <div className="planning-gantt-page">
    <section className="planning-gantt-toolbar" aria-label="Controles del diagrama de Gantt">
      <label><span className="sr-only">Filtrar por estado</span><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas las tareas</option><option value="todo">Pendientes</option><option value="in_progress">En curso</option><option value="blocked">Bloqueadas</option><option value="completed">Completadas</option></select></label>
      <label className="planning-search"><Search size={15} /><span className="sr-only">Buscar tarea</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarea…" /></label>
      <span className="planning-visible-count">{visibleCount} visibles</span>
      <div className="planning-zoom"><span>Semana</span><button type="button" aria-label="Alejar cronograma" onClick={() => setZoom((value) => Math.max(.65, Number((value - .15).toFixed(2))))}><Minus size={15} /></button><button type="button" aria-label="Acercar cronograma" onClick={() => setZoom((value) => Math.min(1.8, Number((value + .15).toFixed(2))))}><Plus size={15} /></button></div>
    </section>
    <section className="planning-card planning-gantt-primary"><header><div><p className="planning-eyebrow">Diagrama de Gantt</p><h2>Secuencia técnica registrada</h2></div>{canManage ? <Link href={`/tareas?filtro=team&nuevo=1&workId=${work.id}&clientId=${work.clientId}`}>Añadir tarea</Link> : null}</header><PlanningTimeline tasks={tasks} query={query} status={status} zoom={zoom} /></section>
    <div className="planning-gantt-bottom">
      <PlanningCard title="Resumen de planificación"><dl><div><dt>Actividades</dt><dd>{tasks.length}</dd></div><div><dt>Completadas</dt><dd>{tasks.filter((task) => task.status === "completed").length}</dd></div><div><dt>Con retraso</dt><dd>{late.length}</dd></div><div><dt>Fin previsto</dt><dd>{formatCompactDate(work.dueAt)}</dd></div></dl></PlanningCard>
      <PlanningCard title="Fechas clave" action={<Link href={`/obras/${work.id}/planificacion/hitos`}>Ver hitos</Link>}><div className="planning-list planning-list--compact">{tasks.filter((task) => task.dueAt).slice(0, 5).map((task) => <Link key={task.id} href={`/tareas/${task.id}`}><CalendarDays size={13} /><strong>{task.title}</strong><span>{formatCompactDate(task.dueAt)}</span></Link>)}{tasks.every((task) => !task.dueAt) ? <p className="planning-honest-empty">No hay fechas de tarea registradas.</p> : null}</div></PlanningCard>
      <PlanningCard title="Ruta crítica"><div className="planning-control-state"><GitBranch size={20} /><strong>No calculable todavía</strong><p>Se requiere un grafo acíclico y fechas completas. No se resalta una ruta supuesta.</p></div></PlanningCard>
      <PlanningCard title={`Dependencias críticas · ${dependencies.length}`} action={<Link href={`/obras/${work.id}/planificacion/dependencias`}>Ver todas</Link>}><div className="planning-list planning-list--compact">{dependencies.slice(0, 4).map(({ task, dependency }) => <Link key={`${task.id}-${dependency.taskId}`} href={`/tareas/${task.id}`}><ChevronRight size={13} /><strong>{dependency.type.replaceAll("_", " ")}</strong><span>{task.title}</span></Link>)}{dependencies.length === 0 ? <p className="planning-honest-empty">Sin dependencias persistidas.</p> : null}</div></PlanningCard>
    </div>
  </div>;
}
