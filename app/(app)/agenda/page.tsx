import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Hammer,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AgendaEventControls } from "@/components/agenda-event-controls";
import { ListWorkspace } from "@/components/workspaces";
import { StatusPill } from "@/components/status-pill";
import {
  CompactTabs,
  ModuleHeader,
  SoftBadge,
} from "@/components/portal/modules-b/module-frame";
import {
  CompactFilterBar,
  CompactSearch,
  EmptyState,
  Notice,
} from "@/components/ui-primitives";
import {
  addDays,
  getAgendaItems,
  itemsBetween,
  itemsForDay,
  startOfDay,
  startOfWeek,
  toDateInputValue,
  type AgendaItem,
} from "@/lib/agenda";
import { formatDate, formatDay } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import {
  requireCapability,
  resolveAuthorization,
} from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

const views = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "lista", label: "Lista" },
  { id: "vencimientos", label: "Vencimientos" },
];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    dia?: string;
    tipo?: string;
    buscar?: string;
  }>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("agenda.view");
  const canManage = (await resolveAuthorization(auth, "agenda.manage")).allowed;
  const view = views.some((item) => item.id === query.vista)
    ? query.vista!
    : "semana";
  const selectedDay = query.dia
    ? startOfDay(new Date(`${query.dia}T00:00:00`))
    : startOfDay(new Date());
  const items = filterAgendaItems(
    await getAgendaItems(),
    query.tipo,
    query.buscar,
  );
  const todayItems = itemsForDay(items, new Date());
  const weekStart = startOfWeek(selectedDay);
  const weekItems = itemsBetween(items, weekStart, addDays(weekStart, 7));
  const navigationStep = view === "semana" ? 7 : 1;
  const hasActiveFilters = Boolean(
    query.buscar || (query.tipo && query.tipo !== "todos"),
  );
  const nextVisit = items.find(
    (item) =>
      item.tipo === "visita" &&
      item.fechaInicio >= new Date() &&
      item.estado !== "cancelado",
  );
  if (!canManage) return <ReadOnlyAgenda items={items} />;

  return (
    <ListWorkspace>
      <ModuleHeader
        eyebrow="Planificación coordinada"
        title="Agenda"
        description="Visitas, tareas, hitos y vencimientos en una semana operativa que conserva responsables, contexto y trazabilidad."
        action={
          <Link
            href="/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/agenda"
            className="primary-button"
          >
            <Plus size={18} />
            Nueva visita
          </Link>
        }
        meta={
          <>
            <SoftBadge tone="success">
              {todayItems.length} elementos hoy
              {hasActiveFilters ? " con estos filtros" : ""}
            </SoftBadge>
            {nextVisit ? (
              <SoftBadge tone="warning">
                Próxima visita visible · {timeLabel(nextVisit.fechaInicio)}
              </SoftBadge>
            ) : (
              <SoftBadge>Sin visitas próximas</SoftBadge>
            )}
          </>
        }
      />

      <Notice
        className="mb-4"
        tone="info"
        title="Resumen de hoy"
        description={`Tienes ${todayItems.filter((item) => item.tipo === "visita").length} visitas, ${todayItems.filter((item) => item.tipo.includes("seguimiento")).length} seguimientos y ${todayItems.filter((item) => item.tipo === "vencimiento_factura").length} vencimientos.${nextVisit ? ` La próxima cita es ${nextVisit.titulo} a las ${timeLabel(nextVisit.fechaInicio)}.` : ""}`}
      />

      <CompactFilterBar className="mb-4">
        <details
          data-agenda-filters
          open={Boolean(query.buscar || (query.tipo && query.tipo !== "todos"))}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-black text-obra-ink">
            <SlidersHorizontal size={18} />
            Filtros de agenda
          </summary>
          <form
            action="/agenda"
            className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-[minmax(14rem,1fr)_12rem_auto]"
          >
            <input type="hidden" name="vista" value={view} />
            <input
              type="hidden"
              name="dia"
              value={toDateInputValue(selectedDay)}
            />
            <label>
              <span className="label mb-1 block">Buscar</span>
              <CompactSearch
                name="buscar"
                defaultValue={query.buscar ?? ""}
                placeholder="Evento, cliente, trabajo…"
              />
            </label>
            <label>
              <span className="label mb-1 block">Tipo</span>
              <select
                className="field"
                name="tipo"
                defaultValue={query.tipo ?? "todos"}
              >
                <option value="todos">Todos</option>
                <option value="visitas">Visitas</option>
                <option value="cobros">Cobros</option>
                <option value="presupuestos">Presupuestos</option>
                <option value="materiales">Materiales</option>
                <option value="tareas">Tareas</option>
              </select>
            </label>
            <button className="secondary-button self-end" type="submit">
              <Search size={18} /> Aplicar
            </button>
          </form>
        </details>
      </CompactFilterBar>

      <CompactTabs label="Vistas de agenda">
        {views.map((item) => (
          <Link
            key={item.id}
            href={`/agenda?vista=${item.id}&dia=${toDateInputValue(selectedDay)}${query.buscar ? `&buscar=${encodeURIComponent(query.buscar)}` : ""}${query.tipo ? `&tipo=${encodeURIComponent(query.tipo)}` : ""}`}
            className={`inline-flex min-h-9 flex-1 shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-center text-sm font-bold ${
              view === item.id
                ? "bg-obra-ink !text-white"
                : "text-slate-600 hover:bg-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </CompactTabs>

      <nav
        className="mb-5 flex items-center justify-between gap-2"
        aria-label="Cambiar fecha"
      >
        <Link
          href={agendaHref(view, addDays(selectedDay, -navigationStep), query)}
          className="secondary-button"
        >
          <ChevronLeft size={18} /> Anterior
        </Link>
        <Link
          href={agendaHref(view, new Date(), query)}
          className="secondary-button"
        >
          Hoy
        </Link>
        <Link
          href={agendaHref(view, addDays(selectedDay, navigationStep), query)}
          className="secondary-button"
        >
          Siguiente <ChevronRight size={18} />
        </Link>
      </nav>

      {view === "semana" ? (
        <WeekView
          items={weekItems}
          selectedDay={selectedDay}
          weekStart={weekStart}
          query={query}
        />
      ) : null}
      {view === "mes" ? (
        <MonthView items={items} selectedDay={selectedDay} />
      ) : null}
      {view === "lista" ? (
        <ListView items={items} selectedType={query.tipo ?? "todos"} />
      ) : null}
      {view === "vencimientos" ? (
        <ListView
          items={items.filter((item) =>
            [
              "vencimiento_factura",
              "seguimiento_cobro",
              "presupuesto_pendiente",
            ].includes(item.tipo),
          )}
          selectedType="todos"
          showFilters={false}
        />
      ) : null}
    </ListWorkspace>
  );
}

function ReadOnlyAgenda({ items }: { items: AgendaItem[] }) {
  return (
    <ListWorkspace>
      <ModuleHeader
        eyebrow="Planificación"
        title="Agenda"
        description="Agenda autorizada en modo de solo lectura."
      />
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={`${item.source}-${item.id}`} className="card p-4">
            <p className="text-xs font-bold uppercase text-slate-500">
              {statusLabel(item.tipo)} · {formatDate(item.fechaInicio)}
            </p>
            <h2 className="mt-1 font-black text-obra-ink">{item.titulo}</h2>
            {item.descripcion ? (
              <p className="mt-2 text-sm text-slate-600">{item.descripcion}</p>
            ) : null}
            <StatusPill status={item.estado} />
          </article>
        ))}
        {!items.length ? (
          <EmptyState
            title="No hay eventos disponibles"
            description="No hay elementos dentro de tu alcance."
            icon={CalendarClock}
          />
        ) : null}
      </div>
    </ListWorkspace>
  );
}

function agendaHref(
  view: string,
  day: Date,
  query: { tipo?: string; buscar?: string },
) {
  const params = new URLSearchParams({
    vista: view,
    dia: toDateInputValue(day),
  });
  if (query.buscar) params.set("buscar", query.buscar);
  if (query.tipo) params.set("tipo", query.tipo);
  return `/agenda?${params.toString()}`;
}

function WeekView({
  items,
  selectedDay,
  weekStart,
  query,
}: {
  items: AgendaItem[];
  selectedDay: Date;
  weekStart: Date;
  query: { tipo?: string; buscar?: string };
}) {
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const selectedItems = itemsForDay(items, selectedDay);
  return (
    <div className="grid gap-3" data-agenda-week>
      <Legend />
      <nav
        className="flex gap-2 overflow-x-auto pb-1 xl:hidden"
        aria-label="Días de la semana"
      >
        {days.map((day) => {
          const active =
            toDateInputValue(day) === toDateInputValue(selectedDay);
          return (
            <Link
              className={`min-w-16 rounded-lg px-3 py-2 text-center text-xs font-black ${active ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}
              href={agendaHref("semana", day, query)}
              key={day.toISOString()}
            >
              <span className="block capitalize">
                {weekdayLabel(day).slice(0, 3)}
              </span>
              <span className="mt-1 block text-base">{day.getDate()}</span>
            </Link>
          );
        })}
      </nav>
      <section className="card p-4 xl:hidden" data-agenda-selected-day>
        <HeaderLine
          title={weekdayLabel(selectedDay)}
          count={selectedItems.length}
          subtitle={formatDay(selectedDay)}
        />
        <EventList
          items={selectedItems}
          empty="Sin citas ni tareas para este día."
        />
      </section>
      <div className="hidden gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="grid grid-cols-5 gap-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
          {days.slice(0, 5).map((day) => (
            <WeekDayColumn
              day={day}
              items={itemsForDay(items, day)}
              key={day.toISOString()}
            />
          ))}
        </div>
        <aside
          className="card overflow-hidden"
          aria-label="Agenda del día seleccionado"
        >
          <header className="border-b border-slate-200 p-4">
            <p className="type-label">Agenda del día</p>
            <h2 className="mt-1 font-bold capitalize text-obra-ink">
              {formatDay(selectedDay)}
            </h2>
          </header>
          <div className="divide-y divide-slate-100">
            {selectedItems.slice(0, 6).map((item) => (
              <Link
                key={`${item.source}-${item.id}`}
                href={item.href}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 p-3 hover:bg-slate-50"
              >
                <span className="text-xs font-black text-slate-600 tabular-nums">
                  {timeLabel(item.fechaInicio)}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-obra-ink">
                    {item.titulo}
                  </strong>
                  <span className="type-meta mt-1 block truncate">
                    {item.clienteNombre ??
                      item.obraTitulo ??
                      statusLabel(item.tipo)}
                  </span>
                </span>
              </Link>
            ))}
            {!selectedItems.length ? (
              <p className="p-4 text-sm text-slate-500">
                Sin citas ni tareas para este día.
              </p>
            ) : null}
          </div>
          <Link
            href={agendaHref("lista", selectedDay, query)}
            className="ghost-button m-3 w-[calc(100%_-_1.5rem)]"
          >
            Ver agenda completa
          </Link>
        </aside>
      </div>
      <details className="card hidden p-4 xl:block">
        <summary className="cursor-pointer font-black text-obra-ink">
          Fin de semana ·{" "}
          {itemsForDay(items, days[5]).length +
            itemsForDay(items, days[6]).length}{" "}
          elementos
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {days.slice(5).map((day) => (
            <WeekDayColumn
              day={day}
              items={itemsForDay(items, day)}
              key={day.toISOString()}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

function WeekDayColumn({ day, items }: { day: Date; items: AgendaItem[] }) {
  const summary = daySummary(items);
  return (
    <section
      className="min-w-0 bg-white p-3"
      data-agenda-day={toDateInputValue(day)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-black capitalize text-obra-ink">
            {weekdayLabel(day)}
          </h2>
          <p className="text-xs font-semibold text-slate-600">
            {formatDay(day)}
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">
          {items.length}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-600">
        {summary.visits} visitas · {summary.followUps} seguimientos ·{" "}
        {summary.tasks} tareas
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <Link
            className={`rounded-lg border border-slate-100 border-l-4 bg-white p-2.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow ${borderClass(item.tipo)}`}
            href={item.href}
            key={`${item.source}-${item.id}`}
          >
            <span className="block text-xs font-bold uppercase text-slate-500">
              {timeLabel(item.fechaInicio)} · {statusLabel(item.tipo)}
            </span>
            <span className="mt-1 block font-black text-obra-ink">
              {item.titulo}
            </span>
            {item.clienteNombre || item.obraTitulo ? (
              <span className="mt-1 block text-xs text-slate-600">
                {item.clienteNombre ?? item.obraTitulo}
              </span>
            ) : null}
          </Link>
        ))}
        {!items.length ? (
          <p className="rounded-lg bg-white p-3 text-sm text-slate-500">
            Sin citas ni tareas.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MonthView({
  items,
  selectedDay,
}: {
  items: AgendaItem[];
  selectedDay: Date;
}) {
  const first = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const selectedItems = itemsForDay(items, selectedDay);

  return (
    <div className="grid gap-4">
      <Legend />
      <section className="card p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <Link
            href={`/agenda?vista=mes&dia=${toDateInputValue(new Date(selectedDay.getFullYear(), selectedDay.getMonth() - 1, 1))}`}
            className="secondary-button"
          >
            Anterior
          </Link>
          <h2 className="text-base font-black capitalize text-obra-ink">
            {new Intl.DateTimeFormat("es-ES", {
              month: "long",
              year: "numeric",
            }).format(selectedDay)}
          </h2>
          <Link
            href={`/agenda?vista=mes&dia=${toDateInputValue(new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 1))}`}
            className="secondary-button"
          >
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
            const active =
              toDateInputValue(day) === toDateInputValue(selectedDay);
            const currentMonth = day.getMonth() === selectedDay.getMonth();
            return (
              <Link
                key={day.toISOString()}
                href={`/agenda?vista=mes&dia=${toDateInputValue(day)}`}
                className={`min-h-16 rounded-lg border p-1 text-left ${
                  active
                    ? "border-obra-ink bg-obra-yellow/25"
                    : "border-slate-100 bg-white"
                } ${currentMonth ? "text-obra-ink" : "text-slate-300"}`}
              >
                <span className="text-xs font-black">{day.getDate()}</span>
                <span className="mt-1 block text-[10px] font-bold text-slate-500">
                  {dayItems.length || ""}
                </span>
                <span className="mt-1 flex gap-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={`h-1.5 w-1.5 rounded-full ${dotClass(item.tipo)}`}
                    />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <HeaderLine
          title={`Eventos del ${formatDay(selectedDay)}`}
          count={selectedItems.length}
        />
        <EventList
          items={selectedItems}
          empty="No hay eventos para este día."
        />
      </section>
    </div>
  );
}

function ListView({
  items,
  selectedType,
  showFilters = true,
}: {
  items: AgendaItem[];
  selectedType: string;
  showFilters?: boolean;
}) {
  const upcoming = items.filter(
    (item) => item.fechaInicio >= addDays(startOfDay(new Date()), -1),
  );
  const filters = [
    ["todos", "Todos"],
    ["visitas", "Visitas"],
    ["cobros", "Cobros"],
    ["presupuestos", "Presupuestos"],
    ["materiales", "Materiales"],
    ["tareas", "Tareas"],
  ];
  const groups = groupByDay(upcoming);
  return (
    <div className="grid gap-4">
      {showFilters ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(([id, label]) => (
            <Link
              key={id}
              href={`/agenda?vista=lista&tipo=${id}`}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${selectedType === id ? "bg-obra-ink !text-white" : "border border-slate-200 bg-white text-obra-ink"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}
      {Object.entries(groups).map(([date, dayItems]) => (
        <section key={date}>
          <HeaderLine title={date} count={dayItems.length} />
          <EventList items={dayItems} empty="No hay eventos en la agenda." />
        </section>
      ))}
      {!upcoming.length ? (
        <EventList items={[]} empty="No hay eventos en la agenda." />
      ) : null}
    </div>
  );
}

function EventList({ items, empty }: { items: AgendaItem[]; empty: string }) {
  if (!items.length) {
    return (
      <EmptyState
        title={empty}
        description="Cambia la fecha o los filtros, o crea un evento nuevo."
        icon={CalendarClock}
        action={
          <Link
            href="/gestion?tipo=eventoAgenda&returnTo=/agenda"
            className="secondary-button"
          >
            Crear evento
          </Link>
        }
      />
    );
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
    <article
      className={`card overflow-hidden border-l-4 ${borderClass(item.tipo)}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
              <Icon size={15} className="shrink-0 text-obra-graphite" />
              {statusLabel(item.tipo)} · {formatDate(item.fechaInicio)}
            </p>
            <h2 className="mt-1 text-lg font-black leading-6 text-obra-ink">
              {item.titulo}
            </h2>
            {item.descripcion ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.descripcion}
              </p>
            ) : null}
          </div>
          <StatusPill status={item.estado} />
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {item.clienteNombre ? (
            <Meta icon={UserRound} label="Cliente" value={item.clienteNombre} />
          ) : null}
          {item.contactName ? (
            <Meta icon={UserRound} label="Contacto" value={item.contactName} />
          ) : null}
          {item.obraTitulo ? (
            <Meta icon={Hammer} label="Obra" value={item.obraTitulo} />
          ) : null}
          {item.facturaNumero ? (
            <Meta icon={Receipt} label="Factura" value={item.facturaNumero} />
          ) : null}
          {item.presupuestoNumero ? (
            <Meta
              icon={FileText}
              label="Presupuesto"
              value={item.presupuestoNumero}
            />
          ) : null}
          {item.direccion ? (
            <Meta icon={MapPin} label="Dirección" value={item.direccion} />
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={item.href} className="secondary-button">
            {item.editable ? <Pencil size={18} /> : <ChevronRight size={18} />}
            {item.editable ? "Editar" : "Abrir origen"}
          </Link>
        </div>

        {item.editable ? (
          <AgendaEventControls
            id={item.id}
            title={item.titulo}
            currentDateTime={toDateTimeInputValue(item.fechaInicio)}
          />
        ) : null}
      </div>
    </article>
  );
}

function HeaderLine({
  title,
  count,
  subtitle,
}: {
  title: string;
  count: number;
  subtitle?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-black text-obra-ink">{title}</h2>
        {subtitle ? (
          <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
        {count}
      </span>
    </div>
  );
}

function Legend() {
  const items = [
    ["bg-obra-yellow", "Visitas"],
    ["bg-obra-red", "Cobros"],
    ["bg-obra-orange", "Seguimientos"],
    ["bg-obra-green", "Realizado"],
    ["bg-obra-graphite", "Obra/tareas"],
    ["bg-purple-500", "Materiales"],
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
    followUps: items.filter(
      (item) =>
        item.tipo.includes("seguimiento") ||
        item.tipo === "presupuesto_pendiente",
    ).length,
    invoices: items.filter(
      (item) =>
        item.tipo === "vencimiento_factura" ||
        item.tipo === "seguimiento_cobro",
    ).length,
    tasks: items.filter((item) =>
      [
        "compra_material",
        "recordatorio_interno",
        "tarea_obra",
        "llamada",
        "inicio_obra",
        "fin_previsto_obra",
      ].includes(item.tipo),
    ).length,
  };
}

function groupByDay(items: AgendaItem[]) {
  return items.reduce<Record<string, AgendaItem[]>>((groups, item) => {
    const key = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    }).format(item.fechaInicio);
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
      (type === "cobros" &&
        ["vencimiento_factura", "seguimiento_cobro"].includes(item.tipo)) ||
      (type === "presupuestos" &&
        ["seguimiento_presupuesto", "presupuesto_pendiente"].includes(
          item.tipo,
        )) ||
      (type === "materiales" && item.tipo === "compra_material") ||
      (type === "tareas" &&
        [
          "recordatorio_interno",
          "tarea_obra",
          "llamada",
          "inicio_obra",
          "fin_previsto_obra",
        ].includes(item.tipo));
    const text = normalize(
      `${item.titulo} ${item.descripcion ?? ""} ${item.clienteNombre ?? ""} ${item.contactName ?? ""} ${item.obraTitulo ?? ""} ${item.facturaNumero ?? ""}`,
    );
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

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
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
  if (type === "vencimiento_factura" || type === "seguimiento_cobro")
    return Receipt;
  if (
    type === "inicio_obra" ||
    type === "fin_previsto_obra" ||
    type === "tarea_obra"
  )
    return Hammer;
  if (type === "compra_material") return Clock;
  if (type === "presupuesto_pendiente" || type === "seguimiento_presupuesto")
    return FileText;
  return CalendarClock;
}

function borderClass(type: string) {
  if (type === "visita") return "border-l-obra-yellow";
  if (type === "vencimiento_factura" || type === "seguimiento_cobro")
    return "border-l-obra-red";
  if (
    type === "inicio_obra" ||
    type === "fin_previsto_obra" ||
    type === "tarea_obra"
  )
    return "border-l-obra-graphite";
  if (type === "compra_material") return "border-l-purple-500";
  return "border-l-slate-300";
}

function dotClass(type: string) {
  if (type === "visita") return "bg-obra-yellow";
  if (type === "vencimiento_factura" || type === "seguimiento_cobro")
    return "bg-obra-red";
  if (type === "compra_material") return "bg-purple-500";
  if (type.includes("seguimiento") || type === "presupuesto_pendiente")
    return "bg-obra-orange";
  if (type === "inicio_obra" || type === "fin_previsto_obra")
    return "bg-obra-graphite";
  return "bg-slate-400";
}

function weekdayLabel(day: Date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(day);
}

function timeLabel(day: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(day);
}

function toDateTimeInputValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
