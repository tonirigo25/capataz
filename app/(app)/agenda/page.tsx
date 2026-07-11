import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  Clock,
  FileText,
  Hammer,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AgendaEventControls } from "@/components/agenda-event-controls";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import {
  addDays,
  getAgendaItems,
  itemsBetween,
  itemsForDay,
  startOfDay,
  startOfWeek,
  toDateInputValue,
  type AgendaItem
} from "@/lib/agenda";
import { formatDate, formatDay } from "@/lib/format";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

const views = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "lista", label: "Lista" }
];

export default async function AgendaPage({
  searchParams
}: {
  searchParams: Promise<{ vista?: string; dia?: string; tipo?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const view = views.some((item) => item.id === query.vista) ? query.vista! : "hoy";
  const selectedDay = query.dia ? startOfDay(new Date(`${query.dia}T00:00:00`)) : startOfDay(new Date());
  const items = filterAgendaItems(await getAgendaItems(), query.tipo, query.buscar);
  const todayItems = itemsForDay(items, new Date());
  const weekStart = startOfWeek(selectedDay);
  const weekItems = itemsBetween(items, weekStart, addDays(weekStart, 7));
  const nextVisit = items.find((item) => item.tipo === "visita" && item.fechaInicio >= new Date() && item.estado !== "cancelado");

  return (
    <main className="screen">
      <SectionHeader
        title="Agenda"
        description="Calendario interno para visitas, cobros, obras, materiales y tareas."
        action={
          <Link href="/gestion?tipo=eventoAgenda&returnTo=/agenda" className="secondary-button">
            <Plus size={18} />
            Añadir
          </Link>
        }
      />

      <section className="mb-4 rounded-lg border border-obra-yellowDark/20 bg-obra-yellow/20 p-4">
        <p className="text-sm font-semibold leading-6 text-obra-yellowDark">
          Hoy tienes {todayItems.filter((item) => item.tipo === "visita").length} visitas,{" "}
          {todayItems.filter((item) => item.tipo.includes("seguimiento")).length} seguimientos y{" "}
          {todayItems.filter((item) => item.tipo === "vencimiento_factura").length} vencimientos.
          {nextVisit ? ` La próxima cita es ${nextVisit.titulo} a las ${timeLabel(nextVisit.fechaInicio)}.` : ""}
        </p>
      </section>

      <nav className="mb-4 grid grid-cols-4 gap-2">
        {views.map((item) => (
          <Link
            key={item.id}
            href={`/agenda?vista=${item.id}&dia=${toDateInputValue(selectedDay)}`}
            className={`min-h-11 rounded-lg px-2 py-2 text-center text-sm font-black ${
              view === item.id ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {view === "hoy" ? <TodayView items={todayItems} /> : null}
      {view === "semana" ? <WeekView items={weekItems} weekStart={weekStart} /> : null}
      {view === "mes" ? <MonthView items={items} selectedDay={selectedDay} /> : null}
      {view === "lista" ? <ListView items={items} selectedType={query.tipo ?? "todos"} /> : null}
    </main>
  );
}

function TodayView({ items }: { items: AgendaItem[] }) {
  const next = items.find((item) => item.fechaInicio >= new Date() && item.estado !== "cancelado");
  const grouped = [
    { title: "Visitas", types: ["visita"] },
    { title: "Seguimientos", types: ["seguimiento_presupuesto", "seguimiento_cobro"] },
    { title: "Vencimientos", types: ["vencimiento_factura"] },
    { title: "Materiales y tareas", types: ["compra_material", "recordatorio_interno", "tarea_obra", "llamada"] }
  ];

  return (
    <div className="grid gap-5">
      {next ? (
        <section className="card border-obra-yellowDark p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Próxima cita</p>
          <h2 className="mt-1 text-lg font-black text-obra-ink">{next.titulo}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{formatDate(next.fechaInicio)}</p>
        </section>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <Link href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/agenda" className="secondary-button">Visita</Link>
        <Link href="/gestion?tipo=recordatorio&returnTo=/agenda" className="secondary-button">Recordatorio</Link>
        <Link href="/gestion?tipo=eventoAgenda&tipoEvento=seguimiento_cobro&returnTo=/agenda" className="secondary-button">Seguimiento</Link>
      </div>
      {grouped.map((group) => {
        const groupItems = items.filter((item) => group.types.includes(item.tipo));
        return (
          <section key={group.title}>
            <HeaderLine title={group.title} count={groupItems.length} />
            <EventList items={groupItems} empty="No hay eventos en este bloque para hoy." />
          </section>
        );
      })}
    </div>
  );
}

function WeekView({ items, weekStart }: { items: AgendaItem[]; weekStart: Date }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  return (
    <div className="grid gap-3">
      <Legend />
      {days.map((day) => {
        const dayItems = itemsForDay(items, day);
        const summary = daySummary(dayItems);
        return (
          <details key={day.toISOString()} className="card p-4" open={toDateInputValue(day) === toDateInputValue(new Date())}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black capitalize text-obra-ink">{weekdayLabel(day)}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{formatDay(day)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{dayItems.length}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-bold text-slate-600">
                <MiniCount label="Visitas" value={summary.visits} />
                <MiniCount label="Seg." value={summary.followUps} />
                <MiniCount label="Cobros" value={summary.invoices} />
                <MiniCount label="Tareas" value={summary.tasks} />
              </div>
            </summary>
            <div className="mt-4">
              <EventList items={dayItems} empty="Sin citas ni tareas." />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function MonthView({ items, selectedDay }: { items: AgendaItem[]; selectedDay: Date }) {
  const first = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const selectedItems = itemsForDay(items, selectedDay);

  return (
    <div className="grid gap-4">
      <Legend />
      <section className="card p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <Link href={`/agenda?vista=mes&dia=${toDateInputValue(new Date(selectedDay.getFullYear(), selectedDay.getMonth() - 1, 1))}`} className="secondary-button">
            Anterior
          </Link>
          <h2 className="text-base font-black capitalize text-obra-ink">
            {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(selectedDay)}
          </h2>
          <Link href={`/agenda?vista=mes&dia=${toDateInputValue(new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 1))}`} className="secondary-button">
            Siguiente
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-slate-500">
          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayItems = itemsForDay(items, day);
            const active = toDateInputValue(day) === toDateInputValue(selectedDay);
            const currentMonth = day.getMonth() === selectedDay.getMonth();
            return (
              <Link
                key={day.toISOString()}
                href={`/agenda?vista=mes&dia=${toDateInputValue(day)}`}
                className={`min-h-16 rounded-lg border p-1 text-left ${
                  active ? "border-obra-ink bg-obra-yellow/25" : "border-slate-100 bg-white"
                } ${currentMonth ? "text-obra-ink" : "text-slate-300"}`}
              >
                <span className="text-xs font-black">{day.getDate()}</span>
                <span className="mt-1 block text-[10px] font-bold text-slate-500">{dayItems.length || ""}</span>
                <span className="mt-1 flex gap-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${dotClass(item.tipo)}`} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <HeaderLine title={`Eventos del ${formatDay(selectedDay)}`} count={selectedItems.length} />
        <EventList items={selectedItems} empty="No hay eventos para este día." />
      </section>
    </div>
  );
}

function ListView({ items, selectedType }: { items: AgendaItem[]; selectedType: string }) {
  const upcoming = items.filter((item) => item.fechaInicio >= addDays(startOfDay(new Date()), -1));
  const filters = [
    ["todos", "Todos"],
    ["visitas", "Visitas"],
    ["cobros", "Cobros"],
    ["presupuestos", "Presupuestos"],
    ["materiales", "Materiales"],
    ["tareas", "Tareas"]
  ];
  const groups = groupByDay(upcoming);
  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(([id, label]) => (
          <Link key={id} href={`/agenda?vista=lista&tipo=${id}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${selectedType === id ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            {label}
          </Link>
        ))}
      </div>
      {Object.entries(groups).map(([date, dayItems]) => (
        <section key={date}>
          <HeaderLine title={date} count={dayItems.length} />
          <EventList items={dayItems} empty="No hay eventos en la agenda." />
        </section>
      ))}
      {!upcoming.length ? <EventList items={[]} empty="No hay eventos en la agenda." /> : null}
    </div>
  );
}

function EventList({ items, empty }: { items: AgendaItem[]; empty: string }) {
  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">{empty}</div>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <EventCard key={`${item.source}-${item.id}`} item={item} />
      ))}
    </div>
  );
}

function EventCard({ item }: { item: AgendaItem }) {
  const Icon = iconForType(item.tipo);

  return (
    <article className={`card overflow-hidden border-l-4 ${borderClass(item.tipo)}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
              <Icon size={15} className="shrink-0 text-obra-graphite" />
              {statusLabel(item.tipo)} · {formatDate(item.fechaInicio)}
            </p>
            <h2 className="mt-1 text-lg font-black leading-6 text-obra-ink">{item.titulo}</h2>
            {item.descripcion ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.descripcion}</p> : null}
          </div>
          <StatusPill status={item.estado} />
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {item.clienteNombre ? <Meta icon={UserRound} label="Cliente" value={item.clienteNombre} /> : null}
          {item.contactName ? <Meta icon={UserRound} label="Contacto" value={item.contactName} /> : null}
          {item.obraTitulo ? <Meta icon={Hammer} label="Obra" value={item.obraTitulo} /> : null}
          {item.facturaNumero ? <Meta icon={Receipt} label="Factura" value={item.facturaNumero} /> : null}
          {item.presupuestoNumero ? <Meta icon={FileText} label="Presupuesto" value={item.presupuestoNumero} /> : null}
          {item.direccion ? <Meta icon={MapPin} label="Dirección" value={item.direccion} /> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={item.href} className="secondary-button">
            {item.editable ? <Pencil size={18} /> : <ChevronRight size={18} />}
            {item.editable ? "Editar" : "Abrir origen"}
          </Link>
        </div>

        {item.editable ? (
          <AgendaEventControls id={item.id} title={item.titulo} currentDateTime={toDateTimeInputValue(item.fechaInicio)} />
        ) : null}
      </div>
    </article>
  );
}

function HeaderLine({ title, count, subtitle }: { title: string; count: number; subtitle?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-black text-obra-ink">{title}</h2>
        {subtitle ? <p className="text-xs font-semibold text-slate-500">{subtitle}</p> : null}
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{count}</span>
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg bg-slate-50 px-2 py-2">
      <span className="block text-base text-obra-ink">{value}</span>
      <span className="block">{label}</span>
    </span>
  );
}

function Legend() {
  const items = [
    ["bg-obra-yellow", "Visitas"],
    ["bg-obra-red", "Cobros"],
    ["bg-obra-orange", "Seguimientos"],
    ["bg-obra-green", "Realizado"],
    ["bg-obra-graphite", "Obra/tareas"],
    ["bg-purple-500", "Materiales"]
  ];

  return (
    <div className="card grid grid-cols-2 gap-2 p-3 text-xs font-bold text-slate-600 sm:grid-cols-3">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

function daySummary(items: AgendaItem[]) {
  return {
    visits: items.filter((item) => item.tipo === "visita").length,
    followUps: items.filter((item) => item.tipo.includes("seguimiento") || item.tipo === "presupuesto_pendiente").length,
    invoices: items.filter((item) => item.tipo === "vencimiento_factura" || item.tipo === "seguimiento_cobro").length,
    tasks: items.filter((item) => ["compra_material", "recordatorio_interno", "tarea_obra", "llamada", "inicio_obra", "fin_previsto_obra"].includes(item.tipo)).length
  };
}

function groupByDay(items: AgendaItem[]) {
  return items.reduce<Record<string, AgendaItem[]>>((groups, item) => {
    const key = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "2-digit", month: "short" }).format(item.fechaInicio);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
}

function filterAgendaItems(items: AgendaItem[], type?: string, query?: string) {
  const normalizedQuery = normalize(query ?? "");
  return items.filter((item) => {
    const typeMatch =
      !type ||
      type === "todos" ||
      (type === "visitas" && item.tipo === "visita") ||
      (type === "cobros" && ["vencimiento_factura", "seguimiento_cobro"].includes(item.tipo)) ||
      (type === "presupuestos" && ["seguimiento_presupuesto", "presupuesto_pendiente"].includes(item.tipo)) ||
      (type === "materiales" && item.tipo === "compra_material") ||
      (type === "tareas" && ["recordatorio_interno", "tarea_obra", "llamada", "inicio_obra", "fin_previsto_obra"].includes(item.tipo));
    const text = normalize(`${item.titulo} ${item.descripcion ?? ""} ${item.clienteNombre ?? ""} ${item.contactName ?? ""} ${item.obraTitulo ?? ""} ${item.facturaNumero ?? ""}`);
    const queryMatch = !normalizedQuery || text.includes(normalizedQuery);
    return typeMatch && queryMatch;
  });
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Meta({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <p className="flex gap-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-obra-graphite" />
      <span>
        <strong className="text-obra-ink">{label}:</strong> {value}
      </span>
    </p>
  );
}

function iconForType(type: string): LucideIcon {
  if (type === "vencimiento_factura" || type === "seguimiento_cobro") return Receipt;
  if (type === "inicio_obra" || type === "fin_previsto_obra" || type === "tarea_obra") return Hammer;
  if (type === "compra_material") return Clock;
  if (type === "presupuesto_pendiente" || type === "seguimiento_presupuesto") return FileText;
  return CalendarClock;
}

function borderClass(type: string) {
  if (type === "visita") return "border-l-obra-yellow";
  if (type === "vencimiento_factura" || type === "seguimiento_cobro") return "border-l-obra-red";
  if (type === "inicio_obra" || type === "fin_previsto_obra" || type === "tarea_obra") return "border-l-obra-graphite";
  if (type === "compra_material") return "border-l-purple-500";
  return "border-l-slate-300";
}

function dotClass(type: string) {
  if (type === "visita") return "bg-obra-yellow";
  if (type === "vencimiento_factura" || type === "seguimiento_cobro") return "bg-obra-red";
  if (type === "compra_material") return "bg-purple-500";
  if (type.includes("seguimiento") || type === "presupuesto_pendiente") return "bg-obra-orange";
  if (type === "inicio_obra" || type === "fin_previsto_obra") return "bg-obra-graphite";
  return "bg-slate-400";
}

function weekdayLabel(day: Date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(day);
}

function timeLabel(day: Date) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(day);
}

function toDateTimeInputValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
