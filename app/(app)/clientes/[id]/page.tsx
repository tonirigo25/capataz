import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarClock, FileText, MapPin, Pencil, Phone, PhoneCall, Plus, Receipt } from "lucide-react";
import { FollowUpComposer } from "@/components/follow-up-composer";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      budgets: { orderBy: { fechaCreacion: "desc" }, include: { work: true } },
      invoices: { orderBy: { fechaVencimiento: "asc" } },
      reminders: { orderBy: { fechaProgramada: "asc" } },
      agendaEvents: { orderBy: { fechaInicio: "asc" } },
      works: { include: { expenses: true, materials: true, invoices: { include: { payments: true } } } }
    }
  });

  if (!client) notFound();

  const programmedRemindersCount = await prisma.reminder.count({ where: { estado: "programado" } });
  const followUpBudget =
    client.budgets.find((budget) => ["pendiente_respuesta", "enviado", "visto"].includes(budget.estado)) ?? client.budgets[0];
  const existingFollowUp = followUpBudget
    ? client.reminders.find(
        (reminder) =>
          reminder.presupuestoId === followUpBudget.id &&
          reminder.tipo === "seguimiento_presupuesto" &&
          ["borrador", "pendiente_confirmacion"].includes(reminder.estado)
      )
    : null;
  const pendingTotal = client.invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);

  return (
    <main className="screen">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Clientes
      </Link>

      <section className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-obra-ink">{client.nombre}</h1>
            <p className="mt-1 text-sm text-slate-500">{client.tipo} · {client.origen}</p>
          </div>
          <StatusPill status={client.estado} />
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <Phone size={17} className="text-obra-graphite" />
            {client.telefono}
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={17} className="text-obra-graphite" />
            {client.direccion}
          </p>
          <p className="flex items-center gap-2">
            <CalendarClock size={17} className="text-obra-graphite" />
            Última interacción: {formatDate(client.ultimaInteraccion)}
          </p>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Link href={`/gestion?tipo=cliente&id=${client.id}&returnTo=/clientes/${client.id}`} className="secondary-button">
              <Pencil size={18} />
              Editar cliente
            </Link>
            <Link href={`/gestion?tipo=eventoAgenda&clienteId=${client.id}&tipoEvento=visita&titulo=Visita%20con%20${encodeURIComponent(client.nombre)}&direccion=${encodeURIComponent(client.direccion)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/clientes/${client.id}`} className="secondary-button">
              <CalendarClock size={18} />
              Crear visita
            </Link>
            <Link href={`/gestion?tipo=eventoAgenda&clienteId=${client.id}&tipoEvento=llamada&titulo=Llamar%20a%20${encodeURIComponent(client.nombre)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=/clientes/${client.id}`} className="secondary-button">
              <PhoneCall size={18} />
              Crear llamada
            </Link>
            <Link href={`/gestion?tipo=presupuesto&clienteId=${client.id}&returnTo=/clientes/${client.id}`} className="secondary-button">
              <FileText size={18} />
              Crear presupuesto
            </Link>
            <Link href={`/presupuestos?buscar=${encodeURIComponent(client.nombre)}`} className="secondary-button">
              <FileText size={18} />
              Ver presupuestos
            </Link>
            <Link href={`/gestion?tipo=factura&clienteId=${client.id}&returnTo=/clientes/${client.id}`} className="secondary-button">
              <Receipt size={18} />
              Crear factura
            </Link>
            <Link href={`/gestion?tipo=obra&clienteId=${client.id}&returnTo=/clientes/${client.id}`} className="secondary-button">
              <BriefcaseBusiness size={18} />
              Convertir en obra
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-3 text-lg font-black text-obra-ink">Próximas citas</h2>
        <div className="card divide-y divide-slate-100">
          {client.agendaEvents.filter((event) => event.estado !== "cancelado").slice(0, 4).map((event) => (
            <Link key={event.id} href={`/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=/clientes/${client.id}`} className="flex items-center justify-between gap-3 p-4">
              <span>
                <span className="block text-sm font-black text-obra-ink">{event.titulo}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">{formatDate(event.fechaInicio)}</span>
              </span>
              <StatusPill status={event.estado} />
            </Link>
          ))}
          {client.agendaEvents.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Sin citas manuales en agenda para este cliente.</div>
          ) : null}
        </div>
      </section>

      {followUpBudget ? (
        <section className="card mt-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">{followUpBudget.numero}</p>
              <h2 className="mt-1 text-lg font-black text-obra-ink">{followUpBudget.titulo}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Presupuesto enviado pendiente de respuesta · {formatCurrency(followUpBudget.total)}
              </p>
            </div>
            <StatusPill status={followUpBudget.estado} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <Mini label="Enviado" value={formatDate(followUpBudget.fechaEnvio)} icon={FileText} />
            <Mini label="Seguimiento" value={formatDate(followUpBudget.fechaSeguimiento)} icon={CalendarClock} />
          </div>
        </section>
      ) : null}

      {followUpBudget ? (
        <section className="mt-4">
          <FollowUpComposer
            initialDateTime={tomorrowAtTenInputValue()}
            demoLimit={{ currentCount: programmedRemindersCount, limit: 3 }}
            data={{
              clienteId: client.id,
              clienteNombre: client.nombre,
              obraId: followUpBudget.obraId,
              presupuestoId: followUpBudget.id,
              presupuestoNumero: followUpBudget.numero,
              presupuestoTitulo: followUpBudget.titulo,
              presupuestoTotal: followUpBudget.total,
              initialMessage: existingFollowUp?.mensaje ?? null
            }}
          />
        </section>
      ) : null}

      <section className="mt-4 grid gap-3">
        <h2 className="text-lg font-black text-obra-ink">Facturas del cliente</h2>
        <div className="card divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-bold text-obra-ink">
              <Receipt size={18} className="text-obra-green" />
              Total pendiente
            </span>
            <span className="text-sm font-black text-obra-ink">{formatCurrency(pendingTotal)}</span>
          </div>
          {client.invoices.map((invoice) => (
            <Link key={invoice.id} href={`/dinero/${invoice.id}`} className="flex items-center justify-between gap-3 p-4">
              <span>
                <span className="block text-sm font-bold text-obra-ink">{invoice.numero}</span>
                <span className="block text-xs text-slate-500">{invoice.concepto}</span>
              </span>
              <span className="text-sm font-black text-obra-ink">{formatCurrency(invoice.pendiente)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-3 text-lg font-black text-obra-ink">Historial</h2>
        <div className="card divide-y divide-slate-100">
          {timelineFor(client).map((event) => (
            <div key={`${event.label}-${event.date}`} className="flex gap-3 p-4">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-obra-yellow/25 text-obra-yellowDark">
                <Plus size={15} />
              </span>
              <div>
                <p className="text-sm font-black text-obra-ink">{event.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(event.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

type ClientTimelineData = {
  fechaCreacion: Date;
  reminders: Array<{ tipo: string; fechaProgramada: Date }>;
  budgets: Array<{ numero: string; estado: string; fechaCreacion: Date; fechaEnvio: Date | null }>;
  works: Array<{
    titulo: string;
    estado: string;
    fechaInicio: Date | null;
    fechaFinPrevista: Date | null;
    expenses: Array<{ concepto: string; fecha: Date }>;
    materials: Array<{ nombre: string }>;
    invoices: Array<{ numero: string; fechaEmision: Date; payments: Array<{ importe: number; fecha: Date }> }>;
  }>;
  invoices: Array<{ numero: string; fechaEmision: Date }>;
};

function timelineFor(client: ClientTimelineData) {
  const events: Array<{ label: string; date: Date }> = [
    { label: "Cliente creado", date: client.fechaCreacion }
  ];

  client.reminders.forEach((reminder) => {
    const label = reminder.tipo === "confirmar_visita" ? "Visita programada" : "Recordatorio programado";
    events.push({ label, date: reminder.fechaProgramada });
  });
  client.budgets.forEach((budget) => {
    events.push({ label: `Presupuesto ${budget.numero} · ${budget.estado.replaceAll("_", " ")}`, date: budget.fechaCreacion });
    if (budget.fechaEnvio) events.push({ label: `Presupuesto enviado ${budget.numero}`, date: budget.fechaEnvio });
  });
  client.works.forEach((work) => {
    if (work.fechaInicio) events.push({ label: `Obra creada: ${work.titulo}`, date: work.fechaInicio });
    work.expenses.forEach((expense) => events.push({ label: `Gasto registrado: ${expense.concepto}`, date: expense.fecha }));
    work.materials.forEach((material) => events.push({ label: `Material añadido: ${material.nombre}`, date: work.fechaInicio ?? client.fechaCreacion }));
    work.invoices.forEach((invoice) => {
      events.push({ label: `Factura emitida: ${invoice.numero}`, date: invoice.fechaEmision });
      invoice.payments.forEach((payment) => events.push({ label: `Pago registrado: ${formatCurrency(payment.importe)}`, date: payment.fecha }));
    });
    if (work.estado === "cerrada") events.push({ label: `Obra cerrada: ${work.titulo}`, date: work.fechaFinPrevista ?? new Date() });
  });
  client.invoices.forEach((invoice) => {
    if (!events.some((event) => event.label.includes(invoice.numero))) {
      events.push({ label: `Factura emitida: ${invoice.numero}`, date: invoice.fechaEmision });
    }
  });

  return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Mini({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
        <Icon size={14} className="text-obra-graphite" />
        {label}
      </p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}
