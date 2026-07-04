import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileText,
  Package,
  Plus,
  Receipt,
  Search,
  Users,
  WalletCards
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { addDays, getAgendaItems, itemsBetween, itemsForDay, startOfDay } from "@/lib/agenda";
import { formatCurrency, formatDate } from "@/lib/format";
import { companyCompletion, userDisplayName } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/queries";
import { deriveInvoiceStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [{ clients, works, budgets, invoices, materials, reminders }, agendaItems, profile, company] = await Promise.all([
    getDashboardData(),
    getAgendaItems(),
    prisma.usuarioPerfil.findFirst(),
    prisma.empresa.findFirst()
  ]);

  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);
  const agendaToday = itemsForDay(agendaItems, today);
  const agendaWeek = itemsBetween(agendaItems, today, weekEnd);
  const overdueInvoices = invoices.filter((invoice) => deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento) === "vencida");
  const partialInvoices = invoices.filter((invoice) => deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento) === "parcialmente_pagada");
  const pendingCollection = invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
  const collectedThisMonth = invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paymentSum, payment) => {
    const date = new Date(payment.fecha);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() ? paymentSum + payment.importe : paymentSum;
  }, 0), 0);
  const pendingBudgets = budgets.filter((budget) => ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"].includes(budget.estado));
  const followUps = agendaItems.filter((item) => item.tipo.includes("seguimiento") && item.estado !== "cancelado");
  const pendingMaterials = materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
  const activeWorks = works.filter((work) => ["pendiente_inicio", "en_curso", "pausada", "pendiente_material", "pendiente_remates", "pendiente_cobro"].includes(work.estado));
  const clientsWaiting = clients.filter((client) => ["nuevo", "pendiente_datos", "seguimiento_pendiente", "presupuesto_pendiente", "pendiente_cobro"].includes(client.estado));
  const programmedReminders = reminders.filter((reminder) => ["pendiente_confirmacion", "programado"].includes(reminder.estado));
  const nextVisit = agendaWeek.find((item) => item.tipo === "visita" && item.estado !== "cancelado");
  const latestBudget = budgets[0];
  const latestInvoice = invoices[0];
  const displayName = userDisplayName(profile);
  const companyStatus = companyCompletion(company);
  const companyMissing = companyStatus.missingRequired.length + companyStatus.missingRecommended.length;

  const actions = [
    ...agendaToday.filter((item) => ["visita", "seguimiento_presupuesto", "seguimiento_cobro", "compra_material"].includes(item.tipo)).map((item) => ({
      title: item.titulo,
      detail: `${item.clienteNombre ?? "Agenda"} · ${formatDate(item.fechaInicio)}`,
      href: "/agenda",
      status: item.estado
    })),
    ...overdueInvoices.map((invoice) => ({
      title: `Revisar factura vencida ${invoice.numero}`,
      detail: `${invoice.client.nombre} · ${formatCurrency(invoice.pendiente)} pendiente`,
      href: `/dinero/${invoice.id}`,
      status: "vencida"
    })),
    ...pendingBudgets.slice(0, 2).map((budget) => ({
      title: `Seguimiento ${budget.numero}`,
      detail: `${budget.client.nombre} · ${budget.titulo}`,
      href: `/presupuestos?filtro=pendientes`,
      status: budget.estado
    }))
  ].slice(0, 5);

  return (
    <main className="screen">
      <section className="mb-5">
        <p className="text-sm font-semibold text-slate-500">{new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</p>
        <h1 className="mt-1 text-3xl font-black text-obra-ink">Buenos días{displayName ? `, ${displayName}` : ""}. Todo claro para empezar.</h1>
        <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6 text-obra-ink shadow-card">
          Hoy tienes {agendaToday.filter((item) => item.tipo === "visita").length} visitas, {overdueInvoices.length} facturas vencidas y {followUps.length} seguimientos pendientes.
          {nextVisit ? ` Próxima cita: ${nextVisit.titulo} (${formatDate(nextVisit.fechaInicio)}).` : ""}
        </p>
        {companyMissing ? (
          <Link href="/configuracion#empresa" className="mt-3 block rounded-lg bg-obra-yellow/20 p-3 text-sm font-semibold leading-6 text-obra-yellowDark">
            {displayName ? `${displayName}, ` : ""}te faltan {companyMissing} datos de empresa para que los PDFs salgan completos.
          </Link>
        ) : null}
      </section>

      <form action="/buscar" className="card mb-5 flex gap-2 p-3">
        <input className="field" name="q" placeholder="Buscar cliente, factura vencida, cemento cola..." />
        <button type="submit" className="icon-button shrink-0" aria-label="Buscar">
          <Search size={20} />
        </button>
      </form>

      <section className="mb-5 grid grid-cols-6 gap-2">
        <QuickLink href="/agenda" label="Hoy" icon={CalendarClock} />
        <QuickLink href="/clientes" label="Clientes" icon={Users} />
        <QuickLink href="/obras" label="Obras" icon={ClipboardList} />
        <QuickLink href="/presupuestos" label="Presup." icon={FileText} />
        <QuickLink href="/dinero" label="Cobros" icon={WalletCards} />
        <QuickLink href="/capataz" label="Capataz" icon={Search} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard href="/agenda?vista=hoy" title="Eventos de hoy" value={String(agendaToday.length)} detail="Agenda interna" icon={CalendarClock} />
        <StatCard href="/agenda?vista=lista&tipo=visitas" title="Visitas próximas" value={String(agendaWeek.filter((item) => item.tipo === "visita").length)} detail="Próximos 7 días" icon={CalendarClock} />
        <StatCard href="/clientes?estado=nuevo" title="Leads nuevos" value={String(clients.filter((client) => client.estado === "nuevo").length)} detail="Entradas sin trabajar" icon={Users} tone="warning" />
        <StatCard href="/clientes?estado=seguimiento_pendiente" title="Clientes sin responder" value={String(clientsWaiting.length)} detail="Leads, presupuestos y cobros" icon={Users} tone="warning" />
        <StatCard href="/presupuestos?filtro=pendientes" title="Presupuestos pendientes" value={String(pendingBudgets.length)} detail="Borradores y enviados" icon={FileText} tone="warning" />
        <StatCard href="/agenda?vista=lista&tipo=seguimientos" title="Seguimientos" value={String(followUps.length)} detail="Presupuesto y cobro" icon={AlertTriangle} tone="warning" />
        <StatCard href="/dinero?filtro=vencidas" title="Facturas vencidas" value={String(overdueInvoices.length)} detail="Preparar reclamación" icon={Receipt} tone="danger" />
        <StatCard href="/dinero?filtro=pendientes" title="Pendiente cobrar" value={formatCurrency(pendingCollection)} detail={`Cobrado mes ${formatCurrency(collectedThisMonth)}`} icon={WalletCards} tone="success" />
        <StatCard href="/obras?estado=en_curso" title="Obras activas" value={String(activeWorks.length)} detail="En curso o pendientes" icon={ClipboardList} />
        <StatCard href="/gastos-materiales?filtro=pendientes" title="Material pendiente" value={String(pendingMaterials.length)} detail="Pendiente o falta" icon={Package} tone="warning" />
        <StatCard href="/recordatorios?filtro=pendientes" title="Recordatorios" value={String(programmedReminders.length)} detail="Pendientes o programados" icon={AlertTriangle} tone="warning" />
        <StatCard href="/agenda?vista=hoy" title="Tareas urgentes" value={String(actions.length)} detail="Prioridad de hoy" icon={AlertTriangle} tone="danger" />
      </section>

      <section className="mt-6">
        <SectionHeader title="Próximas acciones" description="Lo que conviene mirar primero." />
        <div className="grid gap-3">
          {actions.map((action) => (
            <Link key={`${action.title}-${action.href}`} href={action.href} className="card block p-4 transition hover:border-obra-yellowDark hover:bg-obra-yellow/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-obra-ink">{action.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{action.detail}</p>
                </div>
                <StatusPill status={action.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader title="Accesos rápidos" />
        <div className="grid grid-cols-2 gap-2">
          <Link href="/gestion?tipo=cliente&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Cliente</Link>
          <Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Visita</Link>
          <Link href="/gestion?tipo=presupuesto&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Presupuesto</Link>
          <Link href="/presupuestos/plantillas" className="secondary-button"><Plus size={18} /> Desde plantilla</Link>
          <Link href="/gestion?tipo=factura&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Factura</Link>
          <Link href="/gestion?tipo=gasto&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Gasto</Link>
          <Link href="/gestion?tipo=pago&returnTo=/hoy" className="secondary-button"><Plus size={18} /> Pago</Link>
          {latestBudget ? <Link href={`/presupuestos/${latestBudget.id}/pdf?preview=1`} target="_blank" className="secondary-button"><FileText size={18} /> PDF presupuesto</Link> : null}
          {latestInvoice ? <Link href={`/dinero/${latestInvoice.id}/pdf?preview=1`} target="_blank" className="secondary-button"><Receipt size={18} /> PDF factura</Link> : null}
          <Link href="/capataz" className="primary-button"><Search size={18} /> Hablar</Link>
        </div>
      </section>
    </main>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <Link href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-black text-obra-ink shadow-card transition hover:border-obra-yellowDark hover:bg-obra-yellow/10">
      <Icon size={19} />
      {label}
    </Link>
  );
}
