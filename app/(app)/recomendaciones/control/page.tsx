import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  type LucideIcon,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { runProactiveEvaluationAction } from "@/app/(app)/recomendaciones/control/actions";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProactiveControlData } from "@/lib/proactive-evaluation";
import { requireCapability } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";
import styles from "./control-center.module.css";

export const dynamic = "force-dynamic";

type ControlSearchParams = {
  resultado?: string;
  run?: string;
};

type ControlData = Awaited<ReturnType<typeof getProactiveControlData>>;
type ControlRecommendation = ControlData["recommendations"][number];

const ACTIVE_STATUSES = new Set(["active", "viewed", "accepted", "in_progress", "failed"]);
const REVIEW_STATUSES = new Set(["viewed", "accepted", "in_progress"]);

export default async function ProactiveControlPage({
  searchParams,
}: {
  searchParams: Promise<ControlSearchParams>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("orqena.execute");
  const now = new Date();
  const [data, automations] = await Promise.all([
    getProactiveControlData(now, auth.companyId),
    prisma.automationDefinition.findMany({
      where: { companyId: auth.companyId, archivedAt: null },
      select: { id: true, status: true, active: true },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
  ]);

  const recommendations = data.recommendations;
  const active = recommendations.filter((item) => ACTIVE_STATUSES.has(item.status));
  const inReview = recommendations.filter((item) => REVIEW_STATUSES.has(item.status));
  const cutoff30d = new Date(now);
  cutoff30d.setDate(cutoff30d.getDate() - 30);
  const applied30d = recommendations.filter((item) => item.completedAt && item.completedAt >= cutoff30d);
  const economicImpact = active.reduce((total, item) => total + Math.max(0, item.amount ?? 0), 0);
  const categories = recommendationCategories(active);
  const health = recommendationHealth(active);
  const automationHealth = automationStatus(automations);
  const prioritized = [...active].sort((left, right) => right.priority - left.priority || right.score - left.score).slice(0, 4);
  const approvals = [...inReview].sort((left, right) => right.priority - left.priority).slice(0, 3);
  const recent = [...recommendations].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, 5);
  const metricCards: MetricCardData[] = [
    {
      label: "Recomendaciones activas",
      value: String(active.length),
      detail: trendLabel(dailySeries(active, "recommendedAt"), "registradas"),
      values: dailySeries(active, "recommendedAt"),
      href: "/recomendaciones?estado=active",
    },
    {
      label: "Impacto económico estimado",
      value: economicImpact ? signedCurrency(economicImpact) : "Sin importe",
      detail: economicImpact ? "Importes asociados a recomendaciones activas" : "Sin base económica registrada",
      values: dailyAmountSeries(active),
      href: "/recomendaciones?estado=active",
    },
    {
      label: "Ahorro potencial",
      value: "No calculable",
      detail: "Falta una base comparable aprobada",
      values: [],
      href: "/recomendaciones?estado=active",
    },
    {
      label: "Aplicadas (30 días)",
      value: String(applied30d.length),
      detail: trendLabel(dailySeries(applied30d, "completedAt"), "completadas"),
      values: dailySeries(applied30d, "completedAt"),
      href: "/recomendaciones?estado=history",
    },
    {
      label: "En revisión",
      value: String(inReview.length),
      detail: inReview.length ? "Pendientes de decisión humana" : "Sin cambios pendientes",
      values: dailySeries(inReview, "updatedAt"),
      href: "/recomendaciones?estado=viewed",
    },
    {
      label: "Tasa de adopción",
      value: `${data.metrics.acceptanceRate}%`,
      detail: `${data.metrics.accepted} aceptadas de ${recommendations.length} registradas`,
      values: dailySeries(recommendations.filter((item) => item.acceptedAt), "acceptedAt"),
      href: "/recomendaciones?estado=all",
    },
  ];

  return (
    <main className={`${styles.page} control-center-page`}>
      <InternalBreadcrumbs items={[
        { label: "Orqena IA", href: "/orqena-ia" },
        { label: "Recomendaciones", href: "/recomendaciones" },
        { label: "Centro de control" },
      ]} />

      <header className={styles.heading}>
        <div>
          <h1>Centro de control</h1>
          <p>Supervisa, prioriza y actúa sobre las recomendaciones impulsadas por Orqena IA.</p>
        </div>
        <div className={styles.headingActions}>
          <Link href="/configuracion/ia" className={styles.secondaryButton}>
            <Settings2 size={15} aria-hidden="true" /> Configurar centro
          </Link>
          <form action={runProactiveEvaluationAction}>
            <button type="submit" className={styles.iconButton} aria-label="Actualizar Centro de control" title="Actualizar Centro de control">
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </header>

      {query.resultado ? <EvaluationNotice result={query.resultado} run={query.run} /> : null}

      <section className={styles.metrics} aria-label="Indicadores del Centro de control">
        {metricCards.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <section className={styles.primaryGrid}>
        <Panel title="Salud de recomendaciones" className={styles.healthPanel}>
          <div className={styles.donutLayout}>
            <Donut total={active.length} segments={[
              { label: "Óptimas", value: health.optimal, color: "#079447" },
              { label: "Atención requerida", value: health.attention, color: "#f4bc15" },
              { label: "Riesgo alto", value: health.risk, color: "#ef4444" },
            ]} />
            <Legend rows={[
              { label: "Óptimas", value: health.optimal, total: active.length, color: "#079447" },
              { label: "Atención requerida", value: health.attention, total: active.length, color: "#f4bc15" },
              { label: "Riesgo alto", value: health.risk, total: active.length, color: "#ef4444" },
            ]} />
          </div>
        </Panel>

        <Panel title="Cola priorizada" action={<Link href="/recomendaciones?estado=active">Ver todas</Link>} className={styles.queuePanel}>
          {prioritized.length ? (
            <ul className={styles.queueList}>
              {prioritized.map((item) => (
                <li key={item.id}>
                  <PriorityBadge level={item.level} />
                  <span className={styles.queueCopy}>
                    <strong>{item.title}</strong>
                    <small>{item.entityType ? entityTypeLabel(item.entityType) : sourceLabel(item.source)} · Prioridad {item.priority}</small>
                  </span>
                  <span className={styles.queueImpact}>
                    <strong>{item.amount ? formatCurrency(item.amount) : "Sin importe"}</strong>
                    <small>Impacto registrado</small>
                  </span>
                  <Link href={recommendationHref(item)} className={styles.rowButton}>Revisar</Link>
                </li>
              ))}
            </ul>
          ) : <CompactEmpty title="Sin cola pendiente" detail="No hay recomendaciones activas que requieran revisión." />}
        </Panel>

        <Panel title="Estado de automatizaciones" className={styles.automationPanel}>
          <div className={styles.donutLayout}>
            <Donut total={automationHealth.total} center={`${automationHealth.activePercent}%`} centerLabel="automatizaciones activas" segments={[
              { label: "Activas", value: automationHealth.active, color: "#079447" },
              { label: "En aprendizaje", value: automationHealth.draft, color: "#f4bc15" },
              { label: "Con error", value: automationHealth.disabled, color: "#ef4444" },
              { label: "Pausadas", value: automationHealth.paused, color: "#cbd5e1" },
            ]} />
            <Legend rows={[
              { label: "Activas", value: automationHealth.active, total: automationHealth.total, color: "#079447" },
              { label: "En aprendizaje", value: automationHealth.draft, total: automationHealth.total, color: "#f4bc15" },
              { label: "Con error", value: automationHealth.disabled, total: automationHealth.total, color: "#ef4444" },
              { label: "Pausadas", value: automationHealth.paused, total: automationHealth.total, color: "#cbd5e1" },
            ]} />
          </div>
          <Link href="/automatizaciones" className={styles.panelFooterLink}>Ver automatizaciones</Link>
        </Panel>
      </section>

      <section className={styles.secondaryGrid}>
        <Panel title="Recomendaciones por categoría" action={<Link href="/recomendaciones?estado=all">Ver detalle</Link>}>
          <ul className={styles.categoryList}>
            {categories.map((category) => (
              <li key={category.label}>
                <span className={styles.categoryIcon}><category.Icon size={14} aria-hidden="true" /></span>
                <span>{category.label}</span>
                <span className={styles.barTrack}><span style={{ width: `${category.percent}%` }} /></span>
                <strong>{category.value}</strong>
                <small>{category.percent}%</small>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Aprobaciones pendientes" action={<Link href="/recomendaciones?estado=viewed">Ver todas</Link>}>
          {approvals.length ? <ul className={styles.approvalList}>{approvals.map((item) => (
            <li key={item.id}>
              <span className={styles.approvalIcon}><FileCheck2 size={14} aria-hidden="true" /></span>
              <Link href={recommendationHref(item)}><strong>{item.title}</strong><small>{item.summary}</small></Link>
              <span><em>Pendiente</em><small>{relativeTime(item.updatedAt, now)}</small></span>
            </li>
          ))}</ul> : <CompactEmpty title="Sin aprobaciones pendientes" detail="No hay recomendaciones aceptadas o en curso." />}
        </Panel>

        <Panel title="Estimación de impacto (próx. 30 días)" action={<Link href="/recomendaciones?estado=active">Ver informe</Link>}>
          <dl className={styles.impactList}>
            <ImpactRow icon={CircleDollarSign} label="Impacto económico total" value={economicImpact ? signedCurrency(economicImpact) : "Sin importe"} detail="Importes registrados" tone="success" />
            <ImpactRow icon={TrendingUp} label="Ahorro potencial" value="No calculable" detail="Sin base comparable" tone="neutral" />
            <ImpactRow icon={ShieldCheck} label="Riesgo económico priorizado" value={health.risk ? `${health.risk} señales` : "Sin señales"} detail="Nivel crítico" tone={health.risk ? "danger" : "success"} />
          </dl>
        </Panel>

        <Panel title="Riesgo operativo" action={<Link href="/recomendaciones?estado=active">Ver detalle</Link>}>
          <RiskRadar recommendations={active} />
        </Panel>
      </section>

      <Panel title="Actividad reciente de recomendaciones" className={styles.activityPanel}>
        {recent.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Fecha</th><th>Recomendación</th><th>Proyecto</th><th>Categoría</th><th>Impacto</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{recent.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td><Link href={recommendationHref(item)}>{item.title}</Link></td>
                  <td>{item.entityType ? entityTypeLabel(item.entityType) : "Empresa"}</td>
                  <td>{categoryFor(item).label}</td>
                  <td>{item.amount ? formatCurrency(item.amount) : levelImpact(item.level)}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td><div className={styles.tableActions}>
                    <Link href={recommendationHref(item)}>Revisar</Link>
                    <Link href={recommendationHref(item)}>Aplicar</Link>
                    {ACTIVE_STATUSES.has(item.status) ? <Link href={`${recommendationHref(item)}#seguimiento`}>Posponer</Link> : null}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <CompactEmpty title="Sin actividad reciente" detail="La actividad aparecerá cuando existan recomendaciones para esta empresa." />}
        <Link href="/recomendaciones?estado=history" className={styles.historyLink}>Ver historial completo</Link>
      </Panel>
    </main>
  );
}

function EvaluationNotice({ result, run }: { result: string; run?: string }) {
  const locked = result === "locked";
  const failed = result === "failed";
  return <div className={styles.notice} data-tone={failed ? "danger" : locked ? "warning" : "success"} role="status">
    <strong>{failed ? "La evaluación no se ha completado" : locked ? "Ya existe una evaluación en curso" : "Centro actualizado"}</strong>
    <span>{run ? `Referencia ${run}.` : "El resultado queda registrado en la auditoría interna."}</span>
  </div>;
}

type MetricCardData = { label: string; value: string; detail: string; values: number[]; href: string };

function MetricCard({ metric }: { metric: MetricCardData }) {
  return <Link href={metric.href} className={styles.metricCard}>
    <span>{metric.label}</span>
    <strong>{metric.value}</strong>
    <small>{metric.detail}</small>
    <Sparkline values={metric.values} />
  </Link>;
}

function Sparkline({ values }: { values: number[] }) {
  const safe = values.length ? values : [0, 0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...safe, 1);
  const points = safe.map((value, index) => `${(index / Math.max(1, safe.length - 1)) * 100},${30 - (value / max) * 25}`).join(" ");
  return <svg className={styles.sparkline} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function Panel({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`${styles.panel} ${className ?? ""}`}>
    <header><h2>{title}</h2>{action ? <span>{action}</span> : null}</header>
    <div className={styles.panelBody}>{children}</div>
  </section>;
}

type DonutSegment = { label: string; value: number; color: string };

function Donut({ total, segments, center, centerLabel }: { total: number; segments: DonutSegment[]; center?: string; centerLabel?: string }) {
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    cursor += total ? (segment.value / total) * 100 : 0;
    return `${segment.color} ${start}% ${cursor}%`;
  });
  if (!total) stops.push("#e7ece8 0 100%");
  const style = { "--donut-fill": `conic-gradient(${stops.join(", ")})` } as CSSProperties;
  return <div className={styles.donut} style={style} role="img" aria-label={`${total} elementos en total`}>
    <span><strong>{center ?? total}</strong><small>{centerLabel ?? "Total"}</small></span>
  </div>;
}

function Legend({ rows }: { rows: Array<{ label: string; value: number; total: number; color: string }> }) {
  return <ul className={styles.legend}>{rows.map((row) => <li key={row.label}>
    <i style={{ background: row.color }} /><span>{row.label}</span><strong>{row.value}</strong><small>{row.total ? Math.round((row.value / row.total) * 100) : 0}%</small>
  </li>)}</ul>;
}

function PriorityBadge({ level }: { level: string }) {
  return <span className={styles.priority} data-level={level}>{level === "critico" ? "Alta" : level === "importante" ? "Media" : "Baja"}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { active: "Nueva", viewed: "En revisión", accepted: "Aceptada", in_progress: "En curso", completed: "Aplicada", snoozed: "Pospuesta", dismissed: "Descartada", obsolete: "Obsoleta", failed: "Con error" };
  return <span className={styles.statusBadge} data-status={status}>{labels[status] ?? status}</span>;
}

function ImpactRow({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: "success" | "danger" | "neutral" }) {
  return <div data-tone={tone}><dt><Icon size={14} aria-hidden="true" />{label}</dt><dd><strong>{value}</strong><small>{detail}</small></dd></div>;
}

function RiskRadar({ recommendations }: { recommendations: ControlRecommendation[] }) {
  const labels = ["Costes", "Plazos", "Calidad", "Proveedores", "Recursos", "Financiero"];
  const counts = labels.map((label) => recommendations.filter((item) => riskAxis(item) === label).length);
  const max = Math.max(...counts, 1);
  const values = counts.map((value) => Math.max(12, (value / max) * 100));
  const points = radarPoints(values, 61);
  return <div className={styles.radarWrap}>
    <svg viewBox="0 0 220 158" role="img" aria-label="Distribución del riesgo operativo por categoría">
      {[61, 42, 23].map((radius) => <polygon key={radius} points={radarPoints([100, 100, 100, 100, 100, 100], radius)} className={styles.radarGrid} />)}
      {[0, 1, 2, 3, 4, 5].map((index) => <line key={index} x1="110" y1="79" x2={radarVertex(index, 61).x} y2={radarVertex(index, 61).y} className={styles.radarAxis} />)}
      <polygon points={points} className={styles.radarValue} />
      {labels.map((label, index) => { const vertex = radarVertex(index, 76); return <text key={label} x={vertex.x} y={vertex.y} textAnchor="middle" dominantBaseline="middle">{label}</text>; })}
    </svg>
    <div className={styles.radarLegend}><span><i />Riesgo actual</span><span><i />Referencia operativa</span></div>
  </div>;
}

function CompactEmpty({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.empty}><CheckCircle2 size={18} aria-hidden="true" /><span><strong>{title}</strong><small>{detail}</small></span></div>;
}

function recommendationHealth(items: ControlRecommendation[]) {
  return {
    optimal: items.filter((item) => item.level === "info").length,
    attention: items.filter((item) => item.level === "atencion" || item.level === "importante").length,
    risk: items.filter((item) => item.level === "critico").length,
  };
}

function automationStatus(items: Array<{ status: string; active: boolean }>) {
  const total = items.length;
  const active = items.filter((item) => item.active && item.status === "active").length;
  const draft = items.filter((item) => item.status === "draft").length;
  const disabled = items.filter((item) => item.status === "disabled").length;
  const paused = items.filter((item) => item.status === "paused" || (!item.active && item.status === "active")).length;
  return { total, active, draft, disabled, paused, activePercent: total ? Math.round((active / total) * 100) : 0 };
}

function recommendationCategories(items: ControlRecommendation[]) {
  const order = [
    { label: "Costes", Icon: CircleDollarSign },
    { label: "Plazos", Icon: CalendarClock },
    { label: "Calidad", Icon: ShieldCheck },
    { label: "Riesgos", Icon: AlertTriangle },
  ];
  const counts = new Map(order.map((item) => [item.label, 0]));
  for (const item of items) {
    const category = categoryFor(item).label;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return order.map((item) => {
    const value = counts.get(item.label) ?? 0;
    return { ...item, value, percent: items.length ? Math.round((value / items.length) * 100) : 0 };
  });
}

function categoryFor(item: ControlRecommendation) {
  if (["rentabilidad", "gastos", "materiales"].includes(item.source)) return { label: "Costes" };
  if (["agenda", "recordatorios", "visitas", "presupuestos", "cobros", "facturas"].includes(item.source)) return { label: "Plazos" };
  if (["documentos", "datos"].includes(item.source)) return { label: "Calidad" };
  return { label: "Riesgos" };
}

function riskAxis(item: ControlRecommendation) {
  if (["rentabilidad", "gastos", "materiales"].includes(item.source)) return "Costes";
  if (["agenda", "recordatorios", "visitas"].includes(item.source)) return "Plazos";
  if (["documentos", "datos"].includes(item.source)) return "Calidad";
  if (item.entityType?.toLowerCase().includes("supplier")) return "Proveedores";
  if (["obras", "chat"].includes(item.source)) return "Recursos";
  return "Financiero";
}

function recommendationHref(item: ControlRecommendation) {
  const params = new URLSearchParams({ estado: "all", seleccion: item.id });
  return `/recomendaciones?${params.toString()}`;
}

function sourceLabel(source: string) {
  return source.charAt(0).toLocaleUpperCase("es-ES") + source.slice(1).replaceAll("_", " ");
}

function entityTypeLabel(type: string) {
  const labels: Record<string, string> = { work: "Trabajo", invoice: "Factura", budget: "Presupuesto", client: "Cliente", document: "Documento", treasury: "Tesorería", agenda: "Agenda", reminder: "Recordatorio", expense: "Gasto" };
  return labels[type.toLowerCase()] ?? sourceLabel(type);
}

function levelImpact(level: string) {
  return level === "critico" ? "Riesgo alto" : level === "importante" ? "Atención" : "Informativo";
}

function signedCurrency(value: number) {
  return `+${formatCurrency(value)}`;
}

function relativeTime(value: Date, now: Date) {
  const hours = Math.max(0, Math.round((now.getTime() - value.getTime()) / 3_600_000));
  return hours < 1 ? "Ahora" : hours < 24 ? `Hace ${hours} h` : `Hace ${Math.round(hours / 24)} d`;
}

function dailySeries(items: ControlRecommendation[], key: "recommendedAt" | "updatedAt" | "completedAt" | "acceptedAt") {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const values = Array.from({ length: 8 }, () => 0);
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    const age = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (age >= 0 && age < values.length) values[values.length - 1 - age] += 1;
  }
  return values;
}

function dailyAmountSeries(items: ControlRecommendation[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const values = Array.from({ length: 8 }, () => 0);
  for (const item of items) {
    const date = new Date(item.recommendedAt);
    date.setHours(0, 0, 0, 0);
    const age = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (age >= 0 && age < values.length) values[values.length - 1 - age] += Math.max(0, item.amount ?? 0);
  }
  return values;
}

function trendLabel(values: number[], noun: string) {
  const half = Math.floor(values.length / 2);
  const previous = values.slice(0, half).reduce((sum, value) => sum + value, 0);
  const current = values.slice(half).reduce((sum, value) => sum + value, 0);
  const delta = current - previous;
  if (!delta) return `Sin cambios en ${noun}`;
  return `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} vs. período anterior`;
}

function radarVertex(index: number, radius: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 6;
  return { x: 110 + Math.cos(angle) * radius, y: 79 + Math.sin(angle) * radius };
}

function radarPoints(values: number[], radius: number) {
  return values.map((value, index) => {
    const vertex = radarVertex(index, radius * (value / 100));
    return `${vertex.x},${vertex.y}`;
  }).join(" ");
}
