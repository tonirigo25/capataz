import type { CSSProperties } from "react";
import Link from "next/link";
import {
  BadgeEuro,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { PartnerForm } from "@/components/procurement-partners";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { SupplierRailContext } from "@/components/portal/supplier-rail-context";
import {
  getSupplierWorkspace,
  supplierQualityLabel,
  supplierRiskLabel,
  type SupplierWorkspaceItem,
  type SupplierWorkspaceQuery,
} from "@/lib/supplier-workspace";
import styles from "./supplier-directory-v2.module.css";

type QueryRecord = Record<string, string | string[] | undefined>;

export async function SupplierDirectoryV2({
  companyId,
  searchParams,
  canManage,
  canExport,
}: {
  companyId: string;
  searchParams: Promise<QueryRecord>;
  canManage: boolean;
  canExport: boolean;
}) {
  const raw = await searchParams;
  const query = normalizeQuery(raw);
  const workspace = await getSupplierWorkspace(companyId, query);
  const pageSize = 7;
  const pageCount = Math.max(1, Math.ceil(workspace.filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, numberValue(raw.pagina, 1)));
  const visible = workspace.filtered.slice((page - 1) * pageSize, page * pageSize);
  const isCreating = first(raw.nuevo) === "1";
  const selectedIds = stringValues(raw.id);
  const categoryGradient = donutGradient(workspace.categories.map((entry) => entry.count));

  const railValue = {
    supplierCount: workspace.items.length,
    highRiskCount: workspace.items.filter((item) => item.risk === "high").length,
    overdueExposure: workspace.metrics.overdueExposure,
    overdueInvoices: workspace.metrics.overdueInvoices,
    qualityAverage: workspace.metrics.qualityAverage,
    attention: workspace.attention.map((item) => ({
      id: item.id,
      name: item.commercialName,
      detail: item.overdueDays > 0
        ? `${item.overdueDays} días de atraso · ${formatCurrency(item.overdueAmount)}`
        : `${supplierRiskLabel(item.risk)} · puntuación ${item.riskScore}/100`,
      href: `/proveedores/${item.id}`,
    })),
  };

  return <main className={styles.page} data-supplier-workspace>
    <SupplierRailContext value={railValue} />
    <nav className={styles.breadcrumbs} aria-label="Ruta de navegación">
      <Link href="/dinero">Dinero</Link><ChevronRight size={12} aria-hidden="true" /><span>Proveedores</span>
    </nav>

    <header className={styles.header}>
      <div><h1>Proveedores</h1><p>Gestiona tu red de proveedores, su desempeño y relaciones comerciales con datos registrados en tu empresa.</p></div>
    </header>

    <section className={styles.metrics} aria-label="Indicadores de proveedores">
      <Metric label="Proveedores activos" value={String(workspace.metrics.active)} note={trendLabel(workspace.series.active, "mes anterior")} series={workspace.series.active} />
      <Metric label="Gasto total (MTD)" value={formatCurrency(workspace.metrics.mtdSpend)} note={trendLabel(workspace.series.spend, "mes anterior")} series={workspace.series.spend} />
      <Metric label="Facturas pendientes" value={String(workspace.metrics.pendingInvoices)} note={formatCurrency(workspace.metrics.pendingAmount)} series={workspace.series.pending} tone={workspace.metrics.pendingInvoices ? "warning" : "neutral"} />
      <Metric label="Riesgo promedio" value={workspace.metrics.riskAverage == null ? "—" : String(workspace.metrics.riskAverage)} note={workspace.metrics.riskAverage == null ? "Sin datos" : riskAverageLabel(workspace.metrics.riskAverage)} series={workspace.series.risk} ring={workspace.metrics.riskAverage} />
      <Metric label="Calidad promedio" value={workspace.metrics.qualityAverage == null ? "—" : String(workspace.metrics.qualityAverage)} note={workspace.metrics.qualityAverage == null ? "Sin valorar" : qualityAverageLabel(workspace.metrics.qualityAverage)} series={workspace.series.quality} ring={workspace.metrics.qualityAverage} />
    </section>

    {first(raw.saved) ? <p className={styles.notice} role="status">Proveedor guardado correctamente.</p> : null}
    {first(raw.error) ? <p className={styles.notice} role="alert">No se pudo guardar la ficha. Revisa los campos obligatorios.</p> : null}

    <form className={styles.filters} method="get" action="/proveedores" aria-label="Filtros de proveedores">
      <SelectField label="Estado" name="estado" value={first(raw.estado) ?? "all"} options={[["all", "Todos"], ["ACTIVE", "Activos"], ["INACTIVE", "Inactivos"], ["BLOCKED", "Bloqueados"]]} />
      <SelectField label="Categoría" name="categoria" value={first(raw.categoria) ?? "all"} options={[["all", "Todas"], ...workspace.categories.map((entry) => [entry.label, entry.label] as [string, string])]} />
      <SelectField label="Riesgo" name="riesgo" value={first(raw.riesgo) ?? "all"} options={[["all", "Todos"], ["high", "Alto"], ["medium", "Medio"], ["low", "Bajo"]]} />
      <SelectField label="Calidad" name="calidad" value={first(raw.calidad) ?? "all"} options={[["all", "Todas"], ["high", "Alta"], ["good", "Buena"], ["acceptable", "Aceptable"], ["unrated", "Sin valorar"]]} />
      <details className={styles.moreFilters}>
        <summary className={styles.secondaryButton}><SlidersHorizontal size={14} /><span>Más filtros</span></summary>
        <div className={styles.morePanel}>
          <label><input type="checkbox" name="vencido" value="1" defaultChecked={query.overdueOnly} /> Con facturas vencidas</label>
          <label><input type="checkbox" name="deuda" value="1" defaultChecked={query.pendingOnly} /> Con saldo pendiente</label>
          <label><input type="checkbox" name="sinContrato" value="1" defaultChecked={query.missingContractOnly} /> Sin contrato registrado</label>
          <label>Orden<select name="orden" defaultValue={query.order ?? "name"}><option value="name">Nombre</option><option value="risk">Mayor riesgo</option><option value="spend">Mayor gasto</option></select></label>
          <button className={styles.filterSubmit} type="submit"><Filter size={14} />Aplicar filtros</button>
        </div>
      </details>
      <label className={styles.searchField}><Search size={14} aria-hidden="true" /><input name="buscar" defaultValue={first(raw.buscar) ?? ""} placeholder="Buscar proveedor…" aria-label="Buscar proveedor" /><button type="submit" aria-label="Aplicar búsqueda"><ChevronRight size={14} /></button></label>
      {canExport ? <Link className={styles.secondaryButton} href={exportHref(raw)}><Download size={14} /><span>Exportar</span></Link> : null}
      {canManage ? <Link className={styles.primaryButton} href={hrefWith(raw, { nuevo: "1" }, "ficha-proveedor")}><Plus size={15} /><span>Nuevo proveedor</span></Link> : null}
    </form>

    {isCreating && canManage ? <section id="ficha-proveedor" className={styles.createPanel}>
      <h2>Nueva ficha de proveedor</h2><p>Los datos quedan limitados a esta empresa y pueden completarse después.</p>
      <PartnerForm kind="SUPPLIER" confirmDuplicate={first(raw.duplicate) === "1"} />
    </section> : null}

    <section id="directorio" className={styles.tableCard} aria-labelledby="supplier-directory-title">
      <header className="sr-only"><h2 id="supplier-directory-title">Directorio de proveedores</h2></header>
      {visible.length ? <form method="get" action="/proveedores/export">
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th className={styles.checkCell}><span className="sr-only">Seleccionar</span></th><th className={styles.supplierCell}>Proveedor</th><th className={styles.categoryCell}>Categoría</th><th className={styles.scoreCell}>Riesgo</th><th className={styles.scoreCell}>Calidad</th><th className={styles.paymentCell}>Estado de pago</th><th className={styles.contactCell}>Contacto principal</th><th className={styles.invoiceCell}>Facturas vinculadas</th><th className={styles.contractCell}>Contrato</th><th className={styles.activityCell}>Última actividad</th><th className={styles.actionsCell}>Acciones</th></tr></thead>
            <tbody>{visible.map((supplier) => <SupplierRow key={supplier.id} supplier={supplier} selected={selectedIds.includes(supplier.id)} />)}</tbody>
          </table>
        </div>
        <div className={styles.mobileList}>{visible.map((supplier) => <MobileSupplier key={supplier.id} supplier={supplier} />)}</div>
        <footer className={styles.tableFooter}>
          <span>{workspace.filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, workspace.filtered.length)}` : "0"} de {workspace.filtered.length} proveedores</span>
          <div className={styles.pager}>
            {canExport ? <button className={styles.secondaryButton} type="submit"><Download size={13} /><span>Exportar selección</span></button> : null}
            {page > 1 ? <Link href={hrefWith(raw, { pagina: String(page - 1) })} aria-label="Página anterior"><ChevronLeft size={13} /></Link> : <span aria-hidden="true"><ChevronLeft size={13} /></span>}
            <span>{page}</span>
            {page < pageCount ? <Link href={hrefWith(raw, { pagina: String(page + 1) })} aria-label="Página siguiente"><ChevronRight size={13} /></Link> : <span aria-hidden="true"><ChevronRight size={13} /></span>}
          </div>
        </footer>
      </form> : <div className={styles.empty}><h2>No hay proveedores con estos criterios</h2><p>Prueba otros filtros o crea una ficha cuando tengas autorización.</p></div>}
    </section>

    <section className={styles.bottomGrid} aria-label="Análisis de proveedores">
      <article className={styles.bottomCard}><h2>Proveedores por categoría</h2>{workspace.categories.length ? <div className={styles.categoryBody}><div className={styles.donut} style={{ "--supplier-donut": categoryGradient } as CSSProperties}><span className={styles.donutCenter}><strong>{workspace.items.length}</strong><small>Total</small></span></div><ul className={styles.legend}>{workspace.categories.slice(0, 5).map((entry, index) => <li key={entry.label}><i style={{ background: chartColors[index % chartColors.length] }} /><span>{entry.label}</span><strong>{entry.count}</strong></li>)}</ul></div> : <p>Sin categorías registradas.</p>}<Link className={styles.cardLink} href="/proveedores?orden=name#directorio">Ver detalle</Link></article>
      <article className={styles.bottomCard}><h2>Top proveedores por gasto (MTD)</h2>{workspace.items.some((item) => item.totalSpend > 0) ? <ol className={styles.ranking}>{[...workspace.items].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5).map((item, index) => <li key={item.id}><span>{index + 1}</span><Link href={`/proveedores/${item.id}`}><strong>{item.commercialName}</strong></Link><span>{formatCurrency(item.totalSpend)}</span></li>)}</ol> : <p>Sin facturas registradas para elaborar el ranking.</p>}<Link className={styles.cardLink} href="/proveedores?orden=spend#directorio">Ver ranking completo</Link></article>
      <article className={styles.bottomCard}><h2>Actividad reciente</h2>{workspace.recentActivity.length ? <ol className={styles.activityList}>{workspace.recentActivity.map((item) => <li key={`${item.id}-${item.date.toISOString()}`}><Link href={item.href}><strong>{item.detail}</strong><small>{item.supplier}</small></Link><time dateTime={item.date.toISOString()}>{relativeDate(item.date)}</time></li>)}</ol> : <p>Sin actividad registrada.</p>}<Link className={styles.cardLink} href="/actividad">Ver toda la actividad</Link></article>
    </section>
  </main>;
}

function Metric({ label, value, note, series, tone, ring }: { label: string; value: string; note: string; series: number[]; tone?: "warning" | "neutral"; ring?: number | null }) {
  return <article className={styles.metric} data-tone={tone} data-ring={ring != null ? "true" : undefined}>
    {ring != null ? <span className={styles.metricRing} style={{ "--ring-value": `${ring * 3.6}deg` } as CSSProperties}><strong>{value}</strong></span> : null}
    <div><p className={styles.metricLabel}>{label}</p>{ring == null ? <p className={styles.metricValue}>{value}</p> : null}<p className={styles.metricNote}>{note}</p></div>
    <Sparkline values={series} />
  </article>;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 72; const height = 30; const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - 3 - ((value - min) / range) * (height - 8)}`).join(" ");
  return <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución de los últimos seis meses"><polyline points={points} fill="none" /><path d={`M${points.replaceAll(" ", " L")}`} /></svg>;
}

function SelectField({ label, name, value, options }: { label: string; name: string; value: string; options: Array<[string, string]> }) {
  return <label className={styles.selectField}><span>{label}</span><AutoSubmitSelect name={name} defaultValue={value} label={label}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</AutoSubmitSelect></label>;
}

function SupplierRow({ supplier, selected }: { supplier: SupplierWorkspaceItem; selected: boolean }) {
  const payment = paymentPresentation(supplier);
  return <tr>
    <td className={styles.checkCell}><input type="checkbox" name="id" value={supplier.id} defaultChecked={selected} aria-label={`Seleccionar ${supplier.commercialName}`} /></td>
    <td className={styles.supplierCell}><Link className={styles.supplierIdentity} href={`/proveedores/${supplier.id}`}><span className={styles.supplierMark}>{initials(supplier.commercialName)}</span><span><strong>{supplier.commercialName}</strong><small>{supplier.taxId || "CIF/NIF pendiente"}</small></span></Link></td>
    <td className={styles.categoryCell}><span className={styles.tag}>{supplier.category}</span></td>
    <td className={styles.scoreCell}><Score value={supplier.riskScore} label={supplierRiskLabel(supplier.risk)} band={supplier.risk} /></td>
    <td className={styles.scoreCell}><Score value={supplier.qualityScore} label={supplierQualityLabel(supplier.quality)} band={supplier.quality === "acceptable" ? "medium" : supplier.quality === "unrated" ? "unrated" : "low"} /></td>
    <td className={styles.paymentCell}><div className={styles.payment} data-status={payment.state}><strong className={styles.statusLine}><i className={styles.statusDot} />{payment.label}</strong><small>{payment.detail}</small></div></td>
    <td className={styles.contactCell}><span className={styles.contact}><strong>{supplier.contactPerson || "Sin contacto"}</strong><small>{supplier.email || supplier.phone || "Completar ficha"}</small></span></td>
    <td className={styles.invoiceCell}><span className={styles.invoice}><strong>{supplier.invoiceCount}</strong><small>{formatCurrency(supplier.totalSpend)}</small></span></td>
    <td className={styles.contractCell}><span className={styles.contract} data-state={supplier.contract ? "registered" : "missing"}><strong>{supplier.contract ? "Registrado" : "Sin registrar"}</strong><small>{supplier.contract ? formatDate(supplier.contract.createdAt) : "Revisar"}</small></span></td>
    <td className={styles.activityCell}><span className={styles.activity}><time dateTime={supplier.lastActivityAt.toISOString()}>{relativeDate(supplier.lastActivityAt)}</time><small>{supplier.lastActivity}</small></span></td>
    <td className={styles.actionsCell}><div className={styles.rowActions}><Link className={styles.iconAction} href={`/proveedores/${supplier.id}`} aria-label={`Abrir ficha de ${supplier.commercialName}`}><FileText size={13} /></Link><Link className={styles.iconAction} href={`/facturas-proveedor?buscar=${encodeURIComponent(supplier.commercialName)}`} aria-label={`Ver facturas de ${supplier.commercialName}`}><BadgeEuro size={13} /></Link><Link className={styles.iconAction} href={`/proveedores/${supplier.id}#contacto`} aria-label={`Contactar con ${supplier.commercialName}`}>{supplier.email ? <Mail size={13} /> : <MessageSquareText size={13} />}</Link><Link className={styles.iconAction} href={`/proveedores/${supplier.id}`} aria-label={`Más acciones para ${supplier.commercialName}`}><MoreHorizontal size={13} /></Link></div></td>
  </tr>;
}

function MobileSupplier({ supplier }: { supplier: SupplierWorkspaceItem }) {
  const payment = paymentPresentation(supplier);
  return <Link className={styles.mobileSupplier} href={`/proveedores/${supplier.id}`}><div className={styles.mobileSupplierHeader}><span><strong>{supplier.commercialName}</strong><small>{supplier.category} · {supplier.taxId || "CIF/NIF pendiente"}</small></span><ChevronRight size={16} /></div><div className={styles.mobileSupplierScores}><div><span>Riesgo</span><strong>{supplier.riskScore} · {supplierRiskLabel(supplier.risk)}</strong></div><div><span>Calidad</span><strong>{supplier.qualityScore == null ? "Sin valorar" : `${supplier.qualityScore} · ${supplierQualityLabel(supplier.quality)}`}</strong></div><div><span>Pago</span><strong>{payment.label}</strong></div><div><span>Facturado</span><strong>{formatCurrency(supplier.totalSpend)}</strong></div></div></Link>;
}

function Score({ value, label, band }: { value: number | null; label: string; band: string }) { return <span className={styles.score} data-band={band}><strong>{value ?? "—"}</strong><span>{label}</span></span>; }

function normalizeQuery(raw: QueryRecord): SupplierWorkspaceQuery {
  return { search: first(raw.buscar), status: first(raw.estado), category: first(raw.categoria), risk: first(raw.riesgo), quality: first(raw.calidad), overdueOnly: first(raw.vencido) === "1", pendingOnly: first(raw.deuda) === "1", missingContractOnly: first(raw.sinContrato) === "1", order: first(raw.orden) };
}

function paymentPresentation(item: SupplierWorkspaceItem) {
  if (item.overdueInvoiceCount) return { state: "overdue", label: "Atrasado", detail: `${item.overdueDays} días · ${formatCurrency(item.overdueAmount)}` };
  if (item.pendingInvoiceCount) return { state: "pending", label: "Pendiente", detail: `${item.pendingInvoiceCount} ${item.pendingInvoiceCount === 1 ? "factura" : "facturas"}` };
  return { state: "current", label: "Al día", detail: "Sin vencidos" };
}

const chartColors = ["#0b8f44", "#62bc78", "#166b70", "#f0aa18", "#5d87c8"];
function donutGradient(values: number[]) { const total = values.reduce((sum, value) => sum + value, 0) || 1; let cursor = 0; return `conic-gradient(${values.slice(0, 5).map((value, index) => { const start = cursor; cursor += value / total * 360; return `${chartColors[index % chartColors.length]} ${start}deg ${cursor}deg`; }).join(", ")})`; }
function riskAverageLabel(value: number) { return value >= 75 ? "Riesgo bajo" : value >= 50 ? "Riesgo medio" : "Riesgo alto"; }
function qualityAverageLabel(value: number) { return value >= 85 ? "Calidad alta" : value >= 65 ? "Calidad buena" : "Calidad a revisar"; }
function trendLabel(values: number[], period: string) { const previous = values.at(-2) ?? 0; const current = values.at(-1) ?? 0; if (!previous && !current) return `Sin cambios vs. ${period}`; if (!previous) return `Alta registrada vs. ${period}`; const delta = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10; return `${delta >= 0 ? "+" : ""}${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(delta)}% vs. ${period}`; }
function formatCurrency(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function relativeDate(value: Date) { const days = Math.floor((Date.now() - value.getTime()) / 86_400_000); if (days <= 0) return `Hoy, ${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(value)}`; if (days === 1) return "Ayer"; return `Hace ${days} días`; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PR"; }
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function stringValues(value: string | string[] | undefined) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function numberValue(value: string | string[] | undefined, fallback: number) { const parsed = Number(first(value)); return Number.isFinite(parsed) ? Math.round(parsed) : fallback; }
function hrefWith(raw: QueryRecord, changes: Record<string, string | null>, hash?: string) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(raw)) { if (["pagina", "saved", "error", "duplicate", "nuevo", "id"].includes(key)) continue; for (const item of stringValues(value)) params.append(key, item); } for (const [key, value] of Object.entries(changes)) { params.delete(key); if (value != null) params.set(key, value); } const query = params.toString(); return `/proveedores${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`; }
function exportHref(raw: QueryRecord) { const params = new URLSearchParams(); for (const key of ["buscar", "estado", "categoria", "riesgo", "calidad", "vencido", "deuda", "sinContrato", "orden"]) for (const value of stringValues(raw[key])) params.append(key, value); return `/proveedores/export${params.size ? `?${params.toString()}` : ""}`; }
