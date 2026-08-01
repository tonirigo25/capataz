import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  ArrowRight,
  BadgeEuro,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Euro,
  FileText,
  Filter,
  Grid2X2,
  Hammer,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Plus,
  Receipt,
  Search,
  Table2,
  UserRound,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { updateWorkStatus } from "@/app/(app)/obras/actions";
import { WorkPortfolio } from "@/components/portal/modules-a/work-portfolio";
import { EmptyState } from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapability, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { statusClass } from "@/lib/status";
import {
  calculateWorkFinancials,
  buildWorkTimeline,
  getWorkNextAction,
  invoicePaid,
  isActiveWorkStatus,
  isBlockedWorkStatus,
  workPriorityMeta,
  workStatusMeta,
  WORK_STATUS_META
} from "@/lib/works";

export const dynamic = "force-dynamic";

const viewOptions = [
  ["tarjetas", "Tarjetas", LayoutGrid],
  ["tabla", "Tabla", Table2],
  ["compacta", "Compacta", List],
  ["kanban", "Kanban", Grid2X2]
] as const;

const sortOptions = [
  ["riesgo", "Riesgo"],
  ["rentabilidad", "Rentabilidad"],
  ["fecha", "Fecha"],
  ["importe", "Importe"],
  ["cliente", "Cliente"]
];
const workListInclude = { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: { orderBy: { fechaInicio: "asc" as const } }, documents: true, photos: { orderBy: { tomadaEn: "desc" as const } } } satisfies Prisma.WorkInclude;
type WorkListRecord = Prisma.WorkGetPayload<{ include: typeof workListInclude }>;

type WorksQuery = {
  estado?: string;
  tipo?: string;
  prioridad?: string;
  responsable?: string;
  cliente?: string;
  buscar?: string;
  orden?: string;
  vista?: string;
  riesgo?: string;
};

export default async function WorksPage({ searchParams }: { searchParams: Promise<WorksQuery> }) {
  const query = await searchParams;
  const auth = await requireCapability("work.view");
  const { companyId } = auth;
  const scopedWorkIds = await resolveScopedEntityIds(auth, "work.view", "Work");
  const visibility = {
    budgets: (await resolveAuthorization(auth, "sales.budgets.view")).allowed,
    invoices: (await resolveAuthorization(auth, "sales.invoices.view")).allowed,
    purchaseCost: (await resolveAuthorization(auth, "purchase_cost.view")).allowed,
    internalCost: (await resolveAuthorization(auth, "internal_cost.view")).allowed,
    marginPercent: (await resolveAuthorization(auth, "margin_percent.view")).allowed,
    marginAmount: (await resolveAuthorization(auth, "margin_amount.view")).allowed,
    profit: (await resolveAuthorization(auth, "profitability.view")).allowed,
    projectBudget: (await resolveAuthorization(auth, "project_budget_control.view")).allowed,
    createWork: (await resolveAuthorization(auth, "work.create")).allowed,
    updateWork: (await resolveAuthorization(auth, "work.update")).allowed,
    createBudget: (await resolveAuthorization(auth, "sales.budgets.create")).allowed,
    createInvoice: (await resolveAuthorization(auth, "sales.invoices.create")).allowed,
    createExpense: (await resolveAuthorization(auth, "purchases.received_invoices.manage")).allowed
  };
  const scopedEconomicCapabilities = [visibility.budgets ? "sales.budgets.view" : null, visibility.invoices ? "sales.invoices.view" : null, visibility.purchaseCost ? "purchase_cost.view" : null, visibility.internalCost ? "internal_cost.view" : null, visibility.marginPercent ? "margin_percent.view" : null, visibility.marginAmount ? "margin_amount.view" : null, visibility.profit ? "profitability.view" : null, visibility.projectBudget ? "project_budget_control.view" : null].filter((key): key is Parameters<typeof resolveScopedEntityIds>[1] => Boolean(key));
  const economicScopes = await Promise.all(scopedEconomicCapabilities.map((capability) => resolveScopedEntityIds(auth, capability, "Work")));
  const economicScopeByCapability = new Map(scopedEconomicCapabilities.map((capability, index) => [capability, economicScopes[index]]));
  const [createBudgetScope, createInvoiceScope, createExpenseScope, updateWorkScope] = await Promise.all([
    visibility.createBudget ? resolveScopedEntityIds(auth, "sales.budgets.create", "Work") : Promise.resolve([]),
    visibility.createInvoice ? resolveScopedEntityIds(auth, "sales.invoices.create", "Work") : Promise.resolve([]),
    visibility.createExpense ? resolveScopedEntityIds(auth, "purchases.received_invoices.manage", "Work") : Promise.resolve([]),
    visibility.updateWork ? resolveScopedEntityIds(auth, "work.update", "Work") : Promise.resolve([])
  ]);
  const scopeWhere = scopedWorkIds === null ? {} : { id: { in: scopedWorkIds } };
  const works = await prisma.work.findMany({
    where: { companyId, ...scopeWhere },
    orderBy: [{ prioridad: "desc" }, { fechaFinPrevista: "asc" }],
    include: workListInclude
  });
  const enriched = works.map((work) => {
    const itemVisibility: WorkEconomicVisibility = {
      ...visibility,
      budgets: visibility.budgets && scopeAllows(economicScopeByCapability.get("sales.budgets.view"), work.id),
      invoices: visibility.invoices && scopeAllows(economicScopeByCapability.get("sales.invoices.view"), work.id),
      purchaseCost: visibility.purchaseCost && scopeAllows(economicScopeByCapability.get("purchase_cost.view"), work.id),
      internalCost: visibility.internalCost && scopeAllows(economicScopeByCapability.get("internal_cost.view"), work.id),
      marginPercent: visibility.marginPercent && scopeAllows(economicScopeByCapability.get("margin_percent.view"), work.id),
      marginAmount: visibility.marginAmount && scopeAllows(economicScopeByCapability.get("margin_amount.view"), work.id),
      profit: visibility.profit && scopeAllows(economicScopeByCapability.get("profitability.view"), work.id),
      projectBudget: visibility.projectBudget && scopeAllows(economicScopeByCapability.get("project_budget_control.view"), work.id),
      createBudget: visibility.createBudget && scopeAllows(createBudgetScope, work.id),
      createInvoice: visibility.createInvoice && scopeAllows(createInvoiceScope, work.id),
      createExpense: visibility.createExpense && scopeAllows(createExpenseScope, work.id),
      updateWork: visibility.updateWork && scopeAllows(updateWorkScope, work.id)
    };
    const financial = calculateWorkFinancials(work);
    const overduePending = itemVisibility.invoices ? work.invoices.reduce((sum, invoice) => invoice.fechaVencimiento < new Date() ? sum + Math.max(0, invoice.total - invoicePaid(invoice)) : sum, 0) : 0;
    const nextAction: ReturnType<typeof getWorkNextAction> = isBlockedWorkStatus(work.estado)
      ? { label: "Revisar bloqueo operativo", tone: "danger", href: "resumen" }
      : isActiveWorkStatus(work.estado)
        ? { label: "Revisar planificación", tone: "neutral", href: "resumen" }
        : { label: "Revisar estado", tone: "neutral", href: "resumen" };
    const status = workStatusMeta(work.estado);
    const priority = workPriorityMeta(work.prioridad);
    const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
    const pendingDocs = (itemVisibility.budgets ? work.budgets.length : 0) + (itemVisibility.invoices ? work.invoices.length : 0) + work.documents.length;
    return {
      work,
      financial,
      nextAction,
      status,
      priority,
      pendingMaterials,
      pendingDocs,
      overduePending,
      visibility: itemVisibility,
      hasRisk: isBlockedWorkStatus(work.estado) || (itemVisibility.marginPercent && financial.marginPercent < 15) || overduePending > 0
    };
  });

  const clients = [...new Map(works.map((work) => [work.client.id, work.client.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const responsibles = [...new Set(works.map((work) => work.responsable).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es"));
  const workTypes = [...new Set(works.map((work) => work.tipoTrabajo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const filteredWorks = filterWorks(enriched, query);
  const visibleWorks = sortWorks(query.riesgo === "1" ? filteredWorks.filter((item) => item.hasRisk) : filteredWorks, query.orden ?? "riesgo");
  const activeFilterCount = [query.estado, query.tipo, query.prioridad, query.responsable, query.cliente, query.buscar, query.riesgo].filter((value) => Boolean(value) && !["todas", "todos"].includes(value!)).length;
  const view = viewOptions.some(([id]) => id === query.vista) ? query.vista! : "tabla";
  const portfolioItems = visibleWorks.map((item) => {
    const purchaseCost = item.work.gastoReal + item.work.subcontratasCoste + item.work.expenses.reduce((sum, expense) => sum + expense.importe, 0);
    const authorizedCost = item.visibility.purchaseCost && item.visibility.internalCost
      ? item.financial.realCost
      : item.visibility.purchaseCost
        ? purchaseCost
        : item.visibility.internalCost
          ? item.work.costePrevisto
          : null;
    const nextVisit = item.work.agendaEvents.find((event) => event.tipo === "visita" && !["cancelado", "realizado"].includes(event.estado) && event.fechaInicio >= new Date());
    const safePhotos = item.work.photos.filter((photo) => typeof photo.url === "string" && (photo.url.startsWith("/") || photo.url.startsWith("https://")));
    const thumbnailUrl = safePhotos.find((photo) => photo.categoria.trim().toLowerCase() !== "incidencia")?.url ?? safePhotos[0]?.url ?? null;
    const incidentPhotos = item.work.photos.filter(
      (photo) => photo.categoria.trim().toLowerCase() === "incidencia",
    );
    const team = [
      item.work.responsable ? { name: item.work.responsable, role: "Responsable" } : null,
      item.work.jefeObra ? { name: item.work.jefeObra, role: "Jefe de obra" } : null,
      item.work.comercial ? { name: item.work.comercial, role: "Comercial" } : null,
    ].filter((member): member is { name: string; role: string } => Boolean(member))
      .filter((member, index, members) => members.findIndex((candidate) => candidate.name === member.name) === index);
    const timeline = buildWorkTimeline(item.work).slice(0, 6).reverse().map((entry) => ({
      label: entry.title,
      date: formatDate(entry.date),
      status: entry.detail,
    }));
    return {
      id: item.work.id,
      title: item.work.titulo,
      client: item.work.client.nombre,
      code: item.work.codigo ?? item.work.numeroInterno,
      workType: item.work.tipoTrabajo,
      thumbnailUrl,
      status: item.status.label,
      active: isActiveWorkStatus(item.work.estado),
      statusClassName: statusClass(item.work.estado),
      priority: item.priority.label,
      nextAction: item.nextAction.label,
      nextDate: formatDate(item.work.fechaFinPrevista ?? item.work.fechaInicioPrevista ?? item.work.fechaInicio),
      updatedAt: formatDate(item.work.updatedAt),
      responsible: item.work.responsable ?? "Sin asignar",
      margin: item.visibility.marginPercent ? `${item.financial.marginPercent}%` : null,
      budget: item.visibility.budgets ? formatCurrency(item.financial.budgeted) : null,
      budgetAmount: item.visibility.budgets ? item.financial.budgeted : null,
      cost: authorizedCost === null ? null : formatCurrency(authorizedCost),
      pending: item.visibility.invoices ? formatCurrency(item.financial.pending) : null,
      risk: item.hasRisk,
      riskReason: isBlockedWorkStatus(item.work.estado)
        ? `Estado: ${item.status.label}`
        : item.visibility.marginPercent && item.financial.marginPercent < 15
          ? `Margen previsto · ${item.financial.marginPercent.toFixed(1)} %`
          : item.overduePending > 0
            ? `Vencido ${formatCurrency(item.overduePending)}`
            : null,
      marginRisk: item.visibility.marginPercent && item.financial.marginPercent < 15,
      pendingMaterials: item.pendingMaterials.length,
      pendingDocuments: item.pendingDocs,
      closingSoon: ["pendiente_remates", "parcialmente_terminada", "finalizada"].includes(item.work.estado),
      progressLabel: item.status.label,
      progressPercent: null,
      visit: nextVisit ? {
        label: nextVisit.titulo,
        date: formatDate(nextVisit.fechaInicio),
        href: "/agenda",
      } : null,
      incidentCount: incidentPhotos.length,
      incidentLabels: incidentPhotos.map((photo) => photo.titulo),
      team,
      timeline,
      actionHrefs: item.visibility.updateWork ? {
        part: `/capataz?captura=avance&obraId=${item.work.id}&returnTo=/obras`,
        incident: `/gestion?tipo=foto&obraId=${item.work.id}&categoria=incidencia&returnTo=/obras`,
        visit: `/gestion?tipo=eventoAgenda&tipoEvento=visita&obraId=${item.work.id}&returnTo=/obras`,
        status: `/obras/${item.work.id}?vista=datos`,
      } : null,
    };
  });

  const exportAccess = await resolveAuthorization(auth, "reports.export");
  const canExport = exportAccess.allowed
    && scopedWorkIds === null
    && visibility.budgets
    && visibility.invoices
    && visibility.purchaseCost
    && visibility.internalCost
    && visibility.marginPercent
    && visibility.marginAmount
    && visibility.profit;

  return (
    <main className="works-page">
      <header className="works-page__header">
        <h1>Trabajo</h1>
        <p>Gestiona todas tus obras y partes en marcha.</p>
      </header>

      <form action="/obras" className="works-filterbar">
        <FilterSelect name="estado" label="Estado" value={query.estado ?? "todas"} options={[["todas", "Todos"], ...Object.entries(WORK_STATUS_META).map(([id, meta]) => [id, meta.label] as [string, string])]} />
        <FilterSelect name="tipo" label="Tipo de obra" value={query.tipo ?? "todos"} options={[["todos", "Todos"], ...workTypes.map((value) => [value, value] as [string, string])]} />
        <FilterSelect name="responsable" label="Responsable" value={query.responsable ?? "todos"} options={[["todos", "Todos"], ...responsibles.map((name) => [name, name] as [string, string])]} />
        <FilterSelect name="cliente" label="Cliente" value={query.cliente ?? "todos"} options={[["todos", "Todos"], ...clients]} />
        <details className="works-more-filters">
          <summary><Filter size={17} aria-hidden="true" /> Más filtros</summary>
          <div className="works-more-filters__panel">
            <label className="min-w-0">
              <span className="label mb-1 flex items-center gap-1"><Search size={14} /> Buscar</span>
              <input className="field" name="buscar" defaultValue={query.buscar ?? ""} placeholder="Trabajo, cliente, código o dirección…" />
            </label>
            <FilterSelect name="prioridad" label="Prioridad" value={query.prioridad ?? "todas"} options={[["todas", "Todas"], ["urgente", "Urgente"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]]} />
            <FilterSelect name="orden" label="Orden" value={query.orden ?? "riesgo"} options={sortOptions as Array<[string, string]>} />
            <div className="works-more-filters__actions">
              <button className="primary-button" type="submit">Aplicar filtros</button>
              <Link className="secondary-button" href="/obras">Limpiar</Link>
              {visibility.createWork ? <Link href="/gestion?tipo=obra&returnTo=/obras" className="secondary-button"><Plus size={17} /> Nuevo trabajo</Link> : null}
            </div>
          </div>
        </details>
        <label className="works-view-select">
          <span>Vista</span>
          <select name="vista" defaultValue={view}>
            {viewOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        {canExport ? <Link href="/inteligencia/export?tipo=works" className="works-export"><Download size={17} aria-hidden="true" /> Exportar</Link> : null}
        <button className="works-filter-submit" type="submit">Actualizar</button>
      </form>

      <div className="sr-only" aria-live="polite">
        <span>{visibleWorks.length} de {works.length} obras</span>
        {(query.estado || query.tipo || query.responsable || query.cliente || query.buscar || query.prioridad) ? <Link href="/obras">Limpiar filtros</Link> : null}
      </div>

      {!visibleWorks.length ? (
        <EmptyState
          title={works.length ? "No hay trabajos para estos filtros" : "Todavía no hay trabajos"}
          description={works.length ? "Cambia la búsqueda o limpia los filtros activos." : "Crea el primer trabajo y vincúlalo a un cliente para organizar su ejecución."}
          icon={BriefcaseBusiness}
          action={visibility.createWork ? <Link href="/gestion?tipo=obra&returnTo=/obras" className="primary-button">Crear trabajo</Link> : undefined}
        />
      ) : view === "tabla" ? (
        <WorkPortfolio items={portfolioItems} totalAuthorizedCount={works.length} activeFilterCount={activeFilterCount} />
      ) : view === "compacta" ? (
        <CompactList items={visibleWorks} />
      ) : view === "kanban" ? (
        <KanbanView items={visibleWorks} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleWorks.map((item) => <WorkCard key={item.work.id} item={item} />)}
        </div>
      )}
    </main>
  );
}

type WorkEconomicVisibility = { budgets: boolean; invoices: boolean; purchaseCost: boolean; internalCost: boolean; marginPercent: boolean; marginAmount: boolean; profit: boolean; projectBudget: boolean; createWork: boolean; updateWork: boolean; createBudget: boolean; createInvoice: boolean; createExpense: boolean };

function WorkCard({ item }: { item: WorkItem }) {
  const { work, financial, status, priority, nextAction, pendingMaterials } = item;
  const visibility = item.visibility;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-obra-yellowDark">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={work.estado} iconLabel={status.icon} />
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${priority.tone === "danger" ? "bg-red-50 text-red-700" : priority.tone === "warning" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
              {priority.label}
            </span>
          </div>
          <Link href={`/obras/${work.id}`} className="mt-3 block text-xl font-black leading-tight text-obra-ink hover:underline">
            {work.codigo ? `${work.codigo} · ` : ""}{work.titulo}
          </Link>
          <p className="mt-1 text-sm leading-6 text-slate-600">{work.client.nombre} · {work.tipoTrabajo}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={15} /> {work.direccion}</p>
        </div>
        <Link href={`/obras/${work.id}`} className="secondary-button shrink-0">Abrir <ArrowRight size={17} /></Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {visibility.budgets ? <Mini label="Presupuestado" value={formatCurrency(financial.budgeted)} /> : null}
        {visibility.invoices ? <Mini label="Facturado" value={formatCurrency(financial.invoiced)} /> : null}
        {visibility.invoices ? <Mini label="Pendiente" value={formatCurrency(financial.pending)} tone={financial.pending ? "warning" : "neutral"} /> : null}
        {visibility.marginPercent ? <Mini label="Margen" value={`${financial.marginPercent}%`} tone={financial.marginPercent < 15 && financial.budgeted ? "danger" : "success"} /> : null}
        {visibility.marginAmount ? <Mini label="Margen importe" value={formatCurrency(financial.benefit)} /> : null}
        {visibility.purchaseCost ? <Mini label="Coste compra" value={formatCurrency(work.gastoReal + work.subcontratasCoste + work.expenses.reduce((sum, expense) => sum + expense.importe, 0))} /> : null}
        {visibility.internalCost ? <Mini label="Coste interno" value={formatCurrency(work.costePrevisto)} /> : null}
        {visibility.projectBudget ? <Mini label="Disponible" value={formatCurrency(work.presupuestoAprobado - financial.realCost)} /> : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
        <div className={`rounded-lg border p-3 ${nextAction.tone === "danger" ? "border-red-200 bg-red-50" : nextAction.tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-xs font-black uppercase text-slate-500">Próxima acción</p>
          <p className="mt-1 text-sm font-black text-obra-ink">{nextAction.label}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Counter icon={Package} label="Mat." value={pendingMaterials.length} />
          <Counter icon={FileText} label="Docs" value={item.pendingDocs} />
          <Counter icon={Bell} label="Rec." value={work.reminders.length} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibility.createBudget ? <Link href={`/gestion?tipo=presupuesto&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=/obras/${work.id}`} className="secondary-button"><FileText size={17} /> Presupuesto</Link> : null}
        {visibility.createInvoice ? <Link href={`/gestion?tipo=factura&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=/obras/${work.id}`} className="secondary-button"><Receipt size={17} /> Factura</Link> : null}
        {visibility.createExpense ? <Link href={`/gestion?tipo=gasto&obraId=${work.id}&returnTo=/obras/${work.id}`} className="secondary-button"><Euro size={17} /> Gasto</Link> : null}
        {visibility.updateWork ? <WorkStatusButton id={work.id} estado="en_curso" label="En curso" /> : null}
        {visibility.updateWork ? <WorkStatusButton id={work.id} estado="finalizada" label="Finalizar" /> : null}
      </div>
    </article>
  );
}

function CompactList({ items }: { items: WorkItem[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Link key={item.work.id} href={`/obras/${item.work.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft transition hover:border-obra-yellowDark">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-obra-ink">{item.work.titulo}</p>
              <p className="text-sm text-slate-500">{item.work.client.nombre} · {item.nextAction.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={item.work.estado} iconLabel={item.status.icon} />
              {item.visibility.invoices ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{formatCurrency(item.financial.pending)} pendiente</span> : null}
              {item.visibility.marginPercent ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{item.financial.marginPercent}% margen</span> : null}
              {item.visibility.marginAmount ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{formatCurrency(item.financial.benefit)} margen</span> : null}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function KanbanView({ items }: { items: WorkItem[] }) {
  const phases = [
    ["entrada", "Entrada"],
    ["planificacion", "Planificación"],
    ["ejecucion", "Ejecución"],
    ["bloqueo", "Bloqueos"],
    ["cierre", "Cierre"]
  ] as const;
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {phases.map(([phase, label]) => {
        const phaseItems = items.filter((item) => item.status.phase === phase);
        return (
          <section key={phase} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-obra-ink">{label}</h2>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-500">{phaseItems.length}</span>
            </div>
            <div className="grid gap-2">
              {phaseItems.map((item) => (
                <Link key={item.work.id} href={`/obras/${item.work.id}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
                  <p className="text-sm font-black text-obra-ink">{item.work.titulo}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.work.client.nombre}</p>
                  <p className="mt-2 text-xs font-bold text-slate-600">{item.nextAction.label}</p>
                </Link>
              ))}
              {!phaseItems.length ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Sin trabajos en esta fase.</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WorkStatusButton({ id, estado, label }: { id: string; estado: string; label: string }) {
  return (
    <form action={updateWorkStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className="secondary-button">{label}</button>
    </form>
  );
}

function StatusBadge({ status, iconLabel }: { status: string; iconLabel: string }) {
  const Icon = iconFor(iconLabel);
  const meta = workStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>
      <Icon size={14} />
      {meta.label}
    </span>
  );
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-obra-ink";
  return (
    <div className={`rounded-lg p-2 ${toneClass}`}>
      <p className="text-xs font-bold uppercase opacity-75">{label}</p>
      <p className="mt-1 truncate font-black tabular-nums">{value}</p>
    </div>
  );
}

function Counter({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <Icon size={17} className="mx-auto text-slate-500" />
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
      <p className="font-black text-obra-ink">{value}</p>
    </div>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select name={name} className="field" defaultValue={value}>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  );
}

function filterWorks(items: WorkItem[], query: WorksQuery) {
  const search = normalize(query.buscar ?? "");
  return items.filter((item) => {
    const work = item.work;
    if (query.estado && query.estado !== "todas" && work.estado !== query.estado) return false;
    if (query.tipo && query.tipo !== "todos" && work.tipoTrabajo !== query.tipo) return false;
    if (query.prioridad && query.prioridad !== "todas" && work.prioridad !== query.prioridad) return false;
    if (query.cliente && query.cliente !== "todos" && work.clienteId !== query.cliente) return false;
    if (query.responsable && query.responsable !== "todos" && work.responsable !== query.responsable) return false;
    if (!search) return true;
    const haystack = normalize(`${work.titulo} ${work.codigo ?? ""} ${work.numeroInterno ?? ""} ${work.client.nombre} ${work.direccion} ${work.tipoTrabajo} ${work.responsable ?? ""} ${work.jefeObra ?? ""}`);
    return haystack.includes(search);
  });
}

function sortWorks(items: WorkItem[], order: string) {
  return [...items].sort((a, b) => {
    if (order === "rentabilidad") return (a.visibility.marginPercent ? a.financial.marginPercent : Number.POSITIVE_INFINITY) - (b.visibility.marginPercent ? b.financial.marginPercent : Number.POSITIVE_INFINITY);
    if (order === "fecha") return timeValue(a.work.fechaFinPrevista ?? a.work.fechaInicioPrevista ?? a.work.fechaInicio) - timeValue(b.work.fechaFinPrevista ?? b.work.fechaInicioPrevista ?? b.work.fechaInicio);
    if (order === "importe") return (b.visibility.budgets ? b.financial.budgeted : 0) - (a.visibility.budgets ? a.financial.budgeted : 0);
    if (order === "cliente") return a.work.client.nombre.localeCompare(b.work.client.nombre, "es");
    const riskA = (a.hasRisk ? 10 : 0) + workPriorityMeta(a.work.prioridad).rank + (isBlockedWorkStatus(a.work.estado) ? 10 : 0);
    const riskB = (b.hasRisk ? 10 : 0) + workPriorityMeta(b.work.prioridad).rank + (isBlockedWorkStatus(b.work.estado) ? 10 : 0);
    return riskB - riskA || timeValue(a.work.fechaFinPrevista) - timeValue(b.work.fechaFinPrevista);
  });
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function timeValue(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function iconFor(name: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    BadgeEuro,
    BriefcaseBusiness,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    FileText,
    Hammer,
    PackageSearch: Package,
    Receipt,
    WalletCards,
    UserRoundCheck: UserRound
  };
  return icons[name] ?? BriefcaseBusiness;
}

type WorkItem = {
  work: WorkListRecord;
  financial: ReturnType<typeof calculateWorkFinancials>;
  nextAction: ReturnType<typeof getWorkNextAction>;
  status: ReturnType<typeof workStatusMeta>;
  priority: ReturnType<typeof workPriorityMeta>;
  pendingMaterials: WorkListRecord["materials"];
  pendingDocs: number;
  overduePending: number;
  visibility: WorkEconomicVisibility;
  hasRisk: boolean;
};

function scopeAllows(ids: string[] | null | undefined, id: string) { return ids === null || Boolean(ids?.includes(id)); }
