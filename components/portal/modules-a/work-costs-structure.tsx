"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Layers3,
  MinusCircle,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export type WorkCostAmounts = {
  budget: number | null;
  committed: number | null;
  accumulated: number | null;
  forecast: number | null;
  toDate: number | null;
};

export type WorkCostItem = WorkCostAmounts & {
  id: string;
  code: string;
  description: string;
  href?: string;
};

export type WorkCostChapter = WorkCostAmounts & {
  id: string;
  code: string;
  description: string;
  items: WorkCostItem[];
  href?: string;
};

export type WorkCostCoverage = {
  budget: boolean;
  committed: boolean;
  accumulated: boolean;
  forecast: boolean;
  toDate: boolean;
};

type WorkCostsStructureProps = {
  chapters: WorkCostChapter[];
  coverage: WorkCostCoverage;
  currency?: string;
  locale?: string;
  reviewedAt?: string | null;
  versionLabel?: string | null;
  exportHref?: string;
};

type AmountKey = keyof WorkCostAmounts;
type DeviationFilter = "all" | "over" | "under";

const amountLabels: Record<AmountKey, string> = {
  budget: "Presupuesto",
  committed: "Comprometido",
  accumulated: "Acumulado",
  forecast: "Previsto",
  toDate: "Hasta la fecha",
};

function finiteAmount(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

function deviation(amounts: WorkCostAmounts) {
  return finiteAmount(amounts.budget) && finiteAmount(amounts.forecast) ? amounts.forecast - amounts.budget : null;
}

function deviationPercent(amounts: WorkCostAmounts) {
  const value = deviation(amounts);
  return value != null && finiteAmount(amounts.budget) && amounts.budget !== 0 ? value / amounts.budget * 100 : null;
}

function marginPercent(amounts: WorkCostAmounts) {
  return finiteAmount(amounts.budget) && finiteAmount(amounts.forecast) && amounts.budget !== 0 ? (amounts.budget - amounts.forecast) / amounts.budget * 100 : null;
}

function dateLabel(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function coverageTotal(chapters: WorkCostChapter[], coverage: WorkCostCoverage, key: AmountKey) {
  if (!coverage[key] || chapters.length === 0 || chapters.some((chapter) => !finiteAmount(chapter[key]))) return null;
  return chapters.reduce((sum, chapter) => sum + (chapter[key] ?? 0), 0);
}

function Amount({ value, format }: { value: number | null; format: (value: number) => string }) {
  return value == null ? <span className="text-content-tertiary" title="Dato no disponible">—</span> : <span className="tabular-nums">{format(value)}</span>;
}

function Deviation({ amounts, format }: { amounts: WorkCostAmounts; format: (value: number) => string }) {
  const value = deviation(amounts);
  if (value == null) return <span className="text-content-tertiary">—</span>;
  const tone = value > 0 ? "text-danger" : value < 0 ? "text-success" : "text-content-secondary";
  return <span className={`tabular-nums font-bold ${tone}`}>{value > 0 ? "+" : ""}{format(value)}</span>;
}

function Percent({ value, positiveIsBad = false }: { value: number | null; positiveIsBad?: boolean }) {
  if (value == null) return <span className="text-content-tertiary">—</span>;
  const bad = positiveIsBad ? value > 0 : value < 0;
  const good = positiveIsBad ? value < 0 : value > 0;
  return <span className={`tabular-nums font-bold ${bad ? "text-danger" : good ? "text-success" : "text-content-secondary"}`}>{value > 0 ? "+" : ""}{value.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%</span>;
}

function SummaryCard({ label, value, detail, icon: Icon, tone = "neutral" }: { label: string; value: React.ReactNode; detail: string; icon: typeof CircleDollarSign; tone?: "neutral" | "success" | "danger" }) {
  const iconTone = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "danger" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  return <article className="min-w-0 rounded-lg border border-border bg-surface p-3"><div className="flex items-start gap-2"><span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}><Icon size={16} aria-hidden="true" /></span><div className="min-w-0"><span className="block truncate text-[9px] font-semibold text-content-secondary">{label}</span><strong className="mt-1 block truncate text-lg font-black text-content">{value}</strong><small className="mt-1 block truncate text-[8px] text-content-tertiary">{detail}</small></div></div></article>;
}

function EmptyAggregate({ label }: { label: string }) {
  return <span title={`${label}: cobertura incompleta`}>—</span>;
}

export function WorkCostsStructure({ chapters, coverage, currency = "EUR", locale = "es-ES", reviewedAt, versionLabel, exportHref }: WorkCostsStructureProps) {
  const id = useId();
  const format = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format, [currency, locale]);
  const orderedChapters = useMemo(() => [...chapters].sort((a, b) => a.code.localeCompare(b.code, locale, { numeric: true })), [chapters, locale]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(orderedChapters[0] ? [orderedChapters[0].id] : []));
  const [query, setQuery] = useState("");
  const [chapterId, setChapterId] = useState("all");
  const [deviationFilter, setDeviationFilter] = useState<DeviationFilter>("all");
  const [onlyDeviations, setOnlyDeviations] = useState(false);

  const totals = useMemo(() => ({
    budget: coverageTotal(orderedChapters, coverage, "budget"),
    committed: coverageTotal(orderedChapters, coverage, "committed"),
    accumulated: coverageTotal(orderedChapters, coverage, "accumulated"),
    forecast: coverageTotal(orderedChapters, coverage, "forecast"),
    toDate: coverageTotal(orderedChapters, coverage, "toDate"),
  }), [coverage, orderedChapters]);
  const totalDeviation = totals.budget != null && totals.forecast != null ? totals.forecast - totals.budget : null;
  const totalDeviationPercent = totalDeviation != null && totals.budget ? totalDeviation / totals.budget * 100 : null;
  const totalMargin = totals.budget != null && totals.forecast != null && totals.budget !== 0 ? (totals.budget - totals.forecast) / totals.budget * 100 : null;
  const reviewed = dateLabel(reviewedAt, locale);

  const linePasses = (line: WorkCostAmounts & { code: string; description: string }) => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (needle && !`${line.code} ${line.description}`.toLocaleLowerCase(locale).includes(needle)) return false;
    const value = deviation(line);
    if (onlyDeviations && (value == null || value === 0)) return false;
    if (deviationFilter === "over" && (value == null || value <= 0)) return false;
    if (deviationFilter === "under" && (value == null || value >= 0)) return false;
    return true;
  };

  const visibleChapters = orderedChapters.flatMap((chapter) => {
    if (chapterId !== "all" && chapter.id !== chapterId) return [];
    const visibleItems = chapter.items.filter(linePasses).sort((a, b) => a.code.localeCompare(b.code, locale, { numeric: true }));
    if (!linePasses(chapter) && visibleItems.length === 0) return [];
    return [{ chapter, visibleItems }];
  });
  const filtersActive = Boolean(query || chapterId !== "all" || deviationFilter !== "all" || onlyDeviations);
  const resetFilters = () => { setQuery(""); setChapterId("all"); setDeviationFilter("all"); setOnlyDeviations(false); };
  const toggleChapter = (chapter: WorkCostChapter) => setExpanded((current) => { const next = new Set(current); if (next.has(chapter.id)) next.delete(chapter.id); else next.add(chapter.id); return next; });
  const expandAll = () => setExpanded(new Set(visibleChapters.map(({ chapter }) => chapter.id)));
  const collapseAll = () => setExpanded(new Set());
  const itemCount = orderedChapters.reduce((sum, chapter) => sum + chapter.items.length, 0);

  const comparableKeys = (["budget", "forecast", "accumulated"] as const).filter((key) => coverage[key] && orderedChapters.every((chapter) => finiteAmount(chapter[key])));
  const chartMax = Math.max(0, ...orderedChapters.flatMap((chapter) => comparableKeys.map((key) => chapter[key] ?? 0)));
  const deviations = orderedChapters.flatMap((chapter) => chapter.items.map((item) => ({ chapter, item, value: deviation(item), percent: deviationPercent(item) }))).filter((row): row is typeof row & { value: number; percent: number | null } => row.value != null && row.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5);

  return <div className="grid min-w-0 gap-3">
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumen de estructura de costes">
      <SummaryCard label="Presupuesto total" value={totals.budget == null ? <EmptyAggregate label="Presupuesto total" /> : format(totals.budget)} detail={reviewed ? `Revisado ${reviewed}${versionLabel ? ` · ${versionLabel}` : ""}` : versionLabel ?? (coverage.budget ? "Cobertura completa" : "Cobertura incompleta")} icon={CircleDollarSign} />
      <SummaryCard label="Coste acumulado" value={totals.accumulated == null ? <EmptyAggregate label="Coste acumulado" /> : format(totals.accumulated)} detail={totals.accumulated != null && totals.budget ? `${(totals.accumulated / totals.budget * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}% del presupuesto` : "Cobertura incompleta"} icon={BarChart3} />
      <SummaryCard label="Coste comprometido" value={totals.committed == null ? <EmptyAggregate label="Coste comprometido" /> : format(totals.committed)} detail={totals.committed != null && totals.budget ? `${(totals.committed / totals.budget * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}% del presupuesto` : "Cobertura incompleta"} icon={Layers3} />
      <SummaryCard label="Desviación prevista" value={totalDeviation == null ? <EmptyAggregate label="Desviación prevista" /> : `${totalDeviation > 0 ? "+" : ""}${format(totalDeviation)}`} detail={totalDeviationPercent == null ? "Cobertura incompleta" : `${totalDeviationPercent > 0 ? "+" : ""}${totalDeviationPercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%`} icon={totalDeviation != null && totalDeviation > 0 ? TrendingUp : TrendingDown} tone={totalDeviation != null && totalDeviation > 0 ? "danger" : totalDeviation != null && totalDeviation < 0 ? "success" : "neutral"} />
      <SummaryCard label="Margen previsto" value={totalMargin == null ? <EmptyAggregate label="Margen previsto" /> : `${totalMargin.toLocaleString(locale, { maximumFractionDigits: 1 })}%`} detail={totalMargin == null ? "Cobertura incompleta" : "Presupuesto menos previsión"} icon={TrendingUp} tone={totalMargin != null && totalMargin >= 0 ? "success" : totalMargin != null ? "danger" : "neutral"} />
      <SummaryCard label="Coste hasta la fecha" value={totals.toDate == null ? <EmptyAggregate label="Coste hasta la fecha" /> : format(totals.toDate)} detail={coverage.toDate ? "Registros cubiertos" : "Cobertura incompleta"} icon={CircleDollarSign} />
    </section>

    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 xl:flex-row xl:items-center" aria-label="Filtros de la estructura de costes">
      <label htmlFor={`${id}-search`} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar capítulo o concepto</span><input id={`${id}-search`} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-content outline-none" placeholder="Buscar capítulo o concepto…" /></label>
      <label htmlFor={`${id}-chapter`} className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><Filter size={14} aria-hidden="true" /><select id={`${id}-chapter`} value={chapterId} onChange={(event) => setChapterId(event.target.value)} className="min-w-0 bg-transparent font-bold text-content outline-none"><option value="all">Todos los capítulos</option>{orderedChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.code} · {chapter.description}</option>)}</select></label>
      <label htmlFor={`${id}-deviation`} className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><span>Desviación</span><select id={`${id}-deviation`} value={deviationFilter} onChange={(event) => setDeviationFilter(event.target.value as DeviationFilter)} className="min-w-0 bg-transparent font-bold text-content outline-none"><option value="all">Todas</option><option value="over">Sobrecoste</option><option value="under">Ahorro</option></select></label>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-[10px] font-semibold text-content-secondary"><input type="checkbox" checked={onlyDeviations} onChange={(event) => setOnlyDeviations(event.target.checked)} className="h-4 w-4 accent-brand" />Sólo desviaciones</label>
      {filtersActive ? <button type="button" onClick={resetFilters} className="min-h-10 px-2 text-[10px] font-bold text-brand-strong hover:underline">Limpiar</button> : null}
      {exportHref ? <Link href={exportHref} className="secondary-button justify-center">Exportar</Link> : null}
    </section>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-label="Capítulos y partidas de coste">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-[10px]">
            <thead className="border-b border-border bg-subtle text-content-secondary"><tr><th className="w-24 px-3 py-2 font-semibold">Código</th><th className="min-w-56 px-3 py-2 font-semibold">Descripción</th><th className="px-3 py-2 text-right font-semibold">Presupuesto</th><th className="px-3 py-2 text-right font-semibold">Comprometido</th><th className="px-3 py-2 text-right font-semibold">Acumulado</th><th className="px-3 py-2 text-right font-semibold">Desviación</th><th className="px-3 py-2 text-right font-semibold">Desv. %</th><th className="px-3 py-2 text-right font-semibold">Margen</th></tr></thead>
            <tbody className="divide-y divide-border">{visibleChapters.map(({ chapter, visibleItems }) => { const open = query ? true : expanded.has(chapter.id); return <ChapterRows key={chapter.id} chapter={chapter} visibleItems={visibleItems} open={open} onToggle={() => toggleChapter(chapter)} format={format} />; })}</tbody>
            {orderedChapters.length ? <tfoot className="border-t-2 border-border bg-brand-soft/40 font-black text-content"><tr><td className="px-3 py-3" colSpan={2}>TOTAL ESTRUCTURA</td>{(["budget", "committed", "accumulated"] as const).map((key) => <td key={key} className="px-3 py-3 text-right"><Amount value={totals[key]} format={format} /></td>)}<td className="px-3 py-3 text-right">{totalDeviation == null ? "—" : `${totalDeviation > 0 ? "+" : ""}${format(totalDeviation)}`}</td><td className="px-3 py-3 text-right"><Percent value={totalDeviationPercent} positiveIsBad /></td><td className="px-3 py-3 text-right"><Percent value={totalMargin} /></td></tr></tfoot> : null}
          </table>
        </div>
        <footer className="flex flex-col gap-2 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] text-content-secondary" aria-live="polite">Mostrando {visibleChapters.length} de {orderedChapters.length} capítulos · {itemCount} partidas registradas</p><div className="flex gap-2"><button type="button" onClick={expandAll} className="secondary-button">Expandir todo</button><button type="button" onClick={collapseAll} className="secondary-button">Contraer todo</button></div></footer>
        {visibleChapters.length === 0 ? <div className="border-t border-border p-8 text-center"><MinusCircle size={24} className="mx-auto text-content-tertiary" aria-hidden="true" /><p className="mt-2 text-xs text-content-secondary">No hay capítulos o partidas que coincidan con los filtros.</p></div> : null}
      </section>

      <aside className="grid content-start gap-3" aria-label="Análisis complementario de costes">
        <section className="rounded-xl border border-border bg-surface p-3"><header><h2 className="text-[11px] font-black text-content">Previsto frente a real</h2><p className="mt-1 text-[9px] text-content-secondary">Comparativa por capítulo</p></header>{comparableKeys.length && chartMax > 0 ? <div className="mt-4 grid gap-3">{orderedChapters.map((chapter) => <div key={chapter.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2"><strong className="text-[9px] text-content-secondary">{chapter.code}</strong><div className="grid gap-1">{comparableKeys.map((key) => <span key={key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-1"><small className="truncate text-[8px] text-content-tertiary">{amountLabels[key]}</small><span className={`block h-1.5 rounded-full ${key === "budget" ? "bg-slate-300" : key === "forecast" ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.max(2, ((chapter[key] ?? 0) / chartMax) * 100)}%` }} /></span>)}</div></div>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-content-secondary">La comparativa requiere cobertura completa de al menos una serie.</p>}</section>

        <section className="rounded-xl border border-border bg-surface p-3"><header className="flex items-center justify-between gap-2"><h2 className="text-[11px] font-black text-content">Top desviaciones</h2><span className="text-[9px] font-bold text-content-secondary">{deviations.length}</span></header>{deviations.length ? <ol className="mt-3 divide-y divide-border">{deviations.map(({ item, value, percent }) => <li key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 py-2"><span className="text-[9px] font-bold text-content-secondary">{item.code}</span><strong className="truncate text-[9px] text-content">{item.description}</strong><span className={`text-right text-[9px] font-black tabular-nums ${value > 0 ? "text-danger" : "text-success"}`}>{value > 0 ? "+" : ""}{format(value)}{percent != null ? <small className="ml-1">({percent > 0 ? "+" : ""}{percent.toLocaleString(locale, { maximumFractionDigits: 1 })}%)</small> : null}</span></li>)}</ol> : <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-content-secondary">No hay desviaciones calculables con los datos recibidos.</p>}</section>

        <CostStateCard totals={totals} format={format} />
      </aside>
    </div>
  </div>;
}

function ChapterRows({ chapter, visibleItems, open, onToggle, format }: { chapter: WorkCostChapter; visibleItems: WorkCostItem[]; open: boolean; onToggle: () => void; format: (value: number) => string }) {
  return <>
    <tr className="bg-subtle/60 font-bold text-content"><td className="px-3 py-2"><button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Contraer" : "Expandir"} capítulo ${chapter.code}`} className="inline-flex min-h-8 items-center gap-2 rounded-md px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">{open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}{chapter.code}</button></td><td className="px-3 py-2"><span className="flex min-w-0 items-center gap-2"><span className="truncate">{chapter.description}</span><span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-soft px-1.5 py-0.5 text-[8px] text-brand-strong">{chapter.items.length}</span>{chapter.href ? <Link href={chapter.href} className="ml-auto text-[9px] text-brand-strong hover:underline">Abrir</Link> : null}</span></td><td className="px-3 py-2 text-right"><Amount value={chapter.budget} format={format} /></td><td className="px-3 py-2 text-right"><Amount value={chapter.committed} format={format} /></td><td className="px-3 py-2 text-right"><Amount value={chapter.accumulated} format={format} /></td><td className="px-3 py-2 text-right"><Deviation amounts={chapter} format={format} /></td><td className="px-3 py-2 text-right"><Percent value={deviationPercent(chapter)} positiveIsBad /></td><td className="px-3 py-2 text-right"><Percent value={marginPercent(chapter)} /></td></tr>
    {open ? visibleItems.map((item) => <tr key={item.id} className="text-content-secondary hover:bg-subtle/60"><td className="px-3 py-2 pl-9 tabular-nums">{item.code}</td><td className="px-3 py-2"><span className="flex min-w-0 items-center gap-2">{item.href ? <Link href={item.href} className="truncate font-semibold text-content hover:underline">{item.description}</Link> : <span className="truncate font-semibold text-content">{item.description}</span>}</span></td><td className="px-3 py-2 text-right"><Amount value={item.budget} format={format} /></td><td className="px-3 py-2 text-right"><Amount value={item.committed} format={format} /></td><td className="px-3 py-2 text-right"><Amount value={item.accumulated} format={format} /></td><td className="px-3 py-2 text-right"><Deviation amounts={item} format={format} /></td><td className="px-3 py-2 text-right"><Percent value={deviationPercent(item)} positiveIsBad /></td><td className="px-3 py-2 text-right"><Percent value={marginPercent(item)} /></td></tr>) : null}
  </>;
}

function CostStateCard({ totals, format }: { totals: WorkCostAmounts; format: (value: number) => string }) {
  if (totals.budget == null || totals.committed == null || totals.accumulated == null) return <section className="rounded-xl border border-border bg-surface p-3"><h2 className="text-[11px] font-black text-content">Estado del coste</h2><p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-content-secondary">La distribución requiere cobertura completa de presupuesto, comprometido y acumulado.</p></section>;
  const accumulated = Math.max(0, totals.accumulated);
  const committedPending = Math.max(0, totals.committed - totals.accumulated);
  const available = Math.max(0, totals.budget - totals.committed);
  const base = Math.max(totals.budget, accumulated + committedPending + available, 1);
  const rows = [{ label: "Acumulado", value: accumulated, tone: "bg-blue-500" }, { label: "Comprometido pendiente", value: committedPending, tone: "bg-emerald-500" }, { label: "Disponible", value: available, tone: "bg-slate-300" }];
  return <section className="rounded-xl border border-border bg-surface p-3"><h2 className="text-[11px] font-black text-content">Estado del coste</h2><div className="mt-3 grid gap-3">{rows.map((row) => <div key={row.label}><span className="flex items-center justify-between gap-2 text-[9px]"><span className="font-semibold text-content-secondary">{row.label}</span><strong className="tabular-nums text-content">{format(row.value)}</strong></span><span className="mt-1 block h-2 overflow-hidden rounded-full bg-subtle"><span className={`block h-full rounded-full ${row.tone}`} style={{ width: `${Math.min(100, row.value / base * 100)}%` }} /></span></div>)}</div></section>;
}
