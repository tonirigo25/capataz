import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  ChevronDown,
  Download,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { TreasuryRegistration } from "@/components/treasury-registration";
import { EmptyState, ProductPage, ResponsiveTable, Status } from "@/components/ui-primitives";
import type { BusinessRecommendation } from "@/lib/business-recommendations";
import type {
  EconomicArea,
  EconomicConcentration,
  EconomicControlData,
  EconomicDocument,
  EconomicDueGroup,
  EconomicForecast,
  EconomicProfitabilityRow,
} from "@/lib/economic-control/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import styles from "./economic-control-center.module.css";

const AREAS: Array<{ id: EconomicArea; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "cobros", label: "Cobros" },
  { id: "pagos", label: "Pagos" },
  { id: "prevision", label: "Previsión" },
  { id: "rentabilidad", label: "Rentabilidad" },
];

export function EconomicControlCenter({
  surface = "treasury",
  data,
  recommendations = [],
  canExport = false,
  canManage = false,
  canCreateInvoice = false,
  canManagePurchases = false,
}: {
  surface?: "money" | "treasury";
  data: EconomicControlData;
  recommendations?: BusinessRecommendation[];
  canExport?: boolean;
  canManage?: boolean;
  canCreateInvoice?: boolean;
  canManagePurchases?: boolean;
}) {
  const profitability = summarizeProfitability(data.profitability);
  const isMoney = surface === "money";

  return (
    <ProductPage layout="analytical" className={isMoney ? styles.moneyProductPage : undefined}>
      <div className={`${styles.page} ${isMoney ? styles.summaryPage : ""}`} data-economic-surface={surface}>
        <header className={styles.header}>
          {!isMoney ? <InternalBreadcrumbs items={[{ label: "Dinero", href: "/dinero" }, { label: "Detalle financiero" }]} /> : null}
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              {!isMoney ? <p className={styles.eyebrow}>Control económico</p> : null}
              <h1>{isMoney ? "Dinero" : "Detalle financiero"}</h1>
              <p>{isMoney ? "Tesorería, facturas y rentabilidad en tiempo real." : "Caja, cobros, pagos, vencimientos y rentabilidad conectados con su documento de origen."}</p>
            </div>
            <div className={styles.headerActions}>
              {canExport ? (
                <Link href={economicExportHref(data)} className={isMoney ? styles.reportLink : "secondary-button"}>
                  <Download size={15} aria-hidden="true" />
                  Ver informe completo
                </Link>
              ) : null}
              {!isMoney && canCreateInvoice ? <Link href="/gestion?tipo=factura&returnTo=/tesoreria" className="secondary-button">Nueva factura</Link> : null}
              {!isMoney && canManagePurchases ? <Link href="/facturas-proveedor?nuevo=1#factura" className="secondary-button">Factura recibida</Link> : null}
              {!isMoney && canManage ? <Link href="#treasury-registration" className="primary-button">Registrar movimiento</Link> : null}
            </div>
          </div>
        </header>

        <section className={styles.kpiStrip} aria-label="Posición económica documentada">
          <TreasuryKpi
            icon={WalletCards}
            label={isMoney ? "Caja disponible" : "Caja registrada"}
            value={data.registeredBalance === null ? "Sin saldo" : formatCurrency(data.registeredBalance)}
            detail={data.registeredBalance === null ? "Sin posición bancaria inventada" : `${data.accounts.length} cuentas activas`}
            tone="green"
          />
          <TreasuryKpi
            icon={ReceiptText}
            label="Por cobrar"
            value={formatCurrency(data.receivableSummary.pending)}
            detail={`${data.receivableSummary.openCount} facturas con saldo`}
            href={economicHref(data, { vista: "cobros", estado: "pendiente" })}
            tone="blue"
          />
          <TreasuryKpi
            icon={Banknote}
            label="Por pagar"
            value={formatCurrency(data.payableSummary.pending)}
            detail={`${data.payableSummary.openCount} obligaciones abiertas`}
            href={economicHref(data, { vista: "pagos", estado: "pendiente" })}
            tone="orange"
          />
          <TreasuryKpi
            icon={AlertTriangle}
            label="Vencido"
            value={formatCurrency(data.receivableSummary.overdue)}
            detail={`${data.receivableSummary.overdueCount} facturas vencidas`}
            href={economicHref(data, { vista: "cobros", estado: "vencido" })}
            tone="red"
          />
          <TreasuryKpi
            icon={TrendingUp}
            label={isMoney ? "Rentabilidad media" : "Rentabilidad registrada"}
            value={profitability.margin === null ? "Sin datos" : `${profitability.margin.toFixed(1)} %`}
            detail={`${profitability.count} obras comparables`}
            href={economicHref(data, { vista: "rentabilidad" })}
            tone="violet"
          />
        </section>

        {!isMoney ? <nav className={styles.tabs} aria-label="Áreas de control económico">
          {AREAS.map((area) => (
            <Link
              key={area.id}
              href={economicHref(data, { vista: area.id })}
              aria-current={data.area === area.id ? "page" : undefined}
            >
              {area.label}
            </Link>
          ))}
        </nav> : null}

        {!isMoney ? <EconomicFilters data={data} /> : null}

        {data.area === "resumen" ? <SummaryArea data={data} recommendations={recommendations} profitability={profitability} canManage={canManage} compact={isMoney} /> : null}
        {data.area === "cobros" ? <DocumentsArea direction="entrada" data={data} /> : null}
        {data.area === "pagos" ? <DocumentsArea direction="salida" data={data} /> : null}
        {data.area === "prevision" ? <ForecastArea forecast={data.forecast} /> : null}
        {data.area === "rentabilidad" ? <ProfitabilityArea rows={data.profitability} /> : null}
      </div>
    </ProductPage>
  );
}

function EconomicFilters({ data }: { data: EconomicControlData }) {
  return (
    <form action="/tesoreria" className={styles.filters} aria-label="Filtros de tesorería">
      <input type="hidden" name="vista" value={data.area} />
      <Field label="Periodo">
        <select className="field" name="periodo" defaultValue={data.period}>
          <option value="7d">7 días</option>
          <option value="30d">30 días</option>
          <option value="90d">90 días</option>
        </select>
      </Field>
      <Field label="Cliente">
        <select className="field" name="cliente" defaultValue={data.filters.clientId ?? "todos"}>
          <option value="todos">Todos</option>
          {data.filters.clients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Obra">
        <select className="field" name="obra" defaultValue={data.filters.workId ?? "todos"}>
          <option value="todos">Todas</option>
          {data.filters.works.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Estado">
        <select className="field" name="estado" defaultValue={data.filters.status ?? "todos"}>
          <option value="todos">Todos</option>
          <option value="pendiente">Con saldo</option>
          <option value="vencido">Vencido</option>
          <option value="parcial">Pago parcial</option>
          <option value="liquidado">Liquidado</option>
        </select>
      </Field>
      <button className="secondary-button" type="submit">Aplicar</button>
      <p>Previsión construida sólo con vencimientos registrados.</p>
    </form>
  );
}

function SummaryArea({
  data,
  recommendations,
  profitability,
  canManage,
  compact,
}: {
  data: EconomicControlData;
  recommendations: BusinessRecommendation[];
  profitability: ReturnType<typeof summarizeProfitability>;
  canManage: boolean;
  compact: boolean;
}) {
  const upcoming = nextDocuments(data.forecast);
  const receivables = data.receivables.filter((document) => document.pending > 0).slice(0, 5);

  return (
    <div className={styles.areaStack}>
      <div className={styles.primaryGrid}>
        <Panel
          className={styles.forecastPanel}
          id="treasury-forecast-summary"
          title="Flujo de caja proyectado"
          description={`${periodLabel(data.period)} · entradas, salidas y saldo a partir de vencimientos reales.`}
          action={<Link href={economicHref(data, { vista: "prevision", periodo: "90d" })}>Próximos 90 días <ChevronDown size={12} aria-hidden="true" /></Link>}
        >
          <ForecastVisualization forecast={data.forecast} />
        </Panel>

        <Panel
          id="treasury-open-documents"
          title="Cuentas por cobrar y pagar"
          description="Saldo abierto con acceso al documento original."
          action={<Link href={economicHref(data, { vista: "cobros", estado: "pendiente" })}>Ver todas</Link>}
        >
          <div className={styles.inlineTabs} aria-label="Acceso a cuentas por cobrar y pagar">
            <Link href={economicHref(data, { vista: "cobros", estado: "pendiente" })} aria-current="page">Por cobrar</Link>
            <Link href={economicHref(data, { vista: "pagos", estado: "pendiente" })}>Por pagar</Link>
          </div>
          {receivables.length ? <CompactDocumentTable documents={receivables} /> : <CompactEmpty>Sin facturas con saldo pendiente.</CompactEmpty>}
        </Panel>
      </div>

      <div className={styles.summaryGrid}>
        <Panel id="treasury-billing-state" title="Estado de facturación" description="Facturas emitidas y cobros registrados.">
          <BillingStatus data={data} />
        </Panel>

        <Panel
          id="treasury-work-profitability"
          title="Rentabilidad por obra"
          description="Resultado calculado con importes registrados."
        >
          {profitability.rows.length ? <ProfitabilityPreview rows={profitability.rows} /> : <CompactEmpty>Datos insuficientes para comparar obras.</CompactEmpty>}
          <PanelFooter href={economicHref(data, { vista: "rentabilidad" })}>Ver análisis por obra</PanelFooter>
        </Panel>

        <Panel
          id="treasury-next-due"
          title="Próximos vencimientos"
          description="Calendario de cobros y pagos documentados."
        >
          {upcoming.length ? <UpcomingList documents={upcoming.slice(0, 5)} /> : <CompactEmpty>Sin vencimientos próximos.</CompactEmpty>}
          <PanelFooter href={economicHref(data, { vista: "prevision" })}>Ver calendario completo</PanelFooter>
        </Panel>
      </div>

      {!compact ? <div className={styles.secondaryGrid}>
        <Panel id="treasury-position" title="Caja y movimientos" description="Sólo cuentas y movimientos registrados.">
          <CashPosition data={data} />
        </Panel>
        <Panel
          id="treasury-attention"
          title="Atención y recomendaciones"
          description="Señales reales que requieren revisión humana."
          action={<Link href="/recomendaciones?origen=tesoreria">Ver centro</Link>}
        >
          <AttentionList data={data} recommendations={recommendations} />
        </Panel>
      </div> : null}

      {!compact && canManage ? <div className={styles.registration}>
        <TreasuryRegistration accounts={data.accounts} returnTo={economicHref(data, {})} />
      </div> : null}

      {!compact ? <div className={styles.secondaryGrid}>
        <Concentration title="Saldo pendiente por cliente" rows={data.clientConcentration} empty="No hay saldos de clientes pendientes." />
        <Concentration title="Saldo pendiente por proveedor" rows={data.supplierConcentration} empty="No hay saldos de proveedores pendientes." />
      </div> : null}
    </div>
  );
}

function DocumentsArea({ direction, data }: { direction: "entrada" | "salida"; data: EconomicControlData }) {
  const documents = direction === "entrada" ? data.receivables : data.payables;
  const summary = direction === "entrada" ? data.receivableSummary : data.payableSummary;
  const isReceivable = direction === "entrada";
  const recentMovements = data.recentMovements
    .filter((movement) => movement.direction === (isReceivable ? "inflow" : "outflow"))
    .slice(0, 5);

  return (
    <div className={styles.areaStack}>
      <Panel
        id={`economic-${direction}`}
        title={isReceivable ? "Cobros" : "Pagos"}
        description={isReceivable ? "Facturas emitidas, pagos parciales y saldo pendiente real." : "Facturas recibidas y gastos independientes sin duplicar salidas."}
        action={<Link href={isReceivable ? "/dinero?filtro=pendientes" : "/facturas-proveedor"}>Abrir módulo operativo</Link>}
      >
        <div className={styles.areaKpis}>
          <MiniMetric label={isReceivable ? "Facturado" : "Recibido"} value={formatCurrency(summary.documented)} />
          <MiniMetric label={isReceivable ? "Cobrado" : "Pagado"} value={formatCurrency(summary.settled)} />
          <MiniMetric label="Pendiente" value={formatCurrency(summary.pending)} />
          <MiniMetric label="Vencido" value={formatCurrency(summary.overdue)} tone="danger" />
        </div>
        {documents.length ? <DocumentTable documents={documents} /> : (
          <EmptyState
            icon={ReceiptText}
            title={isReceivable ? "Todavía no hay facturas emitidas para analizar cobros" : "Todavía no hay facturas recibidas para analizar pagos"}
            description="Los documentos aparecerán aquí cuando se registren en su módulo de origen."
          />
        )}
      </Panel>

      {recentMovements.length ? (
        <Panel id={`economic-${direction}-recent`} title={`${isReceivable ? "Cobros" : "Pagos"} recientes`} description="Movimientos ya registrados en caja.">
          <MovementList movements={recentMovements} />
        </Panel>
      ) : null}
    </div>
  );
}

function ForecastArea({ forecast }: { forecast: EconomicForecast }) {
  return (
    <div className={styles.areaStack}>
      <Panel id="forecast-summary" title="Previsión por vencimientos" description="Entradas, salidas y saldo derivados exclusivamente de documentos pendientes con fecha registrada.">
        <div className={styles.areaKpis}>
          <MiniMetric label="Entradas previstas" value={formatCurrency(forecast.inflows)} tone="success" />
          <MiniMetric label="Salidas previstas" value={formatCurrency(forecast.outflows)} tone="danger" />
          <MiniMetric label="Flujo neto" value={formatCurrency(forecast.net)} />
          <MiniMetric label="Saldo proyectado" value={forecast.closingBalance === null ? "Sin saldo inicial" : formatCurrency(forecast.closingBalance)} />
        </div>
        <ForecastVisualization forecast={forecast} expanded />
      </Panel>
      <DueTimeline forecast={forecast} />
      {forecast.unscheduled.length ? (
        <Panel id="forecast-unscheduled" title="Sin vencimiento definido" description="Quedan fuera de la proyección hasta disponer de una fecha real.">
          <EconomicRows documents={forecast.unscheduled} />
        </Panel>
      ) : null}
    </div>
  );
}

function ForecastVisualization({ forecast, expanded = false }: { forecast: EconomicForecast; expanded?: boolean }) {
  if (!forecast.points.length) {
    return <EmptyState icon={TrendingUp} title="No existen vencimientos registrados" description="No se dibuja una previsión sin fechas suficientes." />;
  }

  const points = forecast.points.slice(0, expanded ? 18 : 12);
  const balancePoints = points.filter(
    (point): point is (typeof points)[number] & { balance: number } =>
      point.balance !== null,
  );
  const domainMin = Math.min(
    0,
    ...points.map((point) => -point.outflows),
    ...balancePoints.map((point) => point.balance),
  );
  const domainMax = Math.max(
    1,
    ...points.map((point) => point.inflows),
    ...balancePoints.map((point) => point.balance),
  );
  const domainRange = Math.max(1, domainMax - domainMin);
  const positionFor = (value: number) =>
    ((value - domainMin) / domainRange) * 100;
  const zeroPosition = positionFor(0);
  const axisValues = [0, 1, 2, 3].map(
    (index) => domainMax - (domainRange * index) / 3,
  );
  const minimumBalancePoint = balancePoints.reduce<
    (typeof balancePoints)[number] | null
  >(
    (minimum, point) =>
      !minimum || point.balance < minimum.balance ? point : minimum,
    null,
  );

  return (
    <div className={styles.forecastVisual} role="img" aria-label="Previsión de entradas, salidas y saldo acumulado por vencimiento">
      <div className={styles.chartLegend}>
        <span data-tone="inflow">Entradas</span>
        <span data-tone="outflow">Salidas</span>
        <span data-tone="balance">Saldo</span>
      </div>
      <div className={styles.chartCanvas}>
        <div className={styles.chartAxis} aria-hidden="true">
          {axisValues.map((value, index) => (
            <span key={`${index}-${value}`}>{formatCompactCurrency(value)}</span>
          ))}
        </div>
        <div className={styles.chartScroll}>
          <div className={styles.chartPlot} style={{ "--chart-columns": points.length } as CSSProperties}>
            {points.map((point, index) => {
              const balancePosition = point.balance === null ? null : positionFor(point.balance);
              const nextBalance = points[index + 1]?.balance ?? null;
              const nextBalancePosition = nextBalance === null ? null : positionFor(nextBalance);
              const inflowPosition = positionFor(point.inflows);
              const outflowPosition = positionFor(-point.outflows);
              return (
                <div className={styles.chartColumn} key={point.date.toISOString()}>
                  <div className={styles.barStage}>
                    <span
                      className={styles.inflowBar}
                      style={{
                        bottom: `${zeroPosition}%`,
                        height: `${Math.max(1.5, inflowPosition - zeroPosition)}%`,
                      }}
                    />
                    <span
                      className={styles.outflowBar}
                      style={{
                        bottom: `${outflowPosition}%`,
                        height: `${Math.max(1.5, zeroPosition - outflowPosition)}%`,
                      }}
                    />
                    {balancePosition !== null && nextBalancePosition !== null ? (
                      <span
                        className={styles.balanceSegment}
                        style={
                          {
                            "--balance-start": `${balancePosition}%`,
                            "--balance-end": `${nextBalancePosition}%`,
                          } as CSSProperties
                        }
                      />
                    ) : null}
                    {balancePosition !== null ? (
                      <span
                        className={styles.balancePoint}
                        style={{ bottom: `${balancePosition}%` }}
                      />
                    ) : null}
                  </div>
                  <span className={styles.chartDate}>{formatShortDate(point.date)}</span>
                  <span className="sr-only">Entrada {formatCurrency(point.inflows)}; salida {formatCurrency(point.outflows)}; saldo {point.balance === null ? "sin saldo inicial" : formatCurrency(point.balance)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {minimumBalancePoint ? (
        <div
          className={styles.forecastBand}
          data-tone={minimumBalancePoint.balance < 0 ? "danger" : "neutral"}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>
              {minimumBalancePoint.balance < 0
                ? "Tensión de caja prevista"
                : "Mínimo de caja previsto"}
            </strong>
            <small>
              {formatShortDate(minimumBalancePoint.date)} · saldo documentado {formatCurrency(minimumBalancePoint.balance)}
            </small>
          </span>
        </div>
      ) : null}
      <div className={styles.chartSummary}>
        <span>Entradas <strong>{formatCurrency(forecast.inflows)}</strong></span>
        <span>Salidas <strong>{formatCurrency(forecast.outflows)}</strong></span>
        <span>Flujo neto <strong>{formatCurrency(forecast.net)}</strong></span>
        <span>Saldo final <strong>{forecast.closingBalance === null ? "Sin saldo inicial" : formatCurrency(forecast.closingBalance)}</strong></span>
      </div>
    </div>
  );
}

function DueTimeline({ forecast }: { forecast: EconomicForecast }) {
  const groups: Array<{ id: EconomicDueGroup; label: string }> = [
    { id: "vencido", label: "Vencido" },
    { id: "hoy", label: "Hoy" },
    { id: "proximos_7_dias", label: "Próximos 7 días" },
    { id: "proximos_30_dias", label: "Próximos 30 días" },
    { id: "posterior", label: "Posterior" },
  ];

  return (
    <Panel id="cash-timeline" title="Calendario de caja" description="Cobros y pagos agrupados por su vencimiento documentado.">
      <div className={styles.dueGroups}>
        {groups.map((group) => {
          const documents = forecast.groups[group.id];
          return (
            <section key={group.id}>
              <div className={styles.dueGroupHeading}>
                <h3>{group.label}</h3>
                <span>{documents.length}</span>
              </div>
              {documents.length ? <EconomicRows documents={documents} /> : <CompactEmpty>Sin movimientos.</CompactEmpty>}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function ProfitabilityArea({ rows }: { rows: EconomicProfitabilityRow[] }) {
  const profitability = summarizeProfitability(rows);
  return (
    <Panel id="profitability" title="Rentabilidad por trabajo" description="Beneficio, margen, coste y desviación calculados con importes registrados.">
      <div className={styles.areaKpis}>
        <MiniMetric label="Beneficio agregado" value={profitability.count ? formatCurrency(profitability.profit) : "Sin datos"} tone="success" />
        <MiniMetric label="Margen agregado" value={profitability.margin === null ? "Sin datos" : `${profitability.margin.toFixed(1)} %`} />
        <MiniMetric label="Obras comparables" value={String(profitability.count)} />
        <MiniMetric label="Margen negativo" value={String(profitability.negative)} tone={profitability.negative ? "danger" : "neutral"} />
      </div>
      {rows.length ? (
        <ResponsiveTable label="Rentabilidad por obra">
          <table className={styles.dataTable}>
            <thead>
              <tr><th>Obra</th><th className={styles.numeric}>Beneficio</th><th className={styles.numeric}>Margen</th><th className={styles.numeric}>Coste real</th><th className={styles.numeric}>Facturado</th><th className={styles.numeric}>Desviación</th><th className={styles.numeric}>Pendiente</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.workId}>
                  <td><Link href={row.href}>{row.workTitle}</Link><small>{row.clientName} · {statusLabel(row.status)}</small><small>Presupuestado {formatCurrency(row.budgeted)} · Cobrado {formatCurrency(row.collected)}</small><small>Materiales {formatCurrency(row.materialCost)} · Subcontratas {formatCurrency(row.subcontractorCost)} · Generales {formatCurrency(row.generalCost)}</small></td>
                  <OptionalMoneyCell value={row.profit} />
                  <td className={styles.numeric}>{row.margin === null ? "Datos insuficientes" : `${row.margin.toFixed(1)} %`}</td>
                  <MoneyCell value={row.realCost} />
                  <MoneyCell value={row.invoiced} />
                  <td className={styles.numeric}>{row.deviation === null ? "Datos insuficientes" : formatCurrency(row.deviation)}<small>Referencia {formatCurrency(row.forecastCost)}</small></td>
                  <MoneyCell value={row.pending} />
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      ) : <EmptyState icon={BriefcaseBusiness} title="Todavía no hay costes suficientes" description="No se muestran ceros como si fueran resultados reales." />}
    </Panel>
  );
}

function BillingStatus({ data }: { data: EconomicControlData }) {
  const documented = data.receivableSummary.documented;
  const total = Math.max(1, documented);
  const paid = Math.min(100, data.receivableSummary.settled / total * 100);
  const overdue = Math.min(
    100 - paid,
    data.receivableSummary.overdue / total * 100,
  );
  const pending = Math.max(
    0,
    Math.min(
      100 - paid - overdue,
      (data.receivableSummary.pending - data.receivableSummary.overdue) /
        total *
        100,
    ),
  );
  const paidEnd = paid;
  const pendingEnd = paid + pending;
  const ringStyle = {
    "--billing-paid-end": `${paidEnd}%`,
    "--billing-pending-end": `${pendingEnd}%`,
    "--billing-overdue-end": `${paidEnd + pending + overdue}%`,
  } as CSSProperties;
  return (
    <div className={styles.billingStatus}>
      <div className={styles.billingVisual}>
        <div
          className={styles.billingRing}
          style={ringStyle}
          role="img"
          aria-label={`Estado de facturación: ${formatCurrency(data.receivableSummary.settled)} liquidados, ${formatCurrency(Math.max(0, data.receivableSummary.pending - data.receivableSummary.overdue))} pendientes y ${formatCurrency(data.receivableSummary.overdue)} vencidos`}
          data-empty={documented <= 0 ? "true" : "false"}
        >
          <span>
            <small>Total</small>
            <strong>{formatCurrency(documented)}</strong>
          </span>
        </div>
      </div>
      <dl>
        <div data-tone="paid"><dt>Liquidado</dt><dd>{formatCurrency(data.receivableSummary.settled)}<small>{Math.round(paid)} %</small></dd></div>
        <div data-tone="pending"><dt>Pendiente</dt><dd>{formatCurrency(Math.max(0, data.receivableSummary.pending - data.receivableSummary.overdue))}<small>{Math.round(pending)} %</small></dd></div>
        <div data-tone="overdue"><dt>Vencido</dt><dd>{formatCurrency(data.receivableSummary.overdue)}<small>{Math.round(overdue)} %</small></dd></div>
      </dl>
      <Link href={economicHref(data, { vista: "cobros" })}>Ver todas las facturas</Link>
    </div>
  );
}

function ProfitabilityPreview({ rows }: { rows: EconomicProfitabilityRow[] }) {
  return (
    <div className={styles.previewTable}>
      <div className={styles.previewHead}><span>Obra</span><span>Ingresos</span><span>Costes</span><span>Margen</span><span>Margen %</span></div>
      {rows.slice(0, 5).map((row) => (
        <Link href={row.href} key={row.workId}>
          <span>{row.workTitle}<small>{row.clientName}</small></span>
          <strong data-label="Ingresos">{formatCurrency(row.invoiced)}</strong>
          <strong data-label="Costes">{formatCurrency(row.realCost)}</strong>
          <strong data-label="Margen">{row.profit === null ? "—" : formatCurrency(row.profit)}</strong>
          <em data-label="Margen %" data-tone={(row.margin ?? 0) < 0 ? "danger" : "success"}>{row.margin === null ? "—" : `${row.margin.toFixed(1)} %`}</em>
        </Link>
      ))}
    </div>
  );
}

function UpcomingList({ documents }: { documents: EconomicDocument[] }) {
  return (
    <div className={styles.upcomingList}>
      {documents.map((document) => (
        <Link href={document.href} key={document.id}>
          <time dateTime={document.dueDate?.toISOString()}><span>{document.dueDate ? formatMonth(document.dueDate) : "—"}</span><strong>{document.dueDate?.getDate() ?? "—"}</strong></time>
          <span><strong>{document.number} · {document.partyName}</strong><small>{document.direction === "entrada" ? "Cobro" : "Pago"}</small></span>
          <span><strong>{formatCurrency(document.pending)}</strong><small>{dueLabel(document)}</small></span>
        </Link>
      ))}
    </div>
  );
}

function CashPosition({ data }: { data: EconomicControlData }) {
  if (data.registeredBalance === null) {
    return <CompactEmpty>No existe una posición bancaria registrada. La previsión conserva únicamente documentos pendientes.</CompactEmpty>;
  }
  return (
    <div className={styles.cashPosition}>
      <div className={styles.cashTotal}><span>Saldo total registrado</span><strong>{formatCurrency(data.registeredBalance)}</strong></div>
      <div className={styles.cashRows}>
        {data.accounts.slice(0, 4).map((account) => <div key={account.id}><span>{account.name}<small>{account.type}</small></span><strong>{formatCurrency(account.balance)}</strong></div>)}
      </div>
      {data.recentMovements.length ? <MovementList movements={data.recentMovements.slice(0, 4)} /> : null}
    </div>
  );
}

function MovementList({ movements }: { movements: EconomicControlData["recentMovements"] }) {
  return (
    <div className={styles.movementList}>
      {movements.map((movement) => {
        const content = <><span>{movement.description}<small>{formatDate(movement.date)} · {movement.accountName}</small></span><strong data-direction={movement.direction}>{movement.direction === "outflow" ? "−" : "+"}{formatCurrency(movement.amount)}</strong></>;
        return movement.href ? <Link key={movement.id} href={movement.href}>{content}</Link> : <div key={movement.id}>{content}</div>;
      })}
    </div>
  );
}

function AttentionList({ data, recommendations }: { data: EconomicControlData; recommendations: BusinessRecommendation[] }) {
  const signals = data.attentionSignals.slice(0, 3);
  const recommended = recommendations.slice(0, 2);
  if (!signals.length && !recommended.length) return <CompactEmpty>No hay señales económicas que requieran atención.</CompactEmpty>;
  return (
    <div className={styles.attentionList}>
      {signals.map((signal) => (
        <Link href={signal.href} key={signal.id}>
          <span><strong>{signal.title}</strong><small>{signal.explanation}</small></span>
          <span><Status tone={signal.level === "urgente" ? "risk" : signal.level === "atencion" ? "attention" : "neutral"}>{signal.level}</Status>{signal.amount === null ? null : <b>{formatCurrency(signal.amount)}</b>}</span>
        </Link>
      ))}
      {recommended.map((recommendation) => (
        <Link href="/recomendaciones?origen=tesoreria" key={recommendation.fingerprint}>
          <span><strong>{recommendation.title}</strong><small>{recommendation.summary}</small></span>
          <Status tone={recommendation.priority >= 80 ? "risk" : recommendation.priority >= 60 ? "attention" : "neutral"}>Prioridad {recommendation.priority}</Status>
        </Link>
      ))}
    </div>
  );
}

function CompactDocumentTable({ documents }: { documents: EconomicDocument[] }) {
  return (
    <div className={styles.compactDocuments}>
      <div className={styles.compactDocumentHead}><span>Entidad</span><span>Documento</span><span>Vencimiento</span><span>Importe</span><span>Estado</span></div>
      {documents.map((document) => {
        const overdue = isOverdue(document);
        return (
          <Link href={document.href} key={document.id}>
            <span>{document.partyName}</span><span>{document.number}</span><span>{document.dueDate ? formatDate(document.dueDate) : "Sin fecha"}</span><strong>{formatCurrency(document.pending)}</strong>
            <Status tone={overdue ? "risk" : "attention"}>{overdue ? "Vencido" : document.paid > 0 ? "Parcial" : "Pendiente"}</Status>
          </Link>
        );
      })}
    </div>
  );
}

function PanelFooter({ href, children }: { href: string; children: ReactNode }) {
  return <div className={styles.panelFooter}><Link href={href}>{children}</Link></div>;
}

function DocumentTable({ documents }: { documents: EconomicDocument[] }) {
  return (
    <ResponsiveTable label="Documentos económicos">
      <table className={styles.dataTable}>
        <thead><tr><th>Documento</th><th>Entidad y obra</th><th>Emisión</th><th>Vencimiento</th><th className={styles.numeric}>Total</th><th className={styles.numeric}>Liquidado</th><th className={styles.numeric}>Saldo</th><th>Estado</th></tr></thead>
        <tbody>
          {documents.map((document) => {
            const overdue = isOverdue(document);
            return (
              <tr key={document.id}>
                <td><Link href={document.href}>{document.number}</Link><small>{document.description}</small></td>
                <td><strong>{document.partyName}</strong><small>{document.workTitle ?? "Gasto general / sin obra"}</small></td>
                <td>{formatDate(document.issueDate)}</td><td>{document.dueDate ? formatDate(document.dueDate) : "Sin vencimiento"}</td>
                <MoneyCell value={document.total} /><MoneyCell value={document.paid} /><MoneyCell value={document.pending} />
                <td><Status tone={document.pending <= 0 ? "active" : overdue ? "risk" : "attention"}>{document.pending <= 0 ? "Liquidado" : overdue ? "Vencido" : document.paid > 0 ? "Parcial" : "Pendiente"}</Status></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

function EconomicRows({ documents }: { documents: EconomicDocument[] }) {
  return (
    <div className={styles.economicRows}>
      {documents.map((document) => (
        <Link href={document.href} key={document.id}>
          <span><strong>{document.number} · {document.partyName}</strong><small>{document.direction === "entrada" ? "Entrada prevista" : "Salida prevista"} · {document.dueDate ? formatDate(document.dueDate) : "sin vencimiento"}</small></span>
          <span><Status tone={document.direction === "entrada" ? "active" : "attention"}>{document.direction === "entrada" ? "Cobro" : "Pago"}</Status><b>{formatCurrency(document.pending)}</b></span>
        </Link>
      ))}
    </div>
  );
}

function Concentration({ title, rows, empty }: { title: string; rows: EconomicConcentration[]; empty: string }) {
  return (
    <Panel id={title.replaceAll(" ", "-").toLowerCase()} title={title} description="Volumen pendiente documentado; no es una puntuación de riesgo.">
      {rows.length ? (
        <div className={styles.concentrationList}>
          {rows.slice(0, 6).map((row) => <Link href={row.href} key={row.id}><span><strong>{row.label}</strong><small>{row.documentCount} documentos · vencido {formatCurrency(row.overdue)}</small></span><b>{formatCurrency(row.pending)}</b></Link>)}
        </div>
      ) : <CompactEmpty>{empty}</CompactEmpty>}
    </Panel>
  );
}

function Panel({ id, title, description, action, className, children }: { id: string; title: string; description: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`${styles.panel}${className ? ` ${className}` : ""}`} aria-labelledby={id}>
      <div className={styles.panelHeader}><div><h2 id={id}>{title}</h2><p>{description}</p></div>{action ? <div className={styles.panelAction}>{action}</div> : null}</div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function TreasuryKpi({ icon: Icon, label, value, detail, href, tone }: { icon: typeof Banknote; label: string; value: string; detail: string; href?: string; tone: "green" | "blue" | "orange" | "red" | "violet" }) {
  const content = <><span className={styles.kpiLabel}><i data-tone={tone}><Icon size={15} aria-hidden="true" /></i>{label}</span><strong>{value}</strong><small>{detail}</small></>;
  return href ? <Link className={styles.kpi} href={href}>{content}</Link> : <article className={styles.kpi}>{content}</article>;
}

function MiniMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  return <div className={styles.miniMetric} data-tone={tone}><span>{label}</span><strong>{value}</strong></div>;
}

function CompactEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.compactEmpty}>{children}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span>{label}</span>{children}</label>;
}

function MoneyCell({ value }: { value: number }) {
  return <td className={styles.numeric}>{formatCurrency(value)}</td>;
}

function OptionalMoneyCell({ value }: { value: number | null }) {
  return <td className={styles.numeric}>{value === null ? "Datos insuficientes" : formatCurrency(value)}</td>;
}

function summarizeProfitability(rows: EconomicProfitabilityRow[]) {
  const comparable = rows.filter((row) => row.hasEnoughData && row.profit !== null);
  const invoiced = comparable.reduce((total, row) => total + row.invoiced, 0);
  const profit = comparable.reduce((total, row) => total + (row.profit ?? 0), 0);
  return {
    count: comparable.length,
    profit,
    margin: invoiced > 0 ? profit / invoiced * 100 : null,
    negative: comparable.filter((row) => (row.margin ?? 0) < 0).length,
    rows: comparable,
  };
}

function nextDocuments(forecast: EconomicForecast) {
  return [...forecast.overdue, ...forecast.future]
    .filter((document) => document.dueDate)
    .sort((left, right) => left.dueDate!.getTime() - right.dueDate!.getTime());
}

function isOverdue(document: EconomicDocument) {
  if (!document.dueDate || document.pending <= 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return document.dueDate < today;
}

function dueLabel(document: EconomicDocument) {
  if (!document.dueDate) return "Sin fecha";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(document.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `Vencido hace ${Math.abs(days)} d`;
  if (days === 0) return "Hoy";
  return `En ${days} d`;
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date).replace(".", "").toUpperCase();
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date).replace(".", "");
}

function formatCompactCurrency(value: number) {
  return `${new Intl.NumberFormat("es-ES", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)} €`;
}

function periodLabel(period: EconomicControlData["period"]) {
  return period === "7d" ? "7 días" : period === "90d" ? "90 días" : "30 días";
}

function economicExportHref(data: EconomicControlData) {
  const params = new URLSearchParams({
    tipo: "forecast",
    horizonte: data.period,
    escenario: "base",
  });
  if (data.filters.clientId) params.set("cliente", data.filters.clientId);
  if (data.filters.workId) params.set("obra", data.filters.workId);
  if (data.filters.status) params.set("estado", data.filters.status);
  return `/tesoreria/export?${params.toString()}`;
}

function economicHref(
  data: EconomicControlData,
  changes: { vista?: EconomicArea; periodo?: string; cliente?: string | null; obra?: string | null; estado?: string | null },
) {
  const params = new URLSearchParams({ vista: changes.vista ?? data.area, periodo: changes.periodo ?? data.period });
  const client = changes.cliente === undefined ? data.filters.clientId : changes.cliente;
  const work = changes.obra === undefined ? data.filters.workId : changes.obra;
  const status = changes.estado === undefined ? data.filters.status : changes.estado;
  if (client) params.set("cliente", client);
  if (work) params.set("obra", work);
  if (status) params.set("estado", status);
  return `/tesoreria?${params.toString()}`;
}
