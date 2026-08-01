"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Flag,
  List,
  Package,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { statusLabel } from "@/lib/status";

export type PlanningCalendarTask = {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  dueAt: string | null;
  assigneeName: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  category?: string | null;
};

export type PlanningCalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  type?: string | null;
  location?: string | null;
  assigneeName?: string | null;
  allDay?: boolean;
  href?: string;
};

type PlanningCalendarProps = {
  workId: string;
  tasks: PlanningCalendarTask[];
  events: PlanningCalendarEvent[];
  nowIso?: string;
  createEventHref?: string;
};

type CalendarView = "month" | "week" | "list";
type CalendarKind = "task" | "milestone" | "inspection" | "delivery" | "meeting" | "event";

type CalendarItem = {
  id: string;
  sourceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  kind: CalendarKind;
  status: string | null;
  assigneeName: string | null;
  location: string | null;
  estimatedMinutes: number | null;
  href: string;
};

const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

const kindLabel: Record<CalendarKind, string> = {
  task: "Tarea",
  milestone: "Hito",
  inspection: "Inspección",
  delivery: "Entrega",
  meeting: "Reunión",
  event: "Evento",
};

const kindTone: Record<CalendarKind, string> = {
  task: "border-blue-200 bg-blue-50 text-blue-800",
  milestone: "border-violet-200 bg-violet-50 text-violet-800",
  inspection: "border-amber-200 bg-amber-50 text-amber-800",
  delivery: "border-emerald-200 bg-emerald-50 text-emerald-800",
  meeting: "border-cyan-200 bg-cyan-50 text-cyan-800",
  event: "border-slate-200 bg-slate-50 text-slate-700",
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function startOfWeek(value: Date) {
  const day = value.getDay() || 7;
  return addDays(startOfDay(value), 1 - day);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function normalizeKind(value: string | null | undefined, fallback: CalendarKind): CalendarKind {
  const normalized = (value ?? "").trim().toLocaleLowerCase("es-ES").replaceAll("_", " ");
  if (/hito|milestone/.test(normalized)) return "milestone";
  if (/inspecci|control|revisi/.test(normalized)) return "inspection";
  if (/entrega|material|suministro/.test(normalized)) return "delivery";
  if (/reuni|visita/.test(normalized)) return "meeting";
  return fallback;
}

function itemTime(item: CalendarItem) {
  if (item.allDay) return "Todo el día";
  const start = timeFormatter.format(item.startsAt);
  return item.endsAt ? `${start}–${timeFormatter.format(item.endsAt)}` : start;
}

function itemIcon(kind: CalendarKind) {
  if (kind === "milestone") return Flag;
  if (kind === "inspection") return ClipboardCheck;
  if (kind === "delivery") return Package;
  if (kind === "meeting") return Users;
  if (kind === "task") return CircleDot;
  return CalendarDays;
}

function CalendarItemLink({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  const Icon = itemIcon(item.kind);
  return (
    <Link
      href={item.href}
      className={`group block min-w-0 rounded-md border px-2 py-1.5 transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${kindTone[item.kind]}`}
      title={`${kindLabel[item.kind]} · ${item.title} · ${itemTime(item)}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon size={compact ? 11 : 13} className="shrink-0" aria-hidden="true" />
        <strong className="truncate text-[10px] font-bold">{item.title}</strong>
      </span>
      {!compact ? <span className="mt-1 block truncate text-[9px] opacity-80">{itemTime(item)}{item.assigneeName ? ` · ${item.assigneeName}` : ""}</span> : null}
    </Link>
  );
}

function CalendarMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof CalendarDays }) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"><Icon size={16} aria-hidden="true" /></span>
        <div className="min-w-0">
          <span className="block truncate text-[9px] font-semibold text-content-secondary">{label}</span>
          <strong className="mt-1 block truncate text-lg font-black tabular-nums text-content">{value}</strong>
          <small className="mt-1 block truncate text-[8px] text-content-tertiary">{detail}</small>
        </div>
      </div>
    </article>
  );
}

export function WorkPlanningCalendar({ workId, tasks, events, nowIso, createEventHref }: PlanningCalendarProps) {
  const id = useId();
  const today = useMemo(() => startOfDay(parseDate(nowIso) ?? new Date()), [nowIso]);
  const items = useMemo<CalendarItem[]>(() => {
    const taskItems = tasks.flatMap((task) => {
      const date = parseDate(task.dueAt ?? task.startsAt);
      if (!date) return [];
      return [{
        id: `task-${task.id}`,
        sourceId: task.id,
        title: task.title,
        startsAt: date,
        endsAt: null,
        allDay: true,
        kind: normalizeKind(task.category, "task"),
        status: task.status,
        assigneeName: task.assigneeName,
        location: null,
        estimatedMinutes: task.estimatedMinutes,
        href: `/tareas/${task.id}`,
      } satisfies CalendarItem];
    });
    const eventItems = events.flatMap((event) => {
      const startsAt = parseDate(event.startsAt);
      if (!startsAt) return [];
      return [{
        id: `event-${event.id}`,
        sourceId: event.id,
        title: event.title,
        startsAt,
        endsAt: parseDate(event.endsAt),
        allDay: Boolean(event.allDay),
        kind: normalizeKind(event.type, "event"),
        status: null,
        assigneeName: event.assigneeName ?? null,
        location: event.location ?? null,
        estimatedMinutes: null,
        href: event.href ?? "/agenda",
      } satisfies CalendarItem];
    });
    return [...taskItems, ...eventItems].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.title.localeCompare(b.title, "es"));
  }, [events, tasks]);

  const firstItemDate = items[0]?.startsAt ?? today;
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(firstItemDate));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CalendarKind | "all">("all");
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");

  const statusOptions = useMemo(() => Array.from(new Set(items.map((item) => item.status).filter((value): value is string => Boolean(value)))).sort(), [items]);
  const assigneeOptions = useMemo(() => Array.from(new Set(items.map((item) => item.assigneeName).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "es")), [items]);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es-ES");
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (status !== "all" && item.status !== status) return false;
      if (assignee !== "all" && item.assigneeName !== assignee) return false;
      return !needle || `${item.title} ${item.location ?? ""} ${item.assigneeName ?? ""}`.toLocaleLowerCase("es-ES").includes(needle);
    });
  }, [assignee, items, kind, query, status]);

  const weekStart = startOfWeek(cursor);
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const periodStart = view === "week" ? weekStart : monthStart;
  const periodEnd = view === "week" ? addDays(weekStart, 7) : new Date(monthEnd.getTime() + 1);
  const periodItems = filteredItems.filter((item) => item.startsAt >= periodStart && item.startsAt < periodEnd);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of filteredItems) map.set(dateKey(item.startsAt), [...(map.get(dateKey(item.startsAt)) ?? []), item]);
    return map;
  }, [filteredItems]);

  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const taskCount = periodItems.filter((item) => item.kind === "task").length;
  const milestoneCount = periodItems.filter((item) => item.kind === "milestone").length;
  const eventCount = periodItems.filter((item) => item.id.startsWith("event-")).length;
  const plannedMinutes = periodItems.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const responsibleCount = new Set(periodItems.map((item) => item.assigneeName).filter(Boolean)).size;

  const moveCursor = (direction: -1 | 1) => {
    if (view === "week") setCursor((value) => addDays(value, direction * 7));
    else setCursor((value) => new Date(value.getFullYear(), value.getMonth() + direction, 1));
  };
  const visibleTitle = view === "week"
    ? `${shortDateFormatter.format(weekDays[0])} – ${shortDateFormatter.format(weekDays[6])}`
    : monthFormatter.format(cursor);

  return (
    <div className="grid min-w-0 gap-3" data-work-planning-calendar={workId}>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between" aria-label="Controles del calendario">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-subtle p-1" role="tablist" aria-label="Vista del calendario">
            {([{"id":"month","label":"Mes","icon":CalendarDays},{"id":"week","label":"Semana","icon":CalendarRange},{"id":"list","label":"Lista","icon":List}] as const).map(({ id: viewId, label, icon: Icon }) => (
              <button key={viewId} type="button" role="tab" aria-selected={view === viewId} onClick={() => setView(viewId)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold ${view === viewId ? "bg-surface text-brand-strong shadow-sm" : "text-content-secondary hover:text-content"}`}><Icon size={14} aria-hidden="true" />{label}</button>
            ))}
          </div>
          <div className="inline-flex items-center rounded-lg border border-border bg-surface">
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center text-content-secondary hover:text-content" onClick={() => moveCursor(-1)} aria-label={view === "week" ? "Semana anterior" : "Mes anterior"}><ChevronLeft size={17} aria-hidden="true" /></button>
            <button type="button" className="min-h-10 border-x border-border px-3 text-xs font-bold text-content" onClick={() => setCursor(view === "week" ? startOfWeek(today) : startOfMonth(today))}>Hoy</button>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center text-content-secondary hover:text-content" onClick={() => moveCursor(1)} aria-label={view === "week" ? "Semana siguiente" : "Mes siguiente"}><ChevronRight size={17} aria-hidden="true" /></button>
          </div>
          <strong className="min-w-0 capitalize text-sm font-black text-content" aria-live="polite">{visibleTitle}</strong>
        </div>
        {createEventHref ? <Link href={createEventHref} className="primary-button justify-center"><Plus size={16} aria-hidden="true" />Nuevo evento</Link> : null}
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores del periodo visible">
        <CalendarMetric label="Elementos del periodo" value={String(periodItems.length)} detail="Registros visibles" icon={CalendarDays} />
        <CalendarMetric label="Tareas con fecha" value={String(taskCount)} detail="Vencimiento o inicio" icon={CircleDot} />
        <CalendarMetric label="Hitos registrados" value={String(milestoneCount)} detail="Categoría persistida" icon={Flag} />
        <CalendarMetric label="Eventos" value={String(eventCount)} detail="Agenda de la obra" icon={CalendarRange} />
        <CalendarMetric label="Horas planificadas" value={plannedMinutes ? `${Math.round(plannedMinutes / 60)} h` : "—"} detail={plannedMinutes ? "Estimación registrada" : "Sin estimación"} icon={Clock3} />
        <CalendarMetric label="Responsables" value={String(responsibleCount)} detail="Con elementos visibles" icon={Users} />
      </section>

      <section className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(9rem,auto))]" aria-label="Filtros del calendario">
        <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border px-3" htmlFor={`${id}-search`}><Search size={15} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar en el calendario</span><input id={`${id}-search`} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-content outline-none" placeholder="Buscar tarea, evento o responsable…" /></label>
        <label className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border px-3 text-xs text-content-secondary" htmlFor={`${id}-kind`}><span>Tipo</span><select id={`${id}-kind`} value={kind} onChange={(event) => setKind(event.target.value as CalendarKind | "all")} className="min-w-0 bg-transparent font-bold text-content outline-none"><option value="all">Todos</option>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border px-3 text-xs text-content-secondary" htmlFor={`${id}-status`}><span>Estado</span><select id={`${id}-status`} value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-0 bg-transparent font-bold text-content outline-none"><option value="all">Todos</option>{statusOptions.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
        <label className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border px-3 text-xs text-content-secondary" htmlFor={`${id}-assignee`}><span>Responsable</span><select id={`${id}-assignee`} value={assignee} onChange={(event) => setAssignee(event.target.value)} className="min-w-0 bg-transparent font-bold text-content outline-none"><option value="all">Todos</option>{assigneeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </section>

      {view === "month" ? (
        <section className="overflow-x-auto rounded-xl border border-border bg-surface" aria-label={`Calendario de ${monthFormatter.format(cursor)}`}>
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-border bg-subtle text-center text-[10px] font-bold uppercase tracking-wide text-content-secondary">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <span key={day} className="px-2 py-2">{day}</span>)}</div>
            <div className="grid grid-cols-7">
              {monthDays.map((day) => {
                const dayItems = itemsByDay.get(dateKey(day)) ?? [];
                const currentMonth = day.getMonth() === cursor.getMonth();
                const isToday = dateKey(day) === dateKey(today);
                return <article key={day.toISOString()} className={`min-h-28 border-b border-r border-border p-2 ${currentMonth ? "bg-surface" : "bg-subtle/50"}`} aria-label={fullDateFormatter.format(day)}><time dateTime={dateKey(day)} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold ${isToday ? "bg-brand text-white" : currentMonth ? "text-content" : "text-content-tertiary"}`}>{day.getDate()}</time><div className="mt-1 grid gap-1">{dayItems.slice(0, 3).map((item) => <CalendarItemLink key={item.id} item={item} compact />)}{dayItems.length > 3 ? <span className="text-[9px] font-semibold text-content-secondary">+{dayItems.length - 3} más</span> : null}</div></article>;
              })}
            </div>
          </div>
        </section>
      ) : null}

      {view === "week" ? (
        <section className="overflow-x-auto rounded-xl border border-border bg-surface" aria-label={`Semana ${visibleTitle}`}>
          <div className="grid min-w-[760px] grid-cols-7">
            {weekDays.map((day) => { const dayItems = itemsByDay.get(dateKey(day)) ?? []; const isToday = dateKey(day) === dateKey(today); return <article key={day.toISOString()} className="min-h-[28rem] border-r border-border p-2 last:border-r-0"><header className={`mb-3 rounded-lg p-2 text-center ${isToday ? "bg-brand-soft text-brand-strong" : "bg-subtle text-content"}`}><span className="block text-[9px] font-semibold uppercase">{day.toLocaleDateString("es-ES", { weekday: "short" })}</span><strong className="mt-1 block text-lg">{day.getDate()}</strong></header><div className="grid gap-2">{dayItems.map((item) => <CalendarItemLink key={item.id} item={item} />)}{dayItems.length === 0 ? <p className="rounded-lg border border-dashed border-border p-3 text-center text-[9px] text-content-tertiary">Sin registros</p> : null}</div></article>; })}
          </div>
        </section>
      ) : null}

      {view === "list" ? (
        <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label={`Lista de ${monthFormatter.format(cursor)}`}>
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-black text-content">Agenda del periodo</h2><p className="mt-1 text-[10px] text-content-secondary">Sólo tareas y eventos con fecha registrada.</p></div><span className="rounded-full bg-subtle px-2.5 py-1 text-[10px] font-bold text-content-secondary">{periodItems.length}</span></header>
          {periodItems.length ? <ul className="divide-y divide-border">{periodItems.map((item) => { const Icon = itemIcon(item.kind); return <li key={item.id}><Link href={item.href} className="grid min-h-16 grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand"><time dateTime={item.startsAt.toISOString()} className="text-[10px] font-bold capitalize text-content-secondary">{shortDateFormatter.format(item.startsAt)}</time><span className="flex min-w-0 items-center gap-2"><span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${kindTone[item.kind]}`}><Icon size={15} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-xs text-content">{item.title}</strong><small className="mt-1 block truncate text-[9px] text-content-secondary">{kindLabel[item.kind]}{item.assigneeName ? ` · ${item.assigneeName}` : ""}{item.location ? ` · ${item.location}` : ""}</small></span></span><span className="text-[10px] font-semibold text-content-secondary">{itemTime(item)}</span></Link></li>; })}</ul> : <p className="p-8 text-center text-sm text-content-secondary">No hay tareas o eventos que coincidan con el periodo y los filtros.</p>}
        </section>
      ) : null}
    </div>
  );
}
