import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, BriefcaseBusiness, CalendarDays, Landmark, ReceiptText, TrendingUp } from "lucide-react";
import { EmptyState, Metric, PageHeader, ProductPage, ResponsiveTable, Status, Surface } from "@/components/ui-primitives";
import type { EconomicArea, EconomicConcentration, EconomicControlData, EconomicDocument, EconomicDueGroup, EconomicForecast, EconomicProfitabilityRow } from "@/lib/economic-control/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { TreasuryRegistration } from "@/components/treasury-registration";
import type { BusinessRecommendation } from "@/lib/business-recommendations";

const AREAS: Array<{ id: EconomicArea; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "cobros", label: "Cobros" },
  { id: "pagos", label: "Pagos" },
  { id: "prevision", label: "Previsión" },
  { id: "rentabilidad", label: "Rentabilidad" }
];

export function EconomicControlCenter({ data, recommendations = [] }: { data: EconomicControlData; recommendations?: BusinessRecommendation[] }) {
  return (
    <ProductPage layout="analytical">
      <PageHeader
        eyebrow="Control económico"
        title="Tesorería"
        description="Caja registrada, cobros, pagos, vencimientos y rentabilidad con acceso al documento que origina cada cifra."
        action={<Link href="/gestion?tipo=factura&returnTo=/tesoreria" className="primary-button">Nueva factura</Link>}
        secondaryActions={<Link href="/facturas-proveedor?nuevo=1#factura" className="secondary-button">Registrar factura recibida</Link>}
      />

      <nav aria-label="Áreas de control económico" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {AREAS.map((area) => <Link key={area.id} href={economicHref(data, { vista: area.id })} aria-current={data.area === area.id ? "page" : undefined} className={`min-h-11 shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${data.area === area.id ? "border-brand text-brand-strong" : "border-transparent text-content-secondary hover:text-content"}`}>{area.label}</Link>)}
      </nav>

      <EconomicFilters data={data} />

      {data.area === "resumen" ? <SummaryArea data={data} recommendations={recommendations} /> : null}
      {data.area === "cobros" ? <DocumentsArea direction="entrada" data={data} /> : null}
      {data.area === "pagos" ? <DocumentsArea direction="salida" data={data} /> : null}
      {data.area === "prevision" ? <ForecastArea forecast={data.forecast} /> : null}
      {data.area === "rentabilidad" ? <ProfitabilityArea rows={data.profitability} /> : null}
    </ProductPage>
  );
}

function EconomicFilters({ data }: { data: EconomicControlData }) {
  return (
    <Surface variant="secondary" className="mb-8 p-3 sm:p-4">
      <form action="/tesoreria" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <input type="hidden" name="vista" value={data.area} />
        <Field label="Periodo">
          <select className="field" name="periodo" defaultValue={data.period}><option value="7d">7 días</option><option value="30d">30 días</option><option value="90d">90 días</option></select>
        </Field>
        <Field label="Cliente">
          <select className="field" name="cliente" defaultValue={data.filters.clientId ?? "todos"}><option value="todos">Todos</option>{data.filters.clients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </Field>
        <Field label="Obra">
          <select className="field" name="obra" defaultValue={data.filters.workId ?? "todos"}><option value="todos">Todas</option>{data.filters.works.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </Field>
        <Field label="Estado">
          <select className="field" name="estado" defaultValue={data.filters.status ?? "todos"}><option value="todos">Todos</option><option value="pendiente">Con saldo</option><option value="vencido">Vencido</option><option value="parcial">Pago parcial</option><option value="liquidado">Liquidado</option></select>
        </Field>
        <button className="primary-button self-end" type="submit">Aplicar</button>
      </form>
      <p className="type-meta mt-3">Previsión basada en vencimientos registrados. No representa movimientos bancarios confirmados.</p>
    </Surface>
  );
}

function SummaryArea({ data, recommendations }: { data: EconomicControlData; recommendations: BusinessRecommendation[] }) {
  const measurableWorks = data.profitability.filter((row) => row.hasEnoughData && row.profit !== null);
  const totalInvoiced = measurableWorks.reduce((total, row) => total + row.invoiced, 0);
  const totalProfit = measurableWorks.reduce((total, row) => total + (row.profit ?? 0), 0);
  const aggregateMargin = totalInvoiced > 0 ? totalProfit / totalInvoiced * 100 : null;
  return (
    <div className="grid gap-10">
      <section aria-labelledby="economic-pending" className="section-shell">
        <SectionHeading id="economic-pending" title="Pendiente y vencido" description="Cuatro cifras principales calculadas desde documentos y pagos reales." />
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Metric href={economicHref(data, { vista: "cobros", estado: "pendiente" })} label="Pendiente de cobro" value={formatCurrency(data.receivableSummary.pending)} detail={`${data.receivableSummary.openCount} facturas con saldo`} />
          <Metric href={economicHref(data, { vista: "cobros", estado: "vencido" })} label="Cobro vencido" value={formatCurrency(data.receivableSummary.overdue)} detail={`${data.receivableSummary.overdueCount} documentos vencidos`} />
          <Metric href={economicHref(data, { vista: "pagos", estado: "pendiente" })} label="Pendiente de pago" value={formatCurrency(data.payableSummary.pending)} detail={`${data.payableSummary.openCount} obligaciones abiertas`} />
          <Metric href={economicHref(data, { vista: "pagos", estado: "vencido" })} label="Pago vencido" value={formatCurrency(data.payableSummary.overdue)} detail={`${data.payableSummary.overdueCount} documentos vencidos`} />
        </div>
      </section>

      <div className="grid gap-10 xl:grid-cols-2">
        <section aria-labelledby="economic-position" className="section-shell">
          <SectionHeading id="economic-position" title="Caja y posición actual" description="Solo cuentas y movimientos registrados; no se inventan saldos bancarios." />
          {data.registeredBalance === null ? <EmptyState icon={Landmark} title="No hay una posición bancaria registrada" description="La previsión muestra únicamente documentos pendientes. Crea o actualiza una cuenta solo mediante el flujo existente de Tesorería." /> : <>
            <p className="type-meta">Saldo total registrado</p><p className="tabular mt-1 text-3xl font-semibold text-content">{formatCurrency(data.registeredBalance)}</p>
            <div className="mt-4 divide-y divide-border">{data.accounts.map((account) => <div key={account.id} className="flex min-h-14 items-center justify-between gap-3 py-3"><span><span className="type-object-title block text-content">{account.name}</span><span className="type-meta">{account.type}{account.updatedAt ? ` · actualizado ${formatDate(account.updatedAt)}` : " · saldo calculado"}</span></span><span className="tabular font-semibold text-content">{formatCurrency(account.balance)}</span></div>)}</div>
            {data.recentMovements.length ? <div className="mt-5 border-t border-border pt-4"><h3 className="type-object-title text-content">Movimientos recientes</h3><div className="mt-2 divide-y divide-border">{data.recentMovements.slice(0, 5).map((movement) => <div key={movement.id} className="flex min-h-12 items-center justify-between gap-3 py-2"><span><span className="block text-sm font-medium text-content">{movement.description}</span><span className="type-meta">{formatDate(movement.date)} · {movement.accountName}</span></span><span className="tabular font-semibold text-content">{movement.direction === "outflow" ? "−" : "+"}{formatCurrency(movement.amount)}</span></div>)}</div></div> : null}
          </>}
        </section>

        <section aria-labelledby="economic-next" className="section-shell">
          <SectionHeading id="economic-next" title={`Próximos ${periodLabel(data.period)}`} description="Entradas y salidas por fecha de vencimiento real." action={<Link href={economicHref(data, { vista: "prevision" })} className="secondary-button">Abrir previsión</Link>} />
          <div className="grid grid-cols-2 gap-3"><CompactMetric icon={ArrowUpRight} label="Entradas previstas" value={formatCurrency(data.forecast.inflows)} /><CompactMetric icon={ArrowDownRight} label="Salidas previstas" value={formatCurrency(data.forecast.outflows)} /></div>
          <p className="type-secondary mt-4">Flujo neto documentado: <strong className="tabular text-content">{formatCurrency(data.forecast.net)}</strong>{data.forecast.closingBalance === null ? ". Sin saldo inicial fiable no se proyecta posición final." : ` · saldo final proyectado ${formatCurrency(data.forecast.closingBalance)}.`}</p>
        </section>
      </div>

      <TreasuryRegistration accounts={data.accounts} returnTo={economicHref(data, {})} />

      <section aria-labelledby="economic-work-result" className="section-shell">
        <SectionHeading id="economic-work-result" title="Resultado de obras" description="Resultado calculado con facturación y costes existentes; no representa avance físico." action={<Link href={economicHref(data, { vista: "rentabilidad" })} className="secondary-button">Ver rentabilidad</Link>} />
        {measurableWorks.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><CompactMetric icon={TrendingUp} label="Beneficio agregado" value={formatCurrency(totalProfit)} /><CompactMetric icon={Banknote} label="Margen agregado" value={aggregateMargin === null ? "Datos insuficientes" : `${aggregateMargin.toFixed(1)} %`} /><CompactMetric icon={BriefcaseBusiness} label="Obras rentables" value={String(measurableWorks.filter((row) => (row.profit ?? 0) > 0).length)} /><CompactMetric icon={AlertTriangle} label="Margen negativo" value={String(measurableWorks.filter((row) => (row.margin ?? 0) < 0).length)} /><CompactMetric icon={CalendarDays} label="Con desviación" value={String(measurableWorks.filter((row) => (row.deviation ?? 0) > 0).length)} /></div> : <p className="type-secondary">Datos insuficientes para agregar beneficio y margen.</p>}
      </section>

      <section aria-labelledby="economic-attention" className="section-shell">
        <SectionHeading id="economic-attention" title="Requiere atención" description="Señales deterministas de PD-4 sobre cobros, compras y economía de obra; no se recalculan reglas distintas en la interfaz." />
        {data.attentionSignals.length ? <div className="divide-y divide-border">{data.attentionSignals.map((signal) => <Link key={signal.id} href={signal.href} className="grid min-h-20 gap-2 py-3 hover:bg-subtle sm:grid-cols-[1fr_auto] sm:items-center"><span><span className="type-object-title block text-content">{signal.title}</span><span className="type-secondary mt-1 block">{signal.explanation}</span><span className="type-meta mt-1 block">Siguiente paso: {signal.nextStep}</span></span><span className="flex items-center gap-3"><Status tone={signal.level === "urgente" ? "risk" : signal.level === "atencion" ? "attention" : "neutral"}>{signal.level}</Status>{signal.amount !== null ? <span className="tabular font-semibold text-content">{formatCurrency(signal.amount)}</span> : null}</span></Link>)}</div> : <EmptyState icon={AlertTriangle} title="No hay señales económicas que requieran atención" description="Los próximos vencimientos permanecen disponibles en Previsión." />}
      </section>

      <section aria-labelledby="economic-recommendations" className="section-shell">
        <SectionHeading id="economic-recommendations" title="Recomendaciones de tesorería" description="Acciones existentes derivadas de señales reales; su seguimiento permanece en el centro de recomendaciones." action={<Link href="/recomendaciones?origen=tesoreria" className="secondary-button">Ver centro</Link>} />
        {recommendations.length ? <div className="divide-y divide-border">{recommendations.map((recommendation) => <Link key={recommendation.fingerprint} href="/recomendaciones?origen=tesoreria" className="grid min-h-20 gap-2 py-3 hover:bg-subtle sm:grid-cols-[1fr_auto] sm:items-center"><span><span className="type-object-title block text-content">{recommendation.title}</span><span className="type-secondary mt-1 block">{recommendation.summary}</span></span><Status tone={recommendation.priority >= 80 ? "risk" : recommendation.priority >= 60 ? "attention" : "neutral"}>Prioridad {recommendation.priority}</Status></Link>)}</div> : <EmptyState icon={AlertTriangle} title="Sin recomendaciones de tesorería" description="No hay acciones de caja prioritarias derivadas de señales reales." />}
      </section>

      <div className="grid gap-10 xl:grid-cols-2">
        <Concentration title="Mayor saldo pendiente por cliente" rows={data.clientConcentration} empty="No hay saldos de clientes pendientes." />
        <Concentration title="Mayor saldo pendiente por proveedor" rows={data.supplierConcentration} empty="No hay saldos de proveedores pendientes." />
      </div>
    </div>
  );
}

function DocumentsArea({ direction, data }: { direction: "entrada" | "salida"; data: EconomicControlData }) {
  const documents = direction === "entrada" ? data.receivables : data.payables;
  const summary = direction === "entrada" ? data.receivableSummary : data.payableSummary;
  const isReceivable = direction === "entrada";
  const recentMovements = data.recentMovements.filter((movement) => movement.direction === (isReceivable ? "inflow" : "outflow")).slice(0, 5);
  return (
    <section aria-labelledby={`economic-${direction}`} className="section-shell">
      <SectionHeading id={`economic-${direction}`} title={isReceivable ? "Cobros" : "Pagos"} description={isReceivable ? "Facturas emitidas, pagos parciales y saldo pendiente real." : "Facturas recibidas y gastos independientes sin duplicar la salida enlazada."} action={<Link href={isReceivable ? "/dinero?filtro=pendientes" : "/facturas-proveedor"} className="secondary-button">Abrir módulo operativo</Link>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><CompactMetric icon={ReceiptText} label={isReceivable ? "Facturado" : "Recibido"} value={formatCurrency(summary.documented)} /><CompactMetric icon={Banknote} label={isReceivable ? "Cobrado" : "Pagado"} value={formatCurrency(summary.settled)} /><CompactMetric icon={CalendarDays} label="Pendiente" value={formatCurrency(summary.pending)} /><CompactMetric icon={AlertTriangle} label="Vencido" value={formatCurrency(summary.overdue)} /></div>
      {documents.length ? <DocumentTable documents={documents} /> : <EmptyState icon={ReceiptText} title={isReceivable ? "Todavía no hay facturas emitidas para analizar cobros" : "Todavía no hay facturas recibidas para analizar pagos"} description="Los documentos aparecerán aquí cuando se registren en su módulo de origen." />}
      {recentMovements.length ? <div className="mt-6 border-t border-border pt-4"><h3 className="type-object-title text-content">{isReceivable ? "Cobros" : "Pagos"} recientes registrados</h3><div className="mt-2 divide-y divide-border">{recentMovements.map((movement) => <div key={movement.id} className="flex min-h-14 items-center justify-between gap-3 py-3"><span><span className="font-medium text-content">{movement.description}</span><span className="type-meta mt-1 block">{formatDate(movement.date)} · {movement.accountName}</span></span><span className="tabular font-semibold text-content">{formatCurrency(movement.amount)}</span></div>)}</div></div> : null}
    </section>
  );
}

function ForecastArea({ forecast }: { forecast: EconomicForecast }) {
  return <div className="grid gap-10"><section aria-labelledby="forecast-summary" className="section-shell"><SectionHeading id="forecast-summary" title="Previsión por vencimientos" description="Entradas y salidas futuras derivadas exclusivamente de documentos pendientes con fecha registrada." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><CompactMetric icon={ArrowUpRight} label="Entradas previstas" value={formatCurrency(forecast.inflows)} /><CompactMetric icon={ArrowDownRight} label="Salidas previstas" value={formatCurrency(forecast.outflows)} /><CompactMetric icon={TrendingUp} label="Flujo neto" value={formatCurrency(forecast.net)} /><CompactMetric icon={Landmark} label="Saldo proyectado" value={forecast.closingBalance === null ? "Sin saldo inicial" : formatCurrency(forecast.closingBalance)} /></div><ForecastChart forecast={forecast} /></section><DueTimeline forecast={forecast} />{forecast.unscheduled.length ? <section aria-labelledby="forecast-unscheduled" className="section-shell"><SectionHeading id="forecast-unscheduled" title="Sin vencimiento definido" description="Estos documentos quedan fuera de la proyección hasta disponer de una fecha real." /><EconomicRows documents={forecast.unscheduled} /></section> : null}</div>;
}

function ForecastChart({ forecast }: { forecast: EconomicForecast }) {
  if (!forecast.points.length) return <EmptyState icon={TrendingUp} title="No existen documentos pendientes con vencimiento registrado" description="No se dibuja un gráfico sin fechas suficientes." />;
  const max = Math.max(1, ...forecast.points.flatMap((point) => [point.inflows, point.outflows]));
  return <div className="mt-6 rounded-xl bg-subtle p-4"><div role="img" aria-label="Entradas y salidas previstas por vencimiento" className="grid gap-3">{forecast.points.slice(0, 18).map((point) => <div key={point.date.toISOString()} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 text-sm"><span className="type-meta">{formatDate(point.date)}</span><span className="grid gap-1"><span className="h-2 rounded-full bg-success" style={{ width: `${Math.max(2, point.inflows / max * 100)}%` }} aria-hidden="true" /><span className="h-2 rounded-full bg-danger" style={{ width: `${Math.max(2, point.outflows / max * 100)}%` }} aria-hidden="true" /><span className="sr-only">Entrada {formatCurrency(point.inflows)}; salida {formatCurrency(point.outflows)}; neto {formatCurrency(point.net)}</span></span></div>)}</div><p className="type-meta mt-4">Verde: entrada prevista. Rojo: salida prevista. El detalle textual completo aparece en la línea temporal.</p></div>;
}

function DueTimeline({ forecast }: { forecast: EconomicForecast }) {
  const groups: Array<{ id: EconomicDueGroup; label: string }> = [{ id: "vencido", label: "Vencido" }, { id: "hoy", label: "Hoy" }, { id: "proximos_7_dias", label: "Próximos 7 días" }, { id: "proximos_30_dias", label: "Próximos 30 días" }, { id: "posterior", label: "Posterior" }];
  return <section aria-labelledby="cash-timeline" className="section-shell"><SectionHeading id="cash-timeline" title="Calendario de caja" description="Agrupación temporal de cobros y pagos documentados." /><div className="grid gap-6">{groups.map((group) => { const inflows = forecast.groups[group.id].filter((item) => item.direction === "entrada"); const outflows = forecast.groups[group.id].filter((item) => item.direction === "salida"); return <div key={group.id}><h3 className="type-object-title text-content">{group.label}</h3><div className="mt-2 grid gap-4 lg:grid-cols-2"><div><p className="type-meta">Cobros</p>{inflows.length ? <EconomicRows documents={inflows} /> : <p className="type-secondary mt-2">Sin cobros.</p>}</div><div><p className="type-meta">Pagos</p>{outflows.length ? <EconomicRows documents={outflows} /> : <p className="type-secondary mt-2">Sin pagos.</p>}</div></div></div>; })}</div></section>;
}

function ProfitabilityArea({ rows }: { rows: EconomicProfitabilityRow[] }) {
  return (
    <section aria-labelledby="profitability" className="section-shell">
      <SectionHeading id="profitability" title="Rentabilidad por obra" description="Beneficio, margen, coste real y desviación calculados con las fórmulas existentes. No representan avance físico." />
      {rows.length ? <ResponsiveTable label="Rentabilidad por obra"><table className="min-w-full divide-y divide-border text-sm">
        <thead><tr className="text-left type-meta"><th scope="col" className="px-3 py-3">Obra</th><th scope="col" className="px-3 py-3 text-right">Beneficio</th><th scope="col" className="px-3 py-3 text-right">Margen</th><th scope="col" className="px-3 py-3 text-right">Coste real</th><th scope="col" className="px-3 py-3 text-right">Facturado</th><th scope="col" className="px-3 py-3 text-right">Desviación de coste</th><th scope="col" className="px-3 py-3 text-right">Pendiente</th></tr></thead>
        <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.workId}>
          <td className="px-3 py-4"><Link href={row.href} className="font-semibold text-content hover:underline">{row.workTitle}</Link><p className="type-meta mt-1">{row.clientName} · {statusLabel(row.status)}</p><p className="type-meta mt-1">Presupuestado {formatCurrency(row.budgeted)} · Cobrado {formatCurrency(row.collected)}</p><p className="type-meta mt-1">Materiales {formatCurrency(row.materialCost)} · Subcontratas {formatCurrency(row.subcontractorCost)} · Generales {formatCurrency(row.generalCost)}</p></td>
          <OptionalMoneyCell value={row.profit} />
          <td className="px-3 py-4 text-right tabular font-semibold">{row.margin === null ? "Datos insuficientes" : `${row.margin.toFixed(1)} %`}</td>
          <MoneyCell value={row.realCost} />
          <MoneyCell value={row.invoiced} />
          <td className="px-3 py-4 text-right tabular"><span className="font-semibold text-content">{row.deviation === null ? "Datos insuficientes" : formatCurrency(row.deviation)}</span>{row.deviation !== null ? <span className="type-meta mt-1 block">Referencia {formatCurrency(row.forecastCost)} · actual {formatCurrency(row.realCost)} · {row.forecastCost > 0 ? `${(row.deviation / row.forecastCost * 100).toFixed(1)} %` : "sin porcentaje"}</span> : null}</td>
          <MoneyCell value={row.pending} />
        </tr>)}</tbody>
      </table></ResponsiveTable> : <EmptyState icon={BriefcaseBusiness} title="Todavía no hay costes suficientes para evaluar la rentabilidad" description="No se muestran ceros como si fueran resultados reales." />}
    </section>
  );
}

function DocumentTable({ documents }: { documents: EconomicDocument[] }) {
  return <ResponsiveTable label="Documentos económicos"><table className="min-w-full divide-y divide-border text-sm"><thead><tr className="text-left type-meta"><th scope="col" className="px-3 py-3">Documento</th><th scope="col" className="px-3 py-3">Entidad y obra</th><th scope="col" className="px-3 py-3">Emisión</th><th scope="col" className="px-3 py-3">Vencimiento</th><th scope="col" className="px-3 py-3 text-right">Total</th><th scope="col" className="px-3 py-3 text-right">Liquidado</th><th scope="col" className="px-3 py-3 text-right">Saldo</th><th scope="col" className="px-3 py-3">Estado</th></tr></thead><tbody className="divide-y divide-border">{documents.map((document) => { const overdue = isOverdue(document); return <tr key={document.id}><td className="px-3 py-4"><Link href={document.href} className="font-semibold text-content hover:underline">{document.number}</Link><p className="type-meta mt-1 max-w-xs">{document.description}</p></td><td className="px-3 py-4"><span className="font-medium text-content">{document.partyName}</span><p className="type-meta mt-1">{document.workTitle ?? "Gasto general / sin obra"}</p></td><td className="px-3 py-4">{formatDate(document.issueDate)}</td><td className="px-3 py-4">{document.dueDate ? formatDate(document.dueDate) : "Sin vencimiento"}</td><MoneyCell value={document.total} /><MoneyCell value={document.paid} /><MoneyCell value={document.pending} /><td className="px-3 py-4"><Status tone={document.pending <= 0 ? "active" : overdue ? "risk" : "attention"}>{document.pending <= 0 ? "Liquidado" : overdue ? "Vencido" : document.paid > 0 ? "Parcial" : "Pendiente"}</Status></td></tr>; })}</tbody></table></ResponsiveTable>;
}

function isOverdue(document: EconomicDocument) {
  if (!document.dueDate || document.pending <= 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return document.dueDate < today;
}

function EconomicRows({ documents }: { documents: EconomicDocument[] }) { return <div className="mt-2 divide-y divide-border">{documents.map((document) => <Link key={document.id} href={document.href} className="grid min-h-16 gap-2 py-3 hover:bg-subtle sm:grid-cols-[1fr_auto] sm:items-center"><span><span className="type-object-title block text-content">{document.number} · {document.partyName}</span><span className="type-meta mt-1 block">{document.direction === "entrada" ? "Entrada prevista" : "Salida prevista"} · {document.dueDate ? formatDate(document.dueDate) : "sin vencimiento"}</span></span><span className="flex items-center justify-between gap-3 sm:justify-end"><Status tone={document.direction === "entrada" ? "active" : "attention"}>{document.direction === "entrada" ? "Cobro" : "Pago"}</Status><span className="tabular font-semibold text-content">{formatCurrency(document.pending)}</span></span></Link>)}</div>; }
function Concentration({ title, rows, empty }: { title: string; rows: EconomicConcentration[]; empty: string }) { return <section className="section-shell"><SectionHeading id={title.replaceAll(" ", "-")} title={title} description="Descripción de volumen; no es una puntuación de riesgo." />{rows.length ? <div className="divide-y divide-border">{rows.map((row) => <Link key={row.id} href={row.href} className="flex min-h-16 items-center justify-between gap-3 py-3 hover:bg-subtle"><span><span className="type-object-title block text-content">{row.label}</span><span className="type-meta mt-1 block">{row.documentCount} documentos · vencido {formatCurrency(row.overdue)}</span></span><span className="tabular font-semibold text-content">{formatCurrency(row.pending)}</span></Link>)}</div> : <p className="type-secondary">{empty}</p>}</section>; }
function SectionHeading({ id, title, description, action }: { id: string; title: string; description: string; action?: ReactNode }) { return <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 id={id} className="type-section-title text-content">{title}</h2><p className="type-secondary mt-1 max-w-3xl">{description}</p></div>{action ? <div className="shrink-0">{action}</div> : null}</div>; }
function CompactMetric({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) { return <div className="rounded-xl bg-subtle p-4"><div className="flex items-center gap-2 type-meta"><Icon size={17} aria-hidden="true" />{label}</div><p className="tabular mt-2 text-xl font-semibold text-content">{value}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="label mb-1 block">{label}</span>{children}</label>; }
function MoneyCell({ value }: { value: number }) { return <td className="px-3 py-4 text-right tabular font-medium text-content">{formatCurrency(value)}</td>; }
function OptionalMoneyCell({ value }: { value: number | null }) { return <td className="px-3 py-4 text-right tabular font-semibold text-content">{value === null ? "Datos insuficientes" : formatCurrency(value)}</td>; }
function periodLabel(period: EconomicControlData["period"]) { return period === "7d" ? "7 días" : period === "90d" ? "90 días" : "30 días"; }
function statusLabel(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function economicHref(data: EconomicControlData, changes: { vista?: EconomicArea; periodo?: string; cliente?: string | null; obra?: string | null; estado?: string | null }) { const params = new URLSearchParams({ vista: changes.vista ?? data.area, periodo: changes.periodo ?? data.period }); const client = changes.cliente === undefined ? data.filters.clientId : changes.cliente; const work = changes.obra === undefined ? data.filters.workId : changes.obra; const status = changes.estado === undefined ? data.filters.status : changes.estado; if (client) params.set("cliente", client); if (work) params.set("obra", work); if (status) params.set("estado", status); return `/tesoreria?${params.toString()}`; }
