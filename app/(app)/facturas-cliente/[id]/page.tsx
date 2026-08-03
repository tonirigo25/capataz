import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Receipt,
  WalletCards,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { StatusPill } from "@/components/status-pill";
import { parseBudgetLines } from "@/lib/budget-lines";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import {
  assertScopedEntityAccess,
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import styles from "../client-invoices.module.css";

export const dynamic = "force-dynamic";

export default async function ClientInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const auth = await requireCapability("sales.invoices.view");
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: auth.companyId },
    include: {
      client: { select: { id: true, nombre: true, email: true, nifCif: true } },
      work: { select: { id: true, titulo: true, direccion: true } },
      payments: { orderBy: { fecha: "desc" } },
      reminders: { orderBy: { fechaProgramada: "desc" } },
      agendaEvents: { orderBy: { fechaInicio: "desc" } },
      fiscalDocuments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!invoice) notFound();
  if (invoice.obraId) await assertScopedEntityAccess(auth, "sales.invoices.view", "Work", invoice.obraId);
  else await assertScopedEntityAccess(auth, "sales.invoices.view", "Client", invoice.clienteId);

  const [updateDecision, collectDecision, agendaDecision, documentDecision] = await Promise.all([
    resolveAuthorization(auth, "sales.invoices.create"),
    resolveAuthorization(auth, "treasury.collections.register"),
    resolveAuthorization(auth, "agenda.manage"),
    resolveAuthorization(auth, "documents.view"),
  ]);
  const [canUpdate, canCollect, canSchedule, canSeeDocuments] = await Promise.all([
    relationDecisionAllowed(auth, "sales.invoices.create", updateDecision, invoice),
    relationDecisionAllowed(auth, "treasury.collections.register", collectDecision, invoice),
    relationDecisionAllowed(auth, "agenda.manage", agendaDecision, invoice),
    relationDecisionAllowed(auth, "documents.view", documentDecision, invoice),
  ]);
  const documents = canSeeDocuments
    ? await prisma.document.findMany({
        where: { companyId: auth.companyId, invoiceId: invoice.id, archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, category: true, status: true, createdAt: true },
      })
    : [];
  const backHref = safeReturnTo(query.returnTo);
  const detailHref = `/facturas-cliente/${invoice.id}${backHref !== "/facturas-cliente" ? `?returnTo=${encodeURIComponent(backHref)}` : ""}`;
  const status = invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
  const collected = Math.max(0, invoice.total - invoice.pendiente);
  const percent = invoice.total > 0 ? Math.min(100, Math.max(0, Math.round((collected / invoice.total) * 100))) : 0;
  const lines = parseBudgetLines(invoice.partidas);
  const visibleLines = lines.length ? lines : [{ descripcion: invoice.concepto, cantidad: 1, unidad: "servicio", precioUnitario: invoice.importeBase, total: invoice.importeBase, categoria: "General" }];
  const latestFiscal = invoice.fiscalDocuments[0] ?? null;
  const activity = [
    ...invoice.payments.map((payment) => ({ key: `payment-${payment.id}`, date: payment.fecha, title: "Cobro registrado", detail: `${formatCurrency(payment.importe)} · ${payment.metodo}`, icon: WalletCards })),
    ...invoice.reminders.map((reminder) => ({ key: `reminder-${reminder.id}`, date: reminder.fechaProgramada, title: reminder.estado === "enviado" ? "Recordatorio enviado" : "Recordatorio preparado", detail: `${label(reminder.canal)} · ${label(reminder.estado)}`, icon: Bell })),
    ...invoice.agendaEvents.map((event) => ({ key: `event-${event.id}`, date: event.fechaInicio, title: event.titulo, detail: `${label(event.tipo)} · ${label(event.estado)}`, icon: CalendarClock })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime());

  return (
    <main className={`screen ${styles.workspace}`}>
      <InternalBreadcrumbs items={[{ label: "Clientes", href: "/clientes" }, { label: "Facturas", href: backHref }, { label: invoice.numero }]} />
      <header className={styles.pageHeading}>
        <div>
          <Link href={backHref} className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-obra-ink"><ArrowLeft size={15} /> Volver a facturas</Link>
          <h1>{invoice.numero}</h1>
          <p>{invoice.concepto} · {invoice.client.nombre}{invoice.work ? ` · ${invoice.work.titulo}` : ""}</p>
        </div>
        <div className={styles.detailActions}>
          <StatusPill status={status} />
          <Link href={`/dinero/${invoice.id}/pdf?preview=1`} target="_blank" className="secondary-button"><Eye size={16} /> Vista PDF</Link>
          <Link href={`/dinero/${invoice.id}/pdf`} className="secondary-button"><Download size={16} /> Descargar</Link>
          {canUpdate ? <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=${encodeURIComponent(detailHref)}`} className="secondary-button"><Pencil size={16} /> Editar</Link> : null}
          {invoice.pendiente > 0 && canCollect ? <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=${encodeURIComponent(detailHref)}`} className="primary-button"><Plus size={16} /> Registrar cobro</Link> : null}
        </div>
      </header>

      <section className={styles.metrics} aria-label="Importes de la factura">
        <Metric icon={Receipt} label="Base imponible" value={formatCurrency(invoice.importeBase)} detail="Importe neto registrado" />
        <Metric icon={FileText} tone="info" label="IVA" value={formatCurrency(invoice.iva)} detail={invoice.importeBase > 0 ? `${Math.round((invoice.iva / invoice.importeBase) * 1000) / 10}% efectivo` : "Sin base imponible"} />
        <Metric icon={WalletCards} label="Total" value={formatCurrency(invoice.total)} detail="Importe de factura" />
        <Metric icon={CheckCircle2} label="Cobrado" value={formatCurrency(collected)} detail={`${percent}% del total`} />
        <Metric icon={CalendarClock} tone={status === "vencida" ? "danger" : "warning"} label="Pendiente" value={formatCurrency(invoice.pendiente)} detail={`Vence ${formatDateOnly(invoice.fechaVencimiento)}`} />
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.documentPanel} aria-labelledby="invoice-document-heading">
          <header className={styles.documentHeader}>
            <h2 id="invoice-document-heading">Detalle de factura</h2>
            <span className={styles.secondaryText}>Emitida {formatDateOnly(invoice.fechaEmision)}</span>
          </header>
          <div className={styles.invoicePreview}>
            <div className={styles.invoiceMeta}>
              <div>
                <h2>{invoice.client.nombre}</h2>
                <p>{invoice.client.nifCif ?? "NIF/CIF no registrado"}</p>
                <p>{invoice.client.email ?? "Email no registrado"}</p>
                {invoice.work ? <p>{invoice.work.titulo}{invoice.work.direccion ? ` · ${invoice.work.direccion}` : ""}</p> : null}
              </div>
              <div className={styles.invoiceNumber}>
                <strong>FACTURA {invoice.numero}</strong>
                <span>Emisión: {formatDateOnly(invoice.fechaEmision)}</span><br />
                <span>Vencimiento: {formatDateOnly(invoice.fechaVencimiento)}</span>
              </div>
            </div>
            <table className={styles.lineTable}>
              <thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Precio</th><th>Importe</th></tr></thead>
              <tbody>{visibleLines.map((line, index) => <tr key={`${line.descripcion}-${index}`}><td>{line.descripcion}</td><td>{number(line.cantidad)}</td><td>{line.unidad}</td><td>{formatCurrency(line.precioUnitario)}</td><td>{formatCurrency(line.total)}</td></tr>)}</tbody>
            </table>
            <div className={styles.totals}>
              <div className={styles.totalRow}><span>Base imponible</span><strong>{formatCurrency(invoice.importeBase)}</strong></div>
              <div className={styles.totalRow}><span>IVA</span><strong>{formatCurrency(invoice.iva)}</strong></div>
              <div className={styles.totalRow}><span>Total</span><strong>{formatCurrency(invoice.total)}</strong></div>
            </div>
            {invoice.observaciones ? <p className="mt-5 text-xs text-slate-600"><strong>Observaciones:</strong> {invoice.observaciones}</p> : null}
          </div>
        </article>

        <aside className={styles.stack} aria-label="Seguimiento de la factura">
          <section className={styles.sidePanel}>
            <h2>Estado de cobro</h2>
            <div className={styles.progress} role="progressbar" aria-label="Porcentaje cobrado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
            <dl className={styles.dataList}>
              <Data label="Cobrado" value={formatCurrency(collected)} />
              <Data label="Pendiente" value={formatCurrency(invoice.pendiente)} />
              <Data label="Método" value={invoice.metodoPago ?? "No registrado"} />
              <Data label="Estado fiscal" value={latestFiscal?.status ? label(latestFiscal.status) : "No preparado"} />
            </dl>
            <div className={`${styles.actions} mt-3`}>
              {invoice.pendiente > 0 && canCollect ? <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=${encodeURIComponent(detailHref)}`} className="primary-button">Registrar cobro</Link> : null}
              {invoice.pendiente > 0 && canSchedule ? <Link href={scheduleHref(invoice, detailHref)} className="secondary-button">Programar seguimiento</Link> : null}
            </div>
          </section>

          <section className={styles.sidePanel}>
            <h2>Actividad de cobro</h2>
            {activity.length ? <div className={styles.timeline}>{activity.slice(0, 6).map((item) => { const Icon = item.icon; return <div key={item.key} className={styles.timelineItem}><span className={styles.timelineIcon}><Icon size={14} /></span><span><strong>{item.title}</strong><span>{item.detail} · {formatDateOnly(item.date)}</span></span></div>; })}</div> : <p className={styles.secondaryText}>Todavía no hay cobros, recordatorios o seguimientos registrados.</p>}
          </section>

          {canSeeDocuments ? <section className={styles.sidePanel}><h2>Documentos vinculados</h2>{documents.length ? documents.map((document) => <Link key={document.id} href={`/documentos?documento=${encodeURIComponent(document.id)}`} className={styles.linkedDocument}><span><FileText size={14} className="mr-2 inline" />{document.name}</span><span>{label(document.status)}</span></Link>) : <p className={styles.secondaryText}>No hay documentos vinculados a esta factura.</p>}</section> : null}
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label: title, value, detail, tone = "success" }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; detail: string; tone?: "success" | "warning" | "danger" | "info" }) {
  return <article className={styles.metric}><div className={styles.metricTop}><p className={styles.metricLabel}>{title}</p><span className={styles.metricIcon} data-tone={tone}><Icon size={16} /></span></div><p className={styles.metricValue}>{value}</p><p className={styles.metricDetail}>{detail}</p></article>;
}

function Data({ label: title, value }: { label: string; value: string }) { return <div className={styles.dataRow}><dt>{title}</dt><dd>{value}</dd></div>; }

async function relationDecisionAllowed(
  auth: Awaited<ReturnType<typeof requireCapability>>,
  capability: Parameters<typeof resolveScopedEntityIds>[1],
  decision: { allowed: boolean; scope: string },
  invoice: { obraId: string | null; clienteId: string },
) {
  if (!decision.allowed) return false;
  if (decision.scope === "COMPANY") return true;
  const entityType = invoice.obraId ? "Work" : "Client";
  const ids = await resolveScopedEntityIds(auth, capability, entityType);
  return Boolean(ids?.includes(invoice.obraId ?? invoice.clienteId));
}

function safeReturnTo(value: string | undefined) {
  if (!value) return "/facturas-cliente";
  if (/^\/clientes\/[^/?]+(?:\?vista=facturas)?$/.test(value)) return value;
  return "/facturas-cliente";
}

function scheduleHref(invoice: { id: string; clienteId: string; obraId: string | null; numero: string; concepto: string }, returnTo: string) {
  const params = new URLSearchParams({
    tipo: "eventoAgenda",
    clienteId: invoice.clienteId,
    facturaId: invoice.id,
    tipoEvento: "seguimiento_cobro",
    titulo: `Seguimiento cobro ${invoice.numero}`,
    descripcion: invoice.concepto,
    fechaInicio: tomorrowAtTenInputValue(),
    returnTo,
  });
  if (invoice.obraId) params.set("obraId", invoice.obraId);
  return `/gestion?${params.toString()}`;
}

function tomorrowAtTenInputValue() { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(10, 0, 0, 0); const pad = (value: number) => String(value).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatDateOnly(date: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function number(value: number) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value); }
function label(value: string) { return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
