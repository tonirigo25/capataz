import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Hammer,
  MapPin,
  Pencil,
  Receipt,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AgendaEventControls } from "@/components/agenda-event-controls";
import { ListWorkspace } from "@/components/workspaces";
import { StatusPill } from "@/components/status-pill";
import { ModuleHeader } from "@/components/portal/modules-b/module-frame";
import { EmptyState } from "@/components/ui-primitives";
import { AgendaFilters } from "./agenda-filters";
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
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const views = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "lista", label: "Lista" },
  { id: "vencimientos", label: "Vencimientos" },
];

type AgendaQuery = {
  vista?: string;
  dia?: string;
  tipo?: string;
  buscar?: string;
  persona?: string;
  obra?: string;
};

type AgendaPerson = {
  key: string;
  label: string;
};

type AgendaPeopleByItem = Map<string, AgendaPerson[]>;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<AgendaQuery>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("agenda.view");
  const canManage = (await resolveAuthorization(auth, "agenda.manage")).allowed;
  const view = views.some((item) => item.id === query.vista)
    ? query.vista!
    : "semana";
  const requestedDay = query.dia ? new Date(`${query.dia}T00:00:00`) : new Date();
  const selectedDay = startOfDay(Number.isNaN(requestedDay.getTime()) ? new Date() : requestedDay);
  const allItems = await getAgendaItems();
  const peopleByItem = await resolveAgendaPeople(auth.companyId, allItems);
  const personOptions = agendaPersonOptions(peopleByItem);
  const workOptions = agendaWorkOptions(allItems);
  const items = filterAgendaItems(
    allItems,
    query.tipo,
    query.buscar,
    query.obra,
    query.persona,
    peopleByItem,
  );
  const todayItems = itemsForDay(items, new Date());
  const weekStart = startOfWeek(selectedDay);
  const weekItems = itemsBetween(items, weekStart, addDays(weekStart, 7));
  const navigationStep = view === "semana" ? 7 : 1;
  const hasActiveFilters = Boolean(
    query.buscar ||
    (query.tipo && query.tipo !== "todos") ||
    (query.obra && query.obra !== "todas") ||
    (query.persona && query.persona !== "todas"),
  );
  if (!canManage) return <ReadOnlyAgenda items={items} />;

  return (
    <ListWorkspace className="agenda-page !min-h-0 lg:!py-4 lg:!pb-4">
      <header className="agenda-master__header mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-obra-ink sm:text-3xl">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Planificación y coordinación del equipo para una ejecución
            eficiente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <Link href="/agenda" className="ghost-button min-h-10">
              Limpiar filtros
            </Link>
          ) : null}
        </div>
      </header>

      <div className="agenda-master__toolbar mb-3 flex flex-col gap-2 min-[1180px]:flex-row min-[1180px]:items-end min-[1180px]:justify-between">
        <AgendaFilters
          query={query}
          view={view}
          selectedDay={toDateInputValue(selectedDay)}
          personOptions={personOptions}
          workOptions={workOptions}
        />

        <AgendaToolbar
          view={view}
          selectedDay={selectedDay}
          weekStart={weekStart}
          navigationStep={navigationStep}
          query={query}
        />
      </div>

      {view === "semana" ? (
        <WeekView
          items={weekItems}
          selectedDay={selectedDay}
          weekStart={weekStart}
          query={query}
          todayItems={todayItems}
          overviewItems={items}
          peopleByItem={peopleByItem}
        />
      ) : null}
      {view === "mes" ? (
        <MonthView items={items} selectedDay={selectedDay} query={query} />
      ) : null}
      {view === "lista" ? (
        <ListView
          items={items}
          selectedType={query.tipo ?? "todos"}
          selectedDay={selectedDay}
          query={query}
        />
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
          selectedDay={selectedDay}
          query={query}
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

function AgendaToolbar({
  view,
  selectedDay,
  weekStart,
  navigationStep,
  query,
}: {
  view: string;
  selectedDay: Date;
  weekStart: Date;
  navigationStep: number;
  query: AgendaQuery;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Cambiar fecha y vista"
      >
        <div className="flex min-h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Link
            href={agendaHref(view, shiftAgendaDate(view, selectedDay, -1, navigationStep), query)}
            className="grid h-10 w-10 place-items-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Periodo anterior"
          >
            <ChevronLeft size={17} />
          </Link>
          <span className="min-w-36 px-3 text-center text-xs font-black text-obra-ink sm:min-w-44">
            {view === "semana"
              ? weekRangeLabel(weekStart)
              : formatDay(selectedDay)}
          </span>
          <Link
            href={agendaHref(view, shiftAgendaDate(view, selectedDay, 1, navigationStep), query)}
            className="grid h-10 w-10 place-items-center border-l border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Periodo siguiente"
          >
            <ChevronRight size={17} />
          </Link>
        </div>
        <Link
          href={agendaHref(view, new Date(), query)}
          className="secondary-button min-h-10 px-3"
        >
          Hoy
        </Link>
        <details className="relative">
          <summary className="secondary-button min-h-10 cursor-pointer list-none px-3">
            <CalendarDays size={17} />
            {views.find((item) => item.id === view)?.label ?? "Semana"}
          </summary>
          <div className="absolute right-0 z-40 mt-1 grid min-w-44 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {views.map((item) => (
              <Link
                key={item.id}
                href={agendaHref(item.id, selectedDay, query)}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  item.id === view
                    ? "bg-obra-ink text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}

function agendaHref(view: string, day: Date, query: AgendaQuery) {
  const params = new URLSearchParams({
    vista: view,
    dia: toDateInputValue(day),
  });
  if (query.buscar) params.set("buscar", query.buscar);
  if (query.tipo) params.set("tipo", query.tipo);
  if (query.persona) params.set("persona", query.persona);
  if (query.obra) params.set("obra", query.obra);
  return `/agenda?${params.toString()}`;
}

function shiftAgendaDate(view: string, day: Date, direction: -1 | 1, navigationStep: number) {
  if (view === "mes") return new Date(day.getFullYear(), day.getMonth() + direction, 1);
  return addDays(day, direction * navigationStep);
}

function WeekView({
  items,
  selectedDay,
  weekStart,
  query,
  todayItems,
  overviewItems,
  peopleByItem,
}: {
  items: AgendaItem[];
  selectedDay: Date;
  weekStart: Date;
  query: AgendaQuery;
  todayItems: AgendaItem[];
  overviewItems: AgendaItem[];
  peopleByItem: AgendaPeopleByItem;
}) {
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const selectedItems = itemsForDay(items, selectedDay);
  return (
    <div className="agenda-master__week grid gap-3" data-agenda-week>
      <nav
        className="flex gap-1.5 overflow-x-auto pb-1 min-[1180px]:hidden"
        aria-label="Días de la semana"
      >
        {days.map((day) => {
          const active =
            toDateInputValue(day) === toDateInputValue(selectedDay);
          return (
            <Link
              className={`min-w-14 rounded-lg px-2 py-1.5 text-center text-[11px] font-black ${active ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}
              href={agendaHref("semana", day, query)}
              key={day.toISOString()}
            >
              <span className="block capitalize">
                {weekdayLabel(day).slice(0, 3)}
              </span>
              <span className="mt-0.5 block text-sm">{day.getDate()}</span>
            </Link>
          );
        })}
      </nav>
      <section
        className="card p-3 min-[1180px]:hidden"
        data-agenda-selected-day
      >
        <HeaderLine
          title={weekdayLabel(selectedDay)}
          count={selectedItems.length}
          subtitle={formatDay(selectedDay)}
        />
        <div className="divide-y divide-slate-100">
          {selectedItems.slice(0, 6).map((item) => (
            <Link
              key={agendaItemKey(item)}
              href={item.href}
              className="grid grid-cols-[2.6rem_minmax(0,1fr)_auto] items-start gap-2 py-2.5"
            >
              <span className="text-[11px] font-black tabular-nums text-slate-500">
                {timeLabel(item.fechaInicio)}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm leading-5 text-obra-ink">
                  {item.titulo}
                </strong>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {item.obraTitulo ??
                    item.clienteNombre ??
                    statusLabel(item.tipo)}
                </span>
              </span>
              <ChevronRight size={16} className="mt-0.5 text-slate-400" />
            </Link>
          ))}
          {!selectedItems.length ? (
            <p className="py-3 text-sm text-slate-500">
              Sin citas ni tareas para este día.
            </p>
          ) : null}
        </div>
        <Link
          href={agendaHref("lista", selectedDay, query)}
          className="ghost-button mt-2 min-h-9 w-full text-xs"
        >
          Ver agenda completa
        </Link>
      </section>
      <div className="agenda-master__calendar hidden gap-3 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_15rem] xl:grid-cols-[minmax(0,1fr)_16rem]">
        <WeekTimeGrid days={days} items={items} />
        <AgendaTodayPanel items={todayItems} query={query} />
      </div>
      <AgendaOverviewCards
        items={items}
        overviewItems={overviewItems}
        peopleByItem={peopleByItem}
        selectedDay={selectedDay}
      />
    </div>
  );
}

function WeekTimeGrid({ days, items }: { days: Date[]; items: AgendaItem[] }) {
  const hours = Array.from({ length: 11 }, (_, index) => index + 8);
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label="Calendario semanal de 08:00 a 18:00"
      data-agenda-time-grid
    >
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
        <span aria-hidden="true" />
        {days.map((day) => {
          const isToday =
            toDateInputValue(day) === toDateInputValue(new Date());
          return (
            <div
              key={day.toISOString()}
              className={`border-l border-slate-200 px-1 py-2 text-center ${isToday ? "bg-emerald-50" : ""}`}
            >
              <span className="block text-[10px] font-black capitalize text-slate-500">
                {weekdayLabel(day).slice(0, 3)}
              </span>
              <span
                className={`mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                  isToday ? "bg-obra-green text-white" : "text-obra-ink"
                }`}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div className="relative h-[385px] bg-slate-50">
          {hours.map((hour, index) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[9px] font-bold tabular-nums text-slate-400"
              style={{ top: `${(index / 10) * 100}%` }}
            >
              {hour.toString().padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="relative h-[385px] border-l border-slate-200"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0, transparent calc(10% - 1px), rgb(226 232 240) calc(10% - 1px), rgb(226 232 240) 10%)",
            }}
          >
            {itemsForDay(items, day)
              .filter(isAgendaGridTime)
              .map((item) => {
                const placement = agendaPlacement(item);
                return (
                  <Link
                    href={item.href}
                    key={agendaItemKey(item)}
                    className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-[9px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md ${eventSurfaceClass(item.tipo)}`}
                    style={{ top: placement.top, height: placement.height }}
                    title={`${timeLabel(item.fechaInicio)} · ${item.titulo}`}
                  >
                    <span className="block font-black tabular-nums">
                      {timeLabel(item.fechaInicio)}
                    </span>
                    <strong className="mt-0.5 block line-clamp-2 text-[10px]">
                      {item.titulo}
                    </strong>
                    {item.obraTitulo || item.clienteNombre ? (
                      <span className="mt-0.5 block truncate opacity-75">
                        {item.obraTitulo ?? item.clienteNombre}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}

function AgendaTodayPanel({
  items,
  query,
}: {
  items: AgendaItem[];
  query: AgendaQuery;
}) {
  return (
    <aside
      className="card flex min-h-0 flex-col overflow-hidden"
      aria-label="Agenda de hoy"
      data-agenda-today
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-black text-obra-ink">Agenda de hoy</h2>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
            {items.length} elementos visibles
          </p>
        </div>
        <CalendarDays size={17} className="text-obra-green" />
      </header>
      <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
        {items.slice(0, 6).map((item) => (
          <Link
            key={agendaItemKey(item)}
            href={item.href}
            className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-2 px-3 py-2.5 hover:bg-slate-50"
          >
            <span className="text-[10px] font-black tabular-nums text-slate-500">
              {timeLabel(item.fechaInicio)}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs text-obra-ink">
                {item.titulo}
              </strong>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                {item.obraTitulo ??
                  item.clienteNombre ??
                  statusLabel(item.tipo)}
              </span>
            </span>
          </Link>
        ))}
        {!items.length ? (
          <p className="p-3 text-xs leading-5 text-slate-500">
            No hay citas, tareas ni vencimientos visibles para hoy.
          </p>
        ) : null}
      </div>
      <Link
        href={agendaHref("lista", new Date(), query)}
        className="ghost-button m-2.5 min-h-9 text-xs"
      >
        Ver agenda completa
      </Link>
    </aside>
  );
}

function AgendaOverviewCards({
  items,
  overviewItems,
  peopleByItem,
  selectedDay,
}: {
  items: AgendaItem[];
  overviewItems: AgendaItem[];
  peopleByItem: AgendaPeopleByItem;
  selectedDay: Date;
}) {
  const loads = personLoads(items, peopleByItem).slice(0, 5);
  const maxLoad = Math.max(1, ...loads.map((item) => item.count));
  const assigned = items
    .filter(
      (item) =>
        [
          "visita",
          "recordatorio_interno",
          "tarea_obra",
          "llamada",
          "inicio_obra",
        ].includes(item.tipo) &&
        (peopleByItem.get(agendaItemKey(item)) ?? []).length > 0,
    )
    .slice(0, 4);
  const deadlines = overviewItems
    .filter((item) =>
      [
        "vencimiento_factura",
        "seguimiento_cobro",
        "presupuesto_pendiente",
        "fin_previsto_obra",
      ].includes(item.tipo),
    )
    .filter((item) => item.fechaInicio >= startOfDay(selectedDay))
    .toSorted((left, right) => left.fechaInicio.getTime() - right.fechaInicio.getTime())
    .slice(0, 4);

  return (
    <div
      className="agenda-master__overview grid gap-3 md:grid-cols-[.95fr_1.1fr_1fr]"
      data-agenda-overview
    >
      <section className="card p-3" aria-labelledby="agenda-team-load">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="agenda-team-load"
            className="text-sm font-black text-obra-ink"
          >
            Carga de trabajo del equipo
          </h2>
          <span className="text-[10px] font-semibold text-slate-500">
            {weekRangeLabel(startOfWeek(selectedDay))}
          </span>
        </div>
        <div className="mt-3 grid gap-2.5">
          {loads.map((person) => (
            <div
              key={person.key}
              className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 text-xs"
            >
              <span className="truncate font-bold text-slate-700">
                {person.label}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-obra-green"
                  style={{
                    width: `${Math.max(12, (person.count / maxLoad) * 100)}%`,
                  }}
                />
              </span>
              <span className="font-black tabular-nums text-slate-500">
                {person.count} elem.
              </span>
            </div>
          ))}
          {!loads.length ? (
            <p className="text-xs leading-5 text-slate-500">
              No hay responsables asociados a los elementos visibles de esta
              semana.
            </p>
          ) : null}
        </div>
        <Link
          href="/equipo"
          className="mt-3 inline-flex text-xs font-black text-obra-green hover:underline"
        >
          Ver planificación del equipo
        </Link>
      </section>

      <CompactAgendaList
        title="Tareas y visitas asignadas"
        items={assigned}
        empty="No hay tareas ni visitas visibles esta semana."
        footerHref="/agenda?vista=lista&tipo=tareas"
        footerLabel="Ver todas"
      />

      <CompactAgendaList
        title="Próximos vencimientos"
        items={deadlines}
        empty="No hay vencimientos visibles esta semana."
        footerHref="/agenda?vista=vencimientos"
        footerLabel="Ver todos"
        showRelativeDate
      />
    </div>
  );
}

function CompactAgendaList({
  title,
  items,
  empty,
  footerHref,
  footerLabel,
  showRelativeDate = false,
}: {
  title: string;
  items: AgendaItem[];
  empty: string;
  footerHref: string;
  footerLabel: string;
  showRelativeDate?: boolean;
}) {
  return (
    <section className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-obra-ink">{title}</h2>
        <Link
          href={footerHref}
          className="text-[10px] font-black text-obra-green hover:underline"
        >
          {footerLabel}
        </Link>
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        {items.map((item) => {
          const Icon = iconForType(item.tipo);
          return (
            <Link
              key={agendaItemKey(item)}
              href={item.href}
              className="grid grid-cols-[1.7rem_minmax(0,1fr)_auto] items-center gap-2 py-2 hover:bg-slate-50"
            >
              <span
                className={`grid h-7 w-7 place-items-center rounded-lg ${eventIconSurfaceClass(item.tipo)}`}
              >
                <Icon size={14} />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs text-obra-ink">
                  {item.titulo}
                </strong>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                  {item.obraTitulo ??
                    item.clienteNombre ??
                    statusLabel(item.tipo)}
                </span>
              </span>
              <span className="text-right text-[10px] font-bold tabular-nums text-slate-500">
                {showRelativeDate
                  ? relativeDateLabel(item.fechaInicio)
                  : shortScheduleLabel(item.fechaInicio)}
              </span>
            </Link>
          );
        })}
        {!items.length ? (
          <p className="py-3 text-xs text-slate-500">{empty}</p>
        ) : null}
      </div>
    </section>
  );
}

function MonthView({
  items,
  selectedDay,
  query,
}: {
  items: AgendaItem[];
  selectedDay: Date;
  query: AgendaQuery;
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
            href={agendaHref(
              "mes",
              new Date(
                selectedDay.getFullYear(),
                selectedDay.getMonth() - 1,
                1,
              ),
              query,
            )}
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
            href={agendaHref(
              "mes",
              new Date(
                selectedDay.getFullYear(),
                selectedDay.getMonth() + 1,
                1,
              ),
              query,
            )}
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
                href={agendaHref("mes", day, query)}
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
  selectedDay,
  query,
  showFilters = true,
}: {
  items: AgendaItem[];
  selectedType: string;
  selectedDay: Date;
  query: AgendaQuery;
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
              href={agendaHref("lista", selectedDay, { ...query, tipo: id })}
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

function filterAgendaItems(
  items: AgendaItem[],
  type?: string,
  query?: string,
  workId?: string,
  personKey?: string,
  peopleByItem: AgendaPeopleByItem = new Map(),
) {
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
    const workMatch = !workId || workId === "todas" || item.obraId === workId;
    const personMatch =
      !personKey ||
      personKey === "todas" ||
      (peopleByItem.get(agendaItemKey(item)) ?? []).some(
        (person) => person.key === personKey,
      );
    return typeMatch && queryMatch && workMatch && personMatch;
  });
}

async function resolveAgendaPeople(
  companyId: string,
  items: AgendaItem[],
): Promise<AgendaPeopleByItem> {
  const eventIds = items
    .filter((item) => item.source === "evento")
    .map((item) => item.id);
  const workIds = [
    ...new Set(
      items
        .map((item) => item.obraId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [events, works] = await Promise.all([
    eventIds.length
      ? prisma.eventoAgenda.findMany({
          where: { companyId, id: { in: eventIds } },
          select: {
            id: true,
            obraId: true,
            taskId: true,
          },
        })
      : Promise.resolve([]),
    workIds.length
      ? prisma.work.findMany({
          where: { companyId, id: { in: workIds } },
          select: {
            id: true,
            responsable: true,
            comercial: true,
            jefeObra: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const taskIds = [
    ...new Set(
      events
        .map((event) => event.taskId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const tasks = taskIds.length
    ? await prisma.task.findMany({
        where: { companyId, id: { in: taskIds }, archivedAt: null },
        select: {
          id: true,
          assigneeId: true,
          assignments: {
            where: { removedAt: null },
            select: { userId: true },
          },
        },
      })
    : [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const userIds = [
    ...new Set(
      tasks
        .flatMap((task) => [
          task.assigneeId,
          ...task.assignments.map((assignment) => assignment.userId),
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const memberships = userIds.length
    ? await prisma.companyMembership.findMany({
        where: {
          companyId,
          status: "active",
          userId: { in: userIds },
        },
        select: { userId: true, user: { select: { displayName: true } } },
      })
    : [];
  const peopleByUserId = new Map(
    memberships.map((membership) => [
      membership.userId,
      {
        key: `person:${normalize(membership.user.displayName)}`,
        label: membership.user.displayName,
      },
    ]),
  );

  const peopleByWorkId = new Map<string, AgendaPerson[]>();
  for (const work of works) {
    const names = [work.responsable, work.jefeObra, work.comercial]
      .map((name) => name?.trim())
      .filter((name): name is string => Boolean(name));
    peopleByWorkId.set(
      work.id,
      uniquePeople(
        names.map((name) => ({
          key: `person:${normalize(name)}`,
          label: name,
        })),
      ),
    );
  }

  const peopleByEventId = new Map<string, AgendaPerson[]>();
  for (const event of events) {
    const task = event.taskId ? taskById.get(event.taskId) : undefined;
    const userPeople = [
      task?.assigneeId,
      ...(task?.assignments.map((assignment) => assignment.userId) ?? []),
    ]
      .map((id) => (id ? peopleByUserId.get(id) : undefined))
      .filter((person): person is AgendaPerson => Boolean(person));
    peopleByEventId.set(
      event.id,
      uniquePeople(userPeople),
    );
  }

  const result: AgendaPeopleByItem = new Map();
  for (const item of items) {
    const direct = item.source === "evento" ? (peopleByEventId.get(item.id) ?? []) : [];
    const primaryWorkPerson = item.obraId ? (peopleByWorkId.get(item.obraId) ?? []).slice(0, 1) : [];
    result.set(
      agendaItemKey(item),
      direct.length ? uniquePeople(direct) : uniquePeople(primaryWorkPerson),
    );
  }
  return result;
}

function agendaPersonOptions(peopleByItem: AgendaPeopleByItem) {
  return uniquePeople([...peopleByItem.values()].flat()).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

function agendaWorkOptions(items: AgendaItem[]) {
  const options = new Map<string, string>();
  for (const item of items) {
    if (item.obraId && item.obraTitulo)
      options.set(item.obraId, item.obraTitulo);
  }
  return [...options.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function uniquePeople(people: AgendaPerson[]) {
  return [...new Map(people.map((person) => [person.key, person])).values()];
}

function personLoads(items: AgendaItem[], peopleByItem: AgendaPeopleByItem) {
  const loads = new Map<string, AgendaPerson & { count: number }>();
  for (const item of items) {
    for (const person of peopleByItem.get(agendaItemKey(item)) ?? []) {
      const current = loads.get(person.key);
      loads.set(person.key, {
        ...person,
        count: (current?.count ?? 0) + 1,
      });
    }
  }
  return [...loads.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"),
  );
}

function agendaItemKey(item: AgendaItem) {
  return `${item.source}:${item.id}`;
}

function agendaPlacement(item: AgendaItem) {
  const startMinutes =
    item.fechaInicio.getHours() * 60 + item.fechaInicio.getMinutes();
  const durationMinutes = item.fechaFin
    ? Math.max(
        30,
        (item.fechaFin.getTime() - item.fechaInicio.getTime()) / 60000,
      )
    : 60;
  const heightPixels = Math.max(36, Math.min(78, (durationMinutes / 60) * 38.5));
  const rawTop = ((startMinutes - 8 * 60) / (10 * 60)) * 100;
  const maxTop = 100 - (heightPixels / 385) * 100;
  return {
    top: `${Math.max(0, Math.min(maxTop, rawTop))}%`,
    height: `${heightPixels}px`,
  };
}

function isAgendaGridTime(item: AgendaItem) {
  const minutes = item.fechaInicio.getHours() * 60 + item.fechaInicio.getMinutes();
  return minutes >= 8 * 60 && minutes < 18 * 60;
}

function weekRangeLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const startLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: weekStart.getMonth() === end.getMonth() ? undefined : "short",
  }).format(weekStart);
  const endLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function relativeDateLabel(date: Date) {
  const difference = Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000,
  );
  if (difference === 0) return "Hoy";
  if (difference === 1) return "Mañana";
  if (difference === -1) return "Ayer";
  if (difference > 1) return `En ${difference} días`;
  return `Hace ${Math.abs(difference)} días`;
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

function eventSurfaceClass(type: string) {
  if (type === "visita") return "border-amber-200 bg-amber-50 text-amber-950";
  if (type === "vencimiento_factura" || type === "seguimiento_cobro")
    return "border-rose-200 bg-rose-50 text-rose-950";
  if (type === "compra_material")
    return "border-violet-200 bg-violet-50 text-violet-950";
  if (type.includes("seguimiento") || type === "presupuesto_pendiente")
    return "border-blue-200 bg-blue-50 text-blue-950";
  if (
    type === "inicio_obra" ||
    type === "fin_previsto_obra" ||
    type === "tarea_obra"
  )
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function eventIconSurfaceClass(type: string) {
  if (type === "visita") return "bg-amber-50 text-amber-700";
  if (type === "vencimiento_factura" || type === "seguimiento_cobro")
    return "bg-rose-50 text-rose-700";
  if (type === "compra_material") return "bg-violet-50 text-violet-700";
  if (type.includes("seguimiento") || type === "presupuesto_pendiente")
    return "bg-blue-50 text-blue-700";
  return "bg-emerald-50 text-emerald-700";
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

function shortScheduleLabel(day: Date) {
  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
  })
    .format(day)
    .replace(".", "");
  return `${weekday} ${timeLabel(day)}`;
}

function toDateTimeInputValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
