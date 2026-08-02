"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import { CompactSearch } from "@/components/ui-primitives";

type AgendaFilterQuery = {
  persona?: string;
  obra?: string;
  tipo?: string;
  buscar?: string;
};

export function AgendaFilters({
  query,
  view,
  selectedDay,
  personOptions,
  workOptions,
}: {
  query: AgendaFilterQuery;
  view: string;
  selectedDay: string;
  personOptions: Array<{ key: string; label: string }>;
  workOptions: Array<{ id: string; label: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action="/agenda"
      className="agenda-master__filters flex flex-wrap items-end gap-2"
      aria-label="Filtros de agenda"
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) {
          formRef.current?.requestSubmit();
        }
      }}
    >
      <input type="hidden" name="vista" value={view} />
      <input type="hidden" name="dia" value={selectedDay} />
      <label className="flex min-h-10 min-w-32 items-center rounded-lg border border-slate-200 bg-white px-3">
        <span className="shrink-0 text-xs font-bold text-slate-600">
          Personas
        </span>
        <select
          className="h-9 min-w-0 flex-1 bg-transparent pl-2 text-sm font-black text-obra-ink outline-none"
          name="persona"
          defaultValue={query.persona ?? "todas"}
        >
          <option value="todas">Todas</option>
          {personOptions.map((person) => (
            <option key={person.key} value={person.key}>
              {person.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-10 min-w-32 items-center rounded-lg border border-slate-200 bg-white px-3">
        <span className="shrink-0 text-xs font-bold text-slate-600">Obras</span>
        <select
          className="h-9 min-w-0 flex-1 bg-transparent pl-2 text-sm font-black text-obra-ink outline-none"
          name="obra"
          defaultValue={query.obra ?? "todas"}
        >
          <option value="todas">Todas</option>
          {workOptions.map((work) => (
            <option key={work.id} value={work.id}>
              {work.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-10 min-w-44 items-center rounded-lg border border-slate-200 bg-white px-3">
        <span className="shrink-0 text-xs font-bold text-slate-600">
          Tipo de evento
        </span>
        <select
          className="h-9 min-w-0 flex-1 bg-transparent pl-2 text-sm font-black text-obra-ink outline-none"
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
      <details className="relative">
        <summary
          className="secondary-button grid min-h-10 w-10 cursor-pointer list-none place-items-center p-0"
          aria-label="Buscar en la agenda"
        >
          <Search size={17} />
        </summary>
        <div className="absolute left-0 z-40 mt-1 flex w-72 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl sm:left-auto sm:right-0">
          <CompactSearch
            name="buscar"
            defaultValue={query.buscar ?? ""}
            placeholder="Evento, cliente, trabajo…"
            className="min-h-10 py-2 text-sm"
          />
          <button className="primary-button min-h-10 px-3" type="submit">
            Buscar
          </button>
        </div>
      </details>
    </form>
  );
}
