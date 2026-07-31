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
};

export function WorkPortfolio({ items }: { items: WorkPortfolioItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0" aria-label="Trabajos filtrados">
        <div className="hidden grid-cols-[minmax(12rem,1.35fr)_7rem_8rem_9rem_7rem] gap-3 border-b border-border bg-subtle px-4 py-3 type-label xl:grid">
          <span>Trabajo</span><span>Estado</span><span>Responsable</span><span>Próxima fecha</span><span>Margen</span>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => {
            const active = selected?.id === item.id;
            return (
              <article key={item.id} className={`p-4 transition ${active ? "bg-brand-soft" : "hover:bg-subtle"}`} onMouseEnter={() => setSelectedId(item.id)} onFocusCapture={() => setSelectedId(item.id)}>
                <button type="button" onClick={() => setSelectedId(item.id)} className="grid w-full gap-3 text-left xl:grid-cols-[minmax(12rem,1.35fr)_7rem_8rem_9rem_7rem] xl:items-center">
                  <span className="min-w-0"><span className="type-object-title block truncate text-content">{item.title}</span><span className="type-meta mt-1 block truncate">{item.client} · {item.nextAction}</span></span>
                  <span><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.statusClassName}`}>{item.status}</span></span>
                  <span className="text-sm font-semibold text-content-secondary">{item.responsible}</span>
                  <span className="text-sm text-content-secondary">{item.nextDate}</span>
                  <span className={`text-sm font-semibold tabular-nums ${item.risk ? "text-danger" : "text-success"}`}>{item.margin ?? "Restringido"}</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {selected ? <aside className="border-t border-border bg-surface p-5 lg:border-l lg:border-t-0" aria-label={`Detalle de ${selected.title}`}>
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
          {selected.margin ? <Fact icon={CircleDollarSign} label="Margen" value={selected.margin} danger={selected.risk} /> : null}
        </dl>
        <p className="type-meta mt-4">Actualizado {selected.updatedAt}</p>
        <Link href={`/obras/${selected.id}`} className="primary-button mt-4 w-full">Abrir ficha completa<ArrowUpRight size={16} /></Link>
      </aside> : null}
    </div>
  );
}

function Fact({ icon: Icon, label, value, danger = false }: { icon: typeof CalendarClock; label: string; value: string; danger?: boolean }) {
  return <div className="min-w-0 rounded-lg border border-border p-3"><Icon size={16} className={danger ? "text-danger" : "text-brand-strong"} /><dt className="type-meta mt-2">{label}</dt><dd className={`mt-1 break-words text-sm font-semibold ${danger ? "text-danger" : "text-content"}`}>{value}</dd></div>;
}
