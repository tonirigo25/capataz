"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BellRing,
  Bot,
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Files,
  Handshake,
  HardHat,
  Home,
  Landmark,
  Lightbulb,
  Menu,
  Package,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  ListChecks,
  Workflow,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Operación",
    items: [
      { href: "/hoy", label: "Hoy", icon: Home },
      { href: "/alertas", label: "Alertas", icon: ShieldAlert },
      { href: "/recomendaciones", label: "Recomendaciones", icon: Lightbulb },
      { href: "/inteligencia", label: "Inteligencia", icon: BarChart3 },
      { href: "/tesoreria", label: "Tesorería", icon: Landmark },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/tareas", label: "Tareas", icon: ListChecks },
      { href: "/seguimientos", label: "Seguimientos", icon: Activity },
      { href: "/automatizaciones", label: "Automatizaciones", icon: Workflow },
      { href: "/actividad", label: "Actividad", icon: Activity },
      { href: "/capataz", label: "Capataz IA", icon: Bot }
    ]
  },
  {
    title: "Gestión",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/proveedores", label: "Proveedores", icon: Handshake },
      { href: "/subcontratas", label: "Subcontratas", icon: HardHat },
      { href: "/obras", label: "Obras", icon: BriefcaseBusiness },
      { href: "/presupuestos", label: "Presupuestos", icon: FileText },
      { href: "/dinero", label: "Facturas y cobros", icon: WalletCards },
      { href: "/facturas-proveedor", label: "Facturas proveedor", icon: ReceiptText },
      { href: "/facturas-subcontratas", label: "Facturas subcontrata", icon: Receipt },
      { href: "/gastos-materiales", label: "Gastos y materiales", icon: Package },
      { href: "/recordatorios", label: "Recordatorios", icon: Bell },
      { href: "/notificaciones", label: "Notificaciones", icon: BellRing },
      { href: "/documentos", label: "Documentos", icon: Files }
    ]
  },
  {
    title: "Sistema",
    items: [
      { href: "/buscar", label: "Buscador", icon: Search },
      { href: "/configuracion", label: "Configuración", icon: Settings }
    ]
  }
];

const quickActions = [
  { href: "/gestion?tipo=cliente&returnTo=/hoy", label: "Nuevo cliente", icon: Users },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/agenda", label: "Nueva visita", icon: CalendarDays },
  { href: "/gestion?tipo=presupuesto&returnTo=/presupuestos", label: "Nuevo presupuesto", icon: FileText },
  { href: "/gestion?tipo=factura&returnTo=/dinero", label: "Nueva factura", icon: Receipt },
  { href: "/gestion?tipo=pago&returnTo=/dinero", label: "Registrar pago", icon: WalletCards },
  { href: "/tesoreria#acciones", label: "Movimiento caja", icon: Landmark },
  { href: "/gestion?tipo=gasto&returnTo=/gastos-materiales", label: "Nuevo gasto", icon: Package },
  { href: "/gestion?tipo=material&returnTo=/gastos-materiales", label: "Nuevo material", icon: Package },
  { href: "/gestion?tipo=recordatorio&returnTo=/recordatorios", label: "Nuevo recordatorio", icon: Bell }
];

const titles = [
  ["/hoy", "Hoy"],
  ["/alertas", "Alertas"],
  ["/recomendaciones", "Recomendaciones"],
  ["/inteligencia", "Inteligencia"],
  ["/tesoreria", "Tesorería"],
  ["/agenda", "Agenda"],
  ["/tareas", "Tareas"],
  ["/seguimientos", "Seguimientos"],
  ["/automatizaciones", "Automatizaciones"],
  ["/actividad", "Actividad"],
  ["/clientes", "Clientes"],
  ["/proveedores", "Proveedores"],
  ["/subcontratas", "Subcontratas"],
  ["/obras", "Obras"],
  ["/documentos", "Documentos"],
  ["/presupuestos", "Presupuestos"],
  ["/dinero", "Facturas y cobros"],
  ["/facturas-proveedor", "Facturas de proveedor"],
  ["/facturas-subcontratas", "Facturas de subcontratas"],
  ["/gastos-materiales", "Gastos y materiales"],
  ["/recordatorios", "Recordatorios"],
  ["/notificaciones", "Notificaciones"],
  ["/buscar", "Buscador"],
  ["/capataz", "Capataz IA"],
  ["/configuracion", "Configuración"],
  ["/gestion", "Añadir o editar"]
];

export function AppChrome({ children, modeLabel, unreadNotifications, companyName, userName, logoutAction }: { children: ReactNode; modeLabel: string; unreadNotifications: number; companyName: string; userName: string; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const drawerId = useId();
  const actionsId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const title = useMemo(() => currentTitle(pathname), [pathname]);

  useEffect(() => {
    setDrawerOpen(false);
    setActionsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setActionsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white/95 backdrop-blur lg:block">
        <NavigationPanel modeLabel={modeLabel} pathname={pathname} unreadNotifications={unreadNotifications} companyName={companyName} userName={userName} logoutAction={logoutAction} onNavigate={() => undefined} />
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="icon-button lg:hidden"
              aria-label="Abrir menú principal"
              aria-controls={drawerId}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={21} />
            </button>
            <Link href="/hoy" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-obra-ink text-sm font-black text-obra-yellow sm:flex lg:hidden" aria-label="Ir a Hoy">
              C
            </Link>
            <div className="min-w-0">
              <p className="truncate text-lg font-black leading-tight text-obra-ink">{title}</p>
              <p className="truncate text-xs font-bold text-slate-500">{modeLabel}</p>
            </div>
          </div>

          <form action="/buscar" className="hidden min-w-0 max-w-md flex-1 lg:block">
            <label className="relative block">
              <span className="sr-only">Buscar en Capataz</span>
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input className="field min-h-10 rounded-full pl-10" name="q" placeholder="Buscar cliente, obra, factura..." />
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/buscar" className="icon-button lg:hidden" aria-label="Buscar">
              <Search size={20} />
            </Link>
            <Link href="/capataz" className="secondary-button hidden px-3 sm:inline-flex">
              <Bot size={18} />
              Capataz
            </Link>
            <Link href="/configuracion#perfil" className="icon-button" aria-label="Mi perfil">
              <UserRound size={20} />
            </Link>
            <Link href="/notificaciones" className="icon-button relative" aria-label={`Notificaciones${unreadNotifications ? `, ${unreadNotifications} sin leer` : ""}`}>
              <BellRing size={20} />
              {unreadNotifications ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-obra-red px-1 text-center text-[10px] font-black text-white">{Math.min(unreadNotifications, 99)}</span> : null}
            </Link>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" id={drawerId}>
          <button type="button" className="absolute inset-0 bg-obra-ink/55 backdrop-blur-sm" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,22rem)] bg-white shadow-card">
            <NavigationPanel modeLabel={modeLabel} pathname={pathname} unreadNotifications={unreadNotifications} companyName={companyName} userName={userName} logoutAction={logoutAction} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main className="relative">{children}</main>

      {actionsOpen ? (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 sm:left-auto sm:right-5 sm:w-80" id={actionsId}>
          <div className="card overflow-hidden p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-sm font-black text-obra-ink">Añadir rápido</p>
              <button type="button" className="icon-button h-9 w-9" aria-label="Cerrar acciones" onClick={() => setActionsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-1">
              {quickActions.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-obra-ink hover:bg-obra-yellow/15">
                  <Icon size={18} className="text-obra-yellowDark" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          className="primary-button min-h-12 rounded-full px-4 shadow-card"
          aria-controls={actionsId}
          aria-expanded={actionsOpen}
          onClick={() => setActionsOpen((open) => !open)}
        >
          <Plus size={20} />
          Añadir
        </button>
        <Link href="/capataz" className="secondary-button min-h-12 rounded-full border-obra-yellowDark bg-white px-4 shadow-card">
          <Bot size={20} />
          Capataz
        </Link>
      </div>
    </div>
  );
}

function NavigationPanel({ modeLabel, pathname, unreadNotifications, companyName, userName, logoutAction, onNavigate }: { modeLabel: string; pathname: string; unreadNotifications: number; companyName: string; userName: string; logoutAction: () => Promise<void>; onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Link href="/hoy" className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-ink text-base font-black text-obra-yellow" onClick={onNavigate} aria-label="Ir a Hoy">
            C
          </Link>
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-obra-ink">Capataz</p>
            <p className="truncate text-xs font-bold text-slate-500">{modeLabel}</p>
          </div>
          <button type="button" className="icon-button ml-auto lg:hidden" aria-label="Cerrar menú" onClick={onNavigate}>
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Navegación principal">
        <div className="grid gap-5">
          {navSections.map((section) => (
            <section key={section.title}>
              <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-normal text-slate-400">{section.title}</p>
              <div className="grid gap-1">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} badge={item.href === "/notificaciones" ? unreadNotifications : 0} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-black uppercase text-slate-500">Empresa</p>
          <p className="mt-1 truncate text-sm font-black text-obra-ink">{companyName}</p>
          <p className="truncate text-xs text-slate-500">{userName}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/configuracion#empresa" className="toolbar-chip justify-start text-xs" onClick={onNavigate}>
              <Building2 size={15} />
              Empresa
            </Link>
            <Link href="/configuracion#suscripcion" className="toolbar-chip justify-start text-xs" onClick={onNavigate}>
              <CreditCard size={15} />
              Plan
            </Link>
          </div>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="secondary-button w-full text-xs">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, pathname, onNavigate, badge = 0 }: { item: NavItem; pathname: string; onNavigate: () => void; badge?: number }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition",
        active ? "bg-obra-yellow text-obra-ink" : "text-slate-600 hover:bg-slate-100 hover:text-obra-ink"
      )}
    >
      <Icon size={19} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge ? <span className="rounded-full bg-obra-red px-2 py-0.5 text-[11px] font-black text-white">{Math.min(badge, 99)}</span> : null}
    </Link>
  );
}

function currentTitle(pathname: string) {
  const match = titles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? "Capataz";
}

function isActive(pathname: string, href: string) {
  const [base] = href.split("#");
  if (base === "/hoy") return pathname === "/hoy";
  return pathname === base || pathname.startsWith(`${base}/`);
}
