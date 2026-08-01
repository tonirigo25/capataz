"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  Megaphone,
  MessageCircle,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

export type WorkTeamTone = "neutral" | "success" | "warning" | "danger";

export type WorkTeamSummary = {
  assignedPeople: number | null;
  assignedPeopleDetail?: string | null;
  assignedPeopleTone?: WorkTeamTone;
  coveredProfilesPercent: number | null;
  coveredProfilesDetail?: string | null;
  coveredProfilesTone?: WorkTeamTone;
  overloadedPeople: number | null;
  overloadedPeopleDetail?: string | null;
  overloadedPeopleTone?: WorkTeamTone;
  uncoveredCriticalProfiles: number | null;
  uncoveredCriticalProfilesDetail?: string | null;
  uncoveredCriticalProfilesTone?: WorkTeamTone;
  plannedHours: number | null;
  plannedHoursDetail?: string | null;
  plannedHoursTone?: WorkTeamTone;
  recordedHours: number | null;
  recordedHoursDetail?: string | null;
  recordedHoursTone?: WorkTeamTone;
};

export type WorkTeamPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role?: string | null;
  team?: string | null;
  availabilityLabel?: string | null;
  availabilityTone?: WorkTeamTone;
  statusLabel?: string | null;
  statusTone?: WorkTeamTone;
  href?: string | null;
};

export type WorkTeamLoad = {
  id: string;
  name: string;
  peopleCount?: number | null;
  loadPercent?: number | null;
  assignedHours?: number | null;
  plannedHours?: number | null;
  tone?: WorkTeamTone;
  statusLabel?: string | null;
};

export type WorkTeamShiftDay = {
  id: string;
  label: string;
  dateLabel?: string | null;
};

export type WorkTeamShiftRow = {
  id: string;
  label: string;
  timeLabel?: string | null;
  values: Array<number | string | null>;
};

export type WorkTeamSchedule = {
  periodLabel?: string | null;
  days: WorkTeamShiftDay[];
  rows: WorkTeamShiftRow[];
};

export type WorkTeamPartner = {
  id: string;
  companyName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  specialty?: string | null;
  peopleCount?: number | null;
  statusLabel?: string | null;
  statusTone?: WorkTeamTone;
  href?: string | null;
};

export type WorkTeamRequirement = {
  id: string;
  label: string;
  completedCount?: number | null;
  requiredCount?: number | null;
  percent?: number | null;
  statusLabel?: string | null;
  tone?: WorkTeamTone;
};

export type WorkTeamAccess = {
  id: string;
  label: string;
  currentCount?: number | null;
  requiredCount?: number | null;
  statusLabel?: string | null;
  tone?: WorkTeamTone;
};

export type WorkTeamApprover = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role?: string | null;
  responsibility?: string | null;
  href?: string | null;
};

export type WorkTeamNote = {
  id: string;
  author: string;
  avatarUrl?: string | null;
  createdAtLabel?: string | null;
  content: string;
  tagLabel?: string | null;
  tagTone?: WorkTeamTone;
  href?: string | null;
};

export type WorkTeamActionIcon = "announcement" | "calendar" | "message" | "settings" | "users";

export type WorkTeamAction = {
  label: string;
  href: string;
  icon?: WorkTeamActionIcon;
  variant?: "primary" | "secondary" | "link";
};

export type WorkTeamOverviewActions = {
  organization?: WorkTeamAction | null;
  allPeople?: WorkTeamAction | null;
  resourcePlan?: WorkTeamAction | null;
  calendar?: WorkTeamAction | null;
  subcontractors?: WorkTeamAction | null;
  training?: WorkTeamAction | null;
  accesses?: WorkTeamAction | null;
  approvals?: WorkTeamAction | null;
  addNote?: WorkTeamAction | null;
  communication?: WorkTeamAction[];
};

export type WorkTeamOverviewProps = {
  summary: WorkTeamSummary;
  people: WorkTeamPerson[];
  peopleTotal?: number | null;
  loads: WorkTeamLoad[];
  schedule: WorkTeamSchedule;
  subcontractors: WorkTeamPartner[];
  subcontractorsTotal?: number | null;
  requirements: WorkTeamRequirement[];
  accesses: WorkTeamAccess[];
  approvers: WorkTeamApprover[];
  notes: WorkTeamNote[];
  actions?: WorkTeamOverviewActions;
};

type MetricKind = "count" | "hours" | "percent";

const toneText: Record<WorkTeamTone, string> = {
  neutral: "text-content",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const toneDot: Record<WorkTeamTone, string> = {
  neutral: "bg-content-tertiary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const toneBadge: Record<WorkTeamTone, string> = {
  neutral: "bg-subtle text-content-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function tone(value?: WorkTeamTone): WorkTeamTone {
  return value ?? "neutral";
}

function safeHref(value: string | null | undefined) {
  return Boolean(value && (value.startsWith("/") || value.startsWith("https://")));
}

function safeImageUrl(value: string | null | undefined) {
  return Boolean(value && (value.startsWith("/") || value.startsWith("https://")));
}

export function WorkTeamOverview({
  summary,
  people,
  peopleTotal = null,
  loads,
  schedule,
  subcontractors,
  subcontractorsTotal = null,
  requirements,
  accesses,
  approvers,
  notes,
  actions = {},
}: WorkTeamOverviewProps) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const number = useMemo(() => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }), []);

  const teams = useMemo(
    () => Array.from(new Set(people.map((person) => person.team).filter((item): item is string => Boolean(item)))).sort((left, right) => left.localeCompare(right, "es")),
    [people],
  );
  const statuses = useMemo(
    () => Array.from(new Set(people.map((person) => person.statusLabel).filter((item): item is string => Boolean(item)))).sort((left, right) => left.localeCompare(right, "es")),
    [people],
  );
  const visiblePeople = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-ES");
    return people.filter((person) => {
      const matchesQuery = !normalized || `${person.name} ${person.role ?? ""} ${person.team ?? ""}`.toLocaleLowerCase("es-ES").includes(normalized);
      return matchesQuery && (teamFilter === "all" || person.team === teamFilter) && (statusFilter === "all" || person.statusLabel === statusFilter);
    });
  }, [people, query, statusFilter, teamFilter]);

  const formatMetric = (value: number | null, kind: MetricKind) => {
    if (!finite(value)) return "—";
    if (kind === "hours") return `${number.format(value)} h`;
    if (kind === "percent") return `${number.format(value)}%`;
    return number.format(value);
  };

  return (
    <section className="grid min-w-0 gap-3" aria-label="Resumen del equipo de obra">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores autorizados del equipo">
        <TeamMetric label="Personas asignadas" value={formatMetric(summary.assignedPeople, "count")} detail={summary.assignedPeopleDetail} toneValue={summary.assignedPeopleTone} />
        <TeamMetric label="Perfiles cubiertos" value={formatMetric(summary.coveredProfilesPercent, "percent")} detail={summary.coveredProfilesDetail} toneValue={summary.coveredProfilesTone} />
        <TeamMetric label="Sobrecarga detectada" value={formatMetric(summary.overloadedPeople, "count")} detail={summary.overloadedPeopleDetail} toneValue={summary.overloadedPeopleTone} />
        <TeamMetric label="Perfiles críticos sin cubrir" value={formatMetric(summary.uncoveredCriticalProfiles, "count")} detail={summary.uncoveredCriticalProfilesDetail} toneValue={summary.uncoveredCriticalProfilesTone} />
        <TeamMetric label="Horas planificadas" value={formatMetric(summary.plannedHours, "hours")} detail={summary.plannedHoursDetail} toneValue={summary.plannedHoursTone} />
        <TeamMetric label="Horas registradas" value={formatMetric(summary.recordedHours, "hours")} detail={summary.recordedHoursDetail} toneValue={summary.recordedHoursTone} />
      </section>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[1.08fr_.92fr_.98fr]">
        <TeamPanel title={`Miembros del equipo${finite(peopleTotal) ? ` (${number.format(peopleTotal)})` : ""}`} action={actions.organization}>
          <div className="grid gap-2 border-b border-border p-3 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem] xl:grid-cols-[minmax(9rem,1fr)_8rem_8rem]">
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} className="text-content-secondary" aria-hidden="true" /><span className="sr-only">Buscar persona</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none" placeholder="Buscar persona…" /></label>
            <label className="flex min-h-11 items-center rounded-lg border border-border px-2"><span className="sr-only">Filtrar por equipo</span><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none"><option value="all">Todos los equipos</option>{teams.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="flex min-h-11 items-center rounded-lg border border-border px-2"><span className="sr-only">Filtrar por estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none"><option value="all">Todos los estados</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <PeopleTable people={visiblePeople} />
          <PanelFooter action={actions.allPeople} />
        </TeamPanel>

        <TeamPanel title="Carga de trabajo por equipo">
          {loads.length ? <ul className="grid gap-4 p-3">{loads.map((load) => <LoadRow key={load.id} load={load} number={number} />)}</ul> : <HonestEmpty icon={UsersRound} text="No se ha recibido carga autorizada por equipo." />}
          <PanelFooter action={actions.resourcePlan} />
        </TeamPanel>

        <TeamPanel title="Próximos turnos" meta={schedule.periodLabel}>
          <ShiftTable schedule={schedule} />
          <PanelFooter action={actions.calendar} />
        </TeamPanel>
      </section>

      <section className="grid min-w-0 gap-3 xl:grid-cols-3">
        <TeamPanel title={`Subcontratas y colaboradores${finite(subcontractorsTotal) ? ` (${number.format(subcontractorsTotal)})` : ""}`} action={actions.subcontractors}>
          <PartnersTable partners={subcontractors} number={number} />
        </TeamPanel>

        <TeamPanel title="Certificaciones y formación" action={actions.training}>
          {requirements.length ? <ul className="grid gap-1 p-3">{requirements.map((requirement) => <RequirementRow key={requirement.id} requirement={requirement} number={number} />)}</ul> : <HonestEmpty icon={GraduationCap} text="No se han recibido requisitos de formación para esta obra." />}
        </TeamPanel>

        <TeamPanel title="Permisos y accesos" action={actions.accesses}>
          {accesses.length ? <ul className="grid gap-1 p-3">{accesses.map((access) => <AccessRow key={access.id} access={access} number={number} />)}</ul> : <HonestEmpty icon={KeyRound} text="No se han recibido permisos o accesos verificables." />}
        </TeamPanel>
      </section>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[1.08fr_1.12fr_.68fr]">
        <TeamPanel title="Responsables de aprobaciones" action={actions.approvals}>
          {approvers.length ? <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">{approvers.map((approver) => <ApproverCard key={approver.id} approver={approver} />)}</ul> : <HonestEmpty icon={ShieldCheck} text="No se han recibido responsables de aprobación." />}
        </TeamPanel>

        <TeamPanel title="Notas de coordinación" action={actions.addNote}>
          {notes.length ? <ul className="divide-y divide-border">{notes.map((note) => <NoteCard key={note.id} note={note} />)}</ul> : <HonestEmpty icon={ClipboardCheck} text="No hay notas de coordinación recibidas." />}
        </TeamPanel>

        <TeamPanel title="Comunicación rápida">
          {actions.communication?.length ? <div className="grid gap-2 p-3">{actions.communication.map((action) => <TeamActionLink key={`${action.label}-${action.href}`} action={{ ...action, variant: action.variant ?? "secondary" }} fullWidth />)}</div> : <HonestEmpty icon={MessageCircle} text="No hay acciones de comunicación autorizadas." />}
        </TeamPanel>
      </section>
    </section>
  );
}

function TeamMetric({ label, value, detail, toneValue }: { label: string; value: string; detail?: string | null; toneValue?: WorkTeamTone }) {
  const resolvedTone = tone(toneValue);
  return <article className="min-w-0 rounded-xl border border-border bg-surface p-3 shadow-soft"><span className="block truncate text-[9px] font-semibold text-content-secondary">{label}</span><strong className={`mt-2 block truncate text-xl font-black tabular-nums ${toneText[resolvedTone]}`} title={value}>{value}</strong><small className="mt-1 block min-h-4 text-[9px] leading-4 text-content-secondary">{detail?.trim() || "Sin detalle autorizado"}</small></article>;
}

function TeamPanel({ title, action, meta, children }: { title: string; action?: WorkTeamAction | null; meta?: string | null; children: React.ReactNode }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-3"><h2 className="text-xs font-black text-content">{title}</h2>{action ? <TeamActionLink action={{ ...action, variant: action.variant ?? "link" }} /> : meta ? <span className="text-[9px] font-semibold text-content-secondary">{meta}</span> : null}</header>
      {children}
    </article>
  );
}

function PeopleTable({ people }: { people: WorkTeamPerson[] }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable de miembros del equipo">
      <table className="w-full min-w-[43rem] text-left text-[10px]">
        <thead className="bg-subtle text-content-secondary"><tr><th scope="col" className="px-3 py-2">Persona</th><th scope="col" className="px-3 py-2">Rol / especialidad</th><th scope="col" className="px-3 py-2">Equipo</th><th scope="col" className="px-3 py-2">Disponibilidad</th><th scope="col" className="px-3 py-2">Estado</th></tr></thead>
        <tbody className="divide-y divide-border">{people.map((person) => <tr key={person.id} className="hover:bg-subtle/70"><td className="px-3 py-2"><span className="flex min-w-0 items-center gap-2"><Avatar name={person.name} url={person.avatarUrl} size="small" /><span className="min-w-0">{safeHref(person.href) ? <Link href={person.href!} className="block truncate font-bold text-content hover:underline">{person.name}</Link> : <strong className="block truncate text-content">{person.name}</strong>}</span></span></td><td className="px-3 py-2 text-content-secondary">{person.role ?? "—"}</td><td className="px-3 py-2 text-content-secondary">{person.team ?? "—"}</td><td className="px-3 py-2"><StatusLabel label={person.availabilityLabel} toneValue={person.availabilityTone} /></td><td className="px-3 py-2"><StatusLabel label={person.statusLabel} toneValue={person.statusTone} /></td></tr>)}</tbody>
      </table>
      {!people.length ? <div className="p-8 text-center text-[10px] text-content-secondary">No hay personas que coincidan con los filtros o no se recibieron registros.</div> : null}
    </div>
  );
}

function LoadRow({ load, number }: { load: WorkTeamLoad; number: Intl.NumberFormat }) {
  const resolvedTone = tone(load.tone);
  return (
    <li className="grid gap-2">
      <div className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate text-[10px] text-content">{load.name}</strong><small className="text-[8px] text-content-secondary">{finite(load.peopleCount) ? `${number.format(load.peopleCount)} personas` : "Personas sin informar"}</small></span><span className={`shrink-0 text-[10px] font-bold tabular-nums ${toneText[resolvedTone]}`}>{finite(load.loadPercent) ? `${number.format(load.loadPercent)}%` : "—"}</span></div>
      <div className="flex items-center gap-3"><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">{finite(load.loadPercent) ? <span className={`block h-full ${toneDot[resolvedTone]}`} style={{ width: `${Math.min(100, Math.max(0, load.loadPercent))}%` }} /> : null}</div><span className="w-20 shrink-0 text-right text-[8px] tabular-nums text-content-secondary">{finite(load.assignedHours) || finite(load.plannedHours) ? `${finite(load.assignedHours) ? number.format(load.assignedHours) : "—"} / ${finite(load.plannedHours) ? number.format(load.plannedHours) : "—"} h` : "Horas sin informar"}</span></div>
      {load.statusLabel ? <span className={`w-fit rounded-full px-2 py-1 text-[8px] font-bold ${toneBadge[resolvedTone]}`}>{load.statusLabel}</span> : null}
    </li>
  );
}

function ShiftTable({ schedule }: { schedule: WorkTeamSchedule }) {
  if (!schedule.days.length || !schedule.rows.length) return <HonestEmpty icon={CalendarDays} text="No se ha recibido una planificación de turnos verificable." />;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable de próximos turnos">
      <table className="w-full min-w-[36rem] text-center text-[9px]"><thead className="text-content-secondary"><tr><th scope="col" className="px-3 py-3 text-left">Turno</th>{schedule.days.map((day) => <th scope="col" key={day.id} className="px-2 py-3"><span className="block font-bold">{day.label}</span>{day.dateLabel ? <small className="mt-1 block text-[8px] font-normal">{day.dateLabel}</small> : null}</th>)}</tr></thead><tbody className="divide-y divide-border">{schedule.rows.map((row) => <tr key={row.id}><th scope="row" className="px-3 py-3 text-left"><strong className="block text-content">{row.label}</strong>{row.timeLabel ? <small className="text-[8px] font-normal text-content-secondary">{row.timeLabel}</small> : null}</th>{schedule.days.map((day, index) => <td key={`${row.id}-${day.id}`} className="px-2 py-3 font-semibold tabular-nums text-content">{row.values[index] ?? "—"}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

function PartnersTable({ partners, number }: { partners: WorkTeamPartner[]; number: Intl.NumberFormat }) {
  if (!partners.length) return <HonestEmpty icon={UsersRound} text="No se han recibido subcontratas o colaboradores vinculados." />;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable de subcontratas y colaboradores">
      <table className="w-full min-w-[36rem] text-left text-[9px]"><thead className="bg-subtle text-content-secondary"><tr><th scope="col" className="px-3 py-2">Empresa / contacto</th><th scope="col" className="px-3 py-2">Especialidad</th><th scope="col" className="px-3 py-2">Personas</th><th scope="col" className="px-3 py-2">Estado</th></tr></thead><tbody className="divide-y divide-border">{partners.map((partner) => <tr key={partner.id}><td className="px-3 py-2"><span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[tone(partner.statusTone)]}`} aria-hidden="true" /><span className="min-w-0">{safeHref(partner.href) ? <Link href={partner.href!} className="block truncate font-bold text-content hover:underline">{partner.companyName}</Link> : <strong className="block truncate text-content">{partner.companyName}</strong>}<small className="block truncate text-[8px] text-content-secondary">{[partner.contactName, partner.contactPhone].filter(Boolean).join(" · ") || "Contacto sin informar"}</small></span></span></td><td className="px-3 py-2 text-content-secondary">{partner.specialty ?? "—"}</td><td className="px-3 py-2 font-semibold tabular-nums text-content">{finite(partner.peopleCount) ? number.format(partner.peopleCount) : "—"}</td><td className="px-3 py-2"><StatusLabel label={partner.statusLabel} toneValue={partner.statusTone} /></td></tr>)}</tbody></table>
    </div>
  );
}

function RequirementRow({ requirement, number }: { requirement: WorkTeamRequirement; number: Intl.NumberFormat }) {
  const resolvedTone = tone(requirement.tone);
  return <li className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-3 border-b border-border py-2 last:border-0"><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{requirement.label}</strong>{requirement.statusLabel ? <small className="text-[8px] text-content-secondary">{requirement.statusLabel}</small> : null}</span><span className="text-[9px] tabular-nums text-content">{finite(requirement.completedCount) || finite(requirement.requiredCount) ? `${finite(requirement.completedCount) ? number.format(requirement.completedCount) : "—"} / ${finite(requirement.requiredCount) ? number.format(requirement.requiredCount) : "—"}` : "—"}</span><ProgressValue percent={requirement.percent} toneValue={resolvedTone} number={number} /></li>;
}

function AccessRow({ access, number }: { access: WorkTeamAccess; number: Intl.NumberFormat }) {
  const resolvedTone = tone(access.tone);
  return <li className="grid min-h-11 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-2 last:border-0"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${toneBadge[resolvedTone]}`}><KeyRound size={12} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{access.label}</strong>{access.statusLabel ? <small className="text-[8px] text-content-secondary">{access.statusLabel}</small> : null}</span><span className={`text-[9px] font-bold tabular-nums ${toneText[resolvedTone]}`}>{finite(access.currentCount) || finite(access.requiredCount) ? `${finite(access.currentCount) ? number.format(access.currentCount) : "—"} / ${finite(access.requiredCount) ? number.format(access.requiredCount) : "—"}` : "—"}</span></li>;
}

function ProgressValue({ percent, toneValue, number }: { percent?: number | null; toneValue: WorkTeamTone; number: Intl.NumberFormat }) {
  return <span className="grid grid-cols-[1fr_auto] items-center gap-2"><span className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">{finite(percent) ? <span className={`block h-full ${toneDot[toneValue]}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /> : null}</span><span className={`text-[8px] font-semibold tabular-nums ${toneText[toneValue]}`}>{finite(percent) ? `${number.format(percent)}%` : "—"}</span></span>;
}

function ApproverCard({ approver }: { approver: WorkTeamApprover }) {
  const content = <span className="flex min-w-0 items-start gap-2"><Avatar name={approver.name} url={approver.avatarUrl} /><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{approver.name}</strong><small className="block truncate text-[8px] text-content-secondary">{approver.role ?? "Rol sin informar"}</small>{approver.responsibility ? <span className="mt-1 block text-[8px] leading-4 text-content-secondary">{approver.responsibility}</span> : null}</span></span>;
  return <li>{safeHref(approver.href) ? <Link href={approver.href!} className="block rounded-lg p-2 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link> : <div className="p-2">{content}</div>}</li>;
}

function NoteCard({ note }: { note: WorkTeamNote }) {
  const resolvedTone = tone(note.tagTone);
  const content = <><div className="flex items-center gap-2"><Avatar name={note.author} url={note.avatarUrl} size="small" /><span className="min-w-0 text-[8px] text-content-secondary"><strong className="text-content">Nota de {note.author}</strong>{note.createdAtLabel ? ` · ${note.createdAtLabel}` : ""}</span></div><p className="mt-2 whitespace-pre-wrap text-[9px] leading-5 text-content-secondary">{note.content}</p>{note.tagLabel ? <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[8px] font-bold ${toneBadge[resolvedTone]}`}>{note.tagLabel}</span> : null}</>;
  return <li>{safeHref(note.href) ? <Link href={note.href!} className="block p-3 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">{content}</Link> : <article className="p-3">{content}</article>}</li>;
}

function StatusLabel({ label, toneValue }: { label?: string | null; toneValue?: WorkTeamTone }) {
  const resolvedTone = tone(toneValue);
  return label ? <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-content"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[resolvedTone]}`} aria-hidden="true" />{label}</span> : <span className="text-[9px] text-content-secondary">—</span>;
}

function PanelFooter({ action }: { action?: WorkTeamAction | null }) {
  return action ? <footer className="flex min-h-11 items-center justify-center border-t border-border px-3"><TeamActionLink action={{ ...action, variant: action.variant ?? "link" }} /></footer> : null;
}

function TeamActionLink({ action, fullWidth = false }: { action: WorkTeamAction; fullWidth?: boolean }) {
  if (!safeHref(action.href)) return null;
  const Icon = action.icon === "announcement" ? Megaphone : action.icon === "calendar" ? CalendarDays : action.icon === "settings" ? ShieldCheck : action.icon === "users" ? UsersRound : MessageCircle;
  const variant = action.variant ?? "link";
  const className = variant === "primary" ? "primary-button" : variant === "secondary" ? "secondary-button" : "inline-flex min-h-11 items-center text-[10px] font-bold text-brand-strong hover:underline";
  return <Link href={action.href} className={`${className} ${fullWidth ? "w-full justify-center" : ""}`}>{action.icon ? <Icon size={15} aria-hidden="true" /> : null}{action.label}</Link>;
}

function Avatar({ name, url, size = "regular" }: { name: string; url?: string | null; size?: "small" | "regular" }) {
  const dimensions = size === "small" ? "h-7 w-7" : "h-8 w-8";
  return safeImageUrl(url) ? <Image src={url!} alt={`Foto de ${name}`} width={40} height={40} unoptimized className={`${dimensions} shrink-0 rounded-full border border-border object-cover`} /> : <span className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong`}><UserRound size={size === "small" ? 13 : 15} aria-hidden="true" /><span className="sr-only">Sin fotografía registrada para {name}</span></span>;
}

function HonestEmpty({ icon: Icon, text }: { icon: typeof UsersRound; text: string }) {
  return <div className="flex min-h-28 flex-col items-center justify-center p-5 text-center"><Icon size={21} className="text-content-tertiary" aria-hidden="true" /><p className="mt-2 max-w-sm text-[10px] leading-5 text-content-secondary">{text}</p></div>;
}
