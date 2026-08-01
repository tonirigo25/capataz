"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Download,
  FileText,
  ListFilter,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  UserRound,
  WalletCards,
} from "lucide-react";

export type ClientInvoiceTone = "neutral" | "info" | "success" | "warning" | "danger";
export type ClientInvoiceMetricKind = "issued" | "pending_collection" | "overdue" | "average_collection_days";

export type ClientInvoiceMetric = {
  kind: ClientInvoiceMetricKind;
  value: number | null;
  supportingAmount?: number | null;
  detail?: string | null;
  comparison?: string | null;
  tone?: ClientInvoiceTone;
};

type ClientInvoiceBase = {
  id: string;
  number?: string | null;
  concept?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  amount?: number | null;
  collectedAmount?: number | null;
  pendingAmount?: number | null;
  status?: string | null;
  statusTone?: ClientInvoiceTone;
  paymentMethod?: string | null;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  href?: string | null;
  moreHref?: string | null;
};

export type ClientScopedInvoice = ClientInvoiceBase & {
  scope: "client";
  workId?: never;
  workTitle?: never;
};

export type ClientWorkScopedInvoice = ClientInvoiceBase & {
  scope: "work";
  workId: string;
  workTitle: string;
};

export type ClientInvoiceRecord = ClientScopedInvoice | ClientWorkScopedInvoice;

export type ClientInvoiceDatePreset = {
  id: string;
  label: string;
  from?: string | null;
  to?: string | null;
};

export type Client360InvoicesOverviewProps = {
  clientId: string;
  currency?: string;
  metrics: ClientInvoiceMetric[];
  invoices: ClientInvoiceRecord[];
  datePresets?: ClientInvoiceDatePreset[];
  createHref?: string | null;
  registerPaymentHref?: string | null;
  exportHref?: string | null;
  moreFiltersHref?: string | null;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
};

type Filters = { query: string; status: string; workId: string; datePresetId: string };
const emptyFilters: Filters = { query: "", status: "", workId: "", datePresetId: "" };

const metricPresentation: Record<ClientInvoiceMetricKind, { label: string; icon: typeof FileText; format: "number" | "days" }> = {
  issued: { label: "Facturas emitidas", icon: ReceiptText, format: "number" },
  pending_collection: { label: "Pendiente de cobro", icon: Clock3, format: "number" },
  overdue: { label: "Vencidas", icon: AlertCircle, format: "number" },
  average_collection_days: { label: "Plazo medio de cobro", icon: CalendarDays, format: "days" },
};

export function Client360InvoicesOverview({
  clientId,
  currency = "EUR",
  metrics,
  invoices,
  datePresets = [],
  createHref,
  registerPaymentHref,
  exportHref,
  moreFiltersHref,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  className = "",
}: Client360InvoicesOverviewProps) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const pageSizes = useMemo(() => normalizePageSizes(initialPageSize, pageSizeOptions), [initialPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(() => pageSizes[0]);
  const money = useMemo(() => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }), [currency]);
  const statuses = useMemo(() => uniqueValues(invoices.map((invoice) => invoice.status)), [invoices]);
  const works = useMemo(() => {
    const entries = invoices.flatMap((invoice) => invoice.scope === "work" ? [[invoice.workId, invoice.workTitle] as const] : []);
    return Array.from(new Map(entries).entries()).sort((left, right) => left[1].localeCompare(right[1], "es"));
  }, [invoices]);
  const activePreset = datePresets.find((preset) => preset.id === filters.datePresetId);
  const filteredInvoices = useMemo(() => {
    const query = normalize(filters.query);
    const from = parseDateStart(activePreset?.from);
    const to = parseDateEnd(activePreset?.to);
    return invoices.filter((invoice) => {
      const searchable = normalize([
        invoice.number,
        invoice.concept,
        invoice.status,
        invoice.paymentMethod,
        invoice.responsibleName,
        invoice.scope === "work" ? invoice.workTitle : null,
      ].filter(Boolean).join(" "));
      const issuedAt = parseDate(invoice.issuedAt);
      return (!query || searchable.includes(query))
        && (!filters.status || invoice.status === filters.status)
        && (!filters.workId || (invoice.scope === "work" && invoice.workId === filters.workId))
        && (!from || (issuedAt != null && issuedAt >= from))
        && (!to || (issuedAt != null && issuedAt <= to));
    });
  }, [activePreset, filters.query, filters.status, filters.workId, invoices]);
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visibleInvoices = filteredInvoices.slice(start, start + pageSize);
  const filtersActive = Object.values(filters).some(Boolean);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby={`client-invoices-${clientId}`}>
      <header className="sr-only">
        <h2 id={`client-invoices-${clientId}`}>Todas las facturas de este cliente</h2>
        <p>Vista global del cliente. Las facturas vinculadas a una obra se identifican, pero no se muestran certificaciones, retenciones ni fiscalidad no recibida.</p>
      </header>

      {metrics.length ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Indicadores de facturación recibidos para el cliente">
          {metrics.map((metric) => <InvoiceMetricCard key={metric.kind} metric={metric} money={money} />)}
        </div>
      ) : <HonestEmpty icon={ReceiptText} title="Sin indicadores de facturación" detail="No se han recibido totales autorizados para este cliente." compact />}

      <div className="rounded-xl border border-border bg-surface">
        <div className="grid gap-3 border-b border-border p-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 flex-wrap gap-2">
            <label className="flex min-h-11 min-w-[13rem] flex-1 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary">
              <Search size={15} aria-hidden="true" /><span className="sr-only">Buscar factura</span>
              <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none" placeholder="Buscar factura…" />
            </label>
            <FilterSelect label="Estado" allLabel="Todos" value={filters.status} options={statuses.map((status) => [status, status] as const)} onChange={(value) => updateFilter("status", value)} />
            <FilterSelect label="Obra" allLabel="Todas" value={filters.workId} options={works} onChange={(value) => updateFilter("workId", value)} />
            {datePresets.length ? <FilterSelect label="Fecha" allLabel="Todas" value={filters.datePresetId} options={datePresets.map((preset) => [preset.id, preset.label] as const)} onChange={(value) => updateFilter("datePresetId", value)} icon={CalendarDays} /> : null}
            {moreFiltersHref ? <ActionLink href={moreFiltersHref} label="Más filtros" icon={ListFilter} /> : null}
            {filtersActive ? <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className="inline-flex min-h-11 items-center rounded-lg px-3 text-[10px] font-bold text-brand-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Limpiar filtros</button> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {createHref ? <ActionLink href={createHref} label="Nueva factura" icon={Plus} primary /> : null}
            {registerPaymentHref ? <ActionLink href={registerPaymentHref} label="Registrar cobro" icon={WalletCards} /> : null}
            {exportHref ? <ActionLink href={exportHref} label="Exportar" icon={Download} /> : null}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">{filteredInvoices.length} facturas visibles de {invoices.length} recibidas.</p>
        {visibleInvoices.length ? (
          <>
            <InvoicesDesktopTable invoices={visibleInvoices} money={money} />
            <InvoicesMobileList invoices={visibleInvoices} money={money} />
            <InvoicesPagination currentPage={currentPage} pageCount={pageCount} pageSize={pageSize} pageSizes={pageSizes} start={start} visibleCount={visibleInvoices.length} total={filteredInvoices.length} onPage={setPage} onPageSize={(value) => { setPageSize(value); setPage(1); }} />
          </>
        ) : <HonestEmpty icon={ReceiptText} title="No hay facturas para estos filtros" detail="Cambia la búsqueda, el estado, la obra o el periodo." />}
      </div>
    </section>
  );
}

function InvoiceMetricCard({ metric, money }: { metric: ClientInvoiceMetric; money: Intl.NumberFormat }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  const value = finite(metric.value) ? (presentation.format === "days" ? `${metric.value} días` : new Intl.NumberFormat("es-ES").format(metric.value)) : "—";
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[10px] font-semibold text-content-secondary">{presentation.label}</h3>
          <strong className="mt-2 block truncate text-2xl font-black tabular-nums text-content" title={value}>{value}</strong>
          <p className="mt-2 truncate text-[9px] font-semibold text-content-secondary">{finite(metric.supportingAmount) ? formatMoney(metric.supportingAmount, money) : metric.detail ?? "Dato complementario no informado"}</p>
          {finite(metric.supportingAmount) && metric.detail ? <p className="mt-1 truncate text-[9px] text-content-secondary">{metric.detail}</p> : null}
          {metric.comparison ? <p className={`mt-1 truncate text-[9px] ${toneText(metric.tone)}`}>{metric.comparison}</p> : null}
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneSurface(metric.tone)}`}><Icon size={18} aria-hidden="true" /></span>
      </div>
    </article>
  );
}

function InvoicesDesktopTable({ invoices, money }: { invoices: ClientInvoiceRecord[]; money: Intl.NumberFormat }) {
  return (
    <div className="hidden overflow-x-auto lg:block" tabIndex={0} role="region" aria-label="Tabla desplazable de facturas del cliente">
      <table className="w-full min-w-[66rem] border-collapse text-left text-[9px]">
        <thead className="bg-subtle text-content-secondary"><tr><TableHead>Factura</TableHead><TableHead>Obra</TableHead><TableHead>Fecha emisión</TableHead><TableHead>Vencimiento</TableHead><TableHead align="right">Importe</TableHead><TableHead align="right">Pendiente</TableHead><TableHead>Estado</TableHead><TableHead>Método de pago</TableHead><TableHead>Responsable</TableHead><TableHead align="right">Acciones</TableHead></tr></thead>
        <tbody className="divide-y divide-border">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-subtle/70">
              <td className="max-w-44 px-3 py-3"><strong className="block truncate text-brand-strong">{invoice.href ? <Link href={invoice.href} className="hover:underline">{invoice.number ?? "Sin número"}</Link> : invoice.number ?? "—"}</strong>{invoice.concept ? <span className="mt-1 block truncate text-[8px] text-content-secondary">{invoice.concept}</span> : null}</td>
              <td className="max-w-44 px-3 py-3"><InvoiceScope invoice={invoice} /></td>
              <td className="whitespace-nowrap px-3 py-3 text-content-secondary">{formatDate(invoice.issuedAt)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-content-secondary">{formatDate(invoice.dueAt)}</td>
              <MoneyCell value={invoice.amount} money={money} strong />
              <MoneyCell value={invoice.pendingAmount} money={money} />
              <td className="px-3 py-3">{invoice.status ? <StatusBadge label={invoice.status} tone={invoice.statusTone} /> : <MissingValue />}</td>
              <td className="px-3 py-3 text-content-secondary">{invoice.paymentMethod ?? "—"}</td>
              <td className="px-3 py-3"><Responsible invoice={invoice} /></td>
              <td className="px-3 py-3 text-right">{invoice.moreHref ? <IconLink href={invoice.moreHref} label={`Más acciones de ${invoice.number ?? "factura"}`} /> : <MissingValue />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesMobileList({ invoices, money }: { invoices: ClientInvoiceRecord[]; money: Intl.NumberFormat }) {
  return (
    <div className="divide-y divide-border lg:hidden" role="list">
      {invoices.map((invoice) => (
        <article key={invoice.id} role="listitem" className="p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-brand-strong">{invoice.href ? <Link href={invoice.href} className="hover:underline">{invoice.number ?? "Sin número"}</Link> : invoice.number ?? "Sin número"}</h3>{invoice.concept ? <p className="mt-1 truncate text-[10px] text-content-secondary">{invoice.concept}</p> : null}</div><strong className="shrink-0 text-xs font-black tabular-nums text-content">{formatMoney(invoice.amount, money)}</strong></div>
          <div className="mt-3 flex flex-wrap gap-2">{invoice.status ? <StatusBadge label={invoice.status} tone={invoice.statusTone} /> : null}<ScopeBadge invoice={invoice} /></div>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"><MobileFact label="Obra" value={invoice.scope === "work" ? invoice.workTitle : "Sin obra vinculada"} /><MobileFact label="Emisión" value={formatDate(invoice.issuedAt)} /><MobileFact label="Vencimiento" value={formatDate(invoice.dueAt)} /><MobileFact label="Pendiente" value={formatMoney(invoice.pendingAmount, money)} /><MobileFact label="Método" value={invoice.paymentMethod ?? "No informado"} /><MobileFact label="Responsable" value={invoice.responsibleName ?? "No informado"} /></dl>
          {invoice.moreHref ? <Link href={invoice.moreHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border text-[9px] font-bold text-content hover:bg-subtle">Más acciones</Link> : null}
        </article>
      ))}
    </div>
  );
}

function InvoiceScope({ invoice }: { invoice: ClientInvoiceRecord }) {
  return invoice.scope === "work" ? <span><strong className="block truncate text-content">{invoice.workTitle}</strong><span className="mt-1 block text-[8px] text-content-secondary">Factura vinculada a obra</span></span> : <span><strong className="block text-content">Cliente</strong><span className="mt-1 block text-[8px] text-content-secondary">Sin obra vinculada</span></span>;
}

function ScopeBadge({ invoice }: { invoice: ClientInvoiceRecord }) {
  return invoice.scope === "work" ? <span className="inline-flex min-h-6 items-center rounded-md border border-info/20 bg-info/10 px-2 text-[8px] font-bold text-info">Obra</span> : <span className="inline-flex min-h-6 items-center rounded-md border border-brand/20 bg-brand-soft px-2 text-[8px] font-bold text-brand-strong">Cliente</span>;
}

function Responsible({ invoice }: { invoice: ClientInvoiceRecord }) {
  if (!invoice.responsibleName) return <MissingValue />;
  return <span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{invoice.responsibleName}</strong>{invoice.responsibleRole ? <span className="block truncate text-[8px] text-content-secondary">{invoice.responsibleRole}</span> : null}</span></span>;
}

function FilterSelect({ label, allLabel, value, options, onChange, icon: Icon }: { label: string; allLabel: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void; icon?: typeof CalendarDays }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary">{Icon ? <Icon size={14} aria-hidden="true" /> : null}<span className="font-semibold">{label}:</span><select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-36 border-0 bg-transparent font-bold text-content outline-none"><option value="">{allLabel}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function InvoicesPagination({ currentPage, pageCount, pageSize, pageSizes, start, visibleCount, total, onPage, onPageSize }: { currentPage: number; pageCount: number; pageSize: number; pageSizes: number[]; start: number; visibleCount: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = pageWindow(currentPage, pageCount);
  return <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 text-[10px] text-content-secondary sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {total ? start + 1 : 0} a {start + visibleCount} de {total} facturas recibidas</span><div className="flex flex-wrap items-center gap-2"><nav className="flex items-center gap-1" aria-label="Paginación de facturas"><PageButton label="Anterior" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>‹</PageButton>{pages.map((pageNumber) => <PageButton key={pageNumber} label={`Página ${pageNumber}`} active={pageNumber === currentPage} onClick={() => onPage(pageNumber)}>{pageNumber}</PageButton>)}<PageButton label="Siguiente" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>›</PageButton></nav>{pageSizes.length > 1 ? <label className="flex min-h-10 items-center gap-2"><span>Filas:</span><select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-surface px-2 font-bold text-content">{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label> : null}</div></footer>;
}

function ActionLink({ href, label, icon: Icon, primary = false }: { href: string; label: string; icon: typeof Plus; primary?: boolean }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}><Icon size={15} aria-hidden="true" />{label}</Link>;
}

function IconLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={label} title={label} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><MoreHorizontal size={16} aria-hidden="true" /></Link>;
}

function StatusBadge({ label, tone }: { label: string; tone?: ClientInvoiceTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>;
}

function MoneyCell({ value, money, strong = false }: { value?: number | null; money: Intl.NumberFormat; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${strong ? "font-bold text-content" : "text-content-secondary"}`}>{formatMoney(value, money)}</td>;
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[8px] font-bold uppercase tracking-wide text-content-tertiary">{label}</dt><dd className="mt-1 truncate text-[10px] font-semibold text-content">{value}</dd></div>;
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-3 font-bold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function MissingValue() { return <span className="text-content-tertiary">—</span>; }

function HonestEmpty({ icon: Icon, title, detail, compact = false }: { icon: typeof ReceiptText; title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-items-center rounded-xl border border-dashed border-border bg-surface text-center ${compact ? "min-h-28 p-4" : "min-h-44 p-6"}`}><span><Icon size={22} className="mx-auto text-content-tertiary" aria-hidden="true" /><strong className="mt-2 block text-xs text-content">{title}</strong><span className="mt-1 block text-[9px] text-content-secondary">{detail}</span></span></div>;
}

function PageButton({ children, label, active = false, disabled = false, onClick }: { children: React.ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-content hover:bg-subtle"}`}>{children}</button>;
}

function toneSurface(tone?: ClientInvoiceTone) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "danger") return "bg-danger/10 text-danger";
  if (tone === "info") return "bg-info/10 text-info";
  return "bg-brand-soft text-brand-strong";
}

function toneText(tone?: ClientInvoiceTone) {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "info") return "text-info";
  return "text-content-secondary";
}

function toneBadge(tone?: ClientInvoiceTone) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "danger") return "bg-danger/10 text-danger";
  if (tone === "info") return "bg-info/10 text-info";
  return "bg-subtle text-content-secondary";
}

function formatMoney(value: number | null | undefined, money: Intl.NumberFormat) { return finite(value) ? money.format(value) : "—"; }
function finite(value: number | null | undefined): value is number { return typeof value === "number" && Number.isFinite(value); }
function normalize(value: string) { return value.trim().toLocaleLowerCase("es"); }
function uniqueValues(values: Array<string | null | undefined>) { return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right, "es")); }

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseDateStart(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseDateEnd(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function normalizePageSizes(initial: number, options: number[]) {
  const validInitial = Number.isFinite(initial) && initial > 0 ? Math.floor(initial) : 10;
  return Array.from(new Set([validInitial, ...options.filter((size) => Number.isFinite(size) && size > 0).map(Math.floor)])).sort((left, right) => left - right);
}

function pageWindow(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
}
