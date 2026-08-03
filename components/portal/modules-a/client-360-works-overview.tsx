"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Flag,
  ListFilter,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Rows3,
  Search,
  Star,
  TableProperties,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";

export type ClientWorkTone = "neutral" | "info" | "success" | "warning" | "danger";
export type ClientWorksMode = "tarjetas" | "lista" | "portfolio";
export type ClientWorksMetricKind = "active" | "contracted" | "estimated_margin" | "upcoming_milestones";

export type ClientWorksMetric = {
  kind: ClientWorksMetricKind;
  value: number | null;
  format?: "number" | "currency" | "percent";
  detail?: string | null;
  tone?: ClientWorkTone;
  href?: string | null;
  hrefLabel?: string | null;
};

export type ClientWorkMilestone = {
  title: string;
  date?: string | null;
  detail?: string | null;
  tone?: ClientWorkTone;
  href?: string | null;
};

export type ClientWorkProgressItem = {
  id: string;
  text: string;
  tone?: ClientWorkTone;
  href?: string | null;
};

export type ClientWorkAlert = {
  title: string;
  detail?: string | null;
  tone?: ClientWorkTone;
  href?: string | null;
};

export type ClientWorkRecentDocument = {
  id: string;
  name: string;
  sizeLabel?: string | null;
  href?: string | null;
};

export type ClientWorkDetails = {
  nextMilestone?: ClientWorkMilestone | null;
  recentProgress?: ClientWorkProgressItem[];
  alerts?: ClientWorkAlert[];
  recentDocuments?: ClientWorkRecentDocument[];
  allDocumentsHref?: string | null;
};

export type ClientWorkRecord = {
  id: string;
  title: string;
  code?: string | null;
  segment?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  featured?: boolean;
  status?: string | null;
  statusTone?: ClientWorkTone;
  progressPercent?: number | null;
  contractedAmount?: number | null;
  contractedLabel?: string | null;
  estimatedMarginPercent?: number | null;
  estimatedMarginAmount?: number | null;
  marginTone?: ClientWorkTone;
  endAt?: string | null;
  endDetail?: string | null;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  href?: string | null;
  moreHref?: string | null;
  details?: ClientWorkDetails | null;
};

export type Client360WorksOverviewProps = {
  clientId: string;
  currency?: string;
  metrics: ClientWorksMetric[];
  works: ClientWorkRecord[];
  mode?: ClientWorksMode;
  createHref?: string | null;
  allWorksHref?: string | null;
  exportHref?: string | null;
  moreFiltersHref?: string | null;
  initialExpandedWorkId?: string | null;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
};

const metricPresentation: Record<ClientWorksMetricKind, { label: string; icon: typeof Building2; format: "number" | "currency" | "percent" }> = {
  active: { label: "Obras activas", icon: Building2, format: "number" },
  contracted: { label: "Importe contratado", icon: WalletCards, format: "currency" },
  estimated_margin: { label: "Margen estimado (ponderado)", icon: TrendingUp, format: "percent" },
  upcoming_milestones: { label: "Hitos próximos", icon: CalendarClock, format: "number" },
};

export function Client360WorksOverview({
  clientId,
  currency = "EUR",
  metrics,
  works,
  mode = "lista",
  createHref,
  allWorksHref,
  exportHref,
  moreFiltersHref,
  initialExpandedWorkId = null,
  initialPageSize = 5,
  pageSizeOptions = [5, 10, 20],
  className = "",
}: Client360WorksOverviewProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [expandedWorkId, setExpandedWorkId] = useState<string | null>(initialExpandedWorkId);
  const [page, setPage] = useState(1);
  const safePageSizes = useMemo(() => normalizePageSizes(initialPageSize, pageSizeOptions), [initialPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(() => safePageSizes[0]);
  const money = useMemo(() => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }), [currency]);
  const statuses = useMemo(() => uniqueValues(works.map((work) => work.status)), [works]);
  const filteredWorks = useMemo(() => {
    const normalizedQuery = normalize(query);
    return works.filter((work) => {
      const searchable = normalize([work.title, work.code, work.segment, work.address, work.status, work.responsibleName].filter(Boolean).join(" "));
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (!status || work.status === status);
    });
  }, [query, status, works]);
  const pageCount = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageWorks = filteredWorks.slice(start, start + pageSize);
  const modeBaseHref = `/clientes/${clientId}?vista=obras&modo=`;

  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby={`client-works-${clientId}`}>
      <header className="sr-only"><h2 id={`client-works-${clientId}`}>Cartera de obras de este cliente</h2><p>Resumen de obras enlazadas al cliente. Cada obra conserva su identidad, permisos y datos propios.</p></header>

      {mode === "portfolio" ? (metrics.length ? <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Indicadores recibidos de la cartera del cliente">{metrics.map((metric) => <WorksMetricCard key={metric.kind} metric={metric} money={money} />)}</div> : <HonestEmpty icon={Building2} title="Sin indicadores de cartera" detail="No se han recibido métricas autorizadas para este cliente." compact />) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="flex flex-wrap gap-2">{createHref ? <ActionLink href={createHref} label="Nueva obra" icon={Plus} primary /> : null}{allWorksHref ? <ActionLink href={allWorksHref} label="Ver todas" icon={BriefcaseBusiness} /> : null}<label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary lg:min-h-10"><span className="font-semibold">Estado:</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="max-w-36 border-0 bg-transparent font-bold text-content outline-none"><option value="">Todos</option>{statuses.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>
        <div className="flex min-w-0 flex-wrap gap-2 lg:flex-1 lg:justify-end"><label className="flex min-h-11 min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary lg:min-h-10 lg:max-w-[15rem]"><Search size={15} aria-hidden="true" /><span className="sr-only">Buscar obra</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none" placeholder="Buscar obra…" /></label><nav className="flex min-h-11 overflow-hidden rounded-lg border border-border bg-surface lg:min-h-10" aria-label="Vista de obras del cliente">{([['tarjetas','Tarjetas',LayoutGrid],['lista','Lista',Rows3],['portfolio','Portfolio',TableProperties]] as const).map(([value,label,Icon]) => <Link key={value} href={`${modeBaseHref}${value}`} aria-current={mode === value ? 'page' : undefined} className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-[10px] font-bold lg:min-h-10 ${mode === value ? 'bg-brand text-on-brand' : 'text-content-secondary hover:bg-subtle'}`}><Icon size={14} aria-hidden="true" /><span className="hidden xl:inline">{label}</span><span className="sr-only xl:hidden">{label}</span></Link>)}</nav>{exportHref ? <ActionLink href={exportHref} label="Exportar" icon={Download} /> : null}{moreFiltersHref ? <ActionLink href={moreFiltersHref} label="Filtros" icon={ListFilter} /> : null}{query || status ? <button type="button" onClick={() => { setQuery(""); setStatus(""); setPage(1); }} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-[10px] font-bold text-content-secondary hover:bg-subtle lg:min-h-10">Limpiar</button> : null}</div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <p className="sr-only" aria-live="polite">{filteredWorks.length} obras visibles de {works.length} recibidas.</p>
        {pageWorks.length ? <>{mode === "tarjetas" ? <WorksReferenceCards works={pageWorks} expandedWorkId={expandedWorkId} onExpand={setExpandedWorkId} money={money} /> : mode === "lista" ? <><WorksOperationalList works={pageWorks} expandedWorkId={expandedWorkId} onExpand={setExpandedWorkId} money={money} /><div className="lg:hidden"><WorksMobileList works={pageWorks} expandedWorkId={expandedWorkId} onExpand={setExpandedWorkId} money={money} /></div></> : <><WorksDesktopTable works={pageWorks} expandedWorkId={expandedWorkId} onExpand={setExpandedWorkId} money={money} /><WorksMobileList works={pageWorks} expandedWorkId={expandedWorkId} onExpand={setExpandedWorkId} money={money} /></>}<WorksPagination currentPage={currentPage} pageCount={pageCount} pageSize={pageSize} pageSizes={safePageSizes} start={start} visibleCount={pageWorks.length} total={filteredWorks.length} onPage={setPage} onPageSize={(value) => { setPageSize(value); setPage(1); }} /></> : <HonestEmpty icon={BriefcaseBusiness} title="No hay obras para estos filtros" detail="Cambia la búsqueda o el estado para revisar la cartera recibida." />}
      </div>
    </section>
  );
}

function WorksMetricCard({ metric, money }: { metric: ClientWorksMetric; money: Intl.NumberFormat }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  const body = <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-[10px] font-semibold text-content-secondary">{presentation.label}</h3><strong className="mt-2 block truncate text-xl font-black tabular-nums text-content" title={formatMetric(metric, presentation.format, money)}>{formatMetric(metric, presentation.format, money)}</strong>{metric.detail ? <p className={`mt-1 truncate text-[9px] ${toneText(metric.tone, true)}`}>{metric.detail}</p> : null}</div><span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneSurface(metric.tone)}`}><Icon size={18} aria-hidden="true" /></span></div>{metric.href ? <span className="mt-3 block border-t border-border pt-2 text-[9px] font-bold text-brand-strong">{metric.hrefLabel ?? "Ver detalle"} →</span> : null}</>;
  const className = "block min-w-0 rounded-xl border border-border bg-surface p-3 text-left hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  return metric.href ? <Link href={metric.href} className={className}>{body}</Link> : <article className={className}>{body}</article>;
}

function WorksReferenceCards({ works, expandedWorkId, onExpand, money }: { works: ClientWorkRecord[]; expandedWorkId: string | null; onExpand: (id: string | null) => void; money: Intl.NumberFormat }) {
  return <div className="grid gap-3 p-3" role="list">{works.map((work) => { const expanded = expandedWorkId === work.id; const image = safeImageUrl(work.imageUrl); return <article key={work.id} role="listitem" className="overflow-hidden rounded-xl border border-border bg-surface"><div className="grid min-w-0 md:grid-cols-[15rem_minmax(0,1fr)]"><div className="min-h-44 bg-subtle">{image ? <Image src={image} alt={work.imageAlt?.trim() || `Vista registrada de ${work.title}`} width={480} height={320} unoptimized className="h-full min-h-44 w-full object-cover" /> : <span className="flex h-full min-h-44 items-center justify-center text-content-tertiary"><Building2 size={34} aria-hidden="true" /></span>}</div><div className="grid min-w-0 gap-3 p-4"><header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-black text-content">{work.href ? <Link href={work.href} className="hover:text-brand-strong hover:underline">{work.title}</Link> : work.title}</h3><p className="mt-1 text-[10px] text-content-secondary">{[work.segment, work.address].filter(Boolean).join(" · ") || "Datos no informados"}</p></div>{work.status ? <StatusBadge label={work.status} tone={work.statusTone} /> : null}</header><dl className="grid grid-cols-2 gap-3 text-[10px] lg:grid-cols-4"><CardFact label="Avance" value={formatPercent(work.progressPercent)} /><CardFact label="Margen estimado" value={formatPercent(work.estimatedMarginPercent)} tone={work.marginTone} /><CardFact label={work.contractedLabel ?? "Presupuesto"} value={formatMoney(work.contractedAmount, money)} /><CardFact label="Fecha fin" value={formatDate(work.endAt)} /></dl><div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-[9px] text-content-secondary">Responsable: <strong className="text-content">{work.responsibleName ?? "No informado"}</strong></span><WorkActions work={work} expanded={expanded} onExpand={() => onExpand(expanded ? null : work.id)} mobile /></div></div></div>{expanded && work.details ? <div className="border-t border-border"><WorkExpandedDetails details={work.details} /></div> : null}</article>; })}</div>;
}

function WorksOperationalList({ works, expandedWorkId, onExpand, money }: { works: ClientWorkRecord[]; expandedWorkId: string | null; onExpand: (id: string | null) => void; money: Intl.NumberFormat }) {
  return <div className="hidden divide-y divide-border lg:block" role="list">{works.map((work) => { const expanded = expandedWorkId === work.id; const image = safeImageUrl(work.imageUrl); return <article key={work.id} role="listitem"><div className="grid min-w-0 items-center gap-3 p-3 lg:grid-cols-[minmax(16rem,1.45fr)_minmax(9rem,.7fr)_minmax(10rem,.8fr)_minmax(8rem,.65fr)_auto]"><div className="flex min-w-0 items-center gap-3">{image ? <Image src={image} alt={work.imageAlt?.trim() || `Vista registrada de ${work.title}`} width={148} height={92} unoptimized className="h-[5.75rem] w-[9.25rem] shrink-0 rounded-lg border border-border object-cover" /> : <span className="flex h-[5.75rem] w-[9.25rem] shrink-0 items-center justify-center rounded-lg border border-border bg-subtle text-content-tertiary"><Building2 size={24} aria-hidden="true" /></span>}<div className="min-w-0"><h3 className="truncate text-sm font-black text-content">{work.href ? <Link href={work.href} className="hover:text-brand-strong hover:underline">{work.title}</Link> : work.title}</h3><p className="mt-1 truncate text-[9px] text-content-secondary">{work.address ?? work.segment ?? "Datos no informados"}</p><div className="mt-2 flex flex-wrap gap-2">{work.status ? <StatusBadge label={work.status} tone={work.statusTone} /> : null}</div></div></div><div><p className="text-[8px] font-semibold uppercase tracking-wide text-content-tertiary">Estado y avance</p><div className="mt-2"><ProgressValue value={work.progressPercent} /></div></div><div><p className="text-[8px] font-semibold uppercase tracking-wide text-content-tertiary">Presupuesto</p><strong className="mt-2 block text-[11px] tabular-nums text-content">{formatMoney(work.contractedAmount, money)}</strong><span className={`mt-1 block text-[9px] ${toneText(work.marginTone, true)}`}>Margen: {formatPercent(work.estimatedMarginPercent)}</span></div><div><p className="text-[8px] font-semibold uppercase tracking-wide text-content-tertiary">Responsable</p><strong className="mt-2 block truncate text-[10px] text-content">{work.responsibleName ?? "No informado"}</strong><span className="mt-1 block text-[9px] text-content-secondary">Fin: {formatDate(work.endAt)}</span></div><WorkActions work={work} expanded={expanded} onExpand={() => onExpand(expanded ? null : work.id)} /></div>{expanded && work.details ? <div className="border-t border-border"><WorkExpandedDetails details={work.details} /></div> : null}</article>; })}</div>;
}

function CardFact({ label, value, tone }: { label: string; value: string; tone?: ClientWorkTone }) {
  return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className={`mt-1 truncate text-sm font-black tabular-nums ${toneText(tone)}`}>{value}</dd></div>;
}

function WorksDesktopTable({ works, expandedWorkId, onExpand, money }: { works: ClientWorkRecord[]; expandedWorkId: string | null; onExpand: (id: string | null) => void; money: Intl.NumberFormat }) {
  return <div className="hidden overflow-x-auto lg:block" tabIndex={0} role="region" aria-label="Tabla desplazable de obras del cliente"><table className="w-full min-w-[52rem] border-collapse text-left text-[9px]"><thead className="bg-subtle text-content-secondary"><tr><TableHead>Obra</TableHead><TableHead>Estado</TableHead><TableHead>Avance</TableHead><TableHead align="right">Presupuesto</TableHead><TableHead align="right">Rentabilidad estimada</TableHead><TableHead>Fecha fin</TableHead><TableHead>Responsable</TableHead><TableHead align="right">Acciones</TableHead></tr></thead><tbody className="divide-y divide-border">{works.map((work) => <WorkDesktopRows key={work.id} work={work} expanded={expandedWorkId === work.id} onExpand={() => onExpand(expandedWorkId === work.id ? null : work.id)} money={money} />)}</tbody></table></div>;
}

function WorkDesktopRows({ work, expanded, onExpand, money }: { work: ClientWorkRecord; expanded: boolean; onExpand: () => void; money: Intl.NumberFormat }) {
  return <><tr className={expanded ? "bg-brand-soft/40" : "hover:bg-subtle/70"}><td className="max-w-[21rem] px-3 py-2"><WorkIdentity work={work} /></td><td className="px-3 py-2">{work.status ? <StatusBadge label={work.status} tone={work.statusTone} /> : <MissingValue />}</td><td className="w-32 px-3 py-2"><ProgressValue value={work.progressPercent} /></td><td className="px-3 py-2 text-right"><strong className="block tabular-nums text-content">{formatMoney(work.contractedAmount, money)}</strong>{work.contractedLabel ? <span className="mt-1 block text-[8px] text-content-secondary">{work.contractedLabel}</span> : null}</td><td className="px-3 py-2 text-right"><strong className={`block tabular-nums ${toneText(work.marginTone)}`}>{formatPercent(work.estimatedMarginPercent)}</strong>{finite(work.estimatedMarginAmount) ? <span className="mt-1 block text-[8px] tabular-nums text-content-secondary">{formatMoney(work.estimatedMarginAmount, money)}</span> : null}</td><td className="px-3 py-2"><span className="block text-content">{formatDate(work.endAt)}</span>{work.endDetail ? <span className="mt-1 block text-[8px] text-content-secondary">{work.endDetail}</span> : null}</td><td className="px-3 py-2"><Responsible work={work} /></td><td className="px-3 py-2"><WorkActions work={work} expanded={expanded} onExpand={onExpand} /></td></tr>{expanded && work.details ? <tr><td colSpan={8} className="border-t border-brand/20 bg-subtle/50 p-0"><WorkExpandedDetails details={work.details} /></td></tr> : null}</>;
}

function WorksMobileList({ works, expandedWorkId, onExpand, money }: { works: ClientWorkRecord[]; expandedWorkId: string | null; onExpand: (id: string | null) => void; money: Intl.NumberFormat }) {
  return <div className="divide-y divide-border lg:hidden" role="list">{works.map((work) => { const expanded = expandedWorkId === work.id; return <article key={work.id} role="listitem" className="p-4"><WorkIdentity work={work} large /><div className="mt-3 flex flex-wrap gap-2">{work.status ? <StatusBadge label={work.status} tone={work.statusTone} /> : null}{finite(work.progressPercent) ? <StatusBadge label={`${formatPercent(work.progressPercent)} de avance`} tone="info" /> : null}</div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"><MobileValue label="Presupuesto" value={formatMoney(work.contractedAmount, money)} /><MobileValue label="Margen estimado" value={formatPercent(work.estimatedMarginPercent)} tone={work.marginTone} /><MobileValue label="Fecha fin" value={formatDate(work.endAt)} /><MobileValue label="Responsable" value={work.responsibleName ?? "No informado"} /></dl><div className="mt-3"><WorkActions work={work} expanded={expanded} onExpand={() => onExpand(expanded ? null : work.id)} mobile /></div>{expanded && work.details ? <div className="mt-3 overflow-hidden rounded-xl border border-border"><WorkExpandedDetails details={work.details} /></div> : null}</article>; })}</div>;
}

function WorkIdentity({ work, large = false }: { work: ClientWorkRecord; large?: boolean }) {
  const image = safeImageUrl(work.imageUrl);
  return <span className="flex min-w-0 items-center gap-3">{image ? <Image src={image} alt={work.imageAlt?.trim() || `Vista registrada de ${work.title}`} width={large ? 88 : 76} height={large ? 60 : 48} unoptimized className={`${large ? "h-[3.75rem] w-[5.5rem]" : "h-12 w-20"} shrink-0 rounded-lg border border-border object-cover`} /> : <span className={`${large ? "h-[3.75rem] w-[5.5rem]" : "h-12 w-20"} inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-subtle text-content-tertiary`}><Building2 size={20} aria-hidden="true" /></span>}<span className="min-w-0">{work.featured ? <span className="mb-1 inline-flex items-center gap-1 text-[8px] font-bold text-brand-strong"><Star size={10} fill="currentColor" aria-hidden="true" /> Destacada</span> : null}<strong className={`${large ? "text-sm" : "text-[10px]"} block truncate text-content`}>{work.href ? <Link href={work.href} className="hover:text-brand-strong hover:underline">{work.title}</Link> : work.title}</strong><span className="mt-1 block truncate text-[8px] text-content-secondary">{[work.code, work.segment].filter(Boolean).join(" · ") || "Datos no informados"}</span>{work.address ? <span className="mt-1 block truncate text-[8px] text-content-tertiary">{work.address}</span> : null}</span></span>;
}

function WorkExpandedDetails({ details }: { details: ClientWorkDetails }) {
  return <div className="grid min-w-0 gap-px bg-border xl:grid-cols-4"><DetailPanel title="Próximo hito" icon={Flag}>{details.nextMilestone ? <div>{details.nextMilestone.href ? <Link href={details.nextMilestone.href} className="font-bold text-content hover:text-brand-strong hover:underline">{details.nextMilestone.title}</Link> : <strong className="text-content">{details.nextMilestone.title}</strong>}<p className="mt-2 text-[9px] text-content-secondary">{formatDate(details.nextMilestone.date)}</p>{details.nextMilestone.detail ? <p className={`mt-1 text-[9px] ${toneText(details.nextMilestone.tone)}`}>{details.nextMilestone.detail}</p> : null}</div> : <DetailEmpty text="Sin próximo hito informado." />}</DetailPanel><DetailPanel title="Últimos avances" icon={CheckCircle2}>{details.recentProgress?.length ? <ul className="grid gap-2">{details.recentProgress.map((item) => <li key={item.id} className="flex gap-2 text-[9px]"><CheckCircle2 size={12} className={`mt-px shrink-0 ${toneText(item.tone)}`} aria-hidden="true" />{item.href ? <Link href={item.href} className="text-content-secondary hover:underline">{item.text}</Link> : <span className="text-content-secondary">{item.text}</span>}</li>)}</ul> : <DetailEmpty text="Sin avances recientes recibidos." />}</DetailPanel><DetailPanel title="Alertas" icon={AlertTriangle}>{details.alerts?.length ? <ul className="grid gap-2">{details.alerts.map((alert, index) => <li key={`${alert.title}-${index}`} className="flex gap-2 text-[9px]"><AlertTriangle size={12} className={`mt-px shrink-0 ${toneText(alert.tone)}`} aria-hidden="true" /><span>{alert.href ? <Link href={alert.href} className={`font-bold hover:underline ${toneText(alert.tone)}`}>{alert.title}</Link> : <strong className={toneText(alert.tone)}>{alert.title}</strong>}{alert.detail ? <span className="mt-1 block text-content-secondary">{alert.detail}</span> : null}</span></li>)}</ul> : <DetailEmpty text="Sin alertas recibidas." />}</DetailPanel><DetailPanel title="Documentos recientes" icon={FileText}>{details.recentDocuments?.length ? <ul className="grid gap-2">{details.recentDocuments.map((document) => <li key={document.id} className="flex gap-2 text-[9px]"><FileText size={12} className="mt-px shrink-0 text-danger" aria-hidden="true" /><span className="min-w-0">{document.href ? <Link href={document.href} className="block truncate font-bold text-content hover:underline">{document.name}</Link> : <strong className="block truncate text-content">{document.name}</strong>}{document.sizeLabel ? <span className="text-[8px] text-content-secondary">{document.sizeLabel}</span> : null}</span></li>)}</ul> : <DetailEmpty text="Sin documentos recientes recibidos." />}{details.allDocumentsHref ? <Link href={details.allDocumentsHref} className="mt-3 inline-flex min-h-9 items-center text-[9px] font-bold text-brand-strong hover:underline">Ver todos →</Link> : null}</DetailPanel></div>;
}

function DetailPanel({ title, icon: Icon, children }: { title: string; icon: typeof Flag; children: React.ReactNode }) {
  return <section className="min-w-0 bg-surface p-4"><h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold text-content"><Icon size={13} className="text-content-secondary" aria-hidden="true" />{title}</h4>{children}</section>;
}

function DetailEmpty({ text }: { text: string }) {
  return <p className="text-[9px] leading-4 text-content-secondary">{text}</p>;
}

function WorkActions({ work, expanded, onExpand, mobile = false }: { work: ClientWorkRecord; expanded: boolean; onExpand: () => void; mobile?: boolean }) {
  if (!work.details && !work.moreHref && !work.href) return <MissingValue />;
  const size = mobile ? "min-h-11 flex-1" : "h-9 w-9";
  return <div className={`flex items-center ${mobile ? "gap-2" : "justify-end gap-1"}`}>{work.href ? <IconLink href={work.href} label={`Abrir ${work.title}`} icon={BriefcaseBusiness} className={size} /> : null}{work.details ? <button type="button" aria-label={`${expanded ? "Ocultar" : "Mostrar"} detalle de ${work.title}`} aria-expanded={expanded} onClick={onExpand} className={`${size} inline-flex items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}><ChevronDown size={16} className={expanded ? "rotate-180" : ""} aria-hidden="true" /></button> : null}{work.moreHref ? <IconLink href={work.moreHref} label={`Más acciones de ${work.title}`} icon={MoreHorizontal} className={size} /> : null}</div>;
}

function ProgressValue({ value }: { value?: number | null }) {
  if (!finite(value)) return <MissingValue />;
  return <span className="block"><span className="flex items-center justify-between text-[9px]"><strong className="text-content">{formatPercent(value)}</strong></span><progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={clampPercent(value)}>{formatPercent(value)}</progress></span>;
}

function Responsible({ work }: { work: ClientWorkRecord }) {
  if (!work.responsibleName) return <MissingValue />;
  return <span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{work.responsibleName}</strong>{work.responsibleRole ? <span className="block truncate text-[8px] text-content-secondary">{work.responsibleRole}</span> : null}</span></span>;
}

function WorksPagination({ currentPage, pageCount, pageSize, pageSizes, start, visibleCount, total, onPage, onPageSize }: { currentPage: number; pageCount: number; pageSize: number; pageSizes: number[]; start: number; visibleCount: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = pageWindow(currentPage, pageCount);
  return <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 text-[10px] text-content-secondary sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {total ? start + 1 : 0} a {start + visibleCount} de {total} obras recibidas</span><div className="flex flex-wrap items-center gap-2"><nav className="flex items-center gap-1" aria-label="Paginación de obras"><PageButton label="Anterior" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>‹</PageButton>{pages.map((pageNumber) => <PageButton key={pageNumber} label={`Página ${pageNumber}`} active={pageNumber === currentPage} onClick={() => onPage(pageNumber)}>{pageNumber}</PageButton>)}<PageButton label="Siguiente" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>›</PageButton></nav>{pageSizes.length > 1 ? <label className="flex min-h-10 items-center gap-2"><span>Mostrar</span><select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-surface px-2 font-bold text-content">{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select><span>por página</span></label> : null}</div></footer>;
}

function ActionLink({ href, label, icon: Icon, primary = false }: { href: string; label: string; icon: typeof Plus; primary?: boolean }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:min-h-10 ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}><Icon size={15} aria-hidden="true" />{label}</Link>;
}

function IconLink({ href, label, icon: Icon, className }: { href: string; label: string; icon: typeof BriefcaseBusiness; className: string }) {
  return <Link href={href} aria-label={label} title={label} className={`${className} inline-flex items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}><Icon size={15} aria-hidden="true" /></Link>;
}

function StatusBadge({ label, tone }: { label: string; tone?: ClientWorkTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>;
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function MobileValue({ label, value, tone }: { label: string; value: string; tone?: ClientWorkTone }) {
  return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className={`mt-1 truncate text-[10px] font-bold ${toneText(tone)}`}>{value}</dd></div>;
}

function PageButton({ children, label, disabled = false, active = false, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; active?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 font-bold disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-content hover:bg-subtle"}`}>{children}</button>;
}

function MissingValue() { return <span className="text-content-tertiary">—</span>; }

function HonestEmpty({ icon: Icon, title, detail, compact = false }: { icon: typeof Building2; title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-content-center justify-items-center p-6 text-center ${compact ? "min-h-32" : "min-h-52"}`}><Icon size={22} className="text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-xs font-bold text-content">{title}</h3><p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p></div>;
}

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? value : null; } catch { return null; }
}

function normalizePageSizes(initial: number, options: number[]) { const safeInitial = Number.isInteger(initial) && initial > 0 ? initial : 5; return Array.from(new Set([safeInitial, ...options].filter((value) => Number.isInteger(value) && value > 0))); }
function pageWindow(current: number, total: number) { if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1); const start = Math.max(1, Math.min(current - 2, total - 4)); return Array.from({ length: 5 }, (_, index) => start + index); }
function uniqueValues(values: Array<string | null | undefined>) { return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).sort((left, right) => left.localeCompare(right, "es")); }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function finite(value: number | null | undefined): value is number { return typeof value === "number" && Number.isFinite(value); }
function clampPercent(value: number) { return Math.min(100, Math.max(0, value)); }
function formatMoney(value: number | null | undefined, money: Intl.NumberFormat) { return finite(value) ? money.format(value) : "—"; }
function formatPercent(value: number | null | undefined) { return finite(value) ? new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value / 100) : "—"; }
function formatDate(value: string | null | undefined) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function formatMetric(metric: ClientWorksMetric, fallback: "number" | "currency" | "percent", money: Intl.NumberFormat) { if (!finite(metric.value)) return "—"; const format = metric.format ?? fallback; if (format === "currency") return money.format(metric.value); if (format === "percent") return formatPercent(metric.value); return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(metric.value); }
function toneText(tone: ClientWorkTone | undefined, secondary = false) { if (tone === "danger") return "text-danger"; if (tone === "warning") return "text-warning"; if (tone === "success") return "text-success"; if (tone === "info") return "text-brand-strong"; return secondary ? "text-content-secondary" : "text-content"; }
function toneSurface(tone: ClientWorkTone | undefined) { if (tone === "danger") return "bg-danger/10 text-danger"; if (tone === "warning") return "bg-warning/10 text-warning"; if (tone === "success") return "bg-success/10 text-success"; if (tone === "info") return "bg-brand-soft text-brand-strong"; return "bg-subtle text-content-secondary"; }
function toneBadge(tone: ClientWorkTone | undefined) { if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger"; if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning"; if (tone === "success") return "border-success/20 bg-success/10 text-success"; if (tone === "info") return "border-brand/20 bg-brand-soft text-brand-strong"; return "border-border bg-subtle text-content-secondary"; }
