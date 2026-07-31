"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, CalendarClock, CircleDollarSign, UsersRound } from "lucide-react";

export type WorkPortfolioItem = {
  id: string;
  title: string;
  client: string;
  status: string;
  statusClassName: string;
  priority: string;
  nextAction: string;
  nextDate: string;
  updatedAt: string;
  responsible: string;
  margin: string | null;
  budget: string | null;
  cost: string | null;
  pending: string | null;
  risk: boolean;
  marginRisk: boolean;
  pendingMaterials: number;
  pendingDocuments: number;
};

export function WorkPortfolio({ items }: { items: WorkPortfolioItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);

  return (
    <div className="rounded-xl border border-border bg-surface shadow-soft 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0 overflow-hidden" aria-label="Trabajos filtrados">
        <div className="border-b border-border bg-subtle px-4 py-3"><p className="type-label">Trabajos visibles</p><p className="type-secondary mt-1">Estado, responsable, fechas y señales respaldadas por datos registrados.</p></div>
        <div className="divide-y divide-border" role="list">
          {items.map((item) => {
            const active = selected?.id === item.id;
            return (
              <article key={item.id} role="listitem" className={`p-4 transition ${active ? "bg-brand-soft" : "hover:bg-subtle"}`} onMouseEnter={() => setSelectedId(item.id)} onFocusCapture={() => setSelectedId(item.id)}>
                <button type="button" aria-pressed={active} onClick={() => setSelectedId(item.id)} className="w-full text-left">
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="min-w-0"><span className="type-object-title block truncate text-content">{item.title}</span><span className="type-meta mt-1 block truncate">{item.client} · {item.nextAction}</span></span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.statusClassName}`}>{item.status}</span>
                  </span>
                  <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    <Meta label="Responsable" value={item.responsible} />
                    <Meta label="Próxima fecha" value={item.nextDate} />
                    <Meta label="Margen" value={item.margin ?? "Restringido"} danger={item.marginRisk} />
                    <Meta label="Pendientes" value={`${item.pendingMaterials} materiales · ${item.pendingDocuments} documentos`} danger={item.risk} />
                  </span>
                </button>
                {active ? <div className="mt-4 border-t border-brand/20 pt-4 2xl:hidden"><WorkDetail item={item} compact /></div> : null}
              </article>
            );
          })}
        </div>
      </section>

      {selected ? <aside className="hidden border-l border-border bg-surface p-5 2xl:block" aria-label={`Detalle de ${selected.title}`}>
        <WorkDetail item={selected} />
      </aside> : null}
    </div>
  );
}

function WorkDetail({ item: selected, compact = false }: { item: WorkPortfolioItem; compact?: boolean }) {
  return <>
        <div className="flex items-start justify-between gap-3">
          <div><p className="type-label">Trabajo seleccionado</p><h2 className="type-section-title mt-2 text-content">{selected.title}</h2><p className="type-secondary mt-1">{selected.client}</p></div>
          {selected.risk ? <AlertTriangle size={20} className="shrink-0 text-warning" aria-label="Trabajo con riesgo" /> : null}
        </div>
        <section className="mt-5 rounded-xl bg-subtle p-4">
          <p className="type-label">Etapa y siguiente acción</p>
          <p className="type-object-title mt-2 text-content">{selected.nextAction}</p>
          <p className="type-secondary mt-1">Estado: {selected.status} · Prioridad {selected.priority.toLocaleLowerCase("es-ES")}</p>
        </section>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <Fact icon={CalendarClock} label="Próxima fecha" value={selected.nextDate} />
          <Fact icon={UsersRound} label="Responsable" value={selected.responsible} />
          {selected.budget ? <Fact icon={CircleDollarSign} label="Presupuesto" value={selected.budget} /> : null}
          {selected.cost ? <Fact icon={CircleDollarSign} label="Coste autorizado" value={selected.cost} /> : null}
          {selected.pending ? <Fact icon={CircleDollarSign} label="Pendiente" value={selected.pending} /> : null}
          {selected.margin ? <Fact icon={CircleDollarSign} label="Margen" value={selected.margin} danger={selected.marginRisk} /> : null}
          <Fact icon={AlertTriangle} label="Materiales pendientes" value={String(selected.pendingMaterials)} danger={selected.pendingMaterials > 0} />
          <Fact icon={AlertTriangle} label="Documentos relacionados" value={String(selected.pendingDocuments)} />
        </dl>
        <p className="type-meta mt-4">Última actualización: {selected.updatedAt}</p>
        <Link href={`/obras/${selected.id}`} className={`${compact ? "secondary-button" : "primary-button"} mt-4 w-full`}>Abrir ficha completa<ArrowUpRight size={16} /></Link>
  </>;
}

function Fact({ icon: Icon, label, value, danger = false }: { icon: typeof CalendarClock; label: string; value: string; danger?: boolean }) {
  return <div className="min-w-0 rounded-lg border border-border p-3"><Icon size={16} className={danger ? "text-danger" : "text-brand-strong"} /><dt className="type-meta mt-2">{label}</dt><dd className={`mt-1 break-words text-sm font-semibold ${danger ? "text-danger" : "text-content"}`}>{value}</dd></div>;
}

function Meta({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <span className="min-w-0"><span className="type-meta block">{label}</span><span className={`mt-0.5 block truncate text-sm font-semibold ${danger ? "text-danger" : "text-content-secondary"}`}>{value}</span></span>;
}
