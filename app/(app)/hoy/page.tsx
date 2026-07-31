import Link from "next/link";
import { ArrowUpRight, Bot, CalendarDays, Plus } from "lucide-react";
import { EmptyState, Metric, MetricGroup, PageHeader, ProductPage, Status } from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { requireCapability } from "@/lib/commercial/authorization";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { greetingForDate } from "@/lib/dashboard-hoy";
import { userDisplayName } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { ActivationChecklist } from "@/components/activation-checklist";
import { getAndMeasureActivationStatus } from "@/lib/product/activation";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ __orqena_review_state?: string }>;
}) {
  const query = await searchParams;
  if (isContinuousReviewStateProbe()) {
    if (query.__orqena_review_state === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    if (query.__orqena_review_state === "error") {
      throw new Error("CONTINUOUS_REVIEW_SYNTHETIC_RENDER_ERROR");
    }
  }
  const now = new Date();
  const auth = await requireCapability("company.view");
  const portal = await buildPortalManifest(auth);
  const agendaVisible = portal.navigation.some((item) => item.href === "/agenda") || portal.navigationGroups.some((group) => group.items.some((item) => item.href === "/agenda"));
  const [profile, agendaItems, activation] = await Promise.all([
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    agendaVisible ? getAgendaItems() : Promise.resolve([]),
    ["OWNER", "ADMINISTRATIVE"].includes(portal.profile)
      ? getAndMeasureActivationStatus(prisma, { companyId: auth.companyId, actorId: auth.userId })
      : Promise.resolve(null),
  ]);
  const displayName = userDisplayName(profile);
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const todayAgenda = agendaItems.filter((item) => item.estado !== "cancelado" && item.fechaInicio >= todayStart && item.fechaInicio < tomorrowStart).slice(0, 4);
  const destinations = [...portal.navigation, ...portal.navigationGroups.flatMap((group) => group.items)];
  const fullDate = capitalize(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));
  const experience = portalExperience(portal.profile);
  const seenPriorityDestinations = new Set<string>();
  const priorities = portal.homeWidgets
    .flatMap((widget) => {
      const destination = destinationForWidget(widget, destinations);
      if (!destination || seenPriorityDestinations.has(destination.href)) return [];
      seenPriorityDestinations.add(destination.href);
      return [{
        id: widget,
        title: homeWidgetLabel(widget),
        reason: homeWidgetReason(widget, portal.profile),
        origin: `${portal.profileLabel} · ${destination.label}`,
        impact: homeWidgetImpact(widget),
        href: destination.href,
        action: `Abrir ${destination.label.toLocaleLowerCase("es-ES")}`,
      }];
    })
    .slice(0, 3);
  const firstQuickAction = portal.quickActions[0];
  const dashboardDestination = destinations.find((item) => item.href === "/dashboard");

  return (
    <ProductPage layout="operational">
      <PageHeader
        eyebrow={fullDate}
        title="Hoy"
        description={`${greetingForDate(now)}${displayName ? `, ${displayName}` : ""}. Estas son las acciones que requieren atención dentro de tu portal de ${portal.profileLabel.toLocaleLowerCase("es-ES")}.`}
        secondaryActions={portal.orqenaTools.length ? <Link href="/capataz" aria-label="Preguntar a Orqena" className="secondary-button"><Bot size={18} aria-hidden="true" />Preguntar a {brand.assistantName}</Link> : undefined}
        action={firstQuickAction ? <Link href={firstQuickAction.href} className="primary-button"><Plus size={18} aria-hidden="true" />{firstQuickAction.label}</Link> : undefined}
      />

      <div data-portal-home={portal.profile}>
          <section aria-labelledby="portal-priorities" className={`section-shell portal-priorities portal-priorities--${experience.tone}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><p className="type-label">{experience.label}</p><h2 id="portal-priorities" className="type-section-title mt-1 text-content">Prioridades de hoy</h2></div>
              <Status tone="neutral">{priorities.length} en foco</Status>
            </div>
            {priorities.length ? (
              <ol className="grid gap-3 xl:grid-cols-3" data-priority-count={priorities.length}>
                {priorities.map((priority, index) => (
                  <li key={priority.id} className="flex min-h-60 flex-col rounded-xl border border-border bg-surface p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft font-semibold text-brand-strong" aria-hidden="true">{index + 1}</span>
                      <Status tone="neutral">En foco</Status>
                    </div>
                    <h3 className="type-object-title mt-4 text-content">{priority.title}</h3>
                    <p className="type-secondary mt-2">{priority.reason}</p>
                    <dl className="mt-4 grid gap-2 border-t border-border pt-3">
                      <div><dt className="type-label">Origen:</dt><dd className="type-meta mt-1">{priority.origin}</dd></div>
                      <div><dt className="type-label">Impacto:</dt><dd className="type-meta mt-1">{priority.impact}</dd></div>
                    </dl>
                    <Link href={priority.href} className="secondary-button mt-auto w-full">{priority.action}<ArrowUpRight size={16} aria-hidden="true" /></Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No hay prioridades disponibles en tu alcance" description="Tu portal no muestra módulos operativos adicionales. Mantén la agenda al día o consulta a la persona responsable de los permisos." icon={CalendarDays} />
            )}
          </section>

          <div className={`mt-5 grid gap-5 ${agendaVisible ? "xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.9fr)]" : ""}`}>
            {agendaVisible ? <section aria-labelledby="today-agenda" className="section-shell">
              <div className="mb-4 flex items-start justify-between gap-3"><div><p className="type-label">Solo dentro de tu alcance</p><h2 id="today-agenda" className="type-section-title mt-1 text-content">Agenda de hoy</h2></div><Link href="/agenda?vista=hoy" className="ghost-button">Ver agenda</Link></div>
              {todayAgenda.length ? <div className="divide-y divide-border">{todayAgenda.map((item) => <Link key={`${item.source}-${item.id}`} href={item.href} className="grid min-h-16 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-subtle"><span className="font-semibold tabular-nums text-brand-strong">{timeLabel(item.fechaInicio)}</span><span className="min-w-0"><span className="type-object-title block truncate text-content">{item.titulo}</span><span className="type-meta mt-1 block truncate">{item.clienteNombre ?? item.obraTitulo ?? "Agenda interna"}</span></span><ArrowUpRight size={16} className="text-content-tertiary" aria-hidden="true" /></Link>)}</div> : <div className="rounded-xl bg-subtle p-4"><CalendarDays size={20} className="text-brand-strong" aria-hidden="true"/><p className="type-object-title mt-2 text-content">No tienes citas dentro de tu alcance para hoy.</p><p className="type-secondary mt-1">Usa la agenda para preparar una visita o mantén libre el día.</p>{portal.quickActions.some((item) => item.capability === "agenda.manage") ? <Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy" className="secondary-button mt-3">Añadir visita</Link> : null}</div>}
            </section> : null}

            <section aria-labelledby="today-pulse" className="section-shell">
              <div className="mb-3 flex items-start justify-between gap-3"><div><p className="type-label">Sin estimaciones inventadas</p><h2 id="today-pulse" className="type-section-title mt-1 text-content">Resumen del día</h2></div>{dashboardDestination ? <Link href={dashboardDestination.href} className="ghost-button">Dashboard</Link> : null}</div>
              <MetricGroup label="Pulso del portal" className="grid-cols-1">
                <Metric label="Áreas en foco" value={String(priorities.length)} detail="Máximo tres, según tus permisos" href={priorities[0]?.href} />
                <Metric label="Agenda de hoy" value={String(todayAgenda.length)} detail={agendaVisible ? "Citas dentro de tu alcance" : "Agenda no disponible en tu portal"} href={agendaVisible ? "/agenda?vista=hoy" : undefined} />
                <Metric label="Capturas disponibles" value={String(portal.quickActions.length)} detail="Acciones autorizadas para registrar" href={firstQuickAction?.href} />
              </MetricGroup>
            </section>
          </div>

          {portal.quickActions.length ? <section aria-labelledby="quick-actions" className="section-shell mt-5"><div className="mb-4"><p className="type-label">Captura rápida según permisos</p><h2 id="quick-actions" className="type-section-title mt-1 text-content">Registrar sin perder contexto</h2></div><div className="flex flex-wrap gap-2">{portal.quickActions.map((item) => <Link key={item.href} href={item.href} className="secondary-button"><Plus size={17} aria-hidden="true" />{item.label}</Link>)}</div></section> : null}
      </div>

      {activation ? <div className="mt-5"><ActivationChecklist status={activation}/></div> : null}
    </ProductPage>
  );
}

function isContinuousReviewStateProbe() {
  return process.env.NEXT_PUBLIC_APP_ENV === "preview"
    && process.env.CREDENTIAL_SCOPE === "preview";
}

function destinationForWidget(widget: string, destinations: Array<{ href: string; label: string }>) {
  const candidates: Record<string, string[]> = {
    clients: ["/clientes"], quotes: ["/presupuestos"], followups: ["/recordatorios"], agenda: ["/agenda"], tasks: ["/tareas"],
    work: ["/obras"], "assigned-work": ["/obras"], assignments: ["/obras"], documents: ["/documentos"], deliveries: ["/documentos"],
    collections: ["/dinero"], payments: ["/tesoreria", "/dinero"], invoices: ["/dinero"], "due-dates": ["/dinero"], treasury: ["/tesoreria"],
    suppliers: ["/proveedores"], requests: ["/proveedores"], orders: ["/proveedores"], materials: ["/gastos-materiales"],
    operation: ["/obras"], operations: ["/obras"], business: ["/dashboard"], economy: ["/dashboard"], decisions: ["/dashboard"], team: ["/equipo"],
    risks: ["/obras"], workload: ["/obras"], pipeline: ["/clientes"], "pending-data": ["/clientes"], progress: ["/obras"], "daily-plan": ["/agenda"]
  };
  return (candidates[widget] ?? []).map((href) => destinations.find((item) => item.href === href)).find(Boolean);
}

const homeWidgetLabels: Record<string, string> = {
  "assigned-reports": "Informes asignados",
  "assigned-work": "Trabajos asignados",
  agenda: "Agenda",
  approvals: "Aprobaciones",
  assignments: "Asignaciones",
  blockers: "Bloqueos",
  business: "Negocio",
  clients: "Clientes",
  collections: "Cobros",
  decisions: "Decisiones",
  deliveries: "Entregas",
  documents: "Documentos",
  economy: "Economía",
  followups: "Seguimientos",
  incidents: "Incidencias",
  invoices: "Facturas",
  materials: "Materiales",
  operation: "Operación",
  operations: "Operaciones",
  orders: "Pedidos",
  payments: "Pagos",
  period: "Periodo",
  pipeline: "Oportunidades",
  "pending-data": "Datos pendientes",
  progress: "Avance",
  quotes: "Presupuestos",
  requests: "Solicitudes",
  risks: "Riesgos",
  "sales-team": "Equipo comercial",
  "supplier-invoices": "Facturas de proveedores",
  suppliers: "Proveedores",
  tasks: "Tareas",
  team: "Equipo",
  treasury: "Tesorería",
  workload: "Carga de trabajo",
  work: "Trabajos",
  "daily-plan": "Plan del día",
  "due-dates": "Vencimientos"
};

function homeWidgetLabel(value: string) {
  return homeWidgetLabels[value] ?? "Área de trabajo";
}
function homeWidgetReason(value: string, profile: string) {
  if (profile === "WORKER") return `${homeWidgetLabel(value)}: información preparada para tu jornada y los trabajos que tienes asignados.`;
  return `${homeWidgetLabel(value)}: información preparada para las responsabilidades configuradas en tu perfil.`;
}
function homeWidgetImpact(value: string) {
  const impacts: Record<string, string> = {
    collections: "Conserva factura, vencimiento y cobro en su origen.",
    payments: "Conserva obligación, proveedor y fecha en su origen.",
    invoices: "Abre el documento y su saldo autorizado sin resumirlo fuera de contexto.",
    treasury: "Mantiene caja, vencimientos y previsión trazables.",
    quotes: "Mantiene cliente, propuesta y siguiente acción conectados.",
    clients: "Mantiene relación, trabajo y siguiente acción conectados.",
    work: "Mantiene planificación, ejecución y costes dentro del trabajo.",
    "assigned-work": "Evita mezclar trabajos fuera de tu asignación.",
    tasks: "Mantiene instrucciones, fecha y avance en la tarea original.",
    suppliers: "Mantiene proveedor, documentación y compras relacionados.",
    documents: "Mantiene archivo, entidad y estado documental relacionados.",
  };
  return impacts[value] ?? "Abre el dato original y mantiene la siguiente acción dentro de su contexto.";
}
function timeLabel(date: Date) { return date.getHours() === 0 && date.getMinutes() === 0 ? "Sin hora" : new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date); }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

function portalExperience(profile: string) {
  const experiences: Record<string, { label: string; title: string; description: string; priorityTitle: string; flow: string[]; tone: string }> = {
    SALES: { label: "Portal comercial", title: "Relaciones que deben avanzar hoy", description: "Clientes, presupuestos, seguimientos y agenda forman un pipeline legible.", priorityTitle: "Clientes y oportunidades", flow: ["Cliente", "Presupuesto", "Seguimiento", "Agenda"], tone: "sales" },
    FINANCE: { label: "Portal finanzas", title: "Vencimientos antes que sorpresas", description: "Cobros, pagos y tesorería conservan documento y fecha de origen.", priorityTitle: "Control económico del día", flow: ["Vencimiento", "Cobro", "Pago", "Tesorería"], tone: "finance" },
    PROCUREMENT: { label: "Portal compras", title: "De la solicitud a la recepción", description: "Proveedor, pedido y factura recibida permanecen relacionados con el trabajo.", priorityTitle: "Suministro y proveedores", flow: ["Solicitud", "Proveedor", "Recepción", "Factura"], tone: "procurement" },
    WORKER: { label: "Portal operativo", title: "Tu jornada, sin distracciones", description: "Tareas, trabajo, agenda y avance aparecen en el orden de ejecución.", priorityTitle: "Plan del día", flow: ["Tarea", "Instrucciones", "Avance", "Cierre"], tone: "worker" },
  };
  return experiences[profile] ?? { label: "Portal personal", title: "Decisiones conectadas", description: "Prioridades, contexto y acciones según tu responsabilidad.", priorityTitle: "Tus prioridades", flow: ["Revisar", "Decidir", "Coordinar", "Continuar"], tone: "general" };
}
