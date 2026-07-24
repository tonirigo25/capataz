import Link from "next/link";
import { ArrowLeft, Copy, FileText, Plus } from "lucide-react";
import { createBudgetFromTemplate } from "@/app/(app)/presupuestos/actions";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { Notice } from "@/components/ui-primitives";
import { isUnlimitedMode } from "@/lib/app-mode";
import { budgetTemplates } from "@/lib/budget-templates";
import { prisma } from "@/lib/prisma";
import { requireCapability, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

export default async function BudgetTemplatesPage() {
  const auth = await requireCapability("sales.budgets.view");
  const { companyId } = auth;
  const [createDecision, pricingDecision] = await Promise.all([
    resolveAuthorization(auth, "sales.budgets.create"), resolveAuthorization(auth, "sales.pricing.view")
  ]);
  const canCreate = createDecision.allowed && pricingDecision.allowed;
  const [viewWorkIds, viewClientIds, createWorkIds, createClientIds, pricingWorkIds, pricingClientIds, allClients, allWorks, allBudgets] = await Promise.all([
    resolveScopedEntityIds(auth, "sales.budgets.view", "Work"), resolveScopedEntityIds(auth, "sales.budgets.view", "Client"),
    canCreate ? resolveScopedEntityIds(auth, "sales.budgets.create", "Work") : Promise.resolve([]), canCreate ? resolveScopedEntityIds(auth, "sales.budgets.create", "Client") : Promise.resolve([]),
    canCreate ? resolveScopedEntityIds(auth, "sales.pricing.view", "Work") : Promise.resolve([]), canCreate ? resolveScopedEntityIds(auth, "sales.pricing.view", "Client") : Promise.resolve([]),
    prisma.client.findMany({ where: { companyId }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.work.findMany({ where: { companyId }, orderBy: { titulo: "asc" }, select: { id: true, titulo: true, clienteId: true, client: { select: { nombre: true } } } }),
    prisma.budget.findMany({ where: { companyId }, select: { obraId: true, clienteId: true } })
  ]);
  const works = allWorks.filter((work) => canCreate && scopeAllows(createDecision.scope, createWorkIds, work.id) && scopeAllows(pricingDecision.scope, pricingWorkIds, work.id));
  const requiresWork = createDecision.scope === "SELECTED_WORKS" || pricingDecision.scope === "SELECTED_WORKS";
  const clientPool = requiresWork ? new Set(works.map((work) => work.clienteId)) : null;
  const clients = allClients.filter((client) => canCreate && (clientPool ? clientPool.has(client.id) : scopeAllows(createDecision.scope, createClientIds, client.id) && scopeAllows(pricingDecision.scope, pricingClientIds, client.id)));
  const budgetCount = allBudgets.filter((budget) => relationAllowed(auth.scope, viewWorkIds, viewClientIds, budget.obraId, budget.clienteId)).length;
  const groups = Array.from(new Set(budgetTemplates.map((template) => template.group)));
  const demoLimitReached = !isUnlimitedMode() && budgetCount >= 2;

  return <main className="screen">
    <Link href="/presupuestos" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink"><ArrowLeft size={18} />Presupuestos</Link>
    <section className="mb-5"><h1 className="text-2xl font-black text-obra-ink">Crear presupuesto desde plantilla</h1><p className="mt-2 text-sm leading-6 text-slate-600">Elige oficio, cliente y, cuando tu alcance lo exige, una obra autorizada.</p></section>
    {!canCreate ? <Notice tone="info" title="Plantillas en modo lectura" description="Crear un presupuesto desde plantilla requiere permiso de creación y acceso a precios de venta." /> : null}
    <div className="grid gap-5">{groups.map((group) => <section key={group}><h2 className="mb-3 text-lg font-black text-obra-ink">{group}</h2><div className="grid gap-3">{budgetTemplates.filter((template) => template.group === group).map((template) => canCreate ? <form key={template.id} action={createBudgetFromTemplate} className="card grid gap-3 p-4"><input type="hidden" name="templateId" value={template.id} /><TemplateHeader template={template} /><label><span className="label mb-1 block">Cliente</span><select className="field" name="clienteId" required defaultValue=""><option value="">Seleccionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nombre}</option>)}</select></label><label><span className="label mb-1 block">Obra {requiresWork ? "obligatoria" : "opcional"}</span><select className="field" name="obraId" required={requiresWork} defaultValue=""><option value="">{requiresWork ? "Seleccionar obra autorizada" : "Sin obra asociada"}</option>{works.map((work) => <option key={work.id} value={work.id}>{work.titulo} · {work.client.nombre}</option>)}</select></label>{demoLimitReached ? <DemoLimitButton className="primary-button w-full" currentCount={budgetCount} limit={2}>Crear desde plantilla</DemoLimitButton> : <button type="submit" className="primary-button w-full"><Plus size={18} />Crear desde plantilla</button>}<button type="submit" className="secondary-button w-full"><Copy size={18} />Duplicar plantilla como presupuesto</button></form> : <article key={template.id} className="card p-4"><TemplateHeader template={template} /></article>)}</div></section>)}</div>
  </main>;
}

function TemplateHeader({ template }: { template: (typeof budgetTemplates)[number] }) { return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark"><FileText size={19} /></span><div><h3 className="font-black text-obra-ink">{template.name}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{template.description}</p><p className="mt-1 text-xs font-semibold uppercase text-slate-500">{template.lines.length} partidas editables</p></div></div>; }
function scopeAllows(scope: string, ids: string[] | null, id: string) { return scope === "COMPANY" || Boolean(ids?.includes(id)); }
function relationAllowed(scope: string, workIds: string[] | null, clientIds: string[] | null, workId: string | null, clientId: string) { if (scope === "COMPANY") return true; if (scope === "SELECTED_WORKS") return Boolean(workId && workIds?.includes(workId)); if (scope === "SELECTED_CLIENTS") return Boolean(clientIds?.includes(clientId)); return workId ? Boolean(workIds?.includes(workId)) : Boolean(clientIds?.includes(clientId)); }
