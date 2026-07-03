import Link from "next/link";
import { BellPlus, Clock, Download, Eye, Pencil, Plus, Receipt, WalletCards } from "lucide-react";
import { markInvoicePaid, prepareCollectionReminder } from "@/app/(app)/dinero/actions";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

const tabs = [
  ["borrador", "Borradores"],
  ["pendiente_emitir", "Pendientes de emitir"],
  ["emitida", "Emitidas"],
  ["enviada", "Enviadas"],
  ["pendientes", "Pendientes"],
  ["vencidas", "Vencidas"],
  ["parciales", "Parciales"],
  ["pagadas", "Pagadas"],
  ["reclamada", "Reclamadas"],
  ["proximas", "Próximas"],
  ["todas", "Todas"]
];

export default async function MoneyPage({
  searchParams
}: {
  searchParams: Promise<{ filtro?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const filter = query.filtro ?? "pendientes";
  const invoices = await prisma.invoice.findMany({
    orderBy: { fechaVencimiento: "asc" },
    include: { client: true, work: true, payments: true }
  });

  const invoicesWithStatus = invoices.map((invoice) => ({
    ...invoice,
    liveStatus: invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento)
  }));

  const visibleInvoices = invoicesWithStatus.filter((invoice) => {
    const statusMatch =
      filter === "todas" ||
      invoice.estado === filter ||
      invoice.liveStatus === filter ||
      (filter === "pendientes" && invoice.pendiente > 0) ||
      (filter === "vencidas" && invoice.liveStatus === "vencida") ||
      (filter === "parciales" && invoice.liveStatus === "parcialmente_pagada") ||
      (filter === "pagadas" && invoice.liveStatus === "pagada") ||
      (filter === "proximas" && invoice.pendiente > 0 && invoice.liveStatus !== "vencida");
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${invoice.numero} ${invoice.client.nombre} ${invoice.work?.titulo ?? ""} ${invoice.concepto}`);
    return statusMatch && (!search || text.includes(search));
  });

  const pendingTotal = invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
  const collectedThisMonth = invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paymentSum, payment) => {
    const date = new Date(payment.fecha);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() ? paymentSum + payment.importe : paymentSum;
  }, 0), 0);
  const overdue = invoicesWithStatus.filter((invoice) => invoice.liveStatus === "vencida");
  const partial = invoicesWithStatus.filter((invoice) => invoice.liveStatus === "parcialmente_pagada");
  const paid = invoicesWithStatus.filter((invoice) => invoice.liveStatus === "pagada");
  const nextDue = invoicesWithStatus.find((invoice) => invoice.pendiente > 0 && invoice.liveStatus !== "vencida");
  const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <main className="screen">
      <SectionHeader
        title="Facturas y Cobros"
        description="Facturas emitidas, pendientes, parciales, vencidas y pagadas."
        action={
          <Link href="/gestion?tipo=factura&returnTo=/dinero" className="secondary-button">
            <Plus size={18} />
            Añadir
          </Link>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3">
        <StatCard href="/dinero?filtro=pendientes" title="Pendiente cobrar" value={formatCurrency(pendingTotal)} detail="Facturas abiertas" icon={WalletCards} tone="success" />
        <StatCard href="/dinero?filtro=pagadas" title="Cobrado este mes" value={formatCurrency(collectedThisMonth)} detail="Pagos registrados" icon={WalletCards} tone="success" />
        <StatCard href="/dinero?filtro=vencidas" title="Vencidas" value={String(overdue.length)} detail="Preparar seguimiento" icon={Receipt} tone="danger" />
        <StatCard href="/dinero?filtro=parciales" title="Parciales" value={String(partial.length)} detail="Con pagos a cuenta" icon={Clock} tone="warning" />
        <StatCard href={nextDue ? `/dinero/${nextDue.id}` : "/dinero"} title="Próximo vencimiento" value={nextDue ? nextDue.numero : "Sin vencimiento"} detail={nextDue ? formatDate(nextDue.fechaVencimiento) : "Todo al día"} icon={Receipt} />
        <StatCard href="/dinero?filtro=todas" title="Total facturado" value={formatCurrency(totalBilled)} detail={`${paid.length} pagadas`} icon={Receipt} />
      </section>

      <div className="card mb-5 p-3 text-sm font-semibold leading-6 text-obra-yellowDark">
        Factura en borrador. Revisa con tu gestoría antes de usarla como factura legal.
      </div>

      <form action="/dinero" className="card mb-3 flex gap-2 p-3">
        <input type="hidden" name="filtro" value={filter} />
        <input className="field" name="buscar" defaultValue={query.buscar ?? ""} placeholder="Buscar cliente, factura, obra..." />
        <button className="secondary-button shrink-0" type="submit">Buscar</button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([id, label]) => (
          <Link key={id} href={`/dinero?filtro=${id}${query.buscar ? `&buscar=${encodeURIComponent(query.buscar)}` : ""}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${filter === id ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      <section className="grid gap-3">
        {visibleInvoices.map((invoice) => (
          <details key={invoice.id} className="card p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">{invoice.numero}</p>
                  <h2 className="mt-1 text-lg font-black text-obra-ink">{invoice.client.nombre}</h2>
                  <p className="mt-1 text-sm text-slate-500">{invoice.work?.titulo ?? "Sin obra"} · {invoice.concepto}</p>
                </div>
                <StatusPill status={invoice.liveStatus} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Mini label="Total" value={formatCurrency(invoice.total)} />
                <Mini label="Pagado" value={formatCurrency(invoice.pagado)} />
                <Mini label="Pendiente" value={formatCurrency(invoice.pendiente)} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">Próxima acción: {nextInvoiceAction(invoice.liveStatus, invoice.pendiente)}</p>
            </summary>

            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <p><strong className="text-obra-ink">Emitida:</strong> {formatDate(invoice.fechaEmision)}</p>
                <p><strong className="text-obra-ink">Vencimiento:</strong> {formatDate(invoice.fechaVencimiento)}</p>
                <p><strong className="text-obra-ink">Estado:</strong> {invoice.liveStatus.replaceAll("_", " ")}</p>
              </div>

              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Historial de pagos</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-600">
                  {invoice.payments.map((payment) => (
                    <p key={payment.id}>{formatDate(payment.fecha)} · {formatCurrency(payment.importe)} · {payment.metodo} · {payment.tipo.replaceAll("_", " ")}</p>
                  ))}
                  {invoice.payments.length === 0 ? <p>Sin pagos registrados.</p> : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/dinero/${invoice.id}`} className="primary-button">Abrir detalle</Link>
                <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/dinero`} className="secondary-button"><Plus size={18} /> Pago</Link>
                <form action={prepareCollectionReminder}>
                  <input type="hidden" name="facturaId" value={invoice.id} />
                  <input type="hidden" name="canal" value="whatsapp" />
                  <button type="submit" className="secondary-button"><BellPlus size={18} /> Recordatorio</button>
                </form>
                <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero`} className="secondary-button"><Pencil size={18} /> Editar</Link>
                <Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank" className="secondary-button"><Eye size={18} /> Vista PDF</Link>
                <Link href={`/dinero/${invoice.id}/pdf`} className="secondary-button"><Download size={18} /> Descargar PDF</Link>
                <Link href={`/clientes/${invoice.clienteId}`} className="secondary-button">Cliente</Link>
                {invoice.obraId ? <Link href={`/obras?buscar=${encodeURIComponent(invoice.work?.titulo ?? "")}`} className="secondary-button">Obra</Link> : null}
              </div>
              {invoice.pendiente > 0 ? (
                <form action={markInvoicePaid} className="grid gap-2 rounded-lg border border-slate-100 p-3">
                  <input type="hidden" name="facturaId" value={invoice.id} />
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <input type="checkbox" name="confirmadoPorUsuario" value="true" required />
                    Confirmo que quiero marcar esta factura como pagada y registrar el pago final.
                  </label>
                  <button type="submit" className="secondary-button w-full">Marcar pagada</button>
                </form>
              ) : null}
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}

function nextInvoiceAction(status: string, pending: number) {
  if (status === "pagada" || pending <= 0) return "Nada pendiente";
  if (status === "vencida") return "Preparar recordatorio de cobro";
  if (status === "parcialmente_pagada") return "Registrar próximo pago";
  return "Vigilar vencimiento";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
