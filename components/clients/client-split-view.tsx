"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { StatusPill } from "@/components/status-pill";

export type ClientWorkspaceItem = {
  id: string;
  displayName: string;
  typeLabel: string;
  status: string;
  nextAction: string;
  risk: string;
  activeWork: string;
  pendingBalance: string | null;
  lastContact: string;
  primaryContact: string;
  phone: string | null;
  email: string | null;
  actionHref: string;
  actionLabel: string;
  visitHref: string | null;
};

export function ClientSplitView({ items }: { items: ClientWorkspaceItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0],
    [items, selectedId],
  );

  return (
    <>
      <div className="client-list-split" data-client-list-split>
        <div className="client-list-split__list" aria-label="Listado de clientes">
          {items.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              selected={client.id === selected?.id}
              onSelect={() => setSelectedId(client.id)}
            />
          ))}
        </div>
        {selected ? <ClientPreview client={selected} /> : null}
      </div>

      <div
        className="grid gap-3 min-[1180px]:hidden"
        aria-label="Clientes"
        data-client-mobile-cards
      >
        {items.map((client) => (
          <ClientMobileCard key={client.id} client={client} />
        ))}
      </div>
    </>
  );
}

function ClientRow({
  client,
  selected,
  onSelect,
}: {
  client: ClientWorkspaceItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`border-b border-border p-4 transition ${selected ? "bg-brand-soft" : "bg-surface hover:bg-subtle"}`}
      onMouseEnter={onSelect}
      onFocusCapture={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 text-left">
          <span className="type-object-title block truncate text-content">{client.displayName}</span>
          <span className="type-meta mt-1 block">{client.typeLabel}</span>
        </button>
        <StatusPill status={client.status} />
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <RowMeta label="Siguiente" value={client.nextAction} strong />
        <RowMeta label="Riesgo" value={client.risk} danger={client.risk !== "Sin riesgo detectado"} />
        <RowMeta label="Trabajo" value={client.activeWork} />
        {client.pendingBalance ? <RowMeta label="Saldo" value={client.pendingBalance} /> : null}
        <RowMeta label="Último contacto" value={client.lastContact} />
      </dl>
      <Link href={client.actionHref} className="primary-button mt-4 w-full">
        {client.actionLabel}
      </Link>
    </article>
  );
}

function ClientPreview({ client }: { client: ClientWorkspaceItem }) {
  return (
    <aside className="client-list-split__preview" aria-label={`Vista previa de ${client.displayName}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="type-label">Vista previa</p>
          <h2 className="type-section-title mt-1 text-content">{client.displayName}</h2>
          <p className="type-secondary mt-1">{client.typeLabel}</p>
        </div>
        <StatusPill status={client.status} />
      </div>

      <section className="mt-5 rounded-xl bg-subtle p-4" aria-labelledby={`next-${client.id}`}>
        <p className="type-label">Siguiente acción</p>
        <h3 id={`next-${client.id}`} className="type-object-title mt-1 text-content">{client.nextAction}</h3>
        <p className="type-secondary mt-2">Origen: ficha y señales operativas autorizadas.</p>
        <Link href={client.actionHref} className="primary-button mt-4">
          {client.actionLabel}
        </Link>
      </section>

      <dl className="mt-5 divide-y divide-border border-y border-border">
        <PreviewMeta label="Contacto" value={client.primaryContact} />
        <PreviewMeta label="Riesgo principal" value={client.risk} />
        <PreviewMeta label="Trabajo activo" value={client.activeWork} />
        {client.pendingBalance ? <PreviewMeta label="Saldo autorizado" value={client.pendingBalance} /> : null}
        <PreviewMeta label="Último contacto" value={client.lastContact} />
      </dl>

      <QuickLinks client={client} />
      <Link href={`/clientes/${client.id}`} className="secondary-button mt-4 w-full">
        Abrir ficha completa
        <ExternalLink size={17} />
      </Link>
    </aside>
  );
}

function ClientMobileCard({ client }: { client: ClientWorkspaceItem }) {
  return (
    <article className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-object-title truncate text-content">{client.displayName}</h2>
          <p className="type-meta mt-1">{client.typeLabel}</p>
        </div>
        <StatusPill status={client.status} />
      </div>
      <div className="mt-3 rounded-xl bg-subtle p-3">
        <p className="type-label">Siguiente acción</p>
        <p className="mt-1 font-semibold text-content">{client.nextAction}</p>
        <p className={`mt-2 text-sm ${client.risk === "Sin riesgo detectado" ? "text-content-secondary" : "text-danger"}`}>
          {client.risk}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <RowMeta label="Trabajo" value={client.activeWork} />
        <RowMeta label="Contacto" value={client.lastContact} />
        {client.pendingBalance ? <RowMeta label="Saldo" value={client.pendingBalance} /> : null}
      </dl>
      <Link href={client.actionHref} className="primary-button mt-4 w-full">
        {client.actionLabel}
      </Link>
      <QuickLinks client={client} compact />
    </article>
  );
}

function QuickLinks({ client, compact = false }: { client: ClientWorkspaceItem; compact?: boolean }) {
  const links = [
    client.phone ? { href: `tel:${client.phone}`, label: "Llamar", icon: Phone } : null,
    client.email ? { href: `mailto:${client.email}`, label: "Mensaje", icon: Mail } : null,
    client.visitHref ? { href: client.visitHref, label: "Visita", icon: CalendarPlus } : null,
    { href: `/clientes/${client.id}`, label: "Ficha", icon: MapPin },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof Phone }>;
  return (
    <nav className={`grid gap-2 ${compact ? "mt-3 grid-cols-4" : "mt-5 grid-cols-2"}`} aria-label={`Acciones rápidas de ${client.displayName}`}>
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={label} href={href} className="secondary-button min-w-0 px-2 text-xs">
          <Icon size={16} />
          <span className={compact ? "sr-only sm:not-sr-only" : ""}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function RowMeta({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="type-meta">{label}</dt>
      <dd className={`mt-0.5 truncate ${strong ? "font-semibold text-content" : danger ? "font-semibold text-danger" : "text-content-secondary"}`}>
        {value}
      </dd>
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
      <dt className="type-label">{label}</dt>
      <dd className="text-sm font-semibold text-content">{value}</dd>
    </div>
  );
}
