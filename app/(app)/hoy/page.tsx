import Link from "next/link";
import { Bot, CalendarDays } from "lucide-react";
import { PageHeader, ProductPage, Status } from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { requireCapability } from "@/lib/commercial/authorization";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { greetingForDate } from "@/lib/dashboard-hoy";
import { userDisplayName } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const auth = await requireCapability("company.view");
  const portal = await buildPortalManifest(auth);
  const agendaVisible = portal.navigation.some((item) => item.href === "/agenda") || portal.navigationGroups.some((group) => group.items.some((item) => item.href === "/agenda"));
  const [profile, agendaItems] = await Promise.all([
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    agendaVisible ? getAgendaItems() : Promise.resolve([])
  ]);
  const displayName = userDisplayName(profile);
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const todayAgenda = agendaItems.filter((item) => item.estado !== "cancelado" && item.fechaInicio >= todayStart && item.fechaInicio < tomorrowStart).slice(0, 4);
  const destinations = [...portal.navigation, ...portal.navigationGroups.flatMap((group) => group.items)];
  const fullDate = capitalize(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));

  return (
    <ProductPage layout="operational">
      <PageHeader
        eyebrow={fullDate}
        title={`${greetingForDate(now)}${displayName ? `, ${displayName}` : ""}`}
        description={`Tu portal de ${portal.profileLabel.toLocaleLowerCase("es-ES")} muestra únicamente el trabajo que te corresponde.`}
        action={portal.orqenaTools.length ? <Link href="/capataz" className="primary-button"><Bot size={18} aria-hidden="true" />Hablar con Orqena</Link> : undefined}
      />

      <section aria-labelledby="portal-priorities" className="section-shell">
        <div className="mb-4"><p className="type-label">Portal personal</p><h2 id="portal-priorities" className="type-section-title mt-1 text-content">Tus prioridades</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {portal.homeWidgets.slice(0, 3).map((widget) => {
            const destination = destinationForWidget(widget, destinations);
            const content = <><p className="type-object-title text-content">{homeWidgetLabel(widget)}</p><p className="type-secondary mt-1">{homeWidgetDescription(widget, portal.profile)}</p></>;
            return destination ? <Link key={widget} href={destination.href} className="card block p-4 transition hover:border-brand hover:bg-brand-soft/40">{content}<span className="mt-3 inline-block text-sm font-semibold text-brand-strong">Abrir {destination.label.toLocaleLowerCase("es-ES")}</span></Link> : <article key={widget} className="card p-4">{content}<Status tone="neutral" className="mt-3">En tu portal</Status></article>;
          })}
        </div>
      </section>

      {agendaVisible ? <section aria-labelledby="today-agenda" className="section-shell mt-8">
        <div className="mb-4 flex items-start justify-between gap-3"><div><p className="type-label">Solo dentro de tu alcance</p><h2 id="today-agenda" className="type-section-title mt-1 text-content">Agenda de hoy</h2></div><Link href="/agenda?vista=hoy" className="ghost-button">Ver agenda</Link></div>
        {todayAgenda.length ? <div className="divide-y divide-border">{todayAgenda.map((item) => <Link key={`${item.source}-${item.id}`} href={item.href} className="flex min-h-16 items-center justify-between gap-3 py-3 hover:bg-subtle"><span className="min-w-0"><span className="type-object-title block truncate text-content">{timeLabel(item.fechaInicio)} · {item.titulo}</span><span className="type-meta mt-1 block">{item.clienteNombre ?? item.obraTitulo ?? "Agenda interna"}</span></span><span className="text-sm font-semibold text-brand-strong">Abrir</span></Link>)}</div> : <div className="rounded-xl bg-subtle p-4"><CalendarDays size={20} className="text-brand-strong" aria-hidden="true"/><p className="type-object-title mt-2 text-content">No tienes citas dentro de tu alcance para hoy.</p>{portal.quickActions.some((item) => item.capability === "agenda.manage") ? <Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy" className="secondary-button mt-3">Añadir visita</Link> : null}</div>}
      </section> : null}

      {portal.quickActions.length ? <section aria-labelledby="quick-actions" className="section-shell mt-8"><div className="mb-4"><p className="type-label">Con tus permisos actuales</p><h2 id="quick-actions" className="type-section-title mt-1 text-content">Acciones rápidas</h2></div><div className="flex flex-wrap gap-2">{portal.quickActions.map((item) => <Link key={item.href} href={item.href} className="secondary-button">{item.label}</Link>)}</div></section> : null}
    </ProductPage>
  );
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
  return homeWidgetLabels[value] ?? value.replaceAll("-", " ").replace(/^./, (letter) => letter.toLocaleUpperCase("es-ES"));
}
function homeWidgetDescription(value: string, profile: string) { return `${homeWidgetLabel(value)}: información preparada para ${profile === "WORKER" ? "tu jornada y trabajos asignados" : "las responsabilidades de tu perfil"}.`; }
function timeLabel(date: Date) { return date.getHours() === 0 && date.getMinutes() === 0 ? "Sin hora" : new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date); }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
