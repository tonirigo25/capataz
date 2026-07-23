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
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { StatusPill } from "@/components/status-pill";
import { ActionMenu, DetailSection, MetricStrip, Notice, PageHeader } from "@/components/ui-primitives";
import { parseBudgetLines, units } from "@/lib/budget-lines";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { companySettingsView } from "@/lib/tenant/company-settings";

export const dynamic = "force-dynamic";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireCapability("sales.budgets.view");
  const [canUpdate, canApprove, canCreateInvoice, canCreateWork] = await Promise.all([
    resolveAuthorization(auth, "sales.budgets.update"), resolveAuthorization(auth, "sales.budgets.approve"),
    resolveAuthorization(auth, "sales.invoices.create"), resolveAuthorization(auth, "work.create")
  ]).then((items) => items.map((item) => item.allowed));
  const [budget, companyRecord] = await Promise.all([
    prisma.budget.findFirst({
      where: { id, companyId: auth.companyId },
      include: { client: true, work: true, reminders: true, agendaEvents: true }
    }),
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } })
  ]);

  if (!budget) notFound();
  const company = companySettingsView(companyRecord);
  const lines = parseBudgetLines(budget.partidas);
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length;

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
        action={canUpdate ? <Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/presupuestos/${budget.id}`} className="primary-button"><Pencil size={18} /> Editar presupuesto</Link> : undefined}
        secondaryActions={<ActionMenu><Link href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&obraId=${budget.obraId ?? ""}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&descripcion=${encodeURIComponent(budget.titulo)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/presupuestos/${budget.id}`}><MessageCircle size={18} /> Preparar seguimiento</Link>{canUpdate ? <form action={duplicateBudget}><input type="hidden" name="id" value={budget.id} /><ConfirmSubmitButton message="¿Duplicar este presupuesto como borrador editable?"><Copy size={18} /> Duplicar</ConfirmSubmitButton></form> : null}<Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank"><Eye size={18} /> Vista previa PDF</Link><Link href={`/presupuestos/${budget.id}/pdf`}><Download size={18} /> Descargar PDF</Link></ActionMenu>}
      />

      <MetricStrip className="mb-4">
          <Mini label="Subtotal" value={formatCurrency(budget.subtotal)} />
          <Mini label="IVA" value={formatCurrency(budget.iva)} />
          <Mini label="Descuento" value={formatCurrency(budget.descuento)} />
          <Mini label="Total" value={formatCurrency(budget.total)} />
      </MetricStrip>

      {companyMissing ? <Notice className="mb-4" tone="warning" title="Datos de empresa incompletos" description={`Falta ${companyStatus.missingRequired.slice(0, 3).join(", ")}. Puedes generar el PDF, pero quedará incompleto.`} /> : null}

      <DetailSection title="Estado y fechas" description="Información de seguimiento del presupuesto.">
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
          <p><strong className="text-obra-ink">Creado:</strong> {formatDate(budget.fechaCreacion)}</p>
          <p><strong className="text-obra-ink">Enviado:</strong> {formatDate(budget.fechaEnvio)}</p>
          <p><strong className="text-obra-ink">Validez:</strong> {formatDate(budget.fechaValidez)}</p>
          <p><strong className="text-obra-ink">Seguimiento:</strong> {formatDate(budget.fechaSeguimiento)}</p>
          <p><strong className="text-obra-ink">Margen estimado:</strong> {formatCurrency(budget.margenEstimado)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canUpdate ? <StatusForm id={budget.id} estado="enviado" label="Marcar enviado" icon="send" /> : null}
          {canApprove ? <StatusForm id={budget.id} estado="aceptado" label="Marcar aceptado" icon="check" /> : null}
          {canUpdate ? <StatusForm id={budget.id} estado="rechazado" label="Marcar rechazado" icon="x" /> : null}
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
      {canUpdate ? <section className="mt-4">
        <h2 className="mb-3 text-lg font-black text-obra-ink">Partidas editables</h2>
        <div className="grid gap-3">
          {lines.map((line, index) => (
            <form key={`${line.descripcion}-${index}`} action={saveBudgetLine} className="card grid gap-3 p-4">
              <input type="hidden" name="budgetId" value={budget.id} />
              <input type="hidden" name="lineIndex" value={index} />
              <BudgetLineFields line={line} />
              <div className="grid grid-cols-2 gap-2">
                <button type="submit" className="primary-button"><Pencil size={18} /> Guardar partida</button>
                <button formAction={deleteBudgetLine} className="secondary-button" type="submit">
                  <Trash2 size={18} />
                  Eliminar
                </button>
              </div>
            </form>
          ))}
          <form action={saveBudgetLine} className="card grid gap-3 border-dashed p-4">
            <input type="hidden" name="budgetId" value={budget.id} />
            <input type="hidden" name="lineIndex" value="" />
            <div className="flex items-center gap-2 text-sm font-black text-obra-ink">
              <Plus size={18} className="text-obra-yellowDark" />
              Añadir partida
            </div>
            <BudgetLineFields line={{ descripcion: "", cantidad: 1, unidad: "ud", precioUnitario: 0, total: 0, categoria: "General" }} />
            <button type="submit" className="primary-button w-full"><Plus size={18} /> Añadir partida</button>
          </form>
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

function StatusForm({ id, estado, label, icon }: { id: string; estado: string; label: string; icon: "check" | "x" | "send" }) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "x" ? XCircle : MessageCircle;
  return (
    <form action={updateBudgetStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <ConfirmSubmitButton message={`¿Aplicar el estado "${label}" a este presupuesto?`}>
        <Icon size={18} />
        {label}
      </ConfirmSubmitButton>
    </form>
  );
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
