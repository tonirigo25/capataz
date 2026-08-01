"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Ellipsis,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { ClientWorkspaceItem } from "@/components/clients/client-split-view";
import { StatusPill } from "@/components/status-pill";

export type ClientPortfolioPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  previousHref: string | null;
  nextHref: string | null;
  pages: Array<{ page: number; href: string; current: boolean }>;
};

export function ClientPortfolio({
  items,
  pagination,
  canUpdate,
  canUseAi,
}: {
  items: ClientWorkspaceItem[];
  pagination: ClientPortfolioPagination;
  canUpdate: boolean;
  canUseAi: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const selected = useMemo(
    () => selectedId ? items.find((item) => item.id === selectedId) ?? null : null,
    [items, selectedId],
  );

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [items, selectedId]);

  return (
    <>
      <div className="clients-workspace" data-preview-collapsed={previewCollapsed ? "true" : "false"}>
        <section className="clients-table-shell" aria-label="Cartera de clientes">
          <div className="clients-table-scroll">
            <table className="clients-table">
              <caption className="sr-only">Clientes visibles para el perfil actual</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Seleccionar</span></th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Próxima acción</th>
                  <th scope="col">Trabajo activo</th>
                  <th scope="col">Presupuesto</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Última actividad</th>
                  <th scope="col">Riesgo</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((client) => (
                  <ClientTableRow
                    key={client.id}
                    client={client}
                    selected={client.id === selected?.id}
                    canUpdate={canUpdate}
                    onSelect={() => setSelectedId(client.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter pagination={pagination} />
        </section>

        {selected ? (
          <ClientPreview
            client={selected}
            collapsed={previewCollapsed}
            canUseAi={canUseAi}
            onToggle={() => setPreviewCollapsed((current) => !current)}
          />
        ) : <ClientPreviewEmpty />}
      </div>

      <div className="clients-mobile-list" aria-label="Clientes" data-client-mobile-cards>
        {items.map((client) => (
          <ClientMobileCard key={client.id} client={client} canUseAi={canUseAi} />
        ))}
        <PaginationFooter pagination={pagination} mobile />
      </div>
    </>
  );
}

function ClientTableRow({
  client,
  selected,
  canUpdate,
  onSelect,
}: {
  client: ClientWorkspaceItem;
  selected: boolean;
  canUpdate: boolean;
  onSelect: () => void;
}) {
  return (
    <tr data-selected={selected ? "true" : "false"}>
      <td>
        <label className="clients-row-check">
          <span className="sr-only">Mostrar vista de {client.displayName}</span>
          <input type="radio" name="client-preview" checked={selected} onChange={onSelect} />
        </label>
      </td>
      <th scope="row">
        <button type="button" className="clients-client-cell" aria-pressed={selected} onClick={onSelect}>
          <Initials name={client.displayName} />
          <span><strong>{client.displayName}</strong><small>{client.typeLabel}</small></span>
        </button>
      </th>
      <td><span className="clients-status" data-status={client.status}><StatusPill status={client.status} /></span></td>
      <td><span className="clients-responsible">{client.responsible}</span></td>
      <td><span className="clients-cell-stack"><strong>{client.nextAction}</strong><small>{client.nextActionAt ?? client.nextActionSource ?? "Sin fecha registrada"}</small></span></td>
      <td>{client.activeWorkCount ? <Link href={`/clientes/${client.id}?vista=trabajos`} className="clients-number-link">{client.activeWorkCount}</Link> : <span>0</span>}</td>
      <td>{client.budget && client.budgetTotal ? <Link href={`/presupuestos/${client.budget.id}`} className="clients-money-link">{client.budgetTotal}</Link> : <span aria-label="Sin presupuesto abierto">—</span>}</td>
      <td>{client.pendingBalance ? <Link href={`/clientes/${client.id}?vista=dinero`} className={client.riskLevel === "Alto" ? "clients-money-link clients-money-link--danger" : "clients-money-link"}>{client.pendingBalance}</Link> : <span aria-label="Sin saldo pendiente">—</span>}</td>
      <td><span className="clients-cell-stack"><strong>{client.lastContact}</strong><small>{client.lastActivityKind}</small></span></td>
      <td><RiskPill level={client.riskLevel} /></td>
      <td><ClientRowActions client={client} canUpdate={canUpdate} /></td>
    </tr>
  );
}

function ClientRowActions({ client, canUpdate }: { client: ClientWorkspaceItem; canUpdate: boolean }) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const menuItems = [
    { href: `/clientes/${client.id}`, label: "Abrir Cliente 360" },
    ...(canUpdate ? [{ href: `/gestion?tipo=cliente&id=${client.id}&returnTo=/clientes`, label: "Editar cliente" }] : []),
    ...(client.email ? [{ href: `mailto:${client.email}`, label: "Enviar mensaje" }] : []),
    ...(client.phone ? [{ href: `tel:${client.phone}`, label: "Llamar" }] : []),
  ];

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPosition(resolveClientMenuPosition(
      trigger.getBoundingClientRect(),
      menuRef.current?.offsetWidth ?? 196,
      menuRef.current?.offsetHeight ?? menuItems.length * 44 + 12,
    ));
  }, [menuItems.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [closeMenu, open, updatePosition]);

  function openMenu(trigger: HTMLButtonElement) {
    setPosition(resolveClientMenuPosition(trigger.getBoundingClientRect(), 196, menuItems.length * 44 + 12));
    setOpen(true);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    const target = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[target]?.focus();
  }

  return (
    <div className="clients-row-actions">
      <button
        ref={triggerRef}
        type="button"
        className="clients-row-actions__trigger"
        aria-label={`Acciones de ${client.displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => open ? closeMenu() : openMenu(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu(event.currentTarget);
          }
        }}
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <nav
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Menú de ${client.displayName}`}
          className="clients-row-actions__menu"
          data-placement={position.placement}
          data-client-row-menu
          style={{ top: position.top, left: position.left }}
          onKeyDown={handleMenuKeyDown}
        >
          {menuItems.map((item) => (
            <Link key={`${item.label}-${item.href}`} href={item.href} role="menuitem" onClick={() => closeMenu()}>
              {item.label}
            </Link>
          ))}
        </nav>,
        document.body,
      ) : null}
    </div>
  );
}

function resolveClientMenuPosition(
  trigger: Pick<DOMRect, "top" | "right" | "bottom">,
  menuWidth: number,
  menuHeight: number,
) {
  const gutter = 8;
  const placement = window.innerHeight - trigger.bottom >= menuHeight + gutter ? "bottom" : "top";
  const top = placement === "bottom"
    ? trigger.bottom + 6
    : Math.max(gutter, trigger.top - menuHeight - 6);
  const left = Math.min(
    Math.max(gutter, trigger.right - menuWidth),
    Math.max(gutter, window.innerWidth - menuWidth - gutter),
  );
  return { top, left, placement } as const;
}

function ClientPreview({
  client,
  collapsed,
  canUseAi,
  onToggle,
}: {
  client: ClientWorkspaceItem;
  collapsed: boolean;
  canUseAi: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="clients-preview clients-preview--collapsed" aria-label="Vista de cliente contraída">
        <button type="button" aria-label="Mostrar vista de cliente" onClick={onToggle}><ChevronsLeft size={18} aria-hidden="true" /><span>Vista de cliente</span></button>
      </aside>
    );
  }

  return (
    <aside className="clients-preview" aria-label={`Vista de cliente: ${client.displayName}`}>
      <header className="clients-preview__header">
        <span><Sparkles size={16} aria-hidden="true" />Vista de cliente</span>
        <button type="button" aria-label="Ocultar vista de cliente" onClick={onToggle}><ChevronsRight size={18} aria-hidden="true" /></button>
      </header>

      <section className="clients-preview-card clients-preview-identity">
        <div className="clients-preview-identity__title">
          <Initials name={client.displayName} large />
          <div><h2>{client.displayName}</h2><p>{client.typeLabel}</p><StatusPill status={client.status} /></div>
        </div>
        <div className="clients-preview-contact">
          <h3>Contacto principal</h3>
          <ContactLine icon={UserRound} value={client.primaryContact} detail={client.primaryContactDetail} />
          {client.email ? <ContactLine icon={Mail} value={client.email} href={`mailto:${client.email}`} /> : null}
          {client.phone ? <ContactLine icon={Phone} value={client.phone} href={`tel:${client.phone}`} /> : null}
          {client.addressLabel ? <ContactLine icon={MapPin} value={client.addressLabel} /> : null}
        </div>
      </section>

      <PreviewSection icon={CalendarDays} title="Próxima acción" side={client.nextActionAt ?? undefined}>
        <strong>{client.nextAction}</strong>
        <p>{client.nextActionSource ?? "Acción derivada del contexto autorizado del cliente."}</p>
        {client.visitHref ? <Link href={client.visitHref} className="clients-preview-action">Ver en agenda</Link> : null}
      </PreviewSection>

      {client.budget ? (
        <PreviewSection icon={WalletCards} title="Presupuesto activo" side={client.budgetTotal ?? undefined}>
          <strong>{client.budget.number} · {client.budget.title}</strong>
          <p>Estado: {client.budget.status.replaceAll("_", " ")}</p>
          <Link href={`/presupuestos/${client.budget.id}`} className="clients-preview-action">Ver presupuesto</Link>
        </PreviewSection>
      ) : null}

      <PreviewSection icon={BriefcaseBusiness} title="Trabajo activo" side={client.activeWorkCount ? String(client.activeWorkCount) : undefined}>
        {client.activeWorks.length ? <ul className="clients-preview-work-list">{client.activeWorks.map((work) => <li key={work.id}><Link href={`/obras/${work.id}`}>{work.title}</Link><StatusPill status={work.status} /></li>)}</ul> : <p>No hay trabajos activos registrados.</p>}
        <Link href={`/clientes/${client.id}?vista=trabajos`} className="clients-preview-action">Ver trabajos</Link>
      </PreviewSection>

      {client.pendingBalance ? (
        <PreviewSection icon={CircleDollarSign} title="Saldo pendiente" side={client.pendingBalance} danger={client.riskLevel === "Alto"}>
          <dl className="clients-preview-balance"><div><dt>Vencido</dt><dd>{client.overdueBalance ?? "0 €"}</dd></div><div><dt>Por vencer</dt><dd>{client.upcomingBalance ?? "0 €"}</dd></div></dl>
          <Link href={`/clientes/${client.id}?vista=dinero`} className="clients-preview-action">Ver detalle de saldo</Link>
        </PreviewSection>
      ) : null}

      {client.latestNote ? (
        <PreviewSection icon={BriefcaseBusiness} title="Últimas notas">
          <small>{client.latestNote.date}</small><p>{client.latestNote.content}</p>
          <Link href={`/clientes/${client.id}?vista=notas`} className="clients-preview-action">Ver todas las notas</Link>
        </PreviewSection>
      ) : null}

      <section className="clients-preview-card clients-preview-ai" aria-label="Ayuda contextual de Orqena IA">
        <h3><Sparkles size={16} aria-hidden="true" />Orqena IA</h3>
        <strong>{client.nextAction}</strong>
        <p>{client.riskLevel === "Bajo" ? "No hay un riesgo alto registrado. Revisa el siguiente paso antes de confirmar cambios." : `Riesgo ${client.riskLevel.toLocaleLowerCase("es-ES")}: ${client.risk}. La recomendación no ejecuta cambios por sí sola.`}</p>
        {canUseAi ? <Link href={`/orqena-ia/comercial?clientId=${client.id}`} className="clients-preview-action">Abrir recomendación contextual</Link> : <span className="clients-preview-unavailable">No disponible en este plan o permiso</span>}
      </section>
    </aside>
  );
}

function ClientPreviewEmpty() {
  return (
    <aside className="clients-preview" aria-label="Vista de cliente sin selección">
      <header className="clients-preview__header">
        <span><Sparkles size={16} aria-hidden="true" />Vista de cliente</span>
      </header>
      <section className="clients-preview-card grid min-h-52 place-items-center text-center">
        <div className="max-w-56">
          <UserRound className="mx-auto text-content-tertiary" size={32} aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-content">Selecciona un cliente</h2>
          <p className="type-secondary mt-2">El resumen aparecerá aquí cuando elijas una fila del listado.</p>
        </div>
      </section>
    </aside>
  );
}

function ClientMobileCard({ client, canUseAi }: { client: ClientWorkspaceItem; canUseAi: boolean }) {
  return (
    <article className="clients-mobile-card">
      <div className="clients-mobile-card__head"><span className="clients-mobile-card__identity"><Initials name={client.displayName} /><span><strong>{client.displayName}</strong><small>{client.typeLabel}</small></span></span><StatusPill status={client.status} /></div>
      <section><span>Próxima acción</span><strong>{client.nextAction}</strong><small>{client.nextActionAt ?? "Sin fecha registrada"}</small></section>
      <dl><div><dt>Trabajo</dt><dd>{client.activeWork}</dd></div><div><dt>Saldo</dt><dd>{client.pendingBalance ?? "Sin saldo pendiente"}</dd></div><div><dt>Riesgo</dt><dd><RiskPill level={client.riskLevel} /></dd></div><div><dt>Actividad</dt><dd>{client.lastContact}</dd></div></dl>
      <Link href={`/clientes/${client.id}`} className="secondary-button">Abrir Cliente 360<ArrowUpRight size={16} aria-hidden="true" /></Link>
      {canUseAi ? <Link href={`/orqena-ia/comercial?clientId=${client.id}`} className="clients-mobile-ai"><Sparkles size={15} aria-hidden="true" />Recomendación contextual</Link> : null}
    </article>
  );
}

function PreviewSection({ icon: Icon, title, side, danger = false, children }: { icon: typeof CalendarDays; title: string; side?: string; danger?: boolean; children: React.ReactNode }) {
  return <section className="clients-preview-card clients-preview-section"><header><h3><Icon size={15} aria-hidden="true" />{title}</h3>{side ? <strong data-danger={danger ? "true" : "false"}>{side}</strong> : null}</header><div>{children}</div></section>;
}

function ContactLine({ icon: Icon, value, detail, href }: { icon: typeof UserRound; value: string; detail?: string; href?: string }) {
  const content = <><Icon size={14} aria-hidden="true" /><span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</span></>;
  return href ? <Link href={href}>{content}</Link> : <div>{content}</div>;
}

function Initials({ name, large = false }: { name: string; large?: boolean }) {
  const value = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es-ES");
  return <span aria-hidden="true" className="clients-initials" data-size={large ? "large" : "normal"}>{value || <UserRound size={17} />}</span>;
}

function RiskPill({ level }: { level: ClientWorkspaceItem["riskLevel"] }) {
  return <span className="clients-risk-pill" data-level={level.toLocaleLowerCase("es-ES")}>{level}</span>;
}

function PaginationFooter({ pagination, mobile = false }: { pagination: ClientPortfolioPagination; mobile?: boolean }) {
  const first = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);
  return (
    <footer className={mobile ? "clients-pagination clients-pagination--mobile" : "clients-pagination"}>
      <p>Mostrando {first} a {last} de {pagination.total} clientes</p>
      <nav aria-label="Paginación de clientes">
        {pagination.previousHref ? <Link href={pagination.previousHref} aria-label="Página anterior"><ChevronLeft size={16} aria-hidden="true" /></Link> : <span aria-disabled="true"><ChevronLeft size={16} aria-hidden="true" /></span>}
        {pagination.pages.map((item) => <Link key={item.page} href={item.href} aria-current={item.current ? "page" : undefined}>{item.page}</Link>)}
        {pagination.nextHref ? <Link href={pagination.nextHref} aria-label="Página siguiente"><ChevronRight size={16} aria-hidden="true" /></Link> : <span aria-disabled="true"><ChevronRight size={16} aria-hidden="true" /></span>}
      </nav>
      <span>{pagination.pageSize} por página</span>
    </footer>
  );
}
