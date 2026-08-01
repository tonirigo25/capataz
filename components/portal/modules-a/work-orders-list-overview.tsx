"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  UserRound,
  Wrench,
} from "lucide-react";

export type WorkOrderTone = "neutral" | "info" | "success" | "warning" | "danger";
export type WorkOrderMetricKind = "total" | "amount" | "overdue" | "over_budget" | "pending_confirmation";
export type WorkOrderValueFormat = "count" | "currency" | "number";

export type WorkOrderMetric = {
  kind: WorkOrderMetricKind;
  value: number | null;
  format?: WorkOrderValueFormat;
  suffix?: string | null;
  detail?: string | null;
  tone?: WorkOrderTone;
};

export type WorkOrderRecord = {
  id: string;
  number?: string | null;
  kind?: "purchase" | "work" | null;
  type?: string | null;
  typeTone?: WorkOrderTone;
  supplierName?: string | null;
  workTitle?: string | null;
  chapter?: string | null;
  amount?: number | null;
  status?: string | null;
  statusTone?: WorkOrderTone;
  orderedAt?: string | null;
  dueAt?: string | null;
  dueTone?: WorkOrderTone;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  viewHref?: string | null;
  editHref?: string | null;
  moreHref?: string | null;
};

export type WorkOrdersListOverviewProps = {
  workId: string;
  currency?: string;
  metrics: WorkOrderMetric[];
  orders: WorkOrderRecord[];
  createHref?: string | null;
  exportHref?: string | null;
  moreFiltersHref?: string | null;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
};

type Filters = {
  query: string;
  type: string;
  status: string;
  responsible: string;
};

const emptyFilters: Filters = { query: "", type: "", status: "", responsible: "" };

const metricPresentation: Record<WorkOrderMetricKind, { label: string; format: WorkOrderValueFormat }> = {
  total: { label: "Total órdenes", format: "count" },
  amount: { label: "Importe total", format: "currency" },
  overdue: { label: "Órdenes vencidas", format: "count" },
  over_budget: { label: "Órdenes sobre presupuesto", format: "count" },
  pending_confirmation: { label: "Pendientes de confirmar", format: "count" },
};

export function WorkOrdersListOverview({
  workId,
  currency = "EUR",
  metrics,
  orders,
  createHref,
  exportHref,
  moreFiltersHref,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  className = "",
}: WorkOrdersListOverviewProps) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const safePageSizes = useMemo(() => normalizePageSizes(initialPageSize, pageSizeOptions), [initialPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(() => safePageSizes[0]);
  const money = useMemo(() => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }), [currency]);
  const options = useMemo(() => ({
    types: uniqueValues(orders.map((order) => order.type)),
    statuses: uniqueValues(orders.map((order) => order.status)),
    responsibles: uniqueValues(orders.map((order) => order.responsibleName)),
  }), [orders]);
  const filteredOrders = useMemo(() => {
    const query = normalize(filters.query);
    return orders.filter((order) => {
      const searchable = normalize([
        order.number,
        order.type,
        order.supplierName,
        order.workTitle,
        order.chapter,
        order.status,
        order.responsibleName,
      ].filter(Boolean).join(" "));
      return (!query || searchable.includes(query))
        && (!filters.type || order.type === filters.type)
        && (!filters.status || order.status === filters.status)
        && (!filters.responsible || order.responsibleName === filters.responsible);
    });
  }, [filters, orders]);
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageOrders = filteredOrders.slice(start, start + pageSize);
  const filtersActive = Object.values(filters).some(Boolean);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby={`work-orders-${workId}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id={`work-orders-${workId}`} className="text-xl font-black text-content">Todas las órdenes</h2>
          <p className="mt-1 text-xs leading-5 text-content-secondary">Órdenes recibidas y vinculadas exclusivamente a esta obra.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {createHref ? <ActionLink href={createHref} label="Nueva orden" icon={Plus} primary /> : null}
          {exportHref ? <ActionLink href={exportHref} label="Exportar" icon={Download} /> : null}
        </div>
      </header>

      {metrics.length ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores recibidos de órdenes de esta obra">
          {metrics.map((metric) => <OrderMetricCard key={metric.kind} metric={metric} money={money} />)}
        </div>
      ) : <HonestEmpty title="Sin indicadores de órdenes" detail="No se han recibido totales autorizados para esta obra." compact />}

      <div className="rounded-xl border border-border bg-surface">
        <div className="grid gap-3 border-b border-border p-3 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar orden</span>
            <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none" placeholder="Buscar por número, proveedor, capítulo…" />
          </label>
          <div className="flex flex-wrap gap-2">
            <FilterSelect label="Tipo" value={filters.type} options={options.types} onChange={(value) => updateFilter("type", value)} />
            <FilterSelect label="Estado" value={filters.status} options={options.statuses} onChange={(value) => updateFilter("status", value)} />
            <FilterSelect label="Responsable" value={filters.responsible} options={options.responsibles} onChange={(value) => updateFilter("responsible", value)} />
            {moreFiltersHref ? <ActionLink href={moreFiltersHref} label="Más filtros" icon={SlidersHorizontal} /> : null}
            {filtersActive ? <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-[10px] font-bold text-content-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Limpiar</button> : null}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">{filteredOrders.length} órdenes visibles de {orders.length} recibidas.</p>
        {pageOrders.length ? (
          <>
            <OrdersDesktopTable orders={pageOrders} money={money} />
            <OrdersMobileList orders={pageOrders} money={money} />
            <OrdersPagination
              currentPage={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              pageSizes={safePageSizes}
              start={start}
              visibleCount={pageOrders.length}
              total={filteredOrders.length}
              onPage={setPage}
              onPageSize={(value) => { setPageSize(value); setPage(1); }}
            />
          </>
        ) : <HonestEmpty title="No hay órdenes autorizadas" detail={filtersActive ? "Cambia los filtros para revisar los registros recibidos." : "No se han recibido órdenes persistidas para esta obra. Los gastos, facturas y materiales no se presentan como órdenes."} />}
      </div>
    </section>
  );
}

function OrderMetricCard({ metric, money }: { metric: WorkOrderMetric; money: Intl.NumberFormat }) {
  const presentation = metricPresentation[metric.kind];
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3">
      <h3 className="truncate text-[10px] font-semibold text-content-secondary">{presentation.label}</h3>
      <strong className={`mt-2 block truncate text-xl font-black tabular-nums ${toneText(metric.tone)}`} title={formatMetric(metric, presentation.format, money)}>{formatMetric(metric, presentation.format, money)}</strong>
      <p className={`mt-2 min-h-4 truncate text-[9px] ${toneText(metric.tone, true)}`} title={metric.detail ?? undefined}>{metric.detail ?? "Sin comparación informada"}</p>
    </article>
  );
}

function OrdersDesktopTable({ orders, money }: { orders: WorkOrderRecord[]; money: Intl.NumberFormat }) {
  return (
    <div className="hidden overflow-x-auto lg:block" tabIndex={0} role="region" aria-label="Tabla desplazable de órdenes de la obra">
      <table className="w-full min-w-[68rem] border-collapse text-left text-[9px]">
        <thead className="bg-subtle text-content-secondary"><tr><TableHead>N.º</TableHead><TableHead>Tipo</TableHead><TableHead>Proveedor</TableHead><TableHead>Obra</TableHead><TableHead>Capítulo</TableHead><TableHead align="right">Importe</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Vencimiento</TableHead><TableHead>Responsable</TableHead><TableHead align="right">Acciones</TableHead></tr></thead>
        <tbody className="divide-y divide-border">{orders.map((order) => <tr key={order.id} className="hover:bg-subtle/70"><td className="whitespace-nowrap px-3 py-3 font-bold text-content">{order.number ?? "—"}</td><td className="px-3 py-3">{order.type ? <OrderType order={order} /> : <MissingValue />}</td><td className="max-w-40 px-3 py-3"><span className="block truncate text-content" title={order.supplierName ?? undefined}>{order.supplierName ?? "—"}</span></td><td className="max-w-36 px-3 py-3"><span className="block truncate text-content-secondary" title={order.workTitle ?? undefined}>{order.workTitle ?? "—"}</span></td><td className="max-w-36 px-3 py-3"><span className="block truncate text-content-secondary" title={order.chapter ?? undefined}>{order.chapter ?? "—"}</span></td><MoneyCell value={order.amount} money={money} /><td className="px-3 py-3">{order.status ? <StatusBadge label={order.status} tone={order.statusTone} /> : <MissingValue />}</td><td className="whitespace-nowrap px-3 py-3 text-content-secondary">{formatDate(order.orderedAt)}</td><td className={`whitespace-nowrap px-3 py-3 font-semibold ${toneText(order.dueTone)}`}>{formatDate(order.dueAt)}</td><td className="px-3 py-3"><Responsible order={order} /></td><td className="px-3 py-3"><RowActions order={order} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function OrdersMobileList({ orders, money }: { orders: WorkOrderRecord[]; money: Intl.NumberFormat }) {
  return (
    <div className="divide-y divide-border lg:hidden" role="list">{orders.map((order) => <article key={order.id} role="listitem" className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-bold text-content-tertiary">{order.number ?? "Sin número"}</span><h3 className="mt-1 truncate text-sm font-bold text-content">{order.supplierName ?? order.type ?? "Orden sin proveedor"}</h3>{order.chapter ? <p className="mt-1 truncate text-[10px] text-content-secondary">{order.chapter}</p> : null}</div><strong className="shrink-0 text-xs font-black tabular-nums text-content">{formatMoney(order.amount, money)}</strong></div><div className="mt-3 flex flex-wrap gap-2">{order.type ? <OrderType order={order} /> : null}{order.status ? <StatusBadge label={order.status} tone={order.statusTone} /> : null}</div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"><MobileFact label="Obra" value={order.workTitle ?? "No informada"} /><MobileFact label="Fecha" value={formatDate(order.orderedAt)} /><MobileFact label="Vencimiento" value={formatDate(order.dueAt)} tone={order.dueTone} /><MobileFact label="Responsable" value={order.responsibleName ?? "No informado"} /></dl>{order.viewHref || order.editHref || order.moreHref ? <div className="mt-3"><RowActions order={order} mobile /></div> : null}</article>)}</div>
  );
}

function OrdersPagination({ currentPage, pageCount, pageSize, pageSizes, start, visibleCount, total, onPage, onPageSize }: { currentPage: number; pageCount: number; pageSize: number; pageSizes: number[]; start: number; visibleCount: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = pageWindow(currentPage, pageCount);
  return (
    <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 text-[10px] text-content-secondary sm:flex-row sm:items-center sm:justify-between">
      <span>Mostrando {total ? start + 1 : 0} a {start + visibleCount} de {total} órdenes recibidas</span>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizes.length > 1 ? <label className="flex min-h-10 items-center gap-2"><span>Filas:</span><select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-surface px-2 font-bold text-content">{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label> : null}
        <nav className="flex items-center gap-1" aria-label="Paginación de órdenes"><PageButton label="Anterior" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>‹</PageButton>{pages.map((pageNumber) => <PageButton key={pageNumber} label={`Página ${pageNumber}`} active={pageNumber === currentPage} onClick={() => onPage(pageNumber)}>{pageNumber}</PageButton>)}<PageButton label="Siguiente" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>›</PageButton></nav>
      </div>
    </footer>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><span className="font-semibold">{label}:</span><select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-36 border-0 bg-transparent font-bold text-content outline-none"><option value="">Todos</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ActionLink({ href, label, icon: Icon, primary = false }: { href: string; label: string; icon: typeof Plus; primary?: boolean }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}><Icon size={15} aria-hidden="true" />{label}</Link>;
}

function RowActions({ order, mobile = false }: { order: WorkOrderRecord; mobile?: boolean }) {
  if (!order.viewHref && !order.editHref && !order.moreHref) return <MissingValue />;
  const shared = mobile ? "min-h-11 flex-1" : "h-9 w-9";
  return <div className={`flex items-center ${mobile ? "gap-2" : "justify-end gap-1"}`}>{order.viewHref ? <IconLink href={order.viewHref} label={`Ver ${order.number ?? "orden"}`} icon={Eye} className={shared} /> : null}{order.editHref ? <IconLink href={order.editHref} label={`Editar ${order.number ?? "orden"}`} icon={Pencil} className={shared} /> : null}{order.moreHref ? <IconLink href={order.moreHref} label={`Más acciones de ${order.number ?? "la orden"}`} icon={MoreHorizontal} className={shared} /> : null}</div>;
}

function IconLink({ href, label, icon: Icon, className }: { href: string; label: string; icon: typeof Eye; className: string }) {
  return <Link href={href} aria-label={label} title={label} className={`inline-flex items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}><Icon size={15} aria-hidden="true" /><span className="sr-only">{label}</span></Link>;
}

function OrderType({ order }: { order: WorkOrderRecord }) {
  const Icon = order.kind === "purchase" ? ShoppingCart : order.kind === "work" ? Wrench : ClipboardList;
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(order.typeTone)}`}><Icon size={12} aria-hidden="true" />{order.type}</span>;
}

function Responsible({ order }: { order: WorkOrderRecord }) {
  if (!order.responsibleName) return <MissingValue />;
  return <span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{order.responsibleName}</strong>{order.responsibleRole ? <span className="block truncate text-[8px] text-content-secondary">{order.responsibleRole}</span> : null}</span></span>;
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function MoneyCell({ value, money }: { value?: number | null; money: Intl.NumberFormat }) {
  return <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-content">{formatMoney(value, money)}</td>;
}

function StatusBadge({ label, tone }: { label: string; tone?: WorkOrderTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>;
}

function MobileFact({ label, value, tone }: { label: string; value: string; tone?: WorkOrderTone }) {
  return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className={`mt-1 truncate text-[10px] font-semibold ${toneText(tone)}`}>{value}</dd></div>;
}

function PageButton({ children, label, disabled = false, active = false, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; active?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 font-bold disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-content hover:bg-subtle"}`}>{children}</button>;
}

function MissingValue() {
  return <span className="text-content-tertiary">—</span>;
}

function HonestEmpty({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-content-center justify-items-center p-6 text-center ${compact ? "min-h-32" : "min-h-52"}`}><AlertTriangle size={22} className="text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-xs font-bold text-content">{title}</h3><p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p></div>;
}

function normalizePageSizes(initial: number, options: number[]) {
  const safeInitial = Number.isInteger(initial) && initial > 0 ? initial : 10;
  const values = [safeInitial, ...options].filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(values));
}

function pageWindow(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).sort((left, right) => left.localeCompare(right, "es"));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatMetric(metric: WorkOrderMetric, fallbackFormat: WorkOrderValueFormat, money: Intl.NumberFormat) {
  if (!finite(metric.value)) return "—";
  const format = metric.format ?? fallbackFormat;
  const value = format === "currency" ? money.format(metric.value) : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(metric.value);
  return metric.suffix ? `${value} ${metric.suffix}` : value;
}

function formatMoney(value: number | null | undefined, money: Intl.NumberFormat) {
  return finite(value) ? money.format(value) : "—";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function toneText(tone: WorkOrderTone | undefined, secondary = false) {
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "success") return "text-success";
  if (tone === "info") return "text-brand-strong";
  return secondary ? "text-content-secondary" : "text-content";
}

function toneBadge(tone: WorkOrderTone | undefined) {
  if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger";
  if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning";
  if (tone === "success") return "border-success/20 bg-success/10 text-success";
  if (tone === "info") return "border-brand/20 bg-brand-soft text-brand-strong";
  return "border-border bg-subtle text-content-secondary";
}
