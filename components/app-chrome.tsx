"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  Menu,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/hoy", label: "Inicio", icon: Home },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/obras", label: "Obras", icon: BriefcaseBusiness },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/dinero", label: "Facturas y Cobros", icon: WalletCards },
  { href: "/gastos-materiales", label: "Gastos y Materiales", icon: Package },
  { href: "/recordatorios", label: "Recordatorios", icon: Bell },
  { href: "/buscar", label: "Buscador", icon: Search },
  { href: "/capataz", label: "Capataz IA", icon: Bot },
  { href: "/configuracion", label: "Configuración", icon: Settings },
  { href: "/configuracion#sistema", label: "Estado del sistema", icon: Settings },
  { href: "/configuracion#perfil", label: "Mi perfil", icon: UserRound },
  { href: "/configuracion#empresa", label: "Datos de empresa", icon: Building2 },
  { href: "/configuracion#suscripcion", label: "Suscripción", icon: CreditCard }
];

const quickActions = [
  { href: "/gestion?tipo=cliente&returnTo=/hoy", label: "Nuevo cliente", icon: Users },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/agenda", label: "Nueva visita", icon: CalendarDays },
  { href: "/gestion?tipo=presupuesto&returnTo=/presupuestos", label: "Nuevo presupuesto", icon: FileText },
  { href: "/gestion?tipo=factura&returnTo=/dinero", label: "Nueva factura", icon: Receipt },
  { href: "/gestion?tipo=pago&returnTo=/dinero", label: "Registrar pago", icon: WalletCards },
  { href: "/gestion?tipo=gasto&returnTo=/gastos-materiales", label: "Nuevo gasto", icon: Package },
  { href: "/gestion?tipo=material&returnTo=/gastos-materiales", label: "Nuevo material", icon: Package },
  { href: "/gestion?tipo=recordatorio&returnTo=/recordatorios", label: "Nuevo recordatorio", icon: Bell }
];

const titles = [
  ["/hoy", "Inicio"],
  ["/agenda", "Agenda"],
  ["/clientes", "Clientes"],
  ["/obras", "Obras"],
  ["/presupuestos", "Presupuestos"],
  ["/dinero", "Facturas y Cobros"],
  ["/gastos-materiales", "Gastos y Materiales"],
  ["/recordatorios", "Recordatorios"],
  ["/buscar", "Buscador"],
  ["/capataz", "Capataz IA"],
  ["/configuracion", "Configuración"],
  ["/gestion", "Añadir / Editar"]
];

export function AppChrome({ children, modeLabel }: { children: ReactNode; modeLabel: string }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const title = useMemo(() => currentTitle(pathname), [pathname]);

  return (
    <div className="min-h-dvh lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <DrawerContent modeLabel={modeLabel} pathname={pathname} onNavigate={() => undefined} />
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="icon-button shrink-0 lg:hidden" aria-label="Abrir menú" onClick={() => setDrawerOpen(true)}>
              <Menu size={21} />
            </button>
            <Link href="/hoy" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-obra-ink text-sm font-black text-obra-yellow sm:flex lg:hidden">
              C
            </Link>
            <div className="min-w-0">
              <p className="truncate text-lg font-black leading-tight text-obra-ink">{title}</p>
              <p className="truncate text-xs font-semibold text-slate-500">{modeLabel}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/buscar" className="icon-button" aria-label="Buscar">
              <Search size={20} />
            </Link>
            <Link href="/capataz" className="secondary-button hidden px-3 sm:inline-flex">
              <Bot size={18} />
              Capataz
            </Link>
            <Link href="/capataz" className="icon-button sm:hidden" aria-label="Capataz IA">
              <Bot size={20} />
            </Link>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-obra-ink/50" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(86vw,21rem)] bg-white shadow-card">
            <DrawerContent modeLabel={modeLabel} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main>{children}</main>

      {actionsOpen ? (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 sm:left-auto sm:right-5 sm:w-80">
          <div className="card overflow-hidden p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-sm font-black text-obra-ink">Añadir rápido</p>
              <button type="button" className="icon-button h-9 w-9" aria-label="Cerrar acciones" onClick={() => setActionsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-1">
              {quickActions.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-obra-ink hover:bg-obra-yellow/15" onClick={() => setActionsOpen(false)}>
                  <Icon size={18} className="text-obra-yellowDark" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 flex flex-col items-end gap-2">
        <button type="button" className="primary-button min-h-12 rounded-full px-4 shadow-card" onClick={() => setActionsOpen((open) => !open)}>
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

function DrawerContent({ modeLabel, pathname, onNavigate }: { modeLabel: string; pathname: string; onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Link href="/hoy" className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-ink text-base font-black text-obra-yellow" onClick={onNavigate}>
            C
          </Link>
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-obra-ink">Capataz</p>
            <p className="truncate text-xs font-semibold text-slate-500">{modeLabel}</p>
          </div>
          <button type="button" className="icon-button ml-auto lg:hidden" aria-label="Cerrar menú" onClick={onNavigate}>
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={clsx(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition",
                  active ? "bg-obra-yellow text-obra-ink" : "text-slate-600 hover:bg-slate-100 hover:text-obra-ink"
                )}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function currentTitle(pathname: string) {
  const match = titles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? "Capataz";
}

function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  const [base] = href.split("#");
  if (base === "/hoy") return pathname === "/hoy";
  return pathname === base || pathname.startsWith(`${base}/`);
}
