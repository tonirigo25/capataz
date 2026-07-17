import Link from "next/link";
import { BellPlus, CalendarClock, Clock, Pencil, Plus, Receipt, Search, WalletCards } from "lucide-react";
import { prepareCollectionReminder } from "@/app/(app)/dinero/actions";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { ActionMenu, EmptyState, FilterBar, MetricStrip, MobileList, Notice, PageHeader, ResponsiveTable, ResultSummary, SearchInput, Tabs } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const tabs = [["pendientes", "Pendientes"], ["vencidas", "Vencidas"], ["parciales", "Parciales"], ["pagadas", "Cobradas"], ["borrador", "Borradores"], ["emitida", "Emitidas"], ["reclamada", "Reclamadas"], ["todas", "Todas"]] as const;

type InvoiceListItem = {
  id: string; clienteId: string; obraId: string | null; numero: string; concepto: string; estado: string; total: number; pagado: number; pendiente: number;
  fechaEmision: Date; fechaVencimiento: Date; liveStatus: string; client: { nombre: string }; work: { titulo: string } | null;
  payments: Array<{ id: string; fecha: Date; importe: number; metodo: string; tipo: string }>;
};

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ filtro?: string; buscar?: string }> }) {
  const query = await searchParams;
  const filter = query.filtro ?? "pendientes";
  const { companyId } = await requireCompanyContext();
  const invoices = await prisma.invoice.findMany({ where: { companyId }, orderBy: { fechaVencimiento: "asc" }, include: { client: true, work: true, payments: true } });
  const invoicesWithStatus: InvoiceListItem[] = invoices.map((invoice) => ({ ...invoice, liveStatus: invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento) }));
  const visibleInvoices = invoicesWithStatus.filter((invoice) => {
    const statusMatch = filter === "todas" || invoice.estado === filter || invoice.liveStatus === filter ||
      (filter === "pendientes" && invoice.pendiente > 0) || (filter === "vencidas" && invoice.liveStatus === "vencida") ||
      (filter === "parciales" && invoice.liveStatus === "parcialmente_pagada") || (filter === "pagadas" && invoice.liveStatus === "pagada");
    const search = normalize(query.buscar ?? "");
    return statusMatch && (!search || normalize(`${invoice.numero} ${invoice.client.nombre} ${invoice.work?.titulo ?? ""} ${invoice.concepto}`).includes(search));
  });
  const pendingTotal = invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
  const collectedThisMonth = invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paymentSum, payment) => { const date = new Date(payment.fecha); const now = new Date(); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() ? paymentSum + payment.importe : paymentSum; }, 0), 0);
  const overdue = invoicesWithStatus.filter((invoice) => invoice.liveStatus === "vencida");
  const partial = invoicesWithStatus.filter((invoice) => invoice.liveStatus === "parcialmente_pagada");
  const hasCriteria = filter !== "todas" || Boolean(query.buscar);

  return (
    <main className="screen">
      <PageHeader eyebrow="Facturación" title="Facturas y cobros" description="Controla vencimientos, pagos parciales y saldos pendientes con trazabilidad por cliente y obra." action={<Link href="/gestion?tipo=factura&returnTo=/dinero" className="primary-button"><Plus size={18} /> Nueva factura</Link>} />

      <MetricStrip className="mb-5">
        <StatCard href="/dinero?filtro=pendientes" title="Pendiente" value={formatCurrency(pendingTotal)} detail="Saldo abierto real" icon={WalletCards} tone={pendingTotal ? "warning" : "success"} />
        <StatCard href="/dinero?filtro=pagadas" title="Cobrado este mes" value={formatCurrency(collectedThisMonth)} detail="Pagos registrados" icon={WalletCards} tone="success" />
        <StatCard href="/dinero?filtro=vencidas" title="Vencidas" value={String(overdue.length)} detail="Requieren seguimiento" icon={Receipt} tone={overdue.length ? "danger" : "neutral"} />
        <StatCard href="/dinero?filtro=parciales" title="Pagos parciales" value={String(partial.length)} detail="Facturas con saldo" icon={Clock} tone={partial.length ? "warning" : "neutral"} />
      </MetricStrip>

      <Notice className="mb-4" tone="warning" title="Revisión fiscal" description="Las facturas en borrador deben revisarse con tu gestoría antes de usarlas como documento legal." />

      <FilterBar className="mb-4">
        <form action="/dinero" className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto]">
          <input type="hidden" name="filtro" value={filter} />
          <label><span className="label mb-1 block">Buscar</span><SearchInput name="buscar" defaultValue={query.buscar ?? ""} placeholder="Factura, cliente, obra o concepto…" /></label>
          <button className="primary-button self-end" type="submit"><Search size={18} /> Buscar</button>
        </form>
        <Tabs label="Estados de factura" className="mt-3">
          {tabs.map(([id, label]) => <Link key={id} href={invoiceHref(id, query.buscar)} aria-current={filter === id ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${filter === id ? "bg-obra-ink text-white" : "text-slate-600 hover:bg-white"}`}>{label}</Link>)}
        </Tabs>
      </FilterBar>

      <ResultSummary shown={visibleInvoices.length} total={invoices.length} noun="facturas" context={hasCriteria ? <Link href="/dinero?filtro=todas" className="font-bold text-obra-ink underline underline-offset-4">Limpiar filtros</Link> : null} />

      {visibleInvoices.length ? <>
        <ResponsiveTable label="Facturas y cobros" className="mt-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500"><tr><th scope="col" className="px-4 py-3">Factura</th><th scope="col" className="px-4 py-3">Cliente y obra</th><th scope="col" className="px-4 py-3">Vencimiento</th><th scope="col" className="px-4 py-3 text-right">Total</th><th scope="col" className="px-4 py-3 text-right">Cobrado</th><th scope="col" className="px-4 py-3 text-right">Pendiente</th><th scope="col" className="px-4 py-3">Estado</th><th scope="col" className="px-4 py-3"><span className="sr-only">Abrir</span></th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">{visibleInvoices.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><Link href={`/dinero/${invoice.id}`} className="font-black text-obra-ink hover:underline">{invoice.numero}</Link><p className="mt-1 max-w-xs text-xs text-slate-500">{invoice.concepto}</p></td><td className="px-4 py-4"><p className="font-bold text-obra-ink">{invoice.client.nombre}</p><p className="text-xs text-slate-500">{invoice.work?.titulo ?? "Sin obra"}</p></td><td className="px-4 py-4">{formatDate(invoice.fechaVencimiento)}</td><td className="px-4 py-4 text-right font-bold">{formatCurrency(invoice.total)}</td><td className="px-4 py-4 text-right text-slate-600">{formatCurrency(invoice.pagado)}</td><td className={`px-4 py-4 text-right font-black ${invoice.pendiente ? "text-red-700" : "text-emerald-700"}`}>{formatCurrency(invoice.pendiente)}</td><td className="px-4 py-4"><StatusPill status={invoice.liveStatus} /></td><td className="px-4 py-4 text-right"><Link href={`/dinero/${invoice.id}`} className="secondary-button">Abrir</Link></td></tr>)}</tbody>
          </table>
        </ResponsiveTable>
        <MobileList className="mt-4">{visibleInvoices.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />)}</MobileList>
      </> : <div className="mt-4"><EmptyState title={invoices.length ? "No hay facturas para estos filtros" : "Todavía no hay facturas"} description={invoices.length ? "Prueba otra búsqueda o limpia los filtros activos." : "Crea la primera factura para controlar emisión, vencimiento y cobros."} icon={Search} action={invoices.length ? <Link href="/dinero?filtro=todas" className="secondary-button">Limpiar filtros</Link> : <Link href="/gestion?tipo=factura&returnTo=/dinero" className="primary-button">Crear factura</Link>} /></div>}
    </main>
  );
}

function InvoiceCard({ invoice }: { invoice: InvoiceListItem }) {
  return <article className="card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="label">{invoice.numero}</p><h2 className="mt-1 truncate text-lg font-black text-obra-ink">{invoice.client.nombre}</h2><p className="mt-1 text-sm text-slate-500">{invoice.work?.titulo ?? "Sin obra"}</p></div><StatusPill status={invoice.liveStatus} /></div><div className="mt-4 grid grid-cols-2 gap-2"><Mini label="Total" value={formatCurrency(invoice.total)} /><Mini label="Cobrado" value={formatCurrency(invoice.pagado)} /><Mini label="Pendiente" value={formatCurrency(invoice.pendiente)} danger={invoice.pendiente > 0} /><Mini label="Vence" value={formatDate(invoice.fechaVencimiento)} danger={invoice.liveStatus === "vencida"} /></div><p className="mt-3 text-sm font-semibold text-slate-600">Siguiente: {nextInvoiceAction(invoice.liveStatus, invoice.pendiente)}</p><div className="mt-4 flex gap-2"><Link href={`/dinero/${invoice.id}`} className="primary-button flex-1">Abrir detalle</Link><ActionMenu><Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/dinero`}><Plus size={17} /> Registrar cobro</Link><form action={prepareCollectionReminder}><input type="hidden" name="facturaId" value={invoice.id} /><input type="hidden" name="canal" value="whatsapp" /><button type="submit"><BellPlus size={17} /> Preparar recordatorio</button></form><Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero`}><Pencil size={17} /> Editar</Link><Link href={`/clientes/${invoice.clienteId}`}><CalendarClock size={17} /> Abrir cliente</Link></ActionMenu></div></article>;
}

function Mini({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 font-black ${danger ? "text-red-700" : "text-obra-ink"}`}>{value}</p></div>; }
function nextInvoiceAction(status: string, pending: number) { if (status === "pagada" || pending <= 0) return "Sin acciones pendientes"; if (status === "vencida") return "Preparar recordatorio"; if (status === "parcialmente_pagada") return "Registrar próximo cobro"; return "Vigilar vencimiento"; }
function invoiceHref(filter: string, search?: string) { const params = new URLSearchParams({ filtro: filter }); if (search) params.set("buscar", search); return `/dinero?${params.toString()}`; }
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
