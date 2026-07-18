"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BellRing,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CreditCard,
  Ellipsis,
  FileText,
  Files,
  Handshake,
  HardHat,
  Home,
  Landmark,
  Lightbulb,
  ListChecks,
  Package,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  UserRound,
  Users,
  WalletCards,
  Workflow,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type NavItem = { href: string; label: string; icon: LucideIcon };
type MobilePanel = "create" | "more" | null;

const primaryNavigation: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/obras", label: "Obras", icon: BriefcaseBusiness },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/dinero", label: "Facturas y cobros", icon: WalletCards },
  { href: "/agenda", label: "Agenda", icon: CalendarDays }
];

const secondaryNavigation: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Compras y equipo",
    items: [
      { href: "/proveedores", label: "Proveedores", icon: Handshake },
      { href: "/subcontratas", label: "Subcontratas", icon: HardHat },
      { href: "/facturas-proveedor", label: "Facturas proveedor", icon: ReceiptText },
      { href: "/facturas-subcontratas", label: "Facturas subcontrata", icon: Receipt },
      { href: "/gastos-materiales", label: "Gastos y materiales", icon: Package },
      { href: "/documentos", label: "Documentos", icon: Files }
    ]
  },
  {
    title: "Organización",
    items: [
      { href: "/tareas", label: "Tareas", icon: ListChecks },
      { href: "/seguimientos", label: "Seguimientos", icon: Activity },
      { href: "/automatizaciones", label: "Automatizaciones", icon: Workflow },
      { href: "/recordatorios", label: "Recordatorios", icon: Bell },
      { href: "/actividad", label: "Actividad", icon: Activity },
      { href: "/notificaciones", label: "Notificaciones", icon: BellRing }
    ]
  },
  {
    title: "Control",
    items: [
      { href: "/tesoreria", label: "Tesorería", icon: Landmark },
      { href: "/alertas", label: "Alertas", icon: ShieldAlert },
      { href: "/recomendaciones", label: "Recomendaciones", icon: Lightbulb },
      { href: "/inteligencia", label: "Inteligencia", icon: BarChart3 },
      { href: "/buscar", label: "Buscador", icon: Search },
      { href: "/configuracion", label: "Configuración", icon: Settings }
    ]
  }
];

const createActions: NavItem[] = [
  { href: "/gestion?tipo=presupuesto&returnTo=/hoy", label: "Nuevo presupuesto", icon: FileText },
  { href: "/gestion?tipo=cliente&returnTo=/hoy", label: "Nuevo cliente", icon: Users },
  { href: "/gestion?tipo=obra&returnTo=/hoy", label: "Nueva obra", icon: BriefcaseBusiness },
  { href: "/gestion?tipo=gasto&returnTo=/gastos-materiales", label: "Registrar gasto", icon: Package },
  { href: "/gestion?tipo=pago&returnTo=/dinero", label: "Registrar cobro", icon: WalletCards },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/agenda", label: "Nueva visita", icon: CalendarDays }
];

const titles = [...primaryNavigation, ...secondaryNavigation.flatMap((section) => section.items), { href: "/capataz", label: "Capataz", icon: Bot }, { href: "/gestion", label: "Añadir o editar", icon: Plus }];

export function AppChrome({ children, modeLabel, unreadNotifications, companyName, userName, logoutAction }: { children: ReactNode; modeLabel: string; unreadNotifications: number; companyName: string; userName: string; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const panelId = useId();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const title = useMemo(() => currentTitle(pathname), [pathname]);

  useEffect(() => setMobilePanel(null), [pathname]);

  useEffect(() => {
    if (!mobilePanel) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobilePanel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
      lastTriggerRef.current?.focus();
    };
  }, [mobilePanel]);

  function openPanel(panel: Exclude<MobilePanel, null>, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setMobilePanel(panel);
  }

  return (
    <div className="min-h-dvh lg:pl-60">
      <a href="#main-content" className="fixed left-4 top-3 z-[70] -translate-y-20 rounded-lg bg-brand px-4 py-2 font-semibold text-white transition focus:translate-y-0">Saltar al contenido</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-white lg:block">
        <DesktopNavigation modeLabel={modeLabel} pathname={pathname} unreadNotifications={unreadNotifications} companyName={companyName} userName={userName} logoutAction={logoutAction} />
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-product items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/hoy" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white lg:hidden" aria-label="Ir a Hoy">C</Link>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold leading-tight text-content">{title}</p>
              <p className="truncate text-xs font-medium text-content-secondary lg:hidden">{companyName}</p>
            </div>
          </div>

          <form action="/buscar" className="hidden min-w-0 max-w-lg flex-1 lg:block">
            <label className="relative block">
              <span className="sr-only">Buscar en Capataz</span>
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input className="field min-h-10 rounded-full bg-slate-50 pl-10" name="q" type="search" placeholder="Buscar cliente, obra, factura..." />
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/buscar" className="icon-button lg:hidden" aria-label="Buscar"><Search size={20} /></Link>
            <Link href="/capataz" className="ghost-button hidden sm:inline-flex"><Bot size={18} />Capataz</Link>
            <Link href="/configuracion#perfil" className="icon-button hidden sm:inline-flex" aria-label="Mi perfil"><UserRound size={20} /></Link>
            <Link href="/notificaciones" className="icon-button relative" aria-label={`Notificaciones${unreadNotifications ? `, ${unreadNotifications} sin leer` : ""}`}>
              <BellRing size={20} />
              {unreadNotifications ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1 text-center text-[10px] font-bold text-white">{Math.min(unreadNotifications, 99)}</span> : null}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative">{children}</main>

      <MobileBottomNavigation pathname={pathname} mobilePanel={mobilePanel} onOpen={openPanel} />

      {mobilePanel ? (
        <div className="fixed inset-0 z-50 lg:hidden" id={panelId} role="dialog" aria-modal="true" aria-labelledby={`${panelId}-title`}>
          <button type="button" className="absolute inset-0 bg-obra-ink/45 backdrop-blur-[2px]" aria-label="Cerrar panel" onClick={() => setMobilePanel(null)} />
          <section className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-card">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id={`${panelId}-title`} className="type-section-title text-content">{mobilePanel === "create" ? "Crear" : "Más módulos"}</h2>
                <p className="text-sm text-content-secondary">{mobilePanel === "create" ? "Elige una acción rápida" : "Todo Capataz, sin saturar la navegación"}</p>
              </div>
              <button ref={closeButtonRef} type="button" className="icon-button" aria-label="Cerrar panel" onClick={() => setMobilePanel(null)}><X size={20} /></button>
            </div>

            {mobilePanel === "create" ? <ActionGrid items={createActions} onNavigate={() => setMobilePanel(null)} /> : (
              <div className="grid gap-5 py-4 sm:grid-cols-2">
                <Link href="/capataz" onClick={() => setMobilePanel(null)} className="flex items-center gap-3 rounded-xl bg-brand-soft p-4 font-semibold text-brand-strong"><Bot size={21} />Hablar con Capataz</Link>
                {secondaryNavigation.map((section) => (
                  <section key={section.title}>
                    <h3 className="type-meta mb-2">{section.title}</h3>
                    <div className="grid gap-1">{section.items.map((item) => <PanelLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobilePanel(null)} badge={item.href === "/notificaciones" ? unreadNotifications : 0} />)}</div>
                  </section>
                ))}
                <section className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                  <p className="truncate text-sm font-semibold text-content">{companyName}</p>
                  <p className="truncate text-xs text-content-secondary">{userName} · {modeLabel}</p>
                  <form action={logoutAction} className="mt-3"><button type="submit" className="secondary-button w-full">Cerrar sesión</button></form>
                </section>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function DesktopNavigation({ modeLabel, pathname, unreadNotifications, companyName, userName, logoutAction }: { modeLabel: string; pathname: string; unreadNotifications: number; companyName: string; userName: string; logoutAction: () => Promise<void> }) {
  return <div className="flex h-full flex-col">
    <div className="p-5">
      <Link href="/hoy" className="flex items-center gap-3 rounded-xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand font-bold text-white">C</span>
        <span><span className="block text-lg font-bold leading-tight text-content">Capataz</span><span className="block text-xs font-medium text-content-secondary">{modeLabel}</span></span>
      </Link>
    </div>
    <nav className="min-h-0 flex-1 overflow-y-auto px-3" aria-label="Navegación principal">
      <div className="grid gap-1">{primaryNavigation.map((item) => <PanelLink key={item.href} item={item} pathname={pathname} />)}</div>
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-obra-ink focus-visible:ring-2">
          <Ellipsis size={19} /><span className="flex-1">Más</span><span className="text-xs transition group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-2 grid gap-4 border-l border-border pl-2">
          {secondaryNavigation.map((section) => <section key={section.title}><p className="type-meta px-3 pb-1">{section.title}</p><div className="grid gap-0.5">{section.items.map((item) => <PanelLink key={item.href} item={item} pathname={pathname} compact badge={item.href === "/notificaciones" ? unreadNotifications : 0} />)}</div></section>)}
        </div>
      </details>
      <Link href="/capataz" className="mt-4 flex items-center gap-3 rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand-strong"><Bot size={20} />Preguntar a Capataz</Link>
    </nav>
    <div className="border-t border-border p-3">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="truncate text-sm font-semibold text-content">{companyName}</p><p className="truncate text-xs text-content-secondary">{userName}</p>
        <div className="mt-3 flex gap-1"><Link href="/configuracion#empresa" className="ghost-button min-h-9 flex-1 px-2 text-xs"><Building2 size={15} />Empresa</Link><Link href="/configuracion#suscripcion" className="ghost-button min-h-9 flex-1 px-2 text-xs"><CreditCard size={15} />Plan</Link></div>
        <form action={logoutAction} className="mt-1"><button type="submit" className="ghost-button min-h-9 w-full text-xs">Cerrar sesión</button></form>
      </div>
    </div>
  </div>;
}

function MobileBottomNavigation({ pathname, mobilePanel, onOpen }: { pathname: string; mobilePanel: MobilePanel; onOpen: (panel: Exclude<MobilePanel, null>, trigger: HTMLButtonElement) => void }) {
  const items = [primaryNavigation[0], primaryNavigation[2]];
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(23,33,30,0.08)] backdrop-blur lg:hidden" aria-label="Navegación móvil">
    <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-end px-1">
      {items.map((item) => <BottomLink key={item.href} item={item} pathname={pathname} />)}
      <button type="button" className="group flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-brand-strong" aria-label="Crear" aria-expanded={mobilePanel === "create"} onClick={(event) => onOpen("create", event.currentTarget)}><span className="flex h-11 w-11 -translate-y-2 items-center justify-center rounded-full bg-brand text-white shadow-soft transition group-active:scale-95"><Plus size={24} /></span><span className="-mt-2">Crear</span></button>
      <BottomLink item={primaryNavigation[5]} pathname={pathname} />
      <button type="button" className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", mobilePanel === "more" ? "text-brand-strong" : "text-content-secondary")} aria-label="Más módulos" aria-expanded={mobilePanel === "more"} onClick={(event) => onOpen("more", event.currentTarget)}><Ellipsis size={22} /><span>Más</span></button>
    </div>
  </nav>;
}

function BottomLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href); const Icon = item.icon;
  return <Link href={item.href} aria-current={active ? "page" : undefined} className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-brand-strong" : "text-content-secondary")}><Icon size={22} /><span>{item.label}</span></Link>;
}

function ActionGrid({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return <div className="grid grid-cols-2 gap-2 py-4 sm:grid-cols-3">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} className="flex min-h-24 flex-col items-start justify-between rounded-xl bg-subtle p-3 text-sm font-semibold text-content hover:bg-brand-soft"><Icon size={21} className="text-brand-strong" /><span>{label}</span></Link>)}</div>;
}

function PanelLink({ item, pathname, onNavigate, badge = 0, compact = false }: { item: NavItem; pathname: string; onNavigate?: () => void; badge?: number; compact?: boolean }) {
  const active = isActive(pathname, item.href); const Icon = item.icon;
  return <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={clsx("flex items-center gap-3 rounded-lg px-3 text-sm font-semibold transition", compact ? "min-h-9 py-1 text-xs" : "min-h-11 py-2", active ? "bg-brand-soft text-brand-strong" : "text-content-secondary hover:bg-subtle hover:text-content")}><Icon size={compact ? 17 : 19} /><span className="min-w-0 flex-1 truncate">{item.label}</span>{badge ? <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">{Math.min(badge, 99)}</span> : null}</Link>;
}

function currentTitle(pathname: string) {
  const match = titles.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.label ?? "Capataz";
}

function isActive(pathname: string, href: string) {
  const [base] = href.split(/[?#]/);
  return pathname === base || (base !== "/hoy" && pathname.startsWith(`${base}/`));
}
