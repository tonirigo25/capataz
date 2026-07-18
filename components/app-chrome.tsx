"use client";

import type { ReactNode } from "react";
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  Ellipsis,
  FileText,
  Handshake,
  Home,
  Landmark,
  LogOut,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import {
  createActions,
  isProductDestinationActive,
  primaryNavigation,
  resolveRouteContext,
  secondaryNavigation,
  type ProductDestination,
  type ProductIcon
} from "@/lib/product-navigation";

type DesktopPanel = "more" | "create" | "user" | null;
type Overlay = "search" | "create" | "more" | null;

const icons: Record<ProductIcon, LucideIcon> = {
  activity: Activity,
  agenda: CalendarDays,
  bot: Bot,
  briefcase: BriefcaseBusiness,
  building: Building2,
  client: Users,
  dashboard: BarChart3,
  document: FileText,
  expense: Package,
  home: Home,
  invoice: WalletCards,
  landmark: Landmark,
  notification: Bell,
  receipt: ReceiptText,
  settings: Settings
};

export function AppChrome({
  children,
  modeLabel,
  unreadNotifications,
  companyName,
  userName,
  logoutAction
}: {
  children: ReactNode;
  modeLabel?: string;
  unreadNotifications: number;
  companyName: string;
  userName: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const dialogId = useId();
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const context = useMemo(() => resolveRouteContext(pathname), [pathname]);

  useEffect(() => {
    setDesktopPanel(null);
    setOverlay(null);
  }, [pathname]);

  useEffect(() => {
    if (!desktopPanel) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !activeTriggerRef.current?.contains(target)) {
        closeDesktopPanel();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDesktopPanel();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [desktopPanel]);

  useEffect(() => {
    if (!overlay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOverlay(null);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusable(dialogRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      activeTriggerRef.current?.focus();
    };
  }, [overlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        activeTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
        setDesktopPanel(null);
        setOverlay("search");
      } else if (
        event.key === "/"
        && !event.ctrlKey
        && !event.metaKey
        && !isTextEntry(target)
      ) {
        event.preventDefault();
        activeTriggerRef.current = null;
        setDesktopPanel(null);
        setOverlay("search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openDesktopPanel(panel: Exclude<DesktopPanel, null>, trigger: HTMLButtonElement) {
    activeTriggerRef.current = trigger;
    setOverlay(null);
    setDesktopPanel((current) => current === panel ? null : panel);
  }

  function closeDesktopPanel() {
    setDesktopPanel(null);
    requestAnimationFrame(() => activeTriggerRef.current?.focus());
  }

  function openOverlay(next: Exclude<Overlay, null>, trigger: HTMLButtonElement) {
    activeTriggerRef.current = trigger;
    setDesktopPanel(null);
    setOverlay(next);
  }

  return (
    <div className="min-h-dvh lg:pl-60">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[80] inline-flex min-h-11 -translate-y-20 items-center rounded-lg bg-brand px-4 py-2 font-semibold text-white transition focus:translate-y-0"
      >
        Saltar al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-surface lg:block">
        <DesktopNavigation
          pathname={pathname}
          companyName={companyName}
          userName={userName}
          modeLabel={modeLabel}
          desktopPanel={desktopPanel}
          onOpenPanel={openDesktopPanel}
        />
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/95">
        <div className="mx-auto flex h-16 max-w-product items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            href="/hoy"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white lg:hidden"
            aria-label="Ir a Hoy"
          >
            C
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-content lg:max-w-44" aria-label={`Área actual: ${context.label}`}>
            {context.label}
          </p>

          <button
            type="button"
            className="hidden h-10 min-w-0 max-w-md flex-1 items-center gap-3 rounded-lg border border-border bg-subtle px-3 text-left text-sm text-content-secondary transition hover:border-border-strong hover:bg-surface lg:flex"
            aria-label="Buscar en Capataz"
            onClick={(event) => openOverlay("search", event.currentTarget)}
          >
            <Search size={18} aria-hidden="true" />
            <span className="flex-1">Buscar en Capataz</span>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-content-tertiary">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="icon-button lg:hidden"
              aria-label="Buscar en Capataz"
              onClick={(event) => openOverlay("search", event.currentTarget)}
            >
              <Search size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary-button hidden lg:inline-flex"
              aria-expanded={desktopPanel === "create"}
              onClick={(event) => openDesktopPanel("create", event.currentTarget)}
            >
              <Plus size={18} aria-hidden="true" />Crear
            </button>
            <Link href="/capataz" className="ghost-button hidden sm:inline-flex">
              <Bot size={18} aria-hidden="true" />Capataz
            </Link>
            <NotificationLink unread={unreadNotifications} />
          </div>
        </div>
      </header>

      <main id="main-content" className="relative">{children}</main>

      <MobileBottomNavigation
        pathname={pathname}
        overlay={overlay}
        onOpen={openOverlay}
      />

      {desktopPanel === "more" ? (
        <DesktopMorePanel
          ref={panelRef}
          pathname={pathname}
          unread={unreadNotifications}
          onClose={closeDesktopPanel}
        />
      ) : null}
      {desktopPanel === "create" ? (
        <DesktopCreatePanel ref={panelRef} onClose={closeDesktopPanel} />
      ) : null}
      {desktopPanel === "user" ? (
        <DesktopUserPanel
          ref={panelRef}
          companyName={companyName}
          userName={userName}
          modeLabel={modeLabel}
          logoutAction={logoutAction}
          onClose={closeDesktopPanel}
        />
      ) : null}

      {overlay ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-content/40 p-0 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOverlay(null);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            className={clsx(
              "w-full overflow-y-auto bg-surface shadow-card",
              overlay === "search"
                ? "max-h-[100dvh] self-start rounded-none sm:mt-[10vh] sm:max-h-[75dvh] sm:max-w-2xl sm:rounded-2xl"
                : "max-h-[85dvh] rounded-t-2xl sm:max-w-2xl sm:rounded-2xl"
            )}
          >
            {overlay === "search" ? (
              <SearchDialog id={dialogId} onClose={() => setOverlay(null)} />
            ) : overlay === "create" ? (
              <MobileCreateSheet id={dialogId} onClose={() => setOverlay(null)} />
            ) : (
              <MobileMoreSheet
                id={dialogId}
                pathname={pathname}
                unread={unreadNotifications}
                companyName={companyName}
                userName={userName}
                modeLabel={modeLabel}
                logoutAction={logoutAction}
                onClose={() => setOverlay(null)}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopNavigation({
  pathname,
  companyName,
  userName,
  modeLabel,
  desktopPanel,
  onOpenPanel
}: {
  pathname: string;
  companyName: string;
  userName: string;
  modeLabel?: string;
  desktopPanel: DesktopPanel;
  onOpenPanel: (panel: Exclude<DesktopPanel, null>, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <Link href="/hoy" className="flex min-h-12 items-center gap-3 rounded-lg px-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white">C</span>
          <span className="min-w-0">
            <span className="block text-base font-bold leading-5 text-content">Capataz</span>
            <span className="block truncate text-xs text-content-secondary">{companyName}</span>
          </span>
        </Link>
        {modeLabel ? <p className="mt-1 truncate px-2 text-[11px] font-medium text-content-tertiary">{modeLabel}</p> : null}
      </div>

      <nav className="flex-1 px-3" aria-label="Navegación principal">
        <div className="grid gap-1">
          {primaryNavigation.map((item) => (
            <NavigationLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
        <button
          type="button"
          className={clsx(
            "mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
            desktopPanel === "more" ? "bg-brand-soft text-content" : "text-content-secondary hover:bg-subtle hover:text-content"
          )}
          aria-expanded={desktopPanel === "more"}
          aria-controls="desktop-more-navigation"
          onClick={(event) => onOpenPanel("more", event.currentTarget)}
        >
          <Ellipsis size={19} aria-hidden="true" />
          <span className="flex-1 text-left">Más</span>
          <ChevronDown size={16} className="-rotate-90" aria-hidden="true" />
        </button>
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          className={clsx(
            "flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-subtle",
            desktopPanel === "user" && "bg-subtle"
          )}
          aria-expanded={desktopPanel === "user"}
          onClick={(event) => onOpenPanel("user", event.currentTarget)}
        >
          <UserAvatar name={userName} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-content">{userName}</span>
            <span className="block truncate text-xs text-content-secondary">{companyName}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

const DesktopMorePanel = forwardRef<HTMLDivElement, {
  pathname: string;
  unread: number;
  onClose: () => void;
}>(function DesktopMorePanel({
  pathname,
  unread,
  onClose
}, ref) {
  return (
    <div
      ref={ref}
      id="desktop-more-navigation"
      className="fixed bottom-5 left-[15.75rem] top-20 z-50 w-[25rem] overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="type-section-title text-content">Más áreas</p>
          <p className="type-secondary mt-1">Operación y control, cuando los necesites.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Cerrar Más" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-5">
        {secondaryNavigation.map((group) => (
          <NavigationGroup key={group.label} group={group} pathname={pathname} unread={unread} onNavigate={onClose} />
        ))}
      </div>
    </div>
  );
});

const DesktopCreatePanel = forwardRef<HTMLDivElement, {
  onClose: () => void;
}>(function DesktopCreatePanel({
  onClose
}, ref) {
  return (
    <div ref={ref} className="fixed right-6 top-[4.5rem] z-50 w-80 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="font-semibold text-content">Crear</p>
        <button type="button" className="icon-button h-9 w-9" aria-label="Cerrar Crear" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <CreateRows onNavigate={onClose} />
    </div>
  );
});

const DesktopUserPanel = forwardRef<HTMLDivElement, {
  companyName: string;
  userName: string;
  modeLabel?: string;
  logoutAction: () => Promise<void>;
  onClose: () => void;
}>(function DesktopUserPanel({
  companyName,
  userName,
  modeLabel,
  logoutAction,
  onClose
}, ref) {
  return (
    <div ref={ref} className="fixed bottom-3 left-[15.75rem] z-50 w-72 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <div className="border-b border-border px-2 pb-3">
        <p className="truncate text-sm font-semibold text-content">{userName}</p>
        <p className="truncate text-xs text-content-secondary">{companyName}</p>
        {modeLabel ? <p className="mt-1 text-[11px] text-content-tertiary">{modeLabel}</p> : null}
      </div>
      <div className="grid gap-1 pt-2">
        <Link href="/configuracion#perfil" className="shell-menu-row" onClick={onClose}>
          <UserRound size={18} aria-hidden="true" />Perfil
        </Link>
        <Link href="/configuracion" className="shell-menu-row" onClick={onClose}>
          <Settings size={18} aria-hidden="true" />Configuración
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="shell-menu-row">
            <LogOut size={18} aria-hidden="true" />Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
});

function MobileBottomNavigation({
  pathname,
  overlay,
  onOpen
}: {
  pathname: string;
  overlay: Overlay;
  onOpen: (overlay: Exclude<Overlay, null>, trigger: HTMLButtonElement) => void;
}) {
  const mobileItems = [
    primaryNavigation.find((item) => item.href === "/hoy")!,
    primaryNavigation.find((item) => item.href === "/clientes")!,
    primaryNavigation.find((item) => item.href === "/obras")!
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navegación móvil"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
        <BottomLink item={mobileItems[0]} pathname={pathname} />
        <BottomLink item={mobileItems[1]} pathname={pathname} />
        <button
          type="button"
          className={clsx("shell-bottom-item", overlay === "create" ? "bg-brand-soft text-brand-strong" : "text-content-secondary")}
          aria-label="Crear"
          aria-expanded={overlay === "create"}
          onClick={(event) => onOpen("create", event.currentTarget)}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
            <Plus size={19} aria-hidden="true" />
          </span>
          <span>Crear</span>
        </button>
        <BottomLink item={mobileItems[2]} pathname={pathname} />
        <button
          type="button"
          className={clsx("shell-bottom-item", overlay === "more" ? "bg-brand-soft text-brand-strong" : "text-content-secondary")}
          aria-label="Más áreas"
          aria-expanded={overlay === "more"}
          onClick={(event) => onOpen("more", event.currentTarget)}
        >
          <Ellipsis size={22} aria-hidden="true" />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}

function BottomLink({ item, pathname }: { item: ProductDestination; pathname: string }) {
  const active = isProductDestinationActive(pathname, item.href);
  const Icon = icons[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx("shell-bottom-item", active ? "bg-brand-soft text-brand-strong" : "text-content-secondary")}
    >
      <Icon size={22} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function SearchDialog({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="type-section-title text-content">Buscar en Capataz</h2>
          <p className="type-secondary mt-1">Clientes, obras, presupuestos, facturas y documentos.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Cerrar búsqueda" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <form action="/buscar" className="mt-5">
        <label htmlFor={`${id}-query`} className="sr-only">Qué quieres buscar</label>
        <div className="relative">
          <Search size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" aria-hidden="true" />
          <input
            id={`${id}-query`}
            data-autofocus
            className="field pl-11 pr-24"
            name="q"
            type="search"
            autoComplete="off"
            placeholder="Cliente, obra, factura…"
          />
          <button type="submit" className="primary-button absolute right-1 top-1 min-h-10 px-3">Buscar</button>
        </div>
      </form>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-content-tertiary">
        <span><kbd className="font-semibold">↑ ↓</kbd> recorrer</span>
        <span><kbd className="font-semibold">Enter</kbd> buscar</span>
        <span><kbd className="font-semibold">Esc</kbd> cerrar</span>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="type-label mb-2">Accesos</p>
        <Link href="/dashboard" onClick={onClose} className="shell-menu-row">
          <BarChart3 size={18} aria-hidden="true" />Dashboard
        </Link>
      </div>
    </div>
  );
}

function MobileCreateSheet({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <SheetFrame id={id} title="Crear" description="Elige una acción frecuente." onClose={onClose}>
      <CreateRows onNavigate={onClose} />
    </SheetFrame>
  );
}

function MobileMoreSheet({
  id,
  pathname,
  unread,
  companyName,
  userName,
  modeLabel,
  logoutAction,
  onClose
}: {
  id: string;
  pathname: string;
  unread: number;
  companyName: string;
  userName: string;
  modeLabel?: string;
  logoutAction: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <SheetFrame id={id} title="Más" description="Todas las áreas, sin saturar tu día." onClose={onClose}>
      <Link href="/capataz" onClick={onClose} className="mb-5 flex min-h-12 items-center gap-3 rounded-lg bg-brand-soft px-3 font-semibold text-brand-strong">
        <Bot size={20} aria-hidden="true" />Capataz
      </Link>
      <div className="grid gap-5">
        <section>
          <h3 className="type-label mb-2">Trabajo y gestión</h3>
          <div className="grid gap-1">
            {primaryNavigation.filter((item) => !["/hoy", "/clientes", "/obras"].includes(item.href)).map((item) => (
              <NavigationLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
            ))}
          </div>
        </section>
        {secondaryNavigation.slice(0, 2).map((group) => (
          <NavigationGroup key={group.label} group={group} pathname={pathname} unread={unread} onNavigate={onClose} />
        ))}
      </div>
      <section className="mt-5 border-t border-border pt-4">
        <div className="flex items-center gap-3 px-2">
          <UserAvatar name={userName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{userName}</p>
            <p className="truncate text-xs text-content-secondary">{companyName}</p>
            {modeLabel ? <p className="truncate text-[11px] text-content-tertiary">{modeLabel}</p> : null}
          </div>
        </div>
        <div className="mt-3 grid gap-1">
          <Link href="/configuracion#perfil" className="shell-menu-row" onClick={onClose}>
            <CircleUserRound size={18} aria-hidden="true" />Perfil
          </Link>
          <Link href="/configuracion" className="shell-menu-row" onClick={onClose}>
            <Settings size={18} aria-hidden="true" />Configuración
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="shell-menu-row">
              <LogOut size={18} aria-hidden="true" />Cerrar sesión
            </button>
          </form>
        </div>
      </section>
    </SheetFrame>
  );
}

function SheetFrame({
  id,
  title,
  description,
  children,
  onClose
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-5">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" aria-hidden="true" />
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface pb-3">
        <div>
          <h2 id={`${id}-title`} className="type-section-title text-content">{title}</h2>
          <p className="type-secondary mt-1">{description}</p>
        </div>
        <button data-autofocus type="button" className="icon-button" aria-label={`Cerrar ${title}`} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}

function CreateRows({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="grid gap-1">
      {createActions.map((item) => {
        const Icon = icons[item.icon];
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} className="shell-menu-row min-h-14">
            <Icon size={20} className="text-brand-strong" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-semibold text-content">{item.label}</span>
              <span className="block text-xs font-normal text-content-secondary">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function NavigationGroup({
  group,
  pathname,
  unread,
  onNavigate
}: {
  group: (typeof secondaryNavigation)[number];
  pathname: string;
  unread: number;
  onNavigate: () => void;
}) {
  return (
    <section>
      <h3 className="type-label mb-2">{group.label}</h3>
      <div className="grid gap-1">
        {group.items.map((item) => (
          <NavigationLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            badge={item.href === "/notificaciones" ? unread : 0}
          />
        ))}
      </div>
    </section>
  );
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
  badge = 0
}: {
  item: ProductDestination;
  pathname: string;
  onNavigate?: () => void;
  badge?: number;
}) {
  const active = isProductDestinationActive(pathname, item.href);
  const Icon = icons[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
        active ? "bg-brand-soft text-content" : "text-content-secondary hover:bg-subtle hover:text-content"
      )}
    >
      <Icon size={19} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge ? <NotificationBadge count={badge} /> : null}
    </Link>
  );
}

function NotificationLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/notificaciones"
      className="icon-button relative"
      aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}
    >
      <Bell size={20} aria-hidden="true" />
      {unread ? <span className="absolute -right-1 -top-1"><NotificationBadge count={unread} compact /></span> : null}
    </Link>
  );
}

function NotificationBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-content px-1.5 font-bold leading-none text-white",
        compact ? "min-h-5 min-w-5 text-[10px]" : "min-h-6 min-w-6 text-xs"
      )}
      aria-hidden="true"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("es") || "U";
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong" aria-hidden="true">
      {initial}
    </span>
  );
}

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hasAttribute("hidden"));
}

function isTextEntry(target: HTMLElement | null) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || Boolean(target?.isContentEditable);
}
