"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, BriefcaseBusiness, CalendarDays, FileText, Home, Landmark, ShieldAlert, Users, WalletCards } from "lucide-react";
import { clsx } from "clsx";

const items = [
  { href: "/hoy", label: "Inicio", icon: Home },
  { href: "/alertas", label: "Alertas", icon: ShieldAlert },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/obras", label: "Obras", icon: BriefcaseBusiness },
  { href: "/presupuestos", label: "Presup.", icon: FileText },
  { href: "/dinero", label: "Cobros", icon: WalletCards },
  { href: "/tesoreria", label: "Caja", icon: Landmark },
  { href: "/capataz", label: "Capataz", icon: Bot }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(31,36,40,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-9 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition",
                active ? "bg-obra-yellow text-obra-ink" : "text-slate-500 hover:bg-slate-100 hover:text-obra-ink"
              )}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
