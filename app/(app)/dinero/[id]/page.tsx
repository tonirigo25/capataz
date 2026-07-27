import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, CalendarClock, CheckCircle2, Download, Eye, FileCheck2, Pencil, Plus, Receipt, WalletCards } from "lucide-react";
import { markInvoicePaid } from "@/app/(app)/dinero/actions";
import { ConfirmedPaymentForm } from "@/components/confirmed-payment-form";
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { StatusPill } from "@/components/status-pill";
import { ActionMenu, DetailSection, MetricStrip, Notice, PageHeader } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { assertScopedEntityAccess, requireCapability, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
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
        payments: { orderBy: { fecha: "desc" } },
        reminders: { orderBy: { fechaProgramada: "desc" } },
        agendaEvents: { orderBy: { fechaInicio: "desc" } },
        fiscalDocuments: { orderBy: { createdAt: "desc" } }
      }
    }),
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } })
  ]);

  if (!invoice) notFound();
  if (invoice.obraId) await assertScopedEntityAccess(auth, "sales.invoices.view", "Work", invoice.obraId);
  else await assertScopedEntityAccess(auth, "sales.invoices.view", "Client", invoice.clienteId);
  const [updateDecision, collectDecision, agendaDecision] = await Promise.all([
    resolveAuthorization(auth, "sales.invoices.create"), resolveAuthorization(auth, "treasury.collections.register"), resolveAuthorization(auth, "agenda.manage")
  ]);
  const [canUpdate, canCollect, canSchedule] = await Promise.all([
    relationDecisionAllowed(auth, "sales.invoices.create", updateDecision, invoice),
    relationDecisionAllowed(auth, "treasury.collections.register", collectDecision, invoice),
    relationDecisionAllowed(auth, "agenda.manage", agendaDecision, invoice)
  ]);

  const company = companySettingsView(companyRecord);
  const liveStatus = invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length;
  const collected = Math.max(0, invoice.total - invoice.pendiente);
  const collectionPercent = invoice.total > 0 ? Math.min(100, Math.max(0, collected / invoice.total * 100)) : 0;
  const overdue = invoice.pendiente > 0 && invoice.fechaVencimiento < new Date();
  const latestFiscalDocument = invoice.fiscalDocuments[0] ?? null;
  const collectionTimeline = [
    ...invoice.payments.map((payment) => ({
      key: `payment-${payment.id}`,
      date: payment.fecha,
      title: "Pago registrado",
      detail: `${formatCurrency(payment.importe)} · ${payment.metodo} · ${payment.tipo.replaceAll("_", " ")}`,
      kind: "payment" as const,
      paymentId: payment.id,
    })),
    ...invoice.reminders.map((reminder) => ({
      key: `reminder-${reminder.id}`,
      date: reminder.fechaProgramada,
      title: reminder.estado === "enviado" ? "Recordatorio enviado" : "Recordatorio preparado",
      detail: `${reminder.canal} · ${reminder.estado.replaceAll("_", " ")} · ${reminder.mensaje}`,
      kind: "reminder" as const,
      paymentId: null,
    })),
    ...invoice.agendaEvents.map((event) => ({
      key: `event-${event.id}`,
      date: event.fechaInicio,
      title: event.titulo,
      detail: `${event.tipo.replaceAll("_", " ")} · ${event.estado.replaceAll("_", " ")}`,
      kind: "promise" as const,
      paymentId: null,
    })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime());

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
        action={invoice.pendiente > 0 && canCollect ? <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/dinero/${invoice.id}`} className="primary-button"><Plus size={18} /> Registrar cobro</Link> : canUpdate ? <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero/${invoice.id}`} className="primary-button"><Pencil size={18} /> Editar factura</Link> : undefined}
        secondaryActions={<ActionMenu>{canUpdate ? <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero/${invoice.id}`}><Pencil size={18} /> Editar factura</Link> : null}{canSchedule ? <Link href={`/gestion?tipo=eventoAgenda&clienteId=${invoice.clienteId}&obraId=${invoice.obraId ?? ""}&facturaId=${invoice.id}&tipoEvento=seguimiento_cobro&titulo=Seguimiento%20cobro%20${encodeURIComponent(invoice.numero)}&descripcion=${encodeURIComponent(invoice.concepto)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/dinero/${invoice.id}`}><CalendarClock size={18} /> Crear seguimiento</Link> : null}<Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank"><Eye size={18} /> Vista PDF</Link><Link href={`/dinero/${invoice.id}/pdf`}><Download size={18} /> Descargar PDF</Link></ActionMenu>}
      />

      <section className="section-shell mb-4" aria-labelledby="collection-state">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-meta">Estado de cobro</p>
            <h2 id="collection-state" className="type-section-title mt-1 text-content">{formatCurrency(invoice.pendiente)} pendientes</h2>
          </div>
          <strong className="tabular text-3xl text-content">{formatCurrency(invoice.total)}</strong>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="Porcentaje cobrado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(collectionPercent)}>
          <div className="h-full rounded-full bg-success" style={{ width: `${collectionPercent}%` }} />
        </div>
        <MetricStrip className="mt-4 sm:grid-cols-3 xl:grid-cols-3">
          <Mini label="Cobrado" value={formatCurrency(collected)} icon={WalletCards} />
          <Mini label="Pendiente" value={formatCurrency(invoice.pendiente)} icon={CalendarClock} />
          <Mini label="Vencimiento" value={formatDate(invoice.fechaVencimiento)} icon={Receipt} />
        </MetricStrip>
      </section>

      <Notice className="mb-4" tone={overdue ? "danger" : "info"} title={overdue ? "Cobro vencido" : "Cobro y fiscalidad separados"} description={overdue ? "El saldo sigue abierto después del vencimiento. Prepara un seguimiento; el estado fiscal se mantiene en su bloque independiente." : "Registrar un cobro no modifica por sí solo el estado fiscal. Ambos historiales se muestran por separado."} />
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
      <DetailSection className="mt-4" title="Historial y compromisos" description="Pagos parciales, recordatorios y seguimientos vinculados a esta factura.">
        {collectionTimeline.length ? <div className="divide-y divide-border">
          {collectionTimeline.map((item) => (
            <article key={item.key} className="grid min-h-16 gap-2 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-strong" aria-hidden="true">
                {item.kind === "payment" ? <WalletCards size={17} /> : item.kind === "reminder" ? <Bell size={17} /> : <CalendarClock size={17} />}
              </span>
              <span>
                <strong className="block text-content">{item.title}</strong>
                <span className="type-meta mt-1 block">{item.detail}</span>
              </span>
              <span className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                <span className="type-meta">{formatDate(item.date)}</span>
                {item.paymentId && canCollect ? <Link href={`/gestion?tipo=pago&id=${item.paymentId}&returnTo=/dinero/${invoice.id}`} className="secondary-button"><Pencil size={16} /> Editar</Link> : null}
              </span>
            </article>
          ))}
        </div> : <p className="type-secondary">Todavía no hay pagos, recordatorios ni promesas de pago registradas.</p>}
      </DetailSection>

      {invoice.pendiente > 0 ? <section className="section-shell mt-4" aria-labelledby="collection-next-action">
        <p className="type-meta">Siguiente acción</p>
        <h2 id="collection-next-action" className="type-section-title mt-2 text-content">{overdue ? "Preparar seguimiento de cobro" : "Revisar el cobro antes del vencimiento"}</h2>
        <p className="type-secondary mt-2">{overdue ? "Comprueba el último compromiso registrado antes de contactar de nuevo." : `El saldo documentado vence el ${formatDate(invoice.fechaVencimiento)}.`}</p>
        {canSchedule ? <Link href={`/gestion?tipo=eventoAgenda&clienteId=${invoice.clienteId}&obraId=${invoice.obraId ?? ""}&facturaId=${invoice.id}&tipoEvento=seguimiento_cobro&titulo=Seguimiento%20cobro%20${encodeURIComponent(invoice.numero)}&descripcion=${encodeURIComponent(invoice.concepto)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/dinero/${invoice.id}`} className="secondary-button mt-4"><CalendarClock size={18} /> Programar seguimiento</Link> : null}
      </section> : null}
      {invoice.pendiente > 0 && canCollect ? (
        <>
          <section className="mt-4">
            <ConfirmedPaymentForm
              facturaId={invoice.id}
              numero={invoice.numero}
              cliente={invoice.client.nombre}
              pendiente={invoice.pendiente}
              total={invoice.total}
              triggerClassName="secondary-button"
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
        <div className={`mt-4 rounded-lg border p-4 text-sm font-semibold ${invoice.pendiente > 0 ? "border-slate-200 bg-slate-50 text-slate-600" : "border-obra-green/20 bg-obra-green/10 text-obra-green"}`}>
          {invoice.pendiente > 0 ? "Consulta en modo lectura; no tienes autorización para registrar cobros." : "Esta factura está pagada. No hay pendiente que registrar."}
        </div>
      )}

      <DetailSection className="mt-4" title="Documento y estado fiscal" description="La factura operativa, el PDF y la preparación fiscal permanecen separados del cobro.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FiscalItem icon={Receipt} label="Serie y número" value={invoice.numero} />
          <FiscalItem icon={CheckCircle2} label="Estado operativo" value={liveStatus.replaceAll("_", " ")} />
          <FiscalItem icon={FileCheck2} label="Estado fiscal" value={latestFiscalDocument?.status ?? "No preparado"} />
          <FiscalItem icon={FileCheck2} label="Modo fiscal" value={latestFiscalDocument?.mode ?? "Desactivado"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank" className="secondary-button"><Eye size={18} /> Vista PDF</Link>
          <Link href={`/dinero/${invoice.id}/pdf`} className="secondary-button"><Download size={18} /> Descargar PDF</Link>
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

async function relationDecisionAllowed(auth: Awaited<ReturnType<typeof requireCapability>>, capability: Parameters<typeof resolveScopedEntityIds>[1], decision: { allowed: boolean; scope: string }, invoice: { obraId: string | null; clienteId: string }) {
  if (!decision.allowed) return false;
  if (decision.scope === "COMPANY") return true;
  const entityType = invoice.obraId ? "Work" : "Client";
  const ids = await resolveScopedEntityIds(auth, capability, entityType);
  return Boolean(ids?.includes(invoice.obraId ?? invoice.clienteId));
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
      <p className="flex items-center gap-1 text-xs font-semibold uppercase text-content-secondary">
        <Icon size={14} className="text-obra-graphite" />
        {label}
      </p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}

function FiscalItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-subtle p-4">
      <p className="type-meta flex items-center gap-2"><Icon size={16} aria-hidden="true" />{label}</p>
      <p className="mt-2 font-semibold text-content">{value}</p>
    </div>
  );
}
