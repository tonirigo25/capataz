"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Filter,
  FolderTree,
  Info,
  LineChart,
  Search,
  Settings2,
  TrendingUp,
  WalletCards,
} from "lucide-react";

export type WorkCostAnalysisTone = "neutral" | "success" | "warning" | "danger";

export type WorkCostAnalysisSummary = {
  budgetAmount: number | null;
  budgetPercent?: number | null;
  budgetTone?: WorkCostAnalysisTone;
  actualAmount: number | null;
  actualPercent?: number | null;
  actualTone?: WorkCostAnalysisTone;
  forecastAmount: number | null;
  forecastPercent?: number | null;
  forecastTone?: WorkCostAnalysisTone;
  deviationAmount: number | null;
  deviationPercent?: number | null;
  deviationTone?: WorkCostAnalysisTone;
  projectedMarginAmount: number | null;
  projectedMarginPercent?: number | null;
  projectedMarginTone?: WorkCostAnalysisTone;
};

export type WorkCostAnalysisTrendPoint = {
  date: string;
  budgetAmount?: number | null;
  actualAmount?: number | null;
  forecastAmount?: number | null;
};

export type WorkCostAnalysisCategory = {
  id: string;
  code?: string | null;
  name: string;
  budgetAmount: number | null;
  actualAmount: number | null;
  forecastAmount: number | null;
  deviationAmount: number | null;
  deviationPercent?: number | null;
  tone?: WorkCostAnalysisTone;
  stateLabel?: string | null;
};

export type WorkCostAnalysisCategoryTotals = {
  budgetAmount: number | null;
  actualAmount: number | null;
  forecastAmount: number | null;
  deviationAmount: number | null;
  deviationPercent?: number | null;
  tone?: WorkCostAnalysisTone;
};

export type WorkCostAnalysisDeviation = {
  id: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  percent?: number | null;
  tone?: WorkCostAnalysisTone;
  stateLabel?: string | null;
  evidenceHref?: string | null;
};

export type WorkCostsAnalysisProps = {
  currency?: string;
  title?: string;
  subtitle?: string;
  periodLabel?: string | null;
  supplierLabel?: string | null;
  chapterLabel?: string | null;
  summary: WorkCostAnalysisSummary;
  trend: WorkCostAnalysisTrendPoint[];
  categories: WorkCostAnalysisCategory[];
  categoryTotals?: WorkCostAnalysisCategoryTotals | null;
  deviations: WorkCostAnalysisDeviation[];
  exportHref?: string | null;
  configureHref?: string | null;
  categoriesHref?: string | null;
  deviationsHref?: string | null;
};

type CategoryFilter = "all" | WorkCostAnalysisTone;
type CategorySort = "source" | "name" | "actual" | "deviation";
type TrendKey = "budgetAmount" | "actualAmount" | "forecastAmount";

const chartWidth = 920;
const chartHeight = 300;
const chartPadding = { left: 70, right: 26, top: 24, bottom: 44 };

const toneText: Record<WorkCostAnalysisTone, string> = {
  neutral: "text-content",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const toneBadge: Record<WorkCostAnalysisTone, string> = {
  neutral: "bg-subtle text-content-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string) {
  const date = validDate(value);
  return date
    ? new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" }).format(date)
    : "Sin fecha";
}

function normalizedTone(tone?: WorkCostAnalysisTone): WorkCostAnalysisTone {
  return tone ?? "neutral";
}

export function WorkCostsAnalysis({
  currency = "EUR",
  title = "Análisis de costes",
  subtitle = "Análisis detallado con datos autorizados",
  periodLabel,
  supplierLabel,
  chapterLabel,
  summary,
  trend,
  categories,
  categoryTotals = null,
  deviations,
  exportHref,
  configureHref,
  categoriesHref,
  deviationsHref,
}: WorkCostsAnalysisProps) {
  const [query, setQuery] = useState("");
  const [toneFilter, setToneFilter] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<CategorySort>("source");
  const [visibleTrend, setVisibleTrend] = useState<Record<TrendKey, boolean>>({
    budgetAmount: true,
    actualAmount: true,
    forecastAmount: true,
  });

  const money = useMemo(
    () => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }),
    [currency],
  );
  const percent = useMemo(
    () => new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }),
    [],
  );
  const formatMoney = (value: number | null | undefined) => finite(value) ? money.format(value) : "—";
  const formatPercent = (value: number | null | undefined) => finite(value) ? percent.format(value / 100) : "—";

  const visibleCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-ES");
    const rows = categories
      .map((category, sourceIndex) => ({ category, sourceIndex }))
      .filter(({ category }) => {
        const matchesQuery = !normalizedQuery || `${category.code ?? ""} ${category.name}`.toLocaleLowerCase("es-ES").includes(normalizedQuery);
        const matchesTone = toneFilter === "all" || normalizedTone(category.tone) === toneFilter;
        return matchesQuery && matchesTone;
      });

    rows.sort((left, right) => {
      if (sort === "name") return left.category.name.localeCompare(right.category.name, "es");
      if (sort === "actual") return (right.category.actualAmount ?? Number.NEGATIVE_INFINITY) - (left.category.actualAmount ?? Number.NEGATIVE_INFINITY);
      if (sort === "deviation") {
        const rightDeviation = finite(right.category.deviationAmount) ? Math.abs(right.category.deviationAmount) : Number.NEGATIVE_INFINITY;
        const leftDeviation = finite(left.category.deviationAmount) ? Math.abs(left.category.deviationAmount) : Number.NEGATIVE_INFINITY;
        return rightDeviation - leftDeviation;
      }
      return left.sourceIndex - right.sourceIndex;
    });
    return rows.map(({ category }) => category);
  }, [categories, query, sort, toneFilter]);

  const contexts = [
    periodLabel ? { label: "Periodo", value: periodLabel, icon: CalendarDays } : null,
    supplierLabel ? { label: "Proveedor", value: supplierLabel, icon: CircleDollarSign } : null,
    chapterLabel ? { label: "Capítulo", value: chapterLabel, icon: FolderTree } : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="work-cost-analysis-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 id="work-cost-analysis-title" className="text-xl font-black text-content">{title}</h1>
            <span title="Sólo se muestran métricas recibidas por props" className="inline-flex text-content-tertiary">
              <Info size={15} aria-hidden="true" />
              <span className="sr-only">Sólo se muestran métricas recibidas por props.</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-content-secondary">{subtitle}</p>
        </div>
        {exportHref || configureHref ? (
          <div className="flex flex-wrap gap-2">
            {exportHref ? <Link href={exportHref} className="secondary-button min-h-11"><Download size={15} aria-hidden="true" /> Exportar</Link> : null}
            {configureHref ? <Link href={configureHref} className="primary-button min-h-11"><Settings2 size={15} aria-hidden="true" /> Configurar vista</Link> : null}
          </div>
        ) : null}
      </header>

      {contexts.length ? (
        <section className="grid gap-2 sm:grid-cols-3" aria-label="Contexto del análisis recibido">
          {contexts.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex min-h-12 min-w-0 items-center gap-3 rounded-lg border border-border bg-surface px-3">
              <Icon size={16} className="shrink-0 text-content-secondary" aria-hidden="true" />
              <span className="min-w-0"><span className="block text-[9px] text-content-secondary">{label}</span><strong className="block truncate text-[10px] text-content">{value}</strong></span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2 xl:grid-cols-5" aria-label="Indicadores autorizados del análisis de costes">
        <AnalysisMetric icon={WalletCards} label="Presupuesto (PV)" amount={summary.budgetAmount} percent={summary.budgetPercent} tone={summary.budgetTone} money={formatMoney} percentage={formatPercent} />
        <AnalysisMetric icon={CircleDollarSign} label="Coste real (AC)" amount={summary.actualAmount} percent={summary.actualPercent} tone={summary.actualTone} money={formatMoney} percentage={formatPercent} />
        <AnalysisMetric icon={LineChart} label="Previsión (EAC)" amount={summary.forecastAmount} percent={summary.forecastPercent} tone={summary.forecastTone} money={formatMoney} percentage={formatPercent} />
        <AnalysisMetric icon={AlertTriangle} label="Desviación (EAC-PV)" amount={summary.deviationAmount} percent={summary.deviationPercent} tone={summary.deviationTone} money={formatMoney} percentage={formatPercent} />
        <AnalysisMetric icon={TrendingUp} label="Margen previsto" amount={summary.projectedMarginAmount} percent={summary.projectedMarginPercent} tone={summary.projectedMarginTone} money={formatMoney} percentage={formatPercent} className="col-span-2 xl:col-span-1" />
      </section>

      <CostAnalysisPanel
        title="Evolución acumulada de costes"
        description="Serie temporal recibida; no se interpolan puntos ausentes ni se genera una previsión."
      >
        <div className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Series visibles">
          <TrendToggle label="Presupuesto (PV)" pressed={visibleTrend.budgetAmount} tone="neutral" onClick={() => setVisibleTrend((current) => ({ ...current, budgetAmount: !current.budgetAmount }))} />
          <TrendToggle label="Coste real (AC)" pressed={visibleTrend.actualAmount} tone="success" onClick={() => setVisibleTrend((current) => ({ ...current, actualAmount: !current.actualAmount }))} />
          <TrendToggle label="Previsión (EAC)" pressed={visibleTrend.forecastAmount} tone="warning" onClick={() => setVisibleTrend((current) => ({ ...current, forecastAmount: !current.forecastAmount }))} />
        </div>
        <CostTrendChart points={trend} visible={visibleTrend} currency={currency} money={formatMoney} />
      </CostAnalysisPanel>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <CostAnalysisPanel
          title="Desviaciones por capítulo"
          description="Importes y estados recibidos; el componente no aplica umbrales propios."
          action={categoriesHref ? <Link href={categoriesHref}>Ver detalle por capítulo</Link> : null}
        >
          <div className="grid gap-2 border-b border-border pb-3 md:grid-cols-[minmax(12rem,1fr)_10rem_11rem]">
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">Buscar capítulo</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none" placeholder="Buscar capítulo…" />
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary">
              <Filter size={15} aria-hidden="true" />
              <span className="sr-only">Filtrar por estado recibido</span>
              <select value={toneFilter} onChange={(event) => setToneFilter(event.target.value as CategoryFilter)} className="min-w-0 flex-1 border-0 bg-transparent text-content outline-none">
                <option value="all">Todos</option><option value="danger">Crítico</option><option value="warning">Atención</option><option value="success">Favorable</option><option value="neutral">Sin clasificar</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center rounded-lg border border-border px-3 text-[10px] text-content-secondary">
              <span className="sr-only">Ordenar capítulos</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as CategorySort)} className="min-w-0 flex-1 border-0 bg-transparent text-content outline-none">
                <option value="source">Orden recibido</option><option value="deviation">Mayor desviación</option><option value="actual">Mayor coste real</option><option value="name">Nombre</option>
              </select>
            </label>
          </div>
          <CategoryTable rows={visibleCategories} totals={categoryTotals} money={formatMoney} percentage={formatPercent} />
        </CostAnalysisPanel>

        <CostAnalysisPanel
          title={`Desviaciones verificables · ${deviations.length}`}
          description="Alertas clasificadas por la fuente; no se deducen severidades."
          action={deviationsHref ? <Link href={deviationsHref}>Ver matriz</Link> : null}
        >
          {deviations.length ? (
            <ul className="grid gap-2">
              {deviations.map((deviation) => <DeviationCard key={deviation.id} deviation={deviation} money={formatMoney} percentage={formatPercent} />)}
            </ul>
          ) : <HonestEmpty icon={CheckCircle2} text="No se han recibido desviaciones verificables para este análisis." />}
        </CostAnalysisPanel>
      </section>
    </section>
  );
}

function AnalysisMetric({ icon: Icon, label, amount, percent, tone, money, percentage, className = "" }: {
  icon: typeof WalletCards;
  label: string;
  amount: number | null;
  percent?: number | null;
  tone?: WorkCostAnalysisTone;
  money: (value: number | null | undefined) => string;
  percentage: (value: number | null | undefined) => string;
  className?: string;
}) {
  const resolvedTone = normalizedTone(tone);
  const hasAmount = finite(amount);
  return (
    <article className={`min-w-0 rounded-xl border border-border bg-surface p-3 shadow-soft ${className}`}>
      <div className="flex items-center gap-2 text-content-secondary"><Icon size={15} aria-hidden="true" /><h2 className="truncate text-[9px] font-bold uppercase tracking-wide">{label}</h2></div>
      <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
        <strong className="truncate text-lg font-black tabular-nums text-content" title={money(amount)}>{money(amount)}</strong>
        <span className={`shrink-0 text-[10px] font-bold tabular-nums ${toneText[resolvedTone]}`}>{percentage(percent)}</span>
      </div>
      <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-border" aria-hidden="true">{finite(percent) ? <span className={`block h-full ${resolvedTone === "danger" ? "bg-danger" : resolvedTone === "warning" ? "bg-warning" : resolvedTone === "success" ? "bg-success" : "bg-content-tertiary"}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /> : null}</div>
      {!hasAmount ? <p className="mt-2 text-[9px] text-content-tertiary">Sin dato autorizado</p> : null}
    </article>
  );
}

function TrendToggle({ label, pressed, tone, onClick }: { label: string; pressed: boolean; tone: WorkCostAnalysisTone; onClick: () => void }) {
  const swatch = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-content-tertiary";
  return <button type="button" aria-pressed={pressed} onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-[10px] font-semibold ${pressed ? "border-brand/30 bg-brand-soft text-content" : "border-border text-content-secondary opacity-60"}`}><span className={`h-0.5 w-5 ${swatch}`} aria-hidden="true" />{label}</button>;
}

function CostTrendChart({ points, visible, currency, money }: {
  points: WorkCostAnalysisTrendPoint[];
  visible: Record<TrendKey, boolean>;
  currency: string;
  money: (value: number | null | undefined) => string;
}) {
  const validPoints = [...points]
    .filter((point) => validDate(point.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  const keys = (Object.keys(visible) as TrendKey[]).filter((key) => visible[key]);
  const values = validPoints.flatMap((point) => keys.map((key) => point[key])).filter(finite);
  if (!validPoints.length || !values.length) return <HonestEmpty icon={LineChart} text="No hay una serie temporal autorizada para representar." />;

  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const span = maxValue - minValue || 1;
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const x = (index: number) => chartPadding.left + (validPoints.length === 1 ? innerWidth / 2 : (index / (validPoints.length - 1)) * innerWidth);
  const y = (value: number) => chartPadding.top + ((maxValue - value) / span) * innerHeight;
  const gridValues = Array.from({ length: 5 }, (_, index) => maxValue - (span * index) / 4);
  const lineClass: Record<TrendKey, string> = { budgetAmount: "text-content-tertiary", actualAmount: "text-success", forecastAmount: "text-warning" };
  const lineDash: Record<TrendKey, string | undefined> = { budgetAmount: "6 5", actualAmount: undefined, forecastAmount: "3 4" };
  const labelFor: Record<TrendKey, string> = { budgetAmount: "Presupuesto", actualAmount: "Coste real", forecastAmount: "Previsión" };

  return (
    <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Gráfico desplazable de evolución acumulada de costes">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[44rem]" role="img" aria-label={`Evolución acumulada de costes en ${currency}`}>
        <title>Evolución acumulada de costes</title>
        <desc>Series recibidas de presupuesto, coste real y previsión. Los puntos ausentes no se interpolan.</desc>
        {gridValues.map((value, index) => <g key={`${value}-${index}`}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y(value)} y2={y(value)} stroke="currentColor" className="text-border" strokeWidth="1" /><text x={chartPadding.left - 10} y={y(value) + 4} textAnchor="end" className="fill-content-tertiary text-[10px]">{money(value)}</text></g>)}
        {keys.flatMap((key) => contiguousSegments(validPoints, key).map((segment, segmentIndex) => (
          <polyline key={`${key}-${segmentIndex}`} points={segment.map(({ value, index }) => `${x(index)},${y(value)}`).join(" ")} fill="none" stroke="currentColor" className={lineClass[key]} strokeWidth={key === "actualAmount" ? 3 : 2} strokeDasharray={lineDash[key]} strokeLinecap="round" strokeLinejoin="round" />
        )))}
        {validPoints.map((point, index) => keys.map((key) => finite(point[key]) ? <circle key={`${point.date}-${key}`} cx={x(index)} cy={y(point[key]!)} r="3" fill="currentColor" className={lineClass[key]}><title>{`${labelFor[key]} · ${formatDate(point.date)} · ${money(point[key])}`}</title></circle> : null))}
        {validPoints.map((point, index) => <text key={`${point.date}-label`} x={x(index)} y={chartHeight - 14} textAnchor="middle" className="fill-content-tertiary text-[10px]">{formatDate(point.date)}</text>)}
      </svg>
      <table className="sr-only"><caption>Datos de evolución acumulada de costes</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Presupuesto</th><th scope="col">Coste real</th><th scope="col">Previsión</th></tr></thead><tbody>{validPoints.map((point) => <tr key={point.date}><td>{point.date}</td><td>{finite(point.budgetAmount) ? point.budgetAmount : "Sin dato"}</td><td>{finite(point.actualAmount) ? point.actualAmount : "Sin dato"}</td><td>{finite(point.forecastAmount) ? point.forecastAmount : "Sin dato"}</td></tr>)}</tbody></table>
    </div>
  );
}

function contiguousSegments(points: WorkCostAnalysisTrendPoint[], key: TrendKey) {
  const segments: Array<Array<{ index: number; value: number }>> = [];
  let current: Array<{ index: number; value: number }> = [];
  points.forEach((point, index) => {
    const value = point[key];
    if (finite(value)) current.push({ index, value });
    else if (current.length) { segments.push(current); current = []; }
  });
  if (current.length) segments.push(current);
  return segments;
}

function CategoryTable({ rows, totals, money, percentage }: {
  rows: WorkCostAnalysisCategory[];
  totals: WorkCostAnalysisCategoryTotals | null;
  money: (value: number | null | undefined) => string;
  percentage: (value: number | null | undefined) => string;
}) {
  if (!rows.length) return <HonestEmpty icon={FolderTree} text="No hay capítulos que coincidan con los filtros o no se recibieron datos." />;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable de desviaciones por capítulo">
      <table className="w-full min-w-[48rem] text-left text-[10px]">
        <thead className="text-content-secondary"><tr><th scope="col" className="px-2 py-3">Capítulo</th><th scope="col" className="px-2 py-3 text-right">Presupuesto</th><th scope="col" className="px-2 py-3 text-right">Coste real</th><th scope="col" className="px-2 py-3 text-right">Previsión</th><th scope="col" className="px-2 py-3 text-right">Desviación</th><th scope="col" className="px-2 py-3 text-right">Desv. %</th></tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const tone = normalizedTone(row.tone);
            return <tr key={row.id} className="hover:bg-subtle/70"><td className="px-2 py-2.5"><span className="flex min-w-0 items-center gap-2"><span className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[8px] font-bold ${toneBadge[tone]}`}>{row.code ?? "—"}</span><span className="min-w-0"><strong className="block truncate text-content">{row.name}</strong>{row.stateLabel ? <small className="block truncate text-[8px] text-content-secondary">{row.stateLabel}</small> : null}</span></span></td><td className="px-2 py-2.5 text-right tabular-nums">{money(row.budgetAmount)}</td><td className="px-2 py-2.5 text-right tabular-nums">{money(row.actualAmount)}</td><td className="px-2 py-2.5 text-right tabular-nums">{money(row.forecastAmount)}</td><td className={`px-2 py-2.5 text-right font-bold tabular-nums ${toneText[tone]}`}>{money(row.deviationAmount)}</td><td className={`px-2 py-2.5 text-right font-bold tabular-nums ${toneText[tone]}`}>{percentage(row.deviationPercent)}</td></tr>;
          })}
        </tbody>
        {totals ? <tfoot className="border-t-2 border-border font-black text-content"><tr><th scope="row" className="px-2 py-3">Total autorizado</th><td className="px-2 py-3 text-right tabular-nums">{money(totals.budgetAmount)}</td><td className="px-2 py-3 text-right tabular-nums">{money(totals.actualAmount)}</td><td className="px-2 py-3 text-right tabular-nums">{money(totals.forecastAmount)}</td><td className={`px-2 py-3 text-right tabular-nums ${toneText[normalizedTone(totals.tone)]}`}>{money(totals.deviationAmount)}</td><td className={`px-2 py-3 text-right tabular-nums ${toneText[normalizedTone(totals.tone)]}`}>{percentage(totals.deviationPercent)}</td></tr></tfoot> : null}
      </table>
    </div>
  );
}

function DeviationCard({ deviation, money, percentage }: {
  deviation: WorkCostAnalysisDeviation;
  money: (value: number | null | undefined) => string;
  percentage: (value: number | null | undefined) => string;
}) {
  const tone = normalizedTone(deviation.tone);
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  const content = <><div className="flex items-start gap-3"><Icon size={18} className={`mt-0.5 shrink-0 ${toneText[tone]}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-[10px] font-bold text-content">{deviation.title}</h3>{deviation.stateLabel ? <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${toneBadge[tone]}`}>{deviation.stateLabel}</span> : null}</div>{deviation.description ? <p className="mt-1 text-[9px] leading-4 text-content-secondary">{deviation.description}</p> : null}{finite(deviation.amount) || finite(deviation.percent) ? <p className={`mt-2 text-[10px] font-bold tabular-nums ${toneText[tone]}`}>{finite(deviation.amount) ? money(deviation.amount) : null}{finite(deviation.amount) && finite(deviation.percent) ? " · " : null}{finite(deviation.percent) ? percentage(deviation.percent) : null}</p> : null}</div></div></>;
  return <li>{deviation.evidenceHref ? <Link href={deviation.evidenceHref} className="block min-h-11 rounded-lg border border-border p-3 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link> : <article className="rounded-lg border border-border p-3">{content}</article>}</li>;
}

function CostAnalysisPanel({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3 shadow-soft">
      <header className="flex min-h-11 flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xs font-black text-content">{title}</h2>{description ? <p className="mt-1 text-[9px] leading-4 text-content-secondary">{description}</p> : null}</div>
        {action ? <div className="[&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:text-[10px] [&>a]:font-bold [&>a]:text-brand-strong [&>a:hover]:underline">{action}</div> : null}
      </header>
      {children}
    </article>
  );
}

function HonestEmpty({ icon: Icon, text }: { icon: typeof LineChart; text: string }) {
  return <div className="mt-3 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-subtle p-5 text-center"><Icon size={22} className="text-content-tertiary" aria-hidden="true" /><p className="mt-2 max-w-md text-[10px] leading-5 text-content-secondary">{text}</p></div>;
}
