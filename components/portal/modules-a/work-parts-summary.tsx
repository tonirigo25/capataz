"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  ImageIcon,
  MapPin,
  Search,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

export type WorkPartState = "draft" | "pending_review" | "pending_approval" | "approved" | "rejected" | "archived";

export type WorkPartActivity = {
  id: string;
  title: string;
  detail?: string | null;
  status?: string | null;
  progress?: number | null;
};

export type WorkPartHours = {
  id: string;
  personName: string;
  role?: string | null;
  hours: number;
};

export type WorkPartPhoto = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  createdAt?: string | null;
};

export type WorkPartReviewStep = {
  id: string;
  label: string;
  state: "completed" | "current" | "pending";
  actorName?: string | null;
  occurredAt?: string | null;
};

export type WorkPartSummaryItem = {
  id: string;
  number: string;
  title: string;
  date: string;
  createdAt?: string | null;
  authorName?: string | null;
  state: WorkPartState;
  stateLabel?: string | null;
  summary?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  weather?: string | null;
  location?: string | null;
  totalHours?: number | null;
  notes?: string[];
  activities: WorkPartActivity[];
  hours: WorkPartHours[];
  photos: WorkPartPhoto[];
  reviewSteps?: WorkPartReviewStep[];
  href?: string;
  reviewHref?: string;
};

type WorkPartsSummaryProps = {
  parts: WorkPartSummaryItem[];
  nowIso?: string;
  allPartsHref?: string;
  createPartHref?: string;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const longDateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const stateLabels: Record<WorkPartState, string> = {
  draft: "Borrador",
  pending_review: "Pendiente de revisar",
  pending_approval: "Pendiente de aprobar",
  approved: "Aprobado",
  rejected: "Rechazado",
  archived: "Archivado",
};

const stateTones: Record<WorkPartState, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-800",
  pending_approval: "border-orange-200 bg-orange-50 text-orange-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value: string | null | undefined, long = false) {
  const date = parseDate(value);
  return date ? (long ? longDateFormatter : dateFormatter).format(date) : "Fecha no registrada";
}

function displayDateTime(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? dateTimeFormatter.format(date) : null;
}

function StateBadge({ part }: { part: WorkPartSummaryItem }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2 text-[9px] font-bold ${stateTones[part.state]}`}>{part.stateLabel ?? stateLabels[part.state]}</span>;
}

function SummaryMetric({ label, value, detail, icon: Icon, tone = "neutral" }: { label: string; value: string; detail: string; icon: typeof FileText; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const iconTone = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : tone === "danger" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  return <article className="min-w-0 rounded-lg border border-border bg-surface p-3"><div className="flex items-start gap-2"><span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTone}`}><Icon size={17} aria-hidden="true" /></span><div className="min-w-0"><span className="block truncate text-[9px] font-semibold text-content-secondary">{label}</span><strong className="mt-1 block truncate text-xl font-black tabular-nums text-content">{value}</strong><small className="mt-1 block truncate text-[8px] text-content-tertiary">{detail}</small></div></div></article>;
}

function DetailCard({ title, side, children }: { title: string; side?: React.ReactNode; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-lg border border-border bg-surface p-3"><header className="mb-3 flex min-h-6 items-start justify-between gap-2"><h3 className="text-[11px] font-black text-content">{title}</h3>{side}</header>{children}</section>;
}

function PartListItem({ part, active, onSelect }: { part: WorkPartSummaryItem; active: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-pressed={active} className={`w-full border-l-2 px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand ${active ? "border-l-brand bg-brand-soft/70" : "border-l-transparent bg-surface hover:bg-subtle"}`}><span className="flex min-w-0 items-center justify-between gap-2"><time className="truncate text-[9px] font-semibold text-content-secondary" dateTime={part.date}>{displayDate(part.date)}</time><strong className="shrink-0 text-[9px] text-content">N.º {part.number}</strong></span><strong className="mt-2 block truncate text-[11px] text-content">{part.title}</strong><span className="mt-2 flex min-w-0 items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 truncate text-[9px] text-content-secondary"><UserRound size={12} className="shrink-0" aria-hidden="true" />{part.authorName ?? "Autor no registrado"}</span><StateBadge part={part} /></span></button>;
}

export function WorkPartsSummary({ parts, nowIso, allPartsHref, createPartHref }: WorkPartsSummaryProps) {
  const id = useId();
  const now = useMemo(() => parseDate(nowIso) ?? new Date(), [nowIso]);
  const orderedParts = useMemo(() => [...parts].sort((a, b) => (parseDate(b.date)?.getTime() ?? 0) - (parseDate(a.date)?.getTime() ?? 0)), [parts]);
  const [selectedId, setSelectedId] = useState<string | null>(() => orderedParts[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<WorkPartState | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filteredParts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es-ES");
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
    return orderedParts.filter((part) => {
      if (state !== "all" && part.state !== state) return false;
      const date = parseDate(part.date);
      if (fromDate && (!date || date < fromDate)) return false;
      if (toDate && (!date || date > toDate)) return false;
      return !needle || `${part.number} ${part.title} ${part.authorName ?? ""} ${part.summary ?? ""}`.toLocaleLowerCase("es-ES").includes(needle);
    });
  }, [from, orderedParts, query, state, to]);
  const selectedPart = filteredParts.find((part) => part.id === selectedId) ?? filteredParts[0] ?? null;
  const thisMonth = orderedParts.filter((part) => { const date = parseDate(part.date); return Boolean(date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()); }).length;
  const counts = (partState: WorkPartState) => orderedParts.filter((part) => part.state === partState).length;
  const totalHours = selectedPart ? (selectedPart.totalHours ?? selectedPart.hours.reduce((sum, item) => sum + item.hours, 0)) : 0;
  const personnelCount = selectedPart ? new Set(selectedPart.hours.map((item) => item.personName).filter(Boolean)).size : 0;
  const hasFilters = Boolean(query || from || to || state !== "all");
  const resetFilters = () => { setQuery(""); setState("all"); setFrom(""); setTo(""); };

  return <div className="grid min-w-0 gap-3">
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores de partes de obra">
      <SummaryMetric label="Partes de obra" value={String(orderedParts.length)} detail="Registros recibidos" icon={FileText} />
      <SummaryMetric label="Este mes" value={String(thisMonth)} detail={now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })} icon={CalendarDays} />
      <SummaryMetric label="Pendientes de revisar" value={String(counts("pending_review"))} detail="Estado registrado" icon={FileCheck2} tone="warning" />
      <SummaryMetric label="Pendientes de aprobar" value={String(counts("pending_approval"))} detail="Estado registrado" icon={Clock3} tone="warning" />
      <SummaryMetric label="Rechazados" value={String(counts("rejected"))} detail="Estado registrado" icon={XCircle} tone={counts("rejected") ? "danger" : "neutral"} />
      <SummaryMetric label="Aprobados" value={String(counts("approved"))} detail="Estado confirmado" icon={CheckCircle2} tone="success" />
    </section>

    <div className="grid min-w-0 gap-3 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-label="Listado de partes de obra">
        <header className="border-b border-border p-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black text-content">Partes de obra</h2><Filter size={15} className="text-content-tertiary" aria-hidden="true" /></div><label htmlFor={`${id}-search`} className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><Search size={14} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar parte</span><input id={`${id}-search`} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-content outline-none" placeholder="Buscar por fecha, título o número…" /></label><div className="mt-2 grid grid-cols-2 gap-2"><label htmlFor={`${id}-from`} className="grid gap-1 text-[9px] font-semibold text-content-secondary"><span>Desde</span><input id={`${id}-from`} type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="min-h-9 min-w-0 rounded-lg border border-border bg-surface px-2 text-[10px] text-content" /></label><label htmlFor={`${id}-to`} className="grid gap-1 text-[9px] font-semibold text-content-secondary"><span>Hasta</span><input id={`${id}-to`} type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="min-h-9 min-w-0 rounded-lg border border-border bg-surface px-2 text-[10px] text-content" /></label></div><label htmlFor={`${id}-state`} className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><span>Estado</span><select id={`${id}-state`} value={state} onChange={(event) => setState(event.target.value as WorkPartState | "all")} className="min-h-9 min-w-0 bg-transparent font-bold text-content outline-none"><option value="all">Todos</option>{Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{hasFilters ? <button type="button" onClick={resetFilters} className="mt-2 text-[10px] font-bold text-brand-strong hover:underline">Limpiar filtros</button> : null}<p className="mt-3 text-[9px] text-content-secondary" aria-live="polite">Mostrando {filteredParts.length} de {orderedParts.length} partes</p></header>
        <div className="max-h-[42rem] divide-y divide-border overflow-y-auto">{filteredParts.map((part) => <PartListItem key={part.id} part={part} active={selectedPart?.id === part.id} onSelect={() => setSelectedId(part.id)} />)}{filteredParts.length === 0 ? <p className="p-6 text-center text-xs text-content-secondary">No hay partes que coincidan con los filtros.</p> : null}</div>
        <footer className="grid gap-2 border-t border-border p-3">{allPartsHref ? <Link href={allPartsHref} className="secondary-button justify-center">Ver todos los partes</Link> : null}{createPartHref ? <Link href={createPartHref} className="primary-button justify-center">Crear parte</Link> : null}</footer>
      </aside>

      {selectedPart ? <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
        <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-content">Parte de obra N.º {selectedPart.number}</h2><StateBadge part={selectedPart} /></div><p className="mt-1 truncate text-xs text-content-secondary">{selectedPart.title}</p></div><div className="shrink-0 text-left md:text-right"><p className="text-[10px] font-bold capitalize text-content">{displayDate(selectedPart.date, true)}</p>{selectedPart.createdAt || selectedPart.authorName ? <p className="mt-1 text-[9px] text-content-secondary">{displayDateTime(selectedPart.createdAt) ? `Creado ${displayDateTime(selectedPart.createdAt)}` : ""}{selectedPart.authorName ? `${selectedPart.createdAt ? " · " : ""}${selectedPart.authorName}` : ""}</p> : null}</div></header>

        <section className="grid gap-px border-b border-border bg-border sm:grid-cols-2 xl:grid-cols-5" aria-label="Datos de la jornada">
          <div className="bg-surface p-3"><span className="flex items-center gap-1.5 text-[9px] text-content-secondary"><Clock3 size={13} aria-hidden="true" />Jornada</span><strong className="mt-1 block text-xs text-content">{selectedPart.shiftStart && selectedPart.shiftEnd ? `${selectedPart.shiftStart}–${selectedPart.shiftEnd}` : "No registrada"}</strong></div>
          <div className="bg-surface p-3"><span className="flex items-center gap-1.5 text-[9px] text-content-secondary"><CalendarDays size={13} aria-hidden="true" />Clima</span><strong className="mt-1 block text-xs text-content">{selectedPart.weather ?? "No registrado"}</strong></div>
          <div className="bg-surface p-3"><span className="flex items-center gap-1.5 text-[9px] text-content-secondary"><MapPin size={13} aria-hidden="true" />Ubicación</span><strong className="mt-1 block truncate text-xs text-content">{selectedPart.location ?? "No registrada"}</strong></div>
          <div className="bg-surface p-3"><span className="flex items-center gap-1.5 text-[9px] text-content-secondary"><Users size={13} aria-hidden="true" />Personal</span><strong className="mt-1 block text-xs text-content">{personnelCount ? `${personnelCount} personas` : "Sin horas registradas"}</strong></div>
          <div className="bg-surface p-3"><span className="flex items-center gap-1.5 text-[9px] text-content-secondary"><Clock3 size={13} aria-hidden="true" />Horas totales</span><strong className="mt-1 block text-xs text-content">{totalHours ? `${totalHours.toLocaleString("es-ES")} h` : "Sin horas registradas"}</strong></div>
        </section>

        <div className="grid gap-3 p-3">
          <section className="rounded-lg border border-border p-3"><h3 className="text-[11px] font-black text-content">Resumen de la jornada</h3><p className="mt-2 text-xs leading-5 text-content-secondary">{selectedPart.summary?.trim() || "Este parte no tiene un resumen registrado."}</p></section>
          <div className="grid gap-3 xl:grid-cols-3">
            <DetailCard title="Actividad registrada" side={<span className="text-[9px] font-bold text-content-secondary">{selectedPart.activities.length}</span>}><div className="grid gap-2">{selectedPart.activities.map((activity) => <div key={activity.id} className="rounded-lg border border-border p-2"><span className="flex min-w-0 items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" /><span className="min-w-0"><strong className="block text-[10px] text-content">{activity.title}</strong>{activity.detail ? <small className="mt-1 block text-[9px] leading-4 text-content-secondary">{activity.detail}</small> : null}</span>{activity.progress != null ? <span className="ml-auto shrink-0 text-[9px] font-bold tabular-nums text-content">{activity.progress}%</span> : null}</span>{activity.progress != null ? <progress className="mt-2 h-1.5 w-full accent-brand" max={100} value={Math.max(0, Math.min(100, activity.progress))}>{activity.progress}%</progress> : null}</div>)}{selectedPart.activities.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-content-secondary">No hay actividad registrada en este parte.</p> : null}</div></DetailCard>
            <DetailCard title="Horas y personal" side={<span className="text-[9px] font-bold text-content-secondary">{totalHours ? `${totalHours.toLocaleString("es-ES")} h` : "—"}</span>}><div className="divide-y divide-border">{selectedPart.hours.map((entry) => <div key={entry.id} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><span className="min-w-0"><strong className="block truncate text-[10px] text-content">{entry.personName}</strong>{entry.role ? <small className="mt-0.5 block truncate text-[8px] text-content-secondary">{entry.role}</small> : null}</span><strong className="text-[10px] tabular-nums text-content">{entry.hours.toLocaleString("es-ES")} h</strong></div>)}{selectedPart.hours.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-content-secondary">No hay horas imputadas a este parte.</p> : null}</div></DetailCard>
            <DetailCard title="Evidencias" side={<span className="text-[9px] font-bold text-content-secondary">{selectedPart.photos.length}</span>}><div className="grid grid-cols-2 gap-2">{selectedPart.photos.slice(0, 6).map((photo) => <figure key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-subtle"><Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} unoptimized className="h-full w-full object-cover transition group-hover:scale-[1.02]" /><figcaption className="sr-only">{photo.alt}</figcaption></figure>)}{selectedPart.photos.length === 0 ? <div className="col-span-2 grid min-h-28 place-content-center rounded-lg border border-dashed border-border text-center text-content-secondary"><ImageIcon size={20} className="mx-auto" aria-hidden="true" /><p className="mt-2 text-[10px]">Sin fotografías vinculadas.</p></div> : null}</div>{selectedPart.photos.length > 6 ? <p className="mt-2 text-[9px] font-semibold text-content-secondary">+{selectedPart.photos.length - 6} evidencias adicionales</p> : null}</DetailCard>
          </div>

          {selectedPart.notes?.length ? <DetailCard title="Notas de obra"><ul className="grid gap-2 text-[10px] leading-4 text-content-secondary">{selectedPart.notes.map((note, index) => <li key={`${selectedPart.id}-note-${index}`} className="flex gap-2"><span aria-hidden="true">•</span><span>{note}</span></li>)}</ul></DetailCard> : null}

          <section className="rounded-lg border border-border p-3" aria-label="Flujo de revisión del parte"><header className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[11px] font-black text-content">Flujo de revisión y aprobación</h3>{selectedPart.reviewHref ? <Link href={selectedPart.reviewHref} className="primary-button">Revisar parte</Link> : selectedPart.href ? <Link href={selectedPart.href} className="secondary-button">Abrir parte</Link> : null}</header>{selectedPart.reviewSteps?.length ? <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{selectedPart.reviewSteps.map((step, index) => <li key={step.id} className={`rounded-lg border p-3 ${step.state === "completed" ? "border-emerald-200 bg-emerald-50" : step.state === "current" ? "border-brand/40 bg-brand-soft" : "border-border bg-subtle"}`}><span className="flex items-center gap-2"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${step.state === "completed" ? "bg-emerald-600 text-white" : step.state === "current" ? "bg-brand text-white" : "bg-surface text-content-secondary"}`}>{index + 1}</span><strong className="text-[10px] text-content">{step.label}</strong></span>{step.actorName || step.occurredAt ? <small className="mt-2 block text-[8px] leading-4 text-content-secondary">{step.actorName ?? ""}{step.actorName && step.occurredAt ? " · " : ""}{displayDateTime(step.occurredAt) ?? ""}</small> : null}</li>)}</ol> : <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-[10px] text-content-secondary">No hay pasos de revisión registrados para este parte.</p>}</section>
        </div>
      </article> : <section className="grid min-h-96 place-content-center rounded-xl border border-dashed border-border bg-surface p-8 text-center"><FileText size={28} className="mx-auto text-content-tertiary" aria-hidden="true" /><h2 className="mt-3 text-sm font-black text-content">Sin parte seleccionado</h2><p className="mt-2 max-w-sm text-xs text-content-secondary">Ajusta los filtros o crea el primer parte para consultar actividad, horas y evidencias reales.</p>{createPartHref ? <Link href={createPartHref} className="primary-button mx-auto mt-4">Crear parte</Link> : null}</section>}
    </div>
  </div>;
}
