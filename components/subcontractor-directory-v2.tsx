import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  BadgeEuro,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound,
} from "lucide-react";
import { PartnerForm } from "@/components/procurement-partners";
import { SupplierRailContext } from "@/components/portal/supplier-rail-context";
import {
  documentStatusLabel,
  getSubcontractorWorkspace,
  subcontractorStatusLabel,
  type SubcontractorItem,
  type SubcontractorQuery,
} from "@/lib/subcontractor-workspace";
import styles from "./subcontractor-directory-v2.module.css";

type QueryRecord = Record<string, string | string[] | undefined>;

export async function SubcontractorDirectoryV2({
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
  const workspace = await getSubcontractorWorkspace(companyId, query);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(workspace.filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, numberValue(raw.pagina, 1)));
  const visible = workspace.filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = workspace.items.find((item) => item.id === first(raw.seleccion)) ?? null;
  const isCreating = first(raw.nuevo) === "1";
  const format = first(raw.formato) === "tarjetas" ? "cards" : "table";
  const donut = complianceGradient(workspace.distribution.map((entry) => entry.count));
  const railValue = {
    kind: "subcontractor" as const,
    supplierCount: workspace.items.length,
    highRiskCount: workspace.attention.length,
    overdueExposure: workspace.metrics.overdueAmount,
    overdueInvoices: workspace.items.reduce((total, item) => total + item.overdueCount, 0),
    qualityAverage: workspace.metrics.complianceAverage,
    attention: workspace.attention.slice(0, 3).map((item) => ({
      id: item.id,
      name: item.commercialName,
      detail: item.overdueCount
        ? `${formatCurrency(item.overdueAmount)} vencidos`
        : `${documentStatusLabel(item.documentStatus)}${item.documentExpiresAt ? ` · ${formatDate(item.documentExpiresAt)}` : ""}`,
      href: `/subcontratas?seleccion=${encodeURIComponent(item.id)}#directorio`,
    })),
  };

  return <main className={styles.page} data-subcontractor-workspace>
    <SupplierRailContext value={railValue} />
    <header className={styles.header}>
      <div><h1>Subcontratas</h1><p>Gestiona tus subcontratas, su cumplimiento y su desempeño en todas las obras.</p></div>
      <div className={styles.headerActions}>
        {canExport ? <Link className={styles.secondaryButton} href={exportHref(raw)}><Download size={14} /><span>Exportar</span></Link> : null}
        {canManage ? <Link className={styles.primaryButton} href={hrefWith(raw, { nuevo: "1" }, "alta-subcontrata")}><Plus size={15} /><span>Nueva subcontrata</span></Link> : null}
      </div>
    </header>

    <section className={styles.metrics} aria-label="Indicadores de subcontratas">
      <Metric label="Subcontratas activas" value={String(workspace.metrics.active)} note={`${workspace.items.length} registradas`} icon={<UsersRound size={17} />} />
      <Metric label="Obras con subcontratas" value={String(workspace.metrics.worksWithSubcontractors)} note={`${workspace.metrics.activeWorks} vinculaciones activas`} icon={<CalendarDays size={17} />} />
      <Metric label="Cumplimiento medio" value={workspace.metrics.complianceAverage == null ? "—" : `${workspace.metrics.complianceAverage}%`} note={workspace.metrics.complianceAverage == null ? "Sin estado documental valorable" : "Según estado documental"} icon={<ShieldCheck size={17} />} />
      <Metric label="Pagos al día" value={workspace.metrics.paymentRate == null ? "—" : `${workspace.metrics.paymentRate}%`} note={workspace.metrics.paymentRate == null ? "Sin facturas pagadas" : `${workspace.metrics.overdueAmount ? formatCurrency(workspace.metrics.overdueAmount) + " vencidos" : "Sin vencidos"}`} icon={<BadgeEuro size={17} />} tone={workspace.metrics.overdueAmount ? "warning" : undefined} />
    </section>

    <nav className={styles.tabs} aria-label="Vistas de subcontratas">
      <Tab raw={raw} id="directorio" label="Directorio" />
      <Tab raw={raw} id="obras" label="Obras activas" />
      <Tab raw={raw} id="cumplimiento" label="Cumplimiento" />
      <Tab raw={raw} id="pagos" label="Pagos" />
      <Tab raw={raw} id="evaluaciones" label="Evaluaciones" />
    </nav>

    {first(raw.saved) ? <p className={styles.notice} role="status">Subcontrata guardada correctamente.</p> : null}
    {first(raw.error) ? <p className={styles.notice} role="alert">No se pudo guardar la ficha. Revisa los campos obligatorios.</p> : null}

    <form className={styles.filters} method="get" action="/subcontratas" aria-label="Filtros de subcontratas">
      <input type="hidden" name="seccion" value={query.view ?? "directorio"} />
      <label className={styles.searchField}><Search size={14} /><input name="buscar" defaultValue={first(raw.buscar) ?? ""} placeholder="Buscar subcontrata…" /><button type="submit" aria-label="Buscar"><ChevronRight size={14} /></button></label>
      <SelectField label="Estado" name="estado" value={first(raw.estado) ?? "all"} options={[["all", "Todos"], ["ACTIVE", "Activas"], ["INACTIVE", "Inactivas"], ["BLOCKED", "Bloqueadas"]]} />
      <SelectField label="Especialidad" name="especialidad" value={first(raw.especialidad) ?? "all"} options={[["all", "Todas"], ...workspace.specialties.map((value) => [value, value] as [string, string])]} />
      <SelectField label="Cumplimiento" name="cumplimiento" value={first(raw.cumplimiento) ?? "all"} options={[["all", "Todos"], ["excellent", "Excelente"], ["attention", "Requiere atención"], ["unrated", "Sin valorar"]]} />
      <SelectField label="Obras" name="obras" value={first(raw.obras) ?? "all"} options={[["all", "Todas"], ["active", "Con obras activas"], ["none", "Sin obra activa"]]} />
      <details className={styles.moreFilters}><summary className={styles.secondaryButton}><SlidersHorizontal size={14} /><span>Más filtros</span></summary><div className={styles.morePanel}><Link href="/subcontratas?seccion=pagos">Con pagos pendientes</Link><Link href="/subcontratas?seccion=evaluaciones">Sin evaluación</Link><Link href="/subcontratas?cumplimiento=attention">Documentación a revisar</Link></div></details>
      <button className={styles.filterSubmit} type="submit">Aplicar</button>
      <div className={styles.viewToggle} aria-label="Vista">
        <Link href={hrefWith(raw, { formato: null })} aria-current={format === "table" ? "page" : undefined} title="Vista de lista"><List size={14} /></Link>
        <Link href={hrefWith(raw, { formato: "tarjetas" })} aria-current={format === "cards" ? "page" : undefined} title="Vista de tarjetas"><Grid2X2 size={14} /></Link>
      </div>
    </form>

    {isCreating && canManage ? <section id="alta-subcontrata" className={styles.createPanel}><h2>Nueva subcontrata</h2><p>La ficha y sus documentos quedan aislados dentro de la empresa activa.</p><PartnerForm kind="SUBCONTRACTOR" confirmDuplicate={Boolean(first(raw.duplicate))} /></section> : null}

    <section id="directorio" className={styles.workspace} data-format={format}>
      <div className={styles.directory}>
        {visible.length ? <>
          <div className={styles.tableScroll} role="region" aria-label="Directorio de subcontratas" tabIndex={0}>
            <table className={styles.table}><thead><tr><th>Subcontrata</th><th>Especialidad</th><th>Obras activas</th><th>Cumplimiento</th><th>Documentación</th><th>Pagos</th><th>Desempeño</th><th>Acciones</th></tr></thead><tbody>{visible.map((item) => <SubcontractorRow key={item.id} item={item} selected={selected?.id === item.id} raw={raw} />)}</tbody></table>
          </div>
          <div className={styles.cardList}>{visible.map((item) => <SubcontractorCard key={item.id} item={item} raw={raw} />)}</div>
          <footer className={styles.tableFooter}><span>{workspace.filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, workspace.filtered.length)}` : 0} de {workspace.filtered.length} subcontratas</span><div className={styles.pager}>{page > 1 ? <Link href={hrefWith(raw, { pagina: String(page - 1) })}><ChevronLeft size={13} /></Link> : <span><ChevronLeft size={13} /></span>}<strong>{page}</strong>{page < pageCount ? <Link href={hrefWith(raw, { pagina: String(page + 1) })}><ChevronRight size={13} /></Link> : <span><ChevronRight size={13} /></span>}</div></footer>
        </> : <div className={styles.empty}><h2>No hay subcontratas con estos criterios</h2><p>Prueba otros filtros o crea una ficha cuando tengas autorización.</p></div>}
      </div>
      <aside className={styles.detailPanel} aria-label="Detalle de subcontrata">
        {selected ? <SubcontractorDetail item={selected} /> : <div className={styles.emptyDetail}><BriefcaseBusiness size={22} /><h2>Detalle de subcontrata</h2><p>Selecciona una fila para consultar obras, documentación, pagos y evaluación sin perder tus filtros.</p></div>}
      </aside>
    </section>

    <section id="indicadores" className={styles.bottomGrid} aria-label="Análisis de subcontratas">
      <article className={styles.bottomCard}><h2>Aprobaciones pendientes <span>{workspace.metrics.expiringDocuments + workspace.metrics.pendingEvaluations}</span></h2><ul className={styles.approvalList}><li><FileCheck2 size={14} /><span><strong>Documentación por revisar</strong><small>{workspace.metrics.expiringDocuments} fichas requieren comprobación</small></span><Link href="/subcontratas?cumplimiento=attention">Revisar</Link></li><li><UsersRound size={14} /><span><strong>Altas sin obra activa</strong><small>{workspace.items.filter((item) => item.activeWorkCount === 0).length} pendientes de vinculación</small></span><Link href="/subcontratas?obras=none">Ver</Link></li><li><Star size={14} /><span><strong>Evaluaciones pendientes</strong><small>{workspace.metrics.pendingEvaluations} sin valoración interna</small></span><Link href="/subcontratas?seccion=evaluaciones">Evaluar</Link></li></ul></article>
      <article className={styles.bottomCard}><h2>Subcontratas por cumplimiento</h2><div className={styles.complianceBody}><div className={styles.donut} style={{ "--subcontractor-donut": donut } as CSSProperties}><span><strong>{workspace.items.length}</strong><small>Total</small></span></div><ul className={styles.legend}>{workspace.distribution.map((entry, index) => <li key={entry.key}><i data-color={index} /><span>{entry.label}</span><strong>{entry.count}</strong></li>)}</ul></div><Link className={styles.cardLink} href="/subcontratas?seccion=cumplimiento">Ver análisis completo</Link></article>
      <article className={styles.bottomCard}><h2>Indicadores de desempeño <small>(datos registrados)</small></h2><div className={styles.performanceGrid}><div><span>Puntualidad de pago</span><strong>{workspace.metrics.paymentRate == null ? "—" : `${workspace.metrics.paymentRate}%`}</strong><small>{workspace.metrics.paymentRate == null ? "Sin histórico pagado" : "Facturas pagadas en plazo"}</small></div><div><span>Calidad media</span><strong>{workspace.metrics.ratedAverage == null ? "—" : `${workspace.metrics.ratedAverage}/5`}</strong><small>{workspace.metrics.ratedAverage == null ? "Sin evaluaciones" : `${workspace.items.filter((item) => item.rating != null).length} evaluadas`}</small></div><div><span>Alertas documentales</span><strong>{workspace.metrics.expiringDocuments}</strong><small>Caducadas, próximas o incompletas</small></div></div><Link className={styles.cardLink} href="/subcontratas?seccion=evaluaciones">Ver todas las métricas</Link></article>
    </section>
  </main>;
}

function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: ReactNode; tone?: "warning" }) { return <article className={styles.metric} data-tone={tone}><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div><span>{icon}</span></article>; }

function Tab({ raw, id, label }: { raw: QueryRecord; id: string; label: string }) { const current = first(raw.seccion) ?? "directorio"; return <Link href={hrefWith(raw, { seccion: id === "directorio" ? null : id, pagina: null })} aria-current={current === id ? "page" : undefined}>{label}</Link>; }

function SelectField({ label, name, value, options }: { label: string; name: string; value: string; options: Array<[string, string]> }) { return <label className={styles.selectField}><span>{label}</span><select name={name} defaultValue={value}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }

function SubcontractorRow({ item, selected, raw }: { item: SubcontractorItem; selected: boolean; raw: QueryRecord }) {
  return <tr data-selected={selected ? "true" : undefined}>
    <td><Link className={styles.identity} href={hrefWith(raw, { seleccion: item.id }, "directorio")}><span>{initials(item.commercialName)}</span><span><strong>{item.commercialName}</strong><small>{item.taxId || item.legalName}</small></span></Link></td>
    <td><span className={styles.specialty}>{item.specialty}</span></td>
    <td><strong>{item.activeWorkCount}</strong><small className={styles.subline}>{item.activeWorks.map((work) => work.title).join(", ") || "Sin obra activa"}</small></td>
    <td><Progress value={item.complianceScore} /></td>
    <td><strong>{item.documentCount} doc.</strong><small className={styles.statusText} data-tone={documentTone(item.documentStatus)}>{documentStatusLabel(item.documentStatus)}</small></td>
    <td><Payment item={item} /></td>
    <td><Rating value={item.rating} /></td>
    <td><div className={styles.rowActions}><Link href={`/subcontratas/${item.id}`} aria-label={`Abrir ficha de ${item.commercialName}`}><FileText size={13} /></Link><Link href={`/documentos?buscar=${encodeURIComponent(item.commercialName)}`} aria-label={`Ver documentos de ${item.commercialName}`}><ClipboardCheck size={13} /></Link><Link href={hrefWith(raw, { seleccion: item.id }, "indicadores")} aria-label={`Ver desempeño de ${item.commercialName}`}><BarChart3 size={13} /></Link><Link href={`/facturas-subcontratas?buscar=${encodeURIComponent(item.commercialName)}`} aria-label={`Ver facturas de ${item.commercialName}`}><BadgeEuro size={13} /></Link><Link href={`/subcontratas/${item.id}`} aria-label={`Más acciones para ${item.commercialName}`}><MoreHorizontal size={13} /></Link></div></td>
  </tr>;
}

function SubcontractorCard({ item, raw }: { item: SubcontractorItem; raw: QueryRecord }) { return <Link className={styles.mobileCard} href={hrefWith(raw, { seleccion: item.id }, "directorio")}><div><span className={styles.avatar}>{initials(item.commercialName)}</span><span><strong>{item.commercialName}</strong><small>{item.specialty}</small></span><ChevronRight size={15} /></div><dl><div><dt>Obras</dt><dd>{item.activeWorkCount}</dd></div><div><dt>Cumplimiento</dt><dd>{item.complianceScore == null ? "Sin valorar" : `${item.complianceScore}%`}</dd></div><div><dt>Documentos</dt><dd>{documentStatusLabel(item.documentStatus)}</dd></div><div><dt>Pagos</dt><dd>{item.overdueCount ? "Atrasados" : item.pendingAmount ? "Pendientes" : "Al día"}</dd></div></dl></Link>; }

function SubcontractorDetail({ item }: { item: SubcontractorItem }) { return <div className={styles.detailContent}>
  <div className={styles.detailHeader}><span className={styles.detailAvatar}>{initials(item.commercialName)}</span><div><h2>{item.commercialName}</h2><p><i />{subcontractorStatusLabel(item.status)}</p></div></div>
  <dl className={styles.detailFacts}><div><dt>Especialidad</dt><dd>{item.specialty}</dd></div><div><dt>Contacto</dt><dd>{item.contactPerson || "Sin contacto"}</dd></div><div><dt>Teléfono</dt><dd>{item.phone || "Sin teléfono"}</dd></div><div><dt>Email</dt><dd>{item.email || "Sin email"}</dd></div><div><dt>Seguro RC</dt><dd>{item.liabilityInsurance || "Sin registrar"}</dd></div><div><dt>Alta</dt><dd>{formatDate(item.createdAt)}</dd></div></dl>
  <dl className={styles.detailMetrics}><div><dt><BriefcaseBusiness size={13} />Obras activas</dt><dd>{item.activeWorkCount}</dd></div><div><dt><ShieldCheck size={13} />Cumplimiento</dt><dd>{item.complianceScore == null ? "—" : `${item.complianceScore}%`}</dd></div><div><dt><FileCheck2 size={13} />Documentación</dt><dd>{documentStatusLabel(item.documentStatus)}</dd></div><div><dt><BadgeEuro size={13} />Pagos pendientes</dt><dd>{formatCurrency(item.pendingAmount)}</dd></div><div><dt><Star size={13} />Evaluación media</dt><dd>{item.rating == null ? "Sin valorar" : `${item.rating}/5`}</dd></div></dl>
  <Link className={styles.profileButton} href={`/subcontratas/${item.id}`}>Ver perfil completo</Link>
</div>; }

function Progress({ value }: { value: number | null }) { return value == null ? <span className={styles.unrated}>Sin valorar</span> : <span className={styles.progress}><strong>{value}%</strong><i><b style={{ width: `${value}%` }} /></i></span>; }
function Rating({ value }: { value: number | null }) { return <span className={styles.rating}><strong>{value == null ? "—" : `${value}/5`}</strong><span aria-label={value == null ? "Sin valoración" : `${value} de 5 estrellas`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={10} fill={value != null && index < value ? "currentColor" : "none"} />)}</span></span>; }
function Payment({ item }: { item: SubcontractorItem }) { const overdue = item.overdueCount > 0; const pending = item.pendingAmount > 0; return <span className={styles.payment} data-tone={overdue ? "danger" : pending ? "warning" : "ok"}><strong>{overdue ? "Atrasado" : pending ? "Pendiente" : "Al día"}</strong><small>{pending ? formatCurrency(item.pendingAmount) : item.invoiceCount ? "Sin vencidos" : "Sin facturas"}</small></span>; }

function normalizeQuery(raw: QueryRecord): SubcontractorQuery { return { search: first(raw.buscar), status: first(raw.estado), specialty: first(raw.especialidad), compliance: first(raw.cumplimiento), works: first(raw.obras), view: first(raw.seccion) }; }
function documentTone(status: string) { return status === "EXPIRED" ? "danger" : status === "EXPIRING" || status === "INCOMPLETE" ? "warning" : "ok"; }
const complianceColors = ["#07933f", "#78bc59", "#f1aa18", "#ef4d43"];
function complianceGradient(values: number[]) { const total = values.reduce((sum, value) => sum + value, 0) || 1; let cursor = 0; return `conic-gradient(${values.map((value, index) => { const start = cursor; cursor += value / total * 360; return `${complianceColors[index]} ${start}deg ${cursor}deg`; }).join(", ")})`; }
function formatCurrency(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SC"; }
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[] | undefined) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function numberValue(value: string | string[] | undefined, fallback: number) { const parsed = Number(first(value)); return Number.isFinite(parsed) ? Math.round(parsed) : fallback; }
function hrefWith(raw: QueryRecord, changes: Record<string, string | null>, hash?: string) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(raw)) { if (["saved", "error", "duplicate", "nuevo"].includes(key)) continue; for (const item of values(value)) params.append(key, item); } for (const [key, value] of Object.entries(changes)) { params.delete(key); if (value != null) params.set(key, value); } const query = params.toString(); return `/subcontratas${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`; }
function exportHref(raw: QueryRecord) { const params = new URLSearchParams(); for (const key of ["buscar", "estado", "especialidad", "cumplimiento", "obras", "seccion"]) for (const value of values(raw[key])) params.append(key, value); return `/subcontratas/export${params.size ? `?${params.toString()}` : ""}`; }
