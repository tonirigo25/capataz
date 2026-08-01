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
  Euro,
  FileArchive,
  FileText,
  Filter,
  GitBranch,
  ListChecks,
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
import { EntityHeader, Notice, PageHeader, ParentNavigation, Tabs } from "@/components/ui-primitives";
import { WorkProgressGallery } from "@/components/work-progress-gallery";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { OperationalContextSummary } from "@/components/operational-signals";
import { formatCurrency, formatDate } from "@/lib/format";
import { getWorkOperationalContext } from "@/lib/operational-intelligence/queries";
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
  workPriorityMeta,
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
  planificacion: [["gantt", "Gantt"], ["dependencias", "Dependencias"], ["hitos", "Hitos"], ["recursos", "Recursos"], ["linea-base", "Línea base"], ["escenarios", "Escenarios"]],
  partes: [["resumen", "Resumen"], ["diarios", "Partes diarios"], ["actividades", "Todas las actividades"], ["semanales", "Partes semanales"], ["mensuales", "Partes mensuales"], ["reportes", "Reportes"], ["analisis", "Análisis"]],
  costes: [["resumen", "Resumen"], ["estructura", "Estructura completa"], ["proveedores", "Proveedores"], ["mano-obra", "Mano de obra"], ["materiales", "Materiales"], ["subcontratas", "Subcontratas"], ["ordenes", "Órdenes"], ["comparativa", "Comparativa"], ["analisis", "Análisis"], ["informes", "Informes"]],
  documentos: [["documentos", "Documentos"], ["galeria", "Galería y portada"], ["planos", "Planos"], ["certificados", "Certificados"], ["informes", "Informes"], ["otros", "Otros"]],
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

export default async function WorkDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; tab?: string; modo?: string; subvista?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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
      return <ProjectBudgetWorkDetail work={work} consumed={consumed} />;
    }
    return <RestrictedWorkDetail work={work} />;
  }
  const [taskAccess, taskManageAccess] = await Promise.all([resolveAuthorization(auth, "tasks.view"), resolveAuthorization(auth, "tasks.manage")]);
  const scopedTaskIds = taskAccess.allowed ? await resolveScopedTaskIds(auth, "tasks.view") : [];
  const [work, treasury, operationalContext, workTasks] = await Promise.all([
    prisma.work.findFirst({
      where: { id, companyId: auth.companyId },
      include: workDetailInclude
    }),
    getEconomicControl({ workId: id, period: "30d" }),
    getWorkOperationalContext(id),
    taskAccess.allowed ? prisma.task.findMany({
      where: { companyId: auth.companyId, workId: id, archivedAt: null, ...(scopedTaskIds === null ? {} : { id: { in: scopedTaskIds } }) },
      include: workTaskInclude,
      orderBy: [{ startsAt: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    }) : Promise.resolve([] as WorkTask[]),
  ]);
  if (!work) notFound();

  const requestedView = query.vista ? legacyTabs[query.vista] ?? query.vista : query.tab ? legacyTabs[query.tab] ?? query.tab : "resumen";
  const activeTab = tabs.some(([tab]) => tab === requestedView) ? requestedView as (typeof tabs)[number][0] : "resumen";
  const availableSubviews = workSubviews[activeTab];
  const activeSubview = availableSubviews.some(([id]) => id === query.subvista) ? query.subvista! : availableSubviews[0][0];
  const financial = calculateWorkFinancials(work);
  const risks = buildWorkRisks(work);
  const timeline = buildWorkTimeline(work);
  const documents = buildWorkDocuments(work);
  const nextAction = getWorkNextAction(work);
  const status = workStatusMeta(work.estado);
  const priority = workPriorityMeta(work.prioridad);
  const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
  const openInvoices = work.invoices.filter((invoice) => Math.max(0, invoice.total - invoicePaid(invoice)) > 0);

  return (
    <RecordWorkspace>
      <EntityHeader
        back={<ParentNavigation href="/obras" label="Obras" context={work.client.nombre} />}
        context={work.codigo ?? work.numeroInterno ?? "Espacio de trabajo"}
        title={work.titulo}
        description={`${work.client.nombre} · ${work.tipoTrabajo} · ${work.direccion}`}
        status={<StatusBadge status={work.estado} />}
        action={<Link href={`/gestion?tipo=foto&obraId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=partes`)}`} className="primary-button"><Camera size={18} /> Registrar avance</Link>}
        menu={<WorkActions workId={work.id} clientId={work.clienteId} />}
      />

      <section className="work-360-summary grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Estado real, coste y margen del trabajo">
        <Kpi icon={Activity} label="Estado real" value={status.label} detail="Sin porcentaje físico inventado" />
        <Kpi icon={Camera} label="Evidencia" value={String(work.photos.length)} detail={work.photos[0] ? `Última ${formatDate(work.photos[0].tomadaEn)}` : "Sin fotos registradas"} />
        <Kpi icon={ClipboardList} label="Coste previsto" value={formatCurrency(financial.forecastCost)} detail="Dato registrado" />
        <Kpi icon={WalletCards} label="Coste real" value={formatCurrency(financial.realCost)} detail={`${work.expenses.length} gastos vinculados`} tone={financial.deviation > 0 ? "warning" : "neutral"} />
        <Kpi icon={BadgeEuro} label="Margen autorizado" value={`${financial.marginPercent.toFixed(1)} %`} detail={formatCurrency(financial.benefit)} tone={financial.benefit < 0 ? "danger" : "success"} />
      </section>

      <OperationalContextSummary context={operationalContext} entityType="obra" entityId={work.id} />

      <Tabs label="Secciones de la obra" className="my-5">
        {tabs.map(([id, label, Icon]) => (
          <Link key={id} href={`/obras/${work.id}?vista=${id}`} aria-current={activeTab === id ? "page" : undefined}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </Tabs>

      {activeTab !== "resumen" ? <WorkSubnavigation workId={work.id} activeTab={activeTab} activeSubview={activeSubview} items={availableSubviews} /> : null}

      <div id="work-360-content">
      {activeTab === "resumen" && query.modo !== "configuracion" ? (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="grid gap-4">
            <Section title="Próxima acción">
              <Notice tone={nextAction.tone === "danger" ? "danger" : nextAction.tone === "warning" ? "warning" : "info"} description={nextAction.label} />
            </Section>
            <Section title="Riesgos">
              {risks.length ? (
                <div className="grid gap-3">
                  {risks.map((risk) => <Risk key={risk.key} risk={risk} />)}
                </div>
              ) : (
                <OperationalSetupPanel title="Control preventivo al día" description="Los datos actuales no activan alertas de margen, cobro, materiales o fechas vencidas." count={0} countLabel="alertas calculadas" icon={ShieldCheck} items={["Margen y costes revisados con datos autorizados.", "Vencimientos y materiales permanecen monitorizados.", "Orqena IA sólo propondrá acciones con confirmación humana."]} />
              )}
            </Section>
          </section>
          <aside className="grid gap-4">
            <Section title="Estado operativo">
              <InfoGrid rows={[
                ["Estado", status.label],
                ["Prioridad", priority.label],
                ["Responsable", work.responsable ?? "Sin asignar"],
                ["Comercial", work.comercial ?? "Sin asignar"],
                ["Jefe de obra", work.jefeObra ?? "Sin asignar"],
                ["Inicio previsto", formatDate(work.fechaInicioPrevista ?? work.fechaInicio)],
                ["Inicio real", formatDate(work.fechaInicioReal)],
                ["Fin previsto", formatDate(work.fechaFinPrevista)],
                ["Fin real", formatDate(work.fechaFinReal)]
              ]} />
              <div className="mt-3 flex flex-wrap gap-2">
                <WorkStatusButton id={work.id} estado="en_curso" label="Iniciar" />
                <WorkStatusButton id={work.id} estado="pendiente_material" label="Bloquear por material" />
                <WorkStatusButton id={work.id} estado="finalizada" label="Finalizar" />
                <WorkStatusButton id={work.id} estado="archivada" label="Archivar" />
              </div>
            </Section>
            <Section title="Actividad reciente">
              <TimelineList items={timeline.slice(0, 5)} />
            </Section>
          </aside>
        </div>
      ) : null}

      {activeTab === "resumen" && query.modo !== "configuracion" ? <div className="mt-4 grid gap-4"><EntityWorkflowSummary clientId={work.clienteId} workId={work.id} /></div> : null}
      {activeTab === "resumen" && query.modo === "configuracion" ? <div className="grid gap-4"><ClientTab work={work} /><AiTab work={work} financial={financial} risks={risks} openInvoices={openInvoices.length} pendingMaterials={pendingMaterials.length} documents={documents.length} /><ConfigTab work={work} /></div> : null}
      {activeTab === "partes" ? <PartsWorkspace work={work} timeline={timeline} subview={activeSubview} mode={query.modo === "galeria" ? "galeria" : "cronologia"} /> : null}
      {activeTab === "costes" ? <CostsWorkspace work={work} financial={financial} pendingMaterials={pendingMaterials.length} subview={activeSubview} /> : null}
      {activeTab === "facturacion" ? <BillingWorkspace work={work} treasury={treasury} financial={financial} subview={activeSubview} /> : null}
      {activeTab === "planificacion" ? <PlanningWorkspace work={work} tasks={workTasks} canManageTasks={taskManageAccess.allowed} subview={activeSubview} /> : null}
      {activeTab === "documentos" ? <DocumentsWorkspace work={work} documents={documents} subview={activeSubview} /> : null}
      {activeTab === "equipo" ? <TeamWorkspace work={work} subview={activeSubview} /> : null}
      {activeTab === "incidencias" ? <IncidentsTab work={work} risks={risks} /> : null}
      </div>
    </RecordWorkspace>
  );
}

function ProjectBudgetWorkDetail({ work, consumed }: { work: { id: string; titulo: string; tipoTrabajo: string; direccion: string; estado: string; codigo: string | null; numeroInterno: string | null; presupuestoAprobado: number; costePrevisto: number; client: { nombre: string } }; consumed: number }) {
  const available = work.presupuestoAprobado - consumed;
  const deviation = consumed - work.costePrevisto;
  return <RecordWorkspace><ParentNavigation href="/obras" label="Obras" context={work.client.nombre} /><PageHeader eyebrow={work.codigo ?? work.numeroInterno ?? "Control de proyecto"} title={work.titulo} description={`${work.client.nombre} · ${work.tipoTrabajo} · ${work.direccion}`} badge={<StatusBadge status={work.estado} />} /><section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Control presupuestario autorizado"><Kpi icon={Euro} label="Presupuesto operativo" value={formatCurrency(work.presupuestoAprobado)} detail="Límite aprobado"/><Kpi icon={ClipboardList} label="Comprometido" value={formatCurrency(work.costePrevisto)} detail="Coste previsto"/><Kpi icon={WalletCards} label="Consumido" value={formatCurrency(consumed)} detail="Coste registrado"/><Kpi icon={BadgeEuro} label="Disponible" value={formatCurrency(available)} detail="Sin previsiones inventadas" tone={available < 0 ? "danger" : "success"}/><Kpi icon={AlertTriangle} label="Desviación" value={formatCurrency(deviation)} detail="Consumido menos comprometido" tone={deviation > 0 ? "warning" : "success"}/></section></RecordWorkspace>;
}

function RestrictedWorkDetail({ work }: { work: { id: string; titulo: string; tipoTrabajo: string; direccion: string; estado: string; codigo: string | null; numeroInterno: string | null; client: { nombre: string } } }) {
  return <RecordWorkspace><EntityHeader back={<ParentNavigation href="/obras" label="Trabajos" context={work.client.nombre} />} context={work.codigo ?? work.numeroInterno ?? "Trabajo"} title={work.titulo} description={`${work.client.nombre} · ${work.tipoTrabajo} · ${work.direccion}`} status={<StatusBadge status={work.estado} />} /><Notice className="mt-4" tone="info" title="Información económica restringida" description="Tu perfil puede consultar el trabajo, pero no presupuestos, facturas, cobros, gastos ni tesorería." /></RecordWorkspace>;
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
    [`/gestion?tipo=documento&clientId=${clientId}&workId=${workId}&category=otro&returnTo=${returnTo}`, "Añadir documento", FileArchive],
    [`/gestion?tipo=notaInterna&clientId=${clientId}&workId=${workId}&returnTo=${returnTo}`, "Añadir nota", ClipboardList],
    [`/gestion?tipo=recordatorio&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear recordatorio", Bell],
    [`/capataz`, "Abrir chat IA", Bot]
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
      </div>
    </details>
  );
}

function WorkSubnavigation({ workId, activeTab, activeSubview, items }: { workId: string; activeTab: string; activeSubview: string; items: readonly [string, string][] }) {
  return (
    <nav className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" aria-label={`Vistas de ${activeTab}`}>
      {items.map(([id, label]) => <Link key={id} href={`/obras/${workId}?vista=${activeTab}&subvista=${id}`} aria-current={activeSubview === id ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold ${activeSubview === id ? "bg-brand-soft text-brand-strong" : "text-content-secondary hover:bg-subtle hover:text-content"}`}>{label}</Link>)}
    </nav>
  );
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

function ContactsTab({ work }: { work: WorkDetail }) {
  const rows: Array<[string, string]> = [
    ["Contacto de obra", work.contact ? `${work.contact.nombre}${work.contact.apellidos ? ` ${work.contact.apellidos}` : ""}` : work.contactoPrincipal ?? work.client.contactoPrincipalNombre ?? "No registrado"],
    ["Teléfono obra", work.contact?.telefono ?? work.contactoTelefono ?? work.client.contactoPrincipalTelefono ?? work.client.telefono ?? "No registrado"],
    ["Email obra", work.contact?.email ?? work.contactoEmail ?? work.client.contactoPrincipalEmail ?? work.client.email ?? "No registrado"],
    ["Facturación", work.client.contactoFacturacionNombre ?? "No registrado"],
    ["Email facturación", work.client.emailFacturacion ?? "No registrado"],
    ["Teléfono facturación", work.client.telefonoFacturacion ?? "No registrado"]
  ];
  return (
    <Section title="Contactos">
      <InfoGrid rows={rows} />
      <Link href={`/gestion?tipo=contacto&clientId=${work.clienteId}&returnTo=/obras/${work.id}?tab=contactos`} className="secondary-button mt-4 inline-flex">Añadir contacto</Link>
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
  const dependencyRows = tasks.flatMap((task) => task.dependencies.map((dependency) => ({ dependency, task })));
  const completed = tasks.filter((task) => task.status === "completed").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const withDependencies = tasks.filter((task) => task.dependencies.length > 0).length;
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
                <InfoGrid rows={[["Estado", statusLabel(focusTask.status)], ["Inicio", formatDate(focusTask.startsAt)], ["Vencimiento", formatDate(focusTask.dueAt)], ["Dependencias", String(focusTask.dependencies.length)]]} />
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

function PlanningWorkspace({ work, tasks, canManageTasks, subview }: { work: WorkDetail; tasks: WorkTask[]; canManageTasks: boolean; subview: string }) {
  if (["dependencias", "ruta-critica"].includes(subview)) return <PlanningDependencyWorkspace work={work} tasks={tasks} canManageTasks={canManageTasks} mode={subview === "dependencias" ? "dependencies" : "critical-path"} />;
  if (subview === "recursos") return <div className="grid gap-4"><PeopleTab work={work} /><MaterialsTab materials={work.materials} pendingCount={work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado)).length} workId={work.id} /></div>;
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
  const metricPanel = <Section title="Control de costes autorizado"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Finance label="Presupuestado" value={financial.budgeted} /><Finance label="Coste previsto" value={financial.forecastCost} /><Finance label="Gasto real" value={financial.realCost} /><Finance label="Desviación" value={financial.deviation} tone={financial.deviation > 0 ? "danger" : "success"} /><Finance label="Beneficio" value={financial.benefit} tone={financial.benefit < 0 ? "danger" : "success"} /><PlainMetric label="Margen" value={`${financial.marginPercent.toFixed(1)} %`} tone={financial.marginPercent < 15 ? "warning" : "neutral"} /></div></Section>;
  return <div className="grid gap-4">{metricPanel}{["estructura", "proveedores", "comparativa", "analisis", "resumen"].includes(subview) ? <CardsTab items={work.expenses} empty="No hay gastos registrados para esta vista." render={(expense) => <ExpenseCard key={expense.id} expense={expense} />} /> : null}</div>;
}

function BillingWorkspace({ work, treasury, financial, subview }: { work: WorkDetail; treasury: Awaited<ReturnType<typeof getEconomicControl>>; financial: ReturnType<typeof calculateWorkFinancials>; subview: string }) {
  const metrics = <Section title="Facturación y cobros autorizados"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Finance label="Presupuestado" value={financial.budgeted} /><Finance label="Facturado" value={financial.invoiced} /><Finance label="Cobrado" value={financial.paid} /><Finance label="Pendiente" value={financial.pending} tone={financial.pending ? "warning" : "neutral"} /></div></Section>;
  if (subview === "facturas") return <div className="grid gap-4">{metrics}<CardsTab items={work.invoices} empty="No hay facturas asociadas." render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /></div>;
  if (subview === "cobros") return <div className="grid gap-4">{metrics}<CardsTab items={work.payments} empty="Cobros preparados para esta obra" render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /><WorkTreasuryTab treasury={treasury} workId={work.id} /></div>;
  if (subview === "vencimientos") return <div className="grid gap-4">{metrics}<Section title="Calendario de vencimientos"><div className="grid gap-2">{work.invoices.length ? work.invoices.map((invoice) => <Link key={invoice.id} href={`/dinero/${invoice.id}`} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs"><span className="truncate font-bold text-content">{invoice.numero} · {invoice.concepto}</span><span className="text-content-secondary">{formatDate(invoice.fechaVencimiento)}</span><span className="font-bold text-content">{formatCurrency(Math.max(0, invoice.total - invoicePaid(invoice)))}</span></Link>) : <OperationalSetupPanel title="Calendario de cobro preparado" description="Las facturas aparecerán ordenadas por fecha de vencimiento cuando se registren." count={0} countLabel="vencimientos" icon={CalendarClock} items={["Cada vencimiento conserva su factura de origen.", "El pendiente se calcula con cobros registrados.", "No se muestran fechas o importes simulados."]} compact />}</div></Section></div>;
  if (subview === "historico") return <div className="grid gap-4">{metrics}<CardsTab items={work.invoices} empty="Histórico de facturación preparado" render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /><CardsTab items={work.payments} empty="Histórico de cobros preparado" render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /></div>;
  if (["certificaciones", "hitos", "retenciones"].includes(subview)) return <div className="grid gap-4">{metrics}<OperationalSetupPanel title={subview === "certificaciones" ? "Certificaciones de obra" : subview === "hitos" ? "Hitos facturables" : "Retenciones contractuales"} description="La vista está preparada para operar con documentos vinculados y mantiene el control económico actual como autoridad." count={subview === "hitos" ? work.budgets.length : work.invoices.length} countLabel="documentos de referencia" icon={Receipt} items={["El documento de origen permanece enlazado a la obra.", "Importes, vencimientos y estados se toman del registro autorizado.", "La emisión o cambio de estado exige confirmación humana."]} action={<Link href={`/gestion?tipo=${subview === "certificaciones" ? "documento" : "factura"}&clientId=${work.clienteId}&workId=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=facturacion&subvista=${subview}`)}`} className="primary-button">Registrar documento</Link>} /></div>;
  return <div className="grid gap-4">{metrics}<CardsTab items={work.budgets} empty="No hay presupuestos asociados." render={(budget) => <BudgetCard key={budget.id} budget={budget} />} /><CardsTab items={work.invoices} empty="No hay facturas asociadas." render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /><CardsTab items={work.payments} empty="No hay cobros registrados en esta obra." render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /><WorkTreasuryTab treasury={treasury} workId={work.id} /></div>;
}

function DocumentsWorkspace({ work, documents, subview }: { work: WorkDetail; documents: ReturnType<typeof buildWorkDocuments>; subview: string }) {
  if (subview === "galeria") return <Section title={`Galería y portada · ${work.photos.length}`}><WorkProgressGallery photos={workPhotoGallery(work)} /></Section>;
  const category = subview === "documentos" ? null : subview;
  const filtered = category ? documents.filter((document) => document.type.toLowerCase().includes(category.slice(0, -1))) : documents;
  return <DocumentsTab documents={filtered} workId={work.id} clientId={work.clienteId} />;
}

function TeamWorkspace({ work, subview }: { work: WorkDetail; subview: string }) {
  if (subview === "carga") return <HoursTab work={work} />;
  if (subview === "subcontratas") return <SubcontractTab work={work} expenses={work.expenses} />;
  if (["turnos", "formacion", "permisos"].includes(subview)) return <div className="grid gap-4"><PeopleTab work={work} /><OperationalSetupPanel title={subview === "turnos" ? "Cobertura de turnos" : subview === "formacion" ? "Formación y aptitudes" : "Permisos del equipo"} description="Organiza esta capa operativa sobre las personas vinculadas a la obra, sin crear identidades o habilitaciones ficticias." count={[work.responsable, work.comercial, work.jefeObra].filter(Boolean).length} countLabel="responsables vinculados" icon={Users} items={["Cada persona conserva su rol y relación real con la obra.", "Los cambios quedan preparados para revisión del responsable.", "La ausencia de datos se muestra como cobertura pendiente, no como dato supuesto."]} action={<Link href={`/gestion?tipo=obra&id=${work.id}&returnTo=${encodeURIComponent(`/obras/${work.id}?vista=equipo&subvista=${subview}`)}`} className="primary-button">Configurar equipo</Link>} /></div>;
  return <div className="grid gap-4"><ContactsTab work={work} /><PeopleTab work={work} /></div>;
}

function workPhotoGallery(work: WorkDetail) {
  return work.photos.filter((photo): photo is typeof photo & { url: string } => typeof photo.url === "string" && (photo.url.startsWith("/") || photo.url.startsWith("https://"))).map((photo) => ({ id: photo.id, title: photo.titulo, url: photo.url, category: photo.categoria.replaceAll("_", " "), date: formatDate(photo.tomadaEn), author: photo.autor, notes: photo.notas }));
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
  const button = estado === "archivada" ? (
    <ConfirmSubmitButton
      className="danger-button"
      message="El trabajo se marcará como archivado. Su historial, documentos e importes se conservarán."
    >
      {label}
    </ConfirmSubmitButton>
  ) : (
    <button className="secondary-button" type="submit">{label}</button>
  );

  return (
    <form action={updateWorkStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      {button}
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
