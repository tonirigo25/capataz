import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Flag,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActivityRailContext } from "@/components/portal/activity-rail-context";
import { ACTIVITY_PERIOD_OPTIONS, type ActivityPeriod } from "@/lib/activity";
import { getActivityWorkspace, type ActivitySection, type WorkspaceActivityItem } from "@/lib/activity-workspace";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type ActivityQuery = {
  seccion?: string;
  tipo?: string;
  periodo?: string;
  q?: string;
  obra?: string;
  equipo?: string;
  fecha?: string;
};

const tabs: Array<{ id: ActivitySection; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "operational", label: "Eventos operativos" },
  { id: "updates", label: "Actualizaciones" },
  { id: "orders", label: "Órdenes de trabajo" },
  { id: "incidents", label: "Incidencias" },
  { id: "milestones", label: "Hitos" },
  { id: "files", label: "Archivos" },
  { id: "comments", label: "Comentarios" },
];

const iconBySection: Record<Exclude<ActivitySection, "all">, LucideIcon> = {
  operational: CalendarDays,
  updates: BarChart3,
  orders: ClipboardList,
  incidents: AlertTriangle,
  milestones: Flag,
  files: ImageIcon,
  comments: MessageSquare,
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<ActivityQuery> }) {
  const query = await searchParams;
  const auth = await requireCapability("reports.view");
  if (auth.scope !== "COMPANY") redirect("/acceso-restringido?reason=scope");
  const required = ["clients.view", "work.view", "sales.budgets.view", "sales.invoices.view", "treasury.view", "purchase_cost.view", "agenda.view", "documents.view"] as const;
  const decisions = await Promise.all(required.map((capability) => resolveAuthorization(auth, capability)));
  if (decisions.some((decision) => !decision.allowed || decision.scope !== "COMPANY")) redirect("/acceso-restringido?reason=permission");

  const period = parsePeriod(query.periodo);
  const selectedSection = parseSection(query.seccion ?? query.tipo);
  const workspace = await getActivityWorkspace(auth.companyId, period);
  const normalizedSearch = query.q?.trim().toLocaleLowerCase("es") ?? "";
  const visible = workspace.items.filter((item) => {
    if (selectedSection !== "all" && item.section !== selectedSection) return false;
    if (query.obra && item.workId !== query.obra) return false;
    if (query.equipo && item.actor !== query.equipo) return false;
    if (query.fecha && localDateKey(item.date) !== query.fecha) return false;
    if (normalizedSearch && ![item.label, item.title, item.detail, item.entity, item.workTitle, item.actorName].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(normalizedSearch)) return false;
    return true;
  });

  const today = localDateKey(new Date());
  const metrics = [
    { id: "today", label: "Actividades hoy", value: workspace.items.filter((item) => localDateKey(item.date) === today).length, tone: "green" as const, icon: Activity, predicate: () => true, note: "registradas hoy" },
    { id: "incidents", label: "Incidencias abiertas", value: workspace.activeSignals.length, tone: "orange" as const, icon: AlertTriangle, predicate: (item: WorkspaceActivityItem) => item.section === "incidents", note: "señales activas" },
    { id: "updates", label: "Cambios registrados", value: workspace.items.filter((item) => item.section === "updates").length, tone: "blue" as const, icon: TrendingUp, predicate: (item: WorkspaceActivityItem) => item.section === "updates", note: `en ${periodLabel(period)}` },
    { id: "milestones", label: "Hitos alcanzados", value: workspace.items.filter((item) => item.section === "milestones").length, tone: "violet" as const, icon: Flag, predicate: (item: WorkspaceActivityItem) => item.section === "milestones", note: `en ${periodLabel(period)}` },
    { id: "files", label: "Archivos adjuntos", value: workspace.items.filter((item) => item.section === "files").length, tone: "slate" as const, icon: FileText, predicate: (item: WorkspaceActivityItem) => item.section === "files", note: `en ${periodLabel(period)}` },
  ];
  const workSummary = summarizeWorks(workspace.items).slice(0, 5);
  const topSignal = workspace.activeSignals[0] ?? null;
  const latest = workspace.items[0]?.date ?? null;
  const exportHref = `/actividad/export?${new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString()}`;

  return (
    <main className={`screen ${styles.page}`}>
      <ActivityRailContext value={{
        lastUpdated: latest?.toISOString() ?? null,
        totalVisible: visible.length,
        incidentCount: workspace.activeSignals.length,
        topSignal: topSignal ? { title: topSignal.title, summary: topSignal.summary, href: topSignal.href } : null,
        activeWorks: workSummary.slice(0, 3).map((work) => ({ id: work.id, title: work.title, count: work.total, href: `/obras/${work.id}` })),
        recommendations: workspace.activeSignals.slice(0, 3).map((signal) => ({ id: signal.id, title: signal.title, href: signal.href })),
      }} />

      <header className={styles.pageHeader}>
        <div><h1>Actividad</h1><p>Centro de actividad operativo en tiempo real. Todo lo que ocurre en tus obras y equipos.</p></div>
        <nav aria-label="Acciones de actividad">
          <Link className={styles.primaryButton} href={`/gestion?tipo=notaInterna&returnTo=${encodeURIComponent("/actividad")}`}><Plus size={15} aria-hidden="true" />Nueva actividad</Link>
          <Link className={styles.secondaryButton} href={exportHref}><Download size={15} aria-hidden="true" />Exportar</Link>
          <a className={styles.secondaryButton} href="#filtros"><Filter size={15} aria-hidden="true" />Filtrar</a>
        </nav>
      </header>

      <section className={styles.metrics} aria-label="Indicadores de actividad">
        {metrics.map((metric) => <MetricCard key={metric.id} {...metric} series={seriesFor(workspace.items, metric.predicate)} />)}
      </section>

      <nav className={styles.tabs} aria-label="Tipos de actividad">
        {tabs.map((tab) => <Link key={tab.id} href={activityHref(query, { seccion: tab.id === "all" ? null : tab.id })} aria-current={selectedSection === tab.id ? "page" : undefined}>{tab.label}</Link>)}
      </nav>

      <form id="filtros" className={styles.filters} method="get" aria-label="Filtros de actividad">
        {selectedSection !== "all" ? <input type="hidden" name="seccion" value={selectedSection} /> : null}
        <label className={styles.searchField}><Search size={15} aria-hidden="true" /><span className="sr-only">Buscar en la actividad</span><input name="q" defaultValue={query.q ?? ""} placeholder="Buscar en la actividad..." /></label>
        <label><span>Obra</span><select name="obra" defaultValue={query.obra ?? ""}><option value="">Todas</option>{workspace.workOptions.map((work) => <option key={work.id} value={work.id}>{work.label}</option>)}</select></label>
        <label><span>Equipo</span><select name="equipo" defaultValue={query.equipo ?? ""}><option value="">Todos</option>{workspace.actorOptions.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}</select></label>
        <label><span>Periodo</span><select name="periodo" defaultValue={period}>{ACTIVITY_PERIOD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className={styles.dateField}><span>Fecha</span><input type="date" name="fecha" defaultValue={query.fecha ?? ""} /></label>
        <button type="submit">Aplicar</button>
        <Link href={selectedSection === "all" ? "/actividad" : `/actividad?seccion=${selectedSection}`}>Limpiar filtros</Link>
      </form>

      <div className={styles.workspace}>
        <section className={styles.timelinePanel} aria-labelledby="activity-timeline-title">
          <header><h2 id="activity-timeline-title">{timelineHeading(query.fecha, visible[0]?.date)}</h2><span>{visible.length} movimientos</span></header>
          {visible.length ? <ol className={styles.timeline}>{visible.slice(0, 24).map((item) => <TimelineRow key={item.id} item={item} />)}</ol> : <div className={styles.emptyState}><Activity size={25} aria-hidden="true" /><h3>Sin actividad en este filtro</h3><p>Prueba con otro periodo, obra o tipo. No se generan movimientos de demostración.</p></div>}
        </section>

        <aside className={styles.summaryColumn} aria-label="Resumen e insights de actividad">
          <section className={styles.summaryCard}>
            <header><h2>Resumen por obras</h2><span>{periodLabel(period)}</span></header>
            {workSummary.length ? <div className={styles.workTable}><div className={styles.workTableHead}><span>Obra</span><span title="Actividad">Act.</span><span title="Incidencias">Inc.</span><span title="Archivos">Arc.</span></div>{workSummary.map((work) => <Link key={work.id} href={`/obras/${work.id}`}><strong>{work.title}</strong><span>{work.total}</span><span>{work.incidents}</span><span>{work.files}</span></Link>)}</div> : <p className={styles.panelEmpty}>No hay actividad vinculada a obras en el periodo.</p>}
            <Link className={styles.panelLink} href="/obras">Ver todas las obras</Link>
          </section>

          <section className={styles.insightsCard}>
            <header><Sparkles size={15} aria-hidden="true" /><h2>Insights de Orqena IA</h2></header>
            <p className={styles.insightMeta}>Análisis de actividad · {periodLabel(period)}</p>
            {workspace.activeSignals.length ? <ul>{workspace.activeSignals.slice(0, 3).map((signal, index) => <li key={signal.id} data-tone={signal.level === "critico" ? "risk" : index === 0 ? "attention" : "info"}><span>{signal.level === "critico" ? <AlertTriangle size={16} /> : index === 2 ? <CheckCircle2 size={16} /> : <BarChart3 size={16} />}</span><div><strong>{signal.title}</strong><p>{signal.summary ?? "Abre el detalle para revisar la evidencia registrada."}</p><Link href={signal.href}>Ver detalle</Link></div></li>)}</ul> : <div className={styles.safeInsight}><CheckCircle2 size={17} aria-hidden="true" /><div><strong>Sin incidencias activas</strong><p>No hay señales operativas activas dentro de tu alcance.</p></div></div>}
            <Link className={styles.panelLink} href="/orqena-ia/operaciones">Ver más insights en Orqena IA</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}

function MetricCard({ label, value, tone, icon: Icon, note, series }: { label: string; value: number; tone: string; icon: LucideIcon; note: string; series: number[] }) {
  return <article className={styles.metricCard} data-tone={tone}><div><span className={styles.metricIcon}><Icon size={16} aria-hidden="true" /></span><p>{label}</p><strong>{value}</strong><small>{note}</small></div><svg viewBox="0 0 82 34" role="img" aria-label={`Evolución de ${label.toLocaleLowerCase("es")}`}><polyline points={sparklinePoints(series)} /></svg></article>;
}

function TimelineRow({ item }: { item: WorkspaceActivityItem }) {
  const Icon = iconBySection[item.section];
  return <li className={styles.timelineRow} data-tone={item.tone}>
    <time dateTime={item.date.toISOString()}>{formatTime(item.date)}</time>
    <span className={styles.timelineDot} aria-hidden="true" />
    <article>
      <span className={styles.eventIcon}><Icon size={17} aria-hidden="true" /></span>
      <div className={styles.eventCopy}><small>{item.label}</small><h3>{item.title}</h3><p>{item.detail}</p>{item.actorName ? <span><UserRound size={11} aria-hidden="true" />{item.actorName}</span> : null}</div>
      <Link href={item.href}>Ver detalle</Link>
    </article>
  </li>;
}

function summarizeWorks(items: WorkspaceActivityItem[]) {
  const map = new Map<string, { id: string; title: string; total: number; incidents: number; files: number }>();
  for (const item of items) {
    if (!item.workId || !item.workTitle) continue;
    const current = map.get(item.workId) ?? { id: item.workId, title: item.workTitle, total: 0, incidents: 0, files: 0 };
    current.total += 1;
    if (item.section === "incidents") current.incidents += 1;
    if (item.section === "files") current.files += 1;
    map.set(item.workId, current);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, "es"));
}

function seriesFor(items: WorkspaceActivityItem[], predicate: (item: WorkspaceActivityItem) => boolean) {
  const result = Array.from({ length: 7 }, () => 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const item of items) {
    if (!predicate(item)) continue;
    const date = new Date(item.date);
    date.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (diff >= 0 && diff < 7) result[6 - diff] += 1;
  }
  return result;
}

function sparklinePoints(series: number[]) {
  const max = Math.max(...series, 1);
  return series.map((value, index) => `${4 + index * 12},${30 - (value / max) * 25}`).join(" ");
}

function parsePeriod(value?: string): ActivityPeriod {
  return ACTIVITY_PERIOD_OPTIONS.find((option) => option.id === value)?.id ?? "30d";
}

function parseSection(value?: string): ActivitySection {
  const direct = tabs.find((tab) => tab.id === value)?.id;
  if (direct) return direct;
  if (value === "obra" || value === "agenda") return "operational";
  if (value === "nota") return "comments";
  if (value === "documento") return "files";
  if (value && ["cliente", "contacto", "presupuesto", "factura", "pago", "gasto"].includes(value)) return "updates";
  return "all";
}

function activityHref(query: ActivityQuery, patch: { seccion?: string | null }) {
  const params = new URLSearchParams();
  const section = patch.seccion === undefined ? query.seccion : patch.seccion;
  if (section) params.set("seccion", section);
  if (query.periodo) params.set("periodo", query.periodo);
  if (query.q) params.set("q", query.q);
  if (query.obra) params.set("obra", query.obra);
  if (query.equipo) params.set("equipo", query.equipo);
  if (query.fecha) params.set("fecha", query.fecha);
  const search = params.toString();
  return search ? `/actividad?${search}` : "/actividad";
}

function localDateKey(value: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}

function timelineHeading(selectedDate: string | undefined, firstDate?: Date) {
  const value = selectedDate ? new Date(`${selectedDate}T12:00:00`) : firstDate ?? new Date();
  const prefix = localDateKey(value) === localDateKey(new Date()) ? "Hoy" : "Actividad";
  return `${prefix} · ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value)}`;
}

function periodLabel(period: ActivityPeriod) {
  return ACTIVITY_PERIOD_OPTIONS.find((option) => option.id === period)?.label.toLocaleLowerCase("es") ?? "periodo";
}
