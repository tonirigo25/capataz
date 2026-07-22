import type { BusinessPartnerKind } from "@prisma/client";
import Link from "next/link";
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, FileCheck2, Plus, Search, ShieldAlert, WalletCards } from "lucide-react";
import { notFound } from "next/navigation";
import { createPurchaseInvoice, registerPurchaseInvoicePayment, voidPurchaseInvoice } from "@/app/(app)/proveedores/actions";
import { CompactFilterBar, CompactSearch, EmptyState, Notice, PageHeader, ResultCount, TableShell } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { FISCAL_DOCUMENT_OPTIONS, getPurchaseInvoiceDetail, getPurchaseInvoiceList, PURCHASE_CATEGORY_OPTIONS } from "@/lib/procurement";

type Query = Record<string, string | string[] | undefined>;

export async function PurchaseInvoiceDirectory({ companyId, kind, searchParams }: { companyId: string; kind: BusinessPartnerKind; searchParams: Promise<Query> }) {
  const query = await searchParams;
  const subcontractor = kind === "SUBCONTRACTOR";
  const base = subcontractor ? "/facturas-subcontratas" : "/facturas-proveedor";
  const [invoices, partners, works] = await Promise.all([
    getPurchaseInvoiceList(companyId, kind, { search: first(query.buscar), status: first(query.estado) }),
    prisma.businessPartner.findMany({ where: { companyId, kind, archivedAt: null, status: { not: "BLOCKED" } }, orderBy: { commercialName: "asc" }, select: { id: true, commercialName: true, paymentDueDays: true, preferredPaymentMethod: true } }),
    prisma.work.findMany({ where: { companyId, archivada: false }, orderBy: { titulo: "asc" }, select: { id: true, titulo: true } })
  ]);
  const pending = sum(invoices.filter((invoice) => invoice.status !== "VOID").map((invoice) => invoice.pendingAmount));
  const overdue = sum(invoices.filter((invoice) => invoice.status === "OVERDUE").map((invoice) => invoice.pendingAmount));
  return <main className="screen">
    <PageHeader
      eyebrow={subcontractor ? "Coste real de obra" : "Compras y pagos"}
      title={subcontractor ? "Facturas de subcontratas" : "Facturas de proveedor"}
      description={subcontractor ? "Certificaciones, trabajos realizados, retenciones, pagos y vencimientos separados de las compras ordinarias." : "Facturas recibidas, pagos parciales, vencimientos, adjuntos y gasto asociado sin duplicar datos."}
      action={<Link href={`${base}?nuevo=1#factura`} className="primary-button"><Plus size={18} />Registrar factura</Link>}
    >
      <CompactFilterBar><form action={base} className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_14rem_auto]">
        <label><span className="label mb-1 block">Buscar</span><CompactSearch name="buscar" defaultValue={first(query.buscar)} placeholder="Factura, proveedor, NIF o concepto..." /></label>
        <label><span className="label mb-1 block">Estado</span><select className="field" name="estado" defaultValue={first(query.estado) || ""}><option value="">Todos</option>{statusOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <button className="primary-button self-end" type="submit"><Search size={18} />Aplicar</button>
      </form></CompactFilterBar>
    </PageHeader>
    {first(query.error) ? <Notice tone="danger" title="No se pudo completar la operación" description={errorMessage(first(query.error))} /> : null}
    <section className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={FileCheck2} label="Facturas" value={String(invoices.length)} />
      <Metric icon={WalletCards} label="Pendiente" value={formatCurrency(pending)} tone={pending ? "warning" : "neutral"} />
      <Metric icon={AlertTriangle} label="Vencido" value={formatCurrency(overdue)} tone={overdue ? "danger" : "neutral"} />
      <Metric icon={Banknote} label="Pagado" value={formatCurrency(sum(invoices.map((invoice) => invoice.paidAmount)))} />
    </section>
    {first(query.nuevo) === "1" ? <section id="factura" className="card mb-5 p-4 sm:p-6"><h2 className="text-xl font-black">Registrar {subcontractor ? "factura de subcontrata" : "factura de proveedor"}</h2><p className="mt-1 text-sm text-slate-600">Se creará un gasto enlazado para alimentar obra y tesorería una sola vez.</p><InvoiceForm kind={kind} partners={partners} works={works} selectedPartner={first(query.partner)} selectedWork={first(query.obra)} /></section> : null}
    <ResultCount shown={invoices.length} total={invoices.length} noun="facturas" />
    {invoices.length ? <>
      <div className="hidden lg:block"><TableShell label="Facturas recibidas"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Factura</th><th className="px-4 py-3">{subcontractor ? "Subcontrata" : "Proveedor"}</th><th className="px-4 py-3">Obra</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Pendiente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{invoices.map((invoice) => <tr key={invoice.id}><td className="px-4 py-4"><Link className="font-black hover:underline" href={`${base}/${invoice.id}`}>{invoice.invoiceNumber}</Link><p className="text-xs text-slate-500">{invoice.description}</p></td><td className="px-4 py-4"><Link className="font-bold hover:underline" href={`${subcontractor ? "/subcontratas" : "/proveedores"}/${invoice.businessPartner.id}`}>{invoice.businessPartner.commercialName}</Link><p className="text-xs text-slate-500">{invoice.businessPartner.taxId || "NIF pendiente"}</p></td><td className="px-4 py-4">{invoice.work?.titulo || "Gasto general"}</td><td className="px-4 py-4">{formatDate(invoice.dueDate)}</td><td className="px-4 py-4 font-black">{formatCurrency(invoice.total)}</td><td className="px-4 py-4 font-black text-obra-red">{formatCurrency(invoice.pendingAmount)}</td><td className="px-4 py-4"><InvoiceStatus status={invoice.status} /></td><td className="px-4 py-4 text-right"><Link className="secondary-button" href={`${base}/${invoice.id}`}>Revisar</Link></td></tr>)}</tbody></table></TableShell></div>
      <div className="grid gap-3 lg:hidden">{invoices.map((invoice) => <article key={invoice.id} className="card p-4"><div className="flex justify-between gap-3"><div><Link href={`${base}/${invoice.id}`} className="font-black">{invoice.invoiceNumber}</Link><p className="text-sm text-slate-600">{invoice.businessPartner.commercialName}</p></div><InvoiceStatus status={invoice.status} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Mini label="Total" value={formatCurrency(invoice.total)} /><Mini label="Pendiente" value={formatCurrency(invoice.pendingAmount)} /><Mini label="Vencimiento" value={formatDate(invoice.dueDate)} /><Mini label="Obra" value={invoice.work?.titulo || "General"} /></div><Link className="primary-button mt-3 w-full" href={`${base}/${invoice.id}`}>Abrir factura</Link></article>)}</div>
    </> : <EmptyState icon={FileCheck2} title="No hay facturas con estos criterios" description="Registra una factura recibida para controlar el gasto y su vencimiento." action={<Link className="primary-button" href={`${base}?nuevo=1#factura`}><Plus size={18} />Registrar factura</Link>} />}
  </main>;
}

export async function PurchaseInvoiceProfile({ companyId, kind, id, searchParams }: { companyId: string; kind: BusinessPartnerKind; id: string; searchParams: Promise<Query> }) {
  const [invoice, query] = await Promise.all([getPurchaseInvoiceDetail(companyId, id, kind), searchParams]);
  if (!invoice) notFound();
  const sub = kind === "SUBCONTRACTOR";
  const base = sub ? "/facturas-subcontratas" : "/facturas-proveedor";
  const partnerBase = sub ? "/subcontratas" : "/proveedores";
  return <main className="screen">
    <PageHeader eyebrow={sub ? "Factura de subcontrata" : "Factura de proveedor"} title={invoice.invoiceNumber} description={`${invoice.businessPartner.commercialName} · ${invoice.description}`} badge={<InvoiceStatus status={invoice.status} />} action={<Link className="secondary-button" href={base}>Volver</Link>} />
    {first(query.saved) ? <Notice tone="success" title="Factura registrada" description="El gasto, el vencimiento y el historial se han creado de forma transaccional." /> : null}
    {first(query.payment) ? <Notice tone="success" title="Pago registrado" description="El importe pendiente y el estado se han recalculado." /> : null}
    {first(query.voided) ? <Notice tone="warning" title="Factura anulada" description="El gasto enlazado se conserva como cancelado para mantener trazabilidad." /> : null}
    {first(query.error) ? <Notice tone="danger" description={errorMessage(first(query.error))} /> : null}
    <section className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Banknote} label="Base" value={formatCurrency(invoice.taxableBase)} /><Metric icon={FileCheck2} label="Total" value={formatCurrency(invoice.total)} /><Metric icon={CheckCircle2} label="Pagado" value={formatCurrency(invoice.paidAmount)} /><Metric icon={CalendarClock} label="Pendiente" value={formatCurrency(invoice.pendingAmount)} tone={invoice.pendingAmount ? "warning" : "neutral"} /></section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]">
      <div className="grid content-start gap-5">
        <section className="card p-4 sm:p-6"><h2 className="text-lg font-black">Datos fiscales y económicos</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label={sub ? "Subcontrata" : "Proveedor"} value={invoice.businessPartner.commercialName} href={`${partnerBase}/${invoice.businessPartner.id}`} /><Info label="NIF/CIF" value={invoice.businessPartner.taxId} /><Info label="Tipo fiscal" value={fiscalLabel(invoice.fiscalType)} /><Info label="Fecha de emisión" value={formatDate(invoice.issueDate)} /><Info label="Vencimiento" value={formatDate(invoice.dueDate)} /><Info label="Forma de pago" value={invoice.paymentMethod} /><Info label="Base imponible" value={formatCurrency(invoice.taxableBase)} /><Info label="IVA" value={`${invoice.vatRate ?? "—"}% · ${formatCurrency(invoice.vatAmount)}`} /><Info label="IRPF" value={`${invoice.withholdingRate ?? "—"}% · ${formatCurrency(invoice.withholdingAmount)}`} /><Info label="Obra" value={invoice.work?.titulo || "Gasto general"} href={invoice.work ? `/obras/${invoice.work.id}` : undefined} /></div>{sub ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Trabajos realizados" value={invoice.workDescription} /><Info label="Certificaciones" value={certificationText(invoice.certifications)} /></div> : null}{invoice.notes ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><strong>Observaciones:</strong> {invoice.notes}</div> : null}</section>
        <section className="card overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-black">Pagos parciales</h2></div>{invoice.payments.length ? <div className="divide-y divide-slate-100">{invoice.payments.map((payment) => <div key={payment.id} className="flex justify-between gap-3 p-4"><div><p className="font-bold">{payment.method}</p><p className="text-xs text-slate-500">{formatDate(payment.paidAt)}{payment.reference ? ` · ${payment.reference}` : ""}</p></div><p className="font-black">{formatCurrency(payment.amount)}</p></div>)}</div> : <p className="p-4 text-sm text-slate-500">Todavía no hay pagos registrados.</p>}</section>
        <section className="card p-4"><h2 className="font-black">Documentos y adjuntos</h2>{invoice.documents.length ? <div className="mt-3 grid gap-2">{invoice.documents.map((document) => <Link key={document.id} href={`/gastos-materiales/lector/${document.id}/archivo`} className="rounded-xl border border-slate-200 p-3 font-bold hover:border-obra-yellowDark">{document.name}</Link>)}</div> : <p className="mt-2 text-sm text-slate-500">Los documentos aparecerán aquí al registrar la factura desde la bandeja documental.</p>}</section>
      </div>
      <aside className="grid content-start gap-5">
        {invoice.status !== "PAID" && invoice.status !== "VOID" ? <section className="card p-4"><h2 className="font-black">Registrar pago</h2><form action={registerPurchaseInvoicePayment} className="mt-3 grid gap-3"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="purchaseInvoiceId" value={invoice.id} /><Field label="Importe"><input className="field" required type="number" min="0.01" max={invoice.pendingAmount} step="0.01" name="amount" /></Field><Field label="Fecha"><input className="field" required type="date" name="paidAt" defaultValue={new Date().toISOString().slice(0, 10)} /></Field><Field label="Método"><input className="field" required name="method" defaultValue={invoice.paymentMethod || ""} /></Field><Field label="Referencia"><input className="field" name="reference" /></Field><button className="primary-button" type="submit"><WalletCards size={18} />Guardar pago</button></form></section> : null}
        <section className="card p-4"><h2 className="font-black">Historial</h2><div className="mt-3 grid gap-3">{invoice.history.map((item) => <div key={item.id} className="border-l-2 border-obra-yellow pl-3"><p className="text-sm font-bold">{item.detail}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>)}</div></section>
        {invoice.status !== "VOID" && invoice.paidAmount === 0 ? <form action={voidPurchaseInvoice} className="card p-4"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="purchaseInvoiceId" value={invoice.id} /><label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" required name="confirmed" value="yes" /><span>Confirmo que quiero anular la factura conservando su trazabilidad.</span></label><button className="danger-button mt-3 w-full" type="submit"><ShieldAlert size={18} />Anular factura</button></form> : null}
      </aside>
    </div>
  </main>;
}

function InvoiceForm({ kind, partners, works, selectedPartner, selectedWork }: { kind: BusinessPartnerKind; partners: Array<{ id: string; commercialName: string; paymentDueDays: number; preferredPaymentMethod: string | null }>; works: Array<{ id: string; titulo: string }>; selectedPartner?: string; selectedWork?: string }) {
  const sub = kind === "SUBCONTRACTOR";
  const today = new Date().toISOString().slice(0, 10);
  return <form action={createPurchaseInvoice} className="mt-4 grid gap-4">
    <input type="hidden" name="kind" value={kind} />
    <div className="grid gap-4 md:grid-cols-2"><Field label={sub ? "Subcontrata" : "Proveedor"}><select className="field" required name="businessPartnerId" defaultValue={selectedPartner || ""}><option value="">Selecciona una ficha</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.commercialName}</option>)}</select></Field><Field label="Obra"><select className="field" name="workId" defaultValue={selectedWork || ""}><option value="">Gasto general, sin obra</option>{works.map((work) => <option key={work.id} value={work.id}>{work.titulo}</option>)}</select></Field></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Número de factura"><input className="field" required name="invoiceNumber" /></Field><Field label="Tipo fiscal"><select className="field" name="fiscalType">{FISCAL_DOCUMENT_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Emisión"><input className="field" required type="date" name="issueDate" defaultValue={today} /></Field><Field label="Vencimiento"><input className="field" required type="date" name="dueDate" defaultValue={today} /></Field></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Field label="Base"><input className="field" required type="number" min="0" step="0.01" name="taxableBase" /></Field><Field label="IVA %"><input className="field" type="number" min="0" max="100" step="0.01" name="vatRate" defaultValue="21" /></Field><Field label="IVA importe"><input className="field" type="number" min="0" step="0.01" name="vatAmount" /></Field><Field label="IRPF importe"><input className="field" type="number" min="0" step="0.01" name="withholdingAmount" defaultValue="0" /></Field><Field label="Total"><input className="field" required type="number" min="0" step="0.01" name="total" /></Field></div>
    <div className="grid gap-4 md:grid-cols-3">{sub ? <Field label="IRPF %"><input className="field" type="number" min="0" max="100" step="0.01" name="withholdingRate" /></Field> : null}<Field label="Categoría"><select className="field" name="category" defaultValue={sub ? "subcontrata" : "materiales"}>{PURCHASE_CATEGORY_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Forma de pago"><input className="field" name="paymentMethod" /></Field></div>
    <Field label="Concepto"><input className="field" required name="description" /></Field>
    {sub ? <div className="grid gap-4 md:grid-cols-2"><Field label="Trabajos realizados"><textarea className="field min-h-24" name="workDescription" /></Field><Field label="Certificaciones"><textarea className="field min-h-24" name="certifications" placeholder="Certificación, periodo, medición o hito..." /></Field></div> : null}
    <Field label="Observaciones"><textarea className="field min-h-20" name="notes" /></Field>
    <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">La salida prevista se registrará mediante el gasto enlazado. La factura conservará pagos, vencimiento e historial.</p>
    <button className="primary-button w-full sm:w-auto" type="submit">Registrar factura y gasto</button>
  </form>;
}

const statusOptions = [["PENDING", "Pendiente"], ["PARTIALLY_PAID", "Parcialmente pagada"], ["PAID", "Pagada"], ["OVERDUE", "Vencida"], ["VOID", "Anulada"]] as const;
function InvoiceStatus({ status }: { status: string }) { const style = ({ PENDING: "bg-blue-100 text-blue-800", PARTIALLY_PAID: "bg-amber-100 text-amber-900", PAID: "bg-emerald-100 text-emerald-800", OVERDUE: "bg-red-100 text-red-800", VOID: "bg-slate-200 text-slate-700" } as Record<string, string>)[status] || "bg-slate-100"; const label = statusOptions.find(([id]) => id === status)?.[1] || status; return <span className={`rounded-full px-2 py-1 text-xs font-black ${style}`}>{label}</span>; }
function Metric({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Banknote; label: string; value: string; tone?: "neutral" | "warning" | "danger" }) { return <div className={`card p-4 ${tone === "warning" ? "border-amber-300" : tone === "danger" ? "border-red-300" : ""}`}><div className="flex justify-between"><p className="label">{label}</p><Icon size={18} /></div><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 truncate font-black">{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1"><span className="text-sm font-black">{label}</span>{children}</label>; }
function Info({ label, value, href }: { label: string; value?: string | null; href?: string }) { return <div><p className="label">{label}</p>{href ? <Link href={href} className="mt-1 block text-sm font-bold underline decoration-obra-yellowDark/40">{value || "Sin indicar"}</Link> : <p className="mt-1 text-sm font-bold">{value || "Sin indicar"}</p>}</div>; }
function fiscalLabel(value: string) { return FISCAL_DOCUMENT_OPTIONS.find(([id]) => id === value)?.[1] || value; }
function certificationText(value: unknown) { return value && typeof value === "object" && "summary" in value ? String((value as { summary?: unknown }).summary || "Sin indicar") : "Sin indicar"; }
function errorMessage(value?: string) { return ({ invalid_partner: "Selecciona una ficha activa de esta empresa.", invalid_work: "La obra no existe o no pertenece a esta empresa.", invalid_due_date: "El vencimiento no puede ser anterior a la emisión.", duplicate_invoice: "Ya existe esa factura para la misma entidad.", invalid_amount: "El pago debe ser positivo y no superar el importe pendiente.", invalid_totals: "La base, el IVA, el IRPF y el total no cuadran.", cannot_void: "No se puede anular una factura con pagos registrados.", confirmation_required: "Confirma expresamente la anulación.", required_fields: "Completa los campos obligatorios." } as Record<string, string>)[value || ""] || "Revisa los datos fiscales, fechas e importes."; }
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
