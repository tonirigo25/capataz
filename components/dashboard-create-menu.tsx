"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, FileText, Package, Plus, Receipt, Users, WalletCards, X } from "lucide-react";

const createActions = [
  { href: "/gestion?tipo=cliente&returnTo=/hoy", label: "Cliente", icon: Users },
  { href: "/gestion?tipo=obra&returnTo=/hoy", label: "Obra", icon: BriefcaseBusiness },
  { href: "/gestion?tipo=presupuesto&returnTo=/hoy", label: "Presupuesto", icon: FileText },
  { href: "/gestion?tipo=factura&returnTo=/hoy", label: "Factura", icon: Receipt },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/hoy", label: "Visita", icon: CalendarDays },
  { href: "/gestion?tipo=gasto&returnTo=/hoy", label: "Gasto", icon: Package },
  { href: "/gestion?tipo=pago&returnTo=/hoy", label: "Pago", icon: WalletCards }
];

export function DashboardCreateMenu() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button type="button" className="primary-button w-full sm:w-auto" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}>
        <Plus size={18} />
        Crear
      </button>

      {open ? (
        <div id={menuId} className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-card">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-black text-obra-ink">Crear desde Hoy</p>
            <button type="button" className="icon-button h-8 w-8" aria-label="Cerrar menú crear" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-1">
            {createActions.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-obra-ink hover:bg-obra-yellow/15" onClick={() => setOpen(false)}>
                <Icon size={18} className="text-obra-yellowDark" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
