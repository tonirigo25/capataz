import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, FileCheck2, FileText, Filter, Search, SlidersHorizontal, Upload, WalletCards } from "lucide-react";
import { PurchaseInvoiceRailContext } from "@/components/portal/purchase-invoice-rail-context";
import type { PurchaseAccess } from "@/lib/commercial/purchase-access";
import { purchaseRelationAllowed } from "@/lib/commercial/purchase-access";
import { getPurchaseInvoiceDetail, getPurchaseInvoiceList } from "@/lib/procurement";
import styles from "./supplier-invoice-directory-v2.module.css";

type QueryRecord = Record<string, string | string[] | undefined>;
type InvoiceListItem = Awaited<ReturnType<typeof getPurchaseInvoiceList>>[number];

export async function SupplierInvoiceDirectoryV2({ companyId, searchParams, access, canExport }: { companyId: string; searchParams: Promise<QueryRecord>; access: PurchaseAccess; canExport: boolean }) {
  const raw = await searchParams;
  const all = await getPurchaseInvoiceList(companyId, "SUPPLIER");
  const scoped = all.filter((invoice) => purchaseRelationAllowed(access.read, invoice.workId, invoice.expense?.clienteId));
  const filtered = scoped.filter((invoice) => matches(invoice, raw));
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, numberValue(raw.pagina, 1)));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const requestedSelection = first(raw.seleccion);
  const selectedListItem = visible.find((invoice) => invoice.id === requestedSelection) ?? visible[0] ?? null;
  const selected = selectedListItem ? await getPurchaseInvoiceDetail(companyId, selectedListItem.id, "SUPPLIER") : null;
  const selectedAllowed = selected && purchaseRelationAllowed(access.read, selected.workId, selected.expense?.clienteId) ? selected : null;
  const panel = ["detalle", "documento", "historial"].includes(first(raw.panel) ?? "") ? first(raw.panel)! : "detalle";
  const partners = unique(scoped.map((invoice) => [invoice.businessPartner.id, invoice.businessPartner.commercialName] as const));
  const works = unique(scoped.flatMap((invoice) => invoice.work ? [[invoice.work.id, invoice.work.titulo] as const] : []));
  const metrics = metricValues(scoped);
  const canCreate = access.manage.allowed && (access.manage.scope === "COMPANY" || scoped.some((invoice) => purchaseRelationAllowed(access.manage, invoice.workId, invoice.expense?.clienteId)));
  const attention = scoped.filter((invoice) => invoice.status === "OVERDUE").slice(0, 3).map((invoice) => ({ id: invoice.id, title: invoice.invoiceNumber, detail: `${invoice.businessPartner.commercialName} · ${formatCurrency(invoice.pendingAmount)}`, href: `/facturas-proveedor?seleccion=${encodeURIComponent(invoice.id)}#directorio` }));

  return <main className={styles.page} data-purchase-invoice-workspace>
    <PurchaseInvoiceRailContext value={{ visibleCount: scoped.length, overdueCount: metrics.overdue.count, overdueAmount: metrics.overdue.amount, pendingAmount: metrics.pending.amount, unassignedCount: scoped.filter((invoice) => !invoice.workId && invoice.status !== "VOID").length, attention }} />
    <header className={styles.header}><div><h1>Facturas proveedor</h1><p>Gestiona, revisa y controla todas las facturas de proveedores con datos registrados en tu empresa.</p></div></header>

    <section className={styles.metrics} aria-label="Indicadores de facturas de proveedor">
      <Metric icon={<FileCheck2 size={16} />} label="Pendientes de revisión" value={String(metrics.review.count)} amount={metrics.review.amount} tone="warning" href={hrefWith(raw, { estado: "revision", pagina: null })} />
      <Metric icon={<CheckCircle2 size={16} />} label="Revisadas" value={String(metrics.reviewed.count)} amount={metrics.reviewed.amount} tone="success" href={hrefWith(raw, { estado: "revisada", pagina: null })} />
      <Metric icon={<Clock3 size={16} />} label="Pendientes de pago" value={String(metrics.pending.count)} amount={metrics.pending.amount} tone="info" href={hrefWith(raw, { estado: "pendiente", pagina: null })} />
      <Metric icon={<AlertTriangle size={16} />} label="Vencidas" value={String(metrics.overdue.count)} amount={metrics.overdue.amount} tone="danger" href={hrefWith(raw, { estado: "vencida", pagina: null })} />
      <Metric icon={<WalletCards size={16} />} label="Pagadas (30 días)" value={String(metrics.paid.count)} amount={metrics.paid.amount} tone="success" href={hrefWith(raw, { estado: "pagada", pagina: null })} />
    </section>

    <form className={styles.filters} method="get" action="/facturas-proveedor" aria-label="Filtros de facturas de proveedor">
      <SelectField label="Estado" name="estado" value={first(raw.estado) ?? "all"} options={[["all", "Todos"], ["revision", "Pendientes de revisión"], ["revisada", "Revisadas"], ["pendiente", "Pendientes de pago"], ["vencida", "Vencidas"], ["pagada", "Pagadas"]]} />
      <SelectField label="Proveedor" name="proveedor" value={first(raw.proveedor) ?? "all"} options={[["all", "Todos"], ...partners]} />
      <SelectField label="Proyecto" name="proyecto" value={first(raw.proyecto) ?? "all"} options={[["all", "Todos"], ...works]} />
      <SelectField label="Fecha emisión" name="periodo" value={first(raw.periodo) ?? "all"} options={[["all", "Todas"], ["30", "Últimos 30 días"], ["90", "Últimos 90 días"], ["365", "Último año"]]} />
      <details className={styles.moreFilters}><summary><SlidersHorizontal size={14} /><span>Más filtros</span></summary><div><label><input type="checkbox" name="sinObra" value="1" defaultChecked={first(raw.sinObra) === "1"} /> Sin proyecto asignado</label><label><input type="checkbox" name="conDocumento" value="1" defaultChecked={first(raw.conDocumento) === "1"} /> Con documento adjunto</label></div></details>
      <label className={styles.search}><Search size={14} /><input name="buscar" defaultValue={first(raw.buscar) ?? ""} placeholder="Buscar factura…" /><button type="submit" aria-label="Aplicar búsqueda"><ChevronRight size={14} /></button></label>
      <button className={styles.apply} type="submit"><Filter size={14} /><span>Aplicar</span></button>
      {canExport ? <Link className={styles.secondaryButton} href={exportHref(raw)}><Download size={14} /><span>Exportar</span></Link> : null}
      {canCreate ? <Link className={styles.primaryButton} href="/gastos-materiales/lector"><Upload size={14} /><span>Subir factura</span></Link> : null}
    </form>

    <section id="directorio" className={styles.workspace} aria-label="Directorio y detalle de facturas de proveedor">
      <div className={styles.listPane}>
        {visible.length ? <>
          <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Factura</th><th>Proveedor</th><th>Importe</th><th>Emisión</th><th>Vencimiento</th><th>Base</th><th>IVA</th><th>Proyecto</th><th>Etapa</th><th>Pago</th></tr></thead><tbody>{visible.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} raw={raw} selected={selectedListItem?.id === invoice.id} />)}</tbody></table></div>
          <div className={styles.mobileList}>{visible.map((invoice) => <MobileInvoice key={invoice.id} invoice={invoice} raw={raw} selected={selectedListItem?.id === invoice.id} />)}</div>
          <footer className={styles.tableFooter}><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length} facturas</span><nav aria-label="Paginación">{page > 1 ? <Link href={hrefWith(raw, { pagina: String(page - 1), seleccion: null })} aria-label="Página anterior"><ChevronLeft size={14} /></Link> : <span><ChevronLeft size={14} /></span>}<strong>{page}</strong>{page < pageCount ? <Link href={hrefWith(raw, { pagina: String(page + 1), seleccion: null })} aria-label="Página siguiente"><ChevronRight size={14} /></Link> : <span><ChevronRight size={14} /></span>}</nav></footer>
        </> : <div className={styles.empty}><FileText size={28} /><h2>No hay facturas con estos criterios</h2><p>Cambia los filtros o registra una factura autorizada.</p></div>}
      </div>
      <aside className={styles.detailPane} aria-label="Detalle de factura seleccionada">{selectedAllowed ? <InvoiceDetail invoice={selectedAllowed} raw={raw} panel={panel} canPay={purchaseRelationAllowed(access.pay, selectedAllowed.workId, selectedAllowed.expense?.clienteId)} /> : <div className={styles.detailEmpty}><FileText size={30} /><h2>Selecciona una factura</h2><p>Abre una fila para revisar datos fiscales, documento, historial y acciones autorizadas.</p></div>}</aside>
    </section>
  </main>;
}

function Metric({ icon, label, value, amount, tone, href }: { icon: React.ReactNode; label: string; value: string; amount: number; tone: string; href: string }) { return <Link href={href} className={styles.metric} data-tone={tone}><span className={styles.metricIcon}>{icon}</span><span><small>{label}</small><strong>{value}</strong><em>{formatCurrency(amount)}</em></span><ChevronRight size={14} /></Link>; }
function SelectField({ label, name, value, options }: { label: string; name: string; value: string; options: ReadonlyArray<readonly [string, string]> }) { return <label className={styles.selectField}><span>{label}</span><select name={name} defaultValue={value}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }

function InvoiceRow({ invoice, raw, selected }: { invoice: InvoiceListItem; raw: QueryRecord; selected: boolean }) {
  return <tr data-selected={selected ? "true" : "false"}><td><Link className={styles.invoiceNumber} href={hrefWith(raw, { seleccion: invoice.id }, "directorio")}><strong>{invoice.invoiceNumber}</strong><StatusBadge invoice={invoice} /></Link></td><td><Link href={`/proveedores/${invoice.businessPartner.id}`}><strong>{invoice.businessPartner.commercialName}</strong><small>{invoice.businessPartner.taxId || "CIF/NIF pendiente"}</small></Link></td><td><strong>{formatCurrency(invoice.total)}</strong></td><td>{formatDate(invoice.issueDate)}</td><td data-overdue={invoice.status === "OVERDUE"}>{formatDate(invoice.dueDate)}</td><td>{formatCurrency(invoice.taxableBase)}</td><td>{invoice.vatRate == null ? "—" : `${invoice.vatRate}%`}<small>{formatCurrency(invoice.vatAmount)}</small></td><td>{invoice.work ? <Link href={`/obras/${invoice.work.id}`}>{invoice.work.titulo}</Link> : <span className={styles.muted}>Sin asignar</span>}</td><td><span className={styles.stage}>{stageLabel(invoice)}</span></td><td><PaymentBadge invoice={invoice} /></td></tr>;
}
function MobileInvoice({ invoice, raw, selected }: { invoice: InvoiceListItem; raw: QueryRecord; selected: boolean }) { return <Link href={hrefWith(raw, { seleccion: invoice.id }, "directorio")} className={styles.mobileInvoice} data-selected={selected ? "true" : "false"}><header><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.businessPartner.commercialName}</small></span><StatusBadge invoice={invoice} /></header><dl><div><dt>Total</dt><dd>{formatCurrency(invoice.total)}</dd></div><div><dt>Vencimiento</dt><dd>{formatDate(invoice.dueDate)}</dd></div><div><dt>Proyecto</dt><dd>{invoice.work?.titulo ?? "Sin asignar"}</dd></div><div><dt>Pago</dt><dd>{paymentLabel(invoice)}</dd></div></dl></Link>; }

function InvoiceDetail({ invoice, raw, panel, canPay }: { invoice: NonNullable<Awaited<ReturnType<typeof getPurchaseInvoiceDetail>>>; raw: QueryRecord; panel: string; canPay: boolean }) {
  const baseHref = (nextPanel: string) => hrefWith(raw, { seleccion: invoice.id, panel: nextPanel }, "directorio");
  const primaryDocument = invoice.documents[0] ?? null;
  return <><header className={styles.detailHeader}><div><strong>{invoice.invoiceNumber}</strong><StatusBadge invoice={invoice} /></div><Link href="/facturas-proveedor" aria-label="Cerrar detalle">×</Link></header><nav className={styles.detailTabs} aria-label="Secciones del detalle"><Link href={baseHref("detalle")} aria-current={panel === "detalle" ? "page" : undefined}>Detalle</Link><Link href={baseHref("documento")} aria-current={panel === "documento" ? "page" : undefined}>Documento</Link><Link href={baseHref("historial")} aria-current={panel === "historial" ? "page" : undefined}>Historial</Link></nav><div className={styles.detailBody}>
    {panel === "detalle" ? <div className={styles.detailGrid}><Info label="Proveedor" value={invoice.businessPartner.commercialName} href={`/proveedores/${invoice.businessPartner.id}`} /><Info label="CIF/NIF" value={invoice.businessPartner.taxId || "Pendiente"} /><Info label="Proyecto" value={invoice.work?.titulo || "Sin proyecto asignado"} href={invoice.work ? `/obras/${invoice.work.id}` : undefined} /><Info label="Fecha emisión" value={formatDate(invoice.issueDate)} /><Info label="Fecha vencimiento" value={formatDate(invoice.dueDate)} emphasis={invoice.status === "OVERDUE"} /><Info label="Forma de pago" value={invoice.paymentMethod || "Sin especificar"} /><Info label="Base imponible" value={formatCurrency(invoice.taxableBase)} /><Info label="IVA" value={`${invoice.vatRate ?? "—"}% · ${formatCurrency(invoice.vatAmount)}`} /><Info label="Total" value={formatCurrency(invoice.total)} /><Info label="Pendiente" value={formatCurrency(invoice.pendingAmount)} emphasis={invoice.pendingAmount > 0} /></div> : null}
    {panel === "documento" ? <div className={styles.documentPanel}><div className={styles.documentTitle}><FileText size={20} /><span><strong>{primaryDocument?.name ?? "Sin documento adjunto"}</strong><small>{primaryDocument ? "Documento vinculado a la factura" : "Sube el original desde la bandeja documental"}</small></span></div><div className={styles.documentPreview}><span>FACTURA</span><strong>{invoice.invoiceNumber}</strong><small>{invoice.businessPartner.commercialName}</small><dl><div><dt>Base imponible</dt><dd>{formatCurrency(invoice.taxableBase)}</dd></div><div><dt>IVA</dt><dd>{formatCurrency(invoice.vatAmount)}</dd></div><div><dt>Total</dt><dd>{formatCurrency(invoice.total)}</dd></div></dl></div>{primaryDocument?.storageKey ? <Link className={styles.secondaryButton} href={`/gastos-materiales/lector/${primaryDocument.id}/archivo`}>Abrir documento<ExternalLink size={13} /></Link> : <Link className={styles.secondaryButton} href="/gastos-materiales/lector">Subir documento<Upload size={13} /></Link>}</div> : null}
    {panel === "historial" ? <ol className={styles.history}>{invoice.history.length ? invoice.history.map((item) => <li key={item.id}><i /><div><strong>{item.detail}</strong><time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time></div></li>) : <li><div><strong>Sin eventos registrados</strong><span>La trazabilidad aparecerá aquí.</span></div></li>}</ol> : null}
  </div><footer className={styles.detailActions}><Link className={styles.secondaryButton} href={`/facturas-proveedor/${invoice.id}`}>Ficha completa</Link>{canPay && invoice.status !== "PAID" && invoice.status !== "VOID" ? <Link className={styles.primaryButton} href={`/facturas-proveedor/${invoice.id}#pago`}>Registrar pago</Link> : null}</footer></>;
}

function Info({ label, value, href, emphasis }: { label: string; value: string; href?: string; emphasis?: boolean }) { return <div className={styles.info} data-emphasis={emphasis ? "true" : "false"}><span>{label}</span>{href ? <Link href={href}>{value}<ExternalLink size={10} /></Link> : <strong>{value}</strong>}</div>; }
function StatusBadge({ invoice }: { invoice: InvoiceListItem }) { const data = statusPresentation(invoice); return <span className={styles.badge} data-tone={data.tone}>{data.label}</span>; }
function PaymentBadge({ invoice }: { invoice: InvoiceListItem }) { return <span className={styles.paymentBadge} data-status={invoice.status}>{paymentLabel(invoice)}<small>{invoice.pendingAmount > 0 ? formatCurrency(invoice.pendingAmount) : formatDate(invoice.updatedAt)}</small></span>; }
function statusPresentation(invoice: InvoiceListItem) { if (invoice.status === "VOID") return { label: "Anulada", tone: "neutral" }; if (invoice.status === "OVERDUE") return { label: "Vencida", tone: "danger" }; if (invoice.status === "PAID") return { label: "Pagada", tone: "success" }; if (!invoice.documents.length) return { label: "Pendiente de revisión", tone: "warning" }; if (!invoice.workId) return { label: "Sin asignar", tone: "warning" }; return { label: "Revisada", tone: "success" }; }
function stageLabel(invoice: InvoiceListItem) { if (invoice.status === "PAID") return "Pagada"; if (!invoice.documents.length) return "Validación"; if (!invoice.workId) return "Asignación"; return "Pago"; }
function paymentLabel(invoice: InvoiceListItem) { return invoice.status === "PAID" ? "Pagada" : invoice.status === "OVERDUE" ? "Vencida" : invoice.status === "PARTIALLY_PAID" ? "Parcial" : invoice.status === "VOID" ? "Anulada" : "Pendiente"; }

function metricValues(invoices: InvoiceListItem[]) {
  const active = invoices.filter((invoice) => invoice.status !== "VOID");
  const review = active.filter((invoice) => !invoice.documents.length);
  const reviewed = active.filter((invoice) => invoice.documents.length > 0 && invoice.workId);
  const pending = active.filter((invoice) => invoice.status === "PENDING" || invoice.status === "PARTIALLY_PAID");
  const overdue = active.filter((invoice) => invoice.status === "OVERDUE");
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const paid = active.filter((invoice) => invoice.status === "PAID" && invoice.updatedAt >= cutoff);
  return { review: aggregate(review, "total"), reviewed: aggregate(reviewed, "total"), pending: aggregate(pending, "pendingAmount"), overdue: aggregate(overdue, "pendingAmount"), paid: aggregate(paid, "total") };
}
function aggregate(items: InvoiceListItem[], field: "total" | "pendingAmount") { return { count: items.length, amount: items.reduce((sum, item) => sum + item[field], 0) }; }
function matches(invoice: InvoiceListItem, raw: QueryRecord) {
  const state = first(raw.estado) ?? "all";
  if (state === "revision" && invoice.documents.length) return false;
  if (state === "revisada" && (!invoice.documents.length || !invoice.workId || invoice.status === "VOID")) return false;
  if (state === "pendiente" && !["PENDING", "PARTIALLY_PAID"].includes(invoice.status)) return false;
  if (state === "vencida" && invoice.status !== "OVERDUE") return false;
  if (state === "pagada" && invoice.status !== "PAID") return false;
  const partner = first(raw.proveedor); if (partner && partner !== "all" && invoice.businessPartner.id !== partner) return false;
  const work = first(raw.proyecto); if (work && work !== "all" && invoice.workId !== work) return false;
  if (first(raw.sinObra) === "1" && invoice.workId) return false;
  if (first(raw.conDocumento) === "1" && !invoice.documents.length) return false;
  const period = Number(first(raw.periodo)); if (Number.isFinite(period) && period > 0) { const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period); if (invoice.issueDate < cutoff) return false; }
  const search = normalize(first(raw.buscar) ?? ""); if (search && !normalize(`${invoice.invoiceNumber} ${invoice.description} ${invoice.businessPartner.commercialName} ${invoice.businessPartner.taxId ?? ""} ${invoice.work?.titulo ?? ""}`).includes(search)) return false;
  return true;
}
function unique(values: Array<readonly [string, string]>) { return [...new Map(values).entries()].sort((a, b) => a[1].localeCompare(b[1], "es")); }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function formatCurrency(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(value); }
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function numberValue(value: string | string[] | undefined, fallback: number) { const parsed = Number(first(value)); return Number.isFinite(parsed) ? parsed : fallback; }
function hrefWith(raw: QueryRecord, patch: Record<string, string | null>, hash?: string) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(raw)) { const current = first(value); if (current) params.set(key, current); } for (const [key, value] of Object.entries(patch)) { if (value == null || value === "all") params.delete(key); else params.set(key, value); } const query = params.toString(); return `/facturas-proveedor${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`; }
function exportHref(raw: QueryRecord) { const params = new URLSearchParams(); for (const key of ["estado", "proveedor", "proyecto", "periodo", "sinObra", "conDocumento", "buscar"]) { const value = first(raw[key]); if (value && value !== "all") params.set(key, value); } return `/facturas-proveedor/export${params.size ? `?${params}` : ""}`; }
