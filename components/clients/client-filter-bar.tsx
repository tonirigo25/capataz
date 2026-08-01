"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Eraser, Search, Upload, UserPlus } from "lucide-react";
import { FilterSheet, FilterTrigger } from "@/components/compact-filters";
import type { ClientSmartViewCounts } from "@/lib/client-crm";

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

const smartViews: Array<{ id: keyof ClientSmartViewCounts; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "presupuesto", label: "Presupuesto abierto" },
  { id: "trabajo", label: "Trabajo activo" },
  { id: "cobro", label: "Cobro pendiente" },
  { id: "riesgo", label: "En riesgo" },
];

export function ClientFilterBar({
  query,
  typeOptions,
  statusOptions,
  filterOptions,
  orderOptions,
  activeFilterLabels,
  smartViewCounts,
  canCreate,
  canExport,
  canImport,
}: {
  query: ClientFilterQuery;
  typeOptions: string[];
  statusOptions: readonly Option[];
  filterOptions: readonly Option[];
  orderOptions: readonly Option[];
  activeFilterLabels: string[];
  smartViewCounts: ClientSmartViewCounts;
  canCreate: boolean;
  canExport: boolean;
  canImport: boolean;
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
  const selectedView = smartViews.some(({ id }) => id === query.vista)
    ? (query.vista as keyof ClientSmartViewCounts)
    : "todos";

  return (
    <div className="clients-tools">
      <nav className="clients-smart-views" aria-label="Vistas inteligentes de clientes" data-client-smart-views="6">
        {smartViews.map(({ id, label }) => (
          <Link
            key={id}
            href={clientViewHref(query, id)}
            aria-current={selectedView === id ? "page" : undefined}
            className="clients-smart-view"
          >
            <span>{label}</span>
            <span className="clients-smart-view__count">{smartViewCounts[id]}</span>
          </Link>
        ))}
      </nav>

      <div className="clients-toolbar">
        <form action="/clientes" className="clients-search-form">
          <input type="hidden" name="vista" value={selectedView} />
          {hiddenFilterInputs(query)}
          <label className="clients-search-field">
            <span className="sr-only">Buscar clientes</span>
            <Search aria-hidden="true" size={18} />
            <input type="search" name="buscar" defaultValue={query.buscar ?? ""} placeholder="Buscar cliente, contacto, empresa…" />
          </label>
        </form>
        <FilterTrigger count={filterCount} onClick={() => setOpen(true)} />
        {canImport || canExport ? (
          <div className="flex items-center gap-2">
            {canImport ? (
              <Link href="/configuracion/importar" className="secondary-button">
                <Upload size={17} aria-hidden="true" /><span>Importar</span>
              </Link>
            ) : null}
            {canExport ? (
              <Link href={exportHref(query)} className="secondary-button clients-export-action" download>
                <Download size={17} aria-hidden="true" /><span>Exportar</span>
              </Link>
            ) : null}
          </div>
        ) : null}
        {canCreate ? (
          <Link href="/gestion?tipo=cliente&returnTo=/clientes" className="primary-button clients-create-action">
            <UserPlus size={17} aria-hidden="true" /><span>Nuevo cliente</span>
          </Link>
        ) : null}
      </div>

      {activeFilterLabels.length ? (
        <div className="clients-filter-chips" aria-label="Filtros activos">
          {activeFilterLabels.map((label) => <span key={label}>{label}</span>)}
          <Link href={`/clientes?vista=${selectedView}`} className="secondary-button min-h-9 px-3 py-1 text-xs">
            <Eraser size={15} aria-hidden="true" />Limpiar filtros
          </Link>
        </div>
      ) : null}

      <FilterSheet open={open} title="Filtros de clientes" onClose={() => setOpen(false)}>
        <form action="/clientes" className="grid gap-4">
          <input type="hidden" name="vista" value={selectedView} />
          {query.buscar ? <input type="hidden" name="buscar" value={query.buscar} /> : null}
          <Select name="tipo" label="Tipo" value={query.tipo ?? "todos"} options={[["todos", "Todos"], ...typeOptions.map((type) => [type, type] as const)]} />
          <Select name="estado" label="Estado" value={query.estado ?? "todos"} options={statusOptions} />
          <Select name="archivo" label="Archivo" value={query.archivo ?? defaultArchive(selectedView)} options={[["activos", "Activos"], ["archivados", "Archivados"], ["todos", "Todos"]]} />
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

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: readonly Option[] }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value}>
        {options.map(([id, optionLabel]) => <option key={id} value={id}>{optionLabel}</option>)}
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

function clientViewHref(query: ClientFilterQuery, view: keyof ClientSmartViewCounts) {
  const params = queryParams(query);
  params.set("vista", view);
  params.delete("pagina");
  if (view !== "todos") params.set("archivo", "activos");
  const suffix = params.toString();
  return suffix ? `/clientes?${suffix}` : "/clientes";
}

function exportHref(query: ClientFilterQuery) {
  const params = queryParams(query);
  params.delete("pagina");
  const suffix = params.toString();
  return suffix ? `/clientes/export?${suffix}` : "/clientes/export";
}

function queryParams(query: ClientFilterQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return params;
}

function defaultArchive(view: string | undefined) {
  return view === "archivados" ? "archivados" : "activos";
}
