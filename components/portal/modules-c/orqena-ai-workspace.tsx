import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSearch,
  Gauge,
  ListTodo,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";
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

  return (
    <main className="screen" data-orqena-ai-workspace={area}>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="type-label">Asistencia gobernada</p>
          <h1 className="type-page-title mt-2">Orqena IA</h1>
          <p className="type-secondary mt-2 max-w-3xl">{meta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/capataz" className="primary-button"><Bot size={17} aria-hidden="true" />Abrir chat real</Link>
          {executeDecision.allowed ? <Link href="/recomendaciones" className="secondary-button">Historial de recomendaciones</Link> : null}
        </div>
      </header>

      <nav className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1" aria-label="Áreas de Orqena IA">
        <AreaTab href="/orqena-ia" active={area === "general"}>Todos</AreaTab>
        {orqenaAiAreas.map((item) => <AreaTab key={item} href={`/orqena-ia/${item}`} active={area === item}>{areaMeta[item].label}</AreaTab>)}
      </nav>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores reales de la vista">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <div className="mt-4">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.75fr)]">
            <section className="card overflow-hidden" aria-labelledby="orqena-queue-title">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
                <div className="flex items-center gap-2"><Sparkles className="text-emerald-600" size={18} aria-hidden="true" /><h2 id="orqena-queue-title" className="font-black text-obra-ink">{meta.queueTitle}</h2></div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{queue.length} visibles</span>
              </div>
              {queue.length ? <div className="divide-y divide-slate-100">{queue.slice(0, 6).map((row) => <QueueItem key={row.id} row={row} />)}</div> : <HonestEmpty description="No hay elementos registrados y autorizados que requieran revisión en esta área." />}
              {originLink ? <div className="border-t border-slate-100 px-4 py-3 text-center"><Link href={originLink} className="text-sm font-bold text-emerald-700 hover:underline">Abrir el módulo de origen</Link></div> : null}
            </section>

            <section className="card overflow-hidden" aria-labelledby="orqena-automations-title">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4"><Workflow className="text-emerald-600" size={18} aria-hidden="true" /><h2 id="orqena-automations-title" className="font-black text-obra-ink">Automatizaciones configuradas</h2></div>
              {automations.length ? <div className="divide-y divide-slate-100">{automations.slice(0, 5).map((automation) => (
                <article key={automation.id} className="p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-obra-ink">{automation.name}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{humanize(automation.category)} · {automation.schedule?.nextRunAt ? `próxima ${formatDateTime(automation.schedule.nextRunAt)}` : "sin próxima ejecución"}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${automation.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{automation.active ? "Activa" : humanize(automation.status)}</span></div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{automation.currentVersion?.requiresConfirmation ? "Cada efecto requiere confirmación." : "Se aplican los controles definidos en su versión."}</p>
                  <Link href={`/automatizaciones/${automation.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Abrir para revisar <ArrowRight size={13} aria-hidden="true" /></Link>
                </article>
              ))}</div> : <HonestEmpty description={automationDecision.allowed ? "No hay automatizaciones configuradas en esta empresa." : "Tu perfil no puede consultar la configuración de automatizaciones."} />}
              {automationDecision.allowed ? <div className="border-t border-slate-100 px-4 py-3 text-center"><Link href="/automatizaciones" className="text-sm font-bold text-emerald-700 hover:underline">Ver automatizaciones</Link></div> : null}
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.9fr)]">
            <section className="card p-4" aria-labelledby="orqena-context-title">
              <div className="flex items-center gap-2"><Gauge className="text-emerald-600" size={18} aria-hidden="true" /><h2 id="orqena-context-title" className="font-black text-obra-ink">{meta.contextTitle}</h2></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ContextMini label="Empresa activa" value={auth.companyName} />
                <ContextMini label="Alcance" value={scopeLabel(useDecision.scope)} />
                <ContextMini label="Política IA" value={aiPolicy?.enabled && !aiPolicy.killSwitch ? "Habilitada" : "Fail-closed"} />
                <ContextMini label="Proveedor" value={runtime ? "Activo para la empresa" : "Modo manual"} />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={19} aria-hidden="true" /><p>Los datos se limitan a tu empresa y a tu alcance. Ninguna recomendación de esta vista modifica registros; las acciones sensibles conservan revisión humana, confirmación e idempotencia.</p></div>
            </section>

            <section className="card overflow-hidden" aria-labelledby="orqena-activity-title">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4"><Activity className="text-emerald-600" size={18} aria-hidden="true" /><h2 id="orqena-activity-title" className="font-black text-obra-ink">Actividad reciente de IA</h2></div>
              {recentAi.length ? <ol className="divide-y divide-slate-100">{recentAi.map((event) => <li key={event.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-xs"><time className="font-semibold text-slate-500">{event.createdAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time><span className="min-w-0 truncate text-slate-700">{humanize(event.purpose)}</span><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{event.humanReviewed ? "Revisada" : humanize(event.outcome)}</span></li>)}</ol> : <HonestEmpty description={executeDecision.allowed ? "Aún no hay operaciones de IA registradas." : "Tu perfil no puede consultar esta actividad."} />}
            </section>
          </div>
        </div>

      </div>
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
  return <Link href={href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-black transition ${active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-obra-ink"}`}>{children}</Link>;
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return <article className="card flex min-h-28 items-center gap-4 p-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[metric.tone]}`}><Icon size={23} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{metric.label}</p><p className="mt-1 truncate text-2xl font-black text-obra-ink">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></div></article>;
}

function QueueItem({ row }: { row: QueueRow }) {
  const content = <><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-obra-ink">{row.title}</h3>{row.requiresConfirmation ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Confirmación humana</span> : null}</div><p className="mt-1 text-sm leading-5 text-slate-600">{row.context}</p><p className="mt-1 text-xs text-slate-500">{row.meta}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{row.status}</span></>;
  return row.href ? <Link href={row.href} className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">{content}</Link> : <article className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">{content}</article>;
}

function HonestEmpty({ description }: { description: string }) {
  return <div className="p-5 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={25} aria-hidden="true" /><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">{description}</p></div>;
}

function ContextMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-sm font-black text-obra-ink">{value}</p></div>;
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
    controlledMetric(data.access.recommendations, "Recomendaciones en muestra", data.recommendations, "autorizadas dentro de la muestra (máx. 250)", Sparkles, "violet"),
    controlledMetric(data.access.automations, "Automatizaciones en muestra", data.automations.filter((item) => item.active).length, "activas entre las 20 más recientes", Workflow, "green"),
    controlledMetric(data.access.recommendations, "Operaciones IA este mes", data.aiUsage, "recuento agregado registrado", Activity, "blue"),
    controlledMetric(data.access.automations, "Pendientes de confirmación", data.pendingConfirmations, "recuento registrado; no se aplican automáticamente", ShieldCheck, "amber"),
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
