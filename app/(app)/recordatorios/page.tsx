import Link from "next/link";
import { Bell, CalendarClock, Pencil, ShieldAlert } from "lucide-react";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { ReminderConfirmControls } from "@/components/reminder-confirm-controls";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";
import { CompactFilterBar, ResultCount } from "@/components/ui-primitives";

export const dynamic = "force-dynamic";

const filterLabels = [
  ["todos", "Todos"],
  ["hoy", "Hoy"],
  ["pendiente_confirmacion", "Pendientes"],
  ["programado", "Programados"],
  ["vencidos", "Vencidos"],
  ["enviado", "Enviados"],
  ["cancelado", "Cancelados"],
  ["realizado", "Realizados"]
];

export default async function RemindersPage({
  searchParams
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const reminders = await prisma.reminder.findMany({
    where: { companyId },
    orderBy: { fechaProgramada: "asc" },
    include: { client: true, work: true, invoice: true, budget: true }
  });
  const programmedCount = reminders.filter((reminder) => reminder.estado === "programado").length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);
  const now = new Date();

  const counts = {
    today: reminders.filter((reminder) => reminder.fechaProgramada >= todayStart && reminder.fechaProgramada < todayEnd).length,
    pending: reminders.filter((reminder) => reminder.estado === "pendiente_confirmacion").length,
    programmed: reminders.filter((reminder) => reminder.estado === "programado").length,
    overdue: reminders.filter((reminder) => reminder.fechaProgramada < now && ["borrador", "pendiente_confirmacion", "programado"].includes(reminder.estado)).length,
    sent: reminders.filter((reminder) => reminder.estado === "enviado").length,
    cancelled: reminders.filter((reminder) => reminder.estado === "cancelado").length,
    done: reminders.filter((reminder) => reminder.estado === "realizado").length
  };

  const filtered = reminders.filter((reminder) => {
    const filter = query.filtro ?? "todos";
    if (filter === "todos") return true;
    if (filter === "hoy") return reminder.fechaProgramada >= todayStart && reminder.fechaProgramada < todayEnd;
    if (filter === "vencidos") return reminder.fechaProgramada < now && ["borrador", "pendiente_confirmacion", "programado"].includes(reminder.estado);
    return reminder.estado === filter;
  });

  return (
    <main className="screen">
      <SectionHeader
        title="Recordatorios"
        description="Seguimientos internos y mensajes preparados, siempre con confirmación."
        action={
          <DemoLimitButton href="/gestion?tipo=recordatorio&returnTo=/recordatorios" currentCount={programmedCount} limit={3}>
            Añadir
          </DemoLimitButton>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3">
        <StatCard href="/recordatorios?filtro=hoy" title="Hoy" value={String(counts.today)} detail="Programados para hoy" icon={CalendarClock} />
        <StatCard href="/recordatorios?filtro=pendiente_confirmacion" title="Pendientes" value={String(counts.pending)} detail="Requieren confirmación" icon={ShieldAlert} tone="warning" />
        <StatCard href="/recordatorios?filtro=programado" title="Programados" value={String(counts.programmed)} detail="Sin envío real" icon={Bell} />
        <StatCard href="/recordatorios?filtro=vencidos" title="Vencidos" value={String(counts.overdue)} detail="Revisar hoy" icon={ShieldAlert} tone="danger" />
        <StatCard href="/recordatorios?filtro=enviado" title="Enviados simulados" value={String(counts.sent)} detail="Histórico local" icon={Bell} tone="success" />
        <StatCard href="/recordatorios?filtro=cancelado" title="Cancelados" value={String(counts.cancelled)} detail={`${counts.done} realizados`} icon={ShieldAlert} />
      </section>

      <CompactFilterBar className="mb-4"><div className="flex gap-2 overflow-x-auto pb-1">
        {filterLabels.map(([id, label]) => (
          <Link key={id} href={`/recordatorios?filtro=${id}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${((query.filtro ?? "todos") === id) ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            {label}
          </Link>
        ))}
      </div></CompactFilterBar>

      <ResultCount shown={filtered.length} total={reminders.length} noun="recordatorios" />

      <div className="grid gap-3">
        {filtered.map((reminder) => (
          <details key={reminder.id} className="card p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">{statusLabel(reminder.tipo)} · {statusLabel(reminder.canal)}</p>
                  <h2 className="mt-1 text-lg font-black text-obra-ink">{reminder.client?.nombre ?? "Recordatorio interno"}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{formatDate(reminder.fechaProgramada)}</p>
                </div>
                <StatusPill status={reminder.estado} />
              </div>
            </summary>

            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm leading-6 text-slate-600">{reminder.mensaje}</p>
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <p><strong className="text-obra-ink">Requiere confirmación:</strong> {reminder.requiereConfirmacion ? "Sí" : "No"}</p>
                {reminder.work ? <p><strong className="text-obra-ink">Obra:</strong> {reminder.work.titulo}</p> : null}
                {reminder.invoice ? <p><strong className="text-obra-ink">Factura:</strong> {reminder.invoice.numero}</p> : null}
                {reminder.budget ? <p><strong className="text-obra-ink">Presupuesto:</strong> {reminder.budget.numero}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=/recordatorios`} className="secondary-button"><Pencil size={18} /> Editar</Link>
                {reminder.client ? <Link href={`/clientes/${reminder.client.id}`} className="secondary-button">Cliente</Link> : null}
                {reminder.invoice ? <Link href={`/dinero/${reminder.invoice.id}`} className="secondary-button">Factura</Link> : null}
                {reminder.budget ? <Link href={`/presupuestos?buscar=${encodeURIComponent(reminder.budget.numero)}`} className="secondary-button">Presupuesto</Link> : null}
                {reminder.work ? <Link href={`/obras?buscar=${encodeURIComponent(reminder.work.titulo)}`} className="secondary-button">Obra</Link> : null}
              </div>

              {["pendiente_confirmacion", "programado", "borrador"].includes(reminder.estado) ? (
                <ReminderConfirmControls
                  id={reminder.id}
                  title={reminder.client?.nombre ?? "recordatorio interno"}
                  message={reminder.mensaje}
                  scheduledLabel={formatDate(reminder.fechaProgramada)}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <ShieldAlert size={18} />
                  Sin acción pendiente
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
