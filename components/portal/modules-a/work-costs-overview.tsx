"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  LineChart,
  ListTree,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";

export type WorkCostSummary = {
  actualCost: number | null;
  budgetTotal: number | null;
  committedCost: number | null;
  estimatedFinalCost: number | null;
  projectedMarginAmount?: number | null;
  projectedMarginPercent?: number | null;
  targetMarginPercent?: number | null;
  reviewedAt?: string | null;
  versionLabel?: string | null;
};

export type WorkCostLine = {
  id: string;
  code?: string | null;
  name: string;
  budgetAmount: number | null;
  actualAmount: number | null;
  committedAmount: number | null;
  estimatedFinalAmount: number | null;
};

export type WorkCostExpense = {
  id: string;
  date: string;
  concept: string;
  amount: number;
  categoryId?: string | null;
  categoryName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  status?: string | null;
  documentNumber?: string | null;
};

export type WorkCostSupplier = {
  id: string;
  name: string;
  actualAmount?: number | null;
};

export type WorkCostSeriesPoint = {
  date: string;
  plannedCost?: number | null;
  actualCost?: number | null;
  estimatedFinalCost?: number | null;
};

export type WorkCostsOverviewProps = {
  workId: string;
  currency?: string;
  summary: WorkCostSummary;
  lines: WorkCostLine[];
  expenses: WorkCostExpense[];
  suppliers: WorkCostSupplier[];
  series?: WorkCostSeriesPoint[];
};

type LineState = "on_budget" | "over_budget" | "without_baseline";
type ChartMode = "amount" | "percent";
type SortMode = "deviation" | "actual" | "name";

const chartWidth = 720;
const chartHeight = 250;
const chartPadding = { left: 58, right: 20, top: 22, bottom: 38 };

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function safeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = safeDate(value);
  return date
    ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : "Fecha inválida";
}

function lineDeviation(line: WorkCostLine) {
  if (!finite(line.budgetAmount) || !finite(line.estimatedFinalAmount)) return null;
  return line.estimatedFinalAmount - line.budgetAmount;
}

function lineState(line: WorkCostLine): LineState {
  const deviation = lineDeviation(line);
  if (deviation == null || !line.budgetAmount) return "without_baseline";
  if (deviation > 0) return "over_budget";
  return "on_budget";
}

function lineStateLabel(state: LineState) {
  if (state === "over_budget") return "Sobrecoste";
  if (state === "on_budget") return "En presupuesto";
  return "Sin base";
}

function lineStateClasses(state: LineState) {
  if (state === "over_budget") return "bg-danger/10 text-danger";
  if (state === "on_budget") return "bg-success/10 text-success";
  return "bg-subtle text-content-secondary";
}

function buildExpenseSeries(expenses: WorkCostExpense[]): WorkCostSeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const expense of expenses) {
    const date = safeDate(expense.date);
    if (!date || !Number.isFinite(expense.amount)) continue;
    const key = date.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + expense.amount);
  }
  let cumulative = 0;
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, amount]) => {
      cumulative += amount;
      return { date, actualCost: cumulative };
    });
}

function mergeSeries(series: WorkCostSeriesPoint[], expenses: WorkCostExpense[]) {
  if (series.length) {
    return [...series]
      .filter((point) => safeDate(point.date))
      .sort((left, right) => left.date.localeCompare(right.date));
  }
  return buildExpenseSeries(expenses);
}

function WorkCostMetric({ label, value, detail, footer, tone = "neutral", icon: Icon }: {
  label: string;
  value: string;
  detail: string;
  footer?: string;
  tone?: "neutral" | "success" | "danger" | "warning";
  icon: typeof WalletCards;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-content";
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3.5">
      <div className="flex min-w-0 items-center gap-2 text-content-secondary"><Icon size={15} className="shrink-0" aria-hidden="true" /><h2 className="truncate text-[10px] font-bold">{label}</h2></div>
      <strong className={`mt-2 block truncate text-xl font-black tabular-nums ${toneClass}`} title={value}>{value}</strong>
      <p className="mt-1 min-h-4 text-[9px] leading-4 text-content-secondary">{detail}</p>
      {footer ? <p className="mt-3 border-t border-border pt-2 text-[8px] text-content-tertiary">{footer}</p> : null}
    </article>
  );
}

export function WorkCostsOverview({ workId, currency = "EUR", summary, lines, expenses, suppliers, series = [] }: WorkCostsOverviewProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("amount");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | LineState>("all");
  const [sortMode, setSortMode] = useState<SortMode>("deviation");

  const money = useMemo(
    () => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }),
    [currency],
  );
  const percent = useMemo(() => new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }), []);
  const formatMoney = (value: number | null | undefined) => finite(value) ? money.format(value) : "—";
  const formatPercent = (value: number | null | undefined) => finite(value) ? percent.format(value / 100) : "—";

  const deviation = finite(summary.budgetTotal) && finite(summary.estimatedFinalCost)
    ? summary.estimatedFinalCost - summary.budgetTotal
    : null;
  const budgetConsumption = finite(summary.actualCost) && finite(summary.budgetTotal) && summary.budgetTotal !== 0
    ? (summary.actualCost / summary.budgetTotal) * 100
    : null;

  const filteredLines = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return lines
      .filter((line) => (!normalized || `${line.code ?? ""} ${line.name}`.toLowerCase().includes(normalized)) && (stateFilter === "all" || lineState(line) === stateFilter))
      .sort((left, right) => {
        if (sortMode === "name") return left.name.localeCompare(right.name, "es");
        if (sortMode === "actual") return (right.actualAmount ?? -Infinity) - (left.actualAmount ?? -Infinity);
        return Math.abs(lineDeviation(right) ?? -Infinity) - Math.abs(lineDeviation(left) ?? -Infinity);
      });
  }, [lines, query, sortMode, stateFilter]);

  const supplierRows = useMemo(() => {
    const expenseTotals = new Map<string, number>();
    for (const expense of expenses) {
      if (!expense.supplierId || !Number.isFinite(expense.amount)) continue;
      expenseTotals.set(expense.supplierId, (expenseTotals.get(expense.supplierId) ?? 0) + expense.amount);
    }
    return suppliers
      .map((supplier) => ({ ...supplier, displayedAmount: finite(supplier.actualAmount) ? supplier.actualAmount : expenseTotals.get(supplier.id) ?? null }))
      .filter((supplier) => finite(supplier.displayedAmount))
      .sort((left, right) => (right.displayedAmount ?? 0) - (left.displayedAmount ?? 0));
  }, [expenses, suppliers]);

  const chartSeries = useMemo(() => mergeSeries(series, expenses), [expenses, series]);
  const marginReady = finite(summary.projectedMarginAmount) || finite(summary.projectedMarginPercent);
  const overBudgetLines = lines.filter((line) => lineState(line) === "over_budget");
  const actualFromVisibleExpenses = expenses.reduce((total, expense) => total + (Number.isFinite(expense.amount) ? expense.amount : 0), 0);

  return (
    <div className="grid min-w-0 gap-3">
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Indicadores reales de costes de la obra">
        <WorkCostMetric
          icon={WalletCards}
          label="Coste acumulado"
          value={formatMoney(summary.actualCost)}
          detail={budgetConsumption == null ? "Sin porcentaje calculable" : `${formatPercent(budgetConsumption)} del presupuesto`}
          footer={summary.reviewedAt ? `Revisado ${formatDate(summary.reviewedAt)}` : "Sin fecha de revisión"}
        />
        <WorkCostMetric
          icon={CircleDollarSign}
          label="Presupuesto total"
          value={formatMoney(summary.budgetTotal)}
          detail="Importe autorizado recibido"
          footer={summary.versionLabel ?? "Sin versión informada"}
        />
        <WorkCostMetric
          icon={marginReady ? TrendingUp : LineChart}
          label="Margen proyectado"
          value={finite(summary.projectedMarginPercent) ? formatPercent(summary.projectedMarginPercent) : formatMoney(summary.projectedMarginAmount)}
          detail={finite(summary.projectedMarginAmount) && finite(summary.projectedMarginPercent) ? formatMoney(summary.projectedMarginAmount) : "No se calcula sin dato autorizado"}
          footer={finite(summary.targetMarginPercent) ? `Objetivo ${formatPercent(summary.targetMarginPercent)}` : "Sin objetivo informado"}
          tone={marginReady && finite(summary.projectedMarginPercent) && summary.projectedMarginPercent >= 0 ? "success" : "neutral"}
        />
        <WorkCostMetric
          icon={deviation != null && deviation > 0 ? AlertTriangle : CheckCircle2}
          label="Desviación EAC / presupuesto"
          value={deviation == null ? "—" : formatMoney(deviation)}
          detail={deviation == null || !summary.budgetTotal ? "Sin EAC o presupuesto comparable" : formatPercent((deviation / summary.budgetTotal) * 100)}
          footer="Calculada con importes recibidos"
          tone={deviation == null ? "neutral" : deviation > 0 ? "danger" : "success"}
        />
        <WorkCostMetric
          icon={Building2}
          label="Coste comprometido"
          value={formatMoney(summary.committedCost)}
          detail={finite(summary.committedCost) ? "Pedidos y compromisos autorizados" : "Sin autoridad persistida"}
          footer={finite(summary.committedCost) ? "Importe recibido por la vista" : "No se infiere desde el gasto real"}
          tone={finite(summary.committedCost) ? "warning" : "neutral"}
        />
      </section>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[1.08fr_.92fr]">
        <article className="min-w-0 rounded-xl border border-border bg-surface p-3">
          <header className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xs font-black text-content">Desglose de costes por partida</h2><p className="mt-1 text-[9px] text-content-secondary">Sólo importes persistidos y recibidos por la vista.</p></div>
            <Link href={`/obras/${workId}/costes/estructura`} className="inline-flex min-h-11 items-center text-[10px] font-bold text-brand-strong hover:underline">Ver estructura completa</Link>
          </header>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary"><Search size={15} aria-hidden="true" /><span className="sr-only">Buscar partida</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none" placeholder="Buscar partida…" /></label>
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><Filter size={15} aria-hidden="true" /><span className="sr-only">Filtrar estado</span><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as "all" | LineState)} className="border-0 bg-transparent text-content outline-none"><option value="all">Todos</option><option value="over_budget">Sobrecoste</option><option value="on_budget">En presupuesto</option><option value="without_baseline">Sin base</option></select></label>
            <label className="flex min-h-11 items-center rounded-lg border border-border px-3 text-[10px] text-content-secondary"><span className="sr-only">Ordenar partidas</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="border-0 bg-transparent text-content outline-none"><option value="deviation">Mayor desviación</option><option value="actual">Mayor coste</option><option value="name">Nombre</option></select></label>
          </div>
          <CostLinesTable lines={filteredLines} money={money} />
        </article>

        <article className="min-w-0 rounded-xl border border-border bg-surface p-3">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div><h2 className="text-xs font-black text-content">Evolución del coste acumulado</h2><p className="mt-1 text-[9px] text-content-secondary">Serie temporal real; no interpola puntos ausentes.</p></div>
            <div className="inline-flex min-h-11 rounded-lg border border-border bg-subtle p-1" aria-label="Unidad del gráfico">
              <button type="button" onClick={() => setChartMode("amount")} aria-pressed={chartMode === "amount"} className={`min-h-9 rounded-md px-3 text-[10px] font-bold ${chartMode === "amount" ? "bg-surface text-brand-strong shadow-sm" : "text-content-secondary"}`}>{currency}</button>
              <button type="button" disabled={!summary.budgetTotal} onClick={() => setChartMode("percent")} aria-pressed={chartMode === "percent"} className={`min-h-9 rounded-md px-3 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${chartMode === "percent" ? "bg-surface text-brand-strong shadow-sm" : "text-content-secondary"}`}>%</button>
            </div>
          </header>
          <CostEvolutionChart points={chartSeries} mode={chartMode} budgetTotal={summary.budgetTotal} currency={currency} />
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
            <ChartFigure label="Coste actual" value={formatMoney(summary.actualCost)} />
            <ChartFigure label="EAC" value={formatMoney(summary.estimatedFinalCost)} />
            <ChartFigure label="Presupuesto" value={formatMoney(summary.budgetTotal)} />
            <ChartFigure label="Registros visibles" value={formatMoney(actualFromVisibleExpenses)} />
          </div>
          <Link href={`/obras/${workId}/costes/analisis`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-[10px] font-bold text-brand-strong hover:bg-brand-soft">Ver análisis detallado</Link>
        </article>
      </section>

      <section className="grid min-w-0 gap-3 lg:grid-cols-4">
        <CostPanel title="Principales proveedores" action={<Link href={`/obras/${workId}/costes/ranking`}>Ver ranking</Link>}>
          {supplierRows.length ? <div className="grid gap-1">{supplierRows.slice(0, 6).map((supplier) => <div key={supplier.id} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border text-[9px] last:border-0"><span className="min-w-0 truncate font-semibold text-content">{supplier.name}</span><strong className="tabular-nums text-content">{formatMoney(supplier.displayedAmount)}</strong></div>)}</div> : <HonestEmpty icon={Building2} text="No hay proveedores con gasto visible en los registros recibidos." />}
        </CostPanel>

        <CostPanel title="Gastos recientes" action={<Link href={`/obras/${workId}/costes/estructura`}>Ver todos</Link>}>
          {expenses.length ? <div className="grid gap-1">{[...expenses].filter((expense) => safeDate(expense.date)).sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6).map((expense) => <div key={expense.id} className="grid min-h-10 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border text-[9px] last:border-0"><span className="text-content-secondary">{formatDate(expense.date)}</span><span className="min-w-0 truncate font-semibold text-content" title={expense.concept}>{expense.concept}</span><strong className="tabular-nums text-content">{formatMoney(expense.amount)}</strong></div>)}</div> : <HonestEmpty icon={CalendarDays} text="No hay gastos recibidos para ordenar cronológicamente." />}
        </CostPanel>

        <CostPanel title="Control de compromisos" action={<Link href={`/obras/${workId}/costes/ordenes`}>Abrir órdenes</Link>}>
          <dl className="grid gap-3 text-[10px]"><CostRow label="Comprometido" value={formatMoney(summary.committedCost)} /><CostRow label="Coste acumulado" value={formatMoney(summary.actualCost)} /><CostRow label="Estimado a fin" value={formatMoney(summary.estimatedFinalCost)} /><CostRow label="Partidas con sobrecoste" value={String(overBudgetLines.length)} tone={overBudgetLines.length ? "danger" : "success"} /></dl>
        </CostPanel>

        <CostPanel title="Margen proyectado" action={<Link href={`/obras/${workId}/costes/analisis`}>Ver detalle</Link>}>
          {marginReady ? <div><strong className="text-2xl font-black text-success">{finite(summary.projectedMarginPercent) ? formatPercent(summary.projectedMarginPercent) : formatMoney(summary.projectedMarginAmount)}</strong>{finite(summary.projectedMarginAmount) && finite(summary.projectedMarginPercent) ? <p className="mt-1 text-[10px] text-content-secondary">{formatMoney(summary.projectedMarginAmount)}</p> : null}<dl className="mt-4 grid gap-3 text-[10px]"><CostRow label="Objetivo" value={formatPercent(summary.targetMarginPercent)} /><CostRow label="EAC" value={formatMoney(summary.estimatedFinalCost)} /><CostRow label="Desviación" value={formatMoney(deviation)} tone={deviation != null && deviation > 0 ? "danger" : "success"} /></dl></div> : <HonestEmpty icon={LineChart} text="El margen no se muestra porque no se recibió un dato autorizado." />}
        </CostPanel>
      </section>

      <section className="rounded-xl border border-border bg-surface p-3">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div className="flex items-center gap-2"><AlertTriangle size={16} className={overBudgetLines.length ? "text-danger" : "text-success"} aria-hidden="true" /><h2 className="text-xs font-black text-content">Desviaciones verificables</h2><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${overBudgetLines.length ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{overBudgetLines.length}</span></div><Link href={`/obras/${workId}/costes/incidencias`} className="inline-flex min-h-11 items-center text-[10px] font-bold text-brand-strong hover:underline">Ver incidencias</Link></header>
        {overBudgetLines.length ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Partidas con sobrecoste"><table className="w-full min-w-[42rem] text-left text-[10px]"><thead className="text-content-secondary"><tr><th scope="col" className="px-2 py-3">Partida</th><th scope="col" className="px-2 py-3">Presupuesto</th><th scope="col" className="px-2 py-3">Estimado a fin</th><th scope="col" className="px-2 py-3">Desviación</th><th scope="col" className="px-2 py-3">Estado</th></tr></thead><tbody className="divide-y divide-border">{overBudgetLines.map((line) => <tr key={line.id}><td className="px-2 py-3 font-semibold text-content">{line.code ? `${line.code} · ` : ""}{line.name}</td><td className="px-2 py-3 tabular-nums">{formatMoney(line.budgetAmount)}</td><td className="px-2 py-3 tabular-nums">{formatMoney(line.estimatedFinalAmount)}</td><td className="px-2 py-3 font-bold tabular-nums text-danger">{formatMoney(lineDeviation(line))}</td><td className="px-2 py-3"><span className="rounded-full bg-danger/10 px-2 py-1 text-[8px] font-bold text-danger">Sobrecoste</span></td></tr>)}</tbody></table></div> : <div className="flex min-h-28 items-center justify-center gap-2 text-[10px] text-content-secondary"><CheckCircle2 size={18} className="text-success" aria-hidden="true" /> Ninguna partida recibida supera su presupuesto estimado a fin.</div>}
      </section>
    </div>
  );
}

function CostLinesTable({ lines, money }: { lines: WorkCostLine[]; money: Intl.NumberFormat }) {
  const format = (value: number | null) => finite(value) ? money.format(value) : "—";
  if (!lines.length) return <HonestEmpty icon={ListTree} text="No hay partidas que coincidan con los filtros actuales." />;
  return (
    <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable del desglose de costes">
      <table className="w-full min-w-[47rem] border-collapse text-left text-[9px]">
        <thead className="border-y border-border bg-subtle text-content-secondary"><tr><th scope="col" className="px-2 py-2.5">Partida</th><th scope="col" className="px-2 py-2.5">Presupuesto</th><th scope="col" className="px-2 py-2.5">Acumulado</th><th scope="col" className="px-2 py-2.5">Comprometido</th><th scope="col" className="px-2 py-2.5">Estimado a fin</th><th scope="col" className="px-2 py-2.5">Desviación</th><th scope="col" className="px-2 py-2.5">Estado</th></tr></thead>
        <tbody className="divide-y divide-border">{lines.map((line) => { const state = lineState(line); const deviation = lineDeviation(line); return <tr key={line.id} className="hover:bg-subtle/70"><td className="px-2 py-2.5 font-semibold text-content">{line.code ? `${line.code} · ` : ""}{line.name}</td><td className="px-2 py-2.5 tabular-nums">{format(line.budgetAmount)}</td><td className="px-2 py-2.5 tabular-nums">{format(line.actualAmount)}</td><td className="px-2 py-2.5 tabular-nums">{format(line.committedAmount)}</td><td className="px-2 py-2.5 tabular-nums">{format(line.estimatedFinalAmount)}</td><td className={`px-2 py-2.5 font-bold tabular-nums ${deviation != null && deviation > 0 ? "text-danger" : deviation != null ? "text-success" : "text-content-secondary"}`}>{format(deviation)}</td><td className="px-2 py-2.5"><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${lineStateClasses(state)}`}>{lineStateLabel(state)}</span></td></tr>; })}</tbody>
      </table>
      <p className="border-t border-border px-2 py-2.5 text-[9px] text-content-secondary">{lines.length} partidas visibles.</p>
    </div>
  );
}

function CostEvolutionChart({ points, mode, budgetTotal, currency }: { points: WorkCostSeriesPoint[]; mode: ChartMode; budgetTotal: number | null; currency: string }) {
  const validPoints = points.filter((point) => safeDate(point.date));
  const denominator = mode === "percent" && finite(budgetTotal) && budgetTotal !== 0 ? budgetTotal : 1;
  const value = (raw: number | null | undefined) => finite(raw) ? (mode === "percent" ? (raw / denominator) * 100 : raw) : null;
  const allValues = validPoints.flatMap((point) => [value(point.plannedCost), value(point.actualCost), value(point.estimatedFinalCost)]).filter((item): item is number => item != null);
  if (validPoints.length < 2 || !allValues.length) return <HonestEmpty icon={LineChart} text="Se necesitan al menos dos puntos temporales reales para dibujar la evolución." />;

  const maxValue = Math.max(...allValues, 1);
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const x = (index: number) => chartPadding.left + (index / Math.max(1, validPoints.length - 1)) * plotWidth;
  const y = (amount: number) => chartPadding.top + plotHeight - (amount / maxValue) * plotHeight;
  const pathPoints = (key: "plannedCost" | "actualCost" | "estimatedFinalCost") => validPoints.map((point, index) => { const amount = value(point[key]); return amount == null ? null : `${x(index)},${y(amount)}`; }).filter(Boolean).join(" ");
  const amountFormatter = new Intl.NumberFormat("es-ES", mode === "percent" ? { maximumFractionDigits: 0 } : { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const labels = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: maxValue * ratio }));

  return (
    <div className="mt-3 min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label="Gráfico desplazable de evolución de costes">
      <div className="mb-2 flex min-w-[42rem] flex-wrap gap-4 text-[8px] font-semibold text-content-secondary"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-content-tertiary" /> Presupuesto planificado</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-success" /> Coste acumulado</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /> Estimado a fin</span></div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[42rem]" role="img" aria-label={`Evolución de costes en ${mode === "percent" ? "porcentaje" : currency}`}>
        {labels.map(({ ratio, value: tickValue }) => <g key={ratio}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y(tickValue)} y2={y(tickValue)} stroke="currentColor" className="text-border" strokeWidth="1" /><text x={chartPadding.left - 8} y={y(tickValue) + 3} textAnchor="end" className="fill-content-tertiary text-[9px]">{amountFormatter.format(tickValue)}{mode === "percent" ? "%" : ""}</text></g>)}
        {pathPoints("plannedCost") ? <polyline points={pathPoints("plannedCost")} fill="none" stroke="currentColor" className="text-content-tertiary" strokeWidth="2" strokeDasharray="5 5" /> : null}
        {pathPoints("actualCost") ? <polyline points={pathPoints("actualCost")} fill="none" stroke="currentColor" className="text-success" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {pathPoints("estimatedFinalCost") ? <polyline points={pathPoints("estimatedFinalCost")} fill="none" stroke="currentColor" className="text-brand" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {validPoints.map((point, index) => { const actual = value(point.actualCost); return actual == null ? null : <circle key={`${point.date}-${index}`} cx={x(index)} cy={y(actual)} r="3" fill="currentColor" className="text-success"><title>{`${formatDate(point.date)} · ${amountFormatter.format(actual)}${mode === "percent" ? "%" : ""}`}</title></circle>; })}
        {validPoints.map((point, index) => index % Math.max(1, Math.ceil(validPoints.length / 6)) === 0 || index === validPoints.length - 1 ? <text key={point.date} x={x(index)} y={chartHeight - 9} textAnchor={index === 0 ? "start" : index === validPoints.length - 1 ? "end" : "middle"} className="fill-content-tertiary text-[9px]">{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(safeDate(point.date)!)}</text> : null)}
      </svg>
      <table className="sr-only"><caption>Datos del gráfico de evolución de costes</caption><thead><tr><th>Fecha</th><th>Planificado</th><th>Acumulado</th><th>Estimado a fin</th></tr></thead><tbody>{validPoints.map((point) => <tr key={point.date}><td>{formatDate(point.date)}</td><td>{finite(point.plannedCost) ? point.plannedCost : "Sin dato"}</td><td>{finite(point.actualCost) ? point.actualCost : "Sin dato"}</td><td>{finite(point.estimatedFinalCost) ? point.estimatedFinalCost : "Sin dato"}</td></tr>)}</tbody></table>
    </div>
  );
}

function CostPanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-border bg-surface p-3"><header className="mb-3 flex min-h-11 items-start justify-between gap-3 border-b border-border pb-2"><h2 className="pt-2 text-[11px] font-black text-content">{title}</h2>{action ? <span className="[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:text-[9px] [&_a]:font-bold [&_a]:text-brand-strong [&_a:hover]:underline">{action}</span> : null}</header>{children}</article>;
}

function ChartFigure({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><span className="block truncate text-[8px] font-semibold text-content-tertiary">{label}</span><strong className="mt-1 block truncate text-[10px] tabular-nums text-content" title={value}>{value}</strong></div>;
}

function CostRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-content";
  return <div className="flex min-h-8 items-center justify-between gap-3 border-b border-border last:border-0"><dt className="text-content-secondary">{label}</dt><dd className={`text-right font-bold tabular-nums ${toneClass}`}>{value}</dd></div>;
}

function HonestEmpty({ icon: Icon, text }: { icon: typeof ListTree; text: string }) {
  return <div className="grid min-h-36 place-content-center justify-items-center p-4 text-center"><Icon size={21} className="text-content-tertiary" aria-hidden="true" /><p className="mt-3 max-w-sm text-[10px] leading-5 text-content-secondary">{text}</p></div>;
}
