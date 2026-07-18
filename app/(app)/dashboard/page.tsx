import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Bot, BriefcaseBusiness, ShieldAlert } from "lucide-react";
import {
  EmptyState,
  Metric,
  ProductPage,
  Status,
  Surface
} from "@/components/ui-primitives";
import {
  formatCurrency,
  formatDate,
  getBusinessIntelligenceSummary,
  type BusinessAlert,
  type BusinessKpi,
  type BusinessTrendPoint
} from "@/lib/business-intelligence";
import { invoiceBalance, round } from "@/lib/business-metrics";
import { requireCompanyContext } from "@/lib/auth/session";
import { buildOperationalHealth, getOperationalIntelligence } from "@/lib/operational-intelligence/queries";
import { getEconomicControl } from "@/lib/economic-control/queries";

export const dynamic = "force-dynamic";

const supportedPeriods = new Set(["this_month", "previous_month", "this_quarter", "this_year"]);
const periodOptions = [
  { id: "this_month", label: "Este mes" },
  { id: "previous_month", label: "Mes anterior" },
  { id: "this_quarter", label: "Trimestre actual" },
  { id: "this_year", label: "Año actual" }
] as const;

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const requestedPeriod = supportedPeriods.has(query.periodo ?? "") ? query.periodo : "this_month";
  const [summary, intelligence, economic] = await Promise.all([
    getBusinessIntelligenceSummary({ companyId, period: requestedPeriod }),
    getOperationalIntelligence(),
    getEconomicControl({ period: "30d" })
  ]);
  const operationalHealth = buildOperationalHealth(intelligence.signals);
  const kpis = summary.kpis.filter((item) => ["invoiced", "collected", "outstanding", "expenses", "profit_invoiced"].includes(item.id));
  const periodEnd = new Date(summary.period.end.getTime() - 1);
  const hasEconomicData = kpis.some((item) => item.value !== 0) || summary.quotes.count > 0 || summary.works.byLowestMargin.some((work) => work.hasEnoughData);

  return (
    <ProductPage layout="analytical">
      <header className="mb-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="type-meta mb-2">Análisis global del negocio</p>
            <h1 className="type-page-title text-content">Dashboard</h1>
            <p className="type-body mt-2 max-w-3xl text-content-secondary">
              Comprende el periodo, compara resultados y abre siempre el dato que origina cada cifra.
            </p>
          </div>
          <Link href="/capataz" className="primary-button shrink-0">
            <Bot size={18} aria-hidden="true" />
            Preguntar por estos números
          </Link>
        </div>

        <Surface variant="secondary" className="mt-5 p-3 sm:p-4">
          <p className="label mb-2">Periodo</p>
          <nav aria-label="Seleccionar periodo" className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Link
                key={option.id}
                href={`/dashboard?periodo=${option.id}`}
                aria-current={summary.period.id === option.id ? "page" : undefined}
                className={summary.period.id === option.id ? "secondary-button border-brand text-brand-strong" : "ghost-button"}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 type-meta">
            <span>{formatDate(summary.period.start)} – {formatDate(periodEnd)}</span>
            <span>Comparación: periodo anterior equivalente</span>
            <span>Actualizado {formatDate(summary.updatedAt)}</span>
          </div>
        </Surface>
      </header>

      <section aria-labelledby="dashboard-operational-health" className="section-shell mb-10">
        <SectionHeading id="dashboard-operational-health" title="Salud operativa" description="Volumen de señales vigentes; cada cifra abre el detalle que la origina. No es una puntuación." action={<Link href="/hoy" className="secondary-button">Ver prioridades</Link>} />
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
          <Metric href="/hoy" label="Urgentes" value={String(operationalHealth.urgent)} detail="Requieren decisión inmediata" />
          <Metric href="/hoy?categoria=planificacion" label="Planificación" value={String(operationalHealth.planning)} detail="Tareas, seguimientos y agenda" />
          <Metric href="/hoy?categoria=cobros" label="Cobros" value={String(operationalHealth.collections)} detail="Pendientes próximos o vencidos" />
          <Metric href="/hoy?categoria=actividad" label="Obras inactivas" value={String(operationalHealth.inactiveWorks)} detail="Sin actividad objetiva reciente" />
          <Metric href="/hoy?categoria=compras_documentacion" label="Compras y documentos" value={String(operationalHealth.documentation)} detail="Pagos y vigencias documentales" />
        </div>
      </section>

      <section aria-labelledby="dashboard-economic-position" className="section-shell mb-10">
        <SectionHeading id="dashboard-economic-position" title="Posición económica" description="Vista compacta y trazable de caja registrada, cobros, pagos y previsión a 30 días." action={<Link href="/tesoreria?vista=resumen&periodo=30d" className="secondary-button">Abrir control económico</Link>} />
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
          <Metric href="/tesoreria?vista=resumen&periodo=30d" label="Caja registrada" value={economic.registeredBalance === null ? "Sin saldo registrado" : formatCurrency(economic.registeredBalance)} detail="Solo cuentas y movimientos existentes" />
          <Metric href="/tesoreria?vista=cobros&periodo=30d&estado=pendiente" label="Pendiente de cobro" value={formatCurrency(economic.receivableSummary.pending)} detail={`${economic.receivableSummary.overdueCount} facturas vencidas`} />
          <Metric href="/tesoreria?vista=pagos&periodo=30d&estado=pendiente" label="Pendiente de pago" value={formatCurrency(economic.payableSummary.pending)} detail={`${economic.payableSummary.overdueCount} obligaciones vencidas`} />
          <Metric href="/tesoreria?vista=prevision&periodo=30d" label="Flujo previsto" value={formatCurrency(economic.forecast.net)} detail="Según vencimientos documentados" />
          <Metric href="/tesoreria?vista=rentabilidad&periodo=30d" label="Obras con datos" value={String(economic.profitability.filter((row) => row.hasEnoughData).length)} detail="Beneficio y margen sin score global" />
        </div>
      </section>

      {!hasEconomicData ? (
        <EmptyState
          title="Aún no hay actividad económica suficiente"
          description="El Dashboard necesita facturas, cobros, gastos o presupuestos reales para construir un análisis. Empieza por preparar un presupuesto y registra después la actividad conforme ocurra."
          icon={BarChart3}
          action={<Link href="/gestion?tipo=presupuesto&returnTo=/dashboard" className="secondary-button">Crear presupuesto</Link>}
        />
      ) : (
        <>
          <section aria-labelledby="dashboard-resumen" className="section-shell">
            <SectionHeading id="dashboard-resumen" title="Resumen ejecutivo" description={`Todas las cifras usan ${summary.period.label.toLowerCase()} y el mismo periodo comparable.`} />
            <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
              {kpis.map((kpi) => <Kpi key={kpi.id} kpi={kpi} />)}
            </div>
          </section>

          <section aria-labelledby="dashboard-tendencia" className="section-shell mt-10">
            <SectionHeading id="dashboard-tendencia" title="Evolución del periodo" description="Facturación emitida, pagos registrados y gastos reales agrupados en intervalos legibles." />
            <TrendChart points={summary.trend} />
          </section>

          <div className="mt-10 grid gap-10 xl:grid-cols-2">
            <section aria-labelledby="dashboard-cobros" className="section-shell">
              <SectionHeading
                id="dashboard-cobros"
                title="Cobros y liquidez"
                description="Saldos abiertos a la fecha final del periodo, con vencidos primero."
                action={<Link href="/dinero?filtro=pendientes" className="secondary-button">Ver pendientes</Link>}
              />
              <div className="grid grid-cols-2 gap-2 border-b border-border pb-4 sm:grid-cols-4">
                <CompactMetric label="Pendiente" value={formatCurrency(summary.money.outstanding)} />
                <CompactMetric label="Vencido" value={formatCurrency(summary.money.overdue)} />
                <CompactMetric label="Cobrado" value={formatCurrency(summary.money.collected)} />
                <CompactMetric label="Facturas abiertas" value={String(summary.invoices.pendingInvoices.length)} />
              </div>
              <div className="divide-y divide-border">
                {summary.invoices.pendingInvoices.slice(0, 5).map((invoice) => {
                  const pending = invoiceBalance(invoice).pending;
                  const overdue = invoice.fechaVencimiento < new Date();
                  return (
                    <Link key={invoice.id} href={`/dinero/${invoice.id}`} className="grid min-h-16 gap-2 py-3 hover:bg-subtle sm:grid-cols-[1fr_auto] sm:items-center">
                      <span className="min-w-0">
                        <span className="type-object-title block text-content">{invoice.client.nombre}</span>
                        <span className="type-secondary mt-1 block">{invoice.numero} · vence {formatDate(invoice.fechaVencimiento)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-3 sm:justify-end">
                        <Status tone={overdue ? "risk" : "attention"}>{overdue ? "Vencida" : "Pendiente"}</Status>
                        <span className="tabular font-semibold text-content">{formatCurrency(pending)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <Link href="/tesoreria" className="ghost-button mt-3">Abrir tesorería</Link>
            </section>

            <section aria-labelledby="dashboard-riesgos" className="section-shell">
              <SectionHeading id="dashboard-riesgos" title="Riesgos del negocio" description="Señales deterministas ya existentes, resumidas sin puntuaciones técnicas." />
              <RiskList alerts={summary.alerts.slice(0, 5)} />
            </section>
          </div>

          <section aria-labelledby="dashboard-obras" className="section-shell mt-10">
            <SectionHeading id="dashboard-obras" title="Rentabilidad por obra" description="Las obras con menor margen aparecen primero; no representa avance físico." action={<Link href="/obras?estado=activas" className="secondary-button">Ver obras</Link>} />
            <WorkProfitability rows={summary.works.byLowestMargin.slice(0, 5)} />
          </section>

          <section aria-labelledby="dashboard-presupuestos" className="section-shell mt-10">
            <SectionHeading id="dashboard-presupuestos" title="Presupuestos y actividad comercial" description="Presupuestar no equivale a vender, facturar ni cobrar." action={<Link href="/presupuestos?filtro=pendientes" className="secondary-button">Ver presupuestos</Link>} />
            <div className="grid grid-cols-2 gap-2 border-b border-border pb-4 sm:grid-cols-4">
              <CompactMetric label="Importe presupuestado" value={formatCurrency(summary.quotes.validTotal)} />
              <CompactMetric label="Aceptados" value={String(summary.quotes.acceptedCount)} />
              <CompactMetric label="Pendientes" value={String(summary.quotes.pendingCount)} />
              <CompactMetric label="Tasa de aceptación" value={summary.quotes.conversionRate === null ? "Sin base" : `${round(summary.quotes.conversionRate)} %`} />
            </div>
            <div className="divide-y divide-border">
              {summary.quoteActivity.pending.map((budget) => (
                <Link key={budget.id} href={`/presupuestos/${budget.id}`} className="grid min-h-16 gap-2 py-3 hover:bg-subtle sm:grid-cols-[1fr_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="type-object-title block text-content">{budget.numero} · {budget.client.nombre}</span>
                    <span className="type-secondary mt-1 block">{budget.titulo}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 sm:justify-end">
                    <Status tone="attention">{statusLabel(budget.estado)}</Status>
                    <span className="tabular font-semibold text-content">{formatCurrency(budget.total)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </ProductPage>
  );
}

function SectionHeading({ id, title, description, action }: { id: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 id={id} className="type-section-title text-content">{title}</h2>
        <p className="type-secondary mt-1 max-w-3xl">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function Kpi({ kpi }: { kpi: BusinessKpi }) {
  const comparison = kpi.comparison;
  const comparisonClass = comparison.tone === "positive" ? "text-success" : comparison.tone === "negative" ? "text-danger" : "text-content-tertiary";
  return (
    <Metric
      href={kpi.href}
      label={kpi.label}
      value={kpi.formatted}
      detail={<><span className={comparisonClass}>{comparison.label}</span><span className="mt-1 block">{kpi.definition}</span></>}
    />
  );
}

function TrendChart({ points }: { points: BusinessTrendPoint[] }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.invoiced, point.collected, point.expenses]));
  const width = 720;
  const height = 240;
  const plotHeight = 170;
  const x = (index: number) => points.length <= 1 ? width / 2 : 38 + index * ((width - 76) / (points.length - 1));
  const y = (value: number) => 20 + plotHeight - value / max * plotHeight;
  const series = [
    { key: "invoiced" as const, label: "Facturado", className: "stroke-brand" },
    { key: "collected" as const, label: "Cobrado", className: "stroke-info" },
    { key: "expenses" as const, label: "Gastos", className: "stroke-warning" }
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 type-meta" aria-hidden="true">
        {series.map((item) => <span key={item.key} className="flex items-center gap-2"><span className={`h-0.5 w-5 ${item.key === "invoiced" ? "bg-brand" : item.key === "collected" ? "bg-info" : "bg-warning"}`} />{item.label}</span>)}
      </div>
      <div className="overflow-hidden rounded-xl bg-subtle p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="trend-title trend-description">
          <title id="trend-title">Evolución de facturación, cobros y gastos</title>
          <desc id="trend-description">Comparación temporal accesible de tres series. La tabla de datos completa aparece a continuación.</desc>
          {[0, 0.5, 1].map((step) => <line key={step} x1="38" x2={width - 38} y1={20 + plotHeight * step} y2={20 + plotHeight * step} className="stroke-border" strokeWidth="1" />)}
          {series.map((item) => (
            <g key={item.key}>
              <polyline points={points.map((point, index) => `${x(index)},${y(point[item.key])}`).join(" ")} className={`fill-none ${item.className}`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={point.key} cx={x(index)} cy={y(point[item.key])} r="4" className={`fill-surface ${item.className}`} strokeWidth="3" role="img" aria-label={`${item.label}, ${point.label}: ${formatCurrency(point[item.key])}`} />
              ))}
            </g>
          ))}
          {points.map((point, index) => <text key={point.key} x={x(index)} y="222" textAnchor="middle" className="fill-content-tertiary text-[11px]">{point.label}</text>)}
        </svg>
      </div>
      <details className="mt-3">
        <summary className="ghost-button cursor-pointer">Ver datos del gráfico</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Datos de facturación, cobros y gastos por intervalo</caption>
            <thead><tr className="border-b border-border"><th className="px-2 py-2">Intervalo</th><th className="px-2 py-2 text-right">Facturado</th><th className="px-2 py-2 text-right">Cobrado</th><th className="px-2 py-2 text-right">Gastos</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.key} className="border-b border-border"><th scope="row" className="px-2 py-2 font-medium">{point.label}</th><td className="px-2 py-2 text-right tabular">{formatCurrency(point.invoiced)}</td><td className="px-2 py-2 text-right tabular">{formatCurrency(point.collected)}</td><td className="px-2 py-2 text-right tabular">{formatCurrency(point.expenses)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-subtle p-3"><p className="type-label">{label}</p><p className="type-object-title mt-1 tabular text-content">{value}</p></div>;
}

function RiskList({ alerts }: { alerts: BusinessAlert[] }) {
  if (!alerts.length) return <EmptyState title="Sin riesgos deterministas ahora" description="No hay vencidos, márgenes negativos ni desviaciones relevantes detectadas con los datos disponibles." icon={ShieldAlert} />;
  return <div className="divide-y divide-border">{alerts.map((alert) => <Link key={alert.id} href={alert.href} className="grid min-h-16 gap-2 py-3 hover:bg-subtle sm:grid-cols-[auto_1fr_auto] sm:items-start"><Status tone={alert.severity === "danger" ? "risk" : alert.severity === "warning" ? "attention" : "neutral"}>{alert.severity === "danger" ? "Riesgo" : alert.severity === "warning" ? "Atención" : "Información"}</Status><span><span className="type-object-title block text-content">{alert.title}</span><span className="type-secondary mt-1 block">{alert.detail}</span></span><span className="text-sm font-semibold text-brand-strong">Abrir</span></Link>)}</div>;
}

function WorkProfitability({ rows }: { rows: Awaited<ReturnType<typeof getBusinessIntelligenceSummary>>["works"]["byLowestMargin"] }) {
  if (!rows.length) return <EmptyState title="Sin obras comparables" description="Añade facturación o gastos a una obra para poder comparar su resultado económico." icon={BriefcaseBusiness} />;
  return (
    <div>
      <div className="hidden grid-cols-[1.4fr_.7fr_.7fr_.7fr_.6fr] gap-3 border-b border-border px-2 py-2 type-label md:grid"><span>Obra</span><span className="text-right">Facturado</span><span className="text-right">Coste real</span><span className="text-right">Beneficio</span><span className="text-right">Margen</span></div>
      <div className="divide-y divide-border">{rows.map((work) => <Link key={work.workId} href={`/obras/${work.workId}`} className="grid gap-3 px-2 py-3 hover:bg-subtle md:grid-cols-[1.4fr_.7fr_.7fr_.7fr_.6fr] md:items-center"><span><span className="type-object-title block text-content">{work.title}</span><span className="type-secondary mt-1 block">{work.clientName} · {statusLabel(work.status)}</span></span><RowValue label="Facturado" value={formatCurrency(work.invoiced)} /><RowValue label="Coste real" value={formatCurrency(work.expenses)} /><RowValue label="Beneficio" value={formatCurrency(work.profitOnInvoiced)} risk={work.profitOnInvoiced < 0} /><RowValue label="Margen" value={work.hasEnoughData ? `${round(work.marginOnInvoiced)} %` : "Sin datos"} risk={work.marginOnInvoiced < 0} /></Link>)}</div>
    </div>
  );
}

function RowValue({ label, value, risk = false }: { label: string; value: string; risk?: boolean }) {
  return <span className={`flex justify-between gap-3 tabular md:block md:text-right ${risk ? "text-danger" : "text-content"}`}><span className="type-meta md:hidden">{label}</span><span className="font-semibold">{value}</span></span>;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
