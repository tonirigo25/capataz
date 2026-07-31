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
  Home,
  Landmark,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
  captureActions,
  createActions,
  isProductDestinationActive,
  resolveRouteContext,
  type ProductDestination,
  type ProductIcon
} from "@/lib/product-navigation";
import type { PortalManifest } from "@/lib/commercial/portal-manifest";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { brand } from "@/lib/brand";
import { OrqenaContextRail } from "@/components/portal/orqena-context-rail";

type DesktopPanel = "more" | "create" | "user" | null;
type Overlay = "search" | "capture" | "more" | null;

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
  portalManifest,
  capabilities,
  modeLabel,
  unreadNotifications,
  companyName,
  userName,
  platformAccess,
  logoutAction
}: {
  children: ReactNode;
  portalManifest: PortalManifest;
  capabilities: string[];
  modeLabel?: string;
  unreadNotifications: number;
  companyName: string;
  userName: string;
  platformAccess: boolean;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const dialogId = useId();
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const context = useMemo(() => resolveRouteContext(pathname), [pathname]);
  const desktopNavigation = useMemo(() => buildCanonicalDesktopNavigation(portalManifest), [portalManifest]);
  const contextLabel = pathname === "/capataz" ? brand.assistantName : context.label;
  const canCapture = useMemo(
    () => captureActions.some((item) => !item.capability || capabilities.includes(item.capability)),
    [capabilities],
  );

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
    <div className="field-os-app-shell min-h-dvh" data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}>
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[80] inline-flex min-h-11 -translate-y-20 items-center rounded-lg bg-brand px-4 py-2 font-semibold text-white transition focus:translate-y-0"
      >
        Saltar al contenido
      </a>

      <aside className="field-os-sidebar fixed inset-y-0 left-0 z-40 border-r">
        <DesktopNavigation
          navigation={desktopNavigation}
          pathname={pathname}
          companyName={companyName}
          userName={userName}
          modeLabel={modeLabel}
          collapsed={sidebarCollapsed}
          desktopPanel={desktopPanel}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onOpenPanel={openDesktopPanel}
        />
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/95">
        <div className="mx-auto flex h-16 max-w-product items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            href={portalManifest.safeHome}
            className="field-os-mobile-brand h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white"
            aria-label="Ir a Hoy"
          >
            <BrandMark className="h-7 w-7 text-white" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-content lg:max-w-44" aria-label={`Área actual: ${contextLabel}`}>
            {contextLabel}
          </p>
          <Link href="/seleccionar-empresa" className="ghost-button max-w-40 truncate px-2 text-xs" aria-label={`Cambiar empresa. Activa: ${companyName}`}>
            <Building2 size={17} aria-hidden="true"/><span className="truncate">{companyName}</span><ChevronDown size={14} aria-hidden="true"/>
          </Link>

          <button
            type="button"
            className="field-os-global-search h-10 min-w-0 max-w-md flex-1 items-center gap-3 rounded-lg border border-border bg-subtle px-3 text-left text-sm text-content-secondary transition hover:border-border-strong hover:bg-surface"
            aria-label={`Buscar en ${brand.productName}`}
            onClick={(event) => openOverlay("search", event.currentTarget)}
          >
            <Search size={18} aria-hidden="true" />
            <span className="flex-1">Buscar en {brand.productName}</span>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-content-tertiary">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="icon-button field-os-search-trigger"
              aria-label={`Buscar en ${brand.productName}`}
              onClick={(event) => openOverlay("search", event.currentTarget)}
            >
              <Search size={20} aria-hidden="true" />
            </button>
            {portalManifest.quickActions.length ? <button
              type="button"
              className="field-os-desktop-action secondary-button"
              aria-expanded={desktopPanel === "create"}
              onClick={(event) => openDesktopPanel("create", event.currentTarget)}
            >
              <Plus size={18} aria-hidden="true" />Crear
            </button> : null}
            {portalManifest.orqenaTools.length ? <Link href="/capataz" className="ghost-button hidden sm:inline-flex">
              <Bot size={18} aria-hidden="true" />{brand.assistantName}
            </Link> : null}
            <NotificationLink unread={unreadNotifications} />
          </div>
        </div>
      </header>

      <div className="field-os-workspace">
        <div id="main-content" className="field-os-main-canvas relative" tabIndex={-1}>{children}</div>
        <OrqenaContextRail pathname={pathname} />
      </div>

      <MobileBottomNavigation
        items={portalManifest.mobileNavigation}
        canCapture={canCapture}
        pathname={pathname}
        overlay={overlay}
        onOpen={openOverlay}
      />

      {desktopPanel === "more" ? (
        <DesktopMorePanel
          groups={portalManifest.navigationGroups}
          ref={panelRef}
          pathname={pathname}
          unread={unreadNotifications}
          onClose={closeDesktopPanel}
        />
      ) : null}
      {desktopPanel === "create" ? (
        <DesktopCreatePanel capabilities={capabilities} ref={panelRef} onClose={closeDesktopPanel} />
      ) : null}
      {desktopPanel === "user" ? (
        <DesktopUserPanel
          ref={panelRef}
          companyName={companyName}
          userName={userName}
          modeLabel={modeLabel}
          logoutAction={logoutAction}
          platformAccess={platformAccess}
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
              <SearchDialog id={dialogId} showDashboard={portalManifest.navigation.some((item) => item.href === "/dashboard")} onClose={() => setOverlay(null)} />
            ) : overlay === "capture" ? (
              <MobileCaptureSheet capabilities={capabilities} id={dialogId} onClose={() => setOverlay(null)} />
            ) : (
              <MobileMoreSheet
                navigation={portalManifest.navigation}
                groups={portalManifest.navigationGroups}
                id={dialogId}
                pathname={pathname}
                unread={unreadNotifications}
                companyName={companyName}
                userName={userName}
                modeLabel={modeLabel}
                logoutAction={logoutAction}
                platformAccess={platformAccess}
                onClose={() => setOverlay(null)}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCanonicalDesktopNavigation(portalManifest: PortalManifest): ProductDestination[] {
  const allowed = new Map(
    [...portalManifest.navigation, ...portalManifest.navigationGroups.flatMap((group) => group.items)]
      .map((item) => [item.href, item] as const),
  );
  const order: Array<{ href: string; label: string; icon: ProductIcon }> = [
    { href: "/hoy", label: "Hoy", icon: "home" },
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/clientes", label: "Clientes", icon: "client" },
    { href: "/obras", label: "Trabajo", icon: "briefcase" },
    { href: "/presupuestos", label: "Presupuestos", icon: "document" },
    { href: "/dinero", label: "Dinero", icon: "invoice" },
    { href: "/documentos", label: "Documentos", icon: "document" },
    { href: "/agenda", label: "Agenda", icon: "agenda" },
    { href: "/equipo", label: "Equipo", icon: "client" },
    { href: "/capataz", label: brand.assistantName, icon: "bot" },
    { href: "/configuracion", label: "Configuración", icon: "settings" },
  ];

  return order.flatMap((target) => {
    if (target.href === "/capataz") return portalManifest.orqenaTools.length ? [target] : [];
    const source = allowed.get(target.href);
    return source ? [{ ...source, label: target.label, icon: target.icon }] : [];
  });
}

function DesktopNavigation({
  navigation,
  pathname,
  companyName,
  userName,
  modeLabel,
  collapsed,
  desktopPanel,
  onToggleCollapsed,
  onOpenPanel
}: {
  navigation: ProductDestination[];
  pathname: string;
  companyName: string;
  userName: string;
  modeLabel?: string;
  collapsed: boolean;
  desktopPanel: DesktopPanel;
  onToggleCollapsed: () => void;
  onOpenPanel: (panel: Exclude<DesktopPanel, null>, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <Link href="/hoy" className="field-os-sidebar__brand flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-subtle" aria-label="Ir a Hoy">
          <span className="field-os-sidebar__brand-mark flex h-10 w-10 shrink-0 items-center justify-center">
            <BrandMark className="h-8 w-8" />
          </span>
          <span className="field-os-sidebar__brand-copy min-w-0">
            <span className="block text-base font-bold leading-5 text-content">{brand.companyName}</span>
            <span className="block truncate text-xs text-content-secondary">Portal empresarial</span>
          </span>
        </Link>
        {modeLabel && !collapsed ? <p className="mt-1 truncate px-2 text-[11px] font-medium text-content-tertiary">{modeLabel}</p> : null}
      </div>

      <nav className="field-os-sidebar__navigation flex-1 overflow-y-auto px-3" aria-label="Navegación principal">
        <div className="grid gap-1">
          {navigation.map((item) => (
            <NavigationLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
        {!collapsed ? <button
            type="button"
            className={clsx(
              "mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
              desktopPanel === "more" ? "bg-brand-soft text-brand-strong" : "text-content-secondary hover:bg-subtle hover:text-content"
            )}
            aria-expanded={desktopPanel === "more"}
            aria-controls="desktop-more-navigation"
            onClick={(event) => onOpenPanel("more", event.currentTarget)}
          >
            <Ellipsis size={19} aria-hidden="true" />
            <span className="flex-1 text-left">Más</span>
            <ChevronDown size={16} className="-rotate-90" aria-hidden="true" />
          </button> : null}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          className="mb-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-content-secondary transition hover:bg-subtle hover:text-content"
          aria-label={collapsed ? "Expandir menú" : "Ocultar menú"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
          <span className="field-os-sidebar__label">Ocultar menú</span>
        </button>
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
          <span className="field-os-sidebar__label min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-content">{userName}</span>
            <span className="block truncate text-xs text-content-secondary">{companyName}</span>
          </span>
          {!collapsed ? <ChevronDown size={16} aria-hidden="true" /> : null}
        </button>
      </div>
    </div>
  );
}

const DesktopMorePanel = forwardRef<HTMLDivElement, {
  groups: PortalManifest["navigationGroups"];
  pathname: string;
  unread: number;
  onClose: () => void;
}>(function DesktopMorePanel({
  groups,
  pathname,
  unread,
  onClose
}, ref) {
  return (
    <div
      ref={ref}
      id="desktop-more-navigation"
      className="field-os-sidebar-panel fixed bottom-5 top-20 z-50 w-[25rem] overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-card"
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
        {groups.map((group) => (
          <NavigationGroup key={group.label} group={group} pathname={pathname} unread={unread} onNavigate={onClose} />
        ))}
      </div>
    </div>
  );
});

const DesktopCreatePanel = forwardRef<HTMLDivElement, {
  capabilities: string[];
  onClose: () => void;
}>(function DesktopCreatePanel({
  capabilities,
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
      <CreateRows capabilities={capabilities} onNavigate={onClose} />
    </div>
  );
});

const DesktopUserPanel = forwardRef<HTMLDivElement, {
  companyName: string;
  userName: string;
  modeLabel?: string;
  platformAccess: boolean;
  logoutAction: () => Promise<void>;
  onClose: () => void;
}>(function DesktopUserPanel({
  companyName,
  userName,
  modeLabel,
  platformAccess,
  logoutAction,
  onClose
}, ref) {
  return (
    <div ref={ref} className="field-os-sidebar-panel fixed bottom-3 z-50 w-72 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <div className="border-b border-border px-2 pb-3">
        <p className="truncate text-sm font-semibold text-content">{userName}</p>
        <p className="truncate text-xs text-content-secondary">{companyName}</p>
        {modeLabel ? <p className="mt-1 text-[11px] text-content-tertiary">{modeLabel}</p> : null}
      </div>
      <div className="grid gap-1 pt-2">
        <div className="px-2 py-2">
          <p className="mb-2 text-xs font-semibold text-content-secondary">Apariencia</p>
          <ThemeSwitcher />
        </div>
        <Link href="/configuracion#perfil" className="shell-menu-row" onClick={onClose}>
          <UserRound size={18} aria-hidden="true" />Perfil
        </Link>
        <Link href="/configuracion" className="shell-menu-row" onClick={onClose}>
          <Settings size={18} aria-hidden="true" />Configuración
        </Link>
        {platformAccess ? <Link href="/plataforma" className="shell-menu-row" onClick={onClose}><Building2 size={18} aria-hidden="true" />Plataforma interna</Link> : null}
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
  items,
  canCapture,
  pathname,
  overlay,
  onOpen
}: {
  items: ProductDestination[];
  canCapture: boolean;
  pathname: string;
  overlay: Overlay;
  onOpen: (overlay: Exclude<Overlay, null>, trigger: HTMLButtonElement) => void;
}) {
  const mobileItems = items.slice(0, canCapture ? 3 : 4);
  return (
    <nav
      className="field-os-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación móvil"
    >
      <div className="mx-auto flex h-16 max-w-lg justify-around px-1">
        {mobileItems.slice(0, 2).map((item) => <BottomLink key={item.href} item={item} pathname={pathname} />)}
        {canCapture ? <button
          type="button"
          className={clsx("field-os-capture-trigger shell-bottom-item", overlay === "capture" ? "bg-brand-soft text-brand-strong" : "text-content-secondary")}
          aria-label="Capturar"
          aria-expanded={overlay === "capture"}
          onClick={(event) => onOpen("capture", event.currentTarget)}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg">
            <Plus size={19} aria-hidden="true" />
          </span>
          <span>Capturar</span>
        </button> : null}
        {mobileItems.slice(2).map((item) => <BottomLink key={item.href} item={item} pathname={pathname} />)}
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
      <span>{item.href === "/capataz" ? brand.assistantName : item.label}</span>
    </Link>
  );
}

function SearchDialog({ id, showDashboard, onClose }: { id: string; showDashboard: boolean; onClose: () => void }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="type-section-title text-content">Buscar en {brand.productName}</h2>
          <p className="type-secondary mt-1">Clientes, trabajos, presupuestos, facturas y documentos.</p>
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
            placeholder="Cliente, trabajo, factura…"
          />
          <button type="submit" className="primary-button absolute right-1 top-1 min-h-10 px-3">Buscar</button>
        </div>
      </form>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-content-tertiary">
        <span><kbd className="font-semibold">↑ ↓</kbd> recorrer</span>
        <span><kbd className="font-semibold">Enter</kbd> buscar</span>
        <span><kbd className="font-semibold">Esc</kbd> cerrar</span>
      </div>
      {showDashboard ? <div className="mt-5 border-t border-border pt-4">
        <p className="type-label mb-2">Accesos</p>
        <Link href="/dashboard" onClick={onClose} className="shell-menu-row">
          <BarChart3 size={18} aria-hidden="true" />Dashboard
        </Link>
      </div> : null}
    </div>
  );
}

function MobileCaptureSheet({ id, capabilities, onClose }: { id: string; capabilities: string[]; onClose: () => void }) {
  return (
    <SheetFrame id={id} title="Capturar" description="Registra lo que acaba de pasar." onClose={onClose}>
      <CaptureRows capabilities={capabilities} onNavigate={onClose} />
      <p className="mt-4 rounded-lg bg-subtle p-3 text-xs leading-5 text-content-secondary">
        La cámara o el micrófono sólo se solicitarán después de elegir una acción que los necesite.
      </p>
    </SheetFrame>
  );
}

function MobileMoreSheet({
  navigation,
  groups,
  id,
  pathname,
  unread,
  companyName,
  userName,
  modeLabel,
  platformAccess,
  logoutAction,
  onClose
}: {
  navigation: ProductDestination[];
  groups: PortalManifest["navigationGroups"];
  id: string;
  pathname: string;
  unread: number;
  companyName: string;
  userName: string;
  modeLabel?: string;
  platformAccess: boolean;
  logoutAction: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <SheetFrame id={id} title="Más" description="Todas las áreas, sin saturar tu día." onClose={onClose}>
      {navigation.some((item) => item.href === "/capataz") ? <Link href="/capataz" onClick={onClose} className="mb-5 flex min-h-12 items-center gap-3 rounded-lg bg-brand-soft px-3 font-semibold text-brand-strong">
        <Bot size={20} aria-hidden="true" />{brand.assistantName}
      </Link> : null}
      <div className="grid gap-5">
        <section>
          <h3 className="type-label mb-2">Trabajo y gestión</h3>
          <div className="grid gap-1">
            {navigation.filter((item) => !["/hoy", "/clientes", "/obras", "/capataz"].includes(item.href)).map((item) => (
              <NavigationLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
            ))}
          </div>
        </section>
        {groups.slice(0, 2).map((group) => (
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
          <div className="px-2 py-2">
            <p className="mb-2 text-xs font-semibold text-content-secondary">Apariencia</p>
            <ThemeSwitcher />
          </div>
          <Link href="/configuracion#perfil" className="shell-menu-row" onClick={onClose}>
            <CircleUserRound size={18} aria-hidden="true" />Perfil
          </Link>
          <Link href="/configuracion" className="shell-menu-row" onClick={onClose}>
            <Settings size={18} aria-hidden="true" />Configuración
          </Link>
          {platformAccess ? <Link href="/plataforma" className="shell-menu-row" onClick={onClose}><Building2 size={18} aria-hidden="true" />Plataforma interna</Link> : null}
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

function CreateRows({ capabilities, onNavigate }: { capabilities: string[]; onNavigate: () => void }) {
  return (
    <div className="grid gap-1">
      {createActions.filter((item)=>!item.capability||capabilities.includes(item.capability)).map((item) => {
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

function CaptureRows({ capabilities, onNavigate }: { capabilities: string[]; onNavigate: () => void }) {
  const actions = captureActions.filter((item) => !item.capability || capabilities.includes(item.capability));
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((item) => {
        const Icon = icons[item.icon];
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} className="flex min-h-28 flex-col rounded-lg border border-border bg-surface p-3 text-left transition hover:border-border-strong hover:bg-subtle">
            <Icon size={21} className="text-brand-strong" aria-hidden="true" />
            <span className="mt-auto pt-4 font-semibold text-content">{item.label}</span>
            <span className="mt-1 text-xs font-normal leading-5 text-content-secondary">{item.description}</span>
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
  group: PortalManifest["navigationGroups"][number];
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
        active ? "bg-brand-soft text-brand-strong" : "text-content-secondary hover:bg-subtle hover:text-content"
      )}
    >
      <Icon size={19} aria-hidden="true" />
      <span className="field-os-sidebar__label min-w-0 flex-1 truncate">{item.href === "/capataz" ? brand.assistantName : item.label}</span>
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
