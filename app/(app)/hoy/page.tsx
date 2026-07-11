import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock,
  Euro,
  FileText,
  Lightbulb,
  Package,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardCreateMenu } from "@/components/dashboard-create-menu";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { EmptyState, Notice, PageHeader } from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { getTodayRecommendationBrief } from "@/lib/business-recommendations";
import { getTodaySignalBrief } from "@/lib/business-signals";
import { buildTodayDashboard, greetingForDate, invoiceLiveStatus } from "@/lib/dashboard-hoy";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion, userDisplayName } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/queries";
import { getTodayTreasurySignals } from "@/lib/treasury";

export const dynamic = "force-dynamic";

const quickActions = [
  { href: "/gestion?tipo=cliente&returnTo=/hoy", label: "Cliente", detail: "Nuevo contacto", icon: Users },
  { href: "/gestion?tipo=obra&returnTo=/hoy", label: "Obra", detail: "Trabajo activo", icon: BriefcaseBusiness },
  { href: "/gestion?tipo=presupuesto&returnTo=/hoy", label: "Presupuesto", detail: "Crear borrador", icon: FileText },
  { href: "/gestion?tipo=factura&returnTo=/hoy", label: "Factura", detail: "Emitir o preparar", icon: Receipt },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy", label: "Visita", detail: "Agendar cita", icon: CalendarClock },
  { href: "/capataz", label: "Capataz", detail: "Hablar con IA", icon: Bot }
];

export default async function TodayPage() {
  const now = new Date();
  const [{ clients, works, budgets, invoices, materials, reminders, expenses }, agendaItems, profile, company, treasurySignals, signalBrief, recommendationBrief] = await Promise.all([
    getDashboardData(),
    getAgendaItems(),
    prisma.usuarioPerfil.findFirst(),
    prisma.empresa.findFirst(),
    getTodayTreasurySignals(),
    getTodaySignalBrief(4),
    getTodayRecommendationBrief(4)
  ]);

  const dashboard = buildTodayDashboard({ clients, works, budgets, invoices, materials, reminders, expenses, agendaItems }, now);
  const displayName = userDisplayName(profile);
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length + companyStatus.missingRecommended.length;
  const currentDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "2-digit", month: "long" }).format(now);
  const topPriority = dashboard.priorities[0];

  return (
    <main className="screen">
      <PageHeader
        eyebrow={currentDate}
        title={`${greetingForDate(now)}${displayName ? `, ${displayName}` : ""}.`}
        description={dashboard.dailySummary}
        action={<DashboardCreateMenu />}
        secondaryActions={
          <>
            <Link href="/buscar" className="secondary-button">
              <Search size={18} />
              Buscar
            </Link>
            <Link href="/capataz" className="secondary-button">
              <Bot size={18} />
              Capataz
            </Link>
          </>
        }
      />

      {companyMissing ? (
        <Notice
          tone="warning"
          title="Datos de empresa incompletos"
          description={`Faltan ${companyMissing} datos de empresa para que presupuestos y facturas salgan completos.`}
          action={
            <Link href="/configuracion#empresa" className="secondary-button bg-white">
              Completar datos
            </Link>
          }
        />
      ) : null}

      {treasurySignals.length ? (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-black"><AlertTriangle size={18} /> Tesorería</p>
              <div className="mt-2 grid gap-1 text-sm leading-6">
                {treasurySignals.slice(0, 3).map((alert) => (
                  <p key={alert.id}>{alert.title}: {alert.detail}</p>
                ))}
              </div>
            </div>
            <Link href="/tesoreria" className="secondary-button bg-white">Abrir tesorería</Link>
          </div>
        </section>
      ) : null}

      {recommendationBrief.recommendations.length ? (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-black"><Lightbulb size={18} /> Recomendaciones operativas</p>
              <div className="mt-2 grid gap-1 text-sm leading-6">
                {recommendationBrief.recommendations.slice(0, 3).map((recommendation) => (
                  <p key={recommendation.fingerprint}>
                    <span className="font-black">Prioridad {recommendation.priority}</span> · {recommendation.title}: {recommendation.summary}
                  </p>
                ))}
              </div>
            </div>
            <Link href="/recomendaciones" className="secondary-button bg-white">
              Abrir recomendaciones
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      ) : null}

      {signalBrief.signals.length ? (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-black text-obra-ink"><ShieldAlert size={18} /> Alertas operativas</p>
              <div className="mt-2 grid gap-1 text-sm leading-6 text-slate-600">
                {signalBrief.signals.slice(0, 3).map((signal) => (
                  <p key={signal.fingerprint}>
                    <span className="font-black text-obra-ink">{signal.levelText}</span> · {signal.title}: {signal.explanation.why}
                  </p>
                ))}
              </div>
            </div>
            <Link href="/alertas" className="secondary-button">
              Abrir alertas
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-obra-ink p-5 text-white shadow-card">
          <p className="text-sm font-bold text-obra-yellow">Resumen del día</p>
          <h2 className="mt-2 text-2xl font-black leading-tight">{dashboard.dailySummary}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SummaryMetric label="Eventos" value={dashboard.counts.eventsToday} />
            <SummaryMetric label="Seguimientos" value={dashboard.counts.followUpsToday} />
            <SummaryMetric label="Vencidas" value={dashboard.counts.overdueInvoices} />
            <SummaryMetric label="Por cobrar" value={formatCurrency(dashboard.money.pendingCollection)} />
          </div>
          <Link href="#prioridades" className="secondary-button mt-5 border-white/25 bg-white/10 text-white hover:bg-white/15">
            Ver prioridades
            <ArrowRight size={18} />
          </Link>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="label">Próxima acción importante</p>
          {topPriority ? (
            <div className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-obra-ink">{topPriority.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{topPriority.detail}</p>
                </div>
                <StatusPill status={topPriority.status} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">{topPriority.type} · {formatDate(topPriority.date)}</p>
              <Link href={topPriority.href} className="primary-button mt-4 w-full">
                {topPriority.action}
              </Link>
            </div>
          ) : (
            <EmptyState title="Sin prioridades urgentes" description="No hay facturas vencidas, visitas ni seguimientos destacados para hoy." icon={CheckCircle2} />
          )}
        </article>
      </section>

      <section className="mt-5">
        <SectionHeader title="Acciones rápidas" description="Las tareas más habituales sin pasar por el chat." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {quickActions.map((action) => (
            <QuickAction key={action.href} {...action} />
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard href="/dinero?filtro=pendientes" title="Pendiente de cobro" value={formatCurrency(dashboard.money.pendingCollection)} detail={`${dashboard.counts.pendingInvoices} facturas abiertas`} icon={WalletCards} tone="success" />
        <StatCard href="/dinero?filtro=vencidas" title="Facturas vencidas" value={String(dashboard.counts.overdueInvoices)} detail={`${formatCurrency(dashboard.money.overduePending)} pendientes`} icon={Receipt} tone={dashboard.counts.overdueInvoices ? "danger" : "neutral"} />
        <StatCard href="/presupuestos?filtro=pendientes" title="Presupuestos pendientes" value={String(dashboard.counts.pendingBudgets)} detail="Borradores, enviados y en revisión" icon={FileText} tone="warning" />
        <StatCard href="/obras?estado=en_curso" title="Obras activas" value={String(dashboard.counts.activeWorks)} detail="En curso, pausadas o pendientes" icon={BriefcaseBusiness} />
        <StatCard href="/dinero?filtro=todas" title="Facturación del mes" value={formatCurrency(dashboard.money.billedThisMonth)} detail="Solo facturas, no presupuestos" icon={Euro} />
        <StatCard href="/gastos-materiales" title="Gastos del mes" value={formatCurrency(dashboard.money.expensesThisMonth)} detail={`${dashboard.counts.pendingMaterials} materiales pendientes`} icon={Package} tone="warning" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <DashboardSection
            id="prioridades"
            title="Prioridades"
            description="Máximo 5 elementos ordenados por urgencia real."
            action={<Link href="/agenda?vista=hoy" className="secondary-button">Agenda</Link>}
          >
            {dashboard.priorities.length ? (
              <div className="grid gap-3">
                {dashboard.priorities.map((item) => (
                  <PriorityCard key={item.key} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState title="No hay prioridades urgentes" description="Todo lo crítico está controlado. Puedes revisar obras o preparar nuevos presupuestos." icon={CheckCircle2} />
            )}
          </DashboardSection>

          <DashboardSection
            title="Agenda de hoy"
            description="Visitas, llamadas, seguimientos y recordatorios ordenados por hora."
            action={<Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Añadir visita</Link>}
          >
            {dashboard.agendaToday.length ? (
              <div className="grid gap-3">
                {dashboard.agendaToday.map((item) => (
                  <AgendaCard key={`${item.source}-${item.id}`} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Hoy no tienes visitas ni reuniones"
                description="Añade una visita, llamada o seguimiento para que aparezca en tu agenda diaria."
                icon={CalendarClock}
                action={<Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy" className="secondary-button">Añadir visita</Link>}
              />
            )}
          </DashboardSection>

          <DashboardSection title="Actividad reciente" description="Últimos movimientos reales registrados en Capataz.">
            {dashboard.recentActivity.length ? (
              <div className="grid gap-2">
                {dashboard.recentActivity.map((activity) => (
                  <ActivityRow key={activity.key} item={activity} />
                ))}
              </div>
            ) : (
              <EmptyState title="Aún no hay actividad" description="Cuando crees clientes, facturas, pagos o gastos aparecerán aquí." icon={Activity} />
            )}
          </DashboardSection>
        </div>

        <aside className="grid gap-6">
          <DashboardSection
            title="Cobros y facturas"
            description="Vencidas, próximas y de mayor importe pendiente."
            action={<Link href="/dinero?filtro=pendientes" className="secondary-button">Ver todas</Link>}
          >
            {dashboard.receivables.length ? (
              <div className="grid gap-3">
                {dashboard.receivables.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} now={now} />
                ))}
              </div>
            ) : (
              <EmptyState title="No hay facturas pendientes" description="No tienes cobros abiertos ahora mismo." icon={WalletCards} />
            )}
          </DashboardSection>

          <DashboardSection
            title="Presupuestos por revisar"
            description="Borradores, enviados y pendientes de respuesta."
            action={<Link href="/presupuestos?filtro=pendientes" className="secondary-button">Ver todos</Link>}
          >
            {dashboard.pendingBudgets.length ? (
              <div className="grid gap-3">
                {dashboard.pendingBudgets.map((budget) => (
                  <BudgetCard key={budget.id} budget={budget} />
                ))}
              </div>
            ) : (
              <EmptyState title="No hay presupuestos pendientes" description="Los presupuestos activos aparecerán aquí cuando requieran revisión o seguimiento." icon={FileText} />
            )}
          </DashboardSection>

          <DashboardSection
            title="Obras activas"
            description="Trabajos en curso o pendientes sin inventar progreso."
            action={<Link href="/obras" className="secondary-button">Ver obras</Link>}
          >
            {dashboard.activeWorks.length ? (
              <div className="grid gap-3">
                {dashboard.activeWorks.map((work) => (
                  <WorkCard key={work.id} work={work} />
                ))}
              </div>
            ) : (
              <EmptyState title="Aún no hay obras activas" description="Crea una obra desde un presupuesto aceptado o añádela manualmente." icon={BriefcaseBusiness} />
            )}
          </DashboardSection>
        </aside>
      </div>
    </main>
  );
}

function DashboardSection({
  id,
  title,
  description,
  action,
  children
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <SectionHeader title={title} description={description} action={action} />
      {children}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <p className="text-xs font-bold uppercase text-white/65">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function QuickAction({ href, label, detail, icon: Icon }: { href: string; label: string; detail: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="group rounded-xl border border-slate-200 bg-white p-3 shadow-soft transition hover:border-obra-yellowDark hover:bg-obra-yellow/10">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-obra-yellow/20 text-obra-yellowDark">
        <Icon size={19} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-black text-obra-ink">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </Link>
  );
}

function PriorityCard({ item }: { item: ReturnType<typeof buildTodayDashboard>["priorities"][number] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-500">{item.type}</p>
          <h3 className="mt-1 text-base font-black text-obra-ink">{item.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500">{formatDate(item.date)}</p>
        <Link href={item.href} className="secondary-button min-h-10 px-3 py-1 text-xs">
          {item.action}
        </Link>
      </div>
    </article>
  );
}

function AgendaCard({ item }: { item: ReturnType<typeof buildTodayDashboard>["agendaToday"][number] }) {
  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
            <Clock size={15} className="text-obra-graphite" />
            {timeLabel(item.fechaInicio)} · {agendaTypeLabel(item.tipo)}
          </p>
          <h3 className="mt-1 text-base font-black text-obra-ink">{item.titulo}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {item.clienteNombre ?? item.descripcion ?? "Agenda interna"}
            {item.direccion ? ` · ${shorten(item.direccion, 42)}` : ""}
          </p>
        </div>
        <StatusPill status={item.estado} />
      </div>
      <Link href={item.href} className="secondary-button mt-3 min-h-10 px-3 py-1 text-xs">
        {item.editable ? "Editar" : "Abrir"}
      </Link>
    </article>
  );
}

function InvoiceCard({ invoice, now }: { invoice: ReturnType<typeof buildTodayDashboard>["receivables"][number]; now: Date }) {
  const liveStatus = invoiceLiveStatus(invoice, now);

  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{invoice.numero}</p>
          <h3 className="mt-1 text-base font-black text-obra-ink">{invoice.client.nombre}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{invoice.concepto}</p>
        </div>
        <StatusPill status={liveStatus} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Mini label="Pendiente" value={formatCurrency(invoice.pendiente)} />
        <Mini label="Vence" value={formatDate(invoice.fechaVencimiento)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/dinero/${invoice.id}`} className="primary-button min-h-10 px-3 py-1 text-xs">Ver factura</Link>
        <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/hoy`} className="secondary-button min-h-10 px-3 py-1 text-xs">Registrar pago</Link>
      </div>
    </article>
  );
}

function BudgetCard({ budget }: { budget: ReturnType<typeof buildTodayDashboard>["pendingBudgets"][number] }) {
  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{budget.numero}</p>
          <h3 className="mt-1 text-base font-black text-obra-ink">{budget.client.nombre}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{budget.titulo}</p>
        </div>
        <StatusPill status={budget.estado} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Mini label="Importe" value={formatCurrency(budget.total)} />
        <Mini label="Fecha" value={formatDate(budget.fechaSeguimiento ?? budget.fechaEnvio ?? budget.fechaCreacion)} />
      </div>
      <Link href={`/presupuestos/${budget.id}`} className="secondary-button mt-3 min-h-10 px-3 py-1 text-xs">
        Ver presupuesto
      </Link>
    </article>
  );
}

function WorkCard({ work }: { work: ReturnType<typeof buildTodayDashboard>["activeWorks"][number] }) {
  const pendingInvoices = work.invoices?.reduce((sum, invoice) => sum + invoice.pendiente, 0) ?? 0;

  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-obra-ink">{work.titulo}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{work.client.nombre}{work.direccion ? ` · ${shorten(work.direccion, 42)}` : ""}</p>
        </div>
        <StatusPill status={work.estado} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Mini label="Presupuesto" value={formatCurrency(work.presupuestoAprobado ?? 0)} />
        <Mini label="Pendiente cobro" value={formatCurrency(pendingInvoices)} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">
        Próxima tarea: {work.nextAgendaItem ? `${work.nextAgendaItem.titulo} · ${formatDate(work.nextAgendaItem.fechaInicio)}` : "Sin tarea programada"}
      </p>
      <Link href={`/obras?buscar=${encodeURIComponent(work.titulo)}`} className="secondary-button mt-3 min-h-10 px-3 py-1 text-xs">
        Ver obra
      </Link>
    </article>
  );
}

function ActivityRow({ item }: { item: ReturnType<typeof buildTodayDashboard>["recentActivity"][number] }) {
  const Icon = activityIcon(item.icon);
  return (
    <Link href={item.href} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-obra-yellowDark hover:bg-obra-yellow/10">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-obra-graphite">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-obra-ink">{item.title}</span>
        <span className="mt-1 block text-xs font-semibold text-slate-500">{relativeDate(item.date)}</span>
      </span>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black tabular-nums text-obra-ink">{value}</p>
    </div>
  );
}

function agendaTypeLabel(type: string) {
  const labels: Record<string, string> = {
    visita: "Visita",
    llamada: "Llamada",
    seguimiento_presupuesto: "Seguimiento",
    seguimiento_cobro: "Cobro",
    recordatorio_interno: "Recordatorio",
    compra_material: "Material",
    vencimiento_factura: "Vencimiento"
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function timeLabel(date: Date) {
  if (date.getHours() === 0 && date.getMinutes() === 0) return "Sin hora";
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function relativeDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (Math.abs(diffDays) >= 1) {
    return new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" }).format(diffDays, "day");
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) >= 1) {
    return new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" }).format(diffHours, "hour");
  }
  return "Hace unos minutos";
}

function shorten(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function activityIcon(type: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    client: Users,
    work: BriefcaseBusiness,
    budget: FileText,
    invoice: Receipt,
    payment: Banknote,
    expense: Package
  };
  return icons[type] ?? Activity;
}
