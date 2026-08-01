import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  Banknote,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  Euro,
  FileArchive,
  FileText,
  Filter,
  GitBranch,
  ListChecks,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Table2,
  TimerReset,
  UserRound,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { updateWorkStatus } from "@/app/(app)/obras/actions";
import { RecordWorkspace } from "@/components/workspaces";
import { EntityHeader, Notice, ParentNavigation, Tabs } from "@/components/ui-primitives";
import { WorkProgressGallery } from "@/components/work-progress-gallery";
import { WorkPlanningGantt, WorkPlanningSummary } from "@/components/portal/modules-a/work-planning";
import { WorkPlanningCalendar } from "@/components/portal/modules-a/work-planning-calendar";
import { WorkPlanningLoad, WorkPlanningResources } from "@/components/portal/modules-a/work-planning-capacity";
import { WorkPlanningMilestones } from "@/components/portal/modules-a/work-planning-milestones";
import { WorkPlanningNetwork } from "@/components/portal/modules-a/work-planning-network";
import { WorkCostsOverview } from "@/components/portal/modules-a/work-costs-overview";
import { WorkCostsStructure } from "@/components/portal/modules-a/work-costs-structure";
import { WorkCostsAnalysis } from "@/components/portal/modules-a/work-costs-analysis";
import { WorkCostsIncidentsRanking } from "@/components/portal/modules-a/work-costs-incidents-ranking";
import { WorkBillingOverview } from "@/components/portal/modules-a/work-billing-overview";
import { WorkTeamOverview, type WorkTeamApprover, type WorkTeamPerson } from "@/components/portal/modules-a/work-team-overview";
import { WorkDocumentsWorkspace as WorkDocumentsReferenceWorkspace } from "@/components/portal/modules-a/work-documents-workspace";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapability, resolveAuthorization, resolveScopedEntityIds, resolveScopedTaskIds } from "@/lib/commercial/authorization";
import { statusClass, statusLabel } from "@/lib/status";
import { getEconomicControl } from "@/lib/economic-control/queries";
import type { EconomicDocument } from "@/lib/economic-control/types";
import { brand } from "@/lib/brand";
import {
  buildWorkDocuments,
  buildWorkRisks,
  buildWorkTimeline,
  calculateWorkFinancials,
  getWorkNextAction,
  invoicePaid,
  workStatusMeta
} from "@/lib/works";

export const dynamic = "force-dynamic";

const tabs = [
  ["resumen", "Resumen", BriefcaseBusiness],
  ["planificacion", "Planificación", CalendarClock],
  ["partes", "Partes", ClipboardList],
  ["costes", "Costes", Euro],
  ["documentos", "Documentos", FileArchive],
  ["equipo", "Equipo", Users],
  ["facturacion", "Facturación", Receipt],
  ["incidencias", "Incidencias", AlertTriangle],
] as const;

const legacyTabs: Record<string, (typeof tabs)[number][0]> = {
  cliente: "resumen", configuracion: "resumen", ia: "resumen",
  progreso: "partes", fotografias: "documentos", notas: "partes", cronologia: "partes",
  economia: "costes", dinero: "facturacion", presupuestos: "costes", facturas: "facturacion", cobros: "facturacion", tesoreria: "facturacion", gastos: "costes", materiales: "costes", horas: "costes", subcontratas: "costes",
  visitas: "planificacion", recordatorios: "planificacion",
  archivos: "documentos", contactos: "equipo", personal: "equipo"
};

const workSubviews: Record<(typeof tabs)[number][0], readonly [string, string][]> = {
  resumen: [["general", "Resumen"]],
  planificacion: [["resumen", "Resumen y cronograma"], ["gantt", "Gantt"], ["calendario", "Calendario"], ["hitos", "Hitos"], ["dependencias", "Dependencias"], ["ruta-critica", "Ruta crítica"], ["carga-trabajo", "Carga de trabajo"], ["recursos", "Recursos"], ["linea-base", "Línea base"], ["escenarios", "Escenarios"]],
  partes: [["resumen", "Resumen"], ["diarios", "Partes diarios"], ["actividades", "Todas las actividades"], ["nuevo", "Nuevo parte"], ["semanales", "Partes semanales"], ["mensuales", "Partes mensuales"], ["reportes", "Reportes"], ["analisis", "Análisis"]],
  costes: [["resumen", "Resumen"], ["estructura", "Estructura completa"], ["analisis", "Análisis"], ["incidencias", "Incidencias"], ["ranking", "Ranking"], ["proveedores", "Proveedores"], ["mano-obra", "Mano de obra"], ["materiales", "Materiales"], ["subcontratas", "Subcontratas"], ["ordenes", "Órdenes"], ["comparativa", "Comparativa"], ["informes", "Informes"]],
  documentos: [["documentos", "Documentos"], ["subir", "Subir"], ["galeria", "Galería y portada"], ["planos", "Planos"], ["certificados", "Certificados"], ["informes", "Informes"], ["otros", "Otros"]],
  equipo: [["equipo", "Equipo"], ["carga", "Carga"], ["turnos", "Turnos"], ["subcontratas", "Subcontratas"], ["formacion", "Formación"], ["permisos", "Permisos"]],
  facturacion: [["resumen", "Resumen"], ["certificaciones", "Certificaciones"], ["facturas", "Facturas emitidas"], ["hitos", "Hitos facturados"], ["retenciones", "Retenciones"], ["cobros", "Cobros pendientes"], ["vencimientos", "Calendario de vencimientos"], ["historico", "Histórico"]],
  incidencias: [["todas", "Todas"]],
};

const workDetailInclude = {
  client: true, contact: true,
  repositoryDocuments: { orderBy: { createdAt: "desc" as const } },
  internalNotes: { orderBy: { createdAt: "desc" as const } },
  budgets: { orderBy: { fechaCreacion: "desc" as const }, include: { reminders: true, agendaEvents: true } },
  invoices: { orderBy: { fechaEmision: "desc" as const }, include: { payments: true, reminders: true, agendaEvents: true } },
  payments: { orderBy: { fecha: "desc" as const }, include: { invoice: true } },
  expenses: { orderBy: { fecha: "desc" as const }, include: { businessPartner: { select: { id: true, commercialName: true, kind: true } }, purchaseInvoice: { select: { id: true, kind: true, invoiceNumber: true, pendingAmount: true } } } },
  materials: true,
  reminders: { orderBy: { fechaProgramada: "asc" as const }, include: { invoice: true, budget: true } },
  agendaEvents: { orderBy: { fechaInicio: "asc" as const }, include: { invoice: true, budget: true } },
  documents: { orderBy: { fecha: "desc" as const } }, photos: { orderBy: { tomadaEn: "desc" as const } }
} satisfies Prisma.WorkInclude;
type WorkDetail = Prisma.WorkGetPayload<{ include: typeof workDetailInclude }>;
const workTaskInclude = {
  assignments: true,
  checklist: true,
  dependencies: { include: { dependsOnTask: true } },
} satisfies Prisma.TaskInclude;
type WorkTask = Prisma.TaskGetPayload<{ include: typeof workTaskInclude }>;

export type WorkDetailQuery = { vista?: string; tab?: string; modo?: string; subvista?: string; detalle?: string; returnTo?: string };

export default async function WorkDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkDetailQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = normalizeWorkReturnTo(query.returnTo);
  const requestedView = query.vista ? legacyTabs[query.vista] ?? query.vista : query.tab ? legacyTabs[query.tab] ?? query.tab : "resumen";
  const activeTab = tabs.some(([tab]) => tab === requestedView) ? requestedView as (typeof tabs)[number][0] : "resumen";
  const availableSubviews = workSubviews[activeTab];
  const activeSubview = availableSubviews.some(([viewId]) => viewId === query.subvista) ? query.subvista! : availableSubviews[0][0];
  const auth = await requireCapability("work.view");
  const scopedWorkIds = await resolveScopedEntityIds(auth, "work.view", "Work");
  if (scopedWorkIds !== null && !scopedWorkIds.includes(id)) notFound();
  const projectBudgetAccess = await resolveAuthorization(auth, "project_budget_control.view");
  const projectBudgetIds = projectBudgetAccess.allowed ? await resolveScopedEntityIds(auth, "project_budget_control.view", "Work") : [];
  const projectBudgetAllowedHere = projectBudgetAccess.allowed && (projectBudgetIds === null || projectBudgetIds.includes(id));
  const canUpdateWork = await resolveAuthorization(auth, "work.update");
  const economicCapabilities = ["sales.budgets.view", "sales.invoices.view", "treasury.view", "purchase_cost.view", "internal_cost.view", "margin_percent.view", "margin_amount.view", "profitability.view"] as const;
  const economicAccess = await Promise.all(economicCapabilities.map((capability) => resolveAuthorization(auth, capability)));
  const economicScopes = await Promise.all(economicCapabilities.map((capability, index) => economicAccess[index].allowed ? resolveScopedEntityIds(auth, capability, "Work") : Promise.resolve([])));
  const fullEconomicAccessHere = economicAccess.every((decision) => decision.allowed) && economicScopes.every((ids) => ids === null || ids.includes(id));
  const moduleCapabilities = ["documents.view", "documents.manage", "agenda.view", "agenda.manage", "followups.view", "followups.manage", "purchases.received_invoices.view", "purchases.received_invoices.manage", "sales.budgets.create", "sales.budgets.update", "sales.invoices.create", "treasury.collections.register", "orqena.use", "orqena.execute"] as const;
  const moduleAccess = await Promise.all(moduleCapabilities.map((capability) => resolveAuthorization(auth, capability)));
  const moduleScopes = await Promise.all(moduleCapabilities.map((capability, index) => moduleAccess[index].allowed ? resolveScopedEntityIds(auth, capability, "Work") : Promise.resolve([])));
  const membersAccess = await resolveAuthorization(auth, "company.members.view");
  const fullModuleAccessHere = membersAccess.allowed && moduleAccess.every((decision) => decision.allowed) && moduleScopes.every((ids) => ids === null || ids.includes(id));
  if (!canUpdateWork.allowed || !fullEconomicAccessHere || !fullModuleAccessHere) {
    const work = await prisma.work.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true, titulo: true, tipoTrabajo: true, direccion: true, estado: true, codigo: true, numeroInterno: true, presupuestoAprobado: projectBudgetAllowedHere, costePrevisto: projectBudgetAllowedHere, gastoReal: projectBudgetAllowedHere, expenses: projectBudgetAllowedHere ? { select: { importe: true } } : false, client: { select: { nombre: true } } } });
    if (!work) notFound();
    if (projectBudgetAllowedHere) {
      const consumed = work.gastoReal + work.expenses.reduce((sum, item) => sum + item.importe, 0);
      return <ProjectBudgetWorkDetail work={work} consumed={consumed} returnTo={returnTo} activeTab={activeTab} activeSubview={activeSubview} />;
    }
    return <RestrictedWorkDetail work={work} returnTo={returnTo} activeTab={activeTab} activeSubview={activeSubview} />;
  }
  const [taskAccess, taskManageAccess] = await Promise.all([resolveAuthorization(auth, "tasks.view"), resolveAuthorization(auth, "tasks.manage")]);
  const scopedTaskIds = taskAccess.allowed ? await resolveScopedTaskIds(auth, "tasks.view") : [];
  const scopedManageTaskIds = taskManageAccess.allowed ? await resolveScopedTaskIds(auth, "tasks.manage") : [];
  const canManageAllTasks = taskManageAccess.allowed && scopedManageTaskIds === null;
  const [work, treasury, workTasks, activeMembers] = await Promise.all([
    prisma.work.findFirst({
      where: { id, companyId: auth.companyId },
      include: workDetailInclude
    }),
    getEconomicControl({ workId: id, period: "30d" }),
    taskAccess.allowed ? prisma.task.findMany({
      where: { companyId: auth.companyId, workId: id, archivedAt: null, ...(scopedTaskIds === null ? {} : { id: { in: scopedTaskIds } }) },
      include: workTaskInclude,
      orderBy: [{ startsAt: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    }) : Promise.resolve([] as WorkTask[]),
    prisma.companyMembership.findMany({
      where: { companyId: auth.companyId, status: "active" },
      select: { userId: true, user: { select: { displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!work) notFound();

  const financial = calculateWorkFinancials(work);
  const risks = buildWorkRisks(work);
  const timeline = buildWorkTimeline(work);
  const documents = buildWorkDocuments(work);
  const nextAction = getWorkNextAction(work);
  const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
  const openInvoices = work.invoices.filter((invoice) => Math.max(0, invoice.total - invoicePaid(invoice)) > 0);
  const memberNames = Object.fromEntries(activeMembers.map((membership) => [membership.userId, membership.user.displayName]));

  return (
    <RecordWorkspace>
      <InternalBreadcrumbs items={workBreadcrumbItems(work.id, work.titulo, activeTab, activeSubview)} />
      <WorkOverviewHeader work={work} />

      <Tabs label="Secciones de la obra" className="mb-4 mt-2">
        {tabs.map(([id, label, Icon]) => (
          <Link key={id} href={workViewHref(work.id, id, undefined, returnTo)} aria-current={activeTab === id ? "page" : undefined}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </Tabs>

      {activeTab !== "resumen" ? <WorkSubnavigation workId={work.id} activeTab={activeTab} activeSubview={activeSubview} items={availableSubviews} returnTo={returnTo} /> : null}

      <div id="work-360-content">
      {activeTab === "resumen" && query.modo !== "configuracion" ? (
        <WorkOverviewDashboard work={work} tasks={workTasks} financial={financial} timeline={timeline} risks={risks} nextAction={nextAction} />
      ) : null}

      {activeTab === "resumen" && query.modo === "configuracion" ? <div className="grid gap-4"><ClientTab work={work} /><EntityWorkflowSummary clientId={work.clienteId} workId={work.id} /><AiTab work={work} financial={financial} risks={risks} openInvoices={openInvoices.length} pendingMaterials={pendingMaterials.length} documents={documents.length} /><ConfigTab work={work} /></div> : null}
      {activeTab === "partes" ? <PartsWorkspace work={work} timeline={timeline} subview={activeSubview} mode={query.modo === "galeria" ? "galeria" : "cronologia"} /> : null}
      {activeTab === "costes" ? <CostsWorkspace work={work} financial={financial} pendingMaterials={pendingMaterials.length} subview={activeSubview} /> : null}
      {activeTab === "facturacion" ? <BillingWorkspace work={work} treasury={treasury} financial={financial} subview={activeSubview} /> : null}
      {activeTab === "planificacion" ? <PlanningWorkspace work={work} tasks={workTasks} canManageTasks={canManageAllTasks} memberNames={memberNames} subview={activeSubview} /> : null}
      {activeTab === "documentos" ? <DocumentsWorkspace work={work} documents={documents} subview={activeSubview} /> : null}
      {activeTab === "equipo" ? <TeamWorkspace work={work} tasks={workTasks} memberNames={memberNames} subview={activeSubview} /> : null}
      {activeTab === "incidencias" ? <IncidentsTab work={work} risks={risks} /> : null}
      </div>
    </RecordWorkspace>
  );
}

function ProjectBudgetWorkDetail({ work, consumed, returnTo, activeTab, activeSubview }: { work: { id: string; titulo: string; tipoTrabajo: string; direccion: string; estado: string; codigo: string | null; numeroInterno: string | null; presupuestoAprobado: number; costePrevisto: number; client: { nombre: string } }; consumed: number; returnTo: string; activeTab: (typeof tabs)[number][0]; activeSubview: string }) {
  const available = work.presupuestoAprobado - consumed;
  const deviation = consumed - work.costePrevisto;
  return <RecordWorkspace>
    <InternalBreadcrumbs items={workBreadcrumbItems(work.id, work.titulo, activeTab, activeSubview)} />
    <EntityHeader back={<ParentNavigation href={returnTo} label="Trabajos" context={work.client.nombre} />} context={work.codigo ?? work.numeroInterno ?? "Control de proyecto"} title={work.titulo} description={`${work.client.nombre} · ${work.tipoTrabajo} · ${work.direccion}`} status={<StatusBadge status={work.estado} />} />
    <RestrictedWorkNavigation workId={work.id} activeTab={activeTab} activeSubview={activeSubview} returnTo={returnTo} />
    {activeTab === "resumen" ? <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Control presupuestario autorizado"><Kpi icon={Euro} label="Presupuesto operativo" value={formatCurrency(work.presupuestoAprobado)} detail="Límite aprobado"/><Kpi icon={ClipboardList} label="Comprometido" value={formatCurrency(work.costePrevisto)} detail="Coste previsto"/><Kpi icon={WalletCards} label="Consumido" value={formatCurrency(consumed)} detail="Coste registrado"/><Kpi icon={BadgeEuro} label="Disponible" value={formatCurrency(available)} detail="Sin previsiones inventadas" tone={available < 0 ? "danger" : "success"}/><Kpi icon={AlertTriangle} label="Desviación" value={formatCurrency(deviation)} detail="Consumido menos comprometido" tone={deviation > 0 ? "warning" : "success"}/></section> : <Notice className="mt-4" tone="info" title="Módulo no incluido en tu acceso" description="La arquitectura de la obra se mantiene visible, pero esta sección requiere capacidades adicionales del plan o del rol. No se han cargado datos no autorizados." />}
  </RecordWorkspace>;
}

function RestrictedWorkDetail({ work, returnTo, activeTab, activeSubview }: { work: { id: string; titulo: string; tipoTrabajo: string; direccion: string; estado: string; codigo: string | null; numeroInterno: string | null; client: { nombre: string } }; returnTo: string; activeTab: (typeof tabs)[number][0]; activeSubview: string }) {
  return <RecordWorkspace>
    <InternalBreadcrumbs items={workBreadcrumbItems(work.id, work.titulo, activeTab, activeSubview)} />
    <EntityHeader back={<ParentNavigation href={returnTo} label="Trabajos" context={work.client.nombre} />} context={work.codigo ?? work.numeroInterno ?? "Trabajo"} title={work.titulo} description={`${work.client.nombre} · ${work.tipoTrabajo} · ${work.direccion}`} status={<StatusBadge status={work.estado} />} />
    <RestrictedWorkNavigation workId={work.id} activeTab={activeTab} activeSubview={activeSubview} returnTo={returnTo} />
    <Notice className="mt-4" tone="info" title="Módulo no incluido en tu acceso" description="La arquitectura de la obra se mantiene visible, pero esta sección requiere capacidades adicionales del plan o del rol. No se han cargado datos no autorizados." />
  </RecordWorkspace>;
}

function workBreadcrumbItems(workId: string, title: string, activeTab: (typeof tabs)[number][0], activeSubview: string) {
  const tabLabel = tabs.find(([id]) => id === activeTab)?.[1] ?? "Resumen";
  const subviewLabel = workSubviews[activeTab].find(([id]) => id === activeSubview)?.[1];
  const items = [
    { label: "Trabajos", href: "/obras" },
    { label: title, href: activeTab === "resumen" ? undefined : `/obras/${workId}` },
  ];
  if (activeTab !== "resumen") {
    items.push({ label: tabLabel, href: subviewLabel && subviewLabel !== tabLabel ? workViewHref(workId, activeTab) : undefined });
  }
  if (activeTab !== "resumen" && subviewLabel && subviewLabel !== tabLabel) {
    items.push({ label: subviewLabel, href: undefined });
  }
  return items;
}

function RestrictedWorkNavigation({ workId, activeTab, activeSubview, returnTo }: { workId: string; activeTab: (typeof tabs)[number][0]; activeSubview: string; returnTo: string }) {
  return <>
    <Tabs label="Secciones de la obra" className="mb-4 mt-2">
      {tabs.map(([id, label, Icon]) => <Link key={id} href={workViewHref(workId, id, undefined, returnTo)} aria-current={activeTab === id ? "page" : undefined}><Icon size={16} />{label}</Link>)}
    </Tabs>
    {activeTab !== "resumen" ? <WorkSubnavigation workId={workId} activeTab={activeTab} activeSubview={activeSubview} items={workSubviews[activeTab]} returnTo={returnTo} /> : null}
  </>;
}

function WorkActions({ workId, clientId }: { workId: string; clientId: string }) {
  const returnTo = encodeURIComponent(`/obras/${workId}`);
  const actions = [
    [`/gestion?tipo=obra&id=${workId}&returnTo=${returnTo}`, "Editar obra", Settings],
    [`/obras/${workId}?vista=resumen&modo=configuracion`, "Datos y configuración", Settings],
    [`/clientes/${clientId}`, "Abrir cliente", UserRound],
    [`/gestion?tipo=presupuesto&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear presupuesto", FileText],
    [`/gestion?tipo=factura&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear factura", Receipt],
    [`/gestion?tipo=gasto&obraId=${workId}&returnTo=${returnTo}`, "Registrar gasto", Banknote],
    [`/gestion?tipo=pago&returnTo=${returnTo}`, "Registrar pago", WalletCards],
    [`/gestion?tipo=eventoAgenda&clienteId=${clientId}&obraId=${workId}&tipoEvento=visita&returnTo=${returnTo}`, "Añadir visita", CalendarClock],
    [`/gestion?tipo=material&obraId=${workId}&returnTo=${returnTo}`, "Añadir material", Package],
    [`/gestion?tipo=foto&obraId=${workId}&returnTo=${returnTo}`, "Registrar avance", Camera],
    [`/gestion?tipo=documento&clientId=${clientId}&workId=${workId}&category=otro&returnTo=${returnTo}`, "Añadir documento", FileArchive],
    [`/gestion?tipo=notaInterna&clientId=${clientId}&workId=${workId}&returnTo=${returnTo}`, "Añadir nota", ClipboardList],
    [`/gestion?tipo=recordatorio&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear recordatorio", Bell],
    [`/capataz?obraId=${workId}`, "Abrir chat IA", Bot]
  ] as const;
  return (
    <details className="relative">
      <summary className="secondary-button cursor-pointer list-none">Más acciones</summary>
      <div className="absolute right-0 z-20 mt-2 grid max-h-[70vh] min-w-64 gap-1 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-xl">
        {actions.map(([href, label, Icon]) => (
          <Link key={href} href={href} className="secondary-button justify-start">
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <div className="mt-1 grid gap-1 border-t border-border pt-2" aria-label="Cambiar estado del trabajo">
          <WorkStatusButton id={workId} estado="en_curso" label="Marcar en curso" />
          <WorkStatusButton id={workId} estado="pendiente_material" label="Bloquear por material" />
          <WorkStatusButton id={workId} estado="finalizada" label="Marcar finalizada" />
          <WorkStatusButton id={workId} estado="archivada" label="Archivar" />
        </div>
      </div>
    </details>
  );
}

function WorkOverviewHeader({ work }: { work: WorkDetail }) {
  return (
    <header className="border-b border-border pb-3 pt-1">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.35rem,2vw,1.75rem)] font-black leading-tight tracking-[-0.035em] text-content xl:whitespace-nowrap">Obra · {work.tipoTrabajo} · {work.titulo}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-content-secondary">
            <WorkHeaderMeta icon={UserRound} label="Cliente" value={work.client.nombre} />
            <WorkHeaderMeta icon={ClipboardList} label="Código" value={work.codigo ?? work.numeroInterno ?? "No registrado"} />
            <WorkHeaderMeta icon={MapPin} label="Dirección" value={work.direccion || "No registrada"} />
            <WorkHeaderMeta icon={CalendarClock} label="Inicio" value={formatDate(work.fechaInicioReal ?? work.fechaInicioPrevista ?? work.fechaInicio)} />
            <WorkHeaderMeta icon={CalendarClock} label="Fin estimado" value={formatDate(work.fechaFinPrevista)} />
            <WorkHeaderMeta icon={UserRound} label="Responsable" value={work.jefeObra ?? work.responsable ?? "Sin asignar"} />
            <WorkHeaderMeta icon={Activity} label="Estado actual" value={workStatusMeta(work.estado).label} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/inteligencia/export?tipo=works&workId=${work.id}`} className="secondary-button"><Download size={16} aria-hidden="true" /> Exportar informe</Link>
          <WorkActions workId={work.id} clientId={work.clienteId} />
        </div>
      </div>
    </header>
  );
}

function WorkHeaderMeta({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <span className="inline-flex min-w-0 items-center gap-1.5"><Icon size={13} className="shrink-0 text-content-secondary" aria-hidden="true" /><span><strong className="font-semibold text-content-secondary">{label}:</strong> {value}</span></span>;
}

function WorkOverviewDashboard({ work, tasks, financial, timeline, risks, nextAction }: { work: WorkDetail; tasks: WorkTask[]; financial: ReturnType<typeof calculateWorkFinancials>; timeline: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }>; risks: ReturnType<typeof buildWorkRisks>; nextAction: ReturnType<typeof getWorkNextAction> }) {
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const activeTasks = tasks.filter((task) => !["completed", "cancelled", "archived"].includes(task.status));
  const upcomingTasks = [...activeTasks]
    .sort((left, right) => {
      if (!left.dueAt && !right.dueAt) return 0;
      if (!left.dueAt) return 1;
      if (!right.dueAt) return -1;
      return left.dueAt.getTime() - right.dueAt.getTime();
    })
    .slice(0, 5);
  const pendingApprovals = activeTasks.filter((task) => task.requiresConfirmation).slice(0, 4);
  const safePhoto = work.photos.find((photo): photo is typeof photo & { url: string } => typeof photo.url === "string" && (photo.url.startsWith("/") || photo.url.startsWith("https://")));
  const showSyntheticReference = process.env.RAILWAY_ENVIRONMENT_NAME?.toLowerCase().includes("review") ?? false;
  const costRatio = financial.budgeted > 0 ? Math.max(0, Math.min(100, (financial.realCost / financial.budgeted) * 100)) : null;
  const taskRatio = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : null;
  return (
    <div className="grid gap-3">
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Estado y control económico de la obra">
        <WorkOverviewMetricCard label="Estado de la obra" value={taskRatio == null ? workStatusMeta(work.estado).label : `${taskRatio}%`} detail={taskRatio == null ? "Sin porcentaje físico inventado" : `${completedTasks.length} de ${tasks.length} tareas · ${workStatusMeta(work.estado).label}`} tone="info" progress={taskRatio} />
        <WorkOverviewMetricCard label="Presupuesto total" value={formatCurrency(financial.budgeted)} detail={`${work.budgets.length} presupuestos vinculados`} />
        <WorkOverviewMetricCard label="Coste acumulado" value={formatCurrency(financial.realCost)} detail={costRatio == null ? "Sin base presupuestaria" : `${costRatio.toFixed(1)}% del presupuesto`} />
        <WorkOverviewMetricCard label="Margen autorizado" value={`${financial.marginPercent.toFixed(1)}%`} detail={formatCurrency(financial.benefit)} tone={financial.marginPercent < 15 ? "warning" : "success"} />
        <WorkOverviewMetricCard label="Cobrado / Pendiente" value={formatCurrency(financial.paid)} detail={`Pendiente ${formatCurrency(financial.pending)}`} tone={financial.pending > 0 ? "warning" : "success"} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_.9fr_.95fr]">
        <OverviewPanel title="Progreso operativo" action={<Link href={workViewHref(work.id, "planificacion", "gantt")} className="text-[10px] font-bold text-brand-strong hover:underline">Ver planificación completa</Link>}>
          {tasks.length ? <div role="table" aria-label="Progreso operativo por fase" className="text-[10px]"><div role="row" className="grid grid-cols-[minmax(0,1fr)_5.5rem_3.7rem] gap-2 border-b border-border pb-2 text-[8px] font-semibold uppercase tracking-wide text-content-tertiary"><span role="columnheader">Fase</span><span role="columnheader">Avance</span><span role="columnheader" className="text-right">Fin</span></div><div role="rowgroup" className="divide-y divide-border">{tasks.slice(0, 6).map((task, index) => <WorkOverviewTaskRow key={task.id} task={task} index={index} />)}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[8px] font-semibold text-content-secondary"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-success" aria-hidden="true" />Completada</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-info" aria-hidden="true" />En curso</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-border" aria-hidden="true" />Pendiente</span></div></div> : <OperationalSetupPanel title="Planificación preparada" description="Añade tareas con fechas, responsables y checklist para activar el seguimiento operativo." count={0} countLabel="tareas vinculadas" icon={ListChecks} items={["La obra conserva su estado real.", "El avance se calcula sólo desde checklist confirmado.", "Las dependencias no se presuponen."]} action={<Link href={`/tareas?nuevo=1&workId=${work.id}&clientId=${work.clienteId}`} className="primary-button">Nueva tarea</Link>} compact />}
        </OverviewPanel>
        <OverviewPanel title="Próximos hitos y tareas" action={<Link href={workViewHref(work.id, "planificacion", "hitos")} className="text-[10px] font-bold text-brand-strong hover:underline">Ver hitos</Link>}>
          {upcomingTasks.length ? <div className="divide-y divide-border">{upcomingTasks.map((task) => <Link key={task.id} href={`/tareas/${task.id}`} className="grid grid-cols-[5.3rem_minmax(0,1fr)] gap-2 py-2 text-[10px] hover:bg-subtle"><span className="font-semibold text-content">{task.dueAt ? formatDate(task.dueAt) : "Sin fecha"}</span><span className="min-w-0"><strong className="block truncate text-content">{task.title}</strong><span className="mt-0.5 block truncate text-content-secondary">{statusLabel(task.status)}{task.assignments.length ? ` · ${task.assignments.length} responsables` : " · Sin responsable asignado"}</span></span></Link>)}</div> : <OperationalSetupPanel title="Agenda técnica preparada" description="Las tareas activas aparecerán aquí conservando sus fechas reales." count={0} countLabel="tareas activas" icon={CalendarClock} items={["No se inventan hitos contractuales.", "Cada fecha conserva su tarea de origen.", "Los cambios requieren confirmación."]} compact />}
        </OverviewPanel>
        <OverviewPanel title="Foto destacada de la obra" action={<Link href={workViewHref(work.id, "documentos", "galeria")} className="text-[10px] font-bold text-brand-strong hover:underline">Ver galería completa</Link>}>
          {safePhoto || showSyntheticReference ? <div><Image src={safePhoto?.url ?? "/media/orqena-review/work-summary-featured-synthetic-v1.webp"} alt={safePhoto?.titulo || `Referencia visual sintética para ${work.titulo}`} width={960} height={600} unoptimized className="aspect-[16/10] w-full rounded-lg border border-border object-cover" /><p className="mt-2 text-[9px] text-content-secondary">{safePhoto ? `${safePhoto.titulo} · ${formatDate(safePhoto.tomadaEn)}` : "Datos sintéticos Review · referencia visual, no evidencia de la obra"}</p></div> : <OperationalSetupPanel title="Evidencia visual preparada" description="Registra una fotografía segura para mostrar la portada real de esta obra." count={work.photos.length} countLabel="registros fotográficos" icon={Camera} items={["Sólo se renderizan URLs seguras.", "La fecha y autor se conservan.", "La galería permanece aislada por empresa."]} action={<Link href={`/gestion?tipo=foto&obraId=${work.id}`} className="primary-button">Registrar foto</Link>} compact />}
        </OverviewPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.05fr_.95fr_.95fr]">
        <OverviewPanel title="Rentabilidad y evolución" action={<Link href={workViewHref(work.id, "costes", "analisis")} className="text-[10px] font-bold text-brand-strong hover:underline">Ver análisis detallado</Link>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><OverviewMiniMetric label="Coste acumulado" value={formatCurrency(financial.realCost)} /><OverviewMiniMetric label="Presupuesto" value={formatCurrency(financial.budgeted)} /><OverviewMiniMetric label="Previsto" value={formatCurrency(financial.forecastCost)} /><OverviewMiniMetric label="Margen" value={`${financial.marginPercent.toFixed(1)}%`} tone={financial.marginPercent < 15 ? "danger" : "success"} /></div>
          <WorkProfitabilityEvolution expenses={work.expenses} budget={financial.budgeted} total={financial.realCost} />
        </OverviewPanel>
        <OverviewPanel title="Actividad reciente" action={<Link href={workViewHref(work.id, "partes", "actividades")} className="text-[10px] font-bold text-brand-strong hover:underline">Ver toda la actividad</Link>}>
          {timeline.length ? <div className="divide-y divide-border">{timeline.slice(0, 5).map((item) => <article key={item.key} className="grid grid-cols-[1.65rem_minmax(0,1fr)] gap-2 py-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand-strong"><Activity size={12} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-[10px] text-content">{item.title}</strong><span className="mt-0.5 block truncate text-[9px] text-content-secondary">{item.detail}</span><span className="mt-0.5 block text-[8px] text-content-tertiary">{formatDate(item.date)}</span></span></article>)}</div> : <OperationalSetupPanel title="Actividad preparada" description="Presupuestos, costes, documentos, fotos y tareas aparecerán cronológicamente." count={0} countLabel="eventos trazables" icon={Activity} items={["Cada evento conserva fuente y fecha.", "No se simula actividad inexistente.", "La lectura permanece disponible."]} compact />}
        </OverviewPanel>
        <OverviewPanel title="Aprobaciones pendientes" action={<Link href="/tareas?filtro=confirmacion" className="text-[10px] font-bold text-brand-strong hover:underline">Ver todas</Link>}>
          {pendingApprovals.length ? <div className="divide-y divide-border">{pendingApprovals.map((task) => <Link key={task.id} href={`/tareas/${task.id}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-2 py-2 text-[10px] hover:bg-subtle"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10 text-warning"><ClipboardList size={13} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{task.title}</strong><span className="mt-0.5 block truncate text-content-secondary">{formatDate(task.dueAt)} · {statusLabel(task.status)}</span></span><span className="rounded-full bg-warning/10 px-2 py-1 text-[8px] font-bold text-warning">Por aprobar</span></Link>)}</div> : <div className="rounded-lg border border-success/25 bg-success/5 p-3"><div className="flex items-center gap-2 text-success"><ShieldCheck size={16} aria-hidden="true" /><strong className="text-[11px]">Sin confirmaciones pendientes</strong></div><p className="mt-2 text-[10px] leading-5 text-content-secondary">{risks.length ? `${risks.length} señales operativas siguen bajo revisión.` : "Los controles actuales no requieren una aprobación adicional."}</p></div>}
          <div className="mt-3 rounded-lg border border-border p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-content-tertiary">Próxima acción</p><p className="mt-1 text-[10px] font-bold text-content">{nextAction.label}</p></div>
        </OverviewPanel>
      </section>
    </div>
  );
}

function WorkOverviewMetricCard({ label, value, detail, tone = "neutral", progress }: { label: string; value: string; detail: string; tone?: "neutral" | "info" | "warning" | "success"; progress?: number | null }) {
  const valueTone = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-content";
  return <article className="min-w-0 rounded-lg border border-border bg-surface p-3"><div className="flex min-w-0 items-start justify-between gap-2"><h2 className="truncate text-[10px] font-bold text-content">{label}</h2>{tone === "info" ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[8px] font-bold text-brand-strong">Registrado</span> : null}</div><p className={`mt-2 truncate text-lg font-black tabular-nums tracking-[-0.03em] ${valueTone}`}>{value}</p>{progress != null ? <progress className="mt-2 h-1.5 w-full accent-brand" max={100} value={progress}>{progress}%</progress> : null}<p className="mt-1 text-[9px] leading-4 text-content-secondary">{detail}</p></article>;
}

function OverviewPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="min-w-0 rounded-lg border border-border bg-surface p-3"><header className="mb-3 flex min-h-6 items-start justify-between gap-3 max-sm:flex-wrap"><h2 className="text-[11px] font-bold text-content">{title}</h2>{action ? <div className="max-sm:flex max-sm:min-h-11 max-sm:w-full max-sm:items-center">{action}</div> : null}</header>{children}</section>;
}

function OverviewMiniMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-content";
  return <div className="min-w-0"><span className="block truncate text-[8px] font-semibold uppercase tracking-wide text-content-tertiary">{label}</span><strong className={`mt-1 block truncate text-[11px] tabular-nums ${toneClass}`}>{value}</strong></div>;
}

function WorkProfitabilityEvolution({ expenses, budget, total }: { expenses: WorkDetail["expenses"]; budget: number; total: number }) {
  const byDay = new Map<string, { date: Date; amount: number }>();
  for (const expense of [...expenses].sort((left, right) => left.fecha.getTime() - right.fecha.getTime())) {
    const key = expense.fecha.toISOString().slice(0, 10);
    const current = byDay.get(key);
    byDay.set(key, { date: expense.fecha, amount: (current?.amount ?? 0) + expense.importe });
  }
  let accumulated = Math.max(0, total - expenses.reduce((sum, expense) => sum + expense.importe, 0));
  const points = [...byDay.values()].map((entry) => {
    accumulated += entry.amount;
    return { ...entry, accumulated };
  }).slice(-6);
  if (!points.length) return <div className="mt-4 rounded-lg border border-border bg-subtle p-3"><p className="text-[10px] font-semibold text-content">Evolución todavía no disponible</p><p className="mt-1 text-[9px] leading-4 text-content-secondary">No hay gastos fechados con los que construir una serie temporal real.</p></div>;

  const width = 420;
  const height = 128;
  const padding = { left: 34, right: 8, top: 9, bottom: 24 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(budget, ...points.map((point) => point.accumulated), 1);
  const x = (index: number) => padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + plotHeight - (value / maximum) * plotHeight;
  const barWidth = Math.min(30, plotWidth / Math.max(points.length * 2, 1));
  const labels = [0, 0.5, 1];
  return <figure className="mt-3 min-w-0" aria-labelledby="work-cost-evolution-caption"><div className="flex flex-wrap items-center gap-3 text-[8px] font-semibold text-content-secondary"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-success" aria-hidden="true" />Coste acumulado real</span>{budget > 0 ? <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-content-tertiary" aria-hidden="true" />Presupuesto autorizado</span> : null}</div><svg viewBox={`0 0 ${width} ${height}`} className="mt-1 w-full" role="img" aria-label="Evolución acumulada de costes reales de la obra"><title>Evolución de costes reales</title><desc>Serie calculada sólo con gastos registrados y fechados para esta obra.</desc>{labels.map((ratio) => <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y(maximum * ratio)} y2={y(maximum * ratio)} stroke="currentColor" className="text-border" strokeWidth="1" /><text x={padding.left - 5} y={y(maximum * ratio) + 3} textAnchor="end" className="fill-content-tertiary text-[8px]">{compactCurrency(maximum * ratio)}</text></g>)}{budget > 0 ? <line x1={padding.left} x2={width - padding.right} y1={y(budget)} y2={y(budget)} stroke="currentColor" className="text-content-tertiary" strokeDasharray="4 4" strokeWidth="1.5" /> : null}{points.map((point, index) => <g key={point.date.toISOString()}><rect x={x(index) - barWidth / 2} y={y(point.accumulated)} width={barWidth} height={Math.max(2, padding.top + plotHeight - y(point.accumulated))} rx="3" fill="currentColor" className="text-success"><title>{`${formatDate(point.date)} · ${formatCurrency(point.accumulated)}`}</title></rect><text x={x(index)} y={height - 8} textAnchor="middle" className="fill-content-tertiary text-[8px]">{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(point.date)}</text></g>)}</svg><figcaption id="work-cost-evolution-caption" className="text-[8px] leading-4 text-content-secondary">{expenses.length} gastos reales · sin interpolaciones ni previsiones inventadas</figcaption><table className="sr-only"><caption>Datos de evolución de costes</caption><thead><tr><th>Fecha</th><th>Coste acumulado</th></tr></thead><tbody>{points.map((point) => <tr key={point.date.toISOString()}><td>{formatDate(point.date)}</td><td>{formatCurrency(point.accumulated)}</td></tr>)}</tbody></table></figure>;
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 }).format(value);
}

function WorkOverviewTaskRow({ task, index }: { task: WorkTask; index: number }) {
  const checklistTotal = task.checklist.length;
  const checklistDone = task.checklist.filter((item) => item.completed).length;
  const progress = checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : task.status === "completed" ? 100 : null;
  return <div role="row" className="grid grid-cols-[minmax(0,1fr)_5.5rem_3.7rem] items-center gap-2 py-2"><span role="cell" className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5"><span className="text-[8px] font-bold tabular-nums text-content-tertiary">{index + 1}</span><Link href={`/tareas/${task.id}`} className="block truncate font-semibold text-content hover:underline" title={`${task.title} · ${statusLabel(task.status)}`}>{task.title}</Link></span><span role="cell" className="flex min-w-0 items-center gap-1.5">{progress == null ? <span className="truncate text-[9px] text-content-secondary">Sin checklist</span> : <><progress className="h-1.5 min-w-0 flex-1 accent-brand" max={100} value={progress}>{progress}%</progress><strong className="w-7 text-right text-[9px] tabular-nums text-content">{progress}%</strong></>}</span><span role="cell" className="text-right text-[9px] tabular-nums text-content-secondary">{task.dueAt ? formatDate(task.dueAt) : "—"}</span></div>;
}

function WorkSubnavigation({ workId, activeTab, activeSubview, items, returnTo }: { workId: string; activeTab: string; activeSubview: string; items: readonly [string, string][]; returnTo: string }) {
  return (
    <nav className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" aria-label={`Vistas de ${activeTab}`}>
      {items.map(([id, label]) => <Link key={id} href={workViewHref(workId, activeTab, id, returnTo)} aria-current={activeSubview === id ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold ${activeSubview === id ? "bg-brand-soft text-brand-strong" : "text-content-secondary hover:bg-subtle hover:text-content"}`}>{label}</Link>)}
    </nav>
  );
}

function workViewHref(workId: string, tab: string, subview?: string, returnTo?: string) {
  let href: string;
  if (tab === "resumen") href = `/obras/${workId}`;
  else {
    const base = `/obras/${workId}/${tab}`;
    if (!subview) href = base;
    else {
      const canonical: Record<string, readonly string[]> = {
        planificacion: ["resumen", "gantt", "calendario", "hitos", "dependencias", "ruta-critica", "carga-trabajo", "recursos"],
        partes: ["resumen", "actividades", "nuevo", "analisis"],
        costes: ["resumen", "estructura", "analisis", "incidencias", "ranking"],
        documentos: ["documentos", "subir", "galeria"],
        equipo: ["equipo"],
        facturacion: ["resumen"],
        incidencias: ["todas"],
      };
      if (canonical[tab]?.includes(subview)) href = ["resumen", "documentos", "equipo", "todas"].includes(subview) ? base : `${base}/${subview}`;
      else if (tab === "costes" && subview === "ordenes") href = `/obras/${workId}/ordenes`;
      else href = `/obras/${workId}?vista=${tab}&subvista=${subview}`;
    }
  }
  if (!returnTo) return href;
  return `${href}${href.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
}

function normalizeWorkReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/obras") || value.startsWith("//")) return "/obras";
  return value;
}

function ClientTab({ work }: { work: WorkDetail }) {
  return (
    <Section title="Cliente">
      <InfoGrid rows={[
        ["Nombre", work.client.nombre],
        ["Razón social", work.client.razonSocial ?? "No registrada"],
        ["NIF/CIF", work.client.nifCif ?? "No registrado"],
        ["Teléfono", work.client.telefono ?? "No registrado"],
        ["Email", work.client.email ?? "No registrado"],
        ["Dirección fiscal", work.client.direccionFiscal ?? work.client.direccion ?? "No registrada"],
        ["Estado CRM", work.client.estado]
      ]} />
      <Link href={`/clientes/${work.clienteId}`} className="primary-button mt-4 inline-flex">Abrir ficha cliente</Link>
    </Section>
  );
}

function MaterialsTab({ materials, pendingCount, workId }: { materials: WorkDetail["materials"]; pendingCount: number; workId: string }) {
  return (
    <Section title={`Materiales · ${pendingCount} pendientes`}>
      {materials.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {materials.map((material) => (
            <article key={material.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <StatusBadge status={material.estado} />
              <h3 className="mt-3 font-black text-obra-ink">{material.nombre}</h3>
              <p className="mt-1 text-sm text-slate-600">{material.cantidad}</p>
              {material.notas ? <p className="mt-2 text-sm leading-6 text-slate-600">{material.notas}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <OperationalSetupPanel title="Control de materiales preparado" description="Registra cada material con cantidad, estado y notas para mantener la trazabilidad de la obra." count={0} countLabel="materiales vinculados" icon={Package} items={["Pendientes y faltas se calculan desde el estado registrado.", "Cada alta queda vinculada a esta obra.", "La lectura permanece disponible aunque no existan movimientos."]} action={<Link href={`/gestion?tipo=material&obraId=${workId}&returnTo=/obras/${workId}`} className="secondary-button">Añadir material</Link>} />
      )}
    </Section>
  );
}

function WorkTreasuryTab({ treasury, workId }: { treasury: Awaited<ReturnType<typeof getEconomicControl>>; workId: string }) {
  const work = treasury.profitability.find((item) => item.workId === workId);
  const upcomingCollections = treasury.receivables.slice(0, 5);
  const upcomingPayments = treasury.payables.slice(0, 5);
  if (!work) return <OperationalSetupPanel title="Tesorería de obra preparada" description="Vincula facturas, cobros y gastos para activar la lectura de caja y rentabilidad." count={0} countLabel="movimientos vinculados" icon={Euro} items={["El presupuesto no se presenta como entrada de caja.", "Cobros y pagos conservan su documento de origen.", "La rentabilidad se calcula sólo con importes autorizados."]} action={<Link href={`/tesoreria?vista=resumen&periodo=30d&obra=${workId}`} className="primary-button">Abrir tesorería</Link>} />;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Section title="Caja y rentabilidad">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Finance label="Cobrado" value={work.collected} />
          <Finance label="Pendiente cobro" value={work.pending} tone={work.pending > 0 ? "warning" : "neutral"} />
          <Finance label="Coste real" value={work.realCost} />
          <Finance label="Beneficio" value={work.profit ?? 0} tone={work.profit !== null && work.profit < 0 ? "danger" : "success"} />
          <Finance label="Presupuestado" value={work.budgeted} />
          <Finance label="Desviación" value={work.deviation ?? 0} tone={work.deviation !== null && work.deviation > 0 ? "warning" : "success"} />
          <PlainMetric label="Margen real" value={work.margin === null ? "Datos insuficientes" : `${work.margin.toFixed(1)}%`} tone={work.margin !== null && work.margin < 0 ? "danger" : "neutral"} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">El presupuesto no se considera entrada de caja. La caja de obra usa cobros, pagos y gastos registrados explícitamente.</p>
      </Section>
      <Section title="Próximos cobros y pagos">
        <div className="grid gap-4">
          <MiniTimeline title="Cobros previstos" items={upcomingCollections} empty="Sin cobros previstos para esta obra." />
          <MiniTimeline title="Pagos previstos" items={upcomingPayments} empty="Sin pagos previstos para esta obra." />
        </div>
        <Link href={`/tesoreria?vista=resumen&periodo=30d&obra=${workId}`} className="primary-button mt-4 inline-flex">Abrir control económico</Link>
      </Section>
    </div>
  );
}

function MiniTimeline({ title, items, empty }: { title: string; items: EconomicDocument[]; empty: string }) {
  return (
    <div>
      <h3 className="font-black text-obra-ink">{title}</h3>
      <div className="mt-2 grid gap-2">
        {items.length ? items.map((item) => (
          <Link key={item.id} href={item.href} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <span className="font-black text-obra-ink">{formatCurrency(item.pending)}</span>
            <span className="ml-2 text-slate-600">{item.number} · {item.dueDate ? formatDate(item.dueDate) : "sin vencimiento"}</span>
          </Link>
        )) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{empty}</p>}
      </div>
    </div>
  );
}

function HoursTab({ work }: { work: WorkDetail }) {
  const deviation = Number(work.horasReales ?? 0) - Number(work.horasEstimadas ?? 0);
  return (
    <Section title="Horas">
      <div className="grid gap-3 sm:grid-cols-3">
        <PlainMetric label="Estimadas" value={`${Number(work.horasEstimadas ?? 0)} h`} />
        <PlainMetric label="Reales" value={`${Number(work.horasReales ?? 0)} h`} />
        <PlainMetric label="Desviación" value={`${deviation} h`} tone={deviation > 0 ? "warning" : "neutral"} />
      </div>
    </Section>
  );
}

function PeopleTab({ work }: { work: WorkDetail }) {
  return <Section title="Personal"><InfoGrid rows={[["Responsable", work.responsable ?? "Sin asignar"], ["Comercial", work.comercial ?? "Sin asignar"], ["Jefe de obra", work.jefeObra ?? "Sin asignar"]]} /></Section>;
}

function SubcontractTab({ work, expenses }: { work: WorkDetail; expenses: WorkDetail["expenses"] }) {
  const subcontractExpenses = expenses.filter((expense) => expense.categoria === "subcontrata");
  const total = subcontractExpenses.reduce((sum, expense) => sum + expense.importe, 0) + Number(work.subcontratasCoste ?? 0);
  return (
    <Section title="Subcontratas">
      <PlainMetric label="Coste total subcontratas" value={formatCurrency(total)} />
      <div className="mt-3 flex flex-wrap gap-2"><Link className="secondary-button" href="/subcontratas">Abrir subcontratas</Link><Link className="secondary-button" href={`/facturas-subcontratas?nuevo=1&obra=${work.id}#factura`}>Registrar factura</Link></div>
      <div className="mt-4">
        {subcontractExpenses.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{subcontractExpenses.map((expense) => <ExpenseCard key={expense.id} expense={expense} />)}</div>
        ) : (
          <OperationalSetupPanel title="Control de subcontratas preparado" description="Registra la factura o el coste de cada proveedor para incorporarlo al coste real de la obra." count={0} countLabel="costes imputados" icon={Users} items={["El proveedor permanece vinculado a la obra.", "Importe y vencimiento se toman del documento real.", "La imputación no modifica datos sin confirmación."]} action={<Link className="secondary-button" href={`/facturas-subcontratas?nuevo=1&obra=${work.id}#factura`}>Registrar factura</Link>} compact />
        )}
      </div>
    </Section>
  );
}

function PlanningDependencyWorkspace({ work, tasks, canManageTasks, mode }: { work: WorkDetail; tasks: WorkTask[]; canManageTasks: boolean; mode: "dependencies" | "critical-path" }) {
  const visibleTasks = tasks.slice(0, 8);
  const visibleTaskIds = new Set(tasks.map((task) => task.id));
  const dependencyRows = tasks.flatMap((task) => task.dependencies.filter((dependency) => visibleTaskIds.has(dependency.dependsOnTaskId)).map((dependency) => ({ dependency, task })));
  const completed = tasks.filter((task) => task.status === "completed").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const withDependencies = tasks.filter((task) => task.dependencies.some((dependency) => visibleTaskIds.has(dependency.dependsOnTaskId))).length;
  const focusTask = tasks.find((task) => task.status === "blocked") ?? tasks.find((task) => !["completed", "cancelled", "archived"].includes(task.status)) ?? tasks[0] ?? null;
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores reales de planificación">
        <Kpi icon={ListChecks} label="Tareas totales" value={String(tasks.length)} detail="Vinculadas a la obra" />
        <Kpi icon={GitBranch} label="Con dependencias" value={String(withDependencies)} detail={`${dependencyRows.length} relaciones registradas`} />
        <Kpi icon={TimerReset} label="Camino crítico" value="—" detail="No calculado sin holguras" />
        <Kpi icon={AlertTriangle} label="Bloqueadas" value={String(blocked)} detail="Estado real de tareas" tone={blocked ? "danger" : "success"} />
        <Kpi icon={CheckCircle2} label="Completadas" value={String(completed)} detail="Estado confirmado" tone="success" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="type-label">{mode === "dependencies" ? "Mapa de dependencias" : "Ruta crítica"}</p>
            <h2 className="mt-1 text-lg font-black text-content">Secuencia técnica de la obra</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="secondary-button pointer-events-none"><Filter size={16} aria-hidden="true" /> Filtros</span>
            {canManageTasks ? <Link href={`/tareas?filtro=team&nuevo=1&workId=${work.id}&clientId=${work.clienteId}`} className="primary-button"><GitBranch size={16} aria-hidden="true" /> Nueva tarea</Link> : null}
          </div>
        </div>

        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 border-border p-4 xl:border-r">
            {visibleTasks.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Secuencia de eventos registrados">
                {visibleTasks.slice(0, 6).map((task, index) => {
                  const isBlocked = task.status === "blocked";
                  return (
                    <div key={task.id} className="relative flex min-w-0 items-center gap-2">
                      <article className={`min-w-0 flex-1 rounded-lg border p-3 ${isBlocked ? "border-danger/40 bg-danger/5" : task.status === "completed" ? "border-success/40 bg-success/5" : "border-brand/40 bg-brand-soft/40"}`}>
                        <div className="flex items-center justify-between gap-2"><span className="type-label">T-{String(index + 1).padStart(3, "0")}</span><TaskStatusBadge status={task.status} /></div>
                        <h3 className="mt-2 truncate text-sm font-black text-content">{task.title}</h3>
                        <p className="type-meta mt-1">{formatDate(task.startsAt)}{task.dueAt ? ` — ${formatDate(task.dueAt)}` : ""}</p>
                      </article>
                      {index < Math.min(visibleTasks.length, 6) - 1 ? <ArrowRight size={16} className="hidden shrink-0 text-content-tertiary xl:block" aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <OperationalSetupPanel title="Construye la secuencia de planificación" description="La arquitectura técnica está preparada: registra tareas reales y enlaza sus predecesoras antes de calcular relaciones o ruta crítica." count={work.reminders.length} countLabel="recordatorios vinculados" icon={GitBranch} items={["1. Registra tareas e hitos reales de la obra.", "2. Define inicio, vencimiento y responsable.", "3. Revisa la secuencia antes de confirmar dependencias."]} action={canManageTasks ? <Link href={`/tareas?filtro=team&nuevo=1&workId=${work.id}&clientId=${work.clienteId}`} className="primary-button">Crear primera tarea</Link> : <Link href="/tareas" className="secondary-button">Abrir tareas</Link>} compact />
            )}
          </div>

          <aside className="bg-subtle/60 p-4" aria-label="Inspector de planificación">
            <div className="flex items-center gap-2"><GitBranch size={18} className="text-brand-strong" aria-hidden="true" /><h3 className="font-black text-content">Inspector técnico</h3></div>
            {focusTask ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-border bg-surface p-3"><p className="type-label">Tarea seleccionada</p><p className="mt-1 font-bold text-content">{focusTask.title}</p></div>
                <InfoGrid rows={[["Estado", statusLabel(focusTask.status)], ["Inicio", formatDate(focusTask.startsAt)], ["Vencimiento", formatDate(focusTask.dueAt)], ["Dependencias", String(focusTask.dependencies.filter((dependency) => visibleTaskIds.has(dependency.dependsOnTaskId)).length)]]} />
                <Link href={`/tareas/${focusTask.id}`} className="secondary-button justify-center">Revisar tarea</Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 text-sm text-content-secondary"><p>El inspector mostrará fechas, estado y confirmación del evento seleccionado.</p><div className="rounded-lg border border-brand/30 bg-brand-soft p-3"><strong className="block text-content">Control humano activo</strong><span className="mt-1 block">No se calcula una ruta crítica sin relaciones persistidas y revisadas.</span></div></div>
            )}
          </aside>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black text-content">Dependencias registradas</h3><span className="type-meta">{dependencyRows.length} relaciones</span></div>
          {dependencyRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-xs">
                <thead className="border-y border-border bg-subtle text-content-secondary"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Predecesora</th><th className="px-3 py-2">Sucesora</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Inicio</th><th className="px-3 py-2">Fin</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Acción</th></tr></thead>
                <tbody className="divide-y divide-border">{dependencyRows.map(({ dependency, task }, index) => <tr key={dependency.id}><td className="px-3 py-2 font-bold">D-{String(index + 1).padStart(3, "0")}</td><td className="px-3 py-2">{dependency.dependsOnTask.title}</td><td className="px-3 py-2 font-semibold text-content">{task.title}</td><td className="px-3 py-2">{dependency.type.replaceAll("_", " ")}</td><td className="px-3 py-2">{formatDate(task.startsAt)}</td><td className="px-3 py-2">{formatDate(task.dueAt)}</td><td className="px-3 py-2"><TaskStatusBadge status={task.status} /></td><td className="px-3 py-2"><Link href={`/tareas/${task.id}`} className="font-bold text-brand-strong hover:underline">Ver</Link></td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3"><PlanningSetupStep step="01" title="Tareas" detail={`${tasks.length} vinculadas a esta obra.`} /><PlanningSetupStep step="02" title="Secuencia" detail="Abre una tarea y añade su predecesora." /><PlanningSetupStep step="03" title="Confirmación" detail="Valida cada relación antes de operar." /></div>
          )}
        </div>
      </section>
    </div>
  );
}

// Retained as a non-rendered compatibility implementation while the new network workspace is validated in Review.
void PlanningDependencyWorkspace;

function TaskStatusBadge({ status }: { status: WorkTask["status"] }) {
  const className = status === "completed" ? "bg-success/10 text-success" : status === "blocked" ? "bg-danger/10 text-danger" : status === "in_progress" ? "bg-brand-soft text-brand-strong" : "bg-subtle text-content-secondary";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${className}`}>{statusLabel(status)}</span>;
}

function PlanningSetupStep({ step, title, detail }: { step: string; title: string; detail: string }) {
  return <article className="rounded-lg border border-border bg-subtle p-3"><span className="type-label">{step}</span><strong className="mt-2 block text-sm text-content">{title}</strong><p className="type-meta mt-1">{detail}</p></article>;
}

function OperationalSetupPanel({ title, description, count, countLabel, icon: Icon, items, action, compact = false }: { title: string; description: string; count: number; countLabel: string; icon: LucideIcon; items: string[]; action?: ReactNode; compact?: boolean }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-brand/25 bg-surface ${compact ? "shadow-none" : "shadow-soft"}`}>
      <div className={`grid gap-4 ${compact ? "p-4" : "p-5 lg:grid-cols-[minmax(0,1fr)_15rem]"}`}>
        <div className="min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"><Icon size={19} aria-hidden="true" /></span>
          <p className="type-label mt-3">Módulo operativo preparado</p>
          <h3 className="mt-1 text-lg font-black text-content">{title}</h3>
          <p className="type-secondary mt-2 max-w-2xl">{description}</p>
          <ul className="mt-4 grid gap-2 text-sm text-content-secondary">{items.map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" /><span>{item}</span></li>)}</ul>
          {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
        </div>
        {!compact ? <div className="grid content-start gap-2"><PlainMetric label={countLabel} value={String(count)} /><PlainMetric label="Estado" value="Preparado" tone="success" /><div className="rounded-lg border border-border bg-subtle p-3"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-brand-strong" aria-hidden="true" /><strong className="text-xs text-content">Datos verificados</strong></div><p className="type-meta mt-2">Sólo se muestran registros persistidos y acciones autorizadas.</p></div></div> : null}
      </div>
    </section>
  );
}

function PlanningWorkspace({ work, tasks, canManageTasks, memberNames, subview }: { work: WorkDetail; tasks: WorkTask[]; canManageTasks: boolean; memberNames: Record<string, string>; subview: string }) {
  const visibleTaskIds = new Set(tasks.map((task) => task.id));
  const planningTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    parentTaskId: task.parentTaskId,
    startsAt: task.startsAt?.toISOString() ?? null,
    dueAt: task.dueAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    assigneeName: task.assigneeId ? memberNames[task.assigneeId] ?? "Responsable asignado" : null,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes,
    progress: task.checklist.length ? Math.round((task.checklist.filter((item) => item.completed).length / task.checklist.length) * 100) : task.status === "completed" ? 100 : null,
    dependencies: task.dependencies.filter((dependency) => visibleTaskIds.has(dependency.dependsOnTaskId)).map((dependency) => ({ taskId: dependency.dependsOnTaskId, type: dependency.type })),
  }));
  const planningWork = {
    id: work.id,
    clientId: work.clienteId,
    startsAt: (work.fechaInicioReal ?? work.fechaInicioPrevista ?? work.fechaInicio)?.toISOString() ?? null,
    dueAt: work.fechaFinPrevista?.toISOString() ?? null,
    responsible: work.jefeObra ?? work.responsable ?? null,
    nowIso: new Date().toISOString(),
    materials: work.materials.map((material) => ({ id: material.id, name: material.nombre, status: material.estado, quantity: material.cantidad })),
    events: work.agendaEvents.map((event) => ({ id: event.id, title: event.titulo, startsAt: event.fechaInicio.toISOString(), endsAt: event.fechaFin?.toISOString() ?? null })),
  };
  const resourcePeople = Array.from(new Set([
    ...planningTasks.map((task) => task.assigneeName).filter((name): name is string => Boolean(name)),
    work.jefeObra,
    work.responsable,
    work.comercial,
  ].filter((name): name is string => Boolean(name)))).map((name) => {
    const assigned = planningTasks.filter((task) => task.assigneeName === name);
    const role = name === work.jefeObra ? "Jefe de obra" : name === work.responsable ? "Responsable" : name === work.comercial ? "Comercial" : "Miembro asignado";
    return { id: name, name, role, taskCount: assigned.length, plannedMinutes: assigned.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0), actualMinutes: assigned.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0) };
  });
  const networkTasks = planningTasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    startsAt: task.startsAt,
    dueAt: task.dueAt,
    durationDays: task.estimatedMinutes ? Math.max(1, Math.ceil(task.estimatedMinutes / 480)) : null,
    progress: task.progress,
    assigneeName: task.assigneeName,
  }));
  const networkEdges = planningTasks.flatMap((task) => task.dependencies.map((dependency) => ({
    id: `${dependency.taskId}-${task.id}`,
    predecessorTaskId: dependency.taskId,
    successorTaskId: task.id,
    type: dependency.type,
    lagDays: null,
  })));
  if (subview === "resumen") return <WorkPlanningSummary work={planningWork} tasks={planningTasks} canManage={canManageTasks} />;
  if (subview === "gantt") return <WorkPlanningGantt work={planningWork} tasks={planningTasks} canManage={canManageTasks} />;
  if (subview === "calendario") return <WorkPlanningCalendar workId={work.id} tasks={planningTasks} events={planningWork.events} nowIso={planningWork.nowIso} createEventHref={canManageTasks ? `/gestion?tipo=eventoAgenda&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}/planificacion/calendario`)}` : undefined} />;
  if (subview === "hitos") return <WorkPlanningMilestones work={planningWork} tasks={planningTasks} canManage={canManageTasks} createHref={canManageTasks ? `/tareas?filtro=team&nuevo=1&workId=${work.id}&clientId=${work.clienteId}` : undefined} />;
  if (subview === "carga-trabajo") return <WorkPlanningLoad workId={work.id} tasks={planningTasks} />;
  if (subview === "recursos") return <WorkPlanningResources workId={work.id} people={resourcePeople} materials={planningWork.materials} canManage={canManageTasks} />;
  if (["dependencias", "ruta-critica"].includes(subview)) return <WorkPlanningNetwork mode={subview === "dependencias" ? "dependencies" : "critical-path"} workId={work.id} clientId={work.clienteId} tasks={networkTasks} edges={networkEdges} canManage={canManageTasks} />;
  if (["linea-base", "escenarios"].includes(subview)) return <OperationalSetupPanel title={subview === "linea-base" ? "Línea base de planificación" : "Escenarios de planificación"} description={subview === "linea-base" ? "Compara las fechas actuales con una referencia aprobada cuando exista una línea base persistida." : "Evalúa alternativas sobre tareas reales sin sustituir el calendario aprobado."} count={tasks.length} countLabel="tareas de referencia" icon={subview === "linea-base" ? TimerReset : GitBranch} items={["Las fechas proceden de tareas vinculadas a la obra.", "No se calcula desviación sin referencia persistida.", "Toda propuesta de cambio conserva confirmación humana."]} action={canManageTasks ? <Link href={`/tareas?filtro=team&nuevo=1&workId=${work.id}&clientId=${work.clienteId}`} className="primary-button">Gestionar tareas</Link> : <Link href={`/tareas?workId=${work.id}`} className="secondary-button">Consultar tareas</Link>} />;
  const title = subview === "calendario" ? "Calendario registrado" : subview === "hitos" ? "Fechas clave e hitos registrados" : "Cronograma registrado";
  return <div className="grid gap-4"><Section title={title}><div className="mb-4 flex justify-end"><Link href={`/gestion?tipo=eventoAgenda&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=planificacion&subvista=${subview}`)}`} className="primary-button"><CalendarClock size={17} aria-hidden="true" /> Nuevo evento</Link></div><CardsTab items={work.agendaEvents} empty="No hay eventos o fechas clave registrados." render={(event) => <EventCard key={event.id} event={event} />} /></Section><CardsTab items={work.reminders} empty="No hay recordatorios asociados." render={(reminder) => <ReminderCard key={reminder.id} reminder={reminder} />} /></div>;
}

function PartsWorkspace({ work, timeline, subview, mode }: { work: WorkDetail; timeline: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }>; subview: string; mode: "cronologia" | "galeria" }) {
  if (subview === "analisis") return <div className="grid gap-4"><HoursTab work={work} /><Section title="Actividad documentada"><PlainMetric label="Registros de actividad" value={String(timeline.length)} /><p className="type-secondary mt-3">El avance físico no se calcula porque la obra no dispone de un porcentaje persistido.</p></Section></div>;
  if (subview === "reportes") return <OperationalSetupPanel title="Reportes de partes" description="Consolida la actividad registrada de la obra sin sustituir la validación del responsable." count={timeline.length} countLabel="actividades trazables" icon={Table2} items={["Partes diarios, semanales y mensuales en una única lectura.", "Horas, evidencias y responsables conservan su origen.", "La exportación no inventa porcentajes de avance."]} action={<Link href="/inteligencia/export?tipo=works" className="primary-button">Exportar reporte</Link>} />;
  if (["semanales", "mensuales"].includes(subview)) return <Section title={subview === "semanales" ? "Partes semanales registrados" : "Partes mensuales registrados"}><TimelineList items={timeline} /></Section>;
  if (subview === "actividades") return <Section title="Todas las actividades registradas"><TimelineList items={timeline} /></Section>;
  return <ProgressTab work={work} timeline={timeline} mode={mode} />;
}

function CostsWorkspace({ work, financial, pendingMaterials, subview }: { work: WorkDetail; financial: ReturnType<typeof calculateWorkFinancials>; pendingMaterials: number; subview: string }) {
  if (subview === "materiales") return <MaterialsTab materials={work.materials} pendingCount={pendingMaterials} workId={work.id} />;
  if (subview === "mano-obra") return <HoursTab work={work} />;
  if (subview === "subcontratas") return <SubcontractTab work={work} expenses={work.expenses} />;
  if (subview === "ordenes") return <OperationalSetupPanel title="Órdenes de trabajo y compra" description="Prepara, valida y vincula cada orden al expediente de la obra antes de ejecutarla." count={work.expenses.length} countLabel="costes trazables" icon={ClipboardList} items={["Las órdenes se relacionan con proveedores y partidas autorizadas.", "La ejecución conserva responsable, fecha y evidencia.", "Ningún coste se confirma sin revisión humana."]} action={<Link href={`/gestion?tipo=gasto&obraId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=costes&subvista=ordenes`)}`} className="primary-button">Registrar orden o coste</Link>} />;
  if (subview === "informes") return <Section title="Informes de costes"><p className="type-secondary">La exportación utiliza exclusivamente los costes autorizados de esta empresa.</p><Link href="/inteligencia/export?tipo=works" className="primary-button mt-4 inline-flex">Exportar informe</Link></Section>;
  const groupedExpenses = new Map<string, WorkDetail["expenses"]>();
  for (const expense of work.expenses) {
    const category = expense.categoria.replaceAll("_", " ");
    groupedExpenses.set(category, [...(groupedExpenses.get(category) ?? []), expense]);
  }
  const accumulatedByCategory = Array.from(groupedExpenses.entries()).map(([category, expenses], index) => ({
    id: category,
    code: String(index + 1).padStart(2, "0"),
    name: category,
    actualAmount: expenses.reduce((sum, expense) => sum + expense.importe, 0),
    expenses,
  }));
  if (subview === "estructura") return <WorkCostsStructure
    chapters={accumulatedByCategory.map((category) => ({
      id: category.id,
      code: category.code,
      description: category.name,
      budget: null,
      committed: null,
      accumulated: category.actualAmount,
      forecast: null,
      toDate: category.actualAmount,
      items: category.expenses.map((expense, index) => ({
        id: expense.id,
        code: `${category.code}.${index + 1}`,
        description: expense.concepto,
        budget: null,
        committed: null,
        accumulated: expense.importe,
        forecast: null,
        toDate: expense.importe,
      })),
    }))}
    coverage={{ budget: false, committed: false, accumulated: true, forecast: false, toDate: true }}
    versionLabel="Costes registrados en la obra"
    exportHref="/inteligencia/export?tipo=works"
  />;
  if (subview === "analisis") {
    const daily = new Map<string, number>();
    for (const expense of work.expenses) {
      const date = expense.fecha.toISOString().slice(0, 10);
      daily.set(date, (daily.get(date) ?? 0) + expense.importe);
    }
    let accumulated = 0;
    const trend = Array.from(daily.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, amount]) => {
      accumulated += amount;
      return { date, actualAmount: accumulated, budgetAmount: null, forecastAmount: null };
    });
    const budget = work.presupuestoAprobado > 0 ? work.presupuestoAprobado : null;
    const forecast = work.costePrevisto > 0 ? work.costePrevisto : null;
    const deviation = budget != null && forecast != null ? forecast - budget : null;
    const margin = work.margenEstimado > 0 ? work.margenEstimado : null;
    return <WorkCostsAnalysis
      periodLabel="Histórico completo de la obra"
      summary={{
        budgetAmount: budget,
        budgetPercent: budget != null ? 100 : null,
        actualAmount: financial.realCost,
        actualPercent: budget != null ? financial.realCost / budget * 100 : null,
        forecastAmount: forecast,
        forecastPercent: budget != null && forecast != null ? forecast / budget * 100 : null,
        deviationAmount: deviation,
        deviationPercent: budget != null && deviation != null ? deviation / budget * 100 : null,
        projectedMarginAmount: margin,
        projectedMarginPercent: budget != null && margin != null ? margin / budget * 100 : null,
      }}
      trend={trend}
      categories={accumulatedByCategory.map((category) => ({ id: category.id, code: category.code, name: category.name, budgetAmount: null, actualAmount: category.actualAmount, forecastAmount: null, deviationAmount: null }))}
      categoryTotals={{ budgetAmount: null, actualAmount: financial.realCost, forecastAmount: null, deviationAmount: null }}
      deviations={[]}
      exportHref="/inteligencia/export?tipo=works"
      categoriesHref={`/obras/${work.id}/costes/estructura`}
      deviationsHref={`/obras/${work.id}/costes/incidencias`}
    />;
  }
  if (subview === "incidencias") return <WorkCostsIncidentsRanking mode="incidents" incidents={[]} exportHref="/inteligencia/export?tipo=works" />;
  if (subview === "ranking") {
    const suppliers = new Map<string, { name: string; amount: number }>();
    for (const expense of work.expenses) {
      const key = expense.businessPartnerId ?? expense.proveedor.trim().toLocaleLowerCase("es-ES");
      const current = suppliers.get(key);
      suppliers.set(key, { name: expense.businessPartner?.commercialName ?? expense.proveedor, amount: (current?.amount ?? 0) + expense.importe });
    }
    const supplierRows = Array.from(suppliers.entries()).map(([id, supplier]) => ({ id, ...supplier })).sort((left, right) => right.amount - left.amount);
    const categoryRows = [...accumulatedByCategory].sort((left, right) => right.actualAmount - left.actualAmount);
    return <WorkCostsIncidentsRanking
      mode="ranking"
      title="Ranking de costes registrados"
      description="Clasificaciones calculadas sólo con gastos persistidos en esta obra."
      metrics={[
        { id: "actual", label: "Coste acumulado", value: financial.realCost, format: "currency" },
        { id: "suppliers", label: "Proveedores visibles", value: supplierRows.length, format: "number" },
        { id: "categories", label: "Categorías visibles", value: categoryRows.length, format: "number" },
      ]}
      groups={[
        { id: "suppliers", title: "Proveedores por coste acumulado", width: "wide", columns: [{ key: "actual", label: "Coste acumulado", align: "right" }], rows: supplierRows.map((supplier, index) => ({ id: supplier.id, rank: index + 1, label: supplier.name, cells: { actual: { value: supplier.amount, format: "currency" } } })) },
        { id: "categories", title: "Categorías por coste acumulado", width: "wide", columns: [{ key: "actual", label: "Coste acumulado", align: "right" }], rows: categoryRows.map((category, index) => ({ id: category.id, rank: index + 1, code: category.code, label: category.name, cells: { actual: { value: category.actualAmount, format: "currency" } } })) },
      ]}
      exportHref="/inteligencia/export?tipo=works"
    />;
  }
  if (subview === "resumen") {
    const expensesByCategory = new Map<string, WorkDetail["expenses"]>();
    for (const expense of work.expenses) {
      const category = expense.categoria.replaceAll("_", " ");
      expensesByCategory.set(category, [...(expensesByCategory.get(category) ?? []), expense]);
    }
    const lines = Array.from(expensesByCategory.entries()).map(([category, expenses]) => ({
      id: category,
      name: category,
      budgetAmount: null,
      actualAmount: expenses.reduce((sum, expense) => sum + expense.importe, 0),
      committedAmount: null,
      estimatedFinalAmount: null,
    }));
    const supplierGroups = new Map<string, { id: string; name: string; actualAmount: number }>();
    for (const expense of work.expenses) {
      const id = expense.businessPartnerId ?? `supplier:${expense.proveedor.trim().toLocaleLowerCase("es-ES")}`;
      const current = supplierGroups.get(id);
      supplierGroups.set(id, {
        id,
        name: expense.businessPartner?.commercialName ?? expense.proveedor,
        actualAmount: (current?.actualAmount ?? 0) + expense.importe,
      });
    }
    const budgetTotal = work.presupuestoAprobado > 0 ? work.presupuestoAprobado : null;
    const projectedMarginAmount = work.margenEstimado > 0 ? work.margenEstimado : null;
    const projectedMarginPercent = projectedMarginAmount != null && budgetTotal != null ? (projectedMarginAmount / budgetTotal) * 100 : null;
    return <WorkCostsOverview
      workId={work.id}
      summary={{
        actualCost: financial.realCost,
        budgetTotal,
        committedCost: null,
        estimatedFinalCost: work.costePrevisto > 0 ? work.costePrevisto : null,
        projectedMarginAmount,
        projectedMarginPercent,
        targetMarginPercent: null,
        reviewedAt: null,
        versionLabel: "Datos actuales de la obra",
      }}
      lines={lines}
      expenses={work.expenses.map((expense) => ({
        id: expense.id,
        date: expense.fecha.toISOString(),
        concept: expense.concepto,
        amount: expense.importe,
        categoryId: expense.categoria,
        categoryName: expense.categoria.replaceAll("_", " "),
        supplierId: expense.businessPartnerId,
        supplierName: expense.businessPartner?.commercialName ?? expense.proveedor,
        status: expense.paymentStatus,
        documentNumber: expense.purchaseInvoice?.invoiceNumber,
      }))}
      suppliers={Array.from(supplierGroups.values())}
    />;
  }
  const metricPanel = <Section title="Control de costes autorizado"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Finance label="Presupuestado" value={financial.budgeted} /><Finance label="Coste previsto" value={financial.forecastCost} /><Finance label="Gasto real" value={financial.realCost} /><Finance label="Desviación" value={financial.deviation} tone={financial.deviation > 0 ? "danger" : "success"} /><Finance label="Beneficio" value={financial.benefit} tone={financial.benefit < 0 ? "danger" : "success"} /><PlainMetric label="Margen" value={`${financial.marginPercent.toFixed(1)} %`} tone={financial.marginPercent < 15 ? "warning" : "neutral"} /></div></Section>;
  return <div className="grid gap-4">{metricPanel}{["estructura", "proveedores", "comparativa", "analisis", "resumen"].includes(subview) ? <CardsTab items={work.expenses} empty="No hay gastos registrados para esta vista." render={(expense) => <ExpenseCard key={expense.id} expense={expense} />} /> : null}</div>;
}

function BillingWorkspace({ work, treasury, financial, subview }: { work: WorkDetail; treasury: Awaited<ReturnType<typeof getEconomicControl>>; financial: ReturnType<typeof calculateWorkFinancials>; subview: string }) {
  if (subview === "resumen") {
    const pendingInvoices = work.invoices.map((invoice) => ({ invoice, paid: invoicePaid(invoice), pending: Math.max(0, invoice.total - invoicePaid(invoice)) }));
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = pendingInvoices.filter(({ invoice, pending }) => pending > 0 && invoice.fechaVencimiento && invoice.fechaVencimiento >= now && invoice.fechaVencimiento <= thirtyDays).reduce((sum, item) => sum + item.pending, 0);
    return <WorkBillingOverview
      workId={work.id}
      metrics={[
        { kind: "contracted", value: financial.budgeted || null, percent: financial.budgeted > 0 ? 100 : null, detail: "Presupuesto autorizado de la obra" },
        { kind: "certified", value: null, detail: "Sin certificaciones persistidas" },
        { kind: "issued", value: financial.invoiced, percent: financial.budgeted > 0 ? financial.invoiced / financial.budgeted * 100 : null, detail: `${financial.invoiceCount} facturas vinculadas` },
        { kind: "pending", value: financial.pending, detail: `${financial.openInvoiceCount} facturas abiertas` },
        { kind: "retained", value: null, detail: "Sin retenciones persistidas" },
        { kind: "upcoming", value: upcoming, detail: "Vencimientos en los próximos 30 días" },
      ]}
      certifications={[]}
      invoices={pendingInvoices.map(({ invoice, paid }) => ({
        id: invoice.id,
        number: invoice.numero,
        issuedAt: invoice.fechaEmision.toISOString(),
        dueAt: invoice.fechaVencimiento?.toISOString() ?? null,
        amount: invoice.total,
        status: invoice.estado,
        collectedAmount: paid,
        detailHref: `/dinero/${invoice.id}`,
      }))}
      invoiceTotals={{ invoiceAmount: financial.invoiced, collectedAmount: financial.paid }}
      forecast={pendingInvoices.filter(({ pending }) => pending > 0).map(({ invoice, paid, pending }) => ({ id: invoice.id, label: invoice.fechaVencimiento ? formatDate(invoice.fechaVencimiento) : invoice.numero, expectedAmount: pending, collectedAmount: paid }))}
      forecastSummary={{ expectedRemaining: financial.pending, collectedTotal: financial.paid, pendingExpected: financial.pending, nextThirtyDays: upcoming }}
      timeline={pendingInvoices.map(({ invoice }) => ({ id: invoice.id, date: invoice.fechaEmision.toISOString(), code: invoice.numero, title: invoice.concepto, detail: invoice.fechaVencimiento ? `Vence ${formatDate(invoice.fechaVencimiento)}` : "Sin vencimiento persistido", amount: invoice.total, status: invoice.estado, href: `/dinero/${invoice.id}` }))}
      certificationsHref={`/obras/${work.id}?vista=facturacion&subvista=certificaciones`}
      invoicesHref={`/obras/${work.id}?vista=facturacion&subvista=facturas`}
      forecastHref={`/obras/${work.id}?vista=facturacion&subvista=vencimientos`}
      timelineHref={`/obras/${work.id}?vista=facturacion&subvista=historico`}
    />;
  }
  const metrics = <Section title="Facturación y cobros autorizados"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Finance label="Presupuestado" value={financial.budgeted} /><Finance label="Facturado" value={financial.invoiced} /><Finance label="Cobrado" value={financial.paid} /><Finance label="Pendiente" value={financial.pending} tone={financial.pending ? "warning" : "neutral"} /></div></Section>;
  if (subview === "facturas") return <div className="grid gap-4">{metrics}<CardsTab items={work.invoices} empty="No hay facturas asociadas." render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /></div>;
  if (subview === "cobros") return <div className="grid gap-4">{metrics}<CardsTab items={work.payments} empty="Cobros preparados para esta obra" render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /><WorkTreasuryTab treasury={treasury} workId={work.id} /></div>;
  if (subview === "vencimientos") return <div className="grid gap-4">{metrics}<Section title="Calendario de vencimientos"><div className="grid gap-2">{work.invoices.length ? work.invoices.map((invoice) => <Link key={invoice.id} href={`/dinero/${invoice.id}`} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs"><span className="truncate font-bold text-content">{invoice.numero} · {invoice.concepto}</span><span className="text-content-secondary">{formatDate(invoice.fechaVencimiento)}</span><span className="font-bold text-content">{formatCurrency(Math.max(0, invoice.total - invoicePaid(invoice)))}</span></Link>) : <OperationalSetupPanel title="Calendario de cobro preparado" description="Las facturas aparecerán ordenadas por fecha de vencimiento cuando se registren." count={0} countLabel="vencimientos" icon={CalendarClock} items={["Cada vencimiento conserva su factura de origen.", "El pendiente se calcula con cobros registrados.", "No se muestran fechas o importes simulados."]} compact />}</div></Section></div>;
  if (subview === "historico") return <div className="grid gap-4">{metrics}<CardsTab items={work.invoices} empty="Histórico de facturación preparado" render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /><CardsTab items={work.payments} empty="Histórico de cobros preparado" render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /></div>;
  if (["certificaciones", "hitos", "retenciones"].includes(subview)) return <div className="grid gap-4">{metrics}<OperationalSetupPanel title={subview === "certificaciones" ? "Certificaciones de obra" : subview === "hitos" ? "Hitos facturables" : "Retenciones contractuales"} description="La vista está preparada para operar con documentos vinculados y mantiene el control económico actual como autoridad." count={subview === "hitos" ? work.budgets.length : work.invoices.length} countLabel="documentos de referencia" icon={Receipt} items={["El documento de origen permanece enlazado a la obra.", "Importes, vencimientos y estados se toman del registro autorizado.", "La emisión o cambio de estado exige confirmación humana."]} action={<Link href={`/gestion?tipo=${subview === "certificaciones" ? "documento" : "factura"}&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=facturacion&subvista=${subview}`)}`} className="primary-button">Registrar documento</Link>} /></div>;
  return <div className="grid gap-4">{metrics}<CardsTab items={work.budgets} empty="No hay presupuestos asociados." render={(budget) => <BudgetCard key={budget.id} budget={budget} />} /><CardsTab items={work.invoices} empty="No hay facturas asociadas." render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /><CardsTab items={work.payments} empty="No hay cobros registrados en esta obra." render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /><WorkTreasuryTab treasury={treasury} workId={work.id} /></div>;
}

function DocumentsWorkspace({ work, documents, subview }: { work: WorkDetail; documents: ReturnType<typeof buildWorkDocuments>; subview: string }) {
  const documentRows = documents.map((document) => ({
    id: document.key,
    kind: "file" as const,
    name: document.name,
    category: document.type.toLocaleLowerCase("es-ES").replaceAll(" ", "_"),
    categoryLabel: document.type,
    subtype: document.source,
    createdAt: document.date instanceof Date ? document.date.toISOString() : document.date ? new Date(document.date).toISOString() : null,
    uploadedBy: document.source,
    href: document.href,
  }));
  const photoRows = work.photos.filter((photo): photo is typeof photo & { url: string } => typeof photo.url === "string" && (photo.url.startsWith("/") || photo.url.startsWith("https://"))).map((photo) => ({
    id: photo.id,
    src: photo.url,
    alt: photo.titulo,
    width: 1600,
    height: 900,
    capturedAt: photo.tomadaEn.toISOString(),
    category: photo.categoria,
    categoryLabel: photo.categoria.replaceAll("_", " "),
    authorName: photo.autor,
    location: photo.ubicacion,
    notes: photo.notas,
    comments: [],
    downloadHref: photo.url,
  }));
  const uploadDocumentHref = `/gestion?tipo=documento&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=documentos&subvista=documentos`)}`;
  const uploadPhotoHref = `/gestion?tipo=foto&obraId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=documentos&subvista=galeria`)}`;
  if (subview === "documentos") return <WorkDocumentsReferenceWorkspace mode="summary" documents={documentRows} photos={photoRows} uploadDocumentsHref={uploadDocumentHref} />;
  if (subview === "galeria") return <WorkDocumentsReferenceWorkspace mode="gallery" documents={documentRows} photos={photoRows} uploadPhotosHref={uploadPhotoHref} />;
  if (subview === "subir") return <DocumentsTab documents={documents} workId={work.id} clientId={work.clienteId} />;
  const category = subview === "documentos" ? null : subview;
  const filtered = category ? documents.filter((document) => document.type.toLowerCase().includes(category.slice(0, -1))) : documents;
  return <DocumentsTab documents={filtered} workId={work.id} clientId={work.clienteId} />;
}

function TeamWorkspace({ work, tasks, memberNames, subview }: { work: WorkDetail; tasks: WorkTask[]; memberNames: Record<string, string>; subview: string }) {
  if (subview === "carga") return <HoursTab work={work} />;
  if (subview === "subcontratas") return <SubcontractTab work={work} expenses={work.expenses} />;
  if (["turnos", "formacion", "permisos"].includes(subview)) return <div className="grid gap-4"><PeopleTab work={work} /><OperationalSetupPanel title={subview === "turnos" ? "Cobertura de turnos" : subview === "formacion" ? "Formación y aptitudes" : "Permisos del equipo"} description="Organiza esta capa operativa sobre las personas vinculadas a la obra, sin crear identidades o habilitaciones ficticias." count={[work.responsable, work.comercial, work.jefeObra].filter(Boolean).length} countLabel="responsables vinculados" icon={Users} items={["Cada persona conserva su rol y relación real con la obra.", "Los cambios quedan preparados para revisión del responsable.", "La ausencia de datos se muestra como cobertura pendiente, no como dato supuesto."]} action={<Link href={`/gestion?tipo=obra&id=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=equipo&subvista=${subview}`)}`} className="primary-button">Configurar equipo</Link>} /></div>;
  const peopleByName = new Map<string, WorkTeamPerson>();
  const addPerson = (name: string | null | undefined, role: string, id: string) => {
    const normalized = name?.trim();
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase("es-ES");
    const existing = peopleByName.get(key);
    peopleByName.set(key, existing ? { ...existing, role: existing.role?.includes(role) ? existing.role : `${existing.role} · ${role}` } : { id, name: normalized, role, team: "Obra", statusLabel: "Vinculado a esta obra", statusTone: "success" });
  };
  addPerson(work.jefeObra, "Jefe de obra", `chief-${work.id}`);
  addPerson(work.responsable, "Responsable", `responsible-${work.id}`);
  addPerson(work.comercial, "Comercial", `commercial-${work.id}`);
  const assignedUserIds = new Set(tasks.flatMap((task) => [task.assigneeId, ...task.assignments.filter((assignment) => !assignment.removedAt).map((assignment) => assignment.userId)].filter((value): value is string => Boolean(value))));
  const namedAssignedUserIds = Array.from(assignedUserIds).filter((userId) => Boolean(memberNames[userId]));
  namedAssignedUserIds.forEach((userId) => addPerson(memberNames[userId], "Asignado a tareas", userId));
  const people = Array.from(peopleByName.values());
  const tasksWithEstimate = tasks.filter((task) => task.estimatedMinutes != null);
  const tasksWithActual = tasks.filter((task) => task.actualMinutes != null);
  const plannedHours = tasksWithEstimate.length ? tasksWithEstimate.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0) / 60 : null;
  const recordedHours = tasksWithActual.length ? tasksWithActual.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0) / 60 : null;
  const loads = namedAssignedUserIds.map((userId) => {
    const assigned = tasks.filter((task) => task.assigneeId === userId || task.assignments.some((assignment) => !assignment.removedAt && assignment.userId === userId));
    const hasPlanned = assigned.some((task) => task.estimatedMinutes != null);
    const hasActual = assigned.some((task) => task.actualMinutes != null);
    return { id: userId, name: memberNames[userId], peopleCount: 1, loadPercent: null, assignedHours: hasActual ? assigned.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0) / 60 : null, plannedHours: hasPlanned ? assigned.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0) / 60 : null, statusLabel: `${assigned.length} tareas vinculadas` };
  });
  const subcontractors = Array.from(new Map(work.expenses.filter((expense) => expense.businessPartner?.kind === "SUBCONTRACTOR").map((expense) => [expense.businessPartner!.id, { id: expense.businessPartner!.id, companyName: expense.businessPartner!.commercialName, statusLabel: "Vinculada por coste registrado", statusTone: "neutral" as const }])).values());
  const approversByName = new Map<string, WorkTeamApprover>();
  const addApprover = (name: string | null | undefined, role: string, responsibility: string, id: string) => {
    const normalized = name?.trim();
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase("es-ES");
    const existing = approversByName.get(key);
    approversByName.set(key, existing ? { ...existing, role: `${existing.role} · ${role}`, responsibility: `${existing.responsibility}. ${responsibility}` } : { id, name: normalized, role, responsibility });
  };
  addApprover(work.jefeObra, "Jefe de obra", "Supervisión operativa de la obra", `chief-${work.id}`);
  addApprover(work.responsable, "Responsable", "Coordinación registrada de la obra", `responsible-${work.id}`);
  addApprover(work.comercial, "Comercial", "Seguimiento comercial vinculado", `commercial-${work.id}`);
  const approvers = Array.from(approversByName.values());
  const returnTo = `/obras/${work.id}?vista=equipo&subvista=equipo`;
  return <WorkTeamOverview
    summary={{ assignedPeople: people.length, assignedPeopleDetail: `${assignedUserIds.size} asignaciones de usuario en tareas`, coveredProfilesPercent: null, coveredProfilesDetail: "Sin catálogo de perfiles requeridos", overloadedPeople: null, overloadedPeopleDetail: "Sin capacidad laboral persistida", uncoveredCriticalProfiles: null, uncoveredCriticalProfilesDetail: "Sin perfiles críticos persistidos", plannedHours, plannedHoursDetail: `${tasksWithEstimate.length} tareas con estimación`, recordedHours, recordedHoursDetail: `${tasksWithActual.length} tareas con horas registradas` }}
    people={people}
    peopleTotal={people.length}
    loads={loads}
    schedule={{ days: [], rows: [] }}
    subcontractors={subcontractors}
    subcontractorsTotal={subcontractors.length}
    requirements={[]}
    accesses={[]}
    approvers={approvers}
    notes={work.internalNotes.filter((note) => !note.archivedAt).map((note) => ({ id: note.id, author: note.authorId ? memberNames[note.authorId] ?? "Autor registrado" : "Autor no informado", createdAtLabel: formatDate(note.createdAt), content: note.content, href: `/gestion?tipo=notaInterna&id=${note.id}&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(returnTo)}` }))}
    actions={{
      organization: { label: "Organización", href: "/equipo", icon: "users" },
      allPeople: { label: "Ver todas las personas", href: "/equipo", icon: "users" },
      resourcePlan: { label: "Planificación de recursos", href: `/obras/${work.id}?vista=planificacion&subvista=recursos`, icon: "calendar" },
      calendar: { label: "Ver agenda", href: `/agenda?obraId=${work.id}`, icon: "calendar" },
      subcontractors: { label: "Ver subcontratas", href: `/obras/${work.id}?vista=equipo&subvista=subcontratas`, icon: "users" },
      training: { label: "Revisar formación", href: `/obras/${work.id}?vista=equipo&subvista=formacion`, icon: "settings" },
      accesses: { label: "Revisar permisos", href: `/obras/${work.id}?vista=equipo&subvista=permisos`, icon: "settings" },
      addNote: { label: "Añadir nota", href: `/gestion?tipo=notaInterna&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(returnTo)}`, icon: "message" },
      communication: [{ label: "Añadir nota interna", href: `/gestion?tipo=notaInterna&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(returnTo)}`, icon: "message", variant: "secondary" }],
    }}
  />;
}

function DocumentsTab({ documents, workId, clientId }: { documents: ReturnType<typeof buildWorkDocuments>; workId: string; clientId: string }) {
  return (
    <Section title="Documentos">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/gestion?tipo=presupuesto&clienteId=${clientId}&obraId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="secondary-button"><FileText size={17} /> Presupuesto</Link>
        <Link href={`/gestion?tipo=factura&clienteId=${clientId}&obraId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="secondary-button"><Receipt size={17} /> Factura</Link>
        <Link href={`/gestion?tipo=documento&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="secondary-button"><FileArchive size={17} /> Registrar documento</Link>
      </div>
      {documents.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {documents.map((document) => (
            <article key={document.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="label">{document.type}</p>
              <h3 className="mt-1 font-black text-obra-ink">{document.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{document.source} · {formatDate(document.date)}</p>
              {document.href ? <Link href={document.href} className="secondary-button mt-3">Abrir</Link> : null}
            </article>
          ))}
        </div>
      ) : (
        <OperationalSetupPanel title="Expediente documental preparado" description="Añade documentos, presupuestos o facturas para construir el expediente verificable de la obra." count={0} countLabel="documentos vinculados" icon={FileArchive} items={["Cada archivo conserva tipo, fecha y origen.", "La galería utiliza únicamente URLs seguras.", "Los documentos permanecen separados por empresa."]} action={<Link href={`/gestion?tipo=documento&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="primary-button">Registrar documento</Link>} />
      )}
    </Section>
  );
}

function IncidentsTab({ work, risks }: { work: WorkDetail; risks: ReturnType<typeof buildWorkRisks> }) {
  const incidents = work.photos.filter((photo) => photo.categoria.trim().toLowerCase() === "incidencia");
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Section title={`Incidencias registradas · ${incidents.length}`}>
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Link href={`/gestion?tipo=foto&obraId=${work.id}&categoria=incidencia&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=incidencias`)}`} className="primary-button"><AlertTriangle size={17} aria-hidden="true" /> Registrar incidencia</Link>
        </div>
        {incidents.length ? <div className="grid gap-3">{incidents.map((incident) => {
          const safeHref = incident.url && (incident.url.startsWith("/") || incident.url.startsWith("https://")) ? incident.url : null;
          return <article key={incident.id} className="rounded-xl border border-border bg-surface p-4"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/5 text-danger"><AlertTriangle size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-content">{incident.titulo}</h3><p className="type-meta mt-1">{formatDate(incident.tomadaEn)}{incident.autor ? ` · ${incident.autor}` : ""}{incident.ubicacion ? ` · ${incident.ubicacion}` : ""}</p>{incident.notas ? <p className="type-secondary mt-2">{incident.notas}</p> : null}{safeHref ? <Link href={safeHref} className="secondary-button mt-3 inline-flex">Abrir evidencia</Link> : null}</div></div></article>;
        })}</div> : <OperationalSetupPanel title="Registro de incidencias preparado" description="La obra está lista para documentar una incidencia con título, fecha, ubicación, notas y evidencia segura." count={0} countLabel="incidencias registradas" icon={AlertTriangle} items={["El contador se alimenta sólo de evidencias categoría incidencia.", "La captura queda vinculada a esta obra.", "No se atribuye estado abierto o cerrado sin un dato persistido."]} action={<Link href={`/gestion?tipo=foto&obraId=${work.id}&categoria=incidencia&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=incidencias`)}`} className="primary-button">Registrar incidencia</Link>} compact />}
      </Section>
      <Section title="Riesgos operativos relacionados">
        {risks.length ? <div className="grid gap-3">{risks.map((risk) => <Risk key={risk.key} risk={risk} />)}</div> : <OperationalSetupPanel title="Supervisión preventiva activa" description="Los datos actuales no generan alertas operativas relacionadas con esta obra." count={0} countLabel="riesgos calculados" icon={ShieldCheck} items={["Se monitorizan fechas, cobros, margen y materiales.", "Las señales se recalculan a partir de registros reales.", "Cualquier acción requiere revisión humana."]} compact />}
      </Section>
    </div>
  );
}

function ProgressTab({ work, timeline, mode }: { work: WorkDetail; timeline: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }>; mode: "cronologia" | "galeria" }) {
  const photos = work.photos
    .filter((photo): photo is typeof photo & { url: string } => typeof photo.url === "string" && (photo.url.startsWith("/") || photo.url.startsWith("https://")))
    .map((photo) => ({
      id: photo.id,
      title: photo.titulo,
      url: photo.url,
      category: photo.categoria.replaceAll("_", " "),
      date: formatDate(photo.tomadaEn),
      author: photo.autor,
      notes: photo.notas
    }));
  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl bg-subtle p-1" aria-label="Vista de progreso">
          <Link href={`/obras/${work.id}?vista=partes&subvista=diarios&modo=cronologia`} aria-current={mode === "cronologia" ? "page" : undefined} className={mode === "cronologia" ? "primary-button" : "ghost-button"}>Cronología</Link>
          <Link href={`/obras/${work.id}?vista=partes&subvista=diarios&modo=galeria`} aria-current={mode === "galeria" ? "page" : undefined} className={mode === "galeria" ? "primary-button" : "ghost-button"}>Galería</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/gestion?tipo=foto&obraId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=partes&modo=${mode}`)}`} className="secondary-button"><Camera size={17} aria-hidden="true" /> Registrar foto</Link>
          <Link href={`/gestion?tipo=notaInterna&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=partes&modo=${mode}`)}`} className="secondary-button"><ClipboardList size={17} aria-hidden="true" /> Añadir nota</Link>
          <Link href={`/gestion?tipo=eventoAgenda&clienteId=${work.clienteId}&obraId=${work.id}&tipoEvento=visita&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=partes&modo=${mode}`)}`} className="secondary-button"><CalendarClock size={17} aria-hidden="true" /> Registrar visita</Link>
        </div>
      </div>
      {mode === "galeria" ? (
        <Section title={`Galería de progreso · ${photos.length}`}>
          <WorkProgressGallery photos={photos} />
          {work.photos.length > photos.length ? <p className="type-meta mt-3">{work.photos.length - photos.length} registros sin una URL segura se conservan en la cronología.</p> : null}
        </Section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Section title="Cronología operativa"><TimelineList items={timeline} /></Section>
          <NotesTab notes={work.internalNotes} workId={work.id} clientId={work.clienteId} />
        </div>
      )}
    </div>
  );
}

function NotesTab({ notes, workId, clientId }: { notes: WorkDetail["internalNotes"]; workId: string; clientId: string }) {
  const activeNotes = notes.filter((note) => !note.archivedAt);
  return (
    <Section title="Notas internas">
      <div className="mb-4">
        <Link href={`/gestion?tipo=notaInterna&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=notas`} className="secondary-button">Añadir nota</Link>
      </div>
      {activeNotes.length ? (
        <div className="grid gap-3">
          {activeNotes.map((note) => (
            <article key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="label">{formatDate(note.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.content}</p>
              <Link href={`/gestion?tipo=notaInterna&id=${note.id}&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=notas`} className="secondary-button mt-3">Editar</Link>
            </article>
          ))}
        </div>
      ) : (
        <OperationalSetupPanel title="Bitácora interna preparada" description="Documenta decisiones y contexto del equipo sin incorporarlos a PDFs ni mensajes de cliente." count={0} countLabel="notas activas" icon={ClipboardList} items={["Las notas permanecen internas a la empresa.", "Cada entrada conserva fecha y trazabilidad.", "La edición utiliza el flujo seguro existente."]} action={<Link href={`/gestion?tipo=notaInterna&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=notas`} className="secondary-button">Añadir nota</Link>} compact />
      )}
    </Section>
  );
}

function AiTab({ work, financial, risks, openInvoices, pendingMaterials, documents }: { work: WorkDetail; financial: ReturnType<typeof calculateWorkFinancials>; risks: ReturnType<typeof buildWorkRisks>; openInvoices: number; pendingMaterials: number; documents: number }) {
  const answers = [
    ["Resume esta obra", `${work.titulo} para ${work.client.nombre}. Estado ${workStatusMeta(work.estado).label}. ${formatCurrency(financial.invoiced)} facturados y ${formatCurrency(financial.pending)} pendientes.`],
    ["Qué falta", getWorkNextAction(work).label],
    ["Qué riesgos hay", risks.length ? risks.map((risk) => risk.title).join(", ") : "No hay riesgos operativos detectados."],
    ["Qué documentos faltan", documents ? "Hay documentos asociados; revisa que contrato, garantía o certificado estén cargados si aplican." : "No hay documentos asociados todavía."],
    ["Qué materiales faltan", pendingMaterials ? `${pendingMaterials} materiales pendientes o en falta.` : "No hay materiales pendientes registrados."],
    ["Qué facturas faltan", financial.budgeted > financial.invoiced ? `Queda por facturar ${formatCurrency(financial.budgeted - financial.invoiced)} respecto al presupuesto.` : "No hay diferencia pendiente entre presupuesto y facturación."],
    ["Qué cobros faltan", openInvoices ? `${openInvoices} facturas abiertas por ${formatCurrency(financial.pending)}.` : "No hay cobros pendientes."],
    ["Qué visitas quedan", `${work.agendaEvents.filter((event) => !["cancelado", "realizado"].includes(event.estado)).length} visitas o eventos abiertos.`],
    ["Qué recordatorios existen", `${work.reminders.length} recordatorios asociados.`]
  ];
  return (
    <Section title="IA de obra">
      <div className="grid gap-3">
        {answers.map(([question, answer]) => (
          <article key={question} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-obra-ink">{question}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
          </article>
        ))}
      </div>
      <Link href="/capataz" className="primary-button mt-4 inline-flex"><Bot size={18} /> Preguntar a {brand.assistantName}</Link>
    </Section>
  );
}

function ConfigTab({ work }: { work: WorkDetail }) {
  return (
    <Section title="Configuración">
      <InfoGrid rows={[
        ["ID", work.id],
        ["Número interno", work.numeroInterno ?? "No asignado"],
        ["Código", work.codigo ?? "No asignado"],
        ["Archivada", work.archivada ? "Sí" : "No"],
        ["Archivada el", formatDate(work.archivadaAt)],
        ["Última modificación", formatDate(work.updatedAt)]
      ]} />
    </Section>
  );
}

function BudgetCard({ budget }: { budget: WorkDetail["budgets"][number] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <StatusBadge status={budget.estado} />
      <h3 className="mt-3 font-black text-obra-ink">{budget.numero} · {budget.titulo}</h3>
      <p className="mt-1 text-sm text-slate-500">{formatCurrency(budget.total)} · {formatDate(budget.fechaCreacion)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/presupuestos/${budget.id}`} className="secondary-button">Ver</Link>
        <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} className="secondary-button">PDF</Link>
      </div>
    </article>
  );
}

function InvoiceCard({ invoice }: { invoice: WorkDetail["invoices"][number] }) {
  const paid = invoicePaid(invoice);
  const pending = Math.max(0, invoice.total - paid);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <StatusBadge status={invoice.estado} />
      <h3 className="mt-3 font-black text-obra-ink">{invoice.numero} · {invoice.concepto}</h3>
      <p className="mt-1 text-sm text-slate-500">Total {formatCurrency(invoice.total)} · cobrado {formatCurrency(paid)} · pendiente {formatCurrency(pending)}</p>
      <Link href={`/dinero/${invoice.id}`} className="secondary-button mt-3">Abrir factura</Link>
    </article>
  );
}

function PaymentCard({ payment }: { payment: WorkDetail["payments"][number] }) {
  return <SimpleCard title={formatCurrency(payment.importe)} eyebrow={payment.tipo} detail={`${payment.metodo} · ${formatDate(payment.fecha)} · ${payment.invoice?.numero ?? "Factura"}`} />;
}

function ExpenseCard({ expense }: { expense: WorkDetail["expenses"][number] }) {
  return <SimpleCard title={`${expense.proveedor} · ${formatCurrency(expense.importe)}`} eyebrow={expense.categoria} detail={`${expense.concepto} · ${formatDate(expense.fecha)}`} />;
}

function EventCard({ event }: { event: WorkDetail["agendaEvents"][number] }) {
  return <SimpleCard title={event.titulo} eyebrow={event.tipo} detail={`${event.estado} · ${formatDate(event.fechaInicio)}`} />;
}

function ReminderCard({ reminder }: { reminder: WorkDetail["reminders"][number] }) {
  return <SimpleCard title={reminder.tipo.replaceAll("_", " ")} eyebrow={reminder.estado} detail={`${reminder.mensaje} · ${formatDate(reminder.fechaProgramada)}`} />;
}

function CardsTab<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => ReactNode }) {
  return (
    <Section title="Datos reales">
      {items.length ? <div className="grid gap-3 lg:grid-cols-2">{items.map(render)}</div> : <OperationalSetupPanel title={empty} description="La vista conserva su arquitectura operativa y sólo mostrará registros persistidos." count={0} countLabel="registros vinculados" icon={Table2} items={["La lectura permanece disponible desde cualquier dispositivo.", "Los datos se incorporan desde los flujos autorizados.", "No se generan importes, estados o porcentajes ficticios."]} compact />}
    </Section>
  );
}

function TimelineList({ items }: { items: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }> }) {
  if (!items.length) return <OperationalSetupPanel title="Cronología operativa preparada" description="La actividad aparecerá en orden temporal cuando se registren presupuestos, facturas, pagos, gastos, visitas, recordatorios, documentos o fotos." count={0} countLabel="actividades trazables" icon={Activity} items={["Cada evento conserva fecha y fuente.", "Los registros se ordenan sin alterar su contenido.", "La cronología no simula actividad inexistente."]} compact />;
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.key} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Activity size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-black text-obra-ink">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
            <p className="mt-1 text-xs font-bold uppercase text-slate-500">{formatDate(item.date)}</p>
            {item.href ? <Link href={item.href} className="mt-2 inline-flex text-sm font-bold text-obra-ink underline underline-offset-4">Abrir</Link> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function WorkStatusButton({ id, estado, label }: { id: string; estado: string; label: string }) {
  const archived = estado === "archivada";
  const message = archived
    ? "El trabajo se marcará como archivado. Su historial, documentos e importes se conservarán."
    : `El estado del trabajo cambiará a ${label.toLocaleLowerCase("es-ES")}. La operación quedará registrada y conservará todo su historial.`;

  return (
    <form action={updateWorkStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <ConfirmSubmitButton className={archived ? "danger-button" : "secondary-button"} message={message}>{label}</ConfirmSubmitButton>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <h2 className="mb-3 text-lg font-black text-obra-ink">{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 break-words font-black text-obra-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><Icon size={18} /></span>
      <p className="mt-2 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-obra-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function Finance({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "danger" | "success" }) {
  return <PlainMetric label={label} value={formatCurrency(value)} tone={tone} />;
}

function PlainMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-obra-ink";
  return (
    <div className={`rounded-lg p-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase opacity-75">{label}</p>
      <p className="mt-1 font-black tabular-nums">{value}</p>
    </div>
  );
}

function Risk({ risk }: { risk: { level: "warning" | "danger"; title: string; detail: string } }) {
  return (
    <article className={`rounded-xl border p-4 ${risk.level === "danger" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="font-black">{risk.title}</p>
      <p className="mt-1 text-sm leading-6">{risk.detail}</p>
    </article>
  );
}

function SimpleCard({ title, eyebrow, detail }: { title: string; eyebrow: string; detail: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="label">{eyebrow}</p>
      <h3 className="mt-1 font-black text-obra-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = workStatusMeta(status);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>{meta.label}</span>;
}
