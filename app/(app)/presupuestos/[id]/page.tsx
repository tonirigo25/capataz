import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Boxes, BriefcaseBusiness, CalendarDays, Check, CheckCircle2,
  Circle, CircleDollarSign, Clock3, Copy, Download, Eye, FileCheck2, FileText, Hammer,
  MessageCircle, Pencil, Percent, Plus, Send, ShieldCheck, Trash2,
  TrendingUp, UserRound, XCircle
} from "lucide-react";
import {
  convertBudgetToInvoice,
  convertBudgetToWork,
  deleteBudgetLine,
  duplicateBudget,
  saveBudgetLine,
  updateBudgetStatus
} from "@/app/(app)/presupuestos/actions";
import { BudgetLivePreview } from "@/components/budget-live-preview";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { BudgetRailContext } from "@/components/portal/budget-rail-context";
import { StatusPill } from "@/components/status-pill";
import { ActionMenu, Notice } from "@/components/ui-primitives";
import { normalizeLoginReturnPath } from "@/lib/auth/return-path";
import { calculateBudgetMargin, parseBudgetLines, reconcileBudgetRecord, units } from "@/lib/budget-lines";
import { assertScopedEntityAccess, requireCapability, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { companySettingsView } from "@/lib/tenant/company-settings";
import styles from "./budget-detail.module.css";

export const dynamic = "force-dynamic";

type BudgetLine = ReturnType<typeof parseBudgetLines>[number];

export default async function BudgetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; modo?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const listReturnTo = normalizeLoginReturnPath(query.returnTo ?? "/presupuestos");
  const detailReturnTo = `/presupuestos/${id}?returnTo=${encodeURIComponent(listReturnTo)}`;
  const editMode = query.modo === "editar";
  const auth = await requireCapability("sales.budgets.view");
  const [updateDecision, approveDecision, invoiceDecision, workDecision, marginDecision, agendaDecision, duplicateDecision, pricingDecision] = await Promise.all([
    resolveAuthorization(auth, "sales.budgets.update"), resolveAuthorization(auth, "sales.budgets.approve"),
    resolveAuthorization(auth, "sales.invoices.create"), resolveAuthorization(auth, "work.create"), resolveAuthorization(auth, "margin_amount.view"),
    resolveAuthorization(auth, "agenda.manage"), resolveAuthorization(auth, "sales.budgets.create"), resolveAuthorization(auth, "sales.pricing.view")
  ]);
  const [budget, companyRecord, auditEntries] = await Promise.all([
    prisma.budget.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        client: true,
        work: true,
        reminders: { orderBy: { fechaProgramada: "desc" }, take: 6 },
        agendaEvents: { orderBy: { fechaInicio: "desc" }, take: 6 },
        documents: { where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 6 },
        internalNotes: { where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 4 },
      }
    }),
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }),
    prisma.auditLog.findMany({
      where: { companyId: auth.companyId, targetType: "Budget", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true }
    })
  ]);

  if (!budget) notFound();
  if (budget.obraId) await assertScopedEntityAccess(auth, "sales.budgets.view", "Work", budget.obraId);
  else await assertScopedEntityAccess(auth, "sales.budgets.view", "Client", budget.clienteId);

  const [canUpdateRaw, canApproveRaw, canCreateInvoiceRaw, canCreateWorkRaw, canSeeMargin, canSchedule, canDuplicateRaw, canSeePricing] = await Promise.all([
    budgetDecisionAllowed(auth, "sales.budgets.update", updateDecision, budget), budgetDecisionAllowed(auth, "sales.budgets.approve", approveDecision, budget),
    budgetDecisionAllowed(auth, "sales.invoices.create", invoiceDecision, budget), budgetDecisionAllowed(auth, "work.create", workDecision, budget),
    budgetDecisionAllowed(auth, "margin_amount.view", marginDecision, budget), budgetDecisionAllowed(auth, "agenda.manage", agendaDecision, budget),
    budgetDecisionAllowed(auth, "sales.budgets.create", duplicateDecision, budget), budgetDecisionAllowed(auth, "sales.pricing.view", pricingDecision, budget)
  ]);

  const company = companySettingsView(companyRecord);
  const lines = parseBudgetLines(budget.partidas);
  const calculatedMargin = calculateBudgetMargin(lines, budget.descuento);
  const reconciliation = reconcileBudgetRecord(lines, budget);
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length;
  const canUpdate = canUpdateRaw && canSeePricing;
  const canApprove = canApproveRaw && canSeePricing;
  const canCreateInvoice = canCreateInvoiceRaw && canSeePricing;
  const canCreateWork = canCreateWorkRaw && canSeePricing;
  const canDuplicate = canDuplicateRaw && canSeePricing;
  const canEditBudget = canUpdate && budget.estado !== "aceptado";
  const durationDays = plannedDurationDays(budget.work?.fechaInicioPrevista, budget.work?.fechaFinPrevista);
  const categories = aggregateCategories(lines);
  const timeline = buildTimeline(budget, auditEntries);
  const editHref = canEditBudget ? `${detailReturnTo}&modo=editar#budget-line-editor` : null;
  const validForApproval = reconciliation.ok && calculatedMargin.complete;

  return (
    <main className={`screen ${styles.page}`}>
      <BudgetRailContext context={{
        id: budget.id,
        numero: budget.numero,
        title: budget.titulo,
        client: budget.client.nombre,
        status: budget.estado,
        margin: canSeeMargin ? formatBudgetMargin(calculatedMargin) : null,
        total: canSeePricing ? formatCurrency(budget.total) : null,
        lineCount: lines.length,
        reviewHref: detailReturnTo,
        editHref,
      }} />

      <InternalBreadcrumbs items={[{ label: "Presupuestos", href: listReturnTo }, { label: budget.numero }]} />
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link href={listReturnTo} className={styles.backLink}><ArrowLeft size={15} /> Presupuestos</Link>
          <div className={styles.titleLine}>
            <h1>{budget.titulo}</h1>
            <StatusPill status={budget.estado} />
          </div>
          <div className={styles.heroMeta}>
            <span><UserRound size={14} /> Cliente: <strong>{budget.client.nombre}</strong></span>
            <span><BriefcaseBusiness size={14} /> Obra: <strong>{budget.work?.titulo ?? "Sin obra asociada"}</strong></span>
            <span>Responsable: <strong>{budget.work?.responsable ?? "Sin asignar"}</strong></span>
            <span>Creado: <strong>{formatDateOnly(budget.fechaCreacion)}</strong></span>
            <span>Última revisión: <strong>{formatDateOnly(latestRevisionDate(budget, auditEntries))}</strong></span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <ActionMenu label="Más">
            {canSchedule ? <Link href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&obraId=${budget.obraId ?? ""}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&descripcion=${encodeURIComponent(budget.titulo)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(detailReturnTo)}`}><MessageCircle size={18} /> Preparar seguimiento</Link> : null}
            {canSeePricing && reconciliation.ok ? <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank"><Eye size={18} /> Vista previa PDF</Link> : null}
            {canSeePricing && reconciliation.ok ? <Link href={`/presupuestos/${budget.id}/pdf`}><Download size={18} /> Descargar PDF</Link> : null}
          </ActionMenu>
          {canEditBudget ? <Link href={editHref!} className="secondary-button"><Pencil size={16} /> Editar</Link> : null}
          {canDuplicate ? <form action={duplicateBudget}><input type="hidden" name="id" value={budget.id} /><ConfirmSubmitButton className="secondary-button" message="¿Duplicar este presupuesto como borrador editable?"><Copy size={16} /> Duplicar</ConfirmSubmitButton></form> : null}
          {canEditBudget && reconciliation.ok ? <StatusForm id={budget.id} estado="enviado" label="Marcar enviado" icon="send" className="secondary-button" /> : null}
          {canApprove && validForApproval ? <StatusForm id={budget.id} estado="aceptado" label="Aprobar" icon="check" className={styles.approveButton} /> : null}
          {canCreateWork && validForApproval ? <form action={convertBudgetToWork}><input type="hidden" name="id" value={budget.id} /><ConfirmSubmitButton className="primary-button" message="¿Convertir este presupuesto en obra?">Convertir en obra</ConfirmSubmitButton></form> : null}
        </div>
      </header>

      <div className={styles.noticeStack}>
        {!reconciliation.ok ? <Notice tone="warning" title="Importes pendientes de reconciliar" description="Las partidas no coinciden con los totales guardados. Corrige y guarda las partidas antes de enviar, aprobar, convertir o generar el PDF." /> : null}
        {canSeeMargin && !calculatedMargin.complete ? <Notice tone="warning" title="Margen pendiente de costes" description={`Añade el coste unitario de ${calculatedMargin.missingCostLines} partida${calculatedMargin.missingCostLines === 1 ? "" : "s"}. Orqena calculará automáticamente el margen neto, sin IVA.`} /> : null}
        {companyMissing ? <Notice tone="warning" title="Datos pendientes antes de enviar" description={`Falta ${companyStatus.missingRequired.slice(0, 3).join(", ")}. El documento puede guardarse, pero seguirá incompleto hasta resolverlos.`} /> : null}
      </div>

      {canSeePricing ? <section className={styles.kpiGrid} aria-label="Resumen económico y comercial">
        <Kpi icon={<CircleDollarSign />} label="Importe total (IVA excl.)" value={formatCurrency(budget.subtotal)} detail={`IVA ${formatCurrency(budget.iva)} · Total ${formatCurrency(budget.total)}`} />
        <Kpi icon={<Boxes />} label="Coste estimado" value={calculatedMargin.cost === null ? "Pendiente" : formatCurrency(calculatedMargin.cost)} detail={calculatedMargin.complete ? "Costes registrados en partidas" : `${calculatedMargin.missingCostLines} partidas sin coste`} tone={calculatedMargin.complete ? "neutral" : "warning"} />
        <Kpi icon={<TrendingUp />} label="Margen bruto" value={calculatedMargin.amount === null ? "Pendiente" : formatCurrency(calculatedMargin.amount)} detail={calculatedMargin.percent === null ? "Margen calculado al completar costes" : `Margen calculado: ${calculatedMargin.percent.toFixed(1)} % sobre venta neta`} tone={calculatedMargin.complete ? "success" : "warning"} />
        <Kpi icon={<Clock3 />} label="Plazo estimado" value={durationDays === null ? "Sin planificar" : `${durationDays} días`} detail={budget.work?.fechaInicioPrevista ? `Inicio ${formatDateOnly(budget.work.fechaInicioPrevista)}` : "Sin fechas de obra registradas"} />
        <CommercialStage status={budget.estado} />
        <Kpi icon={<Percent />} label="Probabilidad de cierre" value="No calculada" detail="No existe una estimación aprobada" tone="neutral" />
      </section> : <Notice tone="info" title="Precios restringidos" description="Puedes consultar estado y seguimiento, pero no los importes o márgenes." />}

      <div className={styles.primaryGrid}>
        <section className={`${styles.panel} ${styles.linesPanel}`}>
          <SectionHeading title="Partidas y capítulos" action={canEditBudget ? <Link href={editHref!}>Editar partidas</Link> : null} />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Capítulo</th><th>Descripción</th><th>Importe</th><th>Coste</th><th>Margen</th><th>Margen %</th></tr></thead>
              <tbody>
                {lines.map((line, index) => <BudgetLineRow key={`${line.descripcion}-${index}`} line={line} index={index} canSeeMargin={canSeeMargin} />)}
                {lines.length === 0 ? <tr><td colSpan={6} className={styles.empty}>No hay partidas registradas.</td></tr> : null}
              </tbody>
              {lines.length ? <tfoot><tr><th colSpan={2}>Total presupuesto</th><th>{formatCurrency(budget.subtotal)}</th><th>{calculatedMargin.cost === null ? "Pendiente" : formatCurrency(calculatedMargin.cost)}</th><th>{calculatedMargin.amount === null ? "Pendiente" : formatCurrency(calculatedMargin.amount)}</th><th>{calculatedMargin.percent === null ? "—" : `${calculatedMargin.percent.toFixed(1)} %`}</th></tr></tfoot> : null}
            </table>
          </div>
        </section>

        <div className={styles.stack}>
          <section className={styles.panel}>
            <SectionHeading title="Materiales y mano de obra" />
            <div className={styles.categoryList}>
              {categories.map((category) => <div key={category.name} className={styles.categoryRow}><span className={styles.categoryIcon}>{category.name.toLowerCase().includes("mano") ? <Hammer size={17} /> : <Boxes size={17} />}</span><div><strong>{category.name}</strong><span>{category.count} partida{category.count === 1 ? "" : "s"}</span></div><b>{formatCurrency(category.total)}</b></div>)}
              {categories.length === 0 ? <p className={styles.empty}>Sin partidas clasificadas.</p> : null}
            </div>
          </section>
          <section className={styles.panel}>
            <SectionHeading title="Planificación y vencimientos" />
            <DefinitionRows rows={[
              ["Inicio previsto", formatDateOnly(budget.work?.fechaInicioPrevista)],
              ["Fin previsto", formatDateOnly(budget.work?.fechaFinPrevista)],
              ["Duración estimada", durationDays === null ? "Sin planificar" : `${durationDays} días`],
              ["Validez de la oferta", formatDateOnly(budget.fechaValidez)],
            ]} />
            <ol className={styles.miniTimeline}>
              {timeline.slice(0, 4).map((event, index) => <li key={event.key} data-complete={index < timeline.filter((item) => item.complete).length}><span>{event.complete ? <Check size={11} /> : <Circle size={9} />}</span><div><strong>{event.label}</strong><small>{formatDateOnly(event.date)}</small></div></li>)}
            </ol>
          </section>
        </div>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.panel}>
          <SectionHeading title="Historial de revisiones" />
          <ul className={styles.compactList}>
            {auditEntries.map((entry) => <li key={entry.id}><span>{auditActionLabel(entry.action)}</span><time>{formatDate(entry.createdAt)}</time></li>)}
            {auditEntries.length === 0 ? <li><span>Versión actual creada</span><time>{formatDate(budget.fechaCreacion)}</time></li> : null}
          </ul>
          <p className={styles.truthNote}><ShieldCheck size={14} /> Sólo se muestran eventos auditados; no se inventan versiones históricas.</p>
        </section>
        <section className={styles.panel}>
          <SectionHeading title="Documentos asociados" action={<Link href={`/documentos?presupuestoId=${budget.id}`}>Ver documentos</Link>} />
          <ul className={styles.documentList}>
            {budget.documents.map((document) => <li key={document.id}><FileText size={18} /><div><strong>{document.name}</strong><span>{document.mimeType ?? "Documento"} · {formatFileSize(document.size)}</span></div>{document.url ? <a href={document.url} target="_blank" rel="noreferrer">Abrir</a> : <span>Sin descarga</span>}</li>)}
            {budget.documents.length === 0 ? <li className={styles.empty}>No hay documentos vinculados.</li> : null}
          </ul>
        </section>
        <section className={styles.panel}>
          <SectionHeading title="Cronología de aprobaciones" />
          <ol className={styles.approvalTimeline}>
            {timeline.map((event) => <li key={event.key} data-complete={event.complete}><span>{event.complete ? <Check size={12} /> : null}</span><div><strong>{event.label}</strong><small>{event.date ? formatDate(event.date) : event.detail}</small></div></li>)}
          </ol>
        </section>
        <section className={styles.panel}>
          <SectionHeading title="Información comercial" action={<Link href={`/clientes/${budget.clienteId}`}>Ficha cliente</Link>} />
          <DefinitionRows rows={[
            ["Contacto", budget.client.contactoPrincipalNombre ?? "Sin registrar"],
            ["Email", budget.client.contactoPrincipalEmail ?? budget.client.email ?? "Sin registrar"],
            ["Teléfono", budget.client.contactoPrincipalTelefono ?? budget.client.telefono ?? "Sin registrar"],
            ["Condiciones de pago", budget.formaPago ?? "Sin registrar"],
            ["Validez", formatDateOnly(budget.fechaValidez)],
            ["Observaciones", budget.observaciones ?? "Sin observaciones"],
          ]} />
        </section>
      </div>

      {(budget.reminders.length > 0 || budget.agendaEvents.length > 0 || budget.internalNotes.length > 0) ? <section className={`${styles.panel} ${styles.relatedPanel}`}>
        <SectionHeading title="Seguimiento registrado" action={canSchedule ? <Link href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&presupuestoId=${budget.id}&returnTo=${encodeURIComponent(detailReturnTo)}`}>Añadir seguimiento</Link> : null} />
        <div className={styles.relatedGrid}>
          {budget.reminders.map((item) => <article key={item.id}><CalendarDays size={16} /><div><strong>{item.mensaje}</strong><span>{formatDate(item.fechaProgramada)} · {item.estado.replaceAll("_", " ")}</span></div></article>)}
          {budget.agendaEvents.map((item) => <article key={item.id}><Clock3 size={16} /><div><strong>{item.titulo}</strong><span>{formatDate(item.fechaInicio)} · {item.estado.replaceAll("_", " ")}</span></div></article>)}
          {budget.internalNotes.map((item) => <article key={item.id}><FileCheck2 size={16} /><div><strong>Nota interna</strong><span>{item.content}</span></div></article>)}
        </div>
      </section> : null}

      {editMode && canEditBudget ? <section id="budget-line-editor" className={`${styles.panel} ${styles.editorSection}`}>
        <div className={styles.editorHeader}><div><p className={styles.eyebrow}>Edición segura</p><h2>Editar partidas</h2><p>Los totales y el margen se recalculan automáticamente. No se introduce el margen manualmente.</p></div><Link href={detailReturnTo} className="secondary-button">Cerrar edición</Link></div>
        <div className="budget-editor-layout">
          <div className={styles.editorLines}>
            {lines.map((line, index) => <article key={`${line.descripcion}-${index}`} className={styles.editorCard} data-budget-line><form action={saveBudgetLine} className={styles.editorForm}><input type="hidden" name="budgetId" value={budget.id} /><input type="hidden" name="lineIndex" value={index} /><BudgetLineFields line={line} /><button type="submit" className="secondary-button"><Pencil size={16} /> Guardar partida</button></form><form action={deleteBudgetLine}><input type="hidden" name="budgetId" value={budget.id} /><input type="hidden" name="lineIndex" value={index} /><ConfirmSubmitButton className="secondary-button" message={`¿Eliminar la partida "${line.descripcion}"? Los totales se recalcularán automáticamente.`}><Trash2 size={16} /> Eliminar</ConfirmSubmitButton></form></article>)}
            <form action={saveBudgetLine} className={styles.editorCard} data-budget-line><input type="hidden" name="budgetId" value={budget.id} /><input type="hidden" name="lineIndex" value="" /><h3><Plus size={17} /> Añadir partida</h3><BudgetLineFields line={{ descripcion: "", cantidad: 1, unidad: "ud", precioUnitario: 0, costeUnitario: null, categoria: "General", total: 0 }} /><button type="submit" className="secondary-button"><Plus size={16} /> Añadir partida</button></form>
          </div>
          <BudgetLivePreview budgetNumber={budget.numero} companyName={company.nombreComercial} clientName={budget.client.nombre} title={budget.titulo} initialLines={lines.map((line) => ({ description: line.descripcion, quantity: line.cantidad, unit: line.unidad, unitPrice: line.precioUnitario, unitCost: line.costeUnitario ?? null }))} initialSubtotal={budget.subtotal} initialTax={budget.iva} initialDiscount={budget.descuento} />
        </div>
      </section> : null}

      <footer className={styles.footerActions}>
        {canApprove ? <StatusForm id={budget.id} estado="rechazado" label="Rechazar" icon="x" className="secondary-button" /> : null}
        {canCreateInvoice && reconciliation.ok ? <form action={convertBudgetToInvoice}><input type="hidden" name="id" value={budget.id} /><ConfirmSubmitButton className="secondary-button" message="¿Crear una factura borrador editable desde este presupuesto?">Convertir a factura</ConfirmSubmitButton></form> : null}
      </footer>
    </main>
  );
}

function Kpi({ icon, label, value, detail, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "neutral" | "success" | "warning" }) {
  return <article className={styles.kpi} data-tone={tone}><span className={styles.kpiIcon}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function CommercialStage({ status }: { status: string }) {
  const stages = ["borrador", "enviado", "pendiente_respuesta", "aceptado"];
  const currentIndex = status === "visto" ? 2 : status === "pendiente_revision" ? 0 : Math.max(0, stages.indexOf(status));
  return <article className={`${styles.kpi} ${styles.stageCard}`}><div><p>Estado comercial</p><strong>{humanStatus(status)}</strong><div className={styles.stageTrack}>{stages.map((stage, index) => <span key={stage} data-complete={index <= currentIndex}><i />{humanStatus(stage)}</span>)}</div></div></article>;
}

function BudgetLineRow({ line, index, canSeeMargin }: { line: BudgetLine; index: number; canSeeMargin: boolean }) {
  const cost = line.costeTotal ?? null;
  const margin = cost === null ? null : line.total - cost;
  const marginPercent = margin === null || line.total <= 0 ? null : (margin / line.total) * 100;
  return <tr><td><span className={styles.chapter}>{String(index + 1).padStart(2, "0")}</span></td><td><strong>{line.descripcion}</strong><small>{line.categoria} · {line.cantidad} {line.unidad}</small></td><td>{formatCurrency(line.total)}</td><td>{canSeeMargin ? cost === null ? "Pendiente" : formatCurrency(cost) : "Restringido"}</td><td>{canSeeMargin ? margin === null ? "Pendiente" : formatCurrency(margin) : "Restringido"}</td><td><span className={marginPercent === null ? styles.pendingPill : marginPercent >= 20 ? styles.successPill : styles.warningPill}>{canSeeMargin && marginPercent !== null ? `${marginPercent.toFixed(1)} %` : "—"}</span></td></tr>;
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className={styles.sectionHeading}><h2>{title}</h2>{action ? <div>{action}</div> : null}</div>;
}

function DefinitionRows({ rows }: { rows: Array<[string, string]> }) {
  return <dl className={styles.definitionRows}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function BudgetLineFields({ line }: { line: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number; costeUnitario?: number | null; categoria: string; total?: number } }) {
  return <><Field name="descripcion" label="Descripción" value={line.descripcion} required /><div className={styles.twoFields}><Field name="cantidad" label="Cantidad" type="number" value={line.cantidad} required /><label><span className="label mb-1 block">Unidad</span><select className="field" name="unidad" defaultValue={line.unidad}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label></div><div className={styles.threeFields}><Field name="precioUnitario" label="Precio unitario de venta" type="number" value={line.precioUnitario} required /><Field name="costeUnitario" label="Coste unitario (sin IVA)" type="number" value={line.costeUnitario ?? ""} required /><Field name="categoria" label="Categoría" value={line.categoria} /></div></>;
}

function Field({ name, label, value, type = "text", required = false }: { name: string; label: string; value: string | number; type?: string; required?: boolean }) {
  return <label><span className="label mb-1 block">{label}</span><input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? "0" : undefined} defaultValue={value} required={required} /></label>;
}

function StatusForm({ id, estado, label, icon, className }: { id: string; estado: string; label: string; icon: "check" | "x" | "send"; className?: string }) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "x" ? XCircle : Send;
  return <form action={updateBudgetStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="estado" value={estado} /><ConfirmSubmitButton className={className} message={estado === "enviado" ? "Esta acción registra el estado como enviado, pero no transmite correo ni PDF. ¿Confirmas el cambio?" : `¿Aplicar el estado "${label}" a este presupuesto?`}><Icon size={16} />{label}</ConfirmSubmitButton></form>;
}

async function budgetDecisionAllowed(auth: Awaited<ReturnType<typeof requireCapability>>, capability: Parameters<typeof resolveScopedEntityIds>[1], decision: { allowed: boolean; scope: string }, budget: { obraId: string | null; clienteId: string }) {
  if (!decision.allowed) return false;
  if (decision.scope === "COMPANY") return true;
  const entityType = budget.obraId ? "Work" : "Client";
  const ids = await resolveScopedEntityIds(auth, capability, entityType);
  return Boolean(ids?.includes(budget.obraId ?? budget.clienteId));
}

function aggregateCategories(lines: BudgetLine[]) {
  const values = new Map<string, { name: string; count: number; total: number }>();
  for (const line of lines) {
    const key = line.categoria || "General";
    const current = values.get(key) ?? { name: key, count: 0, total: 0 };
    current.count += 1;
    current.total += line.costeTotal ?? line.total;
    values.set(key, current);
  }
  return [...values.values()].sort((a, b) => b.total - a.total).slice(0, 5);
}

function buildTimeline(budget: { estado: string; fechaCreacion: Date; fechaEnvio: Date | null; fechaSeguimiento: Date | null }, auditEntries: Array<{ action: string; createdAt: Date }>) {
  const reviewed = auditEntries.find((entry) => entry.action.includes("review") || entry.action.includes("updated"));
  return [
    { key: "created", label: "Creado", date: budget.fechaCreacion, detail: "Registro inicial", complete: true },
    { key: "reviewed", label: "Revisado", date: reviewed?.createdAt ?? null, detail: "Pendiente de revisión auditada", complete: Boolean(reviewed) },
    { key: "sent", label: "Enviado al cliente", date: budget.fechaEnvio, detail: "Pendiente de envío", complete: Boolean(budget.fechaEnvio) },
    { key: "approved", label: "Aprobación", date: budget.estado === "aceptado" ? latestRevisionDate(budget, auditEntries) : null, detail: budget.estado === "rechazado" ? "Rechazado" : "Pendiente de respuesta", complete: budget.estado === "aceptado" },
  ];
}

function latestRevisionDate(budget: { fechaCreacion: Date; fechaEnvio: Date | null; fechaSeguimiento?: Date | null }, auditEntries: Array<{ createdAt: Date }>) {
  return auditEntries[0]?.createdAt ?? budget.fechaSeguimiento ?? budget.fechaEnvio ?? budget.fechaCreacion;
}

function plannedDurationDays(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end || end < start) return null;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function formatBudgetMargin(margin: ReturnType<typeof calculateBudgetMargin>) {
  if (!margin.complete || margin.percent === null || margin.amount === null) return "Pendiente de costes";
  return `${margin.percent.toFixed(1)} % · ${formatCurrency(margin.amount)}`;
}

function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "Sin registrar";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatFileSize(value: number | null) {
  if (!value) return "Tamaño no registrado";
  return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function humanStatus(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function auditActionLabel(value: string) {
  const labels: Record<string, string> = {
    "budget.status_updated": "Estado actualizado",
    "budget.created": "Presupuesto creado",
    "budget.updated": "Presupuesto revisado",
    "budget.duplicated": "Presupuesto duplicado",
  };
  return labels[value] ?? value.replaceAll("_", " ").replaceAll(".", " · ");
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
