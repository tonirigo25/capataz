import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  Info,
  Lightbulb,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dismissSignalAction, resolveSignalAction, snoozeSignalAction } from "@/app/(app)/alertas/actions";
import { AlertsRailContext, type AlertsRailContextValue } from "@/components/portal/alerts-rail-context";
import {
  formatSignalLevel,
  getBusinessSignals,
  signalSourceLabel,
  signalStatusLabel,
  type BusinessSignal,
  type BusinessSignalLevel,
  type BusinessSignalSource,
  type BusinessSignalStatus
} from "@/lib/business-signals";
import {
  getBusinessRecommendations,
  type BusinessRecommendation
} from "@/lib/business-recommendations";
import {
  filterBusinessRecommendationsForAccess,
  filterBusinessSignalsForAccess,
  resolveBusinessSignalAccess
} from "@/lib/business-signal-access";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import styles from "./alerts-page.module.css";

export const dynamic = "force-dynamic";

type AlertsSearchParams = {
  estado?: string;
  nivel?: string;
  origen?: string;
  q?: string;
  responsable?: string;
  desde?: string;
  hasta?: string;
  reco?: string;
  vista?: string;
};

type WorkContext = {
  id: string;
  title: string;
  client: string;
  responsible: string | null;
  href: string;
  photoUrl: string | null;
};

type ImpactedEntity = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  photoUrl: string | null;
  count: number;
  amount: number;
  critical: number;
};

const STATUS_OPTIONS: Array<{ value: BusinessSignalStatus | "all" | "history"; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "snoozed", label: "Pospuestas" },
  { value: "dismissed", label: "Descartadas" },
  { value: "resolved", label: "Resueltas" },
  { value: "expired", label: "Expiradas" },
  { value: "history", label: "Histórico" },
  { value: "all", label: "Todas" }
];

const LEVEL_OPTIONS: Array<{ value: BusinessSignalLevel | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "critico", label: "Crítica" },
  { value: "importante", label: "Alta" },
  { value: "atencion", label: "Media" },
  { value: "info", label: "Informativa" }
];

const SOURCE_OPTIONS: Array<{ value: BusinessSignalSource | "all"; label: string }> = [
  "all",
  "crm",
  "obras",
  "facturas",
  "cobros",
  "tesoreria",
  "agenda",
  "documentos",
  "materiales",
  "rentabilidad",
  "recordatorios",
  "visitas",
  "gastos",
  "presupuestos",
  "datos"
].map((value) => ({
  value: value as BusinessSignalSource | "all",
  label: value === "all" ? "Todos" : signalSourceLabel(value as BusinessSignalSource)
}));

const RECOMMENDATION_TABS = [
  { value: "para-ti", label: "Para ti" },
  { value: "oportunidades", label: "Oportunidades" },
  { value: "eficiencia", label: "Eficiencia" },
  { value: "calidad", label: "Calidad" },
  { value: "financieras", label: "Financieras" }
] as const;

type RecommendationTab = (typeof RECOMMENDATION_TABS)[number]["value"];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<AlertsSearchParams> }) {
  const query = await searchParams;
  const estado = validStatus(query.estado);
  const nivel = validLevel(query.nivel);
  const origen = validSource(query.origen);
  const recommendationTab = validRecommendationTab(query.reco);
  const q = query.q?.trim() ?? "";
  const responsibleFilter = query.responsable?.trim() ?? "all";
  const from = validDate(query.desde, false);
  const to = validDate(query.hasta, true);
  const auth = await requireCapability("orqena.execute");
  const { companyId } = auth;
  const [signalResult, recommendationResult, access, exportDecision] = await Promise.all([
    getBusinessSignals({ companyId, status: "all", limit: 600 }),
    getBusinessRecommendations({ companyId, status: "active", limit: 300 }),
    resolveBusinessSignalAccess(auth),
    resolveAuthorization(auth, "reports.export")
  ]);
  const authorizedSignals = filterBusinessSignalsForAccess(signalResult.signals, access);
  const authorizedRecommendations = filterBusinessRecommendationsForAccess(recommendationResult.recommendations, access);
  const signalSummary = summarizeSignals(authorizedSignals);
  const workIds = unique(authorizedSignals.map((signal) => signal.work?.id).filter(isString));
  const works = workIds.length
    ? await prisma.work.findMany({
      where: { companyId, id: { in: workIds } },
      select: {
        id: true,
        titulo: true,
        responsable: true,
        client: { select: { nombre: true } },
        photos: { orderBy: { tomadaEn: "desc" }, take: 5, select: { url: true, categoria: true } }
      }
    })
    : [];
  const workContext = new Map<string, WorkContext>(works.map((work) => [work.id, {
    id: work.id,
    title: work.titulo,
    client: work.client.nombre,
    responsible: work.responsable?.trim() || null,
    href: `/obras/${work.id}`,
    photoUrl: work.photos.find((photo) => safeImageUrl(photo.url) && photo.categoria.trim().toLowerCase() !== "incidencia")?.url
      ?? work.photos.find((photo) => safeImageUrl(photo.url))?.url
      ?? null
  }]));

  const filteredSignals = authorizedSignals.filter((signal) => matchesSignal({
    signal,
    estado,
    nivel,
    origen,
    q,
    responsibleFilter,
    from,
    to,
    workContext
  }));
  const visibleSignals = filteredSignals.slice(0, query.vista === "todas" ? 50 : 5);
  const activeSignals = authorizedSignals.filter((signal) => signal.status === "active");
  const responsibleOptions = unique(works.map((work) => work.responsable?.trim()).filter(isString)).sort((a, b) => a.localeCompare(b, "es"));
  const recommendations = recommendationsForTab(authorizedRecommendations, recommendationTab);
  const visibleRecommendations = recommendations.slice(0, 3);
  const resolvedThisWeek = countResolvedThisWeek(authorizedSignals);
  const impacted = buildImpacted(activeSignals, workContext).slice(0, 4);
  const exportHref = buildExportHref({ estado, nivel, origen, q, responsable: responsibleFilter, desde: query.desde, hasta: query.hasta });
  const railContext: AlertsRailContextValue = {
    activeCritical: signalSummary.critical,
    activeTotal: signalSummary.active,
    topTitle: signalSummary.top?.title ?? null,
    topDescription: signalSummary.top?.summary ?? null,
    topAmount: signalSummary.top?.relatedAmount ?? null,
    topHref: signalSummary.top?.entity?.href ?? null,
    actions: authorizedRecommendations.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      href: recommendationHref(item)
    }))
  };

  return (
    <main className={styles.page} data-alerts-recommendations-page>
      <AlertsRailContext value={railContext} />

      <nav className={styles.breadcrumbs} aria-label="Migas de pan">
        <Link href="/orqena-ia">Orqena IA</Link><ChevronRight size={12} aria-hidden="true" /><span>Alertas y recomendaciones</span>
      </nav>

      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}><h1>Alertas y recomendaciones</h1><span><ShieldCheck size={14} aria-hidden="true" /></span></div>
          <p>Centro inteligente de riesgos, oportunidades y acciones sugeridas.</p>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Indicadores de alertas y recomendaciones">
        <MetricCard label="Alertas críticas" value={signalSummary.critical} detail={`${signalSummary.active} alertas activas`} icon={AlertTriangle} tone="critical" href="/alertas?estado=active&nivel=critico" />
        <MetricCard label="Alertas altas" value={signalSummary.important} detail={`${signalSummary.attention} requieren atención`} icon={CircleAlert} tone="warning" href="/alertas?estado=active&nivel=importante" />
        <MetricCard label="Recomendaciones" value={authorizedRecommendations.length} detail="Pendientes de revisión humana" icon={Info} tone="info" href="/recomendaciones?estado=active" />
        <MetricCard label="Resueltas esta semana" value={resolvedThisWeek} detail={`${signalSummary.resolved} resueltas registradas`} icon={CheckCircle2} tone="success" href="/alertas?estado=resolved" />
        <MetricCard label="Importe relacionado" value={formatCurrency(signalSummary.totalAmount)} detail="Suma asociada; no es ahorro estimado" icon={Zap} tone="impact" href="/alertas?estado=active" />
      </section>

      <form className={styles.filters} action="/alertas">
        <FilterSelect name="nivel" label="Severidad" value={nivel} options={LEVEL_OPTIONS} />
        <FilterSelect name="origen" label="Tipo" value={origen} options={SOURCE_OPTIONS} />
        <FilterSelect name="estado" label="Estado" value={estado} options={STATUS_OPTIONS} />
        <label className={styles.searchField}><span>Proyecto / cliente</span><span><Search size={14} aria-hidden="true" /><input name="q" defaultValue={q} placeholder="Todos" /></span></label>
        <FilterSelect name="responsable" label="Responsable" value={responsibleFilter} options={[{ value: "all", label: "Todos" }, ...responsibleOptions.map((item) => ({ value: item, label: item }))]} />
        <div className={styles.dateRange}>
          <label><span>Desde</span><input type="date" name="desde" defaultValue={query.desde ?? ""} /></label>
          <label><span>Hasta</span><input type="date" name="hasta" defaultValue={query.hasta ?? ""} /></label>
          <CalendarDays size={14} aria-hidden="true" />
        </div>
        <button className={styles.filterButton} type="submit">Aplicar filtros</button>
        {exportDecision.allowed ? <Link className={styles.exportButton} href={exportHref} download><Download size={14} aria-hidden="true" />Exportar</Link> : null}
      </form>

      <section className={styles.workspace}>
        <section className={styles.alertPanel} aria-labelledby="high-priority-alerts">
          <div className={styles.panelHeader}>
            <h2 id="high-priority-alerts">Alertas de alta prioridad <span>{filteredSignals.length}</span></h2>
          </div>
          <div className={styles.alertTable}>
            <div className={styles.alertTableHead} aria-hidden="true"><span>Alerta</span><span>Severidad</span><span>Proyecto / cliente</span><span>Impacto</span><span>Responsable</span><span /></div>
            {visibleSignals.length ? visibleSignals.map((signal) => <AlertRow key={signal.fingerprint} signal={signal} work={signal.work?.id ? workContext.get(signal.work.id) ?? null : null} />) : <EmptyPanel title="No hay alertas con estos filtros" description="Amplía los criterios para consultar señales activas o el histórico conservado." />}
          </div>
          {filteredSignals.length > visibleSignals.length ? <Link className={styles.panelFooterLink} href={withCurrentQuery(query, { vista: "todas" })}>Ver todas las alertas <ChevronRight size={13} aria-hidden="true" /></Link> : null}
        </section>

        <section className={styles.recommendationPanel} aria-labelledby="recommendation-title">
          <div className={styles.panelHeader}><h2 id="recommendation-title">Recomendaciones <span>{authorizedRecommendations.length}</span></h2></div>
          <nav className={styles.tabs} aria-label="Categorías de recomendaciones">
            {RECOMMENDATION_TABS.map((tab) => <Link key={tab.value} href={withCurrentQuery(query, { reco: tab.value })} aria-current={recommendationTab === tab.value ? "page" : undefined}>{tab.label}</Link>)}
          </nav>
          <div className={styles.recommendationList}>
            {visibleRecommendations.length ? visibleRecommendations.map((recommendation) => <RecommendationRow key={recommendation.id} recommendation={recommendation} />) : <EmptyPanel title="Sin recomendaciones en esta categoría" description="No se han detectado acciones pendientes con el contexto y permisos actuales." />}
          </div>
          <Link className={styles.panelFooterLink} href="/recomendaciones?estado=all">Ver todas las recomendaciones <ChevronRight size={13} aria-hidden="true" /></Link>
        </section>
      </section>

      <section className={styles.impactedSection} aria-labelledby="impacted-title">
        <h2 id="impacted-title">Proyectos y clientes más impactados</h2>
        {impacted.length ? <div className={styles.impactedGrid}>{impacted.map((item) => <ImpactedCard key={item.key} item={item} />)}</div> : <EmptyPanel title="Sin entidades impactadas" description="Las entidades aparecerán aquí cuando exista una señal activa vinculada y visible para tu empresa." />}
      </section>
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone, href }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone: "critical" | "warning" | "info" | "success" | "impact"; href: string }) {
  return <Link href={href} className={styles.metricCard} data-tone={tone}><span className={styles.metricIcon}><Icon size={19} aria-hidden="true" /></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></Link>;
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return <label className={styles.selectField}><span>{label}</span><span><select name={name} defaultValue={value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></span></label>;
}

function AlertRow({ signal, work }: { signal: BusinessSignal; work: WorkContext | null }) {
  const entityHref = signal.entity?.href ?? work?.href ?? null;
  const entityLabel = work?.title ?? signal.work?.label ?? signal.client?.label ?? signal.entity?.label ?? "Sin entidad vinculada";
  const clientLabel = work?.client ?? signal.client?.label ?? signal.sourceLabel;
  const responsible = work?.responsible ?? "Sin asignar";
  return <article className={styles.alertRow} data-alert-level={signal.level}>
    <div className={styles.alertIdentity}><span className={styles.alertIcon}><AlertTriangle size={15} aria-hidden="true" /></span><span><strong>{signal.title}</strong><small>{signal.summary}</small></span></div>
    <span className={styles.severity} data-level={signal.level}>{formatSignalLevel(signal.level)}</span>
    <div className={styles.entityCell}>{entityHref ? <Link href={entityHref}>{entityLabel}</Link> : <strong>{entityLabel}</strong>}<small>{clientLabel}</small></div>
    <div className={styles.impactCell}><strong>{signal.relatedAmount != null ? formatCurrency(signal.relatedAmount) : "Sin importe"}</strong><small>Prioridad {signal.score}/100</small></div>
    <div className={styles.responsibleCell}><span><UserRound size={13} aria-hidden="true" /></span><strong>{responsible}</strong><small>{signal.fecha ? formatDate(signal.fecha) : "Sin fecha"}</small></div>
    <details className={styles.rowMenu}><summary aria-label={`Acciones para ${signal.title}`}><MoreHorizontal size={17} aria-hidden="true" /></summary><div>
      <strong>Revisión humana</strong>
      <p>{signal.explanation.why}</p>
      <p><b>Regla:</b> {signal.explanation.rule}</p>
      {entityHref ? <Link href={entityHref}>Abrir origen</Link> : null}
      {signal.status !== "resolved" ? <form action={snoozeSignalAction}><input type="hidden" name="fingerprint" value={signal.fingerprint} /><button name="preset" value="tomorrow" type="submit">Posponer hasta mañana</button></form> : null}
      {signal.status !== "resolved" ? <><p>Si la condición persiste, la señal volverá a activarse en la siguiente evaluación.</p><form action={resolveSignalAction}><input type="hidden" name="fingerprint" value={signal.fingerprint} /><button type="submit">Marcar como revisada</button></form></> : null}
      {signal.status !== "dismissed" && signal.status !== "resolved" ? <form action={dismissSignalAction}><input type="hidden" name="fingerprint" value={signal.fingerprint} /><input name="reason" required placeholder="Motivo del descarte" /><button type="submit">Descartar con motivo</button></form> : <small>{signalStatusLabel(signal.status)}</small>}
    </div></details>
  </article>;
}

function RecommendationRow({ recommendation }: { recommendation: BusinessRecommendation }) {
  return <article className={styles.recommendationRow}>
    <span className={styles.recommendationIcon}><Sparkles size={15} aria-hidden="true" /></span>
    <div><strong>{recommendation.title}</strong><p>{recommendation.summary}</p><footer><span>{recommendation.entityLabel ?? recommendation.sourceLabel}</span>{recommendation.amount != null ? <b>{formatCurrency(recommendation.amount)}</b> : null}<span><BadgeCheck size={12} aria-hidden="true" /> Prioridad {recommendation.priority}/100</span></footer></div>
    <Link href={recommendationHref(recommendation)}>Ver recomendación</Link>
  </article>;
}

function ImpactedCard({ item }: { item: ImpactedEntity }) {
  return <article className={styles.impactedCard}>
    {item.photoUrl ? <Image src={item.photoUrl} alt="" width={92} height={68} unoptimized /> : <span className={styles.impactedFallback}><Lightbulb size={18} aria-hidden="true" /></span>}
    <div><strong>{item.title}</strong><small>{item.subtitle}</small><b>{item.amount ? formatCurrency(item.amount) : "Sin importe asociado"}</b></div>
    <footer><span>{item.count} alerta{item.count === 1 ? "" : "s"}{item.critical ? ` · ${item.critical} críticas` : ""}</span><Link href={item.href}>Ver detalle</Link></footer>
  </article>;
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return <div className={styles.empty}><Info size={18} aria-hidden="true" /><div><strong>{title}</strong><p>{description}</p></div></div>;
}

function matchesSignal({ signal, estado, nivel, origen, q, responsibleFilter, from, to, workContext }: { signal: BusinessSignal; estado: BusinessSignalStatus | "all" | "history"; nivel: BusinessSignalLevel | "all"; origen: BusinessSignalSource | "all"; q: string; responsibleFilter: string; from: Date | null; to: Date | null; workContext: Map<string, WorkContext> }) {
  if (estado === "history" && !["dismissed", "resolved", "expired"].includes(signal.status)) return false;
  if (estado !== "all" && estado !== "history" && signal.status !== estado) return false;
  if (nivel !== "all" && signal.level !== nivel) return false;
  if (origen !== "all" && signal.source !== origen) return false;
  const work = signal.work?.id ? workContext.get(signal.work.id) : null;
  if (responsibleFilter !== "all" && work?.responsible !== responsibleFilter) return false;
  const date = signal.fecha ?? signal.detectedAt;
  if (from && date < from) return false;
  if (to && date > to) return false;
  if (q) {
    const haystack = [signal.title, signal.summary, signal.entity?.label, signal.client?.label, signal.work?.label, work?.title, work?.client, work?.responsible].filter(isString).join(" ").toLocaleLowerCase("es-ES");
    if (!haystack.includes(q.toLocaleLowerCase("es-ES"))) return false;
  }
  return true;
}

function recommendationsForTab(recommendations: BusinessRecommendation[], tab: RecommendationTab) {
  if (tab === "para-ti") return recommendations;
  const sourceGroups: Record<Exclude<RecommendationTab, "para-ti">, BusinessSignalSource[]> = {
    oportunidades: ["crm", "presupuestos"],
    eficiencia: ["obras", "agenda", "recordatorios", "materiales", "visitas"],
    calidad: ["documentos", "datos"],
    financieras: ["facturas", "cobros", "tesoreria", "rentabilidad", "gastos"]
  };
  return recommendations.filter((item) => sourceGroups[tab].includes(item.source));
}

function buildImpacted(signals: BusinessSignal[], workContext: Map<string, WorkContext>): ImpactedEntity[] {
  const result = new Map<string, ImpactedEntity>();
  for (const signal of signals) {
    const work = signal.work?.id ? workContext.get(signal.work.id) : null;
    const key = work ? `work:${work.id}` : signal.client ? `client:${signal.client.id}` : signal.entity ? `${signal.entity.type}:${signal.entity.id}` : null;
    if (!key) continue;
    const current = result.get(key) ?? {
      key,
      title: work?.title ?? signal.work?.label ?? signal.client?.label ?? signal.entity?.label ?? "Entidad",
      subtitle: work?.client ?? signal.client?.label ?? signal.sourceLabel,
      href: work?.href ?? signal.entity?.href ?? signal.client?.href ?? "/alertas",
      photoUrl: work?.photoUrl ?? null,
      count: 0,
      amount: 0,
      critical: 0
    };
    current.count += 1;
    current.amount += signal.relatedAmount ?? 0;
    current.critical += signal.level === "critico" ? 1 : 0;
    result.set(key, current);
  }
  return [...result.values()].sort((a, b) => b.critical - a.critical || b.amount - a.amount || b.count - a.count);
}

function countResolvedThisWeek(signals: BusinessSignal[]) {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return signals.filter((signal) => signal.resolvedAt && signal.resolvedAt >= monday && signal.resolvedAt <= now).length;
}

function summarizeSignals(signals: BusinessSignal[]) {
  const activeSignals = signals.filter((signal) => signal.status === "active");
  return {
    active: activeSignals.length,
    resolved: signals.filter((signal) => signal.status === "resolved").length,
    critical: activeSignals.filter((signal) => signal.level === "critico").length,
    important: activeSignals.filter((signal) => signal.level === "importante").length,
    attention: activeSignals.filter((signal) => signal.level === "atencion").length,
    totalAmount: activeSignals.reduce((total, signal) => total + (signal.relatedAmount ?? 0), 0),
    top: activeSignals.toSorted((a, b) => b.score - a.score || b.detectedAt.getTime() - a.detectedAt.getTime())[0] ?? null
  };
}

function recommendationHref(recommendation: BusinessRecommendation) {
  return `/recomendaciones?estado=all&seleccion=${encodeURIComponent(recommendation.id)}`;
}

function validStatus(value: string | undefined): BusinessSignalStatus | "all" | "history" {
  return STATUS_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalStatus | "all" | "history" : "active";
}

function validLevel(value: string | undefined): BusinessSignalLevel | "all" {
  return LEVEL_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalLevel | "all" : "all";
}

function validSource(value: string | undefined): BusinessSignalSource | "all" {
  return SOURCE_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalSource | "all" : "all";
}

function validRecommendationTab(value: string | undefined): RecommendationTab {
  return RECOMMENDATION_TABS.some((tab) => tab.value === value) ? value as RecommendationTab : "para-ti";
}

function validDate(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeImageUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && (value.startsWith("/") || value.startsWith("https://"));
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function withCurrentQuery(current: AlertsSearchParams, updates: Partial<AlertsSearchParams>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...updates })) if (value) params.set(key, value);
  return `/alertas?${params.toString()}`;
}

function buildExportHref(input: { estado: string; nivel: string; origen: string; q: string; responsable: string; desde?: string; hasta?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value && value !== "all") params.set(key, value);
  return `/alertas/export?${params.toString()}`;
}
