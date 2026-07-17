import type { BusinessPartnerKind } from "@prisma/client";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  FileArchive,
  History,
  Plus,
  Search,
  ShieldCheck,
  Star
} from "lucide-react";
import { notFound } from "next/navigation";
import { saveBusinessPartner } from "@/app/(app)/proveedores/actions";
import { EmptyState, Notice, PageHeader, TableShell } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPartnerDetail, getPartnerList, PARTNER_STATUS_OPTIONS } from "@/lib/procurement";

type Query = Record<string, string | string[] | undefined>;

export async function PartnerDirectory({ companyId, kind, searchParams }: { companyId: string; kind: BusinessPartnerKind; searchParams: Promise<Query> }) {
  const query = await searchParams;
  const subcontractor = kind === "SUBCONTRACTOR";
  const base = subcontractor ? "/subcontratas" : "/proveedores";
  const title = subcontractor ? "Subcontratas" : "Proveedores";
  const result = await getPartnerList(companyId, kind, {
    search: first(query.buscar),
    status: first(query.estado),
    tag: first(query.etiqueta),
    duplicate: first(query.duplicados) === "1"
  });
  return <main className="screen">
    <PageHeader
      eyebrow={subcontractor ? "Red de colaboradores" : "Compras y suministros"}
      title={title}
      description={subcontractor ? "Control documental, especialidades, obras realizadas, valoración y deuda de cada subcontrata." : "Ficha económica y operativa de proveedores, con gastos, facturas, obras, documentos e historial."}
      action={<Link href={`${base}?nuevo=1#ficha`} className="primary-button"><Plus size={18} />{subcontractor ? "Nueva subcontrata" : "Nuevo proveedor"}</Link>}
    >
      <form action={base} className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_13rem_13rem_auto]">
        <label><span className="label mb-1 block">Búsqueda rápida</span><input className="field" name="buscar" defaultValue={first(query.buscar)} placeholder="Nombre, NIF, contacto, especialidad..." /></label>
        <label><span className="label mb-1 block">Estado</span><select className="field" name="estado" defaultValue={first(query.estado) || ""}><option value="">Todos</option>{PARTNER_STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label><span className="label mb-1 block">Etiqueta</span><select className="field" name="etiqueta" defaultValue={first(query.etiqueta) || ""}><option value="">Todas</option>{result.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        <button className="primary-button self-end" type="submit"><Search size={18} />Filtrar</button>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" name="duplicados" value="1" defaultChecked={first(query.duplicados) === "1"} />Solo posibles duplicados</label>
      </form>
    </PageHeader>

    {first(query.error) ? <Notice tone="danger" title="No se pudo guardar" description={errorMessage(first(query.error))} /> : null}
    {first(query.duplicate) ? <Notice tone="warning" title="Posible duplicado" description="Ya existe una ficha con el mismo NIF/CIF o nombre. Revisa la coincidencia y confirma expresamente si son entidades distintas." action={<Link className="secondary-button" href={`${base}/${first(query.duplicate)}`}>Abrir coincidencia</Link>} /> : null}

    <section className="mb-5 mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Fichas" value={String(result.total)} icon={Building2} />
      <Metric label="Activas" value={String(result.active)} icon={BadgeCheck} />
      <Metric label="Bloqueadas" value={String(result.blocked)} icon={Ban} tone={result.blocked ? "danger" : "neutral"} />
      <Metric label="Pendiente de pago" value={formatCurrency(result.pending)} icon={CircleDollarSign} tone={result.pending ? "warning" : "neutral"} />
    </section>

    {first(query.nuevo) === "1" ? <section id="ficha" className="card mb-5 p-4 sm:p-6"><h2 className="text-xl font-black text-obra-ink">{subcontractor ? "Alta de subcontrata" : "Alta de proveedor"}</h2><p className="mt-1 text-sm text-slate-600">Los datos permanecen aislados dentro de la empresa activa.</p><PartnerForm kind={kind} confirmDuplicate={Boolean(first(query.duplicate))} /></section> : null}

    {result.items.length ? <>
      <div className="hidden lg:block">
        <TableShell label={title}>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Entidad</th>{subcontractor ? <th className="px-4 py-3">Oficio y documentación</th> : <th className="px-4 py-3">Contacto</th>}<th className="px-4 py-3">Obras</th><th className="px-4 py-3">Facturado</th><th className="px-4 py-3">Pendiente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">{result.items.map((partner) => <tr key={partner.id} className="align-top">
              <td className="px-4 py-4"><Link href={`${base}/${partner.id}`} className="font-black text-obra-ink hover:underline">{partner.commercialName}</Link><p className="mt-1 text-xs text-slate-500">{partner.legalName} · {partner.taxId || "NIF pendiente"}</p><div className="mt-2 flex flex-wrap gap-1">{partner.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{tag}</span>)}{partner.duplicate ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Posible duplicado</span> : null}</div></td>
              <td className="px-4 py-4"><p className="font-bold text-slate-700">{subcontractor ? partner.tradeType || "Oficio pendiente" : partner.contactPerson || "Contacto pendiente"}</p><p className="mt-1 text-xs text-slate-500">{subcontractor ? `${partner.specialty || "Sin especialidad"} · ${documentStatusLabel(partner.documentStatus)}` : partner.email || partner.phone || "Sin contacto directo"}</p></td>
              <td className="px-4 py-4 font-black">{partner.workLinks.length}</td>
              <td className="px-4 py-4 font-black">{formatCurrency(partner.invoiced)}</td>
              <td className={`px-4 py-4 font-black ${partner.pending ? "text-obra-red" : "text-obra-green"}`}>{formatCurrency(partner.pending)}{partner.overdue ? <p className="text-xs">{formatCurrency(partner.overdue)} vencido</p> : null}</td>
              <td className="px-4 py-4"><PartnerStatus status={partner.status} /></td>
              <td className="px-4 py-4 text-right"><Link className="secondary-button" href={`${base}/${partner.id}`}>Ver ficha</Link></td>
            </tr>)}</tbody>
          </table>
        </TableShell>
      </div>
      <div className="grid gap-3 lg:hidden">{result.items.map((partner) => <article key={partner.id} className="card p-4"><div className="flex justify-between gap-3"><div><Link href={`${base}/${partner.id}`} className="font-black text-obra-ink">{partner.commercialName}</Link><p className="text-xs text-slate-500">{partner.taxId || "NIF pendiente"}</p></div><PartnerStatus status={partner.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><Mini label="Obras" value={String(partner.workLinks.length)} /><Mini label="Facturado" value={formatCurrency(partner.invoiced)} /><Mini label="Pendiente" value={formatCurrency(partner.pending)} /><Mini label={subcontractor ? "Documentación" : "Documentos"} value={subcontractor ? documentStatusLabel(partner.documentStatus) : String(partner.documents.length)} /></div><Link href={`${base}/${partner.id}`} className="primary-button mt-3 w-full">Abrir ficha</Link></article>)}</div>
    </> : <EmptyState icon={Search} title={`No hay ${title.toLowerCase()} con estos criterios`} description="Cambia los filtros o crea una ficha profesional nueva." action={<Link href={`${base}?nuevo=1#ficha`} className="primary-button"><Plus size={18} />Crear ficha</Link>} />}
  </main>;
}

export async function PartnerProfile({ companyId, kind, id, searchParams }: { companyId: string; kind: BusinessPartnerKind; id: string; searchParams: Promise<Query> }) {
  const [partner, query] = await Promise.all([getPartnerDetail(companyId, id, kind), searchParams]);
  if (!partner) notFound();
  const subcontractor = kind === "SUBCONTRACTOR";
  const base = subcontractor ? "/subcontratas" : "/proveedores";
  const invoiceBase = subcontractor ? "/facturas-subcontratas" : "/facturas-proveedor";
  const invoiced = sum(partner.invoices.filter((invoice) => invoice.status !== "VOID").map((invoice) => invoice.total));
  const pending = sum(partner.invoices.filter((invoice) => invoice.status !== "VOID").map((invoice) => invoice.pendingAmount));
  return <main className="screen">
    <PageHeader eyebrow={subcontractor ? "Ficha de subcontrata" : "Ficha de proveedor"} title={partner.commercialName} description={`${partner.legalName} · ${partner.taxId || "NIF/CIF pendiente"}`} badge={<PartnerStatus status={partner.status} />} action={<Link className="secondary-button" href={base}>Volver</Link>} secondaryActions={<Link className="primary-button" href={`${invoiceBase}?nuevo=1&partner=${partner.id}#factura`}><Plus size={18} />Nueva factura</Link>} />
    {first(query.saved) ? <Notice tone="success" title="Ficha guardada" description="Los cambios y el historial están actualizados." /> : null}
    {first(query.error) ? <Notice tone="danger" description={errorMessage(first(query.error))} /> : null}
    <section className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Facturado" value={formatCurrency(invoiced)} icon={CircleDollarSign} /><Metric label="Pendiente" value={formatCurrency(pending)} icon={AlertTriangle} tone={pending ? "warning" : "neutral"} /><Metric label="Obras relacionadas" value={String(partner.workLinks.length)} icon={BriefcaseBusiness} /><Metric label="Documentos" value={String(partner.documents.length)} icon={FileArchive} /></section>
    {subcontractor ? <section className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Oficio" value={partner.tradeType} /><Info label="Especialidad" value={partner.specialty} /><Info label="Seguro RC" value={partner.liabilityInsurance} /><Info label="Caducidad" value={partner.documentExpiresAt ? formatDate(partner.documentExpiresAt) : null} /><Info label="Tipo" value={partner.legalType === "SELF_EMPLOYED" ? "Autónomo" : partner.legalType === "COMPANY" ? "Empresa" : null} /><Info label="Estado documental" value={documentStatusLabel(partner.documentStatus)} /><Info label="Valoración" value={partner.internalRating ? `${partner.internalRating}/5` : null} /><Info label="Importe pendiente" value={formatCurrency(pending)} /></section> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
      <div className="grid content-start gap-5">
        <section className="card p-4 sm:p-6"><h2 className="text-lg font-black">Datos de la ficha</h2><PartnerForm kind={kind} partner={partner} /></section>
        <section className="card overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-black">Facturas y gastos asociados</h2></div>{partner.invoices.length ? <div className="divide-y divide-slate-100">{partner.invoices.map((invoice) => <Link key={invoice.id} href={`${invoiceBase}/${invoice.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"><div><p className="font-black">{invoice.invoiceNumber} · {invoice.description}</p><p className="text-xs text-slate-500">{formatDate(invoice.issueDate)} · {invoice.work?.titulo || "Gasto general"}</p></div><div className="text-right"><p className="font-black">{formatCurrency(invoice.total)}</p><p className="text-xs text-slate-500">{invoiceStatusLabel(invoice.status)}</p></div></Link>)}</div> : <p className="p-4 text-sm text-slate-500">Sin facturas registradas.</p>}</section>
        <section className="card p-4"><h2 className="font-black">Obras relacionadas</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{partner.workLinks.length ? partner.workLinks.map((link) => <Link className="rounded-xl border border-slate-200 p-3 font-bold hover:border-obra-yellowDark" href={`/obras/${link.work.id}`} key={link.id}>{link.work.titulo}<span className="mt-1 block text-xs font-normal text-slate-500">{link.work.estado.replaceAll("_", " ")}</span></Link>) : <p className="text-sm text-slate-500">Se relacionarán automáticamente al registrar facturas con obra.</p>}</div></section>
      </div>
      <aside className="grid content-start gap-5">
        <section className="card p-4"><h2 className="flex items-center gap-2 font-black"><ShieldCheck size={18} />Condiciones económicas</h2><div className="mt-3 grid gap-3"><Info label="Condiciones de pago" value={partner.paymentTerms} /><Info label="Vencimiento habitual" value={`${partner.paymentDueDays} días`} /><Info label="Forma de pago" value={partner.preferredPaymentMethod} /></div></section>
        {partner.learning ? <section className="card p-4"><h2 className="flex items-center gap-2 font-black"><Star size={18} />Aprendizaje de esta empresa</h2><p className="mt-2 text-sm text-slate-600">Preferencias construidas solo con confirmaciones humanas de esta empresa.</p><div className="mt-3 grid gap-2"><Info label="Categoría habitual" value={partner.learning.preferredCategory?.replaceAll("_", " ")} /><Info label="Obra habitual" value={partner.learning.preferredWork?.titulo} /><Info label="IVA habitual" value={partner.learning.preferredVatRate != null ? `${partner.learning.preferredVatRate}%` : null} /></div></section> : null}
        <section className="card p-4"><h2 className="flex items-center gap-2 font-black"><History size={18} />Historial</h2><div className="mt-3 grid gap-3">{partner.history.map((item) => <div key={item.id} className="border-l-2 border-obra-yellow pl-3"><p className="text-sm font-bold">{item.detail}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>)}</div></section>
      </aside>
    </div>
  </main>;
}

function PartnerForm({ kind, partner, confirmDuplicate = false }: { kind: BusinessPartnerKind; partner?: Awaited<ReturnType<typeof getPartnerDetail>>; confirmDuplicate?: boolean }) {
  const sub = kind === "SUBCONTRACTOR";
  return <form action={saveBusinessPartner} className="mt-4 grid gap-4">
    <input type="hidden" name="kind" value={kind} />{partner ? <input type="hidden" name="id" value={partner.id} /> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Nombre comercial" required><input className="field" name="commercialName" required defaultValue={partner?.commercialName} /></Field><Field label="Razón social" required><input className="field" name="legalName" required defaultValue={partner?.legalName} /></Field></div>
    <div className="grid gap-4 md:grid-cols-3"><Field label="CIF / NIF"><input className="field" name="taxId" defaultValue={partner?.taxId || ""} /></Field><Field label="Estado"><select className="field" name="status" defaultValue={partner?.status || "ACTIVE"}>{PARTNER_STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Etiquetas"><input className="field" name="tags" defaultValue={partner?.tags.join(", ")} placeholder="materiales, habitual, local" /></Field></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="Dirección"><input className="field" name="address" defaultValue={partner?.address || ""} /></Field><Field label="Población"><input className="field" name="city" defaultValue={partner?.city || ""} /></Field></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field label="Provincia"><input className="field" name="province" defaultValue={partner?.province || ""} /></Field><Field label="Código postal"><input className="field" name="postalCode" defaultValue={partner?.postalCode || ""} /></Field><Field label="País"><input className="field" name="country" defaultValue={partner?.country || "España"} /></Field></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Teléfono"><input className="field" name="phone" defaultValue={partner?.phone || ""} /></Field><Field label="Email"><input className="field" type="email" name="email" defaultValue={partner?.email || ""} /></Field><Field label="Web"><input className="field" type="url" name="website" defaultValue={partner?.website || ""} /></Field><Field label="Persona de contacto"><input className="field" name="contactPerson" defaultValue={partner?.contactPerson || ""} /></Field></div>
    <div className="grid gap-4 md:grid-cols-3"><Field label="Condiciones de pago"><input className="field" name="paymentTerms" defaultValue={partner?.paymentTerms || ""} /></Field><Field label="Días de vencimiento"><input className="field" type="number" min="0" max="365" name="paymentDueDays" defaultValue={partner?.paymentDueDays ?? 30} /></Field><Field label="Forma habitual de pago"><input className="field" name="preferredPaymentMethod" defaultValue={partner?.preferredPaymentMethod || ""} /></Field></div>
    {sub ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="mb-3 font-black">Datos profesionales de subcontrata</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Tipo de oficio"><input className="field" name="tradeType" defaultValue={partner?.tradeType || ""} /></Field><Field label="Especialidad"><input className="field" name="specialty" defaultValue={partner?.specialty || ""} /></Field><Field label="Seguro RC"><input className="field" name="liabilityInsurance" defaultValue={partner?.liabilityInsurance || ""} /></Field><Field label="Caducidad documentación"><input className="field" type="date" name="documentExpiresAt" defaultValue={dateInput(partner?.documentExpiresAt)} /></Field><Field label="Autónomo o empresa"><select className="field" name="legalType" defaultValue={partner?.legalType || ""}><option value="">Sin indicar</option><option value="SELF_EMPLOYED">Autónomo</option><option value="COMPANY">Empresa</option></select></Field><Field label="Valoración interna"><input className="field" type="number" min="1" max="5" name="internalRating" defaultValue={partner?.internalRating ?? ""} /></Field><Field label="Estado documental"><select className="field" name="documentStatus" defaultValue={partner?.documentStatus || "INCOMPLETE"}><option value="VALID">Vigente</option><option value="EXPIRING">Próxima a caducar</option><option value="EXPIRED">Caducada</option><option value="INCOMPLETE">Incompleta</option><option value="NOT_REQUIRED">No requerida</option></select></Field></div></div> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Observaciones"><textarea className="field min-h-24" name="notes" defaultValue={partner?.notes || ""} /></Field><Field label="Observaciones internas"><textarea className="field min-h-24" name="internalNotes" defaultValue={partner?.internalNotes || ""} /></Field></div>
    {confirmDuplicate ? <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><input className="mt-1" type="checkbox" required name="confirmDuplicate" value="yes" /><span><strong>He revisado la coincidencia.</strong><br />Confirmo que se trata de una entidad distinta.</span></label> : null}
    <button className="primary-button w-full sm:w-auto" type="submit">Guardar ficha</button>
  </form>;
}

function Metric({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: string; icon: typeof Building2; tone?: "neutral" | "warning" | "danger" }) { return <div className={`card p-4 ${tone === "warning" ? "border-amber-300" : tone === "danger" ? "border-red-300" : ""}`}><div className="flex items-center justify-between"><p className="label">{label}</p><Icon size={18} className={tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-700" : "text-slate-400"} /></div><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 truncate font-black">{value}</p></div>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="grid gap-1"><span className="text-sm font-black">{label}{required ? " *" : ""}</span>{children}</label>; }
function Info({ label, value }: { label: string; value?: string | null }) { return <div><p className="label">{label}</p><p className="mt-1 text-sm font-bold text-obra-ink">{value || "Sin indicar"}</p></div>; }
function PartnerStatus({ status }: { status: string }) { const map = { ACTIVE: ["Activo", "bg-emerald-100 text-emerald-800"], INACTIVE: ["Inactivo", "bg-slate-100 text-slate-700"], BLOCKED: ["Bloqueado", "bg-red-100 text-red-800"] } as const; const [label, style] = map[status as keyof typeof map] || [status, "bg-slate-100"]; return <span className={`rounded-full px-2 py-1 text-xs font-black ${style}`}>{label}</span>; }
function documentStatusLabel(value: string) { return ({ VALID: "Vigente", EXPIRING: "Próxima a caducar", EXPIRED: "Caducada", INCOMPLETE: "Incompleta", NOT_REQUIRED: "No requerida" } as Record<string, string>)[value] || value; }
function invoiceStatusLabel(value: string) { return ({ PENDING: "Pendiente", PARTIALLY_PAID: "Parcialmente pagada", PAID: "Pagada", OVERDUE: "Vencida", VOID: "Anulada" } as Record<string, string>)[value] || value; }
function errorMessage(value?: string) { return ({ invalid_tax_id: "El NIF/CIF no tiene un formato español válido.", duplicate_tax_id: "Ya existe una ficha de este tipo con el mismo NIF/CIF. No puede duplicarse.", duplicate_confirmation_required: "Revisa y confirma el posible duplicado.", required_fields: "Completa los campos obligatorios.", invalid_date: "Revisa la fecha indicada.", invalid_number: "Revisa el valor numérico.", not_found: "La ficha no existe o no pertenece a tu empresa." } as Record<string, string>)[value || ""] || "Revisa los datos e inténtalo de nuevo."; }
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function dateInput(value?: Date | null) { return value ? value.toISOString().slice(0, 10) : ""; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
