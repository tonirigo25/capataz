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
      <button type="button" className="secondary-button w-full sm:w-auto" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}>
        <Plus size={18} />
        Crear
      </button>

      {open ? (
        <div id={menuId} className="action-menu-panel top-full w-72">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-semibold text-content">Crear desde Hoy</p>
            <button type="button" className="icon-button h-8 w-8" aria-label="Cerrar menú crear" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-1">
            {createActions.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-content hover:bg-subtle" onClick={() => setOpen(false)}>
                <Icon size={18} className="text-brand-strong" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
