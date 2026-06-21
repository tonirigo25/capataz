import Link from "next/link";
import { AlertTriangle, CalendarClock, FileText, Package, Pencil, Plus, Receipt, StickyNote, WalletCards } from "lucide-react";
import { updateWorkStatus } from "@/app/(app)/obras/actions";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, percent } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const filters = [
  ["todas", "Todas"],
  ["en_curso", "En curso"],
  ["pendiente_material", "Pendiente material"],
  ["pendiente_remates", "Pendiente remates"],
  ["pendiente_cobro", "Pendiente cobro"],
  ["finalizada", "Finalizada"],
  ["cerrada", "Cerrada"]
];

export default async function WorksPage({
  searchParams
}: {
  searchParams: Promise<{ estado?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const works = await prisma.work.findMany({
    orderBy: { fechaFinPrevista: "asc" },
    include: {
      client: true,
      materials: true,
      invoices: { include: { payments: true } },
      expenses: true,
      agendaEvents: { orderBy: { fechaInicio: "asc" } },
      reminders: true
    }
  });
  const activeWorks = works.filter((work) => ["en_curso", "pendiente_material", "pendiente_remates"].includes(work.estado)).length;
  const visibleWorks = works.filter((work) => {
    const statusMatch = !query.estado || query.estado === "todas" || work.estado === query.estado;
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${work.titulo} ${work.client.nombre} ${work.tipoTrabajo} ${work.notas ?? ""}`);
    return statusMatch && (!search || text.includes(search));
  });

  return (
    <main className="screen">
      <SectionHeader
        title="Obras"
        description="Margen, materiales, cobros y tareas de cada trabajo."
        action={
          <DemoLimitButton href="/gestion?tipo=obra&returnTo=/obras" currentCount={activeWorks} limit={1}>
            Añadir
          </DemoLimitButton>
        }
      />

      <form action="/obras" className="card mb-3 flex gap-2 p-3">
        <input type="hidden" name="estado" value={query.estado ?? "todas"} />
        <input className="field" name="buscar" defaultValue={query.buscar ?? ""} placeholder="Buscar obra, cliente, nota..." />
        <button className="secondary-button shrink-0" type="submit">Buscar</button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map(([id, label]) => (
          <Link key={id} href={`/obras?estado=${id}${query.buscar ? `&buscar=${encodeURIComponent(query.buscar)}` : ""}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${((query.estado ?? "todas") === id) ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {visibleWorks.map((work) => {
          const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
          const pendingInvoices = work.invoices.filter((invoice) => invoice.pendiente > 0);
          const pendingInvoiceTotal = pendingInvoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
          const spentPercent = percent(work.gastoReal, work.presupuestoAprobado);
          const nextEvent = work.agendaEvents.find((event) => event.estado !== "cancelado");

          return (
            <details key={work.id} className="card p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-obra-ink">{work.titulo}</h2>
                    <p className="mt-1 text-sm text-slate-500">{work.client.nombre} · {work.tipoTrabajo}</p>
                  </div>
                  <StatusPill status={work.estado} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="Presupuesto" value={formatCurrency(work.presupuestoAprobado)} />
                  <Mini label="Gasto" value={formatCurrency(work.gastoReal)} />
                  <Mini label="Margen" value={formatCurrency(work.margenEstimado)} />
                  <Mini label="Pendiente cobro" value={formatCurrency(pendingInvoiceTotal)} />
                  <Mini label="Materiales" value={String(pendingMaterials.length)} />
                  <Mini label="Próxima tarea" value={nextEvent ? formatDate(nextEvent.fechaInicio) : "Sin tarea"} />
                </div>

                {spentPercent >= 75 ? (
                  <p className="mt-3 flex gap-2 rounded-lg bg-obra-orange/10 p-3 text-sm font-semibold leading-6 text-obra-orange">
                    <AlertTriangle size={18} className="shrink-0" />
                    Riesgo de margen: {spentPercent}% del presupuesto consumido.
                  </p>
                ) : null}
              </summary>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                <Info icon={FileText} label="Detalles" value={`${work.direccion} · ${work.tipoTrabajo}`} />
                <Info icon={Package} label="Materiales pendientes" value={pendingMaterials.map((item) => `${item.nombre} (${item.estado})`).join(", ") || "Sin bloqueos"} />
                <Info icon={Receipt} label="Facturas" value={`${work.invoices.length} facturas · ${formatCurrency(pendingInvoiceTotal)} pendiente`} />
                <Info icon={WalletCards} label="Pagos" value={`${work.invoices.reduce((sum, invoice) => sum + invoice.payments.length, 0)} pagos asociados`} />
                <Info icon={CalendarClock} label="Agenda" value={nextEvent ? `${nextEvent.titulo} · ${formatDate(nextEvent.fechaInicio)}` : "Sin eventos manuales"} />
                <Info icon={StickyNote} label="Notas" value={work.notas ?? "Sin notas"} />

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Gastos recientes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {work.expenses.slice(0, 4).map((expense) => `${expense.concepto}: ${formatCurrency(expense.importe)}`).join(" · ") || "Sin gastos registrados"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/gestion?tipo=obra&id=${work.id}&returnTo=/obras`} className="secondary-button"><Pencil size={18} /> Editar</Link>
                  <Link href={`/clientes/${work.clienteId}`} className="secondary-button">Cliente</Link>
                  <Link href={`/gestion?tipo=gasto&obraId=${work.id}&returnTo=/obras`} className="secondary-button"><Plus size={18} /> Gasto</Link>
                  <Link href={`/gestion?tipo=material&obraId=${work.id}&returnTo=/obras`} className="secondary-button"><Plus size={18} /> Material</Link>
                  <Link href={`/gestion?tipo=presupuesto&obraId=${work.id}&clienteId=${work.clienteId}&returnTo=/obras`} className="secondary-button"><FileText size={18} /> Presupuesto</Link>
                  <Link href={`/gestion?tipo=factura&obraId=${work.id}&clienteId=${work.clienteId}&returnTo=/obras`} className="secondary-button"><Receipt size={18} /> Factura</Link>
                  <Link href={`/gestion?tipo=pago&returnTo=/obras`} className="secondary-button"><WalletCards size={18} /> Pago</Link>
                  <Link href={`/gestion?tipo=recordatorio&obraId=${work.id}&clienteId=${work.clienteId}&returnTo=/obras`} className="secondary-button">Recordatorio</Link>
                  <WorkStatusButton id={work.id} estado="pendiente_remates" label="Pendiente remates" />
                  <WorkStatusButton id={work.id} estado="finalizada" label="Finalizada" />
                  <WorkStatusButton id={work.id} estado="cerrada" label="Cerrar" />
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}

function WorkStatusButton({ id, estado, label }: { id: string; estado: string; label: string }) {
  return (
    <form action={updateWorkStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className="secondary-button">{label}</button>
    </form>
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

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <p className="flex gap-2 rounded-lg border border-slate-100 p-3 text-sm leading-6 text-slate-600">
      <Icon size={17} className="mt-0.5 shrink-0 text-obra-graphite" />
      <span><strong className="text-obra-ink">{label}:</strong> {value}</span>
    </p>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
