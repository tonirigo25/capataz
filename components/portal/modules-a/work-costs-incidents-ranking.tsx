"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileBarChart2,
  Filter,
  ListOrdered,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

export type WorkCostTone = "neutral" | "info" | "success" | "warning" | "danger";

export type WorkCostIncident = {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  type?: string | null;
  impactAmount?: number | null;
  impactLabel?: string | null;
  priority?: string | null;
  priorityTone?: WorkCostTone;
  status?: string | null;
  statusTone?: WorkCostTone;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  detectedAt?: string | null;
  detailHref?: string | null;
};

export type WorkCostImpactBreakdown = {
  id: string;
  label: string;
  amount: number;
  tone?: WorkCostTone;
};

export type WorkCostIncidentSummary = {
  totalImpact?: number | null;
  budgetRemainingPercent?: number | null;
  updatedAt?: string | null;
  breakdown?: WorkCostImpactBreakdown[];
  detailHref?: string | null;
};

export type WorkCostRankingMetric = {
  id: string;
  label: string;
  value: string | number | null;
  format?: WorkCostValueFormat;
  detail?: string | null;
  detailTone?: WorkCostTone;
  progressPercent?: number | null;
};

export type WorkCostValueFormat = "text" | "number" | "currency" | "percent";

export type WorkCostRankingCell = {
  value: string | number | null;
  format?: WorkCostValueFormat;
  detail?: string | null;
  tone?: WorkCostTone;
  progressPercent?: number | null;
};

export type WorkCostRankingColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type WorkCostRankingRow = {
  id: string;
  rank?: number | null;
  code?: string | null;
  label: string;
  detail?: string | null;
  cells: Record<string, WorkCostRankingCell | undefined>;
  detailHref?: string | null;
};

export type WorkCostRankingGroup = {
  id: string;
  positionLabel?: string | null;
  title: string;
  columns: WorkCostRankingColumn[];
  rows: WorkCostRankingRow[];
  detailHref?: string | null;
  detailLabel?: string | null;
  width?: "compact" | "wide";
};

type SharedProps = {
  currency?: string;
  className?: string;
};

export type WorkCostIncidentsProps = SharedProps & {
  mode: "incidents";
  incidents: WorkCostIncident[];
  summary?: WorkCostIncidentSummary | null;
  exportHref?: string | null;
  reportHref?: string | null;
  createHref?: string | null;
};

export type WorkCostRankingProps = SharedProps & {
  mode: "ranking";
  title?: string;
  description?: string;
  metrics: WorkCostRankingMetric[];
  groups: WorkCostRankingGroup[];
  configureHref?: string | null;
  exportHref?: string | null;
};

export type WorkCostsIncidentsRankingProps = WorkCostIncidentsProps | WorkCostRankingProps;

type IncidentFilters = {
  query: string;
  type: string;
  status: string;
  priority: string;
  responsible: string;
};

const emptyFilters: IncidentFilters = { query: "", type: "", status: "", priority: "", responsible: "" };

export function WorkCostsIncidentsRanking(props: WorkCostsIncidentsRankingProps) {
  return props.mode === "incidents" ? <IncidentsView {...props} /> : <RankingView {...props} />;
}

function IncidentsView({
  incidents,
  summary,
  currency = "EUR",
  exportHref,
  reportHref,
  createHref,
  className = "",
}: WorkCostIncidentsProps) {
  const [filters, setFilters] = useState<IncidentFilters>(emptyFilters);
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const filterOptions = useMemo(() => ({
    types: uniqueValues(incidents.map((incident) => incident.type)),
    statuses: uniqueValues(incidents.map((incident) => incident.status)),
    priorities: uniqueValues(incidents.map((incident) => incident.priority)),
    responsibles: uniqueValues(incidents.map((incident) => incident.responsibleName)),
  }), [incidents]);
  const visibleIncidents = useMemo(() => {
    const query = normalize(filters.query);
    return incidents.filter((incident) => {
      const searchable = normalize([
        incident.code,
        incident.title,
        incident.description,
        incident.type,
        incident.responsibleName,
      ].filter(Boolean).join(" "));
      return (!query || searchable.includes(query))
        && (!filters.type || incident.type === filters.type)
        && (!filters.status || incident.status === filters.status)
        && (!filters.priority || incident.priority === filters.priority)
        && (!filters.responsible || incident.responsibleName === filters.responsible);
    });
  }, [filters, incidents]);
  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby="cost-incidents-title">
      <div className={`grid min-w-0 gap-4 ${summary ? "xl:grid-cols-[minmax(0,1fr)_21.5rem] xl:items-end" : ""}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="cost-incidents-title" className="text-xl font-black text-content">Todas las incidencias</h2>
            <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-subtle px-2 text-[10px] font-bold text-content-secondary">{incidents.length}</span>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-content-secondary">Registros económicos recibidos para esta obra. Los estados, prioridades y responsables se muestran únicamente cuando están informados.</p>
        </div>
        {summary ? <IncidentImpactSummary summary={summary} money={money} /> : null}
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="grid gap-3 border-b border-border p-3 lg:grid-cols-[minmax(15rem,1fr)_auto] lg:items-center">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar incidencia</span>
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none"
              placeholder="Buscar por código, título, tipo o responsable…"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {exportHref ? <ActionLink href={exportHref} icon={Download} label="Exportar" /> : null}
            {reportHref ? <ActionLink href={reportHref} icon={FileBarChart2} label="Ver informe" /> : null}
            {createHref ? <ActionLink href={createHref} icon={Plus} label="Nueva incidencia" primary /> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border p-3" aria-label="Filtros de incidencias">
          <FilterSelect label="Tipo" value={filters.type} options={filterOptions.types} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} />
          <FilterSelect label="Estado" value={filters.status} options={filterOptions.statuses} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
          <FilterSelect label="Prioridad" value={filters.priority} options={filterOptions.priorities} onChange={(value) => setFilters((current) => ({ ...current, priority: value }))} />
          <FilterSelect label="Responsable" value={filters.responsible} options={filterOptions.responsibles} onChange={(value) => setFilters((current) => ({ ...current, responsible: value }))} />
          {filtersActive ? (
            <button type="button" onClick={() => setFilters(emptyFilters)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] font-bold text-content-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <Filter size={15} aria-hidden="true" /> Limpiar filtros
            </button>
          ) : null}
        </div>

        <p className="sr-only" aria-live="polite">{visibleIncidents.length} incidencias visibles de {incidents.length}.</p>
        {visibleIncidents.length ? (
          <>
            <IncidentDesktopTable incidents={visibleIncidents} money={money} />
            <IncidentMobileList incidents={visibleIncidents} money={money} />
            <p className="border-t border-border px-4 py-3 text-[10px] text-content-secondary">Mostrando {visibleIncidents.length} de {incidents.length} incidencias recibidas.</p>
          </>
        ) : <EmptyState icon={AlertTriangle} title="No hay incidencias para estos filtros" detail="Cambia los filtros para revisar los registros recibidos." />}
      </div>
    </section>
  );
}

function IncidentImpactSummary({ summary, money }: { summary: WorkCostIncidentSummary; money: Intl.NumberFormat }) {
  const breakdown = (summary.breakdown ?? []).filter((item) => Number.isFinite(item.amount));
  const breakdownTotal = breakdown.reduce((total, item) => total + item.amount, 0);
  return (
    <article className="rounded-xl border border-border bg-surface p-4" aria-label="Impacto acumulado recibido">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-content-secondary">Impacto acumulado</span>
          <strong className="mt-2 block text-2xl font-black tabular-nums text-content">{formatValue(summary.totalImpact, "currency", money)}</strong>
          <span className="mt-1 block text-[10px] text-content-secondary">{finite(summary.budgetRemainingPercent) ? `${formatPercent(summary.budgetRemainingPercent)} del presupuesto restante` : "Porcentaje no informado"}</span>
        </div>
        {summary.updatedAt ? <time className="text-right text-[9px] text-content-tertiary" dateTime={summary.updatedAt}>Actualizado {formatDate(summary.updatedAt)}</time> : null}
      </div>
      {breakdown.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
            {breakdown.map((item) => <div key={item.id} className="min-w-0"><span className="block truncate text-[9px] text-content-secondary">{item.label}</span><strong className={`mt-1 block truncate text-xs tabular-nums ${toneText(item.tone)}`} title={money.format(item.amount)}>{money.format(item.amount)}</strong></div>)}
          </div>
          {breakdownTotal > 0 ? <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">{breakdown.map((item) => <span key={item.id} className={toneBar(item.tone)} style={{ width: `${Math.max(0, (item.amount / breakdownTotal) * 100)}%` }} />)}</div> : null}
        </div>
      ) : null}
      {summary.detailHref ? <Link href={summary.detailHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-between border-t border-border pt-3 text-[10px] font-bold text-content hover:text-brand-strong">Ver análisis detallado <span aria-hidden="true">›</span></Link> : null}
    </article>
  );
}

function IncidentDesktopTable({ incidents, money }: { incidents: WorkCostIncident[]; money: Intl.NumberFormat }) {
  return (
    <div className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Tabla desplazable de incidencias de costes">
      <table className="w-full min-w-[66rem] border-collapse text-left text-[10px]">
        <thead className="bg-subtle text-content-secondary"><tr><TableHead>ID</TableHead><TableHead>Incidencia</TableHead><TableHead>Tipo</TableHead><TableHead align="right">Impacto económico</TableHead><TableHead>Prioridad</TableHead><TableHead>Estado</TableHead><TableHead>Responsable</TableHead><TableHead>Detectada</TableHead><TableHead align="right">Acciones</TableHead></tr></thead>
        <tbody className="divide-y divide-border">{incidents.map((incident) => <IncidentDesktopRow key={incident.id} incident={incident} money={money} />)}</tbody>
      </table>
    </div>
  );
}

function IncidentDesktopRow({ incident, money }: { incident: WorkCostIncident; money: Intl.NumberFormat }) {
  return (
    <tr className="hover:bg-subtle/70">
      <td className="px-3 py-3 font-bold text-content">{incident.code ?? "—"}</td>
      <td className="max-w-[18rem] px-3 py-3"><strong className="block text-content">{incident.title}</strong>{incident.description ? <span className="mt-1 block text-[9px] leading-4 text-content-secondary">{incident.description}</span> : null}</td>
      <td className="px-3 py-3">{incident.type ? <Badge label={incident.type} /> : <MissingValue />}</td>
      <td className="px-3 py-3 text-right"><strong className="block tabular-nums text-content">{formatValue(incident.impactAmount, "currency", money)}</strong>{incident.impactLabel ? <span className="mt-1 block text-[9px] text-content-secondary">{incident.impactLabel}</span> : null}</td>
      <td className="px-3 py-3">{incident.priority ? <Badge label={incident.priority} tone={incident.priorityTone} /> : <MissingValue />}</td>
      <td className="px-3 py-3">{incident.status ? <Badge label={incident.status} tone={incident.statusTone} /> : <MissingValue />}</td>
      <td className="px-3 py-3"><Responsible incident={incident} /></td>
      <td className="px-3 py-3 text-content-secondary">{incident.detectedAt ? formatDate(incident.detectedAt) : "—"}</td>
      <td className="px-3 py-3 text-right">{incident.detailHref ? <Link href={incident.detailHref} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-brand px-3 font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Ver detalle</Link> : <MissingValue />}</td>
    </tr>
  );
}

function IncidentMobileList({ incidents, money }: { incidents: WorkCostIncident[]; money: Intl.NumberFormat }) {
  return (
    <div className="divide-y divide-border md:hidden" role="list">
      {incidents.map((incident) => (
        <article key={incident.id} role="listitem" className="p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-bold text-content-tertiary">{incident.code ?? "Sin código"}</span><h3 className="mt-1 text-sm font-bold leading-5 text-content">{incident.title}</h3>{incident.description ? <p className="mt-1 text-[10px] leading-4 text-content-secondary">{incident.description}</p> : null}</div><strong className="shrink-0 text-xs tabular-nums text-content">{formatValue(incident.impactAmount, "currency", money)}</strong></div>
          <div className="mt-3 flex flex-wrap gap-2">{incident.type ? <Badge label={incident.type} /> : null}{incident.priority ? <Badge label={incident.priority} tone={incident.priorityTone} /> : null}{incident.status ? <Badge label={incident.status} tone={incident.statusTone} /> : null}</div>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[10px]"><MobileFact label="Responsable" value={incident.responsibleName ?? "No informado"} /><MobileFact label="Detectada" value={incident.detectedAt ? formatDate(incident.detectedAt) : "No informada"} /></dl>
          {incident.detailHref ? <Link href={incident.detailHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand text-[10px] font-bold text-brand-strong hover:bg-brand-soft">Ver detalle</Link> : null}
        </article>
      ))}
    </div>
  );
}

function RankingView({
  title = "Ranking completo de costes",
  description = "Comparativa de registros recibidos para detectar desviaciones, riesgos y oportunidades.",
  metrics,
  groups,
  configureHref,
  exportHref,
  currency = "EUR",
  className = "",
}: WorkCostRankingProps) {
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby="cost-ranking-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2"><ListOrdered size={18} className="text-content-secondary" aria-hidden="true" /><h2 id="cost-ranking-title" className="text-xl font-black text-content">{title}</h2></div><p className="mt-1 max-w-3xl text-xs leading-5 text-content-secondary">{description}</p></div>
        <div className="flex flex-wrap gap-2">{configureHref ? <ActionLink href={configureHref} icon={SlidersHorizontal} label="Configurar rankings" /> : null}{exportHref ? <ActionLink href={exportHref} icon={Download} label="Exportar" /> : null}</div>
      </header>

      {metrics.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6" aria-label="Indicadores recibidos del ranking">{metrics.map((metric) => <RankingMetric key={metric.id} metric={metric} money={money} />)}</div> : null}

      {groups.length ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-6">
          {groups.map((group, index) => <RankingGroupCard key={group.id} group={group} money={money} fallbackWidth={index < 3 ? "compact" : "wide"} />)}
        </div>
      ) : <EmptyState icon={BarChart3} title="No hay rankings recibidos" detail="La vista no ordena ni crea posiciones sin registros autorizados." />}
    </section>
  );
}

function RankingMetric({ metric, money }: { metric: WorkCostRankingMetric; money: Intl.NumberFormat }) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3">
      <span className="block truncate text-[9px] font-semibold text-content-secondary">{metric.label}</span>
      <strong className="mt-2 block truncate text-lg font-black tabular-nums text-content" title={formatValue(metric.value, metric.format, money)}>{formatValue(metric.value, metric.format, money)}</strong>
      {metric.detail ? <span className={`mt-1 block truncate text-[9px] font-semibold ${toneText(metric.detailTone)}`}>{metric.detail}</span> : null}
      {finite(metric.progressPercent) ? <progress className="mt-3 h-1.5 w-full accent-brand" max={100} value={clampPercent(metric.progressPercent)} aria-label={`${metric.label}: ${formatPercent(metric.progressPercent)}`}>{formatPercent(metric.progressPercent)}</progress> : null}
    </article>
  );
}

function RankingGroupCard({ group, money, fallbackWidth }: { group: WorkCostRankingGroup; money: Intl.NumberFormat; fallbackWidth: "compact" | "wide" }) {
  const width = group.width ?? fallbackWidth;
  return (
    <article className={`min-w-0 overflow-hidden rounded-xl border border-border bg-surface ${width === "wide" ? "xl:col-span-3" : "xl:col-span-2"}`}>
      <header className="flex min-h-14 items-center gap-3 border-b border-border px-3">
        {group.positionLabel ? <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-brand-soft px-2 text-xs font-black text-brand-strong">{group.positionLabel}</span> : null}
        <h3 className="min-w-0 flex-1 text-xs font-black text-content">{group.title}</h3>
        {group.detailHref ? <Link href={group.detailHref} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-[9px] font-bold text-content hover:bg-subtle">{group.detailLabel ?? "Ver detalle"}</Link> : null}
      </header>
      {group.rows.length ? <><RankingDesktopTable group={group} money={money} /><RankingMobileList group={group} money={money} /></> : <EmptyState icon={ListOrdered} title="Sin registros" detail="No se han recibido filas para este ranking." compact />}
      {group.detailHref ? <Link href={group.detailHref} className="inline-flex min-h-11 w-full items-center border-t border-border px-3 text-[10px] font-bold text-brand-strong hover:bg-brand-soft">{group.detailLabel ?? "Ver ranking completo"} <span className="ml-2" aria-hidden="true">→</span></Link> : null}
    </article>
  );
}

function RankingDesktopTable({ group, money }: { group: WorkCostRankingGroup; money: Intl.NumberFormat }) {
  return (
    <div className="hidden overflow-x-auto sm:block" tabIndex={0} role="region" aria-label={`Tabla desplazable: ${group.title}`}>
      <table className="w-full min-w-[28rem] border-collapse text-left text-[9px]">
        <thead className="bg-subtle text-content-secondary"><tr><TableHead>#</TableHead><TableHead>Registro</TableHead>{group.columns.map((column) => <TableHead key={column.key} align={column.align}>{column.label}</TableHead>)}</tr></thead>
        <tbody className="divide-y divide-border">{group.rows.map((row) => <tr key={row.id} className="hover:bg-subtle/70"><td className="px-3 py-2.5 text-content-secondary">{row.rank ?? "—"}</td><td className="px-3 py-2.5"><strong className="block text-content">{row.code ? `${row.code} · ` : ""}{row.label}</strong>{row.detail ? <span className="mt-0.5 block text-[8px] text-content-secondary">{row.detail}</span> : null}</td>{group.columns.map((column) => <RankingCell key={column.key} cell={row.cells[column.key]} align={column.align} money={money} />)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function RankingMobileList({ group, money }: { group: WorkCostRankingGroup; money: Intl.NumberFormat }) {
  return (
    <div className="divide-y divide-border sm:hidden" role="list">
      {group.rows.map((row) => <article key={row.id} role="listitem" className="p-3"><div className="flex items-start gap-2">{row.rank != null ? <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-subtle px-1 text-[9px] font-bold text-content-secondary">{row.rank}</span> : null}<div className="min-w-0"><strong className="block text-xs text-content">{row.code ? `${row.code} · ` : ""}{row.label}</strong>{row.detail ? <span className="mt-1 block text-[9px] text-content-secondary">{row.detail}</span> : null}</div></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">{group.columns.map((column) => { const cell = row.cells[column.key]; return <div key={column.key} className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{column.label}</dt><dd className={`mt-1 truncate text-[10px] font-bold ${toneText(cell?.tone)}`} title={formatValue(cell?.value, cell?.format, money)}>{formatValue(cell?.value, cell?.format, money)}</dd>{cell?.detail ? <span className="mt-0.5 block truncate text-[8px] text-content-secondary">{cell.detail}</span> : null}{finite(cell?.progressPercent) ? <progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={clampPercent(cell.progressPercent)}>{formatPercent(cell.progressPercent)}</progress> : null}</div>; })}</dl>{row.detailHref ? <Link href={row.detailHref} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border text-[9px] font-bold text-content hover:bg-subtle">Ver detalle</Link> : null}</article>)}
    </div>
  );
}

function RankingCell({ cell, align, money }: { cell: WorkCostRankingCell | undefined; align?: "left" | "right"; money: Intl.NumberFormat }) {
  return <td className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}><strong className={`block tabular-nums ${toneText(cell?.tone)}`}>{formatValue(cell?.value, cell?.format, money)}</strong>{cell?.detail ? <span className="mt-0.5 block text-[8px] text-content-secondary">{cell.detail}</span> : null}{finite(cell?.progressPercent) ? <progress className="mt-1 h-1.5 w-20 max-w-full accent-brand" max={100} value={clampPercent(cell.progressPercent)} aria-label={formatPercent(cell.progressPercent)}>{formatPercent(cell.progressPercent)}</progress> : null}</td>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary">
      <span className="font-semibold">{label}:</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-36 border-0 bg-transparent font-bold text-content outline-none">
        <option value="">Todos</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ActionLink({ href, icon: Icon, label, primary = false }: { href: string; icon: typeof Download; label: string; primary?: boolean }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}><Icon size={15} aria-hidden="true" />{label}</Link>;
}

function Responsible({ incident }: { incident: WorkCostIncident }) {
  if (!incident.responsibleName) return <MissingValue />;
  return <span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{incident.responsibleName}</strong>{incident.responsibleRole ? <span className="block truncate text-[8px] text-content-secondary">{incident.responsibleRole}</span> : null}</span></span>;
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function Badge({ label, tone }: { label: string; tone?: WorkCostTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>;
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[8px] text-content-tertiary">{label}</dt><dd className="mt-1 truncate font-semibold text-content">{value}</dd></div>;
}

function MissingValue() {
  return <span className="text-content-tertiary">—</span>;
}

function EmptyState({ icon: Icon, title, detail, compact = false }: { icon: typeof AlertTriangle; title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-content-center justify-items-center p-6 text-center ${compact ? "min-h-36" : "min-h-52"}`}><Icon size={22} className="text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-xs font-bold text-content">{title}</h3><p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p></div>;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).sort((left, right) => left.localeCompare(right, "es"));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function moneyFormatter(currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 });
}

function formatValue(value: string | number | null | undefined, format: WorkCostValueFormat = "text", money: Intl.NumberFormat) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "—";
  if (format === "currency") return money.format(value);
  if (format === "percent") return formatPercent(value);
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function toneText(tone: WorkCostTone | undefined) {
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "success") return "text-success";
  if (tone === "info") return "text-brand-strong";
  return "text-content";
}

function toneBadge(tone: WorkCostTone | undefined) {
  if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger";
  if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning";
  if (tone === "success") return "border-success/20 bg-success/10 text-success";
  if (tone === "info") return "border-brand/20 bg-brand-soft text-brand-strong";
  return "border-border bg-subtle text-content-secondary";
}

function toneBar(tone: WorkCostTone | undefined) {
  if (tone === "danger") return "bg-danger";
  if (tone === "warning") return "bg-warning";
  if (tone === "success") return "bg-success";
  if (tone === "info") return "bg-brand";
  return "bg-content-tertiary";
}
