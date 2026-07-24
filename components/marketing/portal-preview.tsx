"use client";

import { useState } from "react";
import { BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, Users, WalletCards } from "lucide-react";

const portals = {
  Propietario: { navigation: ["Hoy", "Clientes", "Ventas", "Operaciones", "Finanzas"], heading: "Decisiones conectadas", summary: "Prioridades, flujo y equipo en una única vista.", actions: ["Revisar previsión", "Ver actividad", "Consultar Orqena"], metric: "6 decisiones pendientes", icon: BarChart3 },
  Dirección: { navigation: ["Hoy", "Clientes", "Operaciones", "Agenda", "Equipo"], heading: "Ritmo de la operación", summary: "Riesgos, carga y trabajo coordinado por contexto.", actions: ["Ver bloqueos", "Abrir agenda", "Revisar equipo"], metric: "3 trabajos requieren atención", icon: BriefcaseBusiness },
  Comercial: { navigation: ["Mi día", "Clientes", "Presupuestos", "Agenda", "Tareas"], heading: "Relaciones que avanzan", summary: "Clientes, propuestas y seguimientos sin perder el hilo.", actions: ["Crear presupuesto", "Registrar seguimiento", "Preparar propuesta"], metric: "4 seguimientos para hoy", icon: Users },
  Finanzas: { navigation: ["Hoy", "Facturas", "Cobros", "Pagos", "Tesorería"], heading: "Control a tiempo", summary: "Vencimientos y tesorería con el contexto que los explica.", actions: ["Revisar vencimientos", "Abrir tesorería", "Consultar incidencias"], metric: "2 vencimientos esta semana", icon: WalletCards },
  Compras: { navigation: ["Mi día", "Solicitudes", "Proveedores", "Pedidos", "Documentos"], heading: "Compras en contexto", summary: "Solicitudes, proveedores y recepción conectados al trabajo.", actions: ["Ver solicitudes", "Registrar recepción", "Abrir proveedor"], metric: "5 solicitudes abiertas", icon: FileText },
  Responsable: { navigation: ["Mi día", "Trabajos", "Planificación", "Equipo", "Agenda"], heading: "Trabajo coordinado", summary: "Plan diario, avances y bloqueos del equipo asignado.", actions: ["Actualizar avance", "Ver planificación", "Asignar tarea"], metric: "2 bloqueos activos", icon: CheckCircle2 },
  Empleado: { navigation: ["Mi día", "Trabajos", "Tareas", "Agenda"], heading: "Lo necesario para avanzar", summary: "Las tareas, la agenda y los archivos del trabajo asignado.", actions: ["Ver mi tarea", "Registrar avance", "Abrir archivo"], metric: "3 tareas para hoy", icon: CalendarDays },
} as const;

type PortalName = keyof typeof portals;

export function PortalPreview() {
  const [selected, setSelected] = useState<PortalName>("Propietario");
  const portal = portals[selected];
  const Icon = portal.icon;
  return <section className="marketing-portal" aria-labelledby="portal-preview-title">
    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="marketing-eyebrow">Portales por persona</p><h2 id="portal-preview-title" className="marketing-title mt-3">Cada persona ve únicamente lo necesario para realizar su trabajo.</h2></div><p className="max-w-sm text-sm leading-6 text-[#d4e1d8]">La experiencia cambia con la responsabilidad, sin conectar esta demostración a datos de ninguna empresa.</p></div>
    <div className="mt-8 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Perfiles de portal">{(Object.keys(portals) as PortalName[]).map(name => <button key={name} className={selected === name ? "marketing-segment is-active" : "marketing-segment"} type="button" role="tab" aria-selected={selected === name} onClick={() => setSelected(name)}>{name}</button>)}</div>
    <div className="mt-6 grid overflow-hidden rounded-[1.75rem] bg-[#fbfaf5] shadow-[0_24px_70px_rgba(3,43,38,.24)] lg:grid-cols-[200px_1fr]">
      <aside className="border-b border-[#d9dfd4] bg-[#f1f2eb] p-4 lg:border-b-0 lg:border-r"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#093d35] font-black text-white">O</div><nav className="mt-8 space-y-1">{portal.navigation.map((item, index) => <span key={item} className={index === 0 ? "block rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#0b493f]" : "block px-3 py-2 text-sm text-content-secondary"}>{item}</span>)}</nav></aside>
      <div className="p-5 sm:p-8"><div className="flex items-start justify-between gap-5"><div><p className="text-sm font-semibold text-[#167366]">{selected}</p><h3 className="mt-2 text-2xl font-black tracking-tight text-[#102e29] sm:text-3xl">{portal.heading}</h3><p className="mt-2 max-w-md text-sm leading-6 text-content-secondary">{portal.summary}</p></div><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dcefe9] text-[#0b493f]"><Icon size={23} /></span></div><div className="mt-8 grid gap-3 md:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl bg-[#e8f1ec] p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#377067]">Hoy</p><p className="mt-4 text-xl font-black text-[#133d36]">{portal.metric}</p><div className="mt-6 flex h-14 items-end gap-2">{[32, 52, 40, 76, 58, 90, 66].map((height, index) => <span key={index} style={{ height: `${height}%` }} className="w-full rounded-t bg-[#167366] opacity-[.25]" />)}</div></div><div className="rounded-2xl border border-[#dce3df] p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-content-secondary">Acciones</p><ul className="mt-4 space-y-3">{portal.actions.map(action => <li key={action} className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={16} className="text-[#167366]" />{action}</li>)}</ul></div></div></div>
    </div>
  </section>;
}
