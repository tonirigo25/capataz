"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileText,
  Filter,
  Flag,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  PhoneCall,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Upload,
  UserRound,
} from "lucide-react";

export type ClientActivityKind = "call" | "email" | "meeting" | "task" | "budget" | "invoice" | "document" | "comment" | "payment" | "milestone" | "other";
export type ClientActivityMetricKind = "interactions" | "pending_tasks" | "sent_budgets" | "collected_invoices";
export type ClientActivityTone = "neutral" | "success" | "warning" | "danger" | "info" | "violet";

export type AuthorizedClientActivityHref = {
  href: string;
  authorized: boolean;
};

export type ClientActivityActor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type ClientActivityScope = {
  clientId: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  authorized: boolean;
};

export type ClientActivityEvent = {
  id: string;
  kind: ClientActivityKind;
  typeLabel: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  scope: ClientActivityScope;
  actor?: ClientActivityActor | null;
  source?: { label: string } | null;
  status?: { label: string; tone?: ClientActivityTone } | null;
  href?: AuthorizedClientActivityHref | null;
};

export type ClientActivityMetric = {
  kind: ClientActivityMetricKind;
  value: number | null;
  detail?: string | null;
  tone?: ClientActivityTone;
};

export type Client360ActivityOverviewProps = {
  clientId: string;
  events: ClientActivityEvent[];
  metrics: ClientActivityMetric[];
  initialDateFrom?: string;
  initialDateTo?: string;
  initialVisibleCount?: number;
  visibleCountStep?: number;
  moreFiltersHref?: AuthorizedClientActivityHref | null;
  exportHref?: AuthorizedClientActivityHref | null;
  className?: string;
};

type Filters = {
  query: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  actor: string;
  entity: string;
};

const metricPresentation: Record<ClientActivityMetricKind, { label: string; icon: typeof Activity; tone: ClientActivityTone }> = {
  interactions: { label: "Interacciones", icon: MessageSquare, tone: "success" },
  pending_tasks: { label: "Tareas pendientes", icon: CheckCircle2, tone: "warning" },
  sent_budgets: { label: "Presupuestos enviados", icon: FileText, tone: "info" },
  collected_invoices: { label: "Facturas cobradas", icon: ReceiptText, tone: "violet" },
};

const eventIcons: Record<ClientActivityKind, typeof Activity> = {
  call: PhoneCall,
  email: Mail,
  meeting: CalendarDays,
  task: CheckCircle2,
  budget: FileText,
  invoice: ReceiptText,
  document: Upload,
  comment: MessageCircle,
  payment: CircleDollarSign,
  milestone: Flag,
  other: Activity,
};

const eventIconTones: Record<ClientActivityKind, string> = {
  call: "bg-emerald-50 text-emerald-700",
  email: "bg-blue-50 text-blue-700",
  meeting: "bg-orange-50 text-orange-700",
  task: "bg-emerald-50 text-emerald-700",
  budget: "bg-orange-50 text-orange-700",
  invoice: "bg-violet-50 text-violet-700",
  document: "bg-blue-50 text-blue-700",
  comment: "bg-orange-50 text-orange-700",
  payment: "bg-emerald-50 text-emerald-700",
  milestone: "bg-emerald-50 text-emerald-700",
  other: "bg-slate-100 text-slate-700",
};

const toneClasses: Record<ClientActivityTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
}

function safeAppHref(value: AuthorizedClientActivityHref | null | undefined) {
  if (!value?.authorized) return null;
  const href = value.href.trim();
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : null;
}

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function uniqueOptions(values: Array<{ value: string | null | undefined; label: string | null | undefined }>) {
  return Array.from(new Map(values.filter((item): item is { value: string; label: string } => Boolean(item.value?.trim() && item.label?.trim())).map((item) => [item.value.trim(), item.label.trim()])).entries()).sort((a, b) => a[1].localeCompare(b[1], "es-ES"));
}

export function Client360ActivityOverview({
  clientId,
  events,
  metrics,
  initialDateFrom = "",
  initialDateTo = "",
  initialVisibleCount = 12,
  visibleCountStep = 12,
  moreFiltersHref,
  exportHref,
  className = "",
}: Client360ActivityOverviewProps) {
  const id = useId();
  const [filters, setFilters] = useState<Filters>({ query: "", dateFrom: initialDateFrom, dateTo: initialDateTo, type: "", actor: "", entity: "" });
  const [visibleCount, setVisibleCount] = useState(Math.max(1, initialVisibleCount));
  const scopedEvents = useMemo(() => events.filter((event) => event.scope.authorized === true && event.scope.clientId === clientId && Boolean(event.scope.entityId.trim()) && Boolean(event.scope.entityType.trim())), [clientId, events]);
  const options = useMemo(() => ({
    types: uniqueOptions(scopedEvents.map((event) => ({ value: event.kind, label: event.typeLabel }))),
    actors: uniqueOptions(scopedEvents.map((event) => ({ value: event.actor?.id, label: event.actor?.name }))),
    entities: uniqueOptions(scopedEvents.map((event) => ({ value: `${event.scope.entityType}:${event.scope.entityId}`, label: event.scope.entityLabel }))),
  }), [scopedEvents]);
  const filteredEvents = useMemo(() => {
    const query = normalize(filters.query);
    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;
    return [...scopedEvents]
      .filter((event) => {
        const date = parseDate(event.occurredAt);
        if (!date) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
        if (filters.type && event.kind !== filters.type) return false;
        if (filters.actor && event.actor?.id !== filters.actor) return false;
        if (filters.entity && `${event.scope.entityType}:${event.scope.entityId}` !== filters.entity) return false;
        if (query && !normalize([event.title, event.description, event.typeLabel, event.actor?.name, event.source?.label, event.status?.label, event.scope.entityLabel].filter(Boolean).join(" ")).includes(query)) return false;
        return true;
      })
      .sort((a, b) => (parseDate(b.occurredAt)?.getTime() ?? 0) - (parseDate(a.occurredAt)?.getTime() ?? 0));
  }, [filters, scopedEvents]);
  const displayed = filteredEvents.slice(0, visibleCount);
  const filtersActive = Object.values(filters).some(Boolean);
  const updateFilter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setVisibleCount(Math.max(1, initialVisibleCount)); };
  const clearFilters = () => { setFilters({ query: "", dateFrom: "", dateTo: "", type: "", actor: "", entity: "" }); setVisibleCount(Math.max(1, initialVisibleCount)); };
  const safeMoreFiltersHref = safeAppHref(moreFiltersHref);
  const safeExportHref = safeAppHref(exportHref);

  return <section className={`grid min-w-0 gap-3 ${className}`} aria-labelledby={`${id}-activity-title`}>
    <header className="sr-only"><h2 id={`${id}-activity-title`}>Actividad del cliente</h2></header>

    <section className="grid grid-cols-2 gap-2 xl:grid-cols-4" aria-label="Indicadores de actividad del cliente">
      {metrics.map((metric) => <ActivityMetricCard key={metric.kind} metric={metric} />)}
      {metrics.length === 0 ? <div className="col-span-full rounded-xl border border-dashed border-border bg-surface p-5 text-center text-xs text-content-secondary">No hay indicadores de actividad autorizados.</div> : null}
    </section>

    <section className="grid gap-2 rounded-xl border border-border bg-surface p-3" aria-label="Filtros de actividad">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.35fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_auto_auto]">
        <label htmlFor={`${id}-search`} className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border px-3"><Search size={14} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar actividad</span><input id={`${id}-search`} value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] text-content outline-none" placeholder="Buscar en la actividad…" /></label>
        <SelectFilter id={`${id}-type`} icon={Activity} label="Tipo" value={filters.type} options={options.types} onChange={(value) => updateFilter("type", value)} />
        <SelectFilter id={`${id}-actor`} icon={UserRound} label="Usuario" value={filters.actor} options={options.actors} onChange={(value) => updateFilter("actor", value)} />
        <SelectFilter id={`${id}-entity`} icon={BriefcaseBusiness} label="Entidad" value={filters.entity} options={options.entities} onChange={(value) => updateFilter("entity", value)} />
        {safeMoreFiltersHref ? <Link href={safeMoreFiltersHref} className="secondary-button justify-center"><SlidersHorizontal size={14} aria-hidden="true" /> Más filtros</Link> : null}
        {safeExportHref ? <Link href={safeExportHref} className="secondary-button justify-center"><Download size={14} aria-hidden="true" /> Exportar</Link> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(9rem,12rem)_minmax(9rem,12rem)_auto] sm:items-end"><label htmlFor={`${id}-from`} className="grid gap-1 text-[9px] font-semibold text-content-secondary"><span>Desde</span><input id={`${id}-from`} type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => updateFilter("dateFrom", event.target.value)} className="min-h-10 rounded-lg border border-border bg-surface px-3 text-[10px] text-content" /></label><label htmlFor={`${id}-to`} className="grid gap-1 text-[9px] font-semibold text-content-secondary"><span>Hasta</span><input id={`${id}-to`} type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => updateFilter("dateTo", event.target.value)} className="min-h-10 rounded-lg border border-border bg-surface px-3 text-[10px] text-content" /></label>{filtersActive ? <button type="button" onClick={clearFilters} className="min-h-10 justify-self-start px-2 text-[10px] font-bold text-brand-strong hover:underline">Limpiar filtros</button> : null}</div>
    </section>

    <div className="flex items-center justify-between gap-3 px-1"><p className="text-[10px] font-bold text-content" aria-live="polite">{filteredEvents.length} {filteredEvents.length === 1 ? "actividad" : "actividades"}</p>{scopedEvents.length !== events.length ? <p className="text-[8px] font-semibold text-content-tertiary">Vista limitada al cliente y entidades autorizadas</p> : null}</div>

    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label="Historial de actividad">
      {displayed.length ? <ol className="divide-y divide-border">{displayed.map((event, index) => <ActivityRow key={event.id} event={event} isLast={index === displayed.length - 1} />)}</ol> : <div className="grid min-h-52 place-content-center p-6 text-center"><Filter size={24} className="mx-auto text-content-tertiary" aria-hidden="true" /><strong className="mt-3 text-xs text-content">Sin actividad visible</strong><p className="mt-1 max-w-sm text-[10px] leading-4 text-content-secondary">No hay eventos autorizados que coincidan con los filtros actuales.</p></div>}
      {displayed.length < filteredEvents.length ? <footer className="border-t border-border p-3 text-center"><button type="button" onClick={() => setVisibleCount((current) => current + Math.max(1, visibleCountStep))} className="inline-flex min-h-9 items-center gap-2 text-[10px] font-bold text-brand-strong hover:underline">Ver más actividades <ChevronDown size={14} aria-hidden="true" /></button></footer> : null}
    </section>
  </section>;
}

function ActivityMetricCard({ metric }: { metric: ClientActivityMetric }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  const tone = metric.tone ?? presentation.tone;
  return <article className="min-w-0 rounded-xl border border-border bg-surface p-3"><div className="flex items-center gap-3"><span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}><Icon size={19} aria-hidden="true" /></span><span className="min-w-0"><small className="block truncate text-[9px] font-semibold text-content-secondary">{presentation.label}</small><strong className="mt-0.5 block text-xl font-black tabular-nums text-content">{metric.value == null ? "—" : metric.value.toLocaleString("es-ES")}</strong>{metric.detail ? <span className="mt-0.5 block truncate text-[8px] font-semibold text-content-secondary">{metric.detail}</span> : null}</span></div></article>;
}

function SelectFilter({ id, icon: Icon, label, value, options, onChange }: { id: string; icon: typeof Activity; label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label htmlFor={id} className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border px-3"><Icon size={14} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">{label}</span><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] font-bold text-content outline-none"><option value="">{label}: Todos</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function ActivityRow({ event, isLast }: { event: ClientActivityEvent; isLast: boolean }) {
  const date = parseDate(event.occurredAt)!;
  const Icon = eventIcons[event.kind];
  const href = safeAppHref(event.href);
  const avatar = safeImageUrl(event.actor?.avatarUrl);
  const statusTone = event.status?.tone ?? "neutral";
  return <li className="grid min-w-0 grid-cols-[4.2rem_1rem_2.25rem_minmax(0,1fr)] items-start gap-2 px-3 py-3 lg:grid-cols-[5rem_1rem_2.5rem_minmax(0,1fr)_auto_auto_auto] lg:items-center lg:gap-3">
    <time dateTime={event.occurredAt} className="pt-0.5 text-[8px] leading-4 text-content-secondary lg:pt-0"><strong className="block font-semibold text-content-secondary">{dateFormatter.format(date)}</strong><span>{timeFormatter.format(date)}</span></time>
    <span className="relative flex h-full min-h-9 justify-center pt-3 lg:items-center lg:pt-0"><span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand-soft" aria-hidden="true" />{!isLast ? <span className="absolute bottom-[-1.05rem] top-5 border-l border-brand/30 lg:bottom-[-1.05rem] lg:top-1/2" aria-hidden="true" /> : null}</span>
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${eventIconTones[event.kind]}`}><Icon size={16} aria-hidden="true" /></span>
    <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="text-[10px] text-content">{event.title}</strong>{event.status ? <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold lg:hidden ${toneClasses[statusTone]}`}>{event.status.label}</span> : null}</span>{event.description ? <p className="mt-1 text-[9px] leading-4 text-content-secondary lg:truncate">{event.description}</p> : null}<span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-content-tertiary lg:hidden">{event.scope.entityLabel ? <span>{event.scope.entityLabel}</span> : null}{event.source ? <span>Origen: {event.source.label}</span> : null}{event.actor ? <span>{event.actor.name}</span> : null}</span></span>
    <span className="hidden max-w-36 truncate text-[8px] font-semibold text-content-secondary lg:block">{event.scope.entityLabel ?? ""}</span>
    <span className="hidden items-center gap-2 lg:flex">{event.actor ? <><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-content-secondary">{avatar ? <Image src={avatar} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" /> : <UserRound size={13} aria-hidden="true" />}</span><span className="max-w-28 truncate text-[8px] font-semibold text-content-secondary">{event.actor.name}</span></> : null}</span>
    <span className="hidden items-center justify-end gap-2 lg:flex">{event.status ? <span className={`inline-flex rounded-full px-2 py-1 text-[8px] font-bold ${toneClasses[statusTone]}`}>{event.status.label}</span> : null}{href ? <Link href={href} aria-label={`Abrir entidad de ${event.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-subtle hover:text-content"><MoreHorizontal size={15} aria-hidden="true" /></Link> : null}</span>
    {href ? <Link href={href} className="col-start-4 mt-1 inline-flex min-h-8 items-center text-[9px] font-bold text-brand-strong hover:underline lg:hidden">Ver entidad</Link> : null}
  </li>;
}
