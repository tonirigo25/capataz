"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Flag,
  GitBranch,
  ListFilter,
  Plus,
  UserRound,
} from "lucide-react";

export type MilestonePlanningTask = {
  id: string;
  title: string;
  status: string;
  category?: string | null;
  milestone?: boolean | null;
  startsAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  assigneeName: string | null;
  progress: number | null;
  dependencies: Array<{ taskId: string; type: string }>;
};

export type MilestonePlanningWork = {
  id: string;
  nowIso: string;
  startsAt: string | null;
  dueAt: string | null;
};

type MilestoneFilter = "all" | "completed" | "active" | "upcoming" | "pending" | "risk";
type TimelineScale = "month" | "quarter";
type MilestoneState = Exclude<MilestoneFilter, "all"> | "cancelled";

type WorkPlanningMilestonesProps = {
  work: MilestonePlanningWork;
  tasks: MilestonePlanningTask[];
  canManage: boolean;
  createHref?: string | null;
};

const DAY = 86_400_000;
const milestoneCategories = new Set(["hito", "milestone"]);
const milestoneTitleMarker = /^\s*(?:\[hito\]|#hito\b|hito\s*:)[\s—–-]*/i;

const stateMeta: Record<MilestoneState, { label: string; badge: string; dot: string }> = {
  completed: {
    label: "Completado",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "border-emerald-600 bg-emerald-600 text-white",
  },
  active: {
    label: "En curso",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "border-blue-600 bg-blue-600 text-white",
  },
  upcoming: {
    label: "Próximo",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "border-amber-500 bg-amber-500 text-white",
  },
  pending: {
    label: "Pendiente",
    badge: "border-border bg-subtle text-content-secondary",
    dot: "border-slate-400 bg-surface text-slate-500",
  },
  risk: {
    label: "En riesgo",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "border-red-500 bg-red-500 text-white",
  },
  cancelled: {
    label: "Cancelado",
    badge: "border-border bg-subtle text-content-secondary",
    dot: "border-slate-300 bg-slate-200 text-slate-500",
  },
};

export function hasPersistentMilestoneMarker(task: MilestonePlanningTask) {
  const category = task.category?.trim().toLocaleLowerCase("es-ES") ?? "";
  return task.milestone === true || milestoneCategories.has(category) || milestoneTitleMarker.test(task.title);
}

function milestoneTitle(task: MilestonePlanningTask) {
  const title = task.title.replace(milestoneTitleMarker, "").trim();
  return title || task.title;
}

function dateValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null, withYear = true) {
  const date = dateValue(value);
  if (!date) return "Sin fecha objetivo";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

function normalizedProgress(task: MilestonePlanningTask) {
  if (task.status === "completed") return 100;
  if (typeof task.progress !== "number" || !Number.isFinite(task.progress)) return null;
  return Math.min(100, Math.max(0, Math.round(task.progress)));
}

function milestoneState(task: MilestonePlanningTask, now: Date): MilestoneState {
  if (["cancelled", "archived"].includes(task.status)) return "cancelled";
  if (task.status === "completed" || task.completedAt) return "completed";
  const dueAt = dateValue(task.dueAt);
  if (task.status === "blocked" || (dueAt && dueAt.getTime() < now.getTime())) return "risk";
  if (task.status === "in_progress") return "active";
  if (task.status === "planned" && dueAt) return "upcoming";
  return "pending";
}

function milestoneSort(a: MilestonePlanningTask, b: MilestonePlanningTask) {
  const aDate = dateValue(a.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDate = dateValue(b.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  return aDate - bDate || milestoneTitle(a).localeCompare(milestoneTitle(b), "es-ES");
}

function dependencyTypeLabel(type: string) {
  const labels: Record<string, string> = {
    finish_to_start: "Fin → inicio",
    start_to_start: "Inicio → inicio",
    finish_to_finish: "Fin → fin",
    start_to_finish: "Inicio → fin",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function timelineRange(tasks: MilestonePlanningTask[], work: MilestonePlanningWork) {
  const dates = [work.startsAt, work.dueAt, ...tasks.map((task) => task.dueAt)]
    .map(dateValue)
    .filter((date): date is Date => Boolean(date));
  if (!dates.length) return null;
  const first = Math.min(...dates.map((date) => date.getTime()));
  const last = Math.max(...dates.map((date) => date.getTime()));
  const start = new Date(first - 7 * DAY);
  const end = new Date(Math.max(last + 7 * DAY, start.getTime() + 28 * DAY));
  return { start, end, duration: Math.max(DAY, end.getTime() - start.getTime()) };
}

function milestonePosition(task: MilestonePlanningTask, range: ReturnType<typeof timelineRange>) {
  const dueAt = dateValue(task.dueAt);
  if (!dueAt || !range) return 0;
  return Math.min(98, Math.max(2, ((dueAt.getTime() - range.start.getTime()) / range.duration) * 100));
}

function StatusBadge({ state }: { state: MilestoneState }) {
  const meta = stateMeta[state];
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[10px] font-bold ${meta.badge}`}>{meta.label}</span>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "danger" }) {
  return (
    <div className="min-w-0 border-l border-border px-4 first:border-l-0 sm:px-5">
      <span className={`block text-[10px] font-semibold ${tone === "danger" ? "text-danger" : "text-content-secondary"}`}>{label}</span>
      <strong className={`mt-1 block text-2xl leading-none ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-content"}`}>{value}</strong>
    </div>
  );
}

function MilestoneIcon({ state, size = 16 }: { state: MilestoneState; size?: number }) {
  if (state === "completed") return <Check size={size} aria-hidden="true" />;
  if (state === "risk") return <AlertTriangle size={size} aria-hidden="true" />;
  if (state === "active") return <Clock3 size={size} aria-hidden="true" />;
  return <Circle size={size} aria-hidden="true" />;
}

export function WorkPlanningMilestones({ work, tasks, canManage, createHref }: WorkPlanningMilestonesProps) {
  const [filter, setFilter] = useState<MilestoneFilter>("all");
  const [scale, setScale] = useState<TimelineScale>("month");
  const now = useMemo(() => dateValue(work.nowIso) ?? new Date(), [work.nowIso]);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const milestones = useMemo(
    () => tasks.filter(hasPersistentMilestoneMarker).sort(milestoneSort),
    [tasks],
  );
  const filtered = useMemo(
    () => milestones.filter((task) => filter === "all" || milestoneState(task, now) === filter),
    [filter, milestones, now],
  );
  const dated = filtered.filter((task) => dateValue(task.dueAt));
  const undated = filtered.filter((task) => !dateValue(task.dueAt));
  const range = timelineRange(dated, work);
  const completedCount = milestones.filter((task) => milestoneState(task, now) === "completed").length;
  const activeCount = milestones.filter((task) => milestoneState(task, now) === "active").length;
  const pendingCount = milestones.filter((task) => ["upcoming", "pending"].includes(milestoneState(task, now))).length;
  const riskCount = milestones.filter((task) => milestoneState(task, now) === "risk").length;
  const withDependencies = filtered.filter((task) => task.dependencies.some((dependency) => tasksById.has(dependency.taskId)));
  const timelineWidth = Math.max(760, dated.length * (scale === "month" ? 180 : 128));

  if (!milestones.length) {
    return (
      <section className="rounded-xl border border-border bg-surface px-5 py-12 text-center shadow-soft" aria-labelledby="milestones-empty-title">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-content-secondary"><Flag size={22} aria-hidden="true" /></span>
        <h2 id="milestones-empty-title" className="mt-4 text-lg font-bold text-content">Todavía no hay hitos registrados</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-content-secondary">Esta vista sólo reconoce tareas marcadas de forma persistente como hito. Las fechas, dependencias y porcentajes no se deducen ni se inventan.</p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-content-tertiary">Marca la categoría de la tarea como “Hito” o utiliza al inicio del título la convención “Hito:”, “[HITO]” o “#hito”.</p>
        {canManage && createHref ? <Link href={createHref} className="primary-button mt-5 min-h-11"><Plus size={17} aria-hidden="true" /> Registrar hito</Link> : null}
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft" aria-label="Resumen de hitos registrados">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Flag size={17} className="text-brand-strong" aria-hidden="true" /><h2 className="text-sm font-bold text-content">Hitos del proyecto</h2></div>
            <p className="mt-1 text-xs text-content-secondary">Sólo tareas con marcador persistente · {filtered.length} visibles</p>
          </div>
          <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-5">
            <Metric label="Hitos totales" value={milestones.length} />
            <Metric label="Completados" value={completedCount} tone="success" />
            <Metric label="En curso" value={activeCount} />
            <Metric label="Pendientes" value={pendingCount} />
            <Metric label="En riesgo" value={riskCount} tone={riskCount ? "danger" : "success"} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-soft" aria-labelledby="milestone-timeline-title">
        <header className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="milestone-timeline-title" className="text-sm font-bold text-content">Línea de tiempo de hitos</h2>
            <p className="mt-1 text-[10px] text-content-secondary">Ordenada por la fecha objetivo persistida en cada tarea.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-content-secondary">
              <ListFilter size={15} aria-hidden="true" />
              <span className="sr-only">Filtrar hitos por estado</span>
              <select className="bg-transparent font-semibold text-content outline-none" value={filter} onChange={(event) => setFilter(event.target.value as MilestoneFilter)}>
                <option value="all">Todos los estados</option>
                <option value="completed">Completados</option>
                <option value="active">En curso</option>
                <option value="upcoming">Próximos</option>
                <option value="pending">Pendientes</option>
                <option value="risk">En riesgo</option>
              </select>
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-content-secondary">
              <span>Zoom</span>
              <select className="bg-transparent font-semibold text-content outline-none" value={scale} onChange={(event) => setScale(event.target.value as TimelineScale)}>
                <option value="month">Mes</option>
                <option value="quarter">Trimestre</option>
              </select>
            </label>
          </div>
        </header>

        {dated.length && range ? (
          <div className="mt-4 overflow-x-auto pb-2" tabIndex={0} role="region" aria-label="Cronología horizontal de hitos">
            <div className="relative min-h-[9.5rem]" style={{ width: timelineWidth }}>
              <div className="absolute left-4 right-4 top-12 border-t-2 border-border" aria-hidden="true" />
              <ol className="absolute inset-x-4 top-0 min-h-[9rem]">
                {dated.map((task) => {
                  const state = milestoneState(task, now);
                  const meta = stateMeta[state];
                  return (
                    <li key={task.id} className="absolute top-0 w-36 -translate-x-1/2 text-center" style={{ left: `${milestonePosition(task, range)}%` }}>
                      <time className="block text-[9px] font-semibold text-content-secondary" dateTime={task.dueAt ?? undefined}>{formatDate(task.dueAt, false)}</time>
                      <Link href={`/tareas/${task.id}`} aria-label={`${milestoneTitle(task)} · ${meta.label}`} className={`mx-auto mt-5 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ring-4 ring-surface ${meta.dot}`}><MilestoneIcon state={state} size={12} /></Link>
                      <Link href={`/tareas/${task.id}`} className="mt-2 block line-clamp-2 text-[10px] font-bold leading-4 text-content hover:underline">{milestoneTitle(task)}</Link>
                      <span className="mt-0.5 block text-[9px] text-content-secondary">{meta.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-subtle p-6 text-center">
            <CalendarDays size={22} className="mx-auto text-content-tertiary" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-content">No hay hitos con fecha para este filtro</p>
            <p className="mt-1 text-xs text-content-secondary">Los hitos sin fecha se conservan abajo; no se colocan en una posición estimada.</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-[10px] text-content-secondary" aria-label="Leyenda de estados">
          {(["completed", "active", "upcoming", "risk", "pending"] as MilestoneState[]).map((state) => <span key={state} className="inline-flex items-center gap-1.5"><span className={`inline-flex h-3 w-3 rounded-full border ${stateMeta[state].dot}`} aria-hidden="true" />{stateMeta[state].label}</span>)}
        </div>
      </section>

      <section aria-labelledby="next-milestones-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 id="next-milestones-title" className="text-sm font-bold text-content">Hitos registrados</h2><p className="mt-0.5 text-[10px] text-content-secondary">{filtered.length} coinciden con el filtro actual</p></div>
          {canManage && createHref ? <Link href={createHref} className="secondary-button min-h-11"><Plus size={16} aria-hidden="true" /> Nuevo hito</Link> : null}
        </div>
        {filtered.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map((task) => {
              const state = milestoneState(task, now);
              const progress = normalizedProgress(task);
              const dependencies = task.dependencies.map((dependency) => ({ dependency, task: tasksById.get(dependency.taskId) })).filter((item): item is { dependency: { taskId: string; type: string }; task: MilestonePlanningTask } => Boolean(item.task));
              return (
                <article key={task.id} className={`flex min-h-[14.5rem] min-w-0 flex-col rounded-xl border bg-surface p-3 ${state === "risk" ? "border-red-300" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2"><StatusBadge state={state} /><time className="text-[10px] font-semibold text-content-secondary" dateTime={task.dueAt ?? undefined}>{formatDate(task.dueAt)}</time></div>
                  <Link href={`/tareas/${task.id}`} className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-content hover:underline">{milestoneTitle(task)}</Link>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-content-secondary"><span>Avance verificado</span><strong className="text-content">{progress == null ? "—" : `${progress}%`}</strong></div>
                    {progress == null ? <p className="mt-1 text-[9px] text-content-tertiary">Sin checklist o estado completado.</p> : <progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={progress}>{progress}%</progress>}
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-[10px] font-bold text-content">Dependencias</p>
                    {dependencies.length ? <ul className="mt-2 grid gap-1.5">{dependencies.slice(0, 2).map(({ dependency, task: predecessor }) => <li key={`${task.id}-${dependency.taskId}`} className="flex min-w-0 items-center gap-2 text-[9px] text-content-secondary"><CheckCircle2 size={12} className={predecessor.status === "completed" ? "shrink-0 text-success" : "shrink-0 text-content-tertiary"} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{milestoneTitle(predecessor)}</span><span className="shrink-0">{dependencyTypeLabel(dependency.type)}</span></li>)}</ul> : <p className="mt-2 text-[9px] text-content-tertiary">Sin dependencias persistidas.</p>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[10px] text-content-secondary"><span className="inline-flex min-w-0 items-center gap-1.5"><UserRound size={13} aria-hidden="true" /><span className="truncate">{task.assigneeName ?? "Sin responsable"}</span></span><Link href={`/tareas/${task.id}`} aria-label={`Abrir ${milestoneTitle(task)}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border text-content hover:bg-subtle"><ChevronRight size={15} aria-hidden="true" /></Link></div>
                </article>
              );
            })}
          </div>
        ) : <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-content-secondary">No hay hitos que coincidan con el filtro seleccionado.</div>}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft" aria-labelledby="milestone-dependencies-title">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><GitBranch size={16} className="text-brand-strong" aria-hidden="true" /><h2 id="milestone-dependencies-title" className="text-sm font-bold text-content">Hitos con dependencias registradas</h2></div><span className="text-[10px] text-content-secondary">{withDependencies.length}</span></header>
          {withDependencies.length ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de dependencias de hitos"><table className="w-full min-w-[40rem] border-collapse text-left text-[10px]"><thead className="bg-subtle text-content-secondary"><tr><th className="px-4 py-2 font-semibold">Hito</th><th className="px-3 py-2 font-semibold">Fecha objetivo</th><th className="px-3 py-2 font-semibold">Dependencias</th><th className="px-3 py-2 font-semibold">Estado</th><th className="w-10 px-3 py-2"><span className="sr-only">Abrir</span></th></tr></thead><tbody className="divide-y divide-border">{withDependencies.map((task) => { const state = milestoneState(task, now); const count = task.dependencies.filter((dependency) => tasksById.has(dependency.taskId)).length; return <tr key={task.id}><td className="px-4 py-3 font-semibold text-content">{milestoneTitle(task)}</td><td className="px-3 py-3 text-content-secondary">{formatDate(task.dueAt)}</td><td className="px-3 py-3 text-content-secondary">{count} {count === 1 ? "relación" : "relaciones"}</td><td className="px-3 py-3"><StatusBadge state={state} /></td><td className="px-3 py-3"><Link href={`/tareas/${task.id}`} aria-label={`Abrir ${milestoneTitle(task)}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-content hover:bg-subtle"><ChevronRight size={15} aria-hidden="true" /></Link></td></tr>; })}</tbody></table></div> : <p className="p-5 text-sm text-content-secondary">No hay dependencias persistidas entre las tareas visibles. No se calcula una ruta crítica supuesta.</p>}
        </section>

        <section className="rounded-xl border border-border bg-surface shadow-soft" aria-labelledby="undated-milestones-title">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><CalendarDays size={16} className="text-brand-strong" aria-hidden="true" /><h2 id="undated-milestones-title" className="text-sm font-bold text-content">Sin fecha objetivo</h2></div><span className="text-[10px] text-content-secondary">{undated.length}</span></header>
          {undated.length ? <ul className="divide-y divide-border">{undated.map((task) => <li key={task.id}><Link href={`/tareas/${task.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-xs font-semibold text-content hover:bg-subtle"><span className="min-w-0 truncate">{milestoneTitle(task)}</span><ChevronRight size={14} className="shrink-0 text-content-tertiary" aria-hidden="true" /></Link></li>)}</ul> : <div className="p-5"><CheckCircle2 size={20} className="text-success" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-content">Todos los hitos visibles tienen fecha</p><p className="mt-1 text-xs leading-5 text-content-secondary">La fecha procede del vencimiento registrado en cada tarea.</p></div>}
        </section>
      </div>
    </div>
  );
}
