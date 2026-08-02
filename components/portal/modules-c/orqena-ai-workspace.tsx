import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSearch,
  Gauge,
  History,
  ListTodo,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";
import styles from "./orqena-ai-workspace.module.css";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import {
  resolveAuthorization,
  resolveScopedEntityIds,
  resolveScopedTaskIds,
} from "@/lib/commercial/authorization";
import { readRuntimeAiControl } from "@/lib/ai/runtime-gateway";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";

export const orqenaAiAreas = [
  "comercial",
  "operaciones",
  "finanzas",
  "documentos",
  "equipo",
] as const;

export type OrqenaAiArea = "general" | (typeof orqenaAiAreas)[number];

type Metric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "green" | "violet" | "blue" | "amber";
  href?: string;
};

type QueueRow = {
  id: string;
  title: string;
  context: string;
  meta: string;
  status: string;
  href?: string;
  requiresConfirmation?: boolean;
};

type AreaMeta = { label: string; description: string; queueTitle: string; contextTitle: string; automationTitle: string };

type BudgetView = { id: string; numero: string; titulo: string; total: number; margenEstimado: number; estado: string; fechaSeguimiento: Date | null; client: { nombre: string }; work: { titulo: string } | null };
type WorkView = { id: string; titulo: string; estado: string; prioridad: string; responsable: string | null; fechaFinPrevista: Date | null };
type TaskView = { id: string; title: string; category: string; status: string; priority: string; assigneeId: string | null; estimatedMinutes: number | null; dueAt: Date | null; blockedReason: string | null; workId: string | null; clientId: string | null };
type DocumentView = { id: string; name: string; category: string; status: string; extractionStatus: string; extractionConfidence: number | null; extractedIssuer: string | null; extractedInvoiceNo: string | null; extractedTotal: number | null; processedAt: Date | null; updatedAt: Date; work: { titulo: string } | null; client: { nombre: string } | null };
type InvoiceView = { id: string; numero: string; concepto: string; total: number; pagado: number; pendiente: number; estado: string; fechaVencimiento: Date; client: { nombre: string }; work: { titulo: string } | null };
type MembershipView = { id: string; role: string; functionalProfileKey: string | null; lastActivityAt: Date | null; user: { id: string; displayName: string; email: string; lastLoginAt: Date | null } };
type ClientView = { id: string; nombre: string; estado: string; ultimaInteraccion: Date | null };

const areaMeta: Record<OrqenaAiArea, AreaMeta> = {
  general: {
    label: "Todos",
    description: "Centro de recomendaciones, automatización supervisada y contexto autorizado para tu empresa.",
    queueTitle: "Bandeja inteligente",
    contextTitle: "Contexto y aprendizaje",
    automationTitle: "Automatizaciones configuradas",
  },
  comercial: {
    label: "Comercial",
    description: "Oportunidades, presupuestos y siguientes pasos dentro de tu alcance comercial.",
    queueTitle: "Pipeline inteligente",
    contextTitle: "Contexto comercial",
    automationTitle: "Automatizaciones comerciales",
  },
  operaciones: {
    label: "Operaciones",
    description: "Trabajo, tareas y bloqueos visibles para tu rol, sin reasignaciones automáticas.",
    queueTitle: "Cola operativa priorizada",
    contextTitle: "Contexto operativo",
    automationTitle: "Automatizaciones para operaciones",
  },
  documentos: {
    label: "Documentos",
    description: "Revisión documental con extracción trazable y confirmación humana.",
    queueTitle: "Cola de revisión de documentos",
    contextTitle: "Contexto documental",
    automationTitle: "Automatizaciones documentales",
  },
  finanzas: {
    label: "Finanzas",
    description: "Cobros, vencimientos y riesgos financieros sólo cuando tus permisos lo permiten.",
    queueTitle: "Recomendaciones financieras",
    contextTitle: "Contexto financiero",
    automationTitle: "Automatizaciones financieras",
  },
  equipo: {
    label: "Equipo",
    description: "Coordinación agregada de personas y tareas sin ampliar permisos ni exponer datos ajenos.",
    queueTitle: "Recomendaciones para tu equipo",
    contextTitle: "Contexto y análisis del equipo",
    automationTitle: "Automatizaciones para tu equipo",
  },
};

const areaSources: Record<Exclude<OrqenaAiArea, "general">, Set<string>> = {
  comercial: new Set(["crm", "presupuestos", "visitas", "recordatorios"]),
  operaciones: new Set(["obras", "agenda", "materiales"]),
  documentos: new Set(["documentos", "datos"]),
  finanzas: new Set(["facturas", "cobros", "tesoreria", "rentabilidad", "gastos"]),
  equipo: new Set(["agenda", "obras"]),
};

export async function OrqenaAiWorkspace({ area }: { area: OrqenaAiArea }) {
  const auth = await requireCompanyContext();
  const [useDecision, executeDecision, clientsDecision, workDecision, budgetDecision, pricingDecision, invoiceDecision, reportsDecision, documentsDecision, tasksDecision, membersDecision, automationDecision] = await Promise.all([
    resolveAuthorization(auth, "orqena.use"),
    resolveAuthorization(auth, "orqena.execute"),
    resolveAuthorization(auth, "clients.view"),
    resolveAuthorization(auth, "work.view"),
    resolveAuthorization(auth, "sales.budgets.view"),
    resolveAuthorization(auth, "sales.pricing.view"),
    resolveAuthorization(auth, "sales.invoices.view"),
    resolveAuthorization(auth, "reports.view"),
    resolveAuthorization(auth, "documents.view"),
    resolveAuthorization(auth, "tasks.view"),
    resolveAuthorization(auth, "company.members.view"),
    resolveAuthorization(auth, "company.update"),
  ]);

  if (!useDecision.allowed) {
    return (
      <main className="screen">
        <h1 className="type-page-title">Orqena IA</h1>
        <div className="card mt-5 max-w-2xl p-6">
          <LockKeyhole className="text-slate-500" size={28} aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black text-obra-ink">Acceso no disponible</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tu perfil no tiene acceso a Orqena IA en esta empresa. No se han consultado datos de negocio.</p>
        </div>
      </main>
    );
  }

  const canSeeBudgets = budgetDecision.allowed && pricingDecision.allowed;
  const canSeeFinance = invoiceDecision.allowed && reportsDecision.allowed;
  const [clientIds, workIds, budgetWorkIds, budgetClientIds, pricingWorkIds, pricingClientIds, invoiceWorkIds, invoiceClientIds, documentIds, taskIds, portalManifest] = await Promise.all([
    clientsDecision.allowed ? resolveScopedEntityIds(auth, "clients.view", "Client") : Promise.resolve([]),
    workDecision.allowed ? resolveScopedEntityIds(auth, "work.view", "Work") : Promise.resolve([]),
    canSeeBudgets ? resolveScopedEntityIds(auth, "sales.budgets.view", "Work") : Promise.resolve([]),
    canSeeBudgets ? resolveScopedEntityIds(auth, "sales.budgets.view", "Client") : Promise.resolve([]),
    canSeeBudgets ? resolveScopedEntityIds(auth, "sales.pricing.view", "Work") : Promise.resolve([]),
    canSeeBudgets ? resolveScopedEntityIds(auth, "sales.pricing.view", "Client") : Promise.resolve([]),
    canSeeFinance ? resolveScopedEntityIds(auth, "sales.invoices.view", "Work") : Promise.resolve([]),
    canSeeFinance ? resolveScopedEntityIds(auth, "sales.invoices.view", "Client") : Promise.resolve([]),
    documentsDecision.allowed ? resolveScopedEntityIds(auth, "documents.view", "Document") : Promise.resolve([]),
    tasksDecision.allowed ? resolveScopedTaskIds(auth, "tasks.view") : Promise.resolve([]),
    documentsDecision.allowed ? buildPortalManifest(auth) : Promise.resolve(null),
  ]);

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const activeWorkStates = ["planificada", "preparacion", "pendiente_inicio", "en_curso", "pausada", "pendiente_material", "pendiente_cliente", "parada", "pendiente_remates"] as const;
  const openBudgetStates = ["borrador", "pendiente_revision", "enviado", "visto", "pendiente_respuesta"] as const;
  const openInvoiceStates = ["emitida", "enviada", "pendiente", "pendiente_pago", "parcialmente_pagada", "vencida", "reclamada"] as const;
  const openTaskStates = ["inbox", "planned", "in_progress", "blocked", "waiting"] as const;

  const [clients, works, budgets, invoices, documents, tasks, memberships, recommendations, automations, pendingConfirmations, aiUsage, recentAi, aiPolicy] = await Promise.all([
    clientsDecision.allowed
      ? prisma.client.findMany({ where: { companyId: auth.companyId, archivadoAt: null, ...idScope(clientIds) }, orderBy: { ultimaInteraccion: "asc" }, take: 100, select: { id: true, nombre: true, estado: true, ultimaInteraccion: true } })
      : Promise.resolve([]),
    workDecision.allowed
      ? prisma.work.findMany({ where: { companyId: auth.companyId, archivada: false, estado: { in: [...activeWorkStates] }, ...idScope(workIds) }, orderBy: [{ prioridad: "desc" }, { updatedAt: "desc" }], take: 100, select: { id: true, titulo: true, estado: true, prioridad: true, responsable: true, fechaFinPrevista: true } })
      : Promise.resolve([]),
    canSeeBudgets
      ? prisma.budget.findMany({ where: { companyId: auth.companyId, estado: { in: [...openBudgetStates] }, AND: [relationScope(budgetDecision.scope, budgetWorkIds, budgetClientIds), relationScope(pricingDecision.scope, pricingWorkIds, pricingClientIds)] }, orderBy: { fechaCreacion: "desc" }, take: 100, select: { id: true, numero: true, titulo: true, total: true, margenEstimado: true, estado: true, fechaSeguimiento: true, client: { select: { nombre: true } }, work: { select: { titulo: true } } } })
      : Promise.resolve([]),
    canSeeFinance
      ? prisma.invoice.findMany({ where: { companyId: auth.companyId, estado: { in: [...openInvoiceStates] }, ...relationScope(invoiceDecision.scope, invoiceWorkIds, invoiceClientIds) }, orderBy: { fechaVencimiento: "asc" }, take: 100, select: { id: true, numero: true, concepto: true, total: true, pagado: true, pendiente: true, estado: true, fechaVencimiento: true, client: { select: { nombre: true } }, work: { select: { titulo: true } } } })
      : Promise.resolve([]),
    documentsDecision.allowed
      ? prisma.document.findMany({ where: { companyId: auth.companyId, archivedAt: null, classification: { in: portalManifest?.documentClasses ?? [] }, ...idScope(documentIds) }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, category: true, status: true, extractionStatus: true, extractionConfidence: true, extractedIssuer: true, extractedInvoiceNo: true, extractedTotal: true, processedAt: true, updatedAt: true, work: { select: { titulo: true } }, client: { select: { nombre: true } } } })
      : Promise.resolve([]),
    tasksDecision.allowed
      ? prisma.task.findMany({ where: { companyId: auth.companyId, archivedAt: null, status: { in: [...openTaskStates] }, ...idScope(taskIds) }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 100, select: { id: true, title: true, category: true, status: true, priority: true, assigneeId: true, estimatedMinutes: true, dueAt: true, blockedReason: true, workId: true, clientId: true } })
      : Promise.resolve([]),
    membersDecision.allowed
      ? prisma.companyMembership.findMany({ where: { companyId: auth.companyId, status: "active" }, orderBy: { lastActivityAt: "desc" }, take: 100, select: { id: true, role: true, functionalProfileKey: true, lastActivityAt: true, user: { select: { id: true, displayName: true, email: true, lastLoginAt: true } } } })
      : Promise.resolve([]),
    executeDecision.allowed
      ? prisma.businessRecommendation.findMany({ where: { companyId: auth.companyId, status: { in: ["active", "viewed", "accepted", "in_progress", "failed"] } }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 250, select: { id: true, title: true, summary: true, source: true, status: true, priority: true, amount: true, requiresConfirmation: true, clientId: true, workId: true, invoiceId: true, budgetId: true, updatedAt: true } })
      : Promise.resolve([]),
    automationDecision.allowed
      ? prisma.automationDefinition.findMany({ where: { companyId: auth.companyId, archivedAt: null }, orderBy: [{ active: "desc" }, { updatedAt: "desc" }], take: 100, select: { id: true, name: true, category: true, status: true, active: true, updatedAt: true, currentVersion: { select: { requiresConfirmation: true } }, schedule: { select: { nextRunAt: true } } } })
      : Promise.resolve([]),
    automationDecision.allowed
      ? prisma.automationRun.count({ where: { companyId: auth.companyId, status: "waiting_confirmation" } })
      : Promise.resolve(0),
    executeDecision.allowed
      ? prisma.aiUsageEvent.count({ where: { companyId: auth.companyId, createdAt: { gte: monthStart } } })
      : Promise.resolve(0),
    executeDecision.allowed
      ? prisma.aiUsageEvent.findMany({ where: { companyId: auth.companyId }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, purpose: true, outcome: true, humanReviewed: true, createdAt: true } })
      : Promise.resolve([]),
    prisma.companyAiPolicy.findUnique({ where: { companyId: auth.companyId }, select: { enabled: true, killSwitch: true, humanReviewRequired: true } }),
  ]);

  const runtime = safeAiRuntime(auth.companyId);
  const visibleInvoiceIds = invoices.map((item) => item.id);
  const visibleBudgetIds = budgets.map((item) => item.id);
  const visibleRecommendations = recommendations.filter((item) => recommendationVisible(item, {
    area,
    clientIds,
    workIds,
    canSeeClients: clientsDecision.allowed,
    canSeeWorks: workDecision.allowed,
    invoiceIds: visibleInvoiceIds,
    budgetIds: visibleBudgetIds,
    canSeeInvoices: canSeeFinance,
    canSeeBudgets,
    canSeeFinance,
    canSeeDocuments: documentsDecision.allowed,
    canSeeOperations: workDecision.allowed || tasksDecision.allowed,
    canSeeCommercial: clientsDecision.allowed || canSeeBudgets,
    canSeeMembers: membersDecision.allowed,
  }));
  const queue = buildQueue(area, { recommendations: visibleRecommendations, clients, budgets, works, tasks, documents, invoices, memberships });
  const visibleAutomations = filterAreaAutomations(area, automations);
  const visibleAiActivity = filterAreaActivity(area, recentAi);
  const metrics = buildMetrics(area, {
    recommendations: visibleRecommendations.length,
    confirmedRecommendations: visibleRecommendations.filter((item) => ["accepted", "in_progress"].includes(item.status)).length,
    recordedImpact: visibleRecommendations.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    clients: clients.length,
    works: works.length,
    budgets,
    invoices,
    documents,
    tasks,
    memberships,
    automations: visibleAutomations,
    pendingConfirmations,
    aiUsage,
    access: {
      recommendations: executeDecision.allowed,
      clients: clientsDecision.allowed,
      works: workDecision.allowed,
      budgets: canSeeBudgets,
      finance: canSeeFinance,
      documents: documentsDecision.allowed,
      tasks: tasksDecision.allowed,
      members: membersDecision.allowed,
      automations: automationDecision.allowed,
    },
  });
  const meta = areaMeta[area];
  const originLink = resolveOriginLink(area, {
    recommendations: executeDecision.allowed,
    clients: clientsDecision.allowed,
    budgets: canSeeBudgets,
    works: workDecision.allowed,
    tasks: tasksDecision.allowed,
    documents: documentsDecision.allowed,
    finance: canSeeFinance,
    members: membersDecision.allowed,
  });

  const currentDate = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <main className={styles.workspace} data-orqena-ai-workspace={area}>
      <header className={styles.headingRow}>
        <div className={styles.heading}>
          <h1>Orqena IA</h1>
          <p>{meta.description}</p>
        </div>
      </header>

      <div className={styles.navigationRow}>
        <nav className={styles.tabs} aria-label="Áreas de Orqena IA">
          <AreaTab href="/orqena-ia" active={area === "general"}>Todos</AreaTab>
          {orqenaAiAreas.map((item) => (
            <AreaTab key={item} href={`/orqena-ia/${item}`} active={area === item}>
              {areaMeta[item].label}
            </AreaTab>
          ))}
        </nav>
        <div className={styles.navActions}>
          <span className={styles.navAction}><CalendarDays size={14} aria-hidden="true" />{currentDate}</span>
          {executeDecision.allowed ? (
            <Link href="/recomendaciones" className={styles.navAction}>
              <History size={14} aria-hidden="true" />Historial de recomendaciones
            </Link>
          ) : null}
        </div>
      </div>

      <section
        className={styles.metrics}
        style={{ "--metric-count": metrics.length } as React.CSSProperties}
        aria-label="Indicadores reales de la vista"
      >
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <AreaPrimary
        area={area}
        meta={meta}
        queue={queue}
        budgets={budgets}
        works={works}
        tasks={tasks}
        documents={documents}
        invoices={invoices}
        memberships={memberships}
        automations={visibleAutomations}
        automationAllowed={automationDecision.allowed}
        originLink={originLink}
      />

      <AreaSecondary
        area={area}
        companyName={auth.companyName}
        scope={scopeLabel(useDecision.scope)}
        aiEnabled={Boolean(aiPolicy?.enabled && !aiPolicy.killSwitch)}
        runtime={runtime}
        clients={clients}
        works={works}
        budgets={budgets}
        invoices={invoices}
        documents={documents}
        tasks={tasks}
        memberships={memberships}
        activity={visibleAiActivity.slice(0, 5)}
        activityAllowed={executeDecision.allowed}
      />
    </main>
  );
}

function AreaPrimary({ area, meta, queue, budgets, works, tasks, documents, invoices, memberships, automations, automationAllowed, originLink }: {
  area: OrqenaAiArea;
  meta: AreaMeta;
  queue: QueueRow[];
  budgets: BudgetView[];
  works: WorkView[];
  tasks: TaskView[];
  documents: DocumentView[];
  invoices: InvoiceView[];
  memberships: MembershipView[];
  automations: AreaAutomation[];
  automationAllowed: boolean;
  originLink: string | null;
}) {
  return (
    <div className={styles.primaryGrid} data-area={area}>
      <section className={styles.panel} aria-labelledby="orqena-queue-title">
        <SectionHeading icon={Sparkles} id="orqena-queue-title" title={meta.queueTitle} meta={queueCountLabel(area, { queue, budgets, tasks, documents, invoices, memberships })} />
        <div className={styles.tableViewport}>
          <AreaTable area={area} queue={queue} budgets={budgets} works={works} tasks={tasks} documents={documents} invoices={invoices} memberships={memberships} />
        </div>
        {originLink ? <PanelFooter href={originLink}>{originFooterLabel(area)}</PanelFooter> : null}
      </section>
      <AutomationPanel title={meta.automationTitle} items={automations} allowed={automationAllowed} />
    </div>
  );
}

function AreaTable({ area, queue, budgets, works, tasks, documents, invoices, memberships }: {
  area: OrqenaAiArea;
  queue: QueueRow[];
  budgets: BudgetView[];
  works: WorkView[];
  tasks: TaskView[];
  documents: DocumentView[];
  invoices: InvoiceView[];
  memberships: MembershipView[];
}) {
  if (area === "comercial") return <DenseTable
    label="Pipeline comercial autorizado"
    columns={["Presupuesto", "Cliente / trabajo", "Seguimiento", "Margen", "Importe", "Estado", "Acción"]}
    rows={budgets.slice(0, 5).map((item) => ({
      id: item.id,
      cells: [
        <strong key="budget">{item.numero}<small>{item.titulo}</small></strong>,
        <span key="client">{item.client.nombre}<small>{item.work?.titulo ?? "Sin trabajo vinculado"}</small></span>,
        item.fechaSeguimiento ? formatDateTime(item.fechaSeguimiento) : "Sin fecha",
        formatPercent(item.margenEstimado),
        formatCurrencyCompact(item.total),
        <StatusBadge key="status" value={item.estado} />,
        <RowAction key="action" href={`/presupuestos/${item.id}`}>Revisar</RowAction>,
      ],
    }))}
    empty="No hay presupuestos abiertos dentro de tu alcance."
  />;

  if (area === "operaciones") return <DenseTable
    label="Cola operativa autorizada"
    columns={["Tarea", "Trabajo / contexto", "Bloqueo", "Responsable", "Vencimiento", "Prioridad", "Estado", "Acción"]}
    rows={tasks.slice(0, 5).map((item) => {
      const work = works.find((candidate) => candidate.id === item.workId);
      const member = memberships.find((candidate) => candidate.user.id === item.assigneeId);
      return {
        id: item.id,
        cells: [
          <strong key="task">{item.title}<small>{humanize(item.category)}</small></strong>,
          work?.titulo ?? "Tarea interna",
          item.blockedReason ?? "Sin bloqueo registrado",
          member?.user.displayName ?? work?.responsable ?? "Sin asignar",
          item.dueAt ? formatDateTime(item.dueAt) : "Sin fecha",
          <StatusBadge key="priority" value={item.priority} />,
          <StatusBadge key="status" value={item.status} />,
          <RowAction key="action" href={`/tareas/${item.id}`}>Resolver</RowAction>,
        ],
      };
    })}
    empty="No hay tareas abiertas dentro de tu alcance."
  />;

  if (area === "documentos") return <DenseTable
    label="Cola documental autorizada"
    columns={["Documento", "Tipo", "Proveedor / cliente", "Datos extraídos", "Revisión", "Confianza", "Trabajo", "Acción"]}
    rows={documents.slice(0, 5).map((item) => ({
      id: item.id,
      cells: [
        <strong key="document">{item.name}<small>{item.extractedInvoiceNo ?? formatDateTime(item.updatedAt)}</small></strong>,
        humanize(item.category),
        item.extractedIssuer ?? item.client?.nombre ?? "No identificado",
        item.extractedTotal != null ? formatCurrencyCompact(item.extractedTotal) : "Sin importe",
        <StatusBadge key="extraction" value={item.extractionStatus} />,
        item.extractionConfidence == null ? "No registrada" : `${Math.round(item.extractionConfidence * 100)}%`,
        item.work?.titulo ?? "Sin vínculo",
        <RowAction key="action" href={`/documentos?documento=${encodeURIComponent(item.id)}`}>Revisar</RowAction>,
      ],
    }))}
    empty="No hay documentos dentro de las clases permitidas para tu perfil."
  />;

  if (area === "finanzas") return <DenseTable
    label="Recomendaciones y vencimientos financieros"
    columns={["Factura", "Cliente / trabajo", "Vencimiento", "Estado", "Total", "Pagado", "Pendiente", "Acción"]}
    rows={invoices.slice(0, 5).map((item) => ({
      id: item.id,
      cells: [
        <strong key="invoice">{item.numero}<small>{item.concepto}</small></strong>,
        <span key="client">{item.client.nombre}<small>{item.work?.titulo ?? "Sin trabajo vinculado"}</small></span>,
        formatDateTime(item.fechaVencimiento),
        <StatusBadge key="status" value={item.estado} />,
        formatCurrencyCompact(item.total),
        formatCurrencyCompact(item.pagado),
        formatCurrencyCompact(item.pendiente),
        <RowAction key="action" href={`/dinero/${item.id}`}>Ver detalle</RowAction>,
      ],
    }))}
    empty="No hay facturas abiertas dentro de tu alcance financiero."
  />;

  if (area === "equipo") return <DenseTable
    label="Equipo autorizado"
    columns={["Persona", "Rol", "Perfil", "Última actividad", "Tareas abiertas", "Estado", "Acción"]}
    rows={memberships.slice(0, 6).map((item) => ({
      id: item.id,
      cells: [
        <strong key="person">{item.user.displayName}<small>{maskEmail(item.user.email)}</small></strong>,
        humanize(item.role),
        humanize(item.functionalProfileKey ?? "Sin perfil funcional"),
        item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "Sin actividad",
        tasks.filter((task) => task.assigneeId === item.user.id).length,
        <StatusBadge key="status" value="Activo" />,
        <RowAction key="action" href={`/equipo?perfil=${encodeURIComponent(item.id)}`}>Ver detalle</RowAction>,
      ],
    }))}
    empty="No hay miembros activos visibles para tu perfil."
  />;

  return <DenseTable
    label="Bandeja inteligente autorizada"
    columns={["Recomendación", "Contexto", "Evidencia", "Estado", "Acción"]}
    rows={queue.slice(0, 5).map((item) => ({
      id: item.id,
      cells: [
        <strong key="recommendation">{item.title}{item.requiresConfirmation ? <small>Confirmación humana</small> : null}</strong>,
        item.context,
        item.meta,
        <StatusBadge key="status" value={item.status} />,
        item.href ? <RowAction key="action" href={item.href}>Revisar</RowAction> : "Sin acción",
      ],
    }))}
    empty="No hay recomendaciones registradas y autorizadas que requieran revisión."
  />;
}

function DenseTable({ label, columns, rows, empty }: { label: string; columns: string[]; rows: Array<{ id: string; cells: React.ReactNode[] }>; empty: string }) {
  if (!rows.length) return <HonestEmpty description={empty} />;
  return (
    <table className={styles.dataTable} aria-label={label}>
      <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${columns[index]}`}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

function RowAction({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={styles.tableAction}>{children}</Link>;
}

function StatusBadge({ value }: { value: string }) {
  const tone = /venc|fall|block|alta|failed/i.test(value) ? "danger" : /pend|wait|medio|borrador|proces/i.test(value) ? "warning" : "success";
  return <span className={styles.status} data-tone={tone}>{humanize(value)}</span>;
}

function AutomationPanel({ title, items, allowed }: { title: string; items: AreaAutomation[]; allowed: boolean }) {
  return (
    <section className={styles.panel} aria-labelledby="orqena-automations-title">
      <SectionHeading icon={Workflow} id="orqena-automations-title" title={title} meta={items.length ? `${items.length} configuradas` : undefined} />
      {items.length ? items.slice(0, 4).map((automation) => (
        <article key={automation.id} className={styles.automationRow}>
          <span className={styles.automationIcon}><Workflow size={17} aria-hidden="true" /></span>
          <div><h3>{automation.name}</h3><p>{humanize(automation.category)} · {automation.currentVersion?.requiresConfirmation ? "revisión humana obligatoria" : "controles configurados"}</p></div>
          <Link href={`/automatizaciones/${automation.id}`} className={styles.reviewLink}>Activar con revisión</Link>
        </article>
      )) : <HonestEmpty description={allowed ? "No hay automatizaciones configuradas para esta área." : "Tu perfil no puede consultar automatizaciones."} />}
      {allowed ? <PanelFooter href="/automatizaciones">Ver todas las automatizaciones</PanelFooter> : null}
    </section>
  );
}

function AreaSecondary({ area, companyName, scope, aiEnabled, runtime, clients, works, budgets, invoices, documents, tasks, memberships, activity, activityAllowed }: {
  area: OrqenaAiArea;
  companyName: string;
  scope: string;
  aiEnabled: boolean;
  runtime: boolean;
  clients: ClientView[];
  works: WorkView[];
  budgets: BudgetView[];
  invoices: InvoiceView[];
  documents: DocumentView[];
  tasks: TaskView[];
  memberships: MembershipView[];
  activity: AreaActivity[];
  activityAllowed: boolean;
}) {
  const groups = buildContextGroups(area, { companyName, scope, aiEnabled, runtime, clients, works, budgets, invoices, documents, tasks, memberships });
  return (
    <div className={styles.secondaryGrid} data-area={area}>
      <section className={styles.panel} aria-labelledby="orqena-context-title">
        <SectionHeading icon={Gauge} id="orqena-context-title" title={areaMeta[area].contextTitle} />
        <div className={styles.contextGrid}>
          {groups.map((group) => <ContextGroup key={group.title} title={group.title} rows={group.rows} href={group.href} />)}
        </div>
        <div className={styles.governance}><ShieldCheck size={16} aria-hidden="true" /><span>Contexto limitado a la empresa y al alcance del usuario. Ninguna sugerencia sensible se ejecuta sin autorización, revisión y confirmación humana.</span></div>
      </section>
      <section className={styles.panel} aria-labelledby="orqena-activity-title">
        <SectionHeading icon={Activity} id="orqena-activity-title" title="Actividad reciente de Orqena IA" />
        {activity.length ? <ol>{activity.map((event) => (
          <li key={event.id} className={styles.activityRow}>
            <time>{event.createdAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>
            <span>{humanize(event.purpose)}</span>
            <span className={styles.status}>{event.humanReviewed ? "Revisada" : humanize(event.outcome)}</span>
          </li>
        ))}</ol> : <HonestEmpty description={activityAllowed ? "Aún no hay operaciones registradas para esta área." : "Tu perfil no puede consultar esta actividad."} />}
        {activityAllowed ? <PanelFooter href="/recomendaciones?estado=all">Ver toda la actividad</PanelFooter> : null}
      </section>
    </div>
  );
}

type ContextGroupData = { title: string; rows: Array<{ label: string; value: string }>; href?: string };

function ContextGroup({ title, rows, href }: ContextGroupData) {
  return <section className={styles.contextCell}><h3>{title}</h3><dl>{rows.map((row) => <div key={`${title}-${row.label}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>{href ? <Link href={href}>Ver detalle</Link> : null}</section>;
}

function buildContextGroups(area: OrqenaAiArea, data: {
  companyName: string; scope: string; aiEnabled: boolean; runtime: boolean; clients: ClientView[]; works: WorkView[]; budgets: BudgetView[]; invoices: InvoiceView[]; documents: DocumentView[]; tasks: TaskView[]; memberships: MembershipView[];
}): ContextGroupData[] {
  if (area === "comercial") return [
    countGroup("Estados de presupuestos", data.budgets.map((item) => item.estado), "/presupuestos"),
    { title: "Clientes con seguimiento", rows: data.clients.filter((item) => item.ultimaInteraccion).slice(0, 4).map((item) => ({ label: item.nombre, value: formatDateTime(item.ultimaInteraccion!) })), href: "/clientes" },
    { title: "Importe por cliente", rows: aggregateMoney(data.budgets, (item) => item.client.nombre, (item) => item.total).slice(0, 4), href: "/presupuestos" },
    countGroup("Próximos pasos", data.budgets.map((item) => item.fechaSeguimiento ? "Con seguimiento" : "Sin seguimiento"), "/presupuestos"),
  ];
  if (area === "operaciones") return [
    countGroup("Estado de trabajos", data.works.map((item) => item.estado), "/obras"),
    countGroup("Prioridad de tareas", data.tasks.map((item) => item.priority), "/tareas"),
    countGroup("Cuellos de botella", data.tasks.map((item) => item.blockedReason ?? "Sin bloqueo"), "/tareas"),
    countGroup("Tipos de tarea", data.tasks.map((item) => item.category), "/tareas"),
  ];
  if (area === "documentos") return [
    countGroup("Categorías", data.documents.map((item) => item.category), "/documentos"),
    countGroup("Estado OCR", data.documents.map((item) => item.extractionStatus), "/documentos"),
    { title: "Calidad de extracción", rows: [
      { label: "Con confianza", value: String(data.documents.filter((item) => item.extractionConfidence != null).length) },
      { label: "Sin confianza", value: String(data.documents.filter((item) => item.extractionConfidence == null).length) },
      { label: "Procesados", value: String(data.documents.filter((item) => item.processedAt).length) },
    ], href: "/documentos" },
    { title: "Vinculación", rows: [
      { label: "Con trabajo", value: String(data.documents.filter((item) => item.work).length) },
      { label: "Con cliente", value: String(data.documents.filter((item) => item.client).length) },
      { label: "Sin vínculo", value: String(data.documents.filter((item) => !item.work && !item.client).length) },
    ], href: "/documentos" },
  ];
  if (area === "finanzas") return [
    { title: "Saldo por cliente", rows: aggregateMoney(data.invoices, (item) => item.client.nombre, (item) => item.pendiente).slice(0, 4), href: "/dinero" },
    countGroup("Estado de facturas", data.invoices.map((item) => item.estado), "/dinero"),
    { title: "Cobro registrado", rows: [
      { label: "Total abierto", value: formatCurrencyCompact(data.invoices.reduce((sum, item) => sum + item.total, 0)) },
      { label: "Pagado", value: formatCurrencyCompact(data.invoices.reduce((sum, item) => sum + item.pagado, 0)) },
      { label: "Pendiente", value: formatCurrencyCompact(data.invoices.reduce((sum, item) => sum + item.pendiente, 0)) },
    ], href: "/dinero" },
    countGroup("Vencimientos", data.invoices.map((item) => dueBucket(item.fechaVencimiento)), "/dinero"),
  ];
  if (area === "equipo") return [
    countGroup("Roles activos", data.memberships.map((item) => item.role), "/equipo"),
    countGroup("Perfiles funcionales", data.memberships.map((item) => item.functionalProfileKey ?? "Sin perfil"), "/equipo"),
    countGroup("Tareas asignadas", data.tasks.map((item) => item.assigneeId ? "Asignada" : "Sin asignar"), "/tareas"),
    countGroup("Carga registrada", data.tasks.map((item) => item.estimatedMinutes ? "Con estimación" : "Sin estimación"), "/tareas"),
  ];
  return [
    countGroup("Trabajo activo", data.works.map((item) => item.estado), "/obras"),
    countGroup("Presupuestos", data.budgets.map((item) => item.estado), "/presupuestos"),
    countGroup("Documentos", data.documents.map((item) => item.category), "/documentos"),
    { title: "Gobierno y alcance", rows: [
      { label: "Empresa", value: data.companyName },
      { label: "Alcance", value: data.scope },
      { label: "Política IA", value: data.aiEnabled ? "Habilitada" : "Fail-closed" },
      { label: "Proveedor", value: data.runtime ? "Activo" : "Modo manual" },
    ], href: "/configuracion" },
  ];
}

function countGroup(title: string, values: string[], href: string): ContextGroupData {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = humanize(raw || "Sin clasificar");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, value]) => ({ label, value: String(value) }));
  return { title, rows: rows.length ? rows : [{ label: "Sin datos registrados", value: "0" }], href };
}

function aggregateMoney<T>(items: T[], label: (item: T) => string, amount: (item: T) => number) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(label(item), (totals.get(label(item)) ?? 0) + amount(item));
  return [...totals].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ label: key, value: formatCurrencyCompact(value) }));
}

function queueCountLabel(area: OrqenaAiArea, data: { queue: QueueRow[]; budgets: BudgetView[]; tasks: TaskView[]; documents: DocumentView[]; invoices: InvoiceView[]; memberships: MembershipView[] }) {
  const count = area === "comercial" ? data.budgets.length : area === "operaciones" ? data.tasks.length : area === "documentos" ? data.documents.length : area === "finanzas" ? data.invoices.length : area === "equipo" ? data.memberships.length : data.queue.length;
  return `${count} visibles`;
}

function originFooterLabel(area: OrqenaAiArea) {
  if (area === "general") return "Ver todas las recomendaciones";
  if (area === "comercial") return "Ver todas las oportunidades";
  if (area === "operaciones") return "Ver toda la cola operativa";
  if (area === "documentos") return "Ver todos los documentos";
  if (area === "finanzas") return "Ver todo el detalle financiero";
  return "Ver todo el equipo";
}

function dueBucket(value: Date) {
  const days = Math.ceil((value.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Vencida";
  if (days === 0) return "Vence hoy";
  if (days <= 7) return "Próximos 7 días";
  return "Más de 7 días";
}

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(value) <= 1 ? value : value / 100);
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "Cuenta activa";
  return `${local.slice(0, 2)}•••@${domain}`;
}

export function CapatazWorkspaceEntry() {
  return (
    <section className="mb-4 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-label="Centro visual de Orqena IA">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><Sparkles size={20} aria-hidden="true" /></span><div><h2 className="font-black text-obra-ink">Centro visual de Orqena IA</h2><p className="mt-1 text-sm leading-6 text-slate-600">Consulta recomendaciones y contexto por área; el chat real y sus confirmaciones siguen aquí.</p></div></div>
      <Link href="/orqena-ia" className="secondary-button w-full md:w-auto">Abrir centro <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}

function AreaTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={styles.tab} data-active={active}>{children}</Link>;
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const content = <><span className={styles.metricIcon} data-tone={metric.tone}><Icon size={20} aria-hidden="true" /></span><div><p className={styles.metricLabel}>{metric.label}</p><p className={styles.metricValue}>{metric.value}</p><p className={styles.metricDetail}>{metric.detail}</p></div></>;
  return metric.href ? <Link href={metric.href} className={styles.metric}>{content}</Link> : <article className={styles.metric}>{content}</article>;
}

function HonestEmpty({ description }: { description: string }) {
  return <div className={styles.empty}><div><CheckCircle2 size={22} aria-hidden="true" /><p>{description}</p></div></div>;
}

function SectionHeading({ icon: Icon, id, title, meta }: { icon: LucideIcon; id: string; title: string; meta?: string }) {
  return <header className={styles.sectionHeader}><div className={styles.sectionHeaderTitle}><Icon size={16} aria-hidden="true" /><h2 id={id}>{title}</h2></div>{meta ? <span>{meta}</span> : null}</header>;
}

function PanelFooter({ href, children }: { href: string; children: React.ReactNode }) {
  return <footer className={styles.panelFooter}><Link href={href}>{children}</Link></footer>;
}

function buildQueue(area: OrqenaAiArea, data: {
  recommendations: Array<{ id: string; title: string; summary: string; status: string; priority: number; requiresConfirmation: boolean; updatedAt: Date }>;
  clients: Array<{ id: string; nombre: string }>;
  budgets: Array<{ id: string; numero: string; titulo: string; total: number; estado: string; fechaSeguimiento: Date | null; client: { nombre: string } }>;
  works: Array<{ id: string; titulo: string; estado: string; prioridad: string; responsable: string | null; fechaFinPrevista: Date | null }>;
  tasks: Array<{ id: string; title: string; status: string; priority: string; dueAt: Date | null; blockedReason: string | null; workId: string | null; clientId: string | null }>;
  documents: Array<{ id: string; name: string; category: string; extractionStatus: string; extractionConfidence: number | null; updatedAt: Date; work: { titulo: string } | null; client: { nombre: string } | null }>;
  invoices: Array<{ id: string; numero: string; concepto: string; pendiente: number; estado: string; fechaVencimiento: Date; client: { nombre: string } }>;
  memberships: Array<{ role: string; functionalProfileKey: string | null }>;
}): QueueRow[] {
  if (area === "comercial") return data.budgets.slice(0, 8).map((item) => ({ id: item.id, title: `${item.numero} · ${item.titulo}`, context: item.client.nombre, meta: `${formatCurrency(item.total)}${item.fechaSeguimiento ? ` · seguimiento ${formatDateTime(item.fechaSeguimiento)}` : ""}`, status: humanize(item.estado), href: `/presupuestos/${item.id}` }));
  if (area === "operaciones") {
    if (data.tasks.length) return data.tasks.slice(0, 8).map((item) => ({ id: item.id, title: item.title, context: data.works.find((work) => work.id === item.workId)?.titulo ?? data.clients.find((client) => client.id === item.clientId)?.nombre ?? "Tarea interna", meta: `${humanize(item.priority)}${item.dueAt ? ` · vence ${formatDateTime(item.dueAt)}` : ""}${item.blockedReason ? ` · ${item.blockedReason}` : ""}`, status: humanize(item.status), href: `/tareas/${item.id}` }));
    return data.works.slice(0, 8).map((item) => ({ id: item.id, title: item.titulo, context: item.responsable ?? "Responsable no asignado", meta: `${humanize(item.prioridad)}${item.fechaFinPrevista ? ` · prevista ${formatDateTime(item.fechaFinPrevista)}` : ""}`, status: humanize(item.estado), href: `/obras/${item.id}` }));
  }
  if (area === "documentos") return data.documents.slice(0, 8).map((item) => ({ id: item.id, title: item.name, context: item.work?.titulo ?? item.client?.nombre ?? "Documento interno", meta: `${humanize(item.category)}${item.extractionConfidence != null ? ` · confianza registrada ${Math.round(item.extractionConfidence * 100)}%` : " · sin confianza registrada"}`, status: humanize(item.extractionStatus), href: "/documentos", requiresConfirmation: true }));
  if (area === "finanzas") return data.invoices.slice(0, 8).map((item) => ({ id: item.id, title: `${item.numero} · ${item.concepto}`, context: item.client.nombre, meta: `${formatCurrency(item.pendiente)} pendientes · vence ${formatDateTime(item.fechaVencimiento)}`, status: humanize(item.estado), href: `/dinero/${item.id}`, requiresConfirmation: true }));
  if (area === "equipo") {
    const roleCounts = new Map<string, number>();
    for (const member of data.memberships) roleCounts.set(member.functionalProfileKey ?? member.role, (roleCounts.get(member.functionalProfileKey ?? member.role) ?? 0) + 1);
    return [...roleCounts].map(([role, count]) => ({ id: role, title: humanize(role), context: `${count} ${count === 1 ? "miembro activo" : "miembros activos"}`, meta: "Datos agregados; abre Equipo para revisar permisos y alcance.", status: "Agregado", href: "/equipo" }));
  }
  return data.recommendations.slice(0, 8).map((item) => ({ id: item.id, title: item.title, context: item.summary, meta: `Prioridad registrada ${item.priority} · actualizada ${formatDateTime(item.updatedAt)}`, status: humanize(item.status), href: `/recomendaciones?estado=all&seleccion=${encodeURIComponent(item.id)}`, requiresConfirmation: item.requiresConfirmation }));
}

function buildMetrics(area: OrqenaAiArea, data: {
  recommendations: number;
  confirmedRecommendations: number;
  recordedImpact: number;
  clients: number;
  works: number;
  budgets: Array<{ total: number }>;
  invoices: Array<{ pendiente: number; estado: string }>;
  documents: Array<{ extractionStatus: string }>;
  tasks: Array<{ status: string }>;
  memberships: Array<unknown>;
  automations: Array<{ active: boolean }>;
  pendingConfirmations: number;
  aiUsage: number;
  access: {
    recommendations: boolean;
    clients: boolean;
    works: boolean;
    budgets: boolean;
    finance: boolean;
    documents: boolean;
    tasks: boolean;
    members: boolean;
    automations: boolean;
  };
}): Metric[] {
  if (area === "comercial") return [
    controlledMetric(data.access.clients, "Clientes en muestra", data.clients, "muestra autorizada (máx. 100)", BriefcaseBusiness, "violet", "/clientes"),
    controlledMetric(data.access.budgets, "Presupuestos en muestra", data.budgets.length, "abiertos en la muestra autorizada (máx. 100)", FileSearch, "green", "/presupuestos"),
    controlledMetric(data.access.budgets, "Importe de la muestra", formatCurrency(data.budgets.reduce((sum, item) => sum + item.total, 0)), "suma autorizada de hasta 100 presupuestos", BadgeEuro, "blue", "/presupuestos"),
    controlledMetric(data.access.recommendations, "Recomendaciones en muestra", data.recommendations, "autorizadas dentro de la muestra (máx. 250)", Sparkles, "amber", "/recomendaciones?estado=all"),
  ];
  if (area === "operaciones") return [
    controlledMetric(data.access.works, "Trabajos en muestra", data.works, "muestra autorizada (máx. 100)", BriefcaseBusiness, "violet", "/obras"),
    controlledMetric(data.access.tasks, "Tareas en muestra", data.tasks.length, "abiertas en la muestra autorizada (máx. 100)", ListTodo, "green", "/tareas"),
    controlledMetric(data.access.tasks, "Bloqueos en muestra", data.tasks.filter((item) => item.status === "blocked").length, "bloqueos de hasta 100 tareas autorizadas", AlertTriangle, "amber", "/tareas?filtro=blocked"),
    controlledMetric(data.access.automations, "Automatizaciones en muestra", data.automations.filter((item) => item.active).length, "activas entre las 100 más recientes", Workflow, "blue", "/automatizaciones"),
  ];
  if (area === "documentos") return [
    controlledMetric(data.access.documents, "Documentos en muestra", data.documents.length, "clases permitidas, sin archivar (máx. 100)", FileSearch, "violet", "/documentos"),
    controlledMetric(data.access.documents, "Extracciones en muestra", data.documents.filter((item) => ["PENDING", "PROCESSING"].includes(item.extractionStatus)).length, "pendientes entre hasta 100 documentos", Clock3, "blue", "/documentos"),
    controlledMetric(data.access.documents, "Revisión en muestra", data.documents.filter((item) => item.extractionStatus === "FAILED").length, "fallidas entre hasta 100 documentos", AlertTriangle, "amber", "/documentos"),
    controlledMetric(data.access.recommendations && data.access.documents, "Recomendaciones en muestra", data.recommendations, "documentales autorizadas (máx. 250)", Sparkles, "green", "/recomendaciones?estado=all"),
  ];
  if (area === "finanzas") return [
    controlledMetric(data.access.finance, "Pendiente en muestra", formatCurrency(data.invoices.reduce((sum, item) => sum + item.pendiente, 0)), "suma autorizada de hasta 100 facturas", CircleDollarSign, "green", "/dinero"),
    controlledMetric(data.access.finance, "Facturas en muestra", data.invoices.length, "abiertas en la muestra autorizada (máx. 100)", FileSearch, "violet", "/dinero"),
    controlledMetric(data.access.finance, "Vencidas en muestra", data.invoices.filter((item) => ["vencida", "reclamada"].includes(item.estado)).length, "entre hasta 100 facturas autorizadas", AlertTriangle, "amber", "/dinero"),
    controlledMetric(data.access.recommendations && data.access.finance, "Recomendaciones en muestra", data.recommendations, "financieras autorizadas (máx. 250)", Sparkles, "blue", "/recomendaciones?estado=all"),
  ];
  if (area === "equipo") return [
    controlledMetric(data.access.members, "Miembros visibles", data.memberships.length, "activos en la empresa", UsersRound, "green", "/equipo"),
    controlledMetric(data.access.tasks, "Tareas en muestra", data.tasks.length, "abiertas en la muestra autorizada (máx. 100)", ListTodo, "violet", "/tareas"),
    controlledMetric(data.access.automations, "Pendientes de confirmación", data.pendingConfirmations, "recuento registrado de ejecuciones", ShieldCheck, "amber", "/automatizaciones"),
    controlledMetric(data.access.automations, "Automatizaciones en muestra", data.automations.filter((item) => item.active).length, "activas entre las 100 más recientes", Workflow, "blue", "/automatizaciones"),
  ];
  return [
    controlledMetric(data.access.recommendations, "Recomendaciones visibles", data.recommendations, "autorizadas dentro de la muestra", Sparkles, "violet", "/recomendaciones?estado=all"),
    controlledMetric(data.access.recommendations, "Acciones confirmadas", data.confirmedRecommendations, "aceptadas o en curso", CheckCircle2, "green", "/recomendaciones?estado=accepted"),
    controlledMetric(data.access.recommendations, "Impacto registrado", formatCurrency(data.recordedImpact), "importe documentado en recomendaciones", BadgeEuro, "blue", "/recomendaciones?estado=all"),
    controlledMetric(data.access.recommendations, "Operaciones IA este mes", data.aiUsage, "recuento agregado registrado", Activity, "amber", "/recomendaciones?estado=all"),
    controlledMetric(data.access.automations, "Pendientes de confirmación", data.pendingConfirmations, "sin ejecución automática", ShieldCheck, "green", "/automatizaciones"),
  ];
}

function metric(label: string, value: string | number, detail: string, icon: LucideIcon, tone: Metric["tone"], href?: string): Metric {
  return { label, value: String(value), detail, icon, tone, href };
}

function controlledMetric(allowed: boolean, label: string, value: string | number, detail: string, icon: LucideIcon, tone: Metric["tone"], href?: string): Metric {
  return metric(label, allowed ? value : "Restringido", allowed ? detail : "No disponible para tu perfil", icon, tone, allowed ? href : undefined);
}

function recommendationVisible(item: { source: string; title: string; summary: string; clientId: string | null; workId: string | null; invoiceId: string | null; budgetId: string | null }, options: { area: OrqenaAiArea; clientIds: string[] | null; workIds: string[] | null; invoiceIds: string[]; budgetIds: string[]; canSeeClients: boolean; canSeeWorks: boolean; canSeeInvoices: boolean; canSeeBudgets: boolean; canSeeFinance: boolean; canSeeDocuments: boolean; canSeeOperations: boolean; canSeeCommercial: boolean; canSeeMembers: boolean }) {
  if (item.clientId && (!options.canSeeClients || !idVisible(options.clientIds, item.clientId))) return false;
  if (item.workId && (!options.canSeeWorks || !idVisible(options.workIds, item.workId))) return false;
  if (item.invoiceId && (!options.canSeeInvoices || !options.invoiceIds.includes(item.invoiceId))) return false;
  if (item.budgetId && (!options.canSeeBudgets || !options.budgetIds.includes(item.budgetId))) return false;
  const normalizedSource = item.source.toLocaleLowerCase("es-ES");
  if (areaSources.finanzas.has(normalizedSource) && !options.canSeeFinance) return false;
  if (areaSources.documentos.has(normalizedSource) && !options.canSeeDocuments) return false;
  if (areaSources.operaciones.has(normalizedSource) && !options.canSeeOperations) return false;
  if (normalizedSource === "presupuestos" && !options.canSeeBudgets) return false;
  if (["crm", "visitas", "recordatorios"].includes(normalizedSource) && !options.canSeeClients) return false;
  if (areaSources.comercial.has(normalizedSource) && !options.canSeeCommercial) return false;
  if (options.area === "general") return true;
  if (!areaSources[options.area].has(normalizedSource)) return false;
  if (options.area !== "equipo") return true;
  return options.canSeeMembers && /equipo|carga|asign|persona|turno|formaci[oó]n|miembro/i.test(`${item.title} ${item.summary}`);
}

function idVisible(ids: string[] | null, id: string) {
  return ids === null || ids.includes(id);
}

function resolveOriginLink(area: OrqenaAiArea, access: { recommendations: boolean; clients: boolean; budgets: boolean; works: boolean; tasks: boolean; documents: boolean; finance: boolean; members: boolean }) {
  if (area === "general") return access.recommendations ? "/recomendaciones" : null;
  if (area === "comercial") return access.budgets ? "/presupuestos" : access.clients ? "/clientes" : null;
  if (area === "operaciones") return access.tasks ? "/tareas" : access.works ? "/obras" : null;
  if (area === "documentos") return access.documents ? "/documentos" : null;
  if (area === "finanzas") return access.finance ? "/dinero" : null;
  return access.members ? "/equipo" : null;
}

type AreaAutomation = {
  id: string;
  name: string;
  category: string;
  status: string;
  active: boolean;
  updatedAt: Date;
  currentVersion: { requiresConfirmation: boolean } | null;
  schedule: { nextRunAt: Date | null } | null;
};

type AreaActivity = {
  id: string;
  purpose: string;
  outcome: string;
  humanReviewed: boolean;
  createdAt: Date;
};

const areaKeywords: Record<Exclude<OrqenaAiArea, "general">, string[]> = {
  comercial: ["client", "cliente", "crm", "lead", "budget", "presupuesto", "quote", "visit", "visita", "follow", "seguimiento"],
  operaciones: ["work", "obra", "task", "tarea", "operacion", "incidencia", "material", "planning", "planificacion"],
  finanzas: ["invoice", "factura", "payment", "pago", "cobro", "treasury", "tesorer", "margin", "margen", "gasto", "coste"],
  documentos: ["document", "documento", "archivo", "ocr", "extract", "clasific"],
  equipo: ["team", "equipo", "member", "miembro", "persona", "role", "rol", "permission", "permiso", "assign", "asign", "training", "formacion", "carga"],
};

function filterAreaAutomations(area: OrqenaAiArea, items: AreaAutomation[]) {
  if (area === "general") return items;
  return items.filter((item) => areaTextMatches(area, `${item.category} ${item.name}`));
}

function filterAreaActivity(area: OrqenaAiArea, items: AreaActivity[]) {
  if (area === "general") return items;
  return items.filter((item) => areaTextMatches(area, item.purpose));
}

function areaTextMatches(area: Exclude<OrqenaAiArea, "general">, value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
  return areaKeywords[area].some((keyword) => normalized.includes(keyword));
}

function idScope(ids: string[] | null) {
  return ids === null ? {} : { id: { in: ids } };
}

function relationScope(scope: string, workIds: string[] | null, clientIds: string[] | null) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS") return { clienteId: { in: clientIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length) OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}

function safeAiRuntime(companyId: string) {
  try {
    const runtime = readRuntimeAiControl();
    return runtime.globalEnabled && runtime.liveConfigurationComplete && runtime.companyAllowlist.includes(companyId);
  } catch {
    return false;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: Date) {
  return value.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scopeLabel(scope: string) {
  if (scope === "COMPANY") return "Empresa";
  if (scope === "TEAM") return "Equipo";
  if (scope === "OWN") return "Propio";
  if (scope === "ASSIGNED") return "Asignado";
  return "Selección autorizada";
}
