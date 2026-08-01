import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  Bot,
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
  "documentos",
  "finanzas",
  "equipo",
] as const;

export type OrqenaAiArea = "general" | (typeof orqenaAiAreas)[number];

type Metric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "green" | "violet" | "blue" | "amber";
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

const areaMeta: Record<OrqenaAiArea, { label: string; description: string; queueTitle: string; contextTitle: string }> = {
  general: {
    label: "Todos",
    description: "Centro de recomendaciones, automatización supervisada y contexto autorizado para tu empresa.",
    queueTitle: "Bandeja inteligente",
    contextTitle: "Contexto y aprendizaje",
  },
  comercial: {
    label: "Comercial",
    description: "Oportunidades, presupuestos y siguientes pasos dentro de tu alcance comercial.",
    queueTitle: "Pipeline autorizado",
    contextTitle: "Contexto comercial",
  },
  operaciones: {
    label: "Operaciones",
    description: "Trabajo, tareas y bloqueos visibles para tu rol, sin reasignaciones automáticas.",
    queueTitle: "Cola operativa priorizada",
    contextTitle: "Contexto operativo",
  },
  documentos: {
    label: "Documentos",
    description: "Revisión documental con extracción trazable y confirmación humana.",
    queueTitle: "Cola de revisión de documentos",
    contextTitle: "Contexto documental",
  },
  finanzas: {
    label: "Finanzas",
    description: "Cobros, vencimientos y riesgos financieros sólo cuando tus permisos lo permiten.",
    queueTitle: "Prioridades financieras",
    contextTitle: "Contexto financiero",
  },
  equipo: {
    label: "Equipo",
    description: "Coordinación agregada de personas y tareas sin ampliar permisos ni exponer datos ajenos.",
    queueTitle: "Coordinación del equipo",
    contextTitle: "Contexto del equipo",
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
      ? prisma.budget.findMany({ where: { companyId: auth.companyId, estado: { in: [...openBudgetStates] }, AND: [relationScope(budgetDecision.scope, budgetWorkIds, budgetClientIds), relationScope(pricingDecision.scope, pricingWorkIds, pricingClientIds)] }, orderBy: { fechaCreacion: "desc" }, take: 100, select: { id: true, numero: true, titulo: true, total: true, estado: true, fechaSeguimiento: true, client: { select: { nombre: true } } } })
      : Promise.resolve([]),
    canSeeFinance
      ? prisma.invoice.findMany({ where: { companyId: auth.companyId, estado: { in: [...openInvoiceStates] }, ...relationScope(invoiceDecision.scope, invoiceWorkIds, invoiceClientIds) }, orderBy: { fechaVencimiento: "asc" }, take: 100, select: { id: true, numero: true, concepto: true, pendiente: true, estado: true, fechaVencimiento: true, client: { select: { nombre: true } } } })
      : Promise.resolve([]),
    documentsDecision.allowed
      ? prisma.document.findMany({ where: { companyId: auth.companyId, archivedAt: null, classification: { in: portalManifest?.documentClasses ?? [] }, ...idScope(documentIds) }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, category: true, extractionStatus: true, extractionConfidence: true, updatedAt: true, work: { select: { titulo: true } }, client: { select: { nombre: true } } } })
      : Promise.resolve([]),
    tasksDecision.allowed
      ? prisma.task.findMany({ where: { companyId: auth.companyId, archivedAt: null, status: { in: [...openTaskStates] }, ...idScope(taskIds) }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 100, select: { id: true, title: true, status: true, priority: true, dueAt: true, blockedReason: true, workId: true, clientId: true } })
      : Promise.resolve([]),
    membersDecision.allowed
      ? prisma.companyMembership.findMany({ where: { companyId: auth.companyId, status: "active" }, select: { role: true, functionalProfileKey: true } })
      : Promise.resolve([]),
    executeDecision.allowed
      ? prisma.businessRecommendation.findMany({ where: { companyId: auth.companyId, status: { in: ["active", "viewed", "accepted", "in_progress", "failed"] } }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 250, select: { id: true, title: true, summary: true, source: true, status: true, priority: true, amount: true, requiresConfirmation: true, clientId: true, workId: true, invoiceId: true, budgetId: true, updatedAt: true } })
      : Promise.resolve([]),
    automationDecision.allowed
      ? prisma.automationDefinition.findMany({ where: { companyId: auth.companyId, archivedAt: null }, orderBy: [{ active: "desc" }, { updatedAt: "desc" }], take: 20, select: { id: true, name: true, category: true, status: true, active: true, updatedAt: true, currentVersion: { select: { requiresConfirmation: true } }, schedule: { select: { nextRunAt: true } } } })
      : Promise.resolve([]),
    automationDecision.allowed
      ? prisma.automationRun.count({ where: { companyId: auth.companyId, status: "waiting_confirmation" } })
      : Promise.resolve(0),
    executeDecision.allowed
      ? prisma.aiUsageEvent.count({ where: { companyId: auth.companyId, createdAt: { gte: monthStart } } })
      : Promise.resolve(0),
    executeDecision.allowed
      ? prisma.aiUsageEvent.findMany({ where: { companyId: auth.companyId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, purpose: true, outcome: true, humanReviewed: true, createdAt: true } })
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
    automations,
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
        style={{ "--metric-count": metrics.length } as CSSProperties}
        aria-label="Indicadores reales de la vista"
      >
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.panel} aria-labelledby="orqena-queue-title">
          <SectionHeading icon={Sparkles} id="orqena-queue-title" title={meta.queueTitle} meta={`${queue.length} visibles`} />
          {queue.length ? queue.slice(0, 6).map((row) => <QueueItem key={row.id} row={row} />) : <HonestEmpty description="No hay elementos registrados y autorizados que requieran revisión en esta área." />}
          {originLink ? <PanelFooter href={originLink}>Abrir el módulo de origen</PanelFooter> : null}
        </section>

        <section className={styles.panel} aria-labelledby="orqena-automations-title">
          <SectionHeading icon={Workflow} id="orqena-automations-title" title="Automatizaciones sugeridas" />
          {automations.length ? automations.slice(0, 5).map((automation) => (
            <article key={automation.id} className={styles.automationRow}>
              <span className={styles.automationIcon}><Workflow size={17} aria-hidden="true" /></span>
              <div>
                <h3>{automation.name}</h3>
                <p>{humanize(automation.category)} · {automation.currentVersion?.requiresConfirmation ? "requiere revisión humana" : "aplica sus controles configurados"}</p>
              </div>
              <Link href={`/automatizaciones/${automation.id}`} className={styles.reviewLink}>Abrir para revisar</Link>
            </article>
          )) : <HonestEmpty description={automationDecision.allowed ? "No hay automatizaciones configuradas en esta empresa." : "Tu perfil no puede consultar la configuración de automatizaciones."} />}
          {automationDecision.allowed ? <PanelFooter href="/automatizaciones">Ver todas las automatizaciones</PanelFooter> : null}
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.panel} aria-labelledby="orqena-context-title">
          <SectionHeading icon={Gauge} id="orqena-context-title" title={meta.contextTitle} />
          <div className={styles.contextGrid}>
            <ContextMini label="Empresa activa" value={auth.companyName} />
            <ContextMini label="Alcance" value={scopeLabel(useDecision.scope)} />
            <ContextMini label="Política IA" value={aiPolicy?.enabled && !aiPolicy.killSwitch ? "Habilitada" : "Fail-closed"} />
            <ContextMini label="Proveedor" value={runtime ? "Activo para la empresa" : "Modo manual"} />
          </div>
          <div className={styles.governance}><ShieldCheck size={16} aria-hidden="true" /><span>Datos limitados a la empresa y al alcance. Las acciones sensibles mantienen revisión humana, confirmación e idempotencia.</span></div>
        </section>

        <section className={styles.panel} aria-labelledby="orqena-activity-title">
          <SectionHeading icon={Activity} id="orqena-activity-title" title="Actividad reciente de Orqena IA" />
          {recentAi.length ? (
            <ol>
              {recentAi.map((event) => (
                <li key={event.id} className={styles.activityRow}>
                  <time>{event.createdAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>
                  <span>{humanize(event.purpose)}</span>
                  <span className={styles.status}>{event.humanReviewed ? "Revisada" : humanize(event.outcome)}</span>
                </li>
              ))}
            </ol>
          ) : <HonestEmpty description={executeDecision.allowed ? "Aún no hay operaciones de IA registradas." : "Tu perfil no puede consultar esta actividad."} />}
          {executeDecision.allowed ? <PanelFooter href="/recomendaciones">Ver toda la actividad</PanelFooter> : null}
        </section>
      </div>

      <Link href="/capataz" className="primary-button justify-self-start"><Bot size={17} aria-hidden="true" />Abrir chat real</Link>
    </main>
  );
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
  return <article className={styles.metric}><span className={styles.metricIcon} data-tone={metric.tone}><Icon size={20} aria-hidden="true" /></span><div><p className={styles.metricLabel}>{metric.label}</p><p className={styles.metricValue}>{metric.value}</p><p className={styles.metricDetail}>{metric.detail}</p></div></article>;
}

function QueueItem({ row }: { row: QueueRow }) {
  const content = <><div><h3>{row.title}{row.requiresConfirmation ? <span className={styles.confirmation}>Confirmación humana</span> : null}</h3><p>{row.context}</p><span className={styles.queueMeta}>{row.meta}</span></div><span className={styles.status}>{row.status}</span></>;
  return row.href ? <Link href={row.href} className={styles.queueRow}>{content}</Link> : <article className={styles.queueRow}>{content}</article>;
}

function HonestEmpty({ description }: { description: string }) {
  return <div className={styles.empty}><div><CheckCircle2 size={22} aria-hidden="true" /><p>{description}</p></div></div>;
}

function ContextMini({ label, value }: { label: string; value: string }) {
  return <div className={styles.contextCell}><p>{label}</p><strong>{value}</strong></div>;
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
  if (area === "finanzas") return data.invoices.slice(0, 8).map((item) => ({ id: item.id, title: `${item.numero} · ${item.concepto}`, context: item.client.nombre, meta: `${formatCurrency(item.pendiente)} pendientes · vence ${formatDateTime(item.fechaVencimiento)}`, status: humanize(item.estado), href: "/tesoreria?vista=cobros", requiresConfirmation: true }));
  if (area === "equipo") {
    const roleCounts = new Map<string, number>();
    for (const member of data.memberships) roleCounts.set(member.functionalProfileKey ?? member.role, (roleCounts.get(member.functionalProfileKey ?? member.role) ?? 0) + 1);
    return [...roleCounts].map(([role, count]) => ({ id: role, title: humanize(role), context: `${count} ${count === 1 ? "miembro activo" : "miembros activos"}`, meta: "Datos agregados; abre Equipo para revisar permisos y alcance.", status: "Agregado", href: "/equipo" }));
  }
  return data.recommendations.slice(0, 8).map((item) => ({ id: item.id, title: item.title, context: item.summary, meta: `Prioridad registrada ${item.priority} · actualizada ${formatDateTime(item.updatedAt)}`, status: humanize(item.status), href: `/recomendaciones?q=${encodeURIComponent(item.title)}`, requiresConfirmation: item.requiresConfirmation }));
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
    controlledMetric(data.access.clients, "Clientes en muestra", data.clients, "muestra autorizada (máx. 100)", BriefcaseBusiness, "violet"),
    controlledMetric(data.access.budgets, "Presupuestos en muestra", data.budgets.length, "abiertos en la muestra autorizada (máx. 100)", FileSearch, "green"),
    controlledMetric(data.access.budgets, "Importe de la muestra", formatCurrency(data.budgets.reduce((sum, item) => sum + item.total, 0)), "suma autorizada de hasta 100 presupuestos", BadgeEuro, "blue"),
    controlledMetric(data.access.recommendations, "Recomendaciones en muestra", data.recommendations, "autorizadas dentro de la muestra (máx. 250)", Sparkles, "amber"),
  ];
  if (area === "operaciones") return [
    controlledMetric(data.access.works, "Trabajos en muestra", data.works, "muestra autorizada (máx. 100)", BriefcaseBusiness, "violet"),
    controlledMetric(data.access.tasks, "Tareas en muestra", data.tasks.length, "abiertas en la muestra autorizada (máx. 100)", ListTodo, "green"),
    controlledMetric(data.access.tasks, "Bloqueos en muestra", data.tasks.filter((item) => item.status === "blocked").length, "bloqueos de hasta 100 tareas autorizadas", AlertTriangle, "amber"),
    controlledMetric(data.access.automations, "Automatizaciones en muestra", data.automations.filter((item) => item.active).length, "activas entre las 20 más recientes", Workflow, "blue"),
  ];
  if (area === "documentos") return [
    controlledMetric(data.access.documents, "Documentos en muestra", data.documents.length, "clases permitidas, sin archivar (máx. 100)", FileSearch, "violet"),
    controlledMetric(data.access.documents, "Extracciones en muestra", data.documents.filter((item) => ["PENDING", "PROCESSING"].includes(item.extractionStatus)).length, "pendientes entre hasta 100 documentos", Clock3, "blue"),
    controlledMetric(data.access.documents, "Revisión en muestra", data.documents.filter((item) => item.extractionStatus === "FAILED").length, "fallidas entre hasta 100 documentos", AlertTriangle, "amber"),
    controlledMetric(data.access.recommendations && data.access.documents, "Recomendaciones en muestra", data.recommendations, "documentales autorizadas (máx. 250)", Sparkles, "green"),
  ];
  if (area === "finanzas") return [
    controlledMetric(data.access.finance, "Pendiente en muestra", formatCurrency(data.invoices.reduce((sum, item) => sum + item.pendiente, 0)), "suma autorizada de hasta 100 facturas", CircleDollarSign, "green"),
    controlledMetric(data.access.finance, "Facturas en muestra", data.invoices.length, "abiertas en la muestra autorizada (máx. 100)", FileSearch, "violet"),
    controlledMetric(data.access.finance, "Vencidas en muestra", data.invoices.filter((item) => ["vencida", "reclamada"].includes(item.estado)).length, "entre hasta 100 facturas autorizadas", AlertTriangle, "amber"),
    controlledMetric(data.access.recommendations && data.access.finance, "Recomendaciones en muestra", data.recommendations, "financieras autorizadas (máx. 250)", Sparkles, "blue"),
  ];
  if (area === "equipo") return [
    controlledMetric(data.access.members, "Miembros visibles", data.memberships.length, "activos en la empresa", UsersRound, "green"),
    controlledMetric(data.access.tasks, "Tareas en muestra", data.tasks.length, "abiertas en la muestra autorizada (máx. 100)", ListTodo, "violet"),
    controlledMetric(data.access.automations, "Pendientes de confirmación", data.pendingConfirmations, "recuento registrado de ejecuciones", ShieldCheck, "amber"),
    controlledMetric(data.access.automations, "Automatizaciones en muestra", data.automations.filter((item) => item.active).length, "activas entre las 20 más recientes", Workflow, "blue"),
  ];
  return [
    controlledMetric(data.access.recommendations, "Recomendaciones visibles", data.recommendations, "autorizadas dentro de la muestra", Sparkles, "violet"),
    controlledMetric(data.access.recommendations, "Acciones confirmadas", data.confirmedRecommendations, "aceptadas o en curso", CheckCircle2, "green"),
    controlledMetric(data.access.recommendations, "Impacto registrado", formatCurrency(data.recordedImpact), "importe documentado en recomendaciones", BadgeEuro, "blue"),
    controlledMetric(data.access.recommendations, "Operaciones IA este mes", data.aiUsage, "recuento agregado registrado", Activity, "amber"),
    controlledMetric(data.access.automations, "Pendientes de confirmación", data.pendingConfirmations, "sin ejecución automática", ShieldCheck, "green"),
  ];
}

function metric(label: string, value: string | number, detail: string, icon: LucideIcon, tone: Metric["tone"]): Metric {
  return { label, value: String(value), detail, icon, tone };
}

function controlledMetric(allowed: boolean, label: string, value: string | number, detail: string, icon: LucideIcon, tone: Metric["tone"]): Metric {
  return metric(label, allowed ? value : "Restringido", allowed ? detail : "No disponible para tu perfil", icon, tone);
}

function recommendationVisible(item: { source: string; title: string; summary: string; clientId: string | null; workId: string | null; invoiceId: string | null; budgetId: string | null }, options: { area: OrqenaAiArea; clientIds: string[] | null; workIds: string[] | null; invoiceIds: string[]; budgetIds: string[]; canSeeClients: boolean; canSeeWorks: boolean; canSeeInvoices: boolean; canSeeBudgets: boolean; canSeeFinance: boolean; canSeeDocuments: boolean; canSeeOperations: boolean; canSeeCommercial: boolean; canSeeMembers: boolean }) {
  if (item.clientId && (!options.canSeeClients || !idVisible(options.clientIds, item.clientId))) return false;
  if (item.workId && (!options.canSeeWorks || !idVisible(options.workIds, item.workId))) return false;
  if (item.invoiceId && (!options.canSeeInvoices || !options.invoiceIds.includes(item.invoiceId))) return false;
  if (item.budgetId && (!options.canSeeBudgets || !options.budgetIds.includes(item.budgetId))) return false;
  if (areaSources.finanzas.has(item.source) && !options.canSeeFinance) return false;
  if (areaSources.documentos.has(item.source) && !options.canSeeDocuments) return false;
  if (areaSources.operaciones.has(item.source) && !options.canSeeOperations) return false;
  if (item.source === "presupuestos" && !options.canSeeBudgets) return false;
  if (["crm", "visitas", "recordatorios"].includes(item.source) && !options.canSeeClients) return false;
  if (areaSources.comercial.has(item.source) && !options.canSeeCommercial) return false;
  if (options.area === "general") return true;
  if (!areaSources[options.area].has(item.source)) return false;
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
  if (area === "finanzas") return access.finance ? "/tesoreria" : null;
  return access.members ? "/equipo" : null;
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
