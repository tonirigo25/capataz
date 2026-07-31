"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarPlus,
  CircleDollarSign,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import type { ClientWorkspaceItem } from "@/components/clients/client-split-view";
import { StatusPill } from "@/components/status-pill";

export function ClientPortfolio({ items }: { items: ClientWorkspaceItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0],
    [items, selectedId],
  );

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-soft min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0" aria-label="Listado de clientes">
          <div className="border-b border-border bg-subtle px-4 py-3">
            <p className="type-label">Cartera visible</p>
            <p className="type-secondary mt-1">Selecciona un cliente para revisar su contexto sin perder el listado.</p>
          </div>
          <div className="divide-y divide-border" role="list">
            {items.map((client) => {
              const active = client.id === selected?.id;
              return (
                <article
                  key={client.id}
                  role="listitem"
                  className={`px-4 py-3 transition ${active ? "bg-brand-soft" : "hover:bg-subtle"}`}
                  onMouseEnter={() => setSelectedId(client.id)}
                  onFocusCapture={() => setSelectedId(client.id)}
                >
                  <button type="button" aria-pressed={active} className="flex w-full min-w-0 items-start justify-between gap-3 text-left" onClick={() => setSelectedId(client.id)}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Initials name={client.displayName} />
                      <span className="min-w-0">
                        <span className="type-object-title block truncate text-content">{client.displayName}</span>
                        <span className="type-meta mt-1 block truncate">{client.typeLabel} · {client.primaryContact}</span>
                      </span>
                    </span>
                    <StatusPill status={client.status} />
                  </button>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    <RowFact label="Próxima acción" value={client.nextAction} strong />
                    <RowFact label="Última actividad" value={client.lastContact} />
                    <RowFact label="Trabajo" value={client.activeWork} />
                    <RowFact label="Saldo" value={client.pendingBalance ?? "Restringido"} />
                    <div className="col-span-2"><RowFact label="Riesgo" value={client.risk} danger={client.risk !== "Sin riesgo detectado"} /></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>

        {selected ? <ClientPreview client={selected} /> : null}
      </div>

      <div className="grid gap-3 min-[1180px]:hidden" data-client-mobile-cards>
        {items.map((client, index) => (
          <article key={client.id} className="rounded-xl border border-border bg-surface p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Initials name={client.displayName} />
                <div className="min-w-0">
                  <h2 className="type-object-title truncate text-content">{client.displayName}</h2>
                  <p className="type-meta mt-1 truncate">{client.typeLabel}</p>
                </div>
              </div>
              <StatusPill status={client.status} />
            </div>
            <div className="mt-4 rounded-xl bg-subtle p-3">
              <p className="type-label">Próxima acción</p>
              <p className="mt-1 font-semibold text-content">{client.nextAction}</p>
              <p className="type-meta mt-1">Último contacto: {client.lastContact}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <Fact icon={BriefcaseBusiness} label="Trabajo" value={client.activeWork} />
              <Fact icon={CircleDollarSign} label="Saldo" value={client.pendingBalance ?? "Restringido"} />
            </dl>
            <Link href={client.actionHref} className={`${index === 0 ? "primary-button" : "secondary-button"} mt-4 w-full`}>
              {client.actionLabel}<ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}

function ClientPreview({ client }: { client: ClientWorkspaceItem }) {
  const actions = [
    client.phone ? { href: `tel:${client.phone}`, label: "Llamar", icon: Phone } : null,
    client.email ? { href: `mailto:${client.email}`, label: "Mensaje", icon: Mail } : null,
    client.visitHref ? { href: client.visitHref, label: "Visita", icon: CalendarPlus } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof Phone }>;

  return (
    <aside className="border-l border-border bg-surface p-5" aria-label={`Vista de ${client.displayName}`}>
      <p className="type-label">Vista de cliente</p>
      <div className="mt-4 flex items-start gap-3">
        <Initials name={client.displayName} large />
        <div className="min-w-0">
          <h2 className="type-section-title truncate text-content">{client.displayName}</h2>
          <p className="type-secondary mt-1">{client.typeLabel}</p>
          <div className="mt-2"><StatusPill status={client.status} /></div>
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-border bg-subtle p-4">
        <p className="type-label">Próxima acción</p>
        <h3 className="type-object-title mt-2 text-content">{client.nextAction}</h3>
        <p className="type-secondary mt-2">Contexto derivado de la ficha y de las señales autorizadas.</p>
        <Link href={client.actionHref} className="primary-button mt-4 w-full">{client.actionLabel}</Link>
      </section>

      <dl className="mt-4 divide-y divide-border border-y border-border">
        <PreviewFact label="Contacto principal" value={client.primaryContact} />
        <PreviewFact label="Trabajo activo" value={client.activeWork} />
        {client.pendingBalance ? <PreviewFact label="Saldo autorizado" value={client.pendingBalance} /> : null}
        <PreviewFact label="Riesgo" value={client.risk} danger={client.risk !== "Sin riesgo detectado"} />
        <PreviewFact label="Última actividad" value={client.lastContact} />
      </dl>

      {actions.length ? <nav className="mt-4 grid grid-cols-3 gap-2" aria-label={`Acciones rápidas de ${client.displayName}`}>
        {actions.map(({ href, label, icon: Icon }) => <Link key={label} href={href} className="secondary-button min-w-0 px-2 text-xs"><Icon size={15} /><span className="sr-only 2xl:not-sr-only">{label}</span></Link>)}
      </nav> : null}
      <Link href={`/clientes/${client.id}`} className="secondary-button mt-3 w-full">Abrir Cliente 360<ArrowUpRight size={16} /></Link>
    </aside>
  );
}

function Initials({ name, large = false }: { name: string; large?: boolean }) {
  const value = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es-ES");
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white ${large ? "h-12 w-12" : "h-9 w-9"}`}>{value || <UserRound size={17} />}</span>;
}

function Fact({ icon: Icon, label, value }: { icon: typeof BriefcaseBusiness; label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-border p-3"><Icon size={16} className="text-brand-strong" /><dt className="type-meta mt-2">{label}</dt><dd className="mt-1 truncate text-sm font-semibold text-content">{value}</dd></div>;
}

function PreviewFact({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="py-3"><dt className="type-label">{label}</dt><dd className={`mt-1 text-sm font-semibold ${danger ? "text-danger" : "text-content"}`}>{value}</dd></div>;
}

function RowFact({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div className="min-w-0"><dt className="type-meta">{label}</dt><dd className={`mt-0.5 truncate text-sm ${danger ? "font-semibold text-danger" : strong ? "font-semibold text-content" : "text-content-secondary"}`}>{value}</dd></div>;
}
