import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Download, Eye, Pencil, Plus, Receipt, WalletCards } from "lucide-react";
import { markInvoicePaid } from "@/app/(app)/dinero/actions";
import { ConfirmedPaymentForm } from "@/components/confirmed-payment-form";
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { StatusPill } from "@/components/status-pill";
import { ActionMenu, DetailSection, MetricStrip, Notice, PageHeader } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCapability } from "@/lib/commercial/authorization";
import { companySettingsView } from "@/lib/tenant/company-settings";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireCapability("sales.invoices.view");
  const [invoice, companyRecord] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        client: true,
        work: true,
        payments: { orderBy: { fecha: "desc" } }
      }
    }),
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } })
  ]);

  if (!invoice) notFound();

  const company = companySettingsView(companyRecord);
  const liveStatus = invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length;

  return (
    <main className="screen">
      <Link href="/dinero" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Facturas y cobros
      </Link>

      <PageHeader
        eyebrow={invoice.numero}
        title={invoice.concepto}
        description={`${invoice.client.nombre}${invoice.work ? ` · ${invoice.work.titulo}` : " · Sin obra"}`}
        badge={<StatusPill status={liveStatus} />}
        action={invoice.pendiente > 0 ? <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/dinero/${invoice.id}`} className="primary-button"><Plus size={18} /> Registrar cobro</Link> : <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero/${invoice.id}`} className="primary-button"><Pencil size={18} /> Editar factura</Link>}
        secondaryActions={<ActionMenu><Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero/${invoice.id}`}><Pencil size={18} /> Editar factura</Link><Link href={`/gestion?tipo=eventoAgenda&clienteId=${invoice.clienteId}&obraId=${invoice.obraId ?? ""}&facturaId=${invoice.id}&tipoEvento=seguimiento_cobro&titulo=Seguimiento%20cobro%20${encodeURIComponent(invoice.numero)}&descripcion=${encodeURIComponent(invoice.concepto)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/dinero/${invoice.id}`}><CalendarClock size={18} /> Crear seguimiento</Link><Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank"><Eye size={18} /> Vista PDF</Link><Link href={`/dinero/${invoice.id}/pdf`}><Download size={18} /> Descargar PDF</Link></ActionMenu>}
      />

      <MetricStrip className="mb-4 sm:grid-cols-3 xl:grid-cols-3">
          <Mini label="Total" value={formatCurrency(invoice.total)} icon={Receipt} />
          <Mini label="Pagado" value={formatCurrency(invoice.pagado)} icon={WalletCards} />
          <Mini label="Pendiente" value={formatCurrency(invoice.pendiente)} icon={CalendarClock} />
      </MetricStrip>

      <Notice className="mb-4" tone="warning" title="Revisión fiscal" description="Si esta factura sigue en borrador, revísala con tu gestoría antes de usarla como documento legal." />
      {companyMissing ? <Notice className="mb-4" tone="warning" title="Datos de empresa incompletos" description={`Falta ${companyStatus.missingRequired.slice(0, 3).join(", ")}. Puedes generar el PDF, pero quedará incompleto.`} /> : null}

      <DetailSection title="Estado, vencimiento y pago" description="Datos principales para revisar antes de registrar un cobro.">
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          <p><strong className="text-obra-ink">Emitida:</strong> {formatDate(invoice.fechaEmision)}</p>
          <p><strong className="text-obra-ink">Vencimiento:</strong> {formatDate(invoice.fechaVencimiento)}</p>
          <p><strong className="text-obra-ink">Método de pago:</strong> {invoice.metodoPago ?? "transferencia"}</p>
          <p><strong className="text-obra-ink">Datos bancarios:</strong> {invoice.datosBancarios ?? "Sin datos bancarios."}</p>
          <p><strong className="text-obra-ink">Observaciones:</strong> {invoice.observaciones ?? "Sin observaciones."}</p>
        </div>
      </DetailSection>

      <EntityWorkflowSummary clientId={invoice.clienteId} workId={invoice.obraId ?? undefined} invoiceId={invoice.id} />
      {invoice.pendiente > 0 ? (
        <>
          <section className="mt-4">
            <ConfirmedPaymentForm
              facturaId={invoice.id}
              numero={invoice.numero}
              cliente={invoice.client.nombre}
              pendiente={invoice.pendiente}
              total={invoice.total}
            />
          </section>
          <form action={markInvoicePaid} className="card mt-4 grid gap-3 p-4">
            <input type="hidden" name="facturaId" value={invoice.id} />
            <h2 className="text-lg font-black text-obra-ink">Marcar pagada</h2>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" name="confirmadoPorUsuario" value="true" required />
              Confirmo que quiero registrar el pendiente como pago final y dejar la factura pagada.
            </label>
            <button type="submit" className="secondary-button w-full">Marcar factura como pagada</button>
          </form>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-obra-green/20 bg-obra-green/10 p-4 text-sm font-semibold text-obra-green">
          Esta factura está pagada. No hay pendiente que registrar.
        </div>
      )}

      <DetailSection className="mt-4" title="Cobros registrados" description="Historial real de pagos, incluidos los pagos parciales.">
        <div className="grid gap-3">
          {invoice.payments.map((payment) => (
            <article key={payment.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-obra-ink">{formatCurrency(payment.importe)}</p>
                  <p className="mt-1 text-sm text-slate-500">{payment.metodo} · {payment.tipo.replaceAll("_", " ")}</p>
                </div>
                <span className="text-sm font-semibold text-slate-500">{formatDate(payment.fecha)}</span>
              </div>
              {payment.notas ? <p className="mt-3 text-sm leading-6 text-slate-600">{payment.notas}</p> : null}
              <Link href={`/gestion?tipo=pago&id=${payment.id}&returnTo=/dinero/${invoice.id}`} className="secondary-button mt-3">
                <Pencil size={18} />
                Editar pago
              </Link>
            </article>
          ))}
          {invoice.payments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
              Todavía no hay pagos registrados para esta factura.
            </div>
          ) : null}
        </div>
      </DetailSection>
    </main>
  );
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Mini({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
        <Icon size={14} className="text-obra-graphite" />
        {label}
      </p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}
