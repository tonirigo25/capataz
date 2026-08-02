"use client";

import { Filter, List, Search } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

export type TaskFilterOption = readonly [value: string, label: string];

type TaskFiltersProps = {
  values: {
    estado: string;
    tipo: string;
    prioridad: string;
    relacion: string;
    responsable: string;
    buscar: string;
    periodo: string;
  };
  typeOptions: TaskFilterOption[];
  responsibleOptions: TaskFilterOption[];
};

const stateOptions: TaskFilterOption[] = [
  ["pending", "Pendientes"],
  ["inbox", "Entrada"],
  ["planned", "Planificadas"],
  ["in_progress", "En curso"],
  ["blocked", "Bloqueadas"],
  ["completed", "Completadas"],
  ["all", "Todos"],
];

const priorityOptions: TaskFilterOption[] = [
  ["all", "Todas"],
  ["urgent", "Urgente"],
  ["high", "Alta"],
  ["medium", "Media"],
  ["low", "Baja"],
];

const relationOptions: TaskFilterOption[] = [
  ["all", "Todas"],
  ["work", "Trabajo"],
  ["client", "Cliente"],
  ["budget", "Presupuesto"],
  ["invoice", "Factura"],
  ["document", "Documento"],
  ["none", "Sin relación"],
];

export function TaskFilters({ values, typeOptions, responsibleOptions }: TaskFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action="/tareas"
      className="tasks-filterbar"
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) formRef.current?.requestSubmit();
      }}
    >
      {values.periodo !== "all" ? <input type="hidden" name="periodo" value={values.periodo} /> : null}
      <TaskSelect label="Estado" name="estado" value={values.estado} options={stateOptions} />
      <TaskSelect label="Tipo" name="tipo" value={values.tipo} options={typeOptions} />
      <TaskSelect label="Prioridad" name="prioridad" value={values.prioridad} options={priorityOptions} />
      <TaskSelect label="Relación" name="relacion" value={values.relacion} options={relationOptions} />
      <TaskSelect label="Responsable" name="responsable" value={values.responsable} options={responsibleOptions} />

      <details className="tasks-more-filters">
        <summary><Filter size={15} aria-hidden="true" />Más filtros</summary>
        <div className="tasks-more-filters__panel">
          <label>
            <span>Buscar</span>
            <span className="tasks-search-field">
              <Search size={15} aria-hidden="true" />
              <input name="buscar" defaultValue={values.buscar} placeholder="Tarea, relación o responsable…" />
            </span>
          </label>
          <div className="tasks-more-filters__actions">
            <button type="submit" className="primary-button">Aplicar filtros</button>
            <Link href="/tareas" className="secondary-button">Limpiar</Link>
          </div>
        </div>
      </details>

      <nav className="tasks-view-switch" aria-label="Vista de tareas">
        <span aria-current="page"><List size={15} aria-hidden="true" />Lista</span>
        <Link href="/agenda?tipo=tareas">Calendario</Link>
      </nav>
      <noscript><button type="submit" className="secondary-button">Aplicar</button></noscript>
    </form>
  );
}

function TaskSelect({ label, name, value, options }: { label: string; name: string; value: string; options: TaskFilterOption[] }) {
  return (
    <label className="tasks-filter-select">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {options.map(([id, optionLabel]) => <option key={id} value={id}>{optionLabel}</option>)}
      </select>
    </label>
  );
}
