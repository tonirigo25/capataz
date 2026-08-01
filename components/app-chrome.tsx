"use client";

import type { ReactNode } from "react";
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
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
  productSubnavigation,
  resolveRouteContext,
  type ProductDestination,
  type ProductIcon
} from "@/lib/product-navigation";
import type { PortalManifest } from "@/lib/commercial/portal-manifest";
import { BrandLogo } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { brand } from "@/lib/brand";
import { OrqenaContextRail } from "@/components/portal/orqena-context-rail";
import type { PortalRailRecommendations } from "@/lib/application/intelligence/today-recommendation";

type DesktopPanel = "more" | "create" | "user" | null;
type Overlay = "search" | "capture" | "more" | null;
type ShellDestination = ProductDestination & { unavailable?: boolean; children?: ProductDestination[] };

const activityRouteCapabilities = [
  "reports.view",
  "clients.view",
  "work.view",
  "sales.budgets.view",
  "sales.invoices.view",
  "treasury.view",
  "purchase_cost.view",
  "agenda.view",
  "documents.view",
] as const;

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
  logoutAction,
  railRecommendations,
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
  railRecommendations: PortalRailRecommendations;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editedClientId =
    pathname === "/gestion" && searchParams.get("tipo") === "cliente"
      ? searchParams.get("id")
      : null;
  const railPathname = editedClientId
    ? `/clientes/${editedClientId}/editar`
    : pathname;
  const hasEmbeddedClientContext =
    pathname === "/clientes" || /^\/clientes\/[^/]+$/.test(pathname);
  const dialogId = useId();
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const context = useMemo(() => resolveRouteContext(pathname), [pathname]);
  const desktopNavigation = useMemo(() => buildCanonicalDesktopNavigation(portalManifest, capabilities), [portalManifest, capabilities]);
  const activityRouteAvailable = useMemo(() => {
    const capabilitySet = new Set(capabilities);
    const required = new Set<string>(activityRouteCapabilities);
    return activityRouteCapabilities.every((capability) => capabilitySet.has(capability)) &&
      !portalManifest.scopes.some((scope) => required.has(scope.capabilityKey) && scope.scope !== "COMPANY");
  }, [capabilities, portalManifest.scopes]);
  const shellNavigationGroups = useMemo(
    () => portalManifest.navigationGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.href !== "/actividad" || activityRouteAvailable) }))
      .filter((group) => group.items.length > 0),
    [activityRouteAvailable, portalManifest.navigationGroups],
  );
  const contextLabel = editedClientId
    ? "Clientes"
    : pathname === "/capataz" || pathname.startsWith("/orqena-ia")
      ? brand.assistantName
      : context.label;
  const orqenaAvailable = capabilities.includes("orqena.use");
  const canCapture = useMemo(
    () => captureActions.some((item) => !item.capability || capabilities.includes(item.capability)),
    [capabilities],
  );
  const canCreate = canCapture || portalManifest.quickActions.length > 0;

  useEffect(() => {
    try {
      setRailCollapsed(window.localStorage.getItem("orqena.portal.iaRailCollapsed") === "true");
    } catch {
      // La preferencia es opcional; el rail sigue funcionando sin almacenamiento local.
    }
  }, []);

  useEffect(() => {
    setDesktopPanel(null);
    setOverlay(null);
  }, [pathname]);

  useEffect(() => {
    if (!desktopPanel) return;
    const frame = desktopPanel === "more"
      ? requestAnimationFrame(() => panelRef.current?.focus())
      : null;
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
      if (frame !== null) cancelAnimationFrame(frame);
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
          collapsed={sidebarCollapsed}
          moreOpen={desktopPanel === "more"}
          onOpenMore={(trigger) => openDesktopPanel("more", trigger)}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        />
      </aside>

      <header className="field-os-topbar sticky top-0 z-30 border-b border-border bg-surface/95">
        <div className="field-os-topbar__inner flex items-center gap-2 px-4 sm:px-6">
          <Link
            href={portalManifest.safeHome}
            className="field-os-mobile-brand h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white"
            aria-label="Ir a Hoy"
          >
            <BrandLogo variant="symbol" size="sm" className="h-7 w-7" />
          </Link>
          <p className="field-os-mobile-context min-w-0 flex-1 truncate text-sm font-semibold text-content" aria-label={`Área actual: ${contextLabel}`}>
            {contextLabel}
          </p>

          <button
            type="button"
            className="field-os-global-search h-10 min-w-0 max-w-md flex-1 items-center gap-3 rounded-lg border border-border bg-subtle px-3 text-left text-sm text-content-secondary transition hover:border-border-strong hover:bg-surface"
            aria-label={`Buscar en ${brand.productName}`}
            onClick={(event) => openOverlay("search", event.currentTarget)}
          >
            <Search size={18} aria-hidden="true" />
            <span className="flex-1">Buscar en Orqena Tech...</span>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-content-tertiary">Ctrl K</kbd>
          </button>

          <Link
            href="/seleccionar-empresa"
            className="field-os-company-switcher"
            aria-label={`Cambiar empresa. Activa: ${companyName}`}
          >
            <Building2 size={18} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{companyName}</span>
            {modeLabel ? <span className="field-os-environment-badge">{modeLabel}</span> : null}
            <ChevronDown size={15} aria-hidden="true" />
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="icon-button field-os-search-trigger"
              aria-label={`Buscar en ${brand.productName}`}
              onClick={(event) => openOverlay("search", event.currentTarget)}
            >
              <Search size={20} aria-hidden="true" />
            </button>
            <NotificationLink unread={unreadNotifications} />
            <Link href="/configuracion/soporte/ayuda" className="icon-button field-os-help-link" aria-label="Abrir ayuda">
              <CircleHelp size={20} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="field-os-user-trigger"
              aria-expanded={desktopPanel === "user"}
              onClick={(event) => openDesktopPanel("user", event.currentTarget)}
            >
              <UserAvatar name={userName} />
              <span className="truncate">{userName}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {portalManifest.quickActions.length ? <button
              type="button"
              className="field-os-desktop-action field-os-new-action"
              aria-expanded={desktopPanel === "create"}
              onClick={(event) => openDesktopPanel("create", event.currentTarget)}
            >
              <Plus className="field-os-new-action__leading" size={17} aria-hidden="true" />
              <span className="field-os-new-action__label">Nuevo</span>
              <ChevronDown className="field-os-new-action__trailing" size={15} aria-hidden="true" />
            </button> : <button
              type="button"
              className="field-os-desktop-action field-os-new-action"
              aria-label="Nuevo no disponible con este acceso"
              title="Tu acceso actual es de solo lectura"
              disabled
            >
              <Plus className="field-os-new-action__leading" size={17} aria-hidden="true" />
              <span className="field-os-new-action__label">Nuevo</span>
              <ChevronDown className="field-os-new-action__trailing" size={15} aria-hidden="true" />
            </button>}
          </div>
        </div>
      </header>

      <div
        className="field-os-workspace"
        data-rail-collapsed={railCollapsed ? "true" : "false"}
        data-embedded-context={hasEmbeddedClientContext ? "client" : undefined}
      >
        <div id="main-content" className="field-os-main-canvas relative" tabIndex={-1}>{children}</div>
        {hasEmbeddedClientContext ? null : <OrqenaContextRail pathname={railPathname} recommendations={railRecommendations} canUse={orqenaAvailable} canExecute={capabilities.includes("orqena.execute")} collapsed={railCollapsed} onToggleCollapsed={() => setRailCollapsed((current) => {
          const next = !current;
          try {
            window.localStorage.setItem("orqena.portal.iaRailCollapsed", String(next));
          } catch {
            // Mantener el control operativo aunque el navegador bloquee storage.
          }
          return next;
        })} />}
      </div>

      <MobileBottomNavigation
        items={portalManifest.mobileNavigation}
        capabilities={capabilities}
        canCapture={canCreate}
        pathname={pathname}
        overlay={overlay}
        onOpen={openOverlay}
      />

      {desktopPanel === "more" ? (
        <DesktopMorePanel
          groups={shellNavigationGroups}
          sidebarNavigation={desktopNavigation}
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
                groups={shellNavigationGroups}
                id={dialogId}
                pathname={pathname}
                unread={unreadNotifications}
                companyName={companyName}
                userName={userName}
                modeLabel={modeLabel}
                logoutAction={logoutAction}
                platformAccess={platformAccess}
                orqenaAvailable={orqenaAvailable}
                onClose={() => setOverlay(null)}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCanonicalDesktopNavigation(portalManifest: PortalManifest, capabilities: string[]): ShellDestination[] {
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
    { href: "/orqena-ia", label: brand.assistantName, icon: "bot" },
    { href: "/configuracion", label: "Configuración", icon: "settings" },
  ];

  const capabilitySet = new Set(capabilities);
  return order.flatMap<ShellDestination>((target): ShellDestination[] => {
    const source = allowed.get(target.href);
    if (target.href === "/orqena-ia" && !source) return [{ ...target, capability: "orqena.use", unavailable: true }];
    if (!source) return [];
    const children = (productSubnavigation[target.href] ?? []).filter((item) => !item.capability || capabilitySet.has(item.capability));
    return [{ ...source, label: target.label, icon: target.icon, children }];
  });
}

function DesktopNavigation({
  navigation,
  pathname,
  collapsed,
  moreOpen,
  onOpenMore,
  onToggleCollapsed,
}: {
  navigation: ShellDestination[];
  pathname: string;
  collapsed: boolean;
  moreOpen: boolean;
  onOpenMore: (trigger: HTMLButtonElement) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="field-os-sidebar__brand-area">
        <Link href="/hoy" className="field-os-sidebar__brand" aria-label="Ir a Hoy">
          {collapsed ? <BrandLogo variant="symbol" size="sm" className="h-8 w-8" /> : <BrandLogo variant="sidebar" size="lg" title={brand.companyName} />}
        </Link>
      </div>

      <nav className="field-os-sidebar__navigation flex-1 overflow-y-auto px-3" aria-label="Navegación principal">
        <div className="grid gap-1">
          {navigation.map((item) => (
            <NavigationBranch key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div className="field-os-sidebar__footer border-t border-border p-3">
        <button
          type="button"
          className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-content-secondary transition hover:bg-subtle hover:text-content"
          aria-expanded={moreOpen}
          aria-controls="desktop-more-navigation"
          onClick={(event) => onOpenMore(event.currentTarget)}
        >
          <Ellipsis size={19} aria-hidden="true" />
          <span className="field-os-sidebar__label">Más áreas</span>
        </button>
        <button
          type="button"
          className="mb-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-content-secondary transition hover:bg-subtle hover:text-content"
          aria-label={collapsed ? "Expandir menú" : "Ocultar menú"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
          <span className="field-os-sidebar__label">Ocultar menú</span>
        </button>
      </div>
    </div>
  );
}

function NavigationBranch({ item, pathname, collapsed }: { item: ShellDestination; pathname: string; collapsed: boolean }) {
  const children = item.children ?? [];
  const childActive = children.some((child) => isProductDestinationActive(pathname, child.href));
  const parentActive = isProductDestinationActive(pathname, item.href);
  const expanded = !collapsed && children.length > 0 && (parentActive || childActive);
  return (
    <div className="field-os-navigation-branch" data-expanded={expanded ? "true" : "false"}>
      <NavigationLink
        item={item}
        pathname={pathname}
        activeOverride={parentActive || childActive}
        currentOverride={parentActive}
        trailing={children.length ? <ChevronDown className={clsx("field-os-sidebar__label transition-transform", expanded && "rotate-180")} size={14} aria-hidden="true" /> : undefined}
      />
      {expanded ? (
        <div className="field-os-navigation-children ml-[27px] grid gap-0.5 border-l border-white/15 py-1" role="group" aria-label={`Submenús de ${item.label}`}>
          {children.map((child) => <NavigationLink key={child.href} item={child} pathname={pathname} compact />)}
        </div>
      ) : null}
    </div>
  );
}

const DesktopMorePanel = forwardRef<HTMLDivElement, {
  groups: PortalManifest["navigationGroups"];
  sidebarNavigation: ShellDestination[];
  pathname: string;
  unread: number;
  onClose: () => void;
}>(function DesktopMorePanel({
  groups,
  sidebarNavigation,
  pathname,
  unread,
  onClose
}, ref) {
  const destinationsShownElsewhere = new Set([
    "/notificaciones",
    ...sidebarNavigation.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]),
  ]);
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !destinationsShownElsewhere.has(item.href)) }))
    .filter((group) => group.items.length > 0);
  return (
    <div
      ref={ref}
      id="desktop-more-navigation"
      role="region"
      aria-label="Más áreas"
      tabIndex={-1}
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
        {visibleGroups.map((group) => (
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
    <div ref={ref} className="field-os-user-panel fixed right-4 top-[4.25rem] z-50 w-72 rounded-2xl border border-border bg-surface p-3 shadow-card">
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
  capabilities,
  canCapture,
  pathname,
  overlay,
  onOpen
}: {
  items: ProductDestination[];
  capabilities: string[];
  canCapture: boolean;
  pathname: string;
  overlay: Overlay;
  onOpen: (overlay: Exclude<Overlay, null>, trigger: HTMLButtonElement) => void;
}) {
  const mobileItems = items.slice(0, canCapture ? 3 : 4);
  const capabilitySet = new Set(capabilities);
  return (
    <nav
      className="field-os-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación móvil"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
        {mobileItems.slice(0, 2).map((item) => <BottomLink key={item.href} item={item} pathname={pathname} capabilitySet={capabilitySet} />)}
        {canCapture ? <button
          type="button"
          className={clsx("field-os-capture-trigger shell-bottom-item", overlay === "capture" ? "bg-brand-soft text-brand-strong" : "text-content-secondary")}
          aria-label="Crear o capturar"
          aria-expanded={overlay === "capture"}
          onClick={(event) => onOpen("capture", event.currentTarget)}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg">
            <Plus size={19} aria-hidden="true" />
          </span>
          <span>Nuevo</span>
        </button> : null}
        {mobileItems.slice(2).map((item) => <BottomLink key={item.href} item={item} pathname={pathname} capabilitySet={capabilitySet} />)}
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

function BottomLink({ item, pathname, capabilitySet }: { item: ProductDestination; pathname: string; capabilitySet: Set<string> }) {
  const active = isProductDestinationActive(pathname, item.href) ||
    (productSubnavigation[item.href] ?? []).some((child) =>
      (!child.capability || capabilitySet.has(child.capability)) && isProductDestinationActive(pathname, child.href),
    );
  const Icon = icons[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx("shell-bottom-item", active ? "bg-brand-soft text-brand-strong" : "text-content-secondary")}
    >
      <Icon size={22} aria-hidden="true" />
      <span>{item.href === "/orqena-ia" ? brand.assistantName : item.label}</span>
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
    <SheetFrame id={id} title="Nuevo" description="Crea o registra una acción autorizada." onClose={onClose}>
      <section>
        <h3 className="type-label mb-2">Crear</h3>
        <CreateRows capabilities={capabilities} onNavigate={onClose} />
      </section>
      <section className="mt-5 border-t border-border pt-4">
        <h3 className="type-label mb-2">Captura rápida</h3>
      <CaptureRows capabilities={capabilities} onNavigate={onClose} />
      </section>
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
  orqenaAvailable,
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
  orqenaAvailable: boolean;
  logoutAction: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <SheetFrame id={id} title="Más" description="Todas las áreas, sin saturar tu día." onClose={onClose}>
      {orqenaAvailable ? <Link href="/orqena-ia" onClick={onClose} className="mb-5 flex min-h-12 items-center gap-3 rounded-lg bg-brand-soft px-3 font-semibold text-brand-strong">
        <Bot size={20} aria-hidden="true" />{brand.assistantName}
      </Link> : <span aria-disabled="true" title="No disponible en tu plan o permisos" className="mb-5 flex min-h-12 items-center gap-3 rounded-lg bg-subtle px-3 font-semibold text-content-tertiary"><Bot size={20} aria-hidden="true" />{brand.assistantName}<small className="ml-auto">No disponible</small></span>}
      <div className="grid gap-5">
        <section>
          <h3 className="type-label mb-2">Trabajo y gestión</h3>
          <div className="grid gap-1">
            {navigation.filter((item) => !["/hoy", "/clientes", "/obras", "/orqena-ia"].includes(item.href)).map((item) => (
              <NavigationLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
            ))}
          </div>
        </section>
        {groups.map((group) => (
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
          <Link href="/seleccionar-empresa" className="shell-menu-row" onClick={onClose}>
            <Building2 size={18} aria-hidden="true" />Cambiar empresa
          </Link>
          <Link href="/notificaciones" className="shell-menu-row" onClick={onClose}>
            <Bell size={18} aria-hidden="true" />Notificaciones{unread ? ` (${unread})` : ""}
          </Link>
          <Link href="/configuracion/soporte/ayuda" className="shell-menu-row" onClick={onClose}>
            <CircleHelp size={18} aria-hidden="true" />Ayuda
          </Link>
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
  badge = 0,
  activeOverride,
  currentOverride,
  trailing,
  compact = false,
}: {
  item: ShellDestination;
  pathname: string;
  onNavigate?: () => void;
  badge?: number;
  activeOverride?: boolean;
  currentOverride?: boolean;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  const directActive = isProductDestinationActive(pathname, item.href);
  const active = activeOverride ?? directActive;
  const current = currentOverride ?? directActive;
  const Icon = icons[item.icon];
  const label = item.href === "/orqena-ia" ? brand.assistantName : item.label;
  if (item.unavailable) {
    return (
      <span
        aria-disabled="true"
        title="No disponible en tu plan o permisos"
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-content-tertiary"
      >
        <Icon size={19} aria-hidden="true" />
        <span className="field-os-sidebar__label min-w-0 flex-1 truncate">{label}</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      aria-label={label}
      data-navigation-child={compact ? "true" : undefined}
      className={clsx(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
        compact && "field-os-navigation-child !min-h-8 !gap-2 !rounded-md !py-1 !pl-4 !pr-2 !text-[12px] !font-medium",
        active ? "bg-brand-soft text-brand-strong" : "text-content-secondary hover:bg-subtle hover:text-content"
      )}
    >
      <Icon size={compact ? 14 : 19} aria-hidden="true" />
      <span className="field-os-sidebar__label min-w-0 flex-1 truncate">{label}</span>
      {badge ? <NotificationBadge count={badge} /> : null}
      {trailing}
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
      {unread ? <span className="absolute -right-1 -top-1"><NotificationBadge count={unread} compact tone="alert" /></span> : null}
    </Link>
  );
}

function NotificationBadge({ count, compact = false, tone = "default" }: { count: number; compact?: boolean; tone?: "default" | "alert" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-1.5 font-bold leading-none text-white",
        tone === "alert" ? "bg-red-600" : "bg-content",
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
