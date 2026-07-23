import Link from "next/link";
import type { ReactNode } from "react";
import { Bot, CheckCircle2, Users } from "lucide-react";
import {
  EmptyState,
  Metric,
  MetricGroup,
  PageHeader,
  ProductPage,
  Status,
  TimelineItem
} from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { buildTodayDashboard, greetingForDate } from "@/lib/dashboard-hoy";
import { formatCurrency } from "@/lib/format";
import { userDisplayName } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/queries";
import { getEconomicControl } from "@/lib/economic-control/queries";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { getTodayOperationalSignals } from "@/lib/operational-intelligence/queries";
import { OperationalSignalList, operationalCategoryLabels } from "@/components/operational-signals";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const now = new Date();
  const query = await searchParams;
  const auth = await requireCapability("company.view");
  const economicAllowed = (await resolveAuthorization(auth, "reports.view")).allowed;
  const [{ clients, works, budgets, invoices, materials, reminders, expenses }, agendaItems, profile, treasury, intelligence] = await Promise.all([
    getDashboardData(economicAllowed),
    getAgendaItems(),
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    economicAllowed ? getEconomicControl({ period: "30d" }) : Promise.resolve(null),
    getTodayOperationalSignals({ category: query.categoria, limit: query.categoria ? 20 : 3 })
  ]);

  const dashboard = buildTodayDashboard({ clients, works, budgets, invoices, materials, reminders, expenses, agendaItems }, now);
  const displayName = userDisplayName(profile);
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterTomorrow = addDays(todayStart, 2);
  const todayAgenda = agendaItems.filter((item) => item.estado !== "cancelado" && item.fechaInicio >= todayStart && item.fechaInicio < tomorrowStart);
  const upcomingToday = todayAgenda.filter((item) => item.fechaInicio >= now);
  const nextAppointment = upcomingToday[0] ?? todayAgenda[0] ?? null;
  const tomorrowFirst = agendaItems.find((item) => item.estado !== "cancelado" && item.fechaInicio >= tomorrowStart && item.fechaInicio < dayAfterTomorrow) ?? null;
  const workRisks = works.filter((work) => ["pendiente_material", "pendiente_remates", "pendiente_cobro", "pausada", "parada"].includes(work.estado));
  const isInitial = clients.length === 0 && works.length === 0 && budgets.length === 0 && invoices.length === 0 && agendaItems.length === 0;
  const fullDate = capitalize(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));

  return (
    <ProductPage layout="operational">
      <PageHeader
        eyebrow={fullDate}
        title={`${greetingForDate(now)}${displayName ? `, ${displayName}` : ""}`}
        description={dashboard.dailySummary}
        action={<Link href="/capataz" className="primary-button"><Bot size={18} aria-hidden="true" />Hablar con Orqena</Link>}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,.6fr)]">
        <section id="necesita-atencion" aria-labelledby="today-attention" className="section-shell scroll-mt-24">
          <SectionHeading id="today-attention" title="Necesita tu atención" description="Lo más importante, ordenado por urgencia." />
          <nav aria-label="Filtrar señales operativas" className="-mx-1 mb-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
            <Link href="/hoy" aria-current={!query.categoria ? "page" : undefined} className={`${!query.categoria ? "secondary-button border-brand text-brand-strong" : "ghost-button"} shrink-0 snap-start`}>Todas</Link>
            {Object.entries(operationalCategoryLabels).map(([id, label]) => <Link key={id} href={`/hoy?categoria=${id}`} aria-current={query.categoria === id ? "page" : undefined} className={`${query.categoria === id ? "secondary-button border-brand text-brand-strong" : "ghost-button"} shrink-0 snap-start`}>{label}</Link>)}
          </nav>
          {isInitial ? (
            <EmptyState
              title="Empieza por tu primer cliente"
              description="Orqena podrá ordenar prioridades cuando exista trabajo real. Empieza creando un cliente, un trabajo o una visita."
              icon={Users}
              action={<Link href="/gestion?tipo=cliente&returnTo=/hoy" className="secondary-button">Crear primer cliente</Link>}
            />
          ) : intelligence.signals.length ? (
            <OperationalSignalList signals={intelligence.signals} />
          ) : (
            <div className="rounded-xl bg-success/5 p-4">
              <div className="flex gap-3">
                <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                <div><h3 className="type-object-title text-content">No tienes asuntos urgentes ahora mismo.</h3><p className="type-secondary mt-1">Puedes continuar con la próxima cita o revisar una obra activa.</p></div>
              </div>
            </div>
          )}
          {!query.categoria && intelligence.context.signals.length > intelligence.signals.length ? <Link href="/hoy?categoria=planificacion" className="ghost-button mt-3">Explorar por categoría</Link> : null}
        </section>

        <section aria-labelledby="today-agenda" className="section-shell">
          <SectionHeading id="today-agenda" title="Agenda inmediata" description="Lo siguiente de hoy y la primera referencia de mañana." action={<Link href="/agenda?vista=hoy" className="ghost-button">Ver agenda</Link>} />
          {nextAppointment ? <FeaturedAppointment item={nextAppointment} now={now} /> : (
            <div className="rounded-xl bg-subtle p-4">
              <p className="type-object-title text-content">Hoy no tienes citas.</p>
              <p className="type-secondary mt-1">{tomorrowFirst ? `La próxima es mañana: ${tomorrowFirst.titulo}.` : "Puedes añadir una visita cuando la necesites."}</p>
              <Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy" className="secondary-button mt-3">Añadir visita</Link>
            </div>
          )}
          {todayAgenda.filter((item) => item.id !== nextAppointment?.id).slice(0, 3).map((item) => (
            <Link key={`${item.source}-${item.id}`} href={item.href} className="flex min-h-14 items-center justify-between gap-3 border-b border-border py-3 last:border-0 hover:bg-subtle">
              <span className="min-w-0"><span className="type-object-title block text-content">{timeLabel(item.fechaInicio)} · {item.titulo}</span><span className="type-meta mt-1 block">{item.clienteNombre ?? item.obraTitulo ?? "Agenda interna"}</span></span>
              <span className="text-sm font-semibold text-brand-strong">Abrir</span>
            </Link>
          ))}
          {tomorrowFirst ? <p className="type-meta mt-3 border-t border-border pt-3">Mañana · {timeLabel(tomorrowFirst.fechaInicio)} · {tomorrowFirst.titulo}</p> : null}
        </section>
      </div>

      {!isInitial ? (
        <>
          <section aria-labelledby="today-pulse" className="section-shell mt-10">
            <SectionHeading id="today-pulse" title="Pulso del día" description="Solo señales que pueden cambiar una decisión inmediata." action={<Link href="/dashboard" className="ghost-button">Ver Dashboard</Link>} />
            <MetricGroup label="Pulso económico y operativo" className="xl:grid-cols-3">
              {economicAllowed && dashboard.money.overduePending > 0 ? <Metric href="/dinero?filtro=vencidas" label="Cobro vencido" value={formatCurrency(dashboard.money.overduePending)} detail={`${dashboard.counts.overdueInvoices} facturas requieren atención`} /> : null}
              {economicAllowed && treasury && treasury.forecast.outflows > 0 ? <Metric href="/tesoreria?vista=pagos&periodo=30d" label="Pagos próximos" value={formatCurrency(treasury.forecast.outflows)} detail={`${treasury.forecast.future.filter((item) => item.direction === "salida").length} vencimientos documentados a 30 días`} /> : null}
              {workRisks.length > 0 ? <Metric href="/obras" label="Obras con atención" value={String(workRisks.length)} detail="Bloqueadas, pausadas, con remates o cobro pendiente" /> : null}
              {workRisks.length === 0 && (!economicAllowed || (dashboard.money.overduePending === 0 && treasury?.forecast.outflows === 0)) ? <Metric href={economicAllowed ? "/dashboard" : "/obras"} label="Sin señales inmediatas" value="—" detail="No hay bloqueos operativos inmediatos" /> : null}
            </MetricGroup>
          </section>

          {dashboard.recentActivity.length ? (
            <section aria-labelledby="today-activity" className="section-shell mt-10">
              <SectionHeading id="today-activity" title="Actividad reciente" description="Los últimos cambios útiles para recuperar contexto." action={<Link href="/actividad" className="ghost-button">Ver actividad completa</Link>} />
              <div className="max-w-3xl">
                {dashboard.recentActivity.slice(0, 5).map((item, index, rows) => (
                  <TimelineItem key={item.key} title={item.title} meta={relativeDate(item.date)} last={index === rows.length - 1}>
                    <Link href={item.href} className="font-semibold text-brand-strong">Abrir origen</Link>
                  </TimelineItem>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </ProductPage>
  );
}

function SectionHeading({ id, title, description, action }: { id: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 id={id} className="type-section-title text-content">{title}</h2><p className="type-secondary mt-1">{description}</p></div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}

function FeaturedAppointment({ item, now }: { item: Awaited<ReturnType<typeof getAgendaItems>>[number]; now: Date }) {
  const upcoming = item.fechaInicio >= now;
  return (
    <article className="rounded-xl bg-brand-soft p-4">
      <p className="type-meta text-brand-strong">{upcoming ? "Próxima cita" : "Cita de hoy"} · {timeLabel(item.fechaInicio)}</p>
      <h3 className="type-object-title mt-2 text-content">{item.titulo}</h3>
      <p className="type-secondary mt-1">{item.clienteNombre ?? item.obraTitulo ?? "Agenda interna"}{item.direccion ? ` · ${item.direccion}` : ""}</p>
      <div className="mt-3 flex items-center justify-between gap-3"><Status tone={item.estado === "confirmado" ? "active" : "attention"}>{statusLabel(item.estado)}</Status><Link href={item.href} className="secondary-button">Abrir</Link></div>
    </article>
  );
}

function timeLabel(date: Date) {
  if (date.getHours() === 0 && date.getMinutes() === 0) return "Sin hora";
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function relativeDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  const days = Math.floor((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
