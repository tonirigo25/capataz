"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileText,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
  UserRound,
} from "lucide-react";

export type ClientBudgetTone = "neutral" | "info" | "success" | "warning" | "danger";
export type ClientBudgetMetricKind = "issued" | "total_amount" | "acceptance_rate" | "pending_approval";

export type ClientBudgetMetric = {
  kind: ClientBudgetMetricKind;
  value: number | null;
  format?: "number" | "currency" | "percent";
  detail?: string | null;
  secondaryDetail?: string | null;
  tone?: ClientBudgetTone;
};

type ClientBudgetBase = {
  id: string;
  number?: string | null;
  title?: string | null;
  date?: string | null;
  amount?: number | null;
  status?: string | null;
  statusTone?: ClientBudgetTone;
  version?: string | null;
  validUntil?: string | null;
  validityLabel?: string | null;
  validityTone?: ClientBudgetTone;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  href?: string | null;
  moreHref?: string | null;
};

export type ClientScopedBudget = ClientBudgetBase & {
  scope: "client";
  workId?: never;
  workTitle?: never;
  workDetail?: never;
};

export type ClientWorkScopedBudget = ClientBudgetBase & {
  scope: "work";
  workId: string;
  workTitle: string;
  workDetail?: string | null;
};

export type ClientBudgetRecord = ClientScopedBudget | ClientWorkScopedBudget;

export type Client360BudgetsOverviewProps = {
  clientId: string;
  currency?: string;
  metrics: ClientBudgetMetric[];
  budgets: ClientBudgetRecord[];
  createHref?: string | null;
  exportHref?: string | null;
  duplicateHref?: string | null;
  moreFiltersHref?: string | null;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
};

type Filters = {
  query: string;
  status: string;
  workId: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: Filters = { query: "", status: "", workId: "", dateFrom: "", dateTo: "" };

const metricPresentation: Record<ClientBudgetMetricKind, { label: string; icon: typeof FileText; format: "number" | "currency" | "percent" }> = {
  issued: { label: "Presupuestos emitidos", icon: FileText, format: "number" },
  total_amount: { label: "Importe total", icon: CircleDollarSign, format: "currency" },
  acceptance_rate: { label: "Tasa de aceptación", icon: TrendingUp, format: "percent" },
  pending_approval: { label: "Pendientes de aprobación", icon: Clock3, format: "number" },
};

export function Client360BudgetsOverview({
  clientId,
  currency = "EUR",
  metrics,
  budgets,
  createHref,
  exportHref,
  duplicateHref,
  moreFiltersHref,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  className = "",
}: Client360BudgetsOverviewProps) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const safePageSizes = useMemo(() => normalizePageSizes(initialPageSize, pageSizeOptions), [initialPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(() => safePageSizes[0]);
  const money = useMemo(() => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }), [currency]);
  const statuses = useMemo(() => uniqueValues(budgets.map((budget) => budget.status)), [budgets]);
  const works = useMemo(() => {
    const entries = budgets.flatMap((budget) => budget.scope === "work" ? [[budget.workId, budget.workTitle] as const] : []);
    return Array.from(new Map(entries).entries()).sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [budgets]);
  const filteredBudgets = useMemo(() => {
    const query = normalize(filters.query);
    const from = parseDateStart(filters.dateFrom);
    const to = parseDateEnd(filters.dateTo);
    return budgets.filter((budget) => {
      const searchable = normalize([
        budget.number,
        budget.title,
        budget.status,
        budget.responsibleName,
        budget.scope === "work" ? budget.workTitle : null,
        budget.scope === "work" ? budget.workDetail : null,
      ].filter(Boolean).join(" "));
      const date = parseDate(budget.date);
      return (!query || searchable.includes(query))
        && (!filters.status || budget.status === filters.status)
        && (!filters.workId || (budget.scope === "work" && budget.workId === filters.workId))
        && (!from || (date != null && date >= from))
        && (!to || (date != null && date <= to));
    });
  }, [budgets, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredBudgets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageBudgets = filteredBudgets.slice(start, start + pageSize);
  const filtersActive = Object.values(filters).some(Boolean);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby={`client-budgets-${clientId}`}>
      <header className="sr-only"><h2 id={`client-budgets-${clientId}`}>Presupuestos de este cliente</h2><p>Listado limitado al cliente. Los presupuestos vinculados a una obra se identifican sin convertirse en el presupuesto económico interno de la obra ni en el listado global.</p></header>

      {metrics.length ? <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Indicadores de presupuestos recibidos para el cliente">{metrics.map((metric) => <BudgetMetricCard key={metric.kind} metric={metric} money={money} />)}</div> : <HonestEmpty icon={FileText} title="Sin indicadores de presupuestos" detail="No se han recibido totales autorizados para este cliente." compact />}

      <div className="rounded-xl border border-border bg-surface">
        <div className="grid gap-3 border-b border-border p-3 xl:grid-cols-[minmax(14rem,1fr)_auto] xl:items-center">
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-11 min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary"><Search size={15} aria-hidden="true" /><span className="sr-only">Buscar presupuesto</span><input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none" placeholder="Buscar presupuesto…" /></label>
            <FilterSelect label="Estado" value={filters.status} options={statuses.map((status) => [status, status] as const)} onChange={(value) => updateFilter("status", value)} />
            <FilterSelect label="Obra" value={filters.workId} options={works} onChange={(value) => updateFilter("workId", value)} />
            <DateRange filters={filters} updateFilter={updateFilter} />
            {moreFiltersHref ? <ActionLink href={moreFiltersHref} label="Filtros" icon={ListFilter} /> : null}
          </div>
          <div className="flex flex-wrap gap-2">{createHref ? <ActionLink href={createHref} label="Nuevo presupuesto" icon={Plus} primary /> : null}{exportHref ? <ActionLink href={exportHref} label="Exportar" icon={Download} /> : null}{duplicateHref ? <ActionLink href={duplicateHref} label="Duplicar" icon={Copy} /> : null}{filtersActive ? <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-[10px] font-bold text-content-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Limpiar</button> : null}</div>
        </div>

        <p className="sr-only" aria-live="polite">{filteredBudgets.length} presupuestos visibles de {budgets.length} recibidos.</p>
        {pageBudgets.length ? <><BudgetsDesktopTable budgets={pageBudgets} money={money} /><BudgetsMobileList budgets={pageBudgets} money={money} /><BudgetsPagination currentPage={currentPage} pageCount={pageCount} pageSize={pageSize} pageSizes={safePageSizes} start={start} visibleCount={pageBudgets.length} total={filteredBudgets.length} onPage={setPage} onPageSize={(value) => { setPageSize(value); setPage(1); }} /></> : <HonestEmpty icon={FileText} title="No hay presupuestos para estos filtros" detail="Cambia la búsqueda, el estado, la obra o el intervalo de fechas." />}
      </div>
    </section>
  );
}

function BudgetMetricCard({ metric, money }: { metric: ClientBudgetMetric; money: Intl.NumberFormat }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  return <article className="min-w-0 rounded-xl border border-border bg-surface p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-[10px] font-semibold text-content-secondary">{presentation.label}</h3><strong className="mt-2 block truncate text-2xl font-black tabular-nums text-content" title={formatMetric(metric, presentation.format, money)}>{formatMetric(metric, presentation.format, money)}</strong>{metric.detail ? <p className="mt-2 truncate text-[9px] text-content-secondary">{metric.detail}</p> : null}{metric.secondaryDetail ? <p className={`mt-1 truncate text-[9px] ${toneText(metric.tone)}`}>{metric.secondaryDetail}</p> : null}</div><span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneSurface(metric.tone)}`}><Icon size={18} aria-hidden="true" /></span></div></article>;
}

function BudgetsDesktopTable({ budgets, money }: { budgets: ClientBudgetRecord[]; money: Intl.NumberFormat }) {
  return <div className="hidden overflow-x-auto lg:block" tabIndex={0} role="region" aria-label="Tabla desplazable de presupuestos del cliente"><table className="w-full min-w-[62rem] border-collapse text-left text-[9px]"><thead className="bg-subtle text-content-secondary"><tr><TableHead>Presupuesto</TableHead><TableHead>Obra</TableHead><TableHead>Fecha</TableHead><TableHead align="right">Importe</TableHead><TableHead>Estado</TableHead><TableHead>Versión</TableHead><TableHead>Validez</TableHead><TableHead>Responsable</TableHead><TableHead align="right">Acciones</TableHead></tr></thead><tbody className="divide-y divide-border">{budgets.map((budget) => <tr key={budget.id} className="hover:bg-subtle/70"><td className="max-w-44 px-3 py-3"><strong className="block truncate text-brand-strong">{budget.href ? <Link href={budget.href} className="hover:underline">{budget.number ?? "Sin número"}</Link> : budget.number ?? "—"}</strong>{budget.title ? <span className="mt-1 block truncate text-[8px] text-content-secondary">{budget.title}</span> : null}</td><td className="max-w-44 px-3 py-3"><BudgetScope budget={budget} /></td><td className="whitespace-nowrap px-3 py-3 text-content-secondary">{formatDate(budget.date)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-content">{formatMoney(budget.amount, money)}</td><td className="px-3 py-3">{budget.status ? <StatusBadge label={budget.status} tone={budget.statusTone} /> : <MissingValue />}</td><td className="px-3 py-3 text-content-secondary">{budget.version ?? "—"}</td><td className="px-3 py-3"><Validity budget={budget} /></td><td className="px-3 py-3"><Responsible budget={budget} /></td><td className="px-3 py-3 text-right">{budget.moreHref ? <IconLink href={budget.moreHref} label={`Más acciones de ${budget.number ?? "presupuesto"}`} /> : <MissingValue />}</td></tr>)}</tbody></table></div>;
}

function BudgetsMobileList({ budgets, money }: { budgets: ClientBudgetRecord[]; money: Intl.NumberFormat }) {
  return <div className="divide-y divide-border lg:hidden" role="list">{budgets.map((budget) => <article key={budget.id} role="listitem" className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-bold text-content-tertiary">{budget.version ? `Versión ${budget.version}` : "Versión no informada"}</span><h3 className="mt-1 truncate text-sm font-bold text-brand-strong">{budget.href ? <Link href={budget.href} className="hover:underline">{budget.number ?? "Sin número"}</Link> : budget.number ?? "Sin número"}</h3>{budget.title ? <p className="mt-1 truncate text-[10px] text-content-secondary">{budget.title}</p> : null}</div><strong className="shrink-0 text-xs font-black tabular-nums text-content">{formatMoney(budget.amount, money)}</strong></div><div className="mt-3 flex flex-wrap gap-2">{budget.status ? <StatusBadge label={budget.status} tone={budget.statusTone} /> : null}<ScopeBadge budget={budget} /></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"><MobileFact label="Obra" value={budget.scope === "work" ? budget.workTitle : "Presupuesto de cliente"} /><MobileFact label="Fecha" value={formatDate(budget.date)} /><MobileFact label="Validez" value={budget.validityLabel ?? formatDate(budget.validUntil)} tone={budget.validityTone} /><MobileFact label="Responsable" value={budget.responsibleName ?? "No informado"} /></dl>{budget.moreHref ? <Link href={budget.moreHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border text-[9px] font-bold text-content hover:bg-subtle">Más acciones</Link> : null}</article>)}</div>;
}

function BudgetScope({ budget }: { budget: ClientBudgetRecord }) {
  if (budget.scope === "client") return <span><strong className="block text-content">Cliente</strong><span className="mt-1 block text-[8px] text-content-secondary">Sin obra vinculada</span></span>;
  return <span><strong className="block truncate text-content">{budget.workTitle}</strong>{budget.workDetail ? <span className="mt-1 block truncate text-[8px] text-content-secondary">{budget.workDetail}</span> : null}</span>;
}

function ScopeBadge({ budget }: { budget: ClientBudgetRecord }) {
  return budget.scope === "work" ? <span className="inline-flex min-h-6 items-center gap-1 rounded-md border border-warning/20 bg-warning/10 px-2 text-[8px] font-bold text-warning"><Building2 size={11} aria-hidden="true" /> Obra</span> : <span className="inline-flex min-h-6 items-center rounded-md border border-brand/20 bg-brand-soft px-2 text-[8px] font-bold text-brand-strong">Cliente</span>;
}

function Validity({ budget }: { budget: ClientBudgetRecord }) {
  if (!budget.validUntil && !budget.validityLabel) return <MissingValue />;
  return <span><span className="block whitespace-nowrap text-content">{formatDate(budget.validUntil)}</span>{budget.validityLabel ? <span className={`mt-1 inline-flex min-h-5 items-center rounded-md border px-1.5 text-[8px] font-bold ${toneBadge(budget.validityTone)}`}>{budget.validityLabel}</span> : null}</span>;
}

function Responsible({ budget }: { budget: ClientBudgetRecord }) {
  if (!budget.responsibleName) return <MissingValue />;
  return <span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{budget.responsibleName}</strong>{budget.responsibleRole ? <span className="block truncate text-[8px] text-content-secondary">{budget.responsibleRole}</span> : null}</span></span>;
}

function DateRange({ filters, updateFilter }: { filters: Filters; updateFilter: (key: keyof Filters, value: string) => void }) {
  return <fieldset className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"><legend className="sr-only">Intervalo de fechas</legend><CalendarDays size={14} className="text-content-secondary" aria-hidden="true" /><label><span className="sr-only">Fecha desde</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} className="w-[7.5rem] border-0 bg-transparent text-[9px] text-content outline-none" /></label><span className="text-content-tertiary">–</span><label><span className="sr-only">Fecha hasta</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} className="w-[7.5rem] border-0 bg-transparent text-[9px] text-content outline-none" /></label></fieldset>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><span className="font-semibold">{label}:</span><select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-36 border-0 bg-transparent font-bold text-content outline-none"><option value="">Todas</option>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function BudgetsPagination({ currentPage, pageCount, pageSize, pageSizes, start, visibleCount, total, onPage, onPageSize }: { currentPage: number; pageCount: number; pageSize: number; pageSizes: number[]; start: number; visibleCount: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = pageWindow(currentPage, pageCount);
  return <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 text-[10px] text-content-secondary sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {total ? start + 1 : 0} a {start + visibleCount} de {total} presupuestos recibidos</span><div className="flex flex-wrap items-center gap-2"><nav className="flex items-center gap-1" aria-label="Paginación de presupuestos"><PageButton label="Anterior" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>‹</PageButton>{pages.map((pageNumber) => <PageButton key={pageNumber} label={`Página ${pageNumber}`} active={pageNumber === currentPage} onClick={() => onPage(pageNumber)}>{pageNumber}</PageButton>)}<PageButton label="Siguiente" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>›</PageButton></nav>{pageSizes.length > 1 ? <label className="flex min-h-10 items-center gap-2"><span>Filas:</span><select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-surface px-2 font-bold text-content">{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label> : null}</div></footer>;
}

function ActionLink({ href, label, icon: Icon, primary = false }: { href: string; label: string; icon: typeof Plus; primary?: boolean }) { return <Link href={href} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}><Icon size={15} aria-hidden="true" />{label}</Link>; }
function IconLink({ href, label }: { href: string; label: string }) { return <Link href={href} aria-label={label} title={label} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><MoreHorizontal size={16} aria-hidden="true" /></Link>; }
function StatusBadge({ label, tone }: { label: string; tone?: ClientBudgetTone }) { return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>; }
function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) { return <th scope="col" className={`whitespace-nowrap px-3 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>; }
function MobileFact({ label, value, tone }: { label: string; value: string; tone?: ClientBudgetTone }) { return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className={`mt-1 truncate text-[10px] font-semibold ${toneText(tone)}`}>{value}</dd></div>; }
function PageButton({ children, label, disabled = false, active = false, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; active?: boolean; onClick: () => void }) { return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 font-bold disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-content hover:bg-subtle"}`}>{children}</button>; }
function MissingValue() { return <span className="text-content-tertiary">—</span>; }
function HonestEmpty({ icon: Icon, title, detail, compact = false }: { icon: typeof FileText; title: string; detail: string; compact?: boolean }) { return <div className={`grid place-content-center justify-items-center p-6 text-center ${compact ? "min-h-32" : "min-h-52"}`}><Icon size={22} className="text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-xs font-bold text-content">{title}</h3><p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p></div>; }

function normalizePageSizes(initial: number, options: number[]) { const safeInitial = Number.isInteger(initial) && initial > 0 ? initial : 10; return Array.from(new Set([safeInitial, ...options].filter((value) => Number.isInteger(value) && value > 0))); }
function pageWindow(current: number, total: number) { if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1); const start = Math.max(1, Math.min(current - 2, total - 4)); return Array.from({ length: 5 }, (_, index) => start + index); }
function uniqueValues(values: Array<string | null | undefined>) { return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).sort((left, right) => left.localeCompare(right, "es")); }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function finite(value: number | null | undefined): value is number { return typeof value === "number" && Number.isFinite(value); }
function formatMoney(value: number | null | undefined, money: Intl.NumberFormat) { return finite(value) ? money.format(value) : "—"; }
function formatPercent(value: number) { return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value / 100); }
function formatDate(value: string | null | undefined) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function formatMetric(metric: ClientBudgetMetric, fallback: "number" | "currency" | "percent", money: Intl.NumberFormat) { if (!finite(metric.value)) return "—"; const format = metric.format ?? fallback; if (format === "currency") return money.format(metric.value); if (format === "percent") return formatPercent(metric.value); return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(metric.value); }
function parseDate(value: string | null | undefined) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.getTime(); }
function parseDateStart(value: string) { return value ? new Date(`${value}T00:00:00`).getTime() : null; }
function parseDateEnd(value: string) { return value ? new Date(`${value}T23:59:59.999`).getTime() : null; }
function toneText(tone: ClientBudgetTone | undefined) { if (tone === "danger") return "text-danger"; if (tone === "warning") return "text-warning"; if (tone === "success") return "text-success"; if (tone === "info") return "text-brand-strong"; return "text-content-secondary"; }
function toneSurface(tone: ClientBudgetTone | undefined) { if (tone === "danger") return "bg-danger/10 text-danger"; if (tone === "warning") return "bg-warning/10 text-warning"; if (tone === "success") return "bg-success/10 text-success"; if (tone === "info") return "bg-brand-soft text-brand-strong"; return "bg-subtle text-content-secondary"; }
function toneBadge(tone: ClientBudgetTone | undefined) { if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger"; if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning"; if (tone === "success") return "border-success/20 bg-success/10 text-success"; if (tone === "info") return "border-brand/20 bg-brand-soft text-brand-strong"; return "border-border bg-subtle text-content-secondary"; }
