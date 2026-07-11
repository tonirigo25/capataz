import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderOpen,
  Mail,
  MapPin,
  MessageCircle,
  NotebookText,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  UserRound,
  WalletCards
} from "lucide-react";
import { archiveClient, restoreClient } from "@/app/(app)/clientes/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { EmptyState, Notice, PageHeader } from "@/components/ui-primitives";
import { getClientCrmSummary } from "@/lib/client-crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

type DetailSearchParams = { tab?: string };

const tabs = [
  ["resumen", "Resumen"],
  ["contactos", "Contactos"],
  ["obras", "Obras"],
  ["presupuestos", "Presupuestos"],
  ["facturas", "Facturas"],
  ["pagos", "Pagos"],
  ["visitas", "Visitas y seguimientos"],
  ["documentos", "Documentos"],
  ["actividad", "Actividad"],
  ["notas", "Notas"],
  ["datos", "Datos"]
];

export default async function ClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<DetailSearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const summary = await getClientCrmSummary(id);
  if (!summary) notFound();

  const activeTab = tabs.some(([tab]) => tab === query.tab) ? query.tab ?? "resumen" : "resumen";
  const client = summary.client;
  const returnTo = `/clientes/${client.id}`;

  return (
    <main className="screen">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Clientes
      </Link>

      <PageHeader
        eyebrow={summary.listItem.typeLabel}
        title={summary.listItem.displayName}
        description={`${summary.listItem.fiscalName} · ${client.origen}`}
        badge={<StatusPill status={client.archivadoAt ? "archivado" : client.estado} />}
        action={<PrimaryActions clientId={client.id} clientName={summary.listItem.displayName} returnTo={returnTo} />}
        secondaryActions={<ArchiveActions id={client.id} archived={Boolean(client.archivadoAt)} />}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeaderFact icon={UserRound} label="Contacto principal" value={summary.listItem.primaryContact} detail={(summary.listItem.email ?? summary.listItem.phone) || "Sin contacto directo"} />
          <HeaderFact icon={Phone} label="Teléfono" value={summary.listItem.phone || "Sin teléfono"} detail={client.contactoPrincipalTelefono ? "Contacto principal" : "Cliente"} />
          <HeaderFact icon={Mail} label="Email" value={summary.listItem.email ?? "Sin email"} detail={client.emailFacturacion ? `Facturación: ${client.emailFacturacion}` : "Cliente"} />
          <HeaderFact icon={MapPin} label="Dirección fiscal" value={client.direccionFiscal ?? "Sin dirección fiscal"} detail={client.nifCif ? `NIF/CIF ${client.nifCif}` : "Sin NIF/CIF"} />
        </div>
      </PageHeader>

      {summary.listItem.pendingFields.length ? (
        <Notice
          tone="warning"
          title={`${summary.listItem.pendingFields.length} datos pendientes`}
          description={summary.listItem.pendingFields.slice(0, 4).join(" · ")}
          action={<Link href={`/gestion?tipo=cliente&id=${client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Completar datos</Link>}
        />
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Resumen ejecutivo del cliente">
        <StatCard title="Obras" value={`${summary.kpis.activeWorks}/${summary.kpis.totalWorks}`} detail="Activas / totales" icon={BriefcaseBusiness} />
        <StatCard title="Presupuestado" value={formatCurrency(summary.kpis.budgetedTotal)} detail="No cuenta como facturación" icon={FileText} />
        <StatCard title="Facturado" value={formatCurrency(summary.kpis.billedTotal)} detail="Sin borradores" icon={Receipt} />
        <StatCard title="Cobrado" value={formatCurrency(summary.kpis.paidTotal)} detail="Pagos reales" icon={WalletCards} tone="success" />
        <StatCard title="Pendiente" value={formatCurrency(summary.kpis.pendingTotal)} detail="Total menos pagos" icon={CircleDollarSign} tone={summary.kpis.pendingTotal > 0 ? "warning" : "success"} />
        <StatCard title="Vencidas" value={String(summary.kpis.overdueInvoices)} detail={`Contacto: ${formatDate(summary.kpis.lastContactAt)}`} icon={Bell} tone={summary.kpis.overdueInvoices > 0 ? "danger" : "neutral"} />
      </section>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Secciones de la ficha de cliente">
        {tabs.map(([tab, label]) => (
          <Link
            key={tab}
            href={`/clientes/${client.id}?tab=${tab}`}
            aria-current={activeTab === tab ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${activeTab === tab ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {activeTab === "resumen" ? <SummaryTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "contactos" ? <ContactsTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "obras" ? <WorksTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "presupuestos" ? <BudgetsTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "facturas" ? <InvoicesTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "pagos" ? <PaymentsTab summary={summary} /> : null}
        {activeTab === "visitas" ? <VisitsTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "documentos" ? <DocumentsTab summary={summary} /> : null}
        {activeTab === "actividad" ? <ActivityTab summary={summary} /> : null}
        {activeTab === "notas" ? <NotesTab summary={summary} returnTo={returnTo} /> : null}
        {activeTab === "datos" ? <DataTab summary={summary} returnTo={returnTo} /> : null}
      </div>
    </main>
  );
}

function PrimaryActions({ clientId, clientName, returnTo }: { clientId: string; clientName: string; returnTo: string }) {
  const encodedReturn = encodeURIComponent(returnTo);
  const visitDate = encodeURIComponent(tomorrowAtTenInputValue());
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/gestion?tipo=cliente&id=${clientId}&returnTo=${encodedReturn}`} className="secondary-button">
        <UserRound size={18} />
        Editar
      </Link>
      <Link href={`/gestion?tipo=obra&clienteId=${clientId}&returnTo=${encodedReturn}`} className="secondary-button">
        <BriefcaseBusiness size={18} />
        Crear obra
      </Link>
      <Link href={`/gestion?tipo=presupuesto&clienteId=${clientId}&returnTo=${encodedReturn}`} className="secondary-button">
        <FileText size={18} />
        Presupuesto
      </Link>
      <Link href={`/gestion?tipo=factura&clienteId=${clientId}&returnTo=${encodedReturn}`} className="secondary-button">
        <Receipt size={18} />
        Factura
      </Link>
      <Link href={`/gestion?tipo=eventoAgenda&clienteId=${clientId}&tipoEvento=visita&titulo=Visita%20con%20${encodeURIComponent(clientName)}&fechaInicio=${visitDate}&returnTo=${encodedReturn}`} className="secondary-button">
        <CalendarClock size={18} />
        Visita
      </Link>
      <Link href={`/gestion?tipo=recordatorio&clienteId=${clientId}&tipoRecordatorio=seguimiento_presupuesto&returnTo=${encodedReturn}`} className="secondary-button">
        <MessageCircle size={18} />
        Seguimiento
      </Link>
    </div>
  );
}

function ArchiveActions({ id, archived }: { id: string; archived: boolean }) {
  if (archived) {
    return (
      <form action={restoreClient}>
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmitButton className="secondary-button" message="¿Restaurar este cliente y volver a mostrarlo entre los activos?">
          <RotateCcw size={18} />
          Restaurar
        </ConfirmSubmitButton>
      </form>
    );
  }

  return (
    <form action={archiveClient}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton className="danger-button" message="El cliente se ocultará de la vista de activos, pero se conservarán sus obras, presupuestos, facturas y pagos.">
        <Archive size={18} />
        Archivar
      </ConfirmSubmitButton>
    </form>
  );
}

function SummaryTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="grid gap-4">
        <SectionList
          title="Obras activas"
          emptyTitle="Este cliente todavía no tiene obras activas."
          emptyAction={<Link href={`/gestion?tipo=obra&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear obra</Link>}
        >
          {summary.activeWorks.slice(0, 3).map((work) => (
            <WorkCard key={work.id} work={work} returnTo={returnTo} compact />
          ))}
        </SectionList>

        <SectionList title="Facturas pendientes" emptyTitle="No hay facturas pendientes.">
          {summary.pendingInvoices.slice(0, 3).map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} returnTo={returnTo} compact />
          ))}
        </SectionList>

        <SectionList title="Presupuestos recientes" emptyTitle="No hay presupuestos registrados.">
          {summary.recentBudgets.slice(0, 3).map((budget) => (
            <BudgetCard key={budget.id} budget={budget} returnTo={returnTo} compact />
          ))}
        </SectionList>
      </div>

      <aside className="grid gap-4">
        <SectionList title="Próximas visitas y tareas" emptyTitle="No hay visitas o tareas próximas.">
          {summary.upcomingEvents.slice(0, 4).map((event) => (
            <CompactRow key={event.id} icon={CalendarClock} title={event.titulo} detail={`${statusLabel(event.tipo)} · ${formatDate(event.fechaInicio)}`} href={`/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=${encodeURIComponent(returnTo)}`} />
          ))}
        </SectionList>

        <SectionList title="Seguimientos pendientes" emptyTitle="No hay seguimientos pendientes.">
          {summary.pendingReminders.slice(0, 4).map((reminder) => (
            <CompactRow key={reminder.id} icon={Bell} title={statusLabel(reminder.tipo)} detail={`${statusLabel(reminder.estado)} · ${formatDate(reminder.fechaProgramada)}`} href={`/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=${encodeURIComponent(returnTo)}`} />
          ))}
        </SectionList>

        <SectionList title="Actividad reciente" emptyTitle="Sin actividad reciente.">
          {summary.activity.slice(0, 5).map((event) => (
            <CompactRow key={event.id} icon={ClipboardList} title={event.text} detail={`${event.type} · ${formatDate(event.date)}`} href={event.href} />
          ))}
        </SectionList>
      </aside>
    </div>
  );
}

function ContactsTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  return (
    <SectionList
      title="Contactos"
      description="El modelo actual no tiene tabla de contactos múltiples; se muestran los contactos derivados del cliente y facturación."
      emptyTitle="No hay contactos separados registrados."
      emptyAction={<Link href={`/gestion?tipo=cliente&id=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Completar contactos</Link>}
    >
      {summary.contacts.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {summary.contacts.map((contact) => (
            <article key={contact.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-obra-ink">{contact.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{contact.role}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {contact.flags.map((flag) => <Badge key={flag}>{flag}</Badge>)}
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <p><strong className="text-obra-ink">Teléfono:</strong> {contact.phone ?? "Sin teléfono"}</p>
              <p><strong className="text-obra-ink">Email:</strong> {contact.email ?? "Sin email"}</p>
              {contact.notes ? <p><strong className="text-obra-ink">Notas:</strong> {contact.notes}</p> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/gestion?tipo=cliente&id=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Editar</Link>
              <Link href={`/gestion?tipo=eventoAgenda&clienteId=${summary.client.id}&tipoEvento=llamada&titulo=Llamada%20${encodeURIComponent(contact.name)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear llamada</Link>
            </div>
            </article>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function WorksTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  return (
    <SectionList
      title="Obras del cliente"
      emptyTitle="Este cliente todavía no tiene obras."
      emptyAction={<Link href={`/gestion?tipo=obra&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear obra</Link>}
    >
      {summary.client.works.length ? (
        <div className="grid gap-3">
          {summary.client.works.map((work) => <WorkCard key={work.id} work={work} returnTo={returnTo} />)}
        </div>
      ) : null}
    </SectionList>
  );
}

function BudgetsTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  return (
    <SectionList
      title="Presupuestos del cliente"
      emptyTitle="No hay presupuestos registrados."
      emptyAction={<Link href={`/gestion?tipo=presupuesto&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear presupuesto</Link>}
    >
      {summary.client.budgets.length ? (
        <div className="grid gap-3">
          {summary.client.budgets.map((budget) => <BudgetCard key={budget.id} budget={budget} returnTo={returnTo} />)}
        </div>
      ) : null}
    </SectionList>
  );
}

function InvoicesTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  return (
    <SectionList
      title="Facturas del cliente"
      emptyTitle="No hay facturas registradas."
      emptyAction={<Link href={`/gestion?tipo=factura&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear factura</Link>}
    >
      {summary.client.invoices.length ? (
        <div className="grid gap-3">
          {summary.client.invoices.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} returnTo={returnTo} />)}
        </div>
      ) : null}
    </SectionList>
  );
}

function PaymentsTab({ summary }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>> }) {
  return (
    <SectionList title="Pagos" emptyTitle="No hay pagos registrados.">
      {summary.payments.length ? (
        <div className="grid gap-3">
          {summary.payments.map((payment) => (
          <article key={payment.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="label">{payment.invoice.numero}</p>
                <h3 className="mt-1 font-black text-obra-ink">{formatCurrency(payment.importe)}</h3>
                <p className="mt-1 text-sm text-slate-500">{payment.invoice.concepto}</p>
              </div>
              <StatusPill status={payment.tipo} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <p><strong className="text-obra-ink">Fecha:</strong> {formatDate(payment.fecha)}</p>
              <p><strong className="text-obra-ink">Método:</strong> {payment.metodo}</p>
              <p><strong className="text-obra-ink">Obra:</strong> {payment.work?.titulo ?? "Sin obra"}</p>
            </div>
            {payment.notas ? <p className="mt-3 text-sm text-slate-600">{payment.notas}</p> : null}
          </article>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function VisitsTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionList
        title="Visitas y reuniones"
        emptyTitle="No hay visitas registradas."
        emptyAction={<Link href={`/gestion?tipo=eventoAgenda&clienteId=${summary.client.id}&tipoEvento=visita&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Registrar visita</Link>}
      >
        {summary.client.agendaEvents.map((event) => (
          <CompactRow key={event.id} icon={CalendarClock} title={event.titulo} detail={`${statusLabel(event.tipo)} · ${statusLabel(event.estado)} · ${formatDate(event.fechaInicio)}`} href={`/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=${encodeURIComponent(returnTo)}`} />
        ))}
      </SectionList>

      <SectionList
        title="Seguimientos"
        emptyTitle="No hay seguimientos pendientes."
        emptyAction={<Link href={`/gestion?tipo=recordatorio&clienteId=${summary.client.id}&tipoRecordatorio=seguimiento_presupuesto&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear seguimiento</Link>}
      >
        {summary.client.reminders.map((reminder) => (
          <CompactRow key={reminder.id} icon={Bell} title={statusLabel(reminder.tipo)} detail={`${statusLabel(reminder.estado)} · ${formatDate(reminder.fechaProgramada)} · ${reminder.canal}`} href={`/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=${encodeURIComponent(returnTo)}`} />
        ))}
      </SectionList>
    </div>
  );
}

function DocumentsTab({ summary }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>> }) {
  return (
    <SectionList
      title="Documentos"
      description="No existe un centro documental genérico; se centralizan los PDFs de presupuestos y facturas ya disponibles."
      emptyTitle="No hay documentos asociados."
    >
      {summary.documents.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {summary.documents.map((document) => (
            <Link key={document.id} href={document.href} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-obra-yellowDark hover:bg-obra-muted">
            <p className="label">{document.type}</p>
            <h3 className="mt-1 font-black text-obra-ink">{document.name}</h3>
            <p className="mt-2 text-sm text-slate-500">{document.relatedLabel}</p>
            <p className="mt-1 text-sm font-bold text-slate-600">{formatDate(document.date)}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function ActivityTab({ summary }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>> }) {
  return (
    <SectionList title="Actividad reciente" emptyTitle="Sin actividad reciente.">
      {summary.activity.length ? (
        <div className="card divide-y divide-slate-100">
          {summary.activity.map((event) => (
            <div key={event.id} className="flex gap-3 p-4">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-obra-yellow/25 text-obra-yellowDark">
              <ClipboardList size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-black text-obra-ink">{event.text}</p>
              <p className="mt-1 text-sm text-slate-500">{event.type} · {formatDate(event.date)}</p>
              {event.href ? <Link href={event.href} className="mt-2 inline-flex text-sm font-bold text-obra-ink underline underline-offset-4">Ver entidad</Link> : null}
            </div>
            </div>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function NotesTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  const notes = [
    summary.client.notas ? { id: "client", title: "Nota interna del cliente", text: summary.client.notas, date: summary.client.ultimaInteraccion ?? summary.client.fechaCreacion } : null,
    ...summary.client.works.filter((work) => work.notas).map((work) => ({ id: `work-${work.id}`, title: `Obra: ${work.titulo}`, text: work.notas ?? "", date: work.fechaInicio ?? summary.client.fechaCreacion })),
    ...summary.client.agendaEvents.filter((event) => event.notas).map((event) => ({ id: `event-${event.id}`, title: event.titulo, text: event.notas ?? "", date: event.fechaInicio })),
    ...summary.client.reminders.filter((reminder) => reminder.mensaje).map((reminder) => ({ id: `reminder-${reminder.id}`, title: statusLabel(reminder.tipo), text: reminder.mensaje, date: reminder.fechaProgramada }))
  ].filter(Boolean) as Array<{ id: string; title: string; text: string; date: Date }>;

  return (
    <SectionList
      title="Notas internas"
      description="Estas notas son internas y no se usan en PDFs de cliente."
      emptyTitle="No hay notas internas registradas."
      emptyAction={<Link href={`/gestion?tipo=cliente&id=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Añadir nota</Link>}
    >
      {notes.length ? (
        <div className="grid gap-3">
          {notes.map((note) => (
            <article key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="label">{formatDate(note.date)}</p>
            <h3 className="mt-1 font-black text-obra-ink">{note.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.text}</p>
            </article>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function DataTab({ summary, returnTo }: { summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>; returnTo: string }) {
  const client = summary.client;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionList
        title="Datos fiscales"
        emptyTitle="Sin datos fiscales."
        emptyAction={<Link href={`/gestion?tipo=cliente&id=${client.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Completar datos</Link>}
      >
        <DataGrid
          rows={[
            ["Nombre visible", client.nombre],
            ["Nombre comercial", client.nombreComercial],
            ["Razón social", client.razonSocial],
            ["NIF/CIF", client.nifCif],
            ["Dirección fiscal", client.direccionFiscal],
            ["Código postal", client.codigoPostal],
            ["Municipio", client.municipio],
            ["Provincia", client.provincia],
            ["País", client.pais],
            ["Email de facturación", client.emailFacturacion],
            ["Teléfono de facturación", client.telefonoFacturacion],
            ["Persona de facturación", client.contactoFacturacionNombre]
          ]}
        />
      </SectionList>

      <SectionList title="Datos pendientes" emptyTitle="No hay datos pendientes.">
        <div className="grid gap-2">
          {summary.listItem.pendingFields.map((field) => (
            <div key={field} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              <Bell size={17} />
              {field}
            </div>
          ))}
        </div>
      </SectionList>
    </div>
  );
}

function WorkCard({ work, returnTo, compact = false }: { work: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>["client"]["works"][number]; returnTo: string; compact?: boolean }) {
  const invoiceTotal = work.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingTotal = work.invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.total - invoice.payments.reduce((paid, payment) => paid + payment.importe, 0)), 0);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{work.tipoTrabajo}</p>
          <h3 className="mt-1 font-black text-obra-ink">{work.titulo}</h3>
          <p className="mt-1 text-sm text-slate-500">{work.direccion}</p>
        </div>
        <StatusPill status={work.estado} />
      </div>
      <div className={`mt-3 grid gap-2 text-sm text-slate-600 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        <p><strong className="text-obra-ink">Inicio:</strong> {formatDate(work.fechaInicio)}</p>
        <p><strong className="text-obra-ink">Última:</strong> {formatDate(work.agendaEvents[0]?.fechaInicio ?? work.fechaInicio)}</p>
        <p><strong className="text-obra-ink">Facturado:</strong> {formatCurrency(invoiceTotal)}</p>
        <p><strong className="text-obra-ink">Pendiente:</strong> {formatCurrency(pendingTotal)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/gestion?tipo=obra&id=${work.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Editar</Link>
        <Link href={`/gestion?tipo=presupuesto&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Crear presupuesto</Link>
        <Link href={`/gestion?tipo=eventoAgenda&clienteId=${work.clienteId}&obraId=${work.id}&tipoEvento=visita&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Registrar visita</Link>
      </div>
    </article>
  );
}

function BudgetCard({ budget, returnTo, compact = false }: { budget: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>["client"]["budgets"][number]; returnTo: string; compact?: boolean }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{budget.numero}</p>
          <h3 className="mt-1 font-black text-obra-ink">{budget.titulo}</h3>
          <p className="mt-1 text-sm text-slate-500">{budget.work?.titulo ?? "Sin obra asociada"}</p>
        </div>
        <StatusPill status={budget.estado} />
      </div>
      <div className={`mt-3 grid gap-2 text-sm text-slate-600 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-5"}`}>
        <p><strong className="text-obra-ink">Base:</strong> {formatCurrency(budget.subtotal)}</p>
        <p><strong className="text-obra-ink">IVA:</strong> {formatCurrency(budget.iva)}</p>
        <p><strong className="text-obra-ink">Total:</strong> {formatCurrency(budget.total)}</p>
        <p><strong className="text-obra-ink">Validez:</strong> {formatDate(budget.fechaValidez)}</p>
        <p><strong className="text-obra-ink">Actualizado:</strong> {formatDate(budget.fechaEnvio ?? budget.fechaCreacion)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/presupuestos/${budget.id}`} className="secondary-button">Ver</Link>
        <Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Editar</Link>
        <Link href={`/presupuestos/${budget.id}/pdf`} className="secondary-button">Ver PDF</Link>
      </div>
    </article>
  );
}

function InvoiceCard({ invoice, returnTo, compact = false }: { invoice: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>["client"]["invoices"][number]; returnTo: string; compact?: boolean }) {
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.importe, 0);
  const pending = Math.max(0, invoice.total - paid);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{invoice.numero}</p>
          <h3 className="mt-1 font-black text-obra-ink">{invoice.concepto}</h3>
          <p className="mt-1 text-sm text-slate-500">{invoice.work?.titulo ?? "Sin obra asociada"}</p>
        </div>
        <StatusPill status={invoice.estado} />
      </div>
      <div className={`mt-3 grid gap-2 text-sm text-slate-600 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-5"}`}>
        <p><strong className="text-obra-ink">Total:</strong> {formatCurrency(invoice.total)}</p>
        <p><strong className="text-obra-ink">Pagado:</strong> {formatCurrency(paid)}</p>
        <p><strong className="text-obra-ink">Pendiente:</strong> {formatCurrency(pending)}</p>
        <p><strong className="text-obra-ink">Emisión:</strong> {formatDate(invoice.fechaEmision)}</p>
        <p><strong className="text-obra-ink">Vence:</strong> {formatDate(invoice.fechaVencimiento)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/dinero/${invoice.id}`} className="secondary-button">Ver</Link>
        <Link href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Editar</Link>
        <Link href={`/dinero/${invoice.id}/pdf`} className="secondary-button">Ver PDF</Link>
        {pending > 0 ? <Link href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=${encodeURIComponent(returnTo)}`} className="secondary-button">Registrar pago</Link> : null}
      </div>
    </article>
  );
}

function SectionList({
  title,
  description,
  emptyTitle,
  emptyAction,
  children
}: {
  title: string;
  description?: string;
  emptyTitle: string;
  emptyAction?: ReactNode;
  children?: ReactNode;
}) {
  const childArray = children ? (Array.isArray(children) ? children : [children]) : [];
  const hasContent = childArray.some(Boolean);
  return (
    <section>
      <SectionHeader title={title} description={description} />
      {hasContent ? <div className="grid gap-3">{children}</div> : <EmptyState title={emptyTitle} icon={FolderOpen} action={emptyAction} />}
    </section>
  );
}

function CompactRow({ icon: Icon, title, detail, href }: { icon: ComponentType<{ size?: number; className?: string }>; title: string; detail: string; href?: string }) {
  const content = (
    <span className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-obra-graphite">
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="block font-black text-obra-ink">{title}</span>
        <span className="mt-1 block text-sm text-slate-500">{detail}</span>
      </span>
    </span>
  );
  return href ? <Link href={href} className="block transition hover:scale-[0.995]">{content}</Link> : content;
}

function HeaderFact({ icon: Icon, label, value, detail }: { icon: ComponentType<{ size?: number; className?: string }>; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
        <Icon size={15} />
        {label}
      </p>
      <p className="mt-2 break-words font-black text-obra-ink">{value}</p>
      <p className="mt-1 break-words text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function DataGrid({ rows }: { rows: Array<[string, string | null]> }) {
  return (
    <dl className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 rounded-lg border border-slate-100 bg-white p-3 sm:grid-cols-[12rem_1fr]">
          <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
          <dd className="font-bold text-obra-ink">{value || "Pendiente"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{children}</span>;
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
