"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, CalendarDays, Filter, Package, Search, UserRound, UsersRound } from "lucide-react";

export type WorkloadTask = {
  id: string;
  title: string;
  status: string;
  assigneeName: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  startsAt: string | null;
  dueAt: string | null;
};

export type WorkResourcePerson = {
  id: string;
  name: string;
  role: string;
  taskCount: number;
  plannedMinutes: number;
  actualMinutes: number;
};

export type WorkResourceMaterial = {
  id: string;
  name: string;
  status: string;
  quantity: string;
};

function hours(minutes: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(minutes / 60);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function LoadMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "warning" | "success" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-content";
  return <article className="rounded-xl border border-border bg-surface p-3"><span className="text-[9px] font-semibold uppercase tracking-wide text-content-tertiary">{label}</span><strong className={`mt-2 block text-xl font-black tabular-nums ${toneClass}`}>{value}</strong><small className="mt-1 block text-[9px] text-content-secondary">{detail}</small></article>;
}

export function WorkPlanningLoad({ workId, tasks }: { workId: string; tasks: WorkloadTask[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => {
    const grouped = new Map<string, { name: string; planned: number; actual: number; tasks: WorkloadTask[] }>();
    for (const task of tasks) {
      const name = task.assigneeName ?? "Sin asignar";
      const row = grouped.get(name) ?? { name, planned: 0, actual: 0, tasks: [] };
      row.planned += task.estimatedMinutes ?? 0;
      row.actual += task.actualMinutes ?? 0;
      row.tasks.push(task);
      grouped.set(name, row);
    }
    return Array.from(grouped.values()).filter((row) => row.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")) && (status === "all" || row.tasks.some((task) => task.status === status)));
  }, [query, status, tasks]);
  const assigned = tasks.filter((task) => task.assigneeName);
  const planned = assigned.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  const actual = assigned.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const unassigned = tasks.filter((task) => !task.assigneeName).length;

  return <div className="grid gap-3">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-content">Carga de trabajo</h2><p className="mt-1 text-xs text-content-secondary">Horas y tareas registradas por responsable. La capacidad laboral no se supone.</p></div><Link href={`/tareas?filtro=team&workId=${workId}`} className="secondary-button"><CalendarDays size={16} aria-hidden="true" /> Gestionar tareas</Link></header>
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores de carga registrados">
      <LoadMetric label="Personas asignadas" value={String(new Set(assigned.map((task) => task.assigneeName)).size)} detail="Responsables con tareas" />
      <LoadMetric label="Horas planificadas" value={`${hours(planned)} h`} detail="Estimación registrada" />
      <LoadMetric label="Horas registradas" value={`${hours(actual)} h`} detail="Tiempo real informado" tone="success" />
      <LoadMetric label="Sin asignar" value={String(unassigned)} detail="Tareas pendientes de responsable" tone={unassigned ? "warning" : "success"} />
      <LoadMetric label="Bloqueadas" value={String(blocked)} detail="Estado persistido" tone={blocked ? "warning" : "success"} />
    </section>
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-border px-3"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar responsable</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none" placeholder="Buscar responsable…" /></label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"><Filter size={16} aria-hidden="true" /><span className="sr-only">Filtrar carga por estado</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="border-0 bg-transparent text-xs outline-none"><option value="all">Todos los estados</option><option value="planned">Planificadas</option><option value="in_progress">En curso</option><option value="blocked">Bloqueadas</option><option value="completed">Completadas</option></select></label>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="Carga registrada por responsable" tabIndex={0}>
        <table className="w-full min-w-[48rem] border-collapse text-[11px]"><thead><tr className="border-b border-border bg-subtle text-left text-content-secondary"><th className="p-3">Responsable</th><th className="p-3">Tareas</th><th className="p-3">Planificado</th><th className="p-3">Registrado</th><th className="p-3">Estados</th><th className="p-3">Capacidad</th><th className="p-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.name}><td className="p-3"><span className="flex items-center gap-2"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-strong"><UserRound size={15} aria-hidden="true" /></span><strong className="text-content">{row.name}</strong></span></td><td className="p-3 font-semibold text-content">{row.tasks.length}</td><td className="p-3 tabular-nums text-content">{hours(row.planned)} h</td><td className="p-3 tabular-nums text-content">{hours(row.actual)} h</td><td className="p-3"><span className="line-clamp-2 text-content-secondary">{Array.from(new Set(row.tasks.map((task) => statusLabel(task.status)))).join(" · ")}</span></td><td className="p-3"><span className="rounded-full bg-subtle px-2 py-1 text-[9px] font-semibold text-content-secondary">No registrada</span></td><td className="p-3 text-right"><Link href={`/tareas?filtro=team&workId=${workId}`} className="inline-flex min-h-11 items-center font-semibold text-brand-strong hover:underline">Ver tareas</Link></td></tr>)}{rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-content-secondary">No hay asignaciones que coincidan con los filtros.</td></tr> : null}</tbody></table>
      </div>
      <p className="border-t border-border p-3 text-[10px] text-content-secondary"><AlertTriangle size={13} className="mr-1 inline" aria-hidden="true" />No se calcula sobrecarga ni disponibilidad sin jornada y capacidad persistidas.</p>
    </section>
  </div>;
}

export function WorkPlanningResources({ workId, people, materials, canManage }: { workId: string; people: WorkResourcePerson[]; materials: WorkResourceMaterial[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const normalized = query.toLocaleLowerCase("es");
  const visiblePeople = people.filter((item) => item.name.toLocaleLowerCase("es").includes(normalized));
  const visibleMaterials = materials.filter((item) => item.name.toLocaleLowerCase("es").includes(normalized));
  const pendingMaterials = materials.filter((item) => ["pendiente", "falta", "en_transito"].includes(item.status)).length;
  return <div className="grid gap-3">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-content">Recursos de obra</h2><p className="mt-1 text-xs text-content-secondary">Personas y materiales vinculados a esta obra, sin disponibilidad o costes supuestos.</p></div>{canManage ? <Link href={`/tareas?filtro=team&workId=${workId}`} className="primary-button"><UsersRound size={16} aria-hidden="true" /> Gestionar asignaciones</Link> : null}</header>
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><LoadMetric label="Personas vinculadas" value={String(people.length)} detail="Responsables y asignaciones" /><LoadMetric label="Materiales" value={String(materials.length)} detail="Registros de la obra" /><LoadMetric label="Pendientes" value={String(pendingMaterials)} detail="Falta, pendiente o en tránsito" tone={pendingMaterials ? "warning" : "success"} /><LoadMetric label="Maquinaria y subcontratas" value="—" detail="Inventario no persistido" /></section>
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border p-3"><label className="flex min-h-11 max-w-xl items-center gap-2 rounded-lg border border-border px-3"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar recurso</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none" placeholder="Buscar persona o material…" /></label></div>
      <ResourceGroup title={`Personal (${visiblePeople.length})`} icon={UsersRound}>{visiblePeople.map((person) => <ResourceRow key={person.id} icon={UserRound} name={person.name} type={person.role} assignment={`${person.taskCount} tareas`} quantity={`${hours(person.plannedMinutes)} h planificadas`} state={person.actualMinutes ? `${hours(person.actualMinutes)} h registradas` : "Sin horas registradas"} href={`/tareas?filtro=team&workId=${workId}`} />)}</ResourceGroup>
      <ResourceGroup title={`Materiales (${visibleMaterials.length})`} icon={Boxes}>{visibleMaterials.map((material) => <ResourceRow key={material.id} icon={Package} name={material.name} type="Material" assignment={`${material.quantity} registrado`} quantity="Coste no disponible" state={statusLabel(material.status)} href={`/obras/${workId}/costes/materiales`} />)}</ResourceGroup>
      <ResourceGroup title="Maquinaria (0)" icon={Package}><p className="px-4 py-3 text-[10px] text-content-secondary">No existe inventario de maquinaria vinculado a esta obra.</p></ResourceGroup>
      <ResourceGroup title="Subcontratas (0)" icon={UsersRound}><p className="px-4 py-3 text-[10px] text-content-secondary">No existe una asignación de subcontrata persistida en planificación.</p></ResourceGroup>
    </section>
  </div>;
}

function ResourceGroup({ title, icon: Icon, children }: { title: string; icon: typeof UsersRound; children: React.ReactNode }) {
  return <section className="border-b border-border last:border-0"><h3 className="flex min-h-10 items-center gap-2 bg-subtle px-4 text-xs font-bold text-content"><Icon size={15} aria-hidden="true" />{title}</h3>{children}</section>;
}

function ResourceRow({ icon: Icon, name, type, assignment, quantity, state, href }: { icon: typeof UserRound; name: string; type: string; assignment: string; quantity: string; state: string; href: string }) {
  return <article className="grid min-h-14 grid-cols-[minmax(10rem,1.4fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto] items-center gap-3 border-t border-border px-4 py-2 text-[10px] first:border-t-0"><span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"><Icon size={15} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{name}</strong><small className="text-content-secondary">{type}</small></span></span><span className="text-content-secondary">{assignment}</span><span className="text-content-secondary">{quantity}</span><span className="font-semibold text-content">{state}</span><Link href={href} className="inline-flex min-h-11 items-center font-semibold text-brand-strong hover:underline">Ver detalle</Link></article>;
}
