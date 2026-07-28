import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, Download, Eye, FileText, MessageCircle, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import {
  convertBudgetToInvoice,
  convertBudgetToWork,
  deleteBudgetLine,
  duplicateBudget,
  saveBudgetLine,
  updateBudgetStatus
} from "@/app/(app)/presupuestos/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { BudgetLivePreview } from "@/components/budget-live-preview";
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { StatusPill } from "@/components/status-pill";
import { ActionMenu, DetailSection, MetricStrip, Notice, PageHeader } from "@/components/ui-primitives";
import { parseBudgetLines, units } from "@/lib/budget-lines";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { assertScopedEntityAccess, requireCapability, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { companySettingsView } from "@/lib/tenant/company-settings";

export const dynamic = "force-dynamic";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireCapability("sales.budgets.view");
  const [updateDecision, approveDecision, invoiceDecision, workDecision, marginDecision, agendaDecision, duplicateDecision, pricingDecision] = await Promise.all([
    resolveAuthorization(auth, "sales.budgets.update"), resolveAuthorization(auth, "sales.budgets.approve"),
    resolveAuthorization(auth, "sales.invoices.create"), resolveAuthorization(auth, "work.create"), resolveAuthorization(auth, "margin_amount.view"),
    resolveAuthorization(auth, "agenda.manage"), resolveAuthorization(auth, "sales.budgets.create"), resolveAuthorization(auth, "sales.pricing.view")
  ]);
  const [budget, companyRecord] = await Promise.all([
    prisma.budget.findFirst({
      where: { id, companyId: auth.companyId },
      include: { client: true, work: true, reminders: true, agendaEvents: true }
    }),
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } })
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
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length;
  const canUpdate = canUpdateRaw && canSeePricing;
  const canApprove = canApproveRaw && canSeePricing;
  const canCreateInvoice = canCreateInvoiceRaw && canSeePricing;
  const canCreateWork = canCreateWorkRaw && canSeePricing;
  const canDuplicate = canDuplicateRaw && canSeePricing;
  const canEditBudget = canUpdate && budget.estado !== "aceptado";
  const marginPercent = budget.subtotal > 0 ? budget.margenEstimado / budget.subtotal * 100 : null;

  return (
    <main className="screen">
      <Link href="/presupuestos" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Presupuestos
      </Link>

      <PageHeader
        eyebrow={budget.numero}
        title={budget.titulo}
        description={`${budget.client.nombre}${budget.work ? ` · ${budget.work.titulo}` : " · Sin obra"}`}
        badge={<StatusPill status={budget.estado} />}
        action={canEditBudget ? <StatusForm id={budget.id} estado="enviado" label="Revisar y enviar" icon="send" className="primary-button" /> : undefined}
        secondaryActions={<>{canEditBudget ? <SaveDraftForm id={budget.id} /> : null}<ActionMenu>{canEditBudget ? <Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/presupuestos/${budget.id}`}><Pencil size={18} /> Editar datos generales</Link> : null}{canSchedule ? <Link href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&obraId=${budget.obraId ?? ""}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&descripcion=${encodeURIComponent(budget.titulo)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/presupuestos/${budget.id}`}><MessageCircle size={18} /> Preparar seguimiento</Link> : null}{canDuplicate ? <form action={duplicateBudget}><input type="hidden" name="id" value={budget.id} /><ConfirmSubmitButton message="¿Duplicar este presupuesto como borrador editable?"><Copy size={18} /> Duplicar</ConfirmSubmitButton></form> : null}{canSeePricing ? <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank"><Eye size={18} /> Vista previa PDF</Link> : null}{canSeePricing ? <Link href={`/presupuestos/${budget.id}/pdf`}><Download size={18} /> Descargar PDF</Link> : null}</ActionMenu></>}
      />

      {canSeePricing ? <MetricStrip className="mb-4">
          <Mini label="Subtotal" value={formatCurrency(budget.subtotal)} />
          <Mini label="IVA" value={formatCurrency(budget.iva)} />
          <Mini label="Descuento" value={formatCurrency(budget.descuento)} />
          <Mini label="Total" value={formatCurrency(budget.total)} />
          {canSeeMargin ? <Mini label="Margen" value={marginPercent === null ? "Datos insuficientes" : `${marginPercent.toFixed(1)} % · ${formatCurrency(budget.margenEstimado)}`} /> : null}
      </MetricStrip> : <Notice className="mb-4" tone="info" title="Precios restringidos" description="Puedes consultar el estado y seguimiento del presupuesto, pero los importes y precios de venta no están autorizados." />}

      {companyMissing ? <Notice className="mb-4" tone="warning" title="Datos pendientes antes de enviar" description={`Falta ${companyStatus.missingRequired.slice(0, 3).join(", ")}. Puedes guardar el borrador y generar una prueba, pero el documento seguirá incompleto.`} /> : null}

      <DetailSection title="Estado y fechas" description="Información de seguimiento del presupuesto.">
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
          <p><strong className="text-obra-ink">Creado:</strong> {formatDate(budget.fechaCreacion)}</p>
          <p><strong className="text-obra-ink">Enviado:</strong> {formatDate(budget.fechaEnvio)}</p>
          <p><strong className="text-obra-ink">Validez:</strong> {formatDate(budget.fechaValidez)}</p>
          <p><strong className="text-obra-ink">Seguimiento:</strong> {formatDate(budget.fechaSeguimiento)}</p>
          {canSeeMargin ? <p><strong className="text-obra-ink">Margen estimado:</strong> {formatCurrency(budget.margenEstimado)}</p> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canApprove ? <StatusForm id={budget.id} estado="aceptado" label="Marcar aceptado" icon="check" /> : null}
          {canApprove ? <StatusForm id={budget.id} estado="rechazado" label="Marcar rechazado" icon="x" /> : null}
          {canCreateWork ? <form action={convertBudgetToWork}>
            <input type="hidden" name="id" value={budget.id} />
            <ConfirmSubmitButton message="¿Convertir este presupuesto en obra?">Convertir a obra</ConfirmSubmitButton>
          </form> : null}
          {canCreateInvoice ? <form action={convertBudgetToInvoice}>
            <input type="hidden" name="id" value={budget.id} />
            <ConfirmSubmitButton message="¿Crear una factura borrador editable desde este presupuesto?">Convertir a factura</ConfirmSubmitButton>
          </form> : null}
        </div>
      </DetailSection>

      <EntityWorkflowSummary clientId={budget.clienteId} workId={budget.obraId ?? undefined} budgetId={budget.id} />
      {canEditBudget ? <section className="mt-4" aria-labelledby="budget-lines-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="budget-lines-title" className="text-lg font-black text-obra-ink">Partidas</h2>
            <p className="type-secondary mt-1">Edita cantidades y precios sin exponer el formato interno de las partidas.</p>
          </div>
          <Link href="/presupuestos/plantillas" className="secondary-button">Añadir desde plantilla</Link>
        </div>
        <div className="budget-editor-layout">
          <div id="budget-line-editor" className="grid content-start gap-3">
            {lines.map((line, index) => (
              <form key={`${line.descripcion}-${index}`} action={saveBudgetLine} className="card grid gap-3 p-4" data-budget-line>
                <input type="hidden" name="budgetId" value={budget.id} />
                <input type="hidden" name="lineIndex" value={index} />
                <BudgetLineFields line={line} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="submit" className="secondary-button"><Pencil size={18} /> Guardar partida</button>
                  <button formAction={deleteBudgetLine} className="secondary-button" type="submit">
                    <Trash2 size={18} />
                    Eliminar
                  </button>
                </div>
              </form>
            ))}
            <form action={saveBudgetLine} className="card grid gap-3 border-dashed p-4" data-budget-line>
              <input type="hidden" name="budgetId" value={budget.id} />
              <input type="hidden" name="lineIndex" value="" />
              <div className="flex items-center gap-2 text-sm font-black text-obra-ink">
                <Plus size={18} className="text-obra-yellowDark" />
                Añadir partida
              </div>
              <BudgetLineFields line={{ descripcion: "", cantidad: 1, unidad: "ud", precioUnitario: 0, total: 0, categoria: "General" }} />
              <button type="submit" className="secondary-button w-full"><Plus size={18} /> Añadir partida</button>
            </form>
          </div>
          <BudgetLivePreview
            budgetNumber={budget.numero}
            companyName={company.nombreComercial}
            clientName={budget.client.nombre}
            title={budget.titulo}
            initialLines={lines.map((line) => ({ description: line.descripcion, quantity: line.cantidad, unit: line.unidad, unitPrice: line.precioUnitario }))}
            initialSubtotal={budget.subtotal}
            initialTax={budget.iva}
            initialDiscount={budget.descuento}
          />
        </div>
      </section> : null}

      <section className="card mt-4 p-4">
        <div className="mb-3 flex items-center gap-2 text-lg font-black text-obra-ink">
          <FileText size={20} />
          Condiciones y observaciones
        </div>
        <div className="grid gap-2 text-sm leading-6 text-slate-600">
          <p><strong className="text-obra-ink">Condiciones:</strong> {budget.condiciones ?? "Sin condiciones."}</p>
          <p><strong className="text-obra-ink">Forma de pago:</strong> {budget.formaPago ?? "Sin forma de pago."}</p>
          <p><strong className="text-obra-ink">Observaciones:</strong> {budget.observaciones ?? "Sin observaciones."}</p>
        </div>
      </section>
    </main>
  );
}

function BudgetLineFields({ line }: { line: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number; categoria: string; total?: number } }) {
  return (
    <>
      <Field name="descripcion" label="Descripción" value={line.descripcion} required />
      <div className="grid grid-cols-2 gap-3">
        <Field name="cantidad" label="Cantidad" type="number" value={line.cantidad} required />
        <label>
          <span className="label mb-1 block">Unidad</span>
          <select className="field" name="unidad" defaultValue={line.unidad}>
            {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field name="precioUnitario" label="Precio unitario" type="number" value={line.precioUnitario} required />
        <Field name="categoria" label="Categoría" value={line.categoria} />
      </div>
    </>
  );
}

function Field({ name, label, value, type = "text", required = false }: { name: string; label: string; value: string | number; type?: string; required?: boolean }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} />
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}

function StatusForm({ id, estado, label, icon, className }: { id: string; estado: string; label: string; icon: "check" | "x" | "send"; className?: string }) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "x" ? XCircle : MessageCircle;
  return (
    <form action={updateBudgetStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <ConfirmSubmitButton className={className} message={estado === "enviado" ? "¿Has revisado importes, datos pendientes y PDF antes de marcar este presupuesto como enviado?" : `¿Aplicar el estado "${label}" a este presupuesto?`}>
        <Icon size={18} />
        {label}
      </ConfirmSubmitButton>
    </form>
  );
}

function SaveDraftForm({ id }: { id: string }) {
  return (
    <form action={updateBudgetStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value="borrador" />
      <button className="secondary-button" type="submit">Guardar borrador</button>
    </form>
  );
}

async function budgetDecisionAllowed(auth: Awaited<ReturnType<typeof requireCapability>>, capability: Parameters<typeof resolveScopedEntityIds>[1], decision: { allowed: boolean; scope: string }, budget: { obraId: string | null; clienteId: string }) {
  if (!decision.allowed) return false;
  if (decision.scope === "COMPANY") return true;
  const entityType = budget.obraId ? "Work" : "Client";
  const ids = await resolveScopedEntityIds(auth, capability, entityType);
  return Boolean(ids?.includes(budget.obraId ?? budget.clienteId));
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
