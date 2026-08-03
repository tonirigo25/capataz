"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  WalletCards,
} from "lucide-react";
import styles from "./client-360-invoices-overview.module.css";

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
    <section className={`${styles.workspace} ${className}`} aria-labelledby={`client-invoices-${clientId}`}>
      <header className={styles.headingRow}>
        <div className={styles.heading}>
          <h2 id={`client-invoices-${clientId}`}>Todas las facturas</h2>
          <p>Consulta y gestiona el estado de todas las facturas del cliente.</p>
        </div>
        <div className={styles.headingActions} aria-label="Acciones de facturación">
          {createHref ? <ActionLink href={createHref} label="Nueva factura" icon={Plus} primary /> : null}
          {registerPaymentHref ? <ActionLink href={registerPaymentHref} label="Registrar cobro" icon={WalletCards} /> : null}
          {exportHref ? <ActionLink href={exportHref} label="Exportar" icon={Download} /> : null}
        </div>
      </header>

      {metrics.length ? (
        <div className={styles.metrics} aria-label="Indicadores de facturación del cliente">
          {metrics.map((metric) => <InvoiceMetricCard key={metric.kind} metric={metric} money={money} />)}
        </div>
      ) : <HonestEmpty icon={ReceiptText} title="Sin indicadores de facturación" detail="No se han recibido totales autorizados para este cliente." compact />}

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchControl}>
            <Search size={14} aria-hidden="true" />
            <span className="sr-only">Buscar factura</span>
            <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Buscar factura…" />
          </label>
          <FilterSelect label="Estado" allLabel="Todos" value={filters.status} options={statuses.map((status) => [status, status] as const)} onChange={(value) => updateFilter("status", value)} />
          <FilterSelect label="Obra" allLabel="Todas" value={filters.workId} options={works} onChange={(value) => updateFilter("workId", value)} />
          {datePresets.length ? <FilterSelect label="Fecha" allLabel="Todas" value={filters.datePresetId} options={datePresets.map((preset) => [preset.id, preset.label] as const)} onChange={(value) => updateFilter("datePresetId", value)} icon={CalendarDays} /> : null}
          {moreFiltersHref ? <ActionLink href={moreFiltersHref} label="Más filtros" icon={ListFilter} /> : null}
          {filtersActive ? <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className={styles.clearButton}>Limpiar</button> : null}
          <span className={styles.resultCount}>{filteredInvoices.length} de {invoices.length}</span>
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
    <article className={styles.metric} data-tone={metric.tone ?? "neutral"}>
      <span className={styles.metricIcon}><Icon size={18} aria-hidden="true" /></span>
      <div className={styles.metricCopy}>
        <h3>{presentation.label}</h3>
        <strong title={value}>{value}</strong>
        <p>{finite(metric.supportingAmount) ? formatMoney(metric.supportingAmount, money) : metric.detail ?? "Dato no informado"}</p>
        {finite(metric.supportingAmount) && metric.detail ? <small>{metric.detail}</small> : null}
        {metric.comparison ? <small data-comparison="true">{metric.comparison}</small> : null}
      </div>
    </article>
  );
}

function InvoicesDesktopTable({ invoices, money }: { invoices: ClientInvoiceRecord[]; money: Intl.NumberFormat }) {
  return (
    <div className={styles.tableRegion} tabIndex={0} role="region" aria-label="Tabla desplazable de facturas del cliente">
      <table className={styles.table}>
        <thead><tr><TableHead>Factura</TableHead><TableHead>Obra</TableHead><TableHead>Emisión</TableHead><TableHead>Vencimiento</TableHead><TableHead align="right">Importe</TableHead><TableHead>Estado</TableHead><TableHead>Método de pago</TableHead><TableHead align="right">Acciones</TableHead></tr></thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className={styles.invoiceCell}><strong>{invoice.href ? <Link href={invoice.href}>{invoice.number ?? "Sin número"}</Link> : invoice.number ?? "—"}</strong>{invoice.concept ? <span title={invoice.concept}>{invoice.concept}</span> : null}</td>
              <td className={styles.scopeCell}><InvoiceScope invoice={invoice} /></td>
              <td className={styles.dateCell}>{formatDate(invoice.issuedAt)}</td>
              <td className={styles.dateCell}>{formatDate(invoice.dueAt)}</td>
              <MoneyCell value={invoice.amount} money={money} strong />
              <td>{invoice.status ? <StatusBadge label={invoice.status} tone={invoice.statusTone} /> : <MissingValue />}</td>
              <td className={styles.mutedCell}>{invoice.paymentMethod ?? "—"}</td>
              <td className={styles.actionCell}>{invoice.moreHref ? <IconLink href={invoice.moreHref} label={`Abrir ${invoice.number ?? "factura"}`} /> : <MissingValue />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesMobileList({ invoices, money }: { invoices: ClientInvoiceRecord[]; money: Intl.NumberFormat }) {
  return (
    <div className={styles.mobileList} role="list">
      {invoices.map((invoice) => (
        <article key={invoice.id} role="listitem" className={styles.mobileCard}>
          <div className={styles.mobileCardHeading}>
            <div><h3>{invoice.href ? <Link href={invoice.href}>{invoice.number ?? "Sin número"}</Link> : invoice.number ?? "Sin número"}</h3>{invoice.concept ? <p>{invoice.concept}</p> : null}</div>
            <strong>{formatMoney(invoice.amount, money)}</strong>
          </div>
          <div className={styles.mobileBadges}>{invoice.status ? <StatusBadge label={invoice.status} tone={invoice.statusTone} /> : null}<ScopeBadge invoice={invoice} /></div>
          <dl className={styles.mobileFacts}><MobileFact label="Obra" value={invoice.scope === "work" ? invoice.workTitle : "Sin obra vinculada"} /><MobileFact label="Emisión" value={formatDate(invoice.issuedAt)} /><MobileFact label="Vencimiento" value={formatDate(invoice.dueAt)} /><MobileFact label="Pendiente" value={formatMoney(invoice.pendingAmount, money)} /><MobileFact label="Método" value={invoice.paymentMethod ?? "No informado"} /></dl>
          {invoice.moreHref ? <Link href={invoice.moreHref} className={styles.mobileAction}>Abrir factura</Link> : null}
        </article>
      ))}
    </div>
  );
}

function InvoiceScope({ invoice }: { invoice: ClientInvoiceRecord }) {
  return invoice.scope === "work" ? <span><strong title={invoice.workTitle}>{invoice.workTitle}</strong><small>Vinculada a obra</small></span> : <span><strong>Cliente</strong><small>Sin obra vinculada</small></span>;
}

function ScopeBadge({ invoice }: { invoice: ClientInvoiceRecord }) {
  return <span className={styles.scopeBadge} data-scope={invoice.scope}>{invoice.scope === "work" ? "Obra" : "Cliente"}</span>;
}

function FilterSelect({ label, allLabel, value, options, onChange, icon: Icon }: { label: string; allLabel: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void; icon?: typeof CalendarDays }) {
  return <label className={styles.filterControl}>{Icon ? <Icon size={13} aria-hidden="true" /> : null}<span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Filtrar por ${label.toLocaleLowerCase("es")}`}><option value="">{allLabel}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function InvoicesPagination({ currentPage, pageCount, pageSize, pageSizes, start, visibleCount, total, onPage, onPageSize }: { currentPage: number; pageCount: number; pageSize: number; pageSizes: number[]; start: number; visibleCount: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = pageWindow(currentPage, pageCount);
  return <footer className={styles.pagination}><span>Mostrando {total ? start + 1 : 0}–{start + visibleCount} de {total}</span><div><nav aria-label="Paginación de facturas"><PageButton label="Anterior" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>‹</PageButton>{pages.map((pageNumber) => <PageButton key={pageNumber} label={`Página ${pageNumber}`} active={pageNumber === currentPage} onClick={() => onPage(pageNumber)}>{pageNumber}</PageButton>)}<PageButton label="Siguiente" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>›</PageButton></nav>{pageSizes.length > 1 ? <label><span>Filas</span><select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label> : null}</div></footer>;
}

function ActionLink({ href, label, icon: Icon, primary = false }: { href: string; label: string; icon: typeof Plus; primary?: boolean }) {
  return <Link href={href} className={styles.actionLink} data-primary={primary ? "true" : "false"}><Icon size={14} aria-hidden="true" />{label}</Link>;
}

function IconLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={label} title={label} className={styles.iconLink}><MoreHorizontal size={15} aria-hidden="true" /></Link>;
}

function StatusBadge({ label, tone }: { label: string; tone?: ClientInvoiceTone }) {
  return <span className={styles.statusBadge} data-tone={tone ?? "neutral"}>{label}</span>;
}

function MoneyCell({ value, money, strong = false }: { value?: number | null; money: Intl.NumberFormat; strong?: boolean }) {
  return <td className={styles.moneyCell} data-strong={strong ? "true" : "false"}>{formatMoney(value, money)}</td>;
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function TableHead({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return <th scope="col" data-align={align}>{children}</th>;
}

function MissingValue() { return <span className={styles.missing}>—</span>; }

function HonestEmpty({ icon: Icon, title, detail, compact = false }: { icon: typeof ReceiptText; title: string; detail: string; compact?: boolean }) {
  return <div className={styles.empty} data-compact={compact ? "true" : "false"}><span><Icon size={22} aria-hidden="true" /><strong>{title}</strong><small>{detail}</small></span></div>;
}

function PageButton({ children, label, active = false, disabled = false, onClick }: { children: ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={styles.pageButton} data-active={active ? "true" : "false"}>{children}</button>;
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
