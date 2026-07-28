"use client";

import Link from "next/link";
import { useState } from "react";
import { Eraser, Search } from "lucide-react";
import { FilterSheet, FilterTrigger } from "@/components/compact-filters";

type Option = readonly [string, string];

export type ClientFilterQuery = {
  buscar?: string;
  vista?: string;
  estado?: string;
  tipo?: string;
  archivo?: string;
  ordenar?: string;
  filtros?: string;
};

export function ClientFilterBar({
  query,
  typeOptions,
  statusOptions,
  filterOptions,
  orderOptions,
  activeFilterLabels,
}: {
  query: ClientFilterQuery;
  typeOptions: string[];
  statusOptions: readonly Option[];
  filterOptions: readonly Option[];
  orderOptions: readonly Option[];
  activeFilterLabels: string[];
}) {
  const [open, setOpen] = useState(false);
  const activeFilters = new Set((query.filtros ?? "").split(",").filter(Boolean));
  const filterCount = [
    query.estado && query.estado !== "todos",
    query.tipo && query.tipo !== "todos",
    query.archivo && query.archivo !== defaultArchive(query.vista),
    query.ordenar && query.ordenar !== "ultimaActividad_desc",
    ...activeFilters,
  ].filter(Boolean).length;
  const selectedView = query.vista ?? "accion";

  return (
    <div className="grid gap-3">
      <nav
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label="Vistas inteligentes de clientes"
        data-client-smart-views="3"
      >
        {[
          ["accion", "Necesitan acción"],
          ["activos", "Activos"],
          ["todos", "Todos"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={`/clientes?vista=${id}`}
            aria-current={selectedView === id ? "page" : undefined}
            className={
              selectedView === id
                ? "inline-flex min-h-10 shrink-0 items-center rounded-xl bg-content px-4 text-sm font-semibold text-surface"
                : "secondary-button min-h-10 shrink-0"
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-end gap-2">
        <form action="/clientes" className="min-w-0 flex-1">
          <input type="hidden" name="vista" value={selectedView} />
          {hiddenFilterInputs(query)}
          <label className="block">
            <span className="label mb-1 block">Buscar</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
                size={18}
              />
              <input
                className="field min-h-11 pl-10 pr-24"
                type="search"
                name="buscar"
                defaultValue={query.buscar ?? ""}
                placeholder="Nombre, CIF/NIF, email, teléfono…"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 min-h-8 -translate-y-1/2 rounded-lg px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft"
              >
                Buscar
              </button>
            </span>
          </label>
        </form>
        <FilterTrigger count={filterCount} onClick={() => setOpen(true)} />
      </div>

      {activeFilterLabels.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {activeFilterLabels.map((label) => (
            <span key={label} className="rounded-full bg-subtle px-3 py-1.5 text-xs font-semibold text-content-secondary">
              {label}
            </span>
          ))}
          <Link href={`/clientes?vista=${selectedView}`} className="secondary-button min-h-9 px-3 py-1 text-xs">
            <Eraser size={15} />
            Limpiar filtros
          </Link>
        </div>
      ) : null}

      <FilterSheet open={open} title="Filtros de clientes" onClose={() => setOpen(false)}>
        <form action="/clientes" className="grid gap-4">
          <input type="hidden" name="vista" value={selectedView} />
          {query.buscar ? <input type="hidden" name="buscar" value={query.buscar} /> : null}
          <Select name="tipo" label="Tipo" value={query.tipo ?? "todos"} options={[["todos", "Todos"], ...typeOptions.map((type) => [type, type] as const)]} />
          <Select name="estado" label="Estado" value={query.estado ?? "todos"} options={statusOptions} />
          <Select
            name="archivo"
            label="Archivo"
            value={query.archivo ?? defaultArchive(selectedView)}
            options={[
              ["activos", "Activos"],
              ["archivados", "Archivados"],
              ["todos", "Todos"],
            ]}
          />
          <Select name="ordenar" label="Orden" value={query.ordenar ?? "ultimaActividad_desc"} options={orderOptions} />
          <fieldset className="grid gap-2">
            <legend className="label">Situaciones</legend>
            {filterOptions.map(([id, label]) => (
              <label key={id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm font-semibold text-content-secondary">
                <input type="checkbox" name="filtro" value={id} defaultChecked={activeFilters.has(id)} />
                {label}
              </label>
            ))}
          </fieldset>
        </form>
      </FilterSheet>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly Option[];
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value}>
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function hiddenFilterInputs(query: ClientFilterQuery) {
  return (
    <>
      {query.estado && query.estado !== "todos" ? <input type="hidden" name="estado" value={query.estado} /> : null}
      {query.tipo && query.tipo !== "todos" ? <input type="hidden" name="tipo" value={query.tipo} /> : null}
      {query.archivo ? <input type="hidden" name="archivo" value={query.archivo} /> : null}
      {query.ordenar ? <input type="hidden" name="ordenar" value={query.ordenar} /> : null}
      {query.filtros ? <input type="hidden" name="filtros" value={query.filtros} /> : null}
    </>
  );
}

function defaultArchive(view: string | undefined) {
  return view === "todos" ? "todos" : "activos";
}
