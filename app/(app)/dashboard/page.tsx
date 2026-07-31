import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BadgeEuro,
  CalendarDays,
  FileClock,
  Info,
  Network,
  ReceiptText,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState, ProductPage } from "@/components/ui-primitives";
import {
  CashForecastChart,
  IncomeExpensesChart,
  MarginBars,
  PipelineDonut,
} from "@/components/portal/dashboard-visuals";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import {
  dashboardPeriod,
  getDashboardOverview,
  type DashboardKpi,
  type DashboardProfitabilityRow,
} from "@/lib/portal/dashboard-overview";

export const dynamic = "force-dynamic";

const periodOptions = [
  { id: "this_month", label: "Este mes" },
  { id: "previous_month", label: "Mes anterior" },
  { id: "this_quarter", label: "Trimestre actual" },
  { id: "this_year", label: "Año actual" },
] as const;

const kpiIcons: Record<DashboardKpi["id"], LucideIcon> = {
  income: TrendingUp,
  expenses: ReceiptText,
  profit: BadgeEuro,
  margin: Network,
  receivable: FileClock,
  "cash-forecast": WalletCards,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; foco?: string }>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("reports.view");
  const requiredCapabilities = [
    "sales.budgets.view",
    "sales.invoices.view",
    "treasury.view",
    "banking.view",
    "purchases.received_invoices.view",
    "purchase_cost.view",
    "internal_cost.view",
    "margin_percent.view",
    "margin_amount.view",
    "profitability.view",
    "work.view",
    "tasks.view",
    "followups.view",
    "agenda.view",
    "documents.view",
  ] as const;
  const decisions = await Promise.all(requiredCapabilities.map((capability) => resolveAuthorization(auth, capability)));

  if (decisions.some((decision) => !decision.allowed || decision.scope !== "COMPANY")) {
    return (
      <ProductPage layout="analytical" className="dashboard-page dashboard-page--restricted">
        <EmptyState
          title="Dashboard restringido"
          description="La arquitectura del portal se mantiene, pero este perfil no puede consultar el análisis económico global de la empresa."
          icon={ShieldAlert}
          action={<Link href="/hoy" className="secondary-button">Volver a Hoy</Link>}
        />
      </ProductPage>
    );
  }

  const period = dashboardPeriod(query.periodo);
  const dashboard = await getDashboardOverview({ companyId: auth.companyId, period });
  const riskFocus = query.foco === "riesgo";
  const profitability = riskFocus
    ? dashboard.profitability.filter((row) => row.risk !== "Bajo")
    : dashboard.profitability;
  const visibleWorkIds = new Set(profitability.map((row) => row.workId));
  const marginWorks = riskFocus
    ? dashboard.marginWorks.filter((row) => visibleWorkIds.has(row.workId))
    : dashboard.marginWorks;
  const profitabilityTotals = buildVisibleTotals(profitability);

  return (
    <ProductPage layout="analytical" className="dashboard-page">
      <div className="dashboard-module" data-dashboard-reference="03">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visión operativa y financiera de tu negocio en tiempo real.</p>
        </div>
        <div className="dashboard-header-actions">
          <details className="dashboard-popover">
            <summary data-dashboard-period-trigger><span>{dashboard.periodLabel}</span><CalendarDays size={16} aria-hidden="true" /></summary>
            <nav aria-label="Seleccionar periodo del Dashboard">
              {periodOptions.map((option) => <Link key={option.id} href={dashboardHref(option.id, riskFocus)} aria-current={dashboard.period === option.id ? "page" : undefined}>{option.label}</Link>)}
            </nav>
          </details>
          <details className="dashboard-popover dashboard-popover--filters">
            <summary data-dashboard-filter-trigger><SlidersHorizontal size={16} aria-hidden="true" /><span>{riskFocus ? "Riesgos" : "Filtros"}</span></summary>
            <nav aria-label="Filtrar el Dashboard">
              <Link href={dashboardHref(dashboard.period, false)} aria-current={!riskFocus ? "page" : undefined}>Vista completa</Link>
              <Link href={dashboardHref(dashboard.period, true)} aria-current={riskFocus ? "page" : undefined}>Obras con riesgo</Link>
            </nav>
          </details>
        </div>
      </header>

      <section className="dashboard-kpis" aria-label="Indicadores principales" data-dashboard-kpis>
        {dashboard.kpis.map((kpi) => <DashboardKpiCard key={kpi.id} kpi={kpi} />)}
      </section>

      <section className="dashboard-top-grid" aria-label="Gráficos principales">
        <DashboardChartCard title="Ingresos vs. gastos por semana" href="/inteligencia#evolucion" chartId="income-expenses-weekly">
          <IncomeExpensesChart points={dashboard.weeklyTrend} />
        </DashboardChartCard>
        <DashboardChartCard title="Margen por obra (Top 5)" href="/inteligencia#rentabilidad" chartId="margin-top-5">
          <MarginBars rows={marginWorks} />
        </DashboardChartCard>
        <DashboardChartCard title="Caja prevista – Próximas 8 semanas" href="/tesoreria?vista=prevision&periodo=90d" chartId="cash-forecast-8-weeks">
          <CashForecastChart points={dashboard.cashForecast} />
        </DashboardChartCard>
      </section>

      <section className="dashboard-bottom-grid" aria-label="Pipeline y rentabilidad">
        <article className="dashboard-card dashboard-pipeline-card" data-dashboard-chart="pipeline-status">
          <DashboardCardHeading title="Pipeline de trabajos por estado" href="/presupuestos" />
          <PipelineDonut rows={dashboard.pipeline} />
          <p className="dashboard-pipeline-footer">Peso adjudicado y en ejecución: <strong>{pipelineConversion(dashboard.pipeline)}</strong></p>
        </article>
        <article className="dashboard-card dashboard-profitability" data-dashboard-profitability>
          <DashboardCardHeading title="Rentabilidad por obra" href="/inteligencia#rentabilidad" label="Ver todo" />
          <ProfitabilityTable rows={profitability} totals={riskFocus ? profitabilityTotals : dashboard.totals} />
        </article>
      </section>
      </div>
    </ProductPage>
  );
}

function DashboardKpiCard({ kpi }: { kpi: DashboardKpi }) {
  const Icon = kpiIcons[kpi.id];
  const DeltaIcon = kpi.tone === "negative" ? ArrowDown : ArrowUp;
  const comparison = splitComparison(kpi.comparison);
  return (
    <Link
      href={kpi.href}
      className="dashboard-kpi"
      data-dashboard-kpi
      data-kpi-id={kpi.id}
      aria-label={`${kpi.label}: ${kpi.value}. ${kpi.comparison}`}
      title={`${kpi.label}. Abre el análisis filtrado y conserva los permisos del perfil.`}
    >
      <span className="dashboard-kpi-icon" data-tone={kpi.id}><Icon size={16} aria-hidden="true" /></span>
      <span className="dashboard-kpi-label">{kpi.label}</span>
      <strong>{kpi.value}</strong>
      <small><span data-tone={kpi.tone}>{kpi.tone !== "neutral" ? <DeltaIcon size={10} aria-hidden="true" /> : null}{comparison.delta}</span>{comparison.context ? <span>{comparison.context}</span> : null}</small>
    </Link>
  );
}

function DashboardChartCard({
  title,
  href,
  chartId,
  children,
}: {
  title: string;
  href: string;
  chartId: string;
  children: React.ReactNode;
}) {
  return (
    <article className="dashboard-card dashboard-chart-card" data-dashboard-chart={chartId}>
      <DashboardCardHeading title={title} href={href} />
      {children}
    </article>
  );
}

function DashboardCardHeading({ title, href, label = "Ver detalle" }: { title: string; href: string; label?: string }) {
  return <header className="dashboard-card-heading"><h2>{title}</h2><Link href={href}>{label}</Link></header>;
}

function ProfitabilityTable({
  rows,
  totals,
}: {
  rows: DashboardProfitabilityRow[];
  totals: { progress: number; income: number; cost: number; margin: number };
}) {
  return (
    <div className="dashboard-profitability-table-wrap">
      <table>
        <caption className="sr-only">Rentabilidad real por trabajo autorizado</caption>
        <thead><tr><th scope="col">Obra</th><th scope="col">Avance</th><th scope="col">Ingresos</th><th scope="col">Coste</th><th scope="col">Margen</th><th scope="col">Riesgo</th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.workId} data-dashboard-profitability-row>
            <th scope="row"><Link href={row.href}>{row.title}</Link></th>
            <td data-label="Avance">{row.progress}%</td>
            <td data-label="Ingresos">{formatCurrency(row.income)}</td>
            <td data-label="Coste">{formatCurrency(row.cost)}</td>
            <td data-label="Margen">{formatPercent(row.margin)}</td>
            <td data-label="Riesgo"><Link href={row.href} className="dashboard-risk" data-risk={row.risk}>{row.risk}</Link></td>
          </tr>)}
        </tbody>
        <tfoot><tr><th scope="row">Total / Promedio</th><td>{totals.progress}%</td><td>{formatCurrency(totals.income)}</td><td>{formatCurrency(totals.cost)}</td><td>{formatPercent(totals.margin)}</td><td>—</td></tr></tfoot>
      </table>
      {!rows.length ? <p className="dashboard-inline-empty"><Info size={17} aria-hidden="true" />Registra ingresos y costes en una obra para calcular su rentabilidad.</p> : null}
    </div>
  );
}

function pipelineConversion(rows: Array<{ value: number }>) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const converted = (rows[3]?.value ?? 0) + (rows[4]?.value ?? 0);
  const percent = total ? converted / total * 100 : 0;
  return `${formatPercent(percent)} (${formatCurrency(converted)})`;
}

function splitComparison(value: string) {
  const match = value.match(/^(.*?)(\s+vs\..*)$/u);
  return match ? { delta: match[1], context: match[2].trim() } : { delta: value, context: "" };
}

function dashboardHref(period: string, riskFocus: boolean) {
  return `/dashboard?periodo=${period}${riskFocus ? "&foco=riesgo" : ""}`;
}

function buildVisibleTotals(rows: DashboardProfitabilityRow[]) {
  const income = rows.reduce((total, row) => total + row.income, 0);
  const cost = rows.reduce((total, row) => total + row.cost, 0);
  return {
    progress: rows.length ? Math.round(rows.reduce((total, row) => total + row.progress, 0) / rows.length) : 0,
    income,
    cost,
    margin: income ? ((income - cost) / income) * 100 : 0,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}
