import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  FileQuestion,
  Info,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { IntelligenceLegacyHashRedirect } from "@/components/portal/intelligence-legacy-hash-redirect";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { EmptyState, ProductPage } from "@/components/ui-primitives";
import {
  formatCurrency,
  formatDate,
  getBusinessIntelligenceSummary,
  type BusinessDataQualityIssue,
  type BusinessKpi,
  type BusinessTrendPoint,
} from "@/lib/business-intelligence";
import { round } from "@/lib/business-metrics";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import styles from "./intelligence.module.css";

export const dynamic = "force-dynamic";

type IntelligenceView = "resumen" | "evolucion" | "rentabilidad" | "calidad";
type TrendSeries = "all" | "invoiced" | "collected" | "expenses";
type Summary = Awaited<ReturnType<typeof getBusinessIntelligenceSummary>>;

const views: Array<{ id: IntelligenceView; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "evolucion", label: "Evolución" },
  { id: "rentabilidad", label: "Rentabilidad" },
  { id: "calidad", label: "Calidad de datos" },
];

const trendSeries: Array<{ id: TrendSeries; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "invoiced", label: "Facturado" },
  { id: "collected", label: "Cobrado" },
  { id: "expenses", label: "Gastos" },
];

export default async function BusinessIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; serie?: string; periodo?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const view = resolveView(query.vista);
  const series = resolveSeries(query.serie);
  const auth = await requireCapability("reports.view");
  const combinedCapabilities = [
    "work.view",
    "sales.budgets.view",
    "sales.invoices.view",
    "treasury.view",
    "purchases.received_invoices.view",
    "purchase_cost.view",
    "internal_cost.view",
    "margin_percent.view",
    "margin_amount.view",
    "profitability.view",
  ] as const;
  const combinedAccess = await Promise.all(combinedCapabilities.map((capability) => resolveAuthorization(auth, capability)));

  if (combinedAccess.some((decision) => !decision.allowed || decision.scope !== "COMPANY")) {
    return (
      <ProductPage layout="analytical" className={styles.page}>
        <EmptyState
          title="Inteligencia restringida"
          description="Este informe combina métricas globales de ventas, trabajos, cobros, compras, costes y rentabilidad."
          icon={ShieldAlert}
          action={<Link href="/hoy" className="secondary-button">Volver a Hoy</Link>}
        />
      </ProductPage>
    );
  }

  const summary = await getBusinessIntelligenceSummary({
    companyId: auth.companyId,
    period: query.periodo,
    from: query.from,
    to: query.to,
  });
  const periodQuery = buildPeriodQuery(summary, query);
  const activeView = views.find((item) => item.id === view) ?? views[0];

  return (
    <ProductPage layout="analytical" className={styles.page}>
      <IntelligenceLegacyHashRedirect />
      <div className={styles.navigationRow}>
        <div className={styles.breadcrumbs}>
          <InternalBreadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: activeView.label }]} label="Ruta de inteligencia" />
        </div>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> Volver al Dashboard
        </Link>
      </div>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Inteligencia empresarial</p>
          <h1>{viewTitle(view)}</h1>
          <p>{viewDescription(view, summary)}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/inteligencia/export?tipo=${view === "rentabilidad" ? "works" : "summary"}&${periodQuery.toString()}`} className="secondary-button">
            <Download size={16} aria-hidden="true" /> Exportar CSV
          </Link>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Vistas de inteligencia">
        {views.map((item) => (
          <Link key={item.id} href={viewHref(item.id, summary, query)} aria-current={view === item.id ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>

      <form action="/inteligencia" className={styles.filters}>
        <input type="hidden" name="vista" value={view} />
        {view === "evolucion" && series !== "all" ? <input type="hidden" name="serie" value={series} /> : null}
        <label>
          <span>Periodo</span>
          <select name="periodo" defaultValue={summary.period.id}>
            {summary.periodOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <DateField name="from" label="Desde" defaultValue={query.from ?? ""} />
        <DateField name="to" label="Hasta" defaultValue={query.to ?? ""} />
        <button className="primary-button" type="submit">Actualizar</button>
        <p>Actualizado {formatDate(summary.updatedAt)} · {summary.period.isComplete ? "periodo cerrado" : "periodo en curso"}</p>
      </form>

      {view === "resumen" ? <Overview summary={summary} query={periodQuery} /> : null}
      {view === "evolucion" ? <Evolution summary={summary} series={series} query={query} /> : null}
      {view === "rentabilidad" ? <Profitability summary={summary} query={periodQuery} /> : null}
      {view === "calidad" ? <DataQuality summary={summary} /> : null}
    </ProductPage>
  );
}

function Overview({ summary, query }: { summary: Summary; query: URLSearchParams }) {
  const principal = summary.kpis.filter((kpi) => ["invoiced", "collected", "outstanding", "overdue"].includes(kpi.id));
  return (
    <div className={styles.stack}>
      <KpiStrip items={principal} />
      <section className={styles.overviewGrid}>
        <article className={`${styles.panel} ${styles.health}`}>
          <div>
            <span>Índice de salud</span>
            <strong>{summary.health.canCalculate ? summary.health.score : "—"}</strong>
            <em>{summary.health.label}</em>
          </div>
          <div className={styles.healthBar} aria-label={`Índice de salud ${summary.health.score ?? 0} de 100`}>
            <span style={{ width: `${summary.health.score ?? 0}%` }} />
          </div>
          <ul>{summary.health.factors.slice(0, 4).map((factor) => <li key={factor}>{factor}</li>)}</ul>
        </article>
        <article className={styles.panel}>
          <PanelHeading icon={ShieldAlert} title="Atención prioritaria" href="/recomendaciones" label="Ver recomendaciones" />
          <div className={styles.compactList}>
            {summary.alerts.slice(0, 5).map((alert) => (
              <Link key={alert.id} href={alert.href} data-tone={alert.severity}>
                <span>{alert.title}</span><small>{alert.detail}</small>
              </Link>
            ))}
            {!summary.alerts.length ? <p className={styles.emptyLine}>No hay alertas críticas en el periodo.</p> : null}
          </div>
        </article>
      </section>
      <section className={styles.overviewGrid}>
        <article className={styles.panel}>
          <PanelHeading icon={BarChart3} title="Evolución del periodo" href={viewHrefFromQuery("evolucion", query)} />
          <MiniTrend points={summary.trend} />
        </article>
        <article className={styles.panel}>
          <PanelHeading icon={TrendingUp} title="Rentabilidad por obra" href={viewHrefFromQuery("rentabilidad", query)} />
          <CompactProfitRows rows={summary.works.byProfit.slice(0, 5)} />
        </article>
      </section>
    </div>
  );
}

function Evolution({ summary, series, query }: { summary: Summary; series: TrendSeries; query: { periodo?: string; from?: string; to?: string } }) {
  const cards = [
    metricCard("Facturado", summary.money.invoiced, summary.comparisons.invoiced, "/dinero"),
    metricCard("Cobrado", summary.money.collected, summary.comparisons.collected, "/dinero"),
    metricCard("Gastos", summary.money.expenses, summary.comparisons.expenses, "/gastos-materiales"),
    metricCard("Resultado operativo", summary.money.profitOnInvoiced, summary.comparisons.profit, "/inteligencia?vista=rentabilidad"),
  ];
  return (
    <div className={styles.stack} id="evolucion">
      <MetricStrip items={cards} />
      <section className={styles.panel}>
        <div className={styles.chartHeader}>
          <div><h2>Ingresos, cobros y gastos</h2><p>Serie real del periodo seleccionado; cada punto conserva su intervalo.</p></div>
          <nav className={styles.seriesTabs} aria-label="Series del gráfico">
            {trendSeries.map((item) => <Link key={item.id} href={seriesHref(item.id, summary, query)} aria-current={series === item.id ? "page" : undefined}>{item.label}</Link>)}
          </nav>
        </div>
        <TrendChart points={summary.trend} series={series} />
      </section>
      <section className={styles.panel} id="detalle-periodos">
        <div className={styles.tableHeading}>
          <div>
            <h2>Detalle por intervalo</h2>
            <p>Valores reales que componen la serie. Facturación y cobros abren sus registros; los gastos abren el libro de costes.</p>
          </div>
          <div className={styles.sourceLinks}>
            <Link href="/dinero">Facturas y cobros</Link>
            <Link href="/gastos-materiales">Libro de gastos</Link>
          </div>
        </div>
        <EvolutionBreakdown points={summary.trend} />
      </section>
      <section className={styles.analysisGrid}>
        <article className={styles.panel}>
          <h2>Comparativa con el periodo anterior</h2>
          <div className={styles.comparisonRows}>
            {cards.map((card) => <ComparisonRow key={card.label} {...card} />)}
          </div>
        </article>
        <article className={styles.panel}>
          <h2>Exposición de cobro</h2>
          <div className={styles.exposure}>
            <Link href="/dinero?filtro=pendientes"><span>Pendiente</span><strong>{formatCurrency(summary.money.outstanding)}</strong><small>Saldo abierto</small></Link>
            <Link href="/dinero?filtro=vencidas" data-tone="danger"><span>Vencido</span><strong>{formatCurrency(summary.money.overdue)}</strong><small>Requiere seguimiento</small></Link>
          </div>
        </article>
      </section>
    </div>
  );
}

function Profitability({ summary, query }: { summary: Summary; query: URLSearchParams }) {
  const negative = summary.works.byLowestMargin.filter((work) => work.hasEnoughData && work.marginOnInvoiced < 0);
  const items = [
    { label: "Beneficio facturado", value: formatCurrency(summary.money.profitOnInvoiced), note: "Facturado menos costes reales", href: "#rentabilidad-obras" },
    { label: "Beneficio cobrado", value: formatCurrency(summary.money.profitOnCollected), note: "Cobrado menos costes reales", href: "#rentabilidad-obras" },
    { label: "Margen", value: `${round(summary.money.marginOnInvoiced)}%`, note: "Sobre facturación válida", href: "#rentabilidad-obras" },
    { label: "Obras en negativo", value: String(negative.length), note: "Con datos suficientes", href: "#riesgo-rentabilidad" },
  ];
  return (
    <div className={styles.stack} id="rentabilidad">
      <MetricStrip items={items} />
      <section className={styles.panel}>
        <PanelHeading icon={BarChart3} title="Resultado por obra" href={`/inteligencia/export?tipo=works&${query.toString()}`} label="Exportar detalle" />
        <div className={styles.profitLegend} aria-label="Leyenda de rentabilidad">
          <span data-kind="income">Facturado</span>
          <span data-kind="cost">Gastos</span>
          <span data-kind="profit">Beneficio</span>
        </div>
        <ProfitabilityChart rows={summary.works.byProfit} />
      </section>
      <section className={styles.panel} id="rentabilidad-obras">
        <div className={styles.tableHeading}><div><h2>Detalle de rentabilidad</h2><p>Importes calculados por obra; no se reutilizan los datos de evolución temporal.</p></div></div>
        <div className={styles.tableWrap}>
          <table>
            <caption className="sr-only">Rentabilidad real por obra</caption>
            <thead><tr><th>Obra</th><th>Cliente</th><th>Facturado</th><th>Gastos</th><th>Beneficio</th><th>Margen</th><th>Pendiente</th><th>Detalle</th></tr></thead>
            <tbody>{summary.works.byProfit.map((work) => (
              <tr key={work.workId} data-risk={work.marginOnInvoiced < 0 ? "negative" : undefined}>
                <th scope="row"><Link href={`/obras/${work.workId}`}>{work.title}</Link></th>
                <td>{work.clientName}</td><td>{formatCurrency(work.invoiced)}</td><td>{formatCurrency(work.expenses)}</td>
                <td>{formatCurrency(work.profitOnInvoiced)}</td><td>{work.hasEnoughData ? `${round(work.marginOnInvoiced)}%` : "Sin datos"}</td><td>{formatCurrency(work.pending)}</td>
                <td><Link href={`/obras/${work.workId}`} className={styles.rowAction}>Abrir obra</Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className={styles.analysisGrid} id="riesgo-rentabilidad">
        <article className={styles.panel}>
          <h2>Menor margen</h2>
          <CompactProfitRows rows={summary.works.byLowestMargin.slice(0, 5)} />
        </article>
        <article className={styles.panel}>
          <h2>Gastos por categoría</h2>
          <CategoryBars rows={summary.money.expenseByCategory} />
        </article>
      </section>
    </div>
  );
}

function DataQuality({ summary }: { summary: Summary }) {
  return (
    <div className={styles.qualityGrid} id="calidad">
      <section className={styles.panel}>
        <PanelHeading icon={FileQuestion} title="Incidencias de calidad" />
        <QualityList issues={summary.qualityIssues} />
      </section>
      <section className={styles.panel}>
        <PanelHeading icon={Info} title="Diccionario de métricas" />
        <div className={styles.metricDictionary}>
          {summary.explanations.map((item) => item ? (
            <details key={item.id}><summary>{item.name}</summary><p><strong>Fórmula:</strong> {item.formula}</p><p><strong>Fuente:</strong> {item.source}</p></details>
          ) : null)}
        </div>
      </section>
    </div>
  );
}

function KpiStrip({ items }: { items: BusinessKpi[] }) {
  return <section className={styles.kpiStrip} aria-label="Indicadores principales">{items.map((kpi) => {
    const Icon = kpi.comparison.tone === "negative" ? ArrowDownRight : ArrowUpRight;
    return <Link key={kpi.id} href={kpi.href}><span>{kpi.label}</span><strong>{kpi.formatted}</strong><small data-tone={kpi.comparison.tone}><Icon size={12} aria-hidden="true" />{kpi.comparison.label}</small></Link>;
  })}</section>;
}

function MetricStrip({ items }: { items: Array<{ label: string; value: string; note: string; tone?: string; href?: string }> }) {
  return <section className={styles.metricStrip} aria-label="Resumen de la vista">{items.map((item) => {
    const content = <><span>{item.label}</span><strong>{item.value}</strong><small data-tone={item.tone}>{item.note}</small></>;
    return item.href ? <Link key={item.label} href={item.href}>{content}</Link> : <article key={item.label}>{content}</article>;
  })}</section>;
}

function PanelHeading({ icon: Icon, title, href, label = "Ver detalle" }: { icon: typeof Info; title: string; href?: string; label?: string }) {
  return <header className={styles.panelHeading}><h2><Icon size={17} aria-hidden="true" />{title}</h2>{href ? <Link href={href}>{label}</Link> : null}</header>;
}

function TrendChart({ points, series }: { points: BusinessTrendPoint[]; series: TrendSeries }) {
  const selected = series === "all" ? ["invoiced", "collected", "expenses"] as const : [series] as const;
  const values = points.flatMap((point) => selected.map((key) => point[key]));
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  const x = (index: number) => 58 + index * (720 / Math.max(1, points.length - 1));
  const y = (value: number) => 242 - Math.abs(value) / max * 182;
  const colors: Record<Exclude<TrendSeries, "all">, string> = { invoiced: "#16a34a", collected: "#2563eb", expenses: "#f05a67" };
  const labels: Record<Exclude<TrendSeries, "all">, string> = { invoiced: "Facturado", collected: "Cobrado", expenses: "Gastos" };

  return (
    <div className={styles.trendChart}>
      <svg viewBox="0 0 840 286" role="img" aria-label="Evolución de facturación, cobros y gastos del periodo">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <g key={ratio}><line x1="58" x2="778" y1={242 - ratio * 182} y2={242 - ratio * 182} /><text x="49" y={247 - ratio * 182} textAnchor="end">{compactCurrency(max * ratio)}</text></g>)}
        {selected.map((key) => {
          const coords = points.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");
          return <g key={key} data-series={key}><polyline points={coords} style={{ stroke: colors[key] }} />{points.map((point, index) => <circle key={point.key} cx={x(index)} cy={y(point[key])} r="4" style={{ fill: "white", stroke: colors[key] }}><title>{labels[key]} · {point.label}: {formatCurrency(point[key])}</title></circle>)}</g>;
        })}
        {points.map((point, index) => <text key={point.key} x={x(index)} y="270" textAnchor="middle">{point.label}</text>)}
      </svg>
      <div className={styles.chartLegend}>{selected.map((key) => <span key={key} style={{ "--series-color": colors[key] } as CSSProperties}>{labels[key]}</span>)}</div>
      <details className={styles.dataTable}><summary>Ver datos del gráfico</summary><div className={styles.tableWrap}><table><thead><tr><th>Intervalo</th><th>Facturado</th><th>Cobrado</th><th>Gastos</th></tr></thead><tbody>{points.map((point) => <tr key={point.key}><th>{point.label}</th><td>{formatCurrency(point.invoiced)}</td><td>{formatCurrency(point.collected)}</td><td>{formatCurrency(point.expenses)}</td></tr>)}</tbody></table></div></details>
    </div>
  );
}

function EvolutionBreakdown({ points }: { points: BusinessTrendPoint[] }) {
  if (!points.length) return <p className={styles.emptyLine}>No hay movimientos para el periodo seleccionado.</p>;
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption className="sr-only">Ingresos, cobros, gastos y resultado por intervalo</caption>
        <thead><tr><th>Intervalo</th><th>Facturado</th><th>Cobrado</th><th>Gastos</th><th>Resultado</th></tr></thead>
        <tbody>{points.map((point) => (
          <tr key={point.key}>
            <th scope="row">{point.label}</th>
            <td><Link href="/dinero">{formatCurrency(point.invoiced)}</Link></td>
            <td><Link href="/dinero">{formatCurrency(point.collected)}</Link></td>
            <td><Link href="/gastos-materiales">{formatCurrency(point.expenses)}</Link></td>
            <td data-tone={point.invoiced - point.expenses < 0 ? "negative" : "positive"}>{formatCurrency(point.invoiced - point.expenses)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function MiniTrend({ points }: { points: BusinessTrendPoint[] }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.invoiced, point.collected, point.expenses]));
  return <div className={styles.miniTrend}>{points.map((point) => <div key={point.key}><span>{point.label}</span><i><b style={{ height: `${point.invoiced / max * 100}%` }} /><b style={{ height: `${point.collected / max * 100}%` }} /><b style={{ height: `${point.expenses / max * 100}%` }} /></i></div>)}</div>;
}

function ProfitabilityChart({ rows }: { rows: Summary["works"]["byProfit"] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.invoiced), Math.abs(row.expenses), Math.abs(row.profitOnInvoiced)]));
  if (!rows.length) return <p className={styles.emptyLine}>Todavía no hay importes suficientes para comparar obras.</p>;
  return <div className={styles.profitChart}>{rows.slice(0, 8).map((row) => <Link key={row.workId} href={`/obras/${row.workId}`}><span><strong>{row.title}</strong><small>{row.clientName}</small></span><i><b data-bar="income" style={{ width: `${Math.abs(row.invoiced) / max * 100}%` }} /><b data-bar="cost" style={{ width: `${Math.abs(row.expenses) / max * 100}%` }} /><b data-bar={row.profitOnInvoiced < 0 ? "negative" : "profit"} style={{ width: `${Math.abs(row.profitOnInvoiced) / max * 100}%` }} /></i><em>{formatCurrency(row.profitOnInvoiced)}</em></Link>)}</div>;
}

function CompactProfitRows({ rows }: { rows: Summary["works"]["byProfit"] }) {
  if (!rows.length) return <p className={styles.emptyLine}>Sin obras comparables.</p>;
  return <div className={styles.profitRows}>{rows.map((work) => <Link key={work.workId} href={`/obras/${work.workId}`}><span><strong>{work.title}</strong><small>{work.clientName}</small></span><em>{formatCurrency(work.profitOnInvoiced)}<small data-tone={work.marginOnInvoiced < 0 ? "negative" : "positive"}>{round(work.marginOnInvoiced)}%</small></em></Link>)}</div>;
}

function CategoryBars({ rows }: { rows: Summary["money"]["expenseByCategory"] }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  if (!entries.length) return <p className={styles.emptyLine}>No hay gastos clasificados en el periodo.</p>;
  return <div className={styles.categories}>{entries.map(([label, value]) => <Link key={label} href={`/gastos-materiales?buscar=${encodeURIComponent(label)}`}><span>{label}</span><i><b style={{ width: `${value / max * 100}%` }} /></i><strong>{formatCurrency(value)}</strong></Link>)}</div>;
}

function QualityList({ issues }: { issues: BusinessDataQualityIssue[] }) {
  if (!issues.length) return <p className={styles.emptyLine}>No se han detectado incidencias de calidad.</p>;
  return <div className={styles.qualityList}>{issues.map((issue) => <Link key={issue.id} href={issue.href}><span><strong>{issue.title}</strong><small>{issue.description}</small></span><em>{issue.count}</em></Link>)}</div>;
}

function ComparisonRow({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small data-tone={tone}>{note}</small></div>;
}

function DateField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return <label><span>{label}</span><input type="date" name={name} defaultValue={defaultValue} /></label>;
}

function metricCard(label: string, value: number, comparison: Summary["comparisons"]["invoiced"], href: string) {
  return { label, value: formatCurrency(value), note: comparison.label, tone: comparison.tone, href };
}

function viewTitle(view: IntelligenceView) {
  if (view === "evolucion") return "Evolución de ingresos y gastos";
  if (view === "rentabilidad") return "Rentabilidad por obra";
  if (view === "calidad") return "Calidad de datos";
  return "Salud del negocio";
}

function resolveView(value?: string): IntelligenceView {
  return views.some((item) => item.id === value) ? value as IntelligenceView : "resumen";
}

function resolveSeries(value?: string): TrendSeries {
  return trendSeries.some((item) => item.id === value) ? value as TrendSeries : "all";
}

function viewDescription(view: IntelligenceView, summary: Summary) {
  if (view === "evolucion") return `Movimiento real de ingresos, cobros y gastos en ${summary.period.label.toLowerCase()}.`;
  if (view === "rentabilidad") return "Beneficio, margen y desviaciones calculados con la facturación y los costes registrados por obra.";
  if (view === "calidad") return "Incidencias de datos y fórmulas que condicionan la lectura de los indicadores.";
  return summary.summaryText;
}

function buildPeriodQuery(summary: Summary, query: { from?: string; to?: string }) {
  const params = new URLSearchParams({ periodo: summary.period.id });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params;
}

function viewHref(view: IntelligenceView, summary: Summary, query: { from?: string; to?: string }) {
  const params = buildPeriodQuery(summary, query);
  params.set("vista", view);
  return `/inteligencia?${params.toString()}`;
}

function viewHrefFromQuery(view: IntelligenceView, query: URLSearchParams) {
  const params = new URLSearchParams(query);
  params.set("vista", view);
  return `/inteligencia?${params.toString()}`;
}

function seriesHref(series: TrendSeries, summary: Summary, query: { from?: string; to?: string }) {
  const params = buildPeriodQuery(summary, query);
  params.set("vista", "evolucion");
  if (series !== "all") params.set("serie", series);
  return `/inteligencia?${params.toString()}`;
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { notation: "compact", style: "currency", currency: "EUR", maximumFractionDigits: 1 }).format(value);
}
