"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CloudRain,
  CloudSun,
  Download,
  FileText,
  History,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Sun,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

export type WorkPartStatus = "draft" | "pending_review" | "approved" | "validated" | "rejected" | string;

export type WorkPartWorker = { id: string; name: string; role: string | null; hours: number | null; avatarUrl?: string | null };
export type WorkPartActivity = { id: string; title: string; completed: boolean; progress?: number | null; location?: string | null };
export type WorkPartMaterial = { id: string; name: string; unit: string; quantity: number | string; provider?: string | null; notes?: string | null };
export type WorkPartIncident = { id: string; title: string; severity: "low" | "medium" | "high" | string; description?: string | null; author?: string | null; occurredAt?: string | null };
export type WorkPartPhoto = { id: string; url: string; alt: string; caption?: string | null };
export type WorkPartHistoryItem = { id: string; label: string; actor?: string | null; occurredAt: string };

export type WorkPartRecord = {
  id: string;
  code: string;
  date: string;
  status: WorkPartStatus;
  responsible: string | null;
  responsibleRole?: string | null;
  location?: string | null;
  weather?: string | null;
  temperatureC?: number | null;
  windKmh?: number | null;
  humidityPercent?: number | null;
  totalHours?: number | null;
  workers: WorkPartWorker[];
  activities: WorkPartActivity[];
  materials: WorkPartMaterial[];
  incidents: WorkPartIncident[];
  photos: WorkPartPhoto[];
  notes?: string | null;
  validatedBy?: string | null;
  validatedAt?: string | null;
  signatureImageUrl?: string | null;
  history: WorkPartHistoryItem[];
  href: string;
  editHref?: string | null;
  duplicateHref?: string | null;
  sendHref?: string | null;
};

export type WorkPartDraft = {
  date: string;
  code: string;
  weather: string;
  temperatureC: string;
  wind: string;
  precipitationPercent: string;
  ownWorkers: string;
  subcontractWorkers: string;
  hours: string;
  activity: string;
  description: string;
  location: string;
  incidentSeverity: string;
  incidentDescription: string;
  observations: string;
  responsibleId: string;
};

type PartFormAction = string | ((formData: FormData) => void | Promise<void>);

export type WorkPartsRoutes = {
  listHref: string;
  newHref?: string | null;
  exportHref?: string | null;
};

type WorkContext = { id: string; title: string; code?: string | null; client?: string | null; address?: string | null; responsible?: string | null };

type RegisterProps = {
  work: WorkContext;
  routes: WorkPartsRoutes;
} & (
  | { view: "list"; parts: WorkPartRecord[]; selectedPartId?: string | null; emptyDescription?: string | null }
  | {
      view: "new";
      form: {
        submitAction: PartFormAction;
        draftAction?: PartFormAction | null;
        initial: WorkPartDraft;
        activityOptions: Array<{ value: string; label: string }>;
        locationOptions: Array<{ value: string; label: string }>;
        responsibleOptions: Array<{ value: string; label: string }>;
      };
    }
  | { view: "detail"; part: WorkPartRecord }
  | { view: "unavailable"; title: string; description: string; backHref?: string | null }
);

type DetailTab = "summary" | "workers" | "activities" | "materials" | "incidents" | "photos" | "notes" | "history";

const statusMeta: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "border-blue-200 bg-blue-50 text-blue-700" },
  pending_review: { label: "Pendiente de revisión", className: "border-amber-200 bg-amber-50 text-amber-700" },
  approved: { label: "Aprobado", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  validated: { label: "Validado", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazado", className: "border-red-200 bg-red-50 text-red-700" },
};

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined, includeTime = false) {
  const date = safeDate(value);
  if (!date) return "Sin fecha registrada";
  return new Intl.DateTimeFormat("es-ES", includeTime ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function statusInfo(status: WorkPartStatus) {
  return statusMeta[status] ?? { label: status.replaceAll("_", " "), className: "border-border bg-subtle text-content-secondary" };
}

function normalizedProgress(part: WorkPartRecord) {
  if (!part.activities.length) return null;
  return Math.round((part.activities.filter((activity) => activity.completed).length / part.activities.length) * 100);
}

function totalHours(part: WorkPartRecord) {
  if (typeof part.totalHours === "number" && Number.isFinite(part.totalHours)) return part.totalHours;
  const recorded = part.workers.map((worker) => worker.hours).filter((hours): hours is number => typeof hours === "number" && Number.isFinite(hours));
  return recorded.length === part.workers.length && recorded.length ? recorded.reduce((sum, hours) => sum + hours, 0) : null;
}

function safeImageUrl(url: string | null | undefined) {
  return Boolean(url && (url.startsWith("/") || url.startsWith("https://")));
}

function StatusBadge({ status }: { status: WorkPartStatus }) {
  const meta = statusInfo(status);
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[10px] font-bold capitalize ${meta.className}`}>{meta.label}</span>;
}

function WeatherIcon({ weather, size = 18 }: { weather?: string | null; size?: number }) {
  const normalized = weather?.toLocaleLowerCase("es-ES") ?? "";
  if (/lluv|torment/.test(normalized)) return <CloudRain size={size} aria-hidden="true" />;
  if (/nubl|cubiert/.test(normalized)) return <CloudSun size={size} aria-hidden="true" />;
  return <Sun size={size} aria-hidden="true" />;
}

export function WorkPartsRegister(props: RegisterProps) {
  if (props.view === "new") return <NewPartSurface work={props.work} routes={props.routes} form={props.form} />;
  if (props.view === "detail") return <PartDetailSurface work={props.work} routes={props.routes} part={props.part} />;
  if (props.view === "unavailable") return <UnavailablePartSurface title={props.title} description={props.description} backHref={props.backHref} />;
  return <PartsListSurface work={props.work} routes={props.routes} parts={props.parts} selectedPartId={props.selectedPartId} emptyDescription={props.emptyDescription} />;
}

function PartsListSurface({ work, routes, parts, selectedPartId, emptyDescription }: { work: WorkContext; routes: WorkPartsRoutes; parts: WorkPartRecord[]; selectedPartId?: string | null; emptyDescription?: string | null }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const filtered = useMemo(() => parts.filter((part) => {
    const haystack = `${part.code} ${part.responsible ?? ""} ${part.location ?? ""}`.toLocaleLowerCase("es-ES");
    const date = safeDate(part.date)?.getTime();
    const fromDate = safeDate(from)?.getTime();
    const toDate = safeDate(to)?.getTime();
    return haystack.includes(query.trim().toLocaleLowerCase("es-ES")) && (status === "all" || part.status === status) && (!fromDate || (date != null && date >= fromDate)) && (!toDate || (date != null && date <= toDate));
  }).sort((a, b) => (safeDate(b.date)?.getTime() ?? 0) - (safeDate(a.date)?.getTime() ?? 0)), [from, parts, query, status, to]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = parts.find((part) => part.id === selectedPartId) ?? null;

  function resetPage() { setPage(1); }

  return <div className="grid gap-4">
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft" aria-labelledby="parts-list-title">
      <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="parts-list-title" className="text-sm font-bold text-content">Partes diarios de obra</h2><p className="mt-1 text-[10px] text-content-secondary">{work.title} · {filtered.length} de {parts.length} registros visibles</p></div><div className="flex flex-wrap gap-2">{routes.exportHref ? <Link href={routes.exportHref} className="secondary-button min-h-11"><Download size={16} aria-hidden="true" /> Exportar</Link> : null}{routes.newHref ? <Link href={routes.newHref} className="primary-button min-h-11"><Plus size={16} aria-hidden="true" /> Nuevo parte</Link> : null}</div></header>
      <div className="grid gap-2 border-b border-border p-3 md:grid-cols-[minmax(13rem,1fr)_12rem_10rem_10rem]">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} className="text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar partes</span><input className="min-w-0 flex-1 bg-transparent text-xs text-content outline-none" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Buscar por código, responsable o zona…" /></label>
        <label className="flex min-h-11 items-center rounded-lg border border-border px-3"><span className="sr-only">Estado</span><select className="w-full bg-transparent text-xs font-semibold text-content outline-none" value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="all">Todos los estados</option>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
        <label className="grid min-h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-lg border border-border px-3"><span className="text-[9px] text-content-secondary">Desde</span><input type="date" className="min-w-0 bg-transparent text-[10px] text-content outline-none" value={from} onChange={(event) => { setFrom(event.target.value); resetPage(); }} /></label>
        <label className="grid min-h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-lg border border-border px-3"><span className="text-[9px] text-content-secondary">Hasta</span><input type="date" className="min-w-0 bg-transparent text-[10px] text-content outline-none" value={to} onChange={(event) => { setTo(event.target.value); resetPage(); }} /></label>
      </div>
      {visible.length ? <div className="divide-y divide-border" role="list">{visible.map((part) => <PartListRow key={part.id} part={part} />)}</div> : <div className="p-10 text-center"><ClipboardList size={24} className="mx-auto text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-sm font-bold text-content">No hay partes para estos filtros</h3><p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-content-secondary">{emptyDescription ?? (routes.newHref ? "Cambia los filtros o registra el primer parte autorizado de esta obra." : "No se han recibido partes diarios persistidos para esta obra. La actividad, las fotos y los costes permanecen en sus registros de origen.")}</p></div>}
      <footer className="flex flex-col gap-3 border-t border-border px-4 py-3 text-[10px] text-content-secondary sm:flex-row sm:items-center sm:justify-between"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} de ${filtered.length}` : "0 registros"}</span><div className="flex items-center gap-2"><button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior"><ChevronLeft size={15} /></button><span>Página {currentPage} de {totalPages}</span><button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Página siguiente"><ChevronRight size={15} /></button><select className="min-h-11 rounded-lg border border-border bg-surface px-2" aria-label="Partes por página" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={5}>5 por página</option><option value={10}>10 por página</option><option value={20}>20 por página</option></select></div></footer>
    </section>
    {selected ? <SelectedPartSummary part={selected} /> : null}
  </div>;
}

function UnavailablePartSurface({ title, description, backHref }: { title: string; description: string; backHref?: string | null }) {
  return <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-6 text-center shadow-soft" aria-labelledby="unavailable-part-title"><AlertTriangle size={24} className="text-warning" aria-hidden="true" /><h2 id="unavailable-part-title" className="mt-3 text-sm font-black text-content">{title}</h2><p className="mt-2 max-w-xl text-xs leading-6 text-content-secondary">{description}</p>{backHref ? <Link href={backHref} className="secondary-button mt-4 min-h-11">Volver al listado</Link> : null}</section>;
}

function PartListRow({ part }: { part: WorkPartRecord }) {
  const date = safeDate(part.date);
  const progress = normalizedProgress(part);
  const hours = totalHours(part);
  return <article role="listitem"><Link href={part.href} className="grid min-h-[5rem] gap-3 px-4 py-3 hover:bg-subtle md:grid-cols-[4rem_minmax(11rem,1.4fr)_minmax(8rem,0.75fr)_minmax(10rem,0.8fr)_8rem_2rem] md:items-center"><span className="inline-flex h-14 w-12 flex-col items-center justify-center rounded-lg border border-border bg-subtle text-content"><strong className="text-lg leading-none">{date ? date.getDate() : "—"}</strong><small className="mt-1 text-[8px] uppercase text-content-secondary">{date ? date.toLocaleDateString("es-ES", { month: "short", weekday: "short" }) : "Sin fecha"}</small></span><span className="min-w-0"><strong className="block truncate text-xs text-content">Parte diario #{part.code}</strong><span className="mt-1 block truncate text-[10px] text-content-secondary">Responsable: {part.responsible ?? "Sin responsable"}</span><span className="mt-1 flex items-center gap-1 text-[9px] text-content-tertiary"><WeatherIcon weather={part.weather} size={12} />{part.weather ?? "Clima no registrado"}{part.temperatureC != null ? ` · ${part.temperatureC} °C` : ""}</span></span><span><small className="block text-[9px] text-content-secondary">Trabajadores</small><strong className="mt-1 block text-xs text-content">{part.workers.length}</strong><span className="text-[9px] text-content-tertiary">{hours == null ? "Horas sin cerrar" : `${hours.toLocaleString("es-ES")} h`}</span></span><span><small className="block text-[9px] text-content-secondary">Actividades completadas</small><span className="mt-1 flex items-center justify-between gap-2 text-[10px]"><strong>{part.activities.filter((activity) => activity.completed).length} de {part.activities.length}</strong><span>{progress == null ? "—" : `${progress}%`}</span></span>{progress == null ? <span className="mt-1 block h-1.5 rounded-full bg-border" /> : <progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={progress}>{progress}%</progress>}</span><span><small className="mb-1 block text-[9px] text-content-secondary">Estado</small><StatusBadge status={part.status} /></span><ChevronRight size={16} className="text-content-tertiary" aria-hidden="true" /></Link></article>;
}

function SelectedPartSummary({ part }: { part: WorkPartRecord }) {
  const progress = normalizedProgress(part);
  return <div className="grid gap-3 lg:grid-cols-3"><section className="rounded-xl border border-border bg-surface p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-bold text-content">Resumen seleccionado</h3><StatusBadge status={part.status} /></div><dl className="mt-3 grid gap-2 text-[10px]"><SummaryLine label="Jornada" value={formatDate(part.date)} /><SummaryLine label="Ubicación" value={part.location ?? "Sin ubicación"} /><SummaryLine label="Trabajadores" value={String(part.workers.length)} /><SummaryLine label="Horas totales" value={totalHours(part) == null ? "Sin cierre" : `${totalHours(part)!.toLocaleString("es-ES")} h`} /></dl></section><section className="rounded-xl border border-border bg-surface p-4"><h3 className="text-xs font-bold text-content">Actividades destacadas</h3>{part.activities.length ? <ul className="mt-3 grid gap-2">{part.activities.slice(0, 4).map((activity) => <li key={activity.id} className="flex items-start gap-2 text-[10px] text-content-secondary"><CheckCircle2 size={13} className={activity.completed ? "mt-px shrink-0 text-success" : "mt-px shrink-0 text-content-tertiary"} /><span>{activity.title}</span></li>)}</ul> : <p className="mt-3 text-[10px] text-content-secondary">Sin actividades registradas.</p>}</section><section className="rounded-xl border border-border bg-surface p-4"><h3 className="text-xs font-bold text-content">Indicadores del día</h3><dl className="mt-3 grid gap-3"><SummaryLine label="Avance documentado" value={progress == null ? "Sin cálculo" : `${progress}%`} /><SummaryLine label="Incidencias" value={String(part.incidents.length)} /><SummaryLine label="Evidencias" value={String(part.photos.length)} /></dl></section></div>;
}

function NewPartSurface({ work, routes, form }: { work: WorkContext; routes: WorkPartsRoutes; form: Extract<RegisterProps, { view: "new" }>["form"] }) {
  const [draft, setDraft] = useState(form.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [materialRows, setMaterialRows] = useState([{ id: "material-1", name: "", unit: "", quantity: "", provider: "", notes: "" }]);
  const own = Number(draft.ownWorkers) || 0;
  const subcontract = Number(draft.subcontractWorkers) || 0;

  function setField(field: keyof WorkPartDraft, value: string) { setDraft((current) => ({ ...current, [field]: value })); }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.formNoValidate) return;
    const next: Record<string, string> = {};
    const payload = new FormData(event.currentTarget);
    if (!draft.date) next.date = "La fecha es obligatoria.";
    if (!draft.code.trim()) next.code = "El número de parte es obligatorio.";
    if (!draft.activity) next.activity = "Selecciona la actividad principal.";
    if (!draft.description.trim()) next.description = "Describe el trabajo realizado.";
    if (!draft.location) next.location = "Selecciona una ubicación.";
    if (!draft.responsibleId) next.responsibleId = "Selecciona la persona responsable.";
    if (own < 0 || subcontract < 0 || !Number.isInteger(own) || !Number.isInteger(subcontract)) next.workers = "El personal debe indicarse con números enteros positivos.";
    if (draft.hours && Number(draft.hours) < 0) next.hours = "Las horas no pueden ser negativas.";
    if (draft.precipitationPercent && (Number(draft.precipitationPercent) < 0 || Number(draft.precipitationPercent) > 100)) next.precipitationPercent = "La precipitación debe estar entre 0 y 100 %.";
    if (draft.incidentSeverity !== "none" && !draft.incidentDescription.trim()) next.incidentDescription = "Describe la incidencia registrada.";
    const incompleteMaterial = materialRows.some((row) => {
      const hasData = Boolean(row.name.trim() || row.unit.trim() || row.quantity || row.provider.trim() || row.notes.trim());
      return hasData && (!row.name.trim() || !row.unit.trim() || !row.quantity || Number(row.quantity) <= 0);
    });
    if (incompleteMaterial) next.materials = "Cada material utilizado necesita nombre, unidad y una cantidad superior a cero.";
    const oversizedAttachment = payload.getAll("attachments").some((entry) => entry instanceof File && entry.size > 20 * 1024 * 1024);
    if (oversizedAttachment) next.attachments = "Cada archivo debe ocupar 20 MB como máximo.";
    setErrors(next);
    if (Object.keys(next).length) event.preventDefault();
  }

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
    <form action={form.submitAction} onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft" noValidate>
      <input type="hidden" name="workId" value={work.id} /><header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between"><div><Link href={routes.listHref} className="text-[10px] font-semibold text-content-secondary hover:underline">Partes / Volver al listado</Link><h2 className="mt-2 text-xl font-bold text-content">Nuevo parte diario de obra</h2><p className="mt-1 text-xs text-content-secondary">{work.title}{work.code ? ` · ${work.code}` : ""}</p></div><div className="flex flex-wrap gap-2">{form.draftAction ? <button type="submit" formAction={form.draftAction} formNoValidate className="secondary-button min-h-11">Guardar borrador</button> : null}<button type="submit" className="primary-button min-h-11"><Send size={16} aria-hidden="true" /> Enviar a revisión</button></div></header>
      {Object.keys(errors).length ? <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"><strong>Revisa los campos indicados.</strong><span className="ml-1">El parte no se ha enviado.</span></div> : null}
      <FormSection title="Información general"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Fecha del parte" required error={errors.date}><input name="date" type="date" value={draft.date} onChange={(event) => setField("date", event.target.value)} /></Field><Field label="N.º de parte" required error={errors.code}><input name="code" value={draft.code} onChange={(event) => setField("code", event.target.value)} /></Field><Field label="Clima"><select name="weather" value={draft.weather} onChange={(event) => setField("weather", event.target.value)}><option value="">Sin registrar</option><option>Soleado</option><option>Parcialmente nublado</option><option>Nublado</option><option>Lluvia ligera</option><option>Lluvia intensa</option></select></Field><Field label="Temperatura (°C)"><input name="temperatureC" type="number" min={-50} max={60} step="0.1" value={draft.temperatureC} onChange={(event) => setField("temperatureC", event.target.value)} /></Field><Field label="Viento"><input name="wind" value={draft.wind} onChange={(event) => setField("wind", event.target.value)} /></Field><Field label="Precipitación (%)" error={errors.precipitationPercent}><input name="precipitationPercent" type="number" min={0} max={100} value={draft.precipitationPercent} onChange={(event) => setField("precipitationPercent", event.target.value)} /></Field></div></FormSection>
      <FormSection title="Equipo en obra"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Personal propio" error={errors.workers}><input name="ownWorkers" type="number" min={0} step={1} value={draft.ownWorkers} onChange={(event) => setField("ownWorkers", event.target.value)} /></Field><Field label="Subcontratas" error={errors.workers}><input name="subcontractWorkers" type="number" min={0} step={1} value={draft.subcontractWorkers} onChange={(event) => setField("subcontractWorkers", event.target.value)} /></Field><div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3"><span className="text-[10px] text-emerald-700">Total en obra</span><strong className="mt-2 block text-lg text-content">{own + subcontract}</strong><span className="text-[9px] text-content-secondary">personas</span></div><Field label="Horas trabajadas" error={errors.hours}><input name="hours" type="number" min={0} step="0.25" value={draft.hours} onChange={(event) => setField("hours", event.target.value)} /></Field></div></FormSection>
      <FormSection title="Actividad realizada"><div className="grid gap-3 lg:grid-cols-[0.8fr_1.45fr_0.8fr]"><Field label="Actividad principal" required error={errors.activity}><select name="activity" value={draft.activity} onChange={(event) => setField("activity", event.target.value)}><option value="">Selecciona una actividad</option>{form.activityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field label="Descripción de la actividad" required error={errors.description}><input name="description" value={draft.description} onChange={(event) => setField("description", event.target.value)} /></Field><Field label="Ubicación / Zona" required error={errors.location}><select name="location" value={draft.location} onChange={(event) => setField("location", event.target.value)}><option value="">Selecciona una zona</option>{form.locationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div></FormSection>
      <FormSection title="Materiales utilizados"><div className="grid gap-2">{materialRows.map((row, index) => <div key={row.id} className="grid gap-2 rounded-lg border border-border p-2 md:grid-cols-[1.3fr_0.45fr_0.45fr_1fr_1.2fr_2.75rem]"><input name={`materials[${index}][name]`} aria-label={`Material ${index + 1}`} placeholder="Material" value={row.name} onChange={(event) => setMaterialRows((rows) => rows.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item))} className="field" /><input name={`materials[${index}][unit]`} aria-label={`Unidad del material ${index + 1}`} placeholder="Unidad" value={row.unit} onChange={(event) => setMaterialRows((rows) => rows.map((item) => item.id === row.id ? { ...item, unit: event.target.value } : item))} className="field" /><input name={`materials[${index}][quantity]`} aria-label={`Cantidad del material ${index + 1}`} type="number" min={0} step="any" placeholder="Cantidad" value={row.quantity} onChange={(event) => setMaterialRows((rows) => rows.map((item) => item.id === row.id ? { ...item, quantity: event.target.value } : item))} className="field" /><input name={`materials[${index}][provider]`} aria-label={`Proveedor del material ${index + 1}`} placeholder="Proveedor" value={row.provider} onChange={(event) => setMaterialRows((rows) => rows.map((item) => item.id === row.id ? { ...item, provider: event.target.value } : item))} className="field" /><input name={`materials[${index}][notes]`} aria-label={`Observaciones del material ${index + 1}`} placeholder="Observaciones" value={row.notes} onChange={(event) => setMaterialRows((rows) => rows.map((item) => item.id === row.id ? { ...item, notes: event.target.value } : item))} className="field" /><button type="button" aria-label={`Quitar material ${index + 1}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border text-content-secondary disabled:opacity-40" disabled={materialRows.length === 1} onClick={() => setMaterialRows((rows) => rows.filter((item) => item.id !== row.id))}><X size={15} /></button></div>)}</div>{errors.materials ? <p className="mt-2 text-[9px] text-danger">{errors.materials}</p> : null}<button type="button" className="secondary-button mt-3 min-h-11" onClick={() => setMaterialRows((rows) => [...rows, { id: `material-${Date.now()}`, name: "", unit: "", quantity: "", provider: "", notes: "" }])}><Plus size={15} /> Añadir material</button></FormSection>
      <FormSection title="Incidencias y observaciones"><div className="grid gap-3 lg:grid-cols-2"><Field label="Incidencias" error={errors.incidentDescription}><select name="incidentSeverity" value={draft.incidentSeverity} onChange={(event) => setField("incidentSeverity", event.target.value)}><option value="none">Sin incidencias registradas</option><option value="low">Incidencia leve</option><option value="medium">Incidencia media</option><option value="high">Incidencia grave</option></select><textarea name="incidentDescription" rows={3} className="mt-2" placeholder="Describe la incidencia" value={draft.incidentDescription} onChange={(event) => setField("incidentDescription", event.target.value)} /></Field><Field label="Observaciones generales"><textarea name="observations" rows={5} maxLength={1000} value={draft.observations} onChange={(event) => setField("observations", event.target.value)} /><span className="mt-1 block text-right text-[9px] text-content-tertiary">{draft.observations.length}/1000</span></Field></div></FormSection>
      <FormSection title="Fotografías y documentos"><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-subtle p-4 text-center"><Upload size={20} className="text-content-secondary" aria-hidden="true" /><span className="mt-2 text-xs font-semibold text-content">Seleccionar archivos</span><span className="mt-1 text-[9px] text-content-secondary">JPG, PNG o PDF · máximo 20 MB por archivo</span><input name="attachments" type="file" accept="image/jpeg,image/png,application/pdf" multiple className="sr-only" /></label>{errors.attachments ? <p className="mt-2 text-[9px] text-danger">{errors.attachments}</p> : null}</FormSection>
      <FormSection title="Validaciones y firma"><div className="grid gap-3 sm:grid-cols-2"><Field label="Responsable de obra" required error={errors.responsibleId}><select name="responsibleId" value={draft.responsibleId} onChange={(event) => setField("responsibleId", event.target.value)}><option value="">Selecciona responsable</option>{form.responsibleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><div className="rounded-lg border border-border bg-subtle p-3"><span className="text-[10px] font-semibold text-content">Firma y validación</span><p className="mt-1 text-[9px] leading-4 text-content-secondary">La firma se solicitará en el flujo autorizado después de guardar el registro. No se genera una firma ficticia.</p></div></div></FormSection>
    </form>
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 shadow-soft xl:sticky xl:top-24" aria-label="Resumen de revisión"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-content">Resumen de revisión</h2><StatusBadge status="draft" /></div><dl className="mt-4 grid gap-3 text-[10px]"><SummaryLine label="Fecha" value={formatDate(draft.date)} /><SummaryLine label="Horas trabajadas" value={draft.hours ? `${draft.hours} h` : "Sin registrar"} /><SummaryLine label="Personal en obra" value={`${own + subcontract} personas`} /><SummaryLine label="Actividad principal" value={form.activityOptions.find((option) => option.value === draft.activity)?.label ?? "Sin seleccionar"} /><SummaryLine label="Ubicación" value={form.locationOptions.find((option) => option.value === draft.location)?.label ?? "Sin seleccionar"} /><SummaryLine label="Incidencias" value={draft.incidentSeverity === "none" ? "Sin incidencias" : draft.incidentSeverity ? "Registrada" : "Sin revisar"} /><SummaryLine label="Materiales" value={`${materialRows.filter((row) => row.name.trim()).length} filas con datos`} /></dl><div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-800"><strong>Control previo</strong><p>Completa los campos obligatorios para enviar el parte a la ruta autorizada.</p></div></aside>
  </div>;
}

function PartDetailSurface({ work, routes, part }: { work: WorkContext; routes: WorkPartsRoutes; part: WorkPartRecord }) {
  const [tab, setTab] = useState<DetailTab>("summary");
  const progress = normalizedProgress(part);
  const tabs: Array<{ id: DetailTab; label: string; icon: typeof ClipboardCheck }> = [{ id: "summary", label: "Resumen", icon: ClipboardCheck }, { id: "workers", label: "Personal y horas", icon: UsersRound }, { id: "activities", label: "Trabajos realizados", icon: CheckCircle2 }, { id: "materials", label: "Materiales", icon: Package }, { id: "incidents", label: "Incidencias", icon: AlertTriangle }, { id: "photos", label: "Fotos", icon: Camera }, { id: "notes", label: "Notas y firmas", icon: FileText }, { id: "history", label: "Historial", icon: History }];
  return <div className="grid gap-4"><header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Link href={routes.listHref} className="text-[10px] font-semibold text-content-secondary hover:underline">Partes / Volver al listado</Link><h2 className="mt-2 text-xl font-bold text-content">Detalle de parte diario</h2><p className="mt-1 text-xs text-content-secondary">{work.title} · {part.code}</p></div><div className="flex flex-wrap gap-2">{part.editHref ? <Link href={part.editHref} className="secondary-button min-h-11"><Pencil size={15} /> Editar parte</Link> : null}{part.duplicateHref ? <Link href={part.duplicateHref} className="secondary-button min-h-11"><ClipboardList size={15} /> Duplicar</Link> : null}{part.sendHref ? <Link href={part.sendHref} className="secondary-button min-h-11"><Send size={15} /> Enviar</Link> : null}</div></header>
    <section className="grid gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft sm:grid-cols-2 xl:grid-cols-6" aria-label="Datos principales del parte"><DetailFact icon={CalendarDays} label="Fecha" value={formatDate(part.date)} /><DetailFact icon={ClipboardList} label="Obra" value={work.title} /><DetailFact icon={FileText} label="Código" value={part.code} /><DetailFact icon={CloudSun} label="Clima" value={[part.weather, part.temperatureC != null ? `${part.temperatureC} °C` : null].filter(Boolean).join(" · ") || "Sin registrar"} /><DetailFact icon={MapPin} label="Ubicación" value={part.location ?? "Sin registrar"} /><div className="min-w-0 border-l border-border pl-3"><span className="text-[9px] text-content-secondary">Estado</span><div className="mt-2"><StatusBadge status={part.status} /></div>{part.validatedBy ? <span className="mt-1 block truncate text-[9px] text-content-secondary">por {part.validatedBy}</span> : null}</div></section>
    <nav className="overflow-x-auto border-b border-border" aria-label="Secciones del parte"><div className="flex min-w-max">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-[10px] font-semibold ${tab === item.id ? "border-brand text-brand-strong" : "border-transparent text-content-secondary hover:text-content"}`}><Icon size={14} aria-hidden="true" />{item.label}</button>; })}</div></nav>
    <DetailTabContent tab={tab} part={part} progress={progress} />
  </div>;
}

function DetailTabContent({ tab, part, progress }: { tab: DetailTab; part: WorkPartRecord; progress: number | null }) {
  if (tab === "workers") return <DataPanel title="Personal y horas">{part.workers.length ? <div className="divide-y divide-border">{part.workers.map((worker) => <div key={worker.id} className="grid min-h-12 grid-cols-[minmax(0,1fr)_minmax(7rem,0.6fr)_5rem] items-center gap-3 py-2 text-xs"><strong>{worker.name}</strong><span className="text-content-secondary">{worker.role ?? "Sin rol"}</span><span className="text-right font-semibold">{worker.hours == null ? "—" : `${worker.hours.toLocaleString("es-ES")} h`}</span></div>)}</div> : <EmptyRecord text="No hay personal registrado en este parte." />}</DataPanel>;
  if (tab === "activities") return <DataPanel title="Trabajos realizados">{part.activities.length ? <ul className="grid gap-2">{part.activities.map((activity) => <li key={activity.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-xs"><CheckCircle2 size={15} className={activity.completed ? "text-success" : "text-content-tertiary"} /><span className="min-w-0 flex-1"><strong className="block text-content">{activity.title}</strong>{activity.location ? <small className="text-content-secondary">{activity.location}</small> : null}</span><span className="font-semibold">{activity.progress == null ? (activity.completed ? "Completada" : "Pendiente") : `${activity.progress}%`}</span></li>)}</ul> : <EmptyRecord text="No hay actividades registradas." />}</DataPanel>;
  if (tab === "materials") return <DataPanel title="Materiales utilizados">{part.materials.length ? <div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-xs"><thead className="text-content-secondary"><tr><th className="pb-2">Material</th><th className="pb-2">Cantidad</th><th className="pb-2">Proveedor</th><th className="pb-2">Observaciones</th></tr></thead><tbody className="divide-y divide-border">{part.materials.map((item) => <tr key={item.id}><td className="py-2 font-semibold">{item.name}</td><td className="py-2">{item.quantity} {item.unit}</td><td className="py-2">{item.provider ?? "—"}</td><td className="py-2">{item.notes ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyRecord text="No hay materiales registrados." />}</DataPanel>;
  if (tab === "incidents") return <DataPanel title={`Incidencias · ${part.incidents.length}`}>{part.incidents.length ? <div className="grid gap-3">{part.incidents.map((incident) => <article key={incident.id} className="rounded-lg border border-border p-3"><div className="flex items-start gap-3"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-warning" /><div><h3 className="text-xs font-bold text-content">{incident.title}</h3><p className="mt-1 text-[10px] text-content-secondary">{incident.severity}{incident.author ? ` · ${incident.author}` : ""}{incident.occurredAt ? ` · ${formatDate(incident.occurredAt, true)}` : ""}</p>{incident.description ? <p className="mt-2 text-xs leading-5 text-content-secondary">{incident.description}</p> : null}</div></div></article>)}</div> : <EmptyRecord text="No hay incidencias registradas en este parte." />}</DataPanel>;
  if (tab === "photos") return <DataPanel title={`Fotos del día · ${part.photos.length}`}><PhotoGrid photos={part.photos} /></DataPanel>;
  if (tab === "notes") return <div className="grid gap-4 lg:grid-cols-2"><DataPanel title="Notas"><p className="whitespace-pre-wrap text-xs leading-6 text-content-secondary">{part.notes?.trim() || "No hay notas registradas."}</p></DataPanel><DataPanel title="Firma y validación"><SignatureBlock part={part} /></DataPanel></div>;
  if (tab === "history") return <DataPanel title="Historial del parte">{part.history.length ? <ol className="grid gap-3">{part.history.map((item) => <li key={item.id} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-3 text-xs"><CheckCircle2 size={14} className="text-success" /><span><strong className="block text-content">{item.label}</strong>{item.actor ? <small className="text-content-secondary">{item.actor}</small> : null}</span><time className="text-[10px] text-content-secondary">{formatDate(item.occurredAt, true)}</time></li>)}</ol> : <EmptyRecord text="No hay historial persistido para este parte." />}</DataPanel>;
  return <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr_0.9fr]"><DataPanel title="Equipo en obra">{part.workers.length ? <ul className="grid gap-2">{part.workers.slice(0, 6).map((worker) => <li key={worker.id} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 text-[10px]"><UserRound size={13} className="text-content-secondary" /><span><strong className="block text-content">{worker.name}</strong><small className="text-content-secondary">{worker.role ?? "Sin rol"}</small></span><span>{worker.hours == null ? "—" : `${worker.hours} h`}</span></li>)}</ul> : <EmptyRecord text="Sin personal registrado." />}</DataPanel><DataPanel title="Trabajos realizados">{part.activities.length ? <ul className="grid gap-2">{part.activities.slice(0, 6).map((activity) => <li key={activity.id} className="flex items-center gap-2 text-[10px]"><CheckCircle2 size={13} className={activity.completed ? "text-success" : "text-content-tertiary"} /><span className="min-w-0 flex-1 truncate">{activity.title}</span><strong>{activity.completed ? "100%" : "Pendiente"}</strong></li>)}</ul> : <EmptyRecord text="Sin trabajos registrados." />}</DataPanel><div className="grid gap-4"><DataPanel title="Resumen del día"><div className="grid grid-cols-2 gap-3"><MiniMetric label="Horas" value={totalHours(part) == null ? "—" : `${totalHours(part)!.toLocaleString("es-ES")} h`} /><MiniMetric label="Avance" value={progress == null ? "—" : `${progress}%`} /><MiniMetric label="Personal" value={String(part.workers.length)} /><MiniMetric label="Incidencias" value={String(part.incidents.length)} /></div></DataPanel><DataPanel title="Clima y condiciones"><div className="flex items-center gap-3 text-content"><WeatherIcon weather={part.weather} size={26} /><div><strong className="block text-sm">{part.temperatureC == null ? "Sin temperatura" : `${part.temperatureC} °C`}</strong><span className="text-[10px] text-content-secondary">{part.weather ?? "Sin clima registrado"}</span></div></div></DataPanel></div><DataPanel title="Materiales utilizados">{part.materials.length ? <ul className="grid gap-2">{part.materials.slice(0, 6).map((item) => <li key={item.id} className="flex justify-between gap-3 text-[10px]"><span className="truncate text-content-secondary">{item.name}</span><strong>{item.quantity} {item.unit}</strong></li>)}</ul> : <EmptyRecord text="Sin materiales registrados." />}</DataPanel><DataPanel title={`Incidencias · ${part.incidents.length}`}>{part.incidents.length ? <ul className="grid gap-2">{part.incidents.slice(0, 3).map((incident) => <li key={incident.id} className="flex gap-2 text-[10px]"><AlertTriangle size={13} className="shrink-0 text-warning" /><span><strong className="block text-content">{incident.title}</strong><small className="text-content-secondary">{incident.description ?? incident.severity}</small></span></li>)}</ul> : <EmptyRecord text="Sin incidencias registradas." />}</DataPanel><DataPanel title={`Fotos del día · ${part.photos.length}`}><PhotoGrid photos={part.photos} compact /></DataPanel><DataPanel title="Notas"><p className="line-clamp-6 whitespace-pre-wrap text-xs leading-5 text-content-secondary">{part.notes?.trim() || "No hay notas registradas."}</p></DataPanel><DataPanel title="Firma y validación"><SignatureBlock part={part} /></DataPanel></div>;
}

function PhotoGrid({ photos, compact = false }: { photos: WorkPartPhoto[]; compact?: boolean }) { const safe = photos.filter((photo) => safeImageUrl(photo.url)); return safe.length ? <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>{safe.map((photo) => <figure key={photo.id} className="min-w-0"><Image src={photo.url} alt={photo.alt} width={240} height={160} unoptimized className="aspect-[4/3] w-full rounded-lg border border-border object-cover" />{photo.caption && !compact ? <figcaption className="mt-1 truncate text-[9px] text-content-secondary">{photo.caption}</figcaption> : null}</figure>)}</div> : <EmptyRecord text={photos.length ? "Las evidencias no tienen una URL segura disponible." : "No hay fotografías registradas."} />; }
function SignatureBlock({ part }: { part: WorkPartRecord }) { return <div>{safeImageUrl(part.signatureImageUrl) ? <Image src={part.signatureImageUrl!} alt={`Firma de ${part.validatedBy ?? "la persona responsable"}`} width={320} height={100} unoptimized className="h-20 w-full rounded-lg border border-border object-contain" /> : <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border bg-subtle text-[10px] text-content-secondary">Sin imagen de firma registrada</div>}<div className="mt-3 flex items-start justify-between gap-3 text-[10px]"><span><strong className="block text-content">{part.validatedBy ?? "Sin validar"}</strong><small className="text-content-secondary">Responsable de validación</small></span><time className="text-right text-content-secondary">{part.validatedAt ? formatDate(part.validatedAt, true) : "Sin fecha"}</time></div></div>; }
function DataPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-border bg-surface p-4 shadow-soft"><h2 className="mb-3 text-xs font-bold text-content">{title}</h2>{children}</section>; }
function EmptyRecord({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border bg-subtle p-5 text-center text-xs text-content-secondary">{text}</div>; }
function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-content-secondary">{label}</dt><dd className="text-right font-semibold text-content">{value}</dd></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border p-3"><span className="text-[9px] text-content-secondary">{label}</span><strong className="mt-1 block text-base text-content">{value}</strong></div>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-border p-4 last:border-b-0"><h2 className="mb-3 text-xs font-bold text-content">{title}</h2>{children}</section>; }
function Field({ label, required = false, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) { return <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-semibold text-content">{label}{required ? <span className="text-danger"> *</span> : null}</span><span className={`block [&>input]:field [&>select]:field [&>textarea]:field ${error ? "[&>input]:border-danger [&>select]:border-danger [&>textarea]:border-danger" : ""}`}>{children}</span>{error ? <span className="mt-1 block text-[9px] text-danger">{error}</span> : null}</label>; }
function DetailFact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex min-w-0 items-start gap-2 border-l border-border pl-3 first:border-l-0 first:pl-0"><Icon size={15} className="mt-0.5 shrink-0 text-content-secondary" aria-hidden="true" /><span className="min-w-0"><span className="block text-[9px] text-content-secondary">{label}</span><strong className="mt-1 block truncate text-[10px] text-content">{value}</strong></span></div>; }
