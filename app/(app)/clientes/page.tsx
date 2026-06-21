import Link from "next/link";
import { CalendarClock, FileText, MessageCircle, Pencil, Phone, Plus, Receipt, Search, WalletCards } from "lucide-react";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const filters = [
  ["todos", "Todos"],
  ["nuevo", "Nuevos"],
  ["pendiente_datos", "Pendiente datos"],
  ["visita_pendiente", "Visita pendiente"],
  ["presupuesto_enviado", "Presupuesto enviado"],
  ["seguimiento_pendiente", "En seguimiento"],
  ["obra_activa", "Obra activa"],
  ["pendiente_cobro", "Pendiente cobro"],
  ["finalizado", "Finalizado"]
];

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<{ estado?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const clients = await prisma.client.findMany({
    orderBy: { ultimaInteraccion: "desc" },
    include: {
      budgets: { orderBy: { fechaCreacion: "desc" } },
      invoices: true,
      works: true,
      reminders: { orderBy: { fechaProgramada: "asc" } },
      agendaEvents: { orderBy: { fechaInicio: "asc" } }
    }
  });

  const filteredClients = clients.filter((client) => {
    const statusMatch = !query.estado || query.estado === "todos" || client.estado === query.estado;
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${client.nombre} ${client.telefono} ${client.email ?? ""} ${client.direccion} ${client.notas ?? ""}`);
    return statusMatch && (!search || text.includes(search));
  });

  return (
    <main className="screen">
      <SectionHeader
        title="Clientes y leads"
        description="Vista compacta con próximos pasos, cobros y actividad."
        action={
          <DemoLimitButton href="/gestion?tipo=cliente&returnTo=/clientes" currentCount={clients.length} limit={3}>
            Añadir
          </DemoLimitButton>
        }
      />

      <form action="/clientes" className="card mb-3 flex gap-2 p-3">
        <input type="hidden" name="estado" value={query.estado ?? "todos"} />
        <input className="field" name="buscar" defaultValue={query.buscar ?? ""} placeholder="Buscar cliente, teléfono, nota..." />
        <button className="icon-button shrink-0" type="submit" aria-label="Buscar">
          <Search size={20} />
        </button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map(([id, label]) => (
          <Link key={id} href={`/clientes?estado=${id}${query.buscar ? `&buscar=${encodeURIComponent(query.buscar)}` : ""}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${((query.estado ?? "todos") === id) ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {filteredClients.map((client) => {
          const lastBudget = client.budgets[0];
          const activeWork = client.works.find((work) => !["cerrada", "finalizada"].includes(work.estado));
          const pendingInvoices = client.invoices.filter((invoice) => invoice.pendiente > 0);
          const pendingTotal = pendingInvoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
          const nextEvent = client.agendaEvents.find((event) => event.estado !== "cancelado");
          const priority = priorityLabel(client.estado, pendingTotal);

          return (
            <details key={client.id} className="card p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-obra-ink">{client.nombre}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{priority}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{nextAction(client.estado)}</p>
                  </div>
                  <StatusPill status={client.estado} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Mini label="Pendiente" value={formatCurrency(pendingTotal)} />
                  <Mini label="Última" value={formatDate(client.ultimaInteraccion)} />
                  <Mini label="Presupuesto" value={lastBudget ? `${lastBudget.numero}` : "Sin presupuesto"} />
                  <Mini label="Obra" value={activeWork?.titulo ?? "Sin obra activa"} />
                </div>
              </summary>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <p><strong className="text-obra-ink">Teléfono:</strong> {client.telefono}</p>
                  <p><strong className="text-obra-ink">Email:</strong> {client.email ?? "Sin email"}</p>
                  <p><strong className="text-obra-ink">Dirección:</strong> {client.direccion}</p>
                  <p><strong className="text-obra-ink">Origen:</strong> {client.origen}</p>
                  <p><strong className="text-obra-ink">Notas:</strong> {client.notas ?? "Sin notas"}</p>
                </div>

                <div className="grid gap-2 text-sm">
                  <Row icon={FileText} label="Presupuestos" value={client.budgets.map((budget) => `${budget.numero} · ${budget.estado}`).join(", ") || "Sin presupuestos"} />
                  <Row icon={Receipt} label="Facturas" value={`${client.invoices.length} facturas · ${formatCurrency(pendingTotal)} pendiente`} />
                  <Row icon={CalendarClock} label="Agenda" value={nextEvent ? `${nextEvent.titulo} · ${formatDate(nextEvent.fechaInicio)}` : "Sin citas manuales"} />
                  <Row icon={MessageCircle} label="Recordatorios" value={`${client.reminders.length} recordatorios`} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/clientes/${client.id}`} className="secondary-button">Historial</Link>
                  <Link href={`/gestion?tipo=cliente&id=${client.id}&returnTo=/clientes`} className="secondary-button"><Pencil size={18} /> Editar</Link>
                  <Link href={`/gestion?tipo=eventoAgenda&clienteId=${client.id}&tipoEvento=visita&titulo=Visita%20con%20${encodeURIComponent(client.nombre)}&direccion=${encodeURIComponent(client.direccion)}&returnTo=/clientes`} className="secondary-button"><CalendarClock size={18} /> Visita</Link>
                  <Link href={`/gestion?tipo=presupuesto&clienteId=${client.id}&returnTo=/clientes`} className="secondary-button"><Plus size={18} /> Presupuesto</Link>
                  <Link href={`/gestion?tipo=factura&clienteId=${client.id}&returnTo=/clientes`} className="secondary-button"><Receipt size={18} /> Factura</Link>
                  <Link href={`/gestion?tipo=pago&returnTo=/clientes`} className="secondary-button"><WalletCards size={18} /> Pago</Link>
                  <Link href={`/gestion?tipo=eventoAgenda&clienteId=${client.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(client.nombre)}&returnTo=/clientes`} className="secondary-button"><MessageCircle size={18} /> Seguimiento</Link>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate font-black text-obra-ink">{value}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <p className="flex gap-2 rounded-lg border border-slate-100 p-3 text-slate-600">
      <Icon size={17} className="mt-0.5 shrink-0 text-obra-graphite" />
      <span><strong className="text-obra-ink">{label}:</strong> {value}</span>
    </p>
  );
}

function nextAction(status: string) {
  const actions: Record<string, string> = {
    nuevo: "Completar datos y llamar",
    pendiente_datos: "Pedir fotos o medidas",
    visita_pendiente: "Confirmar visita",
    presupuesto_pendiente: "Crear presupuesto",
    presupuesto_enviado: "Esperar revisión",
    seguimiento_pendiente: "Preparar seguimiento",
    aceptado: "Crear obra",
    obra_activa: "Revisar obra y materiales",
    pendiente_cobro: "Preparar recordatorio de cobro",
    finalizado: "Archivar o pedir reseña",
    rechazado: "Cerrar lead"
  };
  return actions[status] ?? "Revisar ficha";
}

function priorityLabel(status: string, pendingTotal: number) {
  if (pendingTotal > 0) return "Cobro";
  if (["nuevo", "seguimiento_pendiente", "pendiente_datos"].includes(status)) return "Alta";
  if (status === "obra_activa") return "Obra";
  return "Normal";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
