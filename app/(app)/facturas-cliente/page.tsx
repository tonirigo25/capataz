import type { Prisma } from "@prisma/client";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import styles from "./client-invoices.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type Query = {
  buscar?: string;
  estado?: string;
  obra?: string;
  periodo?: string;
  pagina?: string;
};

type LiveInvoice = Awaited<ReturnType<typeof loadInvoices>>[number] & {
  liveStatus: string;
};

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("sales.invoices.view");
  const [workIds, clientIds, createDecision, exportDecision] = await Promise.all([
    resolveScopedEntityIds(auth, "sales.invoices.view", "Work"),
    resolveScopedEntityIds(auth, "sales.invoices.view", "Client"),
    resolveAuthorization(auth, "sales.invoices.create"),
    resolveAuthorization(auth, "reports.export"),
  ]);
  const invoices = await loadInvoices(auth.companyId, relationScope(auth.scope, workIds, clientIds));
  const withStatus: LiveInvoice[] = invoices.map((invoice) => ({
    ...invoice,
    liveStatus:
      invoice.estado === "borrador"
        ? "borrador"
        : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento),
  }));
  const search = normalize(query.buscar ?? "");
  const now = new Date();
  const visible = withStatus.filter((invoice) => {
    const statusMatch =
      !query.estado ||
      query.estado === "todas" ||
      invoice.estado === query.estado ||
      invoice.liveStatus === query.estado;
    const workMatch = !query.obra || invoice.obraId === query.obra;
    const periodMatch = matchesPeriod(invoice.fechaEmision, query.periodo, now);
    const textMatch =
      !search ||
      normalize(
        `${invoice.numero} ${invoice.concepto} ${invoice.client.nombre} ${invoice.work?.titulo ?? ""}`,
      ).includes(search);
    return statusMatch && workMatch && periodMatch && textMatch;
  });
  const requestedPage = Math.max(1, Number(query.pagina) || 1);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const overdue = withStatus.filter((invoice) => invoice.liveStatus === "vencida");
  const paidInvoices = withStatus.filter((invoice) => invoice.pendiente <= 0 && invoice.payments.length);
  const averageCollectionDays = paidInvoices.length
    ? Math.round(
        paidInvoices.reduce((total, invoice) => {
          const latest = invoice.payments.reduce(
            (date, payment) => (payment.fecha > date ? payment.fecha : date),
            invoice.payments[0].fecha,
          );
          return total + Math.max(0, Math.round((latest.getTime() - invoice.fechaEmision.getTime()) / 86_400_000));
        }, 0) / paidInvoices.length,
      )
    : null;
  const works = Array.from(
    new Map(
      withStatus
        .filter((invoice) => invoice.work)
        .map((invoice) => [invoice.work!.id, invoice.work!]),
    ).values(),
  ).sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  const canCreate = createDecision.allowed;
  const canExport = exportDecision.allowed && exportDecision.scope === "COMPANY";

  return (
    <main className={`screen ${styles.workspace}`}>
      <InternalBreadcrumbs items={[{ label: "Clientes", href: "/clientes" }, { label: "Facturas" }]} />
      <header className={styles.pageHeading}>
        <div>
          <h1>Facturas de clientes</h1>
          <p>Emisión, vencimientos y cobros registrados de tu cartera.</p>
        </div>
        <div className={styles.actions}>
          {canExport ? (
            <Link href="/inteligencia/export?tipo=pending-invoices" className="secondary-button">
              <Download size={16} aria-hidden="true" /> Exportar pendientes
            </Link>
          ) : null}
          {canCreate ? (
            <Link href="/gestion?tipo=factura&returnTo=/facturas-cliente" className="primary-button">
              <Plus size={16} aria-hidden="true" /> Nueva factura
            </Link>
          ) : null}
        </div>
      </header>

      <section className={styles.metrics} aria-label="Resumen de facturación de clientes">
        <Metric icon={FileText} label="Emitidas" value={String(withStatus.length)} detail={formatCurrency(sum(withStatus, "total"))} />
        <Metric icon={WalletCards} tone="info" label="Cobrado" value={formatCurrency(sum(withStatus, "pagado"))} detail="Importe registrado" />
        <Metric icon={CalendarClock} tone="warning" label="Pendiente de cobro" value={formatCurrency(sum(withStatus, "pendiente"))} detail={`${withStatus.filter((invoice) => invoice.pendiente > 0).length} facturas abiertas`} />
        <Metric icon={CircleAlert} tone="danger" label="Vencido" value={formatCurrency(sum(overdue, "pendiente"))} detail={`${overdue.length} fuera de plazo`} />
        <Metric icon={CheckCircle2} label="Cobro medio" value={averageCollectionDays == null ? "—" : `${averageCollectionDays} días`} detail="Sólo facturas cobradas" />
      </section>

      <section className={styles.panel} aria-labelledby="invoice-list-title">
        <form className={styles.filters} method="get">
          <label className={styles.field}>
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Buscar factura, cliente u obra</span>
            <input name="buscar" defaultValue={query.buscar} placeholder="Buscar factura, cliente u obra..." />
          </label>
          <label className={styles.field}>
            <span className="sr-only">Estado</span>
            <select name="estado" defaultValue={query.estado ?? "todas"}>
              <option value="todas">Todos los estados</option>
              <option value="borrador">Borradores</option>
              <option value="pendiente_pago">Pendientes</option>
              <option value="parcialmente_pagada">Cobro parcial</option>
              <option value="vencida">Vencidas</option>
              <option value="pagada">Cobradas</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className="sr-only">Trabajo</span>
            <select name="obra" defaultValue={query.obra ?? ""}>
              <option value="">Todas las obras</option>
              {works.map((work) => <option key={work.id} value={work.id}>{work.titulo}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className="sr-only">Periodo</span>
            <select name="periodo" defaultValue={query.periodo ?? "todo"}>
              <option value="todo">Cualquier fecha</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="year">Este año</option>
            </select>
          </label>
          <div className={styles.filterActions}>
            <button type="submit" className="secondary-button">Aplicar</button>
            <Link href="/facturas-cliente" className="secondary-button">Limpiar</Link>
          </div>
        </form>

        {pageRows.length ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="sr-only" id="invoice-list-title">Listado de facturas de clientes</caption>
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Obra</th>
                    <th>Base</th>
                    <th>IVA</th>
                    <th>Total</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileList}>
              {pageRows.map((invoice) => <InvoiceMobileCard key={invoice.id} invoice={invoice} />)}
            </div>
            <Pager query={query} currentPage={currentPage} totalPages={totalPages} total={visible.length} />
          </>
        ) : (
          <div className={styles.empty}>
            <FileText size={28} aria-hidden="true" />
            <h2>No hay facturas con estos filtros</h2>
            <p>Cambia los filtros o crea una factura si tu rol lo permite.</p>
          </div>
        )}
      </section>
    </main>
  );
}

async function loadInvoices(companyId: string, scope: Prisma.InvoiceWhereInput) {
  return prisma.invoice.findMany({
    where: { companyId, ...scope },
    orderBy: [{ fechaVencimiento: "desc" }, { fechaEmision: "desc" }],
    include: {
      client: { select: { id: true, nombre: true } },
      work: { select: { id: true, titulo: true } },
      payments: { select: { fecha: true, importe: true }, orderBy: { fecha: "desc" } },
    },
  });
}

function InvoiceRow({ invoice }: { invoice: LiveInvoice }) {
  const overdue = invoice.liveStatus === "vencida";
  return (
    <tr>
      <td><Link href={`/facturas-cliente/${invoice.id}`} className={styles.primaryText}>{invoice.numero}</Link><span className={styles.secondaryText}>{invoice.concepto}</span></td>
      <td><Link href={`/clientes/${invoice.client.id}?vista=facturas`} className={styles.primaryText}>{invoice.client.nombre}</Link></td>
      <td>{invoice.work ? <Link href={`/obras/${invoice.work.id}/facturacion`} className={styles.primaryText}>{invoice.work.titulo}</Link> : <span>Sin obra</span>}</td>
      <td className={styles.money}>{formatCurrency(invoice.importeBase)}</td>
      <td className={styles.money}>{formatCurrency(invoice.iva)}</td>
      <td className={styles.money}>{formatCurrency(invoice.total)}</td>
      <td><span className={overdue ? styles.overdue : styles.primaryText}>{formatDateOnly(invoice.fechaVencimiento)}</span><span className={styles.secondaryText}>{overdue ? "Fuera de plazo" : formatDueLabel(invoice.fechaVencimiento)}</span></td>
      <td><StatusPill status={invoice.liveStatus} /></td>
      <td><Link href={`/facturas-cliente/${invoice.id}`} className={styles.pagerLink} aria-label={`Abrir factura ${invoice.numero}`}><ChevronRight size={15} aria-hidden="true" /></Link></td>
    </tr>
  );
}

function InvoiceMobileCard({ invoice }: { invoice: LiveInvoice }) {
  return (
    <article className={styles.mobileCard}>
      <div className={styles.mobileCardTop}>
        <div><Link href={`/facturas-cliente/${invoice.id}`} className={styles.primaryText}>{invoice.numero}</Link><span className={styles.secondaryText}>{invoice.client.nombre} · {invoice.work?.titulo ?? "Sin obra"}</span></div>
        <StatusPill status={invoice.liveStatus} />
      </div>
      <div className={styles.mobileCardAmounts}>
        <span>Total <strong className={styles.money}>{formatCurrency(invoice.total)}</strong></span>
        <span>Pendiente <strong className={styles.money}>{formatCurrency(invoice.pendiente)}</strong></span>
      </div>
      <div className={styles.rowActions}>
        <Link href={`/facturas-cliente/${invoice.id}`} className="secondary-button">Ver detalle</Link>
        <Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank" className="secondary-button">PDF</Link>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = "success" }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; detail: string; tone?: "success" | "warning" | "danger" | "info" }) {
  return <article className={styles.metric}><div className={styles.metricTop}><p className={styles.metricLabel}>{label}</p><span className={styles.metricIcon} data-tone={tone}><Icon size={16} /></span></div><p className={styles.metricValue}>{value}</p><p className={styles.metricDetail}>{detail}</p></article>;
}

function Pager({ query, currentPage, totalPages, total }: { query: Query; currentPage: number; totalPages: number; total: number }) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages);
  return <nav className={styles.pager} aria-label="Paginación de facturas"><span>Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} de {total}</span><span className={styles.pagerLinks}>{pages.map((page) => <Link key={page} href={withQuery(query, page)} className={styles.pagerLink} data-active={page === currentPage ? "true" : "false"} aria-current={page === currentPage ? "page" : undefined}>{page}</Link>)}</span></nav>;
}

function withQuery(query: Query, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value && key !== "pagina") params.set(key, value);
  params.set("pagina", String(page));
  return `/facturas-cliente?${params.toString()}`;
}

function relationScope(scope: string, workIds: string[] | null, clientIds: string[] | null): Prisma.InvoiceWhereInput {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS") return { clienteId: { in: clientIds ?? [] } };
  const OR: Prisma.InvoiceWhereInput[] = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length) OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] } };
}

function sum<T extends { total: number; pagado: number; pendiente: number }>(items: T[], key: "total" | "pagado" | "pendiente") { return items.reduce((total, item) => total + item[key], 0); }
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function matchesPeriod(date: Date, period: string | undefined, now: Date) { if (!period || period === "todo") return true; if (period === "year") return date.getFullYear() === now.getFullYear(); const days = period === "30d" ? 30 : period === "90d" ? 90 : null; return days == null || date.getTime() >= now.getTime() - days * 86_400_000; }
function formatDateOnly(date: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function formatDueLabel(date: Date) { const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000); return days === 0 ? "Vence hoy" : days > 0 ? `En ${days} días` : `${Math.abs(days)} días vencida`; }
