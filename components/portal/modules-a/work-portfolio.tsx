"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardPenLine,
  FilePlus2,
  FileText,
  FileWarning,
  MapPin,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

export type WorkPortfolioVisit = {
  label?: string | null;
  date?: string | null;
  href?: string | null;
};

export type WorkPortfolioTeamMember = {
  name: string;
  role?: string | null;
};

export type WorkPortfolioTimelineItem = {
  label: string;
  date?: string | null;
  status?: string | null;
};

export type WorkPortfolioActionHrefs = {
  part?: string | null;
  incident?: string | null;
  visit?: string | null;
  status?: string | null;
};

export type WorkPortfolioItem = {
  id: string;
  title: string;
  client: string;
  status: string;
  statusClassName: string;
  priority: string;
  nextAction: string;
  nextDate: string;
  updatedAt: string;
  responsible: string;
  margin: string | null;
  budget: string | null;
  cost: string | null;
  pending: string | null;
  risk: boolean;
  riskReason?: string | null;
  marginRisk: boolean;
  pendingMaterials: number;
  pendingDocuments: number;
  code?: string | null;
  workType?: string | null;
  progressLabel?: string | null;
  progressPercent?: number | null;
  visit?: WorkPortfolioVisit | null;
  incidentCount?: number | null;
  incidentLabels?: string[] | null;
  team?: WorkPortfolioTeamMember[] | null;
  timeline?: WorkPortfolioTimelineItem[] | null;
  actionHrefs?: WorkPortfolioActionHrefs | null;
  thumbnailUrl?: string | null;
  budgetAmount?: number | null;
  closingSoon?: boolean | null;
  active?: boolean | null;
};

export function WorkPortfolio({ items }: { items: WorkPortfolioItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId),
    [items, selectedId],
  );

  useEffect(() => {
    if (!items.length || !selectedId) return;
    if (!items.some((item) => item.id === selectedId))
      setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id));
    setMarkedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1440px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  function selectWork(item: WorkPortfolioItem, trigger: HTMLButtonElement) {
    setSelectedId(item.id);
    lastTriggerRef.current = trigger;
    if (window.matchMedia("(max-width: 1439px)").matches) setDrawerOpen(true);
  }

  function closeDesktopDetail() {
    const trigger =
      lastTriggerRef.current ??
      document.querySelector<HTMLButtonElement>(
        'button[aria-label^="Abrir detalle de "][aria-pressed="true"]',
      );
    setSelectedId("");
    window.requestAnimationFrame(() => trigger?.focus());
  }

  function closeDrawer() {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }

  function toggleMarked(id: string) {
    setMarkedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllMarked() {
    const allVisibleMarked = items.length > 0 && items.every((item) => markedIds.has(item.id));
    setMarkedIds(allVisibleMarked ? new Set() : new Set(items.map((item) => item.id)));
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-surface shadow-soft ${selected ? "min-[1440px]:grid min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(20rem,21.25rem)]" : ""}`}>
      <section className={`min-w-0 border-border ${selected ? "min-[1440px]:border-r" : ""}`} aria-label="Trabajos filtrados">
        {items.length ? (
          <>
            <div className="hidden min-[1440px]:block" aria-label="Listado de trabajos">
              <div className="grid min-h-11 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 border-b border-border bg-surface px-3 text-[10px] font-semibold text-content-secondary">
                <input type="checkbox" checked={items.length > 0 && items.every((item) => markedIds.has(item.id))} onChange={toggleAllMarked} className="h-4 w-4 accent-brand" aria-label="Seleccionar todos los trabajos visibles" />
                <div aria-hidden="true" className="grid grid-cols-[minmax(7.2rem,2fr)_4.2rem_3.5rem_4.5rem_5rem_3.6rem_6.7rem_0.9rem] items-center gap-1 leading-tight">
                  <span>Obra</span>
                  <span>Estado</span>
                  <span>Avance</span>
                  <span>Equipo</span>
                  <span>Próxima<br />visita</span>
                  <span>Incidencias</span>
                  <span>Presupuesto<br />vs. real</span>
                  <span />
                </div>
              </div>
              <div className="divide-y divide-border" role="list">
                {items.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <article key={item.id} role="listitem" className={`grid min-h-[4.2rem] grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 px-3 transition-colors ${active ? "bg-brand-soft ring-1 ring-inset ring-blue-200" : "bg-surface"}`}>
                      <input type="checkbox" checked={markedIds.has(item.id)} onChange={() => toggleMarked(item.id)} className="h-4 w-4 accent-brand" aria-label={`Seleccionar ${item.title}`} />
                      <button type="button" aria-pressed={active} aria-label={`Abrir detalle de ${item.title}`} onClick={(event) => selectWork(item, event.currentTarget)} className="grid min-h-[4.2rem] w-full grid-cols-[minmax(7.2rem,2fr)_4.2rem_3.5rem_4.5rem_5rem_3.6rem_6.7rem_0.9rem] items-center gap-1 text-left text-[9px] outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                      <span className="flex min-w-0 items-center gap-2">
                        <WorkThumbnail item={item} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-content">{valueOr(item.title, "Sin título registrado")}</span>
                          <span className="mt-0.5 block truncate text-content-secondary">{valueOr(item.client, "Sin cliente registrado")}</span>
                        </span>
                      </span>
                      <span><span className={`inline-flex rounded-full px-1.5 py-1 text-[10px] font-semibold ${item.statusClassName}`}>{valueOr(item.status, "Sin estado registrado")}</span></span>
                      <span className="min-w-0"><TableProgress item={item} /></span>
                      <span className="min-w-0"><span className="block truncate font-semibold text-content">{teamSummary(item)}</span><span className="mt-0.5 block truncate text-content-secondary">{valueOr(item.responsible, "Sin responsable registrado")}</span></span>
                      <span className="min-w-0"><span className="block truncate font-semibold text-content">{visitSummary(item)}</span><span className="mt-0.5 block truncate text-content-secondary">{item.visit ? valueOr(item.visit.label, "Sin detalle registrado") : "Sin visita registrada"}</span></span>
                      <IncidentCell item={item} />
                      <span className="min-w-0"><FinancialSummary item={item} /></span>
                      <ChevronRight size={14} className="text-content-secondary" aria-hidden="true" />
                      </button>
                    </article>
                  );
                })}
              </div>
              <div className="flex min-h-11 items-center border-t border-border px-3 text-[10px] text-content-secondary">1–{items.length} de {items.length} obras</div>
            </div>

            <div className="divide-y divide-border min-[1440px]:hidden" role="list">
              {items.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <article key={item.id} role="listitem" className={active ? "bg-brand-soft" : "bg-surface"}>
                    <button type="button" aria-pressed={active} aria-expanded={active && drawerOpen} onClick={(event) => selectWork(item, event.currentTarget)} className="group min-h-32 w-full px-4 py-3 text-left outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                      <span className="flex min-w-0 items-start gap-3">
                        <WorkThumbnail item={item} large />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-start justify-between gap-2">
                            <span className="min-w-0"><span className="type-object-title block truncate text-content">{valueOr(item.title, "Sin título registrado")}</span><span className="type-secondary mt-1 block truncate">{valueOr(item.client, "Sin cliente registrado")} · {valueOr(item.workType, "Sin tipo de trabajo registrado")}</span></span>
                            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.statusClassName}`}>{valueOr(item.status, "Sin estado registrado")}</span>
                          </span>
                          <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                            <Meta label="Responsable" value={valueOr(item.responsible, "Sin responsable registrado")} />
                            <Meta label="Próxima visita" value={visitSummary(item)} />
                            <Meta label="Progreso" value={progressSummary(item)} />
                            <Meta label="Incidencias" value={incidentSummary(item)} danger={item.risk} />
                          </span>
                        </span>
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>

            <PortfolioSummary items={items} />
          </>
        ) : <p className="type-secondary p-6">Sin trabajos registrados.</p>}
      </section>

      {selected ? <aside className="hidden min-w-0 bg-surface min-[1440px]:block" aria-label={`Detalle de ${selected.title}`}><WorkDetail item={selected} onClose={closeDesktopDetail} /></aside> : null}

      {selected && drawerOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/45 p-0 min-[1440px]:hidden sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-2xl sm:rounded-xl"
          >
            <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-4 py-2">
              <div className="min-w-0">
                <p className="type-label">Detalle del trabajo</p>
                <h2
                  id={dialogTitleId}
                  className="truncate text-base font-bold text-content"
                >
                  {selected.title}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDrawer}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-content transition hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand"
                aria-label="Cerrar detalle"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <WorkDetail item={selected} compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkThumbnail({ item, large = false }: { item: WorkPortfolioItem; large?: boolean }) {
  const sizeClass = large ? "h-16 w-16" : "h-9 w-9";
  if (item.thumbnailUrl) {
    return <Image src={item.thumbnailUrl} alt={`Vista de ${item.title}`} width={large ? 64 : 36} height={large ? 64 : 36} unoptimized className={`${sizeClass} shrink-0 rounded-md border border-border object-cover`} />;
  }
  return <span role="img" aria-label={`Sin imagen registrada para ${item.title}`} className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-subtle text-content-secondary`}><BriefcaseBusiness size={large ? 24 : 18} aria-hidden="true" /></span>;
}

function TableProgress({ item }: { item: WorkPortfolioItem }) {
  const progress = normalizedProgress(item.progressPercent);
  if (progress == null) return <span className="block" aria-label="Avance no registrado"><strong className="block text-content-secondary">—</strong><span className="mt-1 block h-1.5 w-full rounded-full bg-border" /></span>;
  return <span><strong className="block text-content">{progress}%</strong><progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={progress}>{progress}%</progress></span>;
}

function IncidentCell({ item }: { item: WorkPortfolioItem }) {
  const count = item.incidentCount ?? item.incidentLabels?.length ?? 0;
  const tone = count >= 3 ? "bg-danger" : count >= 1 ? "bg-warning" : "bg-success";
  const textTone = count >= 3 ? "text-danger" : count >= 1 ? "text-warning" : "text-success";
  return <span className={`inline-flex items-center gap-1 font-bold ${textTone}`} aria-label={`${count} incidencias registradas`}><span className={`h-1.5 w-1.5 rounded-full ${tone}`} aria-hidden="true" />{count}</span>;
}

function FinancialSummary({ item }: { item: WorkPortfolioItem }) {
  if (item.budget == null && item.cost == null && item.margin == null) return <span className="text-content-secondary">Sin presupuesto/coste calculado</span>;
  return <span className="grid gap-0.5 leading-tight"><span className="block truncate text-content-secondary"><strong className="text-content">Pres.</strong> {item.budget ?? "—"}</span><span className="block truncate text-content-secondary"><strong className="text-content">Real</strong> {item.cost ?? "—"}</span>{item.margin != null ? <span className={`block truncate font-semibold ${item.marginRisk ? "text-danger" : "text-success"}`}>Margen {item.margin}</span> : null}</span>;
}

function PortfolioSummary({ items }: { items: WorkPortfolioItem[] }) {
  const allRiskItems = items.filter((item) => item.risk);
  const riskItems = allRiskItems.slice(0, 2);
  const activeItems = items.filter(isWorkInProgress);
  const allClosingItems = items.filter((item) => item.closingSoon === true);
  const closingItems = allClosingItems.slice(0, 2);
  const recordedProgress = activeItems.map((item) => normalizedProgress(item.progressPercent)).filter((value): value is number => value != null);
  const averageProgress = recordedProgress.length ? Math.round(recordedProgress.reduce((sum, value) => sum + value, 0) / recordedProgress.length) : null;
  const budgetAmounts = activeItems.map((item) => item.budgetAmount).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const totalBudget = budgetAmounts.length ? budgetAmounts.reduce((sum, value) => sum + value, 0) : null;

  return <div className="grid grid-cols-1 gap-2 border-t border-border bg-subtle p-3 md:grid-cols-2 min-[1200px]:grid-cols-3">
    <SummaryCard title="Trabajos en riesgo" count={allRiskItems.length}>
      {riskItems.length ? <ul className="space-y-1">{riskItems.map((item) => <li key={item.id}><Link href={`/obras/${item.id}`} className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[10px] font-semibold text-content hover:underline"><span className="truncate">{item.title}</span><span className="max-w-[8rem] truncate text-right text-danger">{item.riskReason ?? "Revisión operativa"}</span></Link></li>)}</ul> : <p className="type-meta">Sin trabajos en riesgo registrados.</p>}
    </SummaryCard>
    <SummaryCard title="Trabajos en curso" count={activeItems.length}>
      <div className="grid grid-cols-2 gap-3"><SummaryMetric label={averageProgress == null ? "Avance medio no calculado" : "Avance medio registrado"} value={averageProgress == null ? "—" : `${averageProgress}%`} /><SummaryMetric label={totalBudget == null ? "Presupuesto no disponible" : "Presupuesto registrado"} value={totalBudget == null ? "—" : formatCurrencyAmount(totalBudget)} /></div>
    </SummaryCard>
    <SummaryCard title="Trabajos por cerrar" count={allClosingItems.length}>
      {closingItems.length ? <ul className="space-y-1">{closingItems.map((item) => <li key={item.id}><Link href={`/obras/${item.id}`} className="flex min-h-7 items-center justify-between gap-2 text-[10px] font-semibold text-content hover:underline"><span className="truncate">{item.title}</span><span className="max-w-[8rem] truncate text-content-secondary">{valueOr(item.nextAction, "Sin siguiente acción registrada")}</span></Link></li>)}</ul> : <p className="type-meta">Sin trabajos por cerrar registrados.</p>}
    </SummaryCard>
  </div>;
}

function SummaryCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="flex min-h-[9.25rem] flex-col rounded-xl border border-border bg-surface p-3"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-bold text-content">{title}</h3><span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-brand-soft px-1.5 text-[10px] font-bold text-content">{count}</span></div><div className="min-h-0 flex-1 overflow-hidden">{children}</div><Link href="/obras" className="mt-2 inline-flex min-h-7 items-center justify-center rounded-lg border border-border text-[9px] font-semibold text-content hover:bg-subtle">Ver todos</Link></section>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><strong className="block truncate text-base text-content">{value}</strong><span className="mt-1 block text-[9px] leading-tight text-content-secondary">{label}</span></div>;
}

function DesktopWorkDetail({ item, onClose }: { item: WorkPortfolioItem; onClose?: () => void }) {
  const progress = normalizedProgress(item.progressPercent);
  const timeline = item.timeline?.slice(0, 6) ?? [];
  const team = item.team?.slice(0, 3) ?? [];
  const hasFinancialData = item.budget != null || item.cost != null || item.margin != null;
  const incidentCount = item.incidentCount ?? item.incidentLabels?.length ?? 0;

  return <div className="p-4">
    <header className="flex min-h-[4.5rem] items-start justify-between gap-3 border-b border-border pb-3">
      <div className="min-w-0"><h2 className="text-lg font-bold leading-tight text-content">{item.title}</h2><p className="type-meta mt-1 truncate">{item.client} · Ref. {valueOr(item.code, "sin código")}</p><span className={`mt-2 inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.statusClassName}`}>{item.status}</span></div>
      {onClose ? <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border text-content transition hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand" aria-label="Cerrar detalle"><X size={18} aria-hidden="true" /></button> : null}
    </header>

    <div className="mt-3 grid grid-cols-2 gap-2">
      <CompactDetail title="Etapa actual" icon={ClipboardCheck}>
        <strong className="flex items-center gap-2 text-xs text-content"><span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />{valueOr(item.progressLabel, "Sin etapa registrada")}</strong>
        {progress == null ? <span className="type-meta mt-1 block">Avance físico no registrado</span> : <><span className="type-meta mt-1 block">{progress}% registrado</span><progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={progress}>{progress}%</progress></>}
      </CompactDetail>
      <CompactDetail title="Próximo hito" icon={CalendarClock}>
        <strong className="flex items-start gap-2 text-xs text-content"><CalendarClock size={14} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />{item.visit ? valueOr(item.visit.label, "Visita registrada") : valueOr(item.nextAction, "Sin siguiente acción")}</strong>
        <span className="type-meta mt-1 block">{item.visit ? valueOr(item.visit.date, "Sin fecha registrada") : valueOr(item.nextDate, "Sin fecha registrada")}</span>
      </CompactDetail>

      <CompactDetail title="Línea de tiempo" icon={CheckCircle2} className="row-span-2">
        {timeline.length ? <WorkTimeline entries={timeline} /> : <p className="type-meta">Sin hitos registrados.</p>}
      </CompactDetail>
      <CompactDetail title="Incidencias registradas" icon={FileWarning} badge={String(incidentCount)}>
        {item.incidentLabels?.length ? <ul className="grid gap-2 text-[9px] text-content-secondary">{item.incidentLabels.slice(0, 2).map((label, index) => <li key={label} className="flex min-w-0 items-center gap-2"><FileWarning size={12} className={index === 0 ? "shrink-0 text-danger" : "shrink-0 text-warning"} aria-hidden="true" /><span className="truncate">{label}</span></li>)}</ul> : <p className="type-meta">0 registros vinculados</p>}
        <Link href={`/obras/${item.id}?vista=incidencias`} className="mt-2 inline-flex min-h-7 items-center text-[9px] font-semibold text-brand-strong hover:underline">Ver todas</Link>
      </CompactDetail>
      <CompactDetail title="Presupuesto vs Real" icon={CircleDollarSign}>
        {hasFinancialData ? <dl className="grid gap-1 text-[10px]"><CompactAmount label="Presupuesto" value={item.budget} /><CompactAmount label="Real" value={item.cost} /><CompactAmount label="Margen" value={item.margin} danger={item.marginRisk} /></dl> : <p className="type-meta">Datos económicos restringidos.</p>}
      </CompactDetail>
      <CompactDetail title="Equipo asignado" icon={UsersRound}>
        {team.length ? <ul className="grid gap-2">{team.map((member) => <li key={`${member.name}-${member.role}`} className="flex min-w-0 items-center gap-2 text-[10px]"><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={13} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate">{member.name}</strong><span className="block truncate text-[9px] text-content-secondary">{member.role ?? "Sin rol"}</span></span></li>)}</ul> : <p className="type-meta">Sin equipo registrado.</p>}
      </CompactDetail>
    </div>

    <section className="mt-3 rounded-lg border border-border p-3" aria-label="Acciones rápidas"><h3 className="text-[10px] font-bold text-content">Acciones rápidas</h3><div className="mt-2 grid grid-cols-3 gap-2"><Link href={`/obras/${item.id}`} className="secondary-button min-h-14 flex-col px-2 text-center text-[9px]"><FileText size={16} aria-hidden="true" />Ver ficha completa</Link>{item.actionHrefs?.part ? <Link href={item.actionHrefs.part} className="secondary-button min-h-14 flex-col px-2 text-center text-[9px]"><FilePlus2 size={16} aria-hidden="true" />Crear parte de obra</Link> : <span aria-disabled="true" className="secondary-button min-h-14 flex-col px-2 text-center text-[9px] opacity-60"><FilePlus2 size={16} aria-hidden="true" />Parte no disponible</span>}{item.actionHrefs?.incident ? <Link href={item.actionHrefs.incident} className="secondary-button min-h-14 flex-col px-2 text-center text-[9px]"><ClipboardPenLine size={16} aria-hidden="true" />Registrar incidencia</Link> : <span aria-disabled="true" className="secondary-button min-h-14 flex-col px-2 text-center text-[9px] opacity-60"><ClipboardPenLine size={16} aria-hidden="true" />Incidencia no disponible</span>}</div></section>
  </div>;
}

function CompactDetail({ title, icon: Icon, badge, className = "", children }: { title: string; icon: LucideIcon; badge?: string; className?: string; children: React.ReactNode }) {
  return <section className={`min-w-0 rounded-lg border border-border p-2.5 ${className}`}><div className="mb-2 flex min-w-0 items-start gap-1.5"><Icon size={13} className="mt-px shrink-0 text-brand-strong" aria-hidden="true" /><h3 className="min-w-0 flex-1 text-[9px] font-bold leading-tight text-content">{title}</h3>{badge != null ? <span className="ml-auto inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-warning/10 px-1.5 text-[9px] font-bold text-warning">{badge}</span> : null}</div>{children}</section>;
}

function WorkTimeline({ entries }: { entries: WorkPortfolioTimelineItem[] }) {
  return <ol className="relative grid gap-0 before:absolute before:bottom-2 before:left-[6px] before:top-2 before:w-px before:bg-border">{entries.map((entry, index) => { const current = index === entries.length - 1; return <li key={`${entry.label}-${index}`} className="relative grid min-h-10 grid-cols-[14px_minmax(0,1fr)] gap-2 pb-1.5 last:pb-0"><span className={`relative z-[1] mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-surface ${current ? "border-blue-600 text-blue-600" : "border-success text-success"}`} aria-hidden="true">{current ? <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> : <CheckCircle2 size={10} />}</span><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{entry.label}</strong><small className="mt-0.5 block truncate text-[8px] text-content-secondary">{entry.date ?? "Sin fecha"}</small>{entry.status ? <small className="block truncate text-[8px] text-content-secondary">{entry.status}</small> : null}</span></li>;})}</ol>;
}

function CompactAmount({ label, value, danger = false }: { label: string; value: string | null; danger?: boolean }) {
  if (value == null) return null;
  return <div className="flex justify-between gap-2"><dt className="text-content-secondary">{label}</dt><dd className={`font-semibold ${danger ? "text-danger" : "text-content"}`}>{value}</dd></div>;
}

function WorkDetail({
  item,
  compact = false,
  onClose,
}: {
  item: WorkPortfolioItem;
  compact?: boolean;
  onClose?: () => void;
}) {
  if (!compact) return <DesktopWorkDetail item={item} onClose={onClose} />;
  const progress = normalizedProgress(item.progressPercent);
  const hasFinancialData =
    item.budget != null ||
    item.cost != null ||
    item.pending != null ||
    item.margin != null;

  return (
    <div className={compact ? "p-4 sm:p-5" : "p-5"}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label">
            {valueOr(item.code, "Sin código registrado")}
          </p>
          <h2 className="type-section-title mt-2 text-content">
            {valueOr(item.title, "Sin título registrado")}
          </h2>
          <p className="type-secondary mt-1">
            {valueOr(item.client, "Sin cliente registrado")} ·{" "}
            {valueOr(item.workType, "Sin tipo de trabajo registrado")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold ${item.statusClassName}`}>{valueOr(item.status, "Sin estado registrado")}</span>
          {onClose ? <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-content transition hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand" aria-label="Cerrar detalle"><X size={20} aria-hidden="true" /></button> : null}
        </div>
      </header>

      <section
        className="mt-4 rounded-xl border border-border bg-subtle p-4"
        aria-label="Estado y progreso"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="type-label">Etapa actual</p>
            <p className="type-object-title mt-1 text-content">
              {valueOr(item.progressLabel, "Sin etapa registrada")}
            </p>
          </div>
          <p
            className={`text-sm font-bold ${item.risk ? "text-danger" : "text-content"}`}
          >
            Prioridad{" "}
            {valueOr(
              item.priority,
              "sin prioridad registrada",
            ).toLocaleLowerCase("es-ES")}
          </p>
        </div>
        {progress == null ? (
          <p className="type-secondary mt-3">Sin progreso registrado.</p>
        ) : (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-content-secondary">Avance registrado</span>
              <strong className="text-content">{progress}%</strong>
            </div>
            <progress
              className="h-2 w-full accent-brand"
              max={100}
              value={progress}
            >
              {progress}%
            </progress>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DetailSection icon={ClipboardCheck} title="Siguiente acción">
          <p className="font-semibold text-content">
            {valueOr(item.nextAction, "Sin siguiente acción registrada")}
          </p>
          <p className="type-secondary mt-1">
            {valueOr(item.nextDate, "Sin fecha registrada")}
          </p>
        </DetailSection>

        <DetailSection icon={CalendarClock} title="Próxima visita">
          {item.visit ? (
            <>
              <p className="font-semibold text-content">
                {valueOr(item.visit.label, "Sin detalle de visita registrado")}
              </p>
              <p className="type-secondary mt-1">
                {valueOr(item.visit.date, "Sin fecha de visita registrada")}
              </p>
              {item.visit.href ? (
                <Link
                  className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-strong underline underline-offset-4"
                  href={item.visit.href}
                >
                  Abrir visita
                </Link>
              ) : null}
            </>
          ) : (
            <p className="type-secondary">Sin visita registrada.</p>
          )}
        </DetailSection>

        <DetailSection icon={FileWarning} title="Incidencias registradas">
          {hasIncidentData(item) ? (
            <>
              {item.incidentCount != null ? (
                <p
                  className={`font-semibold ${item.incidentCount > 0 ? "text-danger" : "text-content"}`}
                >
                  {item.incidentCount} registros
                </p>
              ) : null}
              {item.incidentLabels?.length ? (
                <ul className="mt-2 space-y-1 text-sm text-content-secondary">
                  {item.incidentLabels.map((label, index) => (
                    <li key={`${label}-${index}`}>• {label}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="type-secondary">Sin registros de incidencia.</p>
          )}
        </DetailSection>

        <DetailSection icon={UsersRound} title="Equipo">
          {item.team?.length ? (
            <ul className="space-y-2">
              {item.team.map((member, index) => (
                <li key={`${member.name}-${index}`} className="text-sm">
                  <span className="font-semibold text-content">
                    {member.name}
                  </span>
                  <span className="text-content-secondary">
                    {" "}
                    · {valueOr(member.role, "Sin rol registrado")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-secondary">Sin equipo registrado.</p>
          )}
        </DetailSection>
      </div>

      <DetailSection
        className="mt-4"
        icon={BriefcaseBusiness}
        title="Hitos y cronología"
      >
        {item.timeline?.length ? (
          <ol className="space-y-3">
            {item.timeline.map((entry, index) => (
              <li
                key={`${entry.label}-${index}`}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2"
              >
                <CheckCircle2
                  size={17}
                  className="mt-0.5 text-brand-strong"
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold text-content">
                    {entry.label}
                  </span>
                  <span className="type-meta mt-0.5 block">
                    {valueOr(entry.date, "Sin fecha registrada")}
                    {entry.status ? ` · ${entry.status}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="type-secondary">Sin hitos registrados.</p>
        )}
      </DetailSection>

      {hasFinancialData ? (
        <section className="mt-4" aria-label="Información económica autorizada">
          <div className="mb-3 flex items-center gap-2">
            <CircleDollarSign
              size={18}
              className="text-brand-strong"
              aria-hidden="true"
            />
            <h3 className="font-bold text-content">
              Presupuesto y coste autorizados
            </h3>
          </div>
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {item.budget != null ? (
              <Fact
                icon={CircleDollarSign}
                label="Presupuesto"
                value={item.budget}
              />
            ) : null}
            {item.cost != null ? (
              <Fact icon={CircleDollarSign} label="Coste" value={item.cost} />
            ) : null}
            {item.pending != null ? (
              <Fact
                icon={CircleDollarSign}
                label="Pendiente"
                value={item.pending}
                danger={item.risk}
              />
            ) : null}
            {item.margin != null ? (
              <Fact
                icon={CircleDollarSign}
                label="Margen"
                value={item.margin}
                danger={item.marginRisk}
              />
            ) : null}
          </dl>
        </section>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact
          icon={UsersRound}
          label="Responsable"
          value={valueOr(item.responsible, "Sin responsable registrado")}
        />
        <Fact
          icon={MapPin}
          label="Próxima fecha"
          value={valueOr(item.nextDate, "Sin fecha registrada")}
        />
        <Fact
          icon={AlertTriangle}
          label="Materiales pendientes"
          value={String(item.pendingMaterials)}
          danger={item.pendingMaterials > 0}
        />
        <Fact
          icon={FileWarning}
          label="Documentos relacionados"
          value={String(item.pendingDocuments)}
        />
      </dl>

      {hasSecondaryActions(item.actionHrefs) ? (
        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Acciones del trabajo"
        >
          {item.actionHrefs?.part ? (
            <ActionLink href={item.actionHrefs.part}>
              Registrar parte
            </ActionLink>
          ) : null}
          {item.actionHrefs?.incident ? (
            <ActionLink href={item.actionHrefs.incident}>
              Registrar incidencia
            </ActionLink>
          ) : null}
          {item.actionHrefs?.visit ? (
            <ActionLink href={item.actionHrefs.visit}>
              Registrar visita
            </ActionLink>
          ) : null}
          {item.actionHrefs?.status ? (
            <ActionLink href={item.actionHrefs.status}>
              Cambiar estado
            </ActionLink>
          ) : null}
        </div>
      ) : null}

      <p className="type-meta mt-4">
        Última actualización:{" "}
        {valueOr(item.updatedAt, "Sin actualización registrada")}
      </p>
      <Link
        href={`/obras/${item.id}`}
        className={`${compact ? "secondary-button" : "primary-button"} mt-4 min-h-11 w-full`}
      >
        Abrir ficha completa
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-border p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} className="text-brand-strong" aria-hidden="true" />
        <h3 className="font-bold text-content">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ActionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="secondary-button min-h-11">
      {children}
    </Link>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <Icon
        size={16}
        className={danger ? "text-danger" : "text-brand-strong"}
        aria-hidden="true"
      />
      <dt className="type-meta mt-2">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm font-semibold ${danger ? "text-danger" : "text-content"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Meta({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <span className="min-w-0">
      <span className="type-meta block">{label}</span>
      <span
        className={`mt-0.5 block truncate text-sm font-semibold ${danger ? "text-danger" : "text-content-secondary"}`}
      >
        {value}
      </span>
    </span>
  );
}

function valueOr(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function normalizedProgress(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : null;
}

function progressSummary(item: WorkPortfolioItem) {
  const progress = normalizedProgress(item.progressPercent);
  if (progress != null)
    return `${progress}%${item.progressLabel ? ` · ${item.progressLabel}` : ""}`;
  return valueOr(item.progressLabel, "Sin progreso registrado");
}

function hasIncidentData(item: WorkPortfolioItem) {
  return item.incidentCount != null || Boolean(item.incidentLabels?.length);
}

function incidentSummary(item: WorkPortfolioItem) {
  if (item.incidentCount != null) return `${item.incidentCount} registros`;
  if (item.incidentLabels?.length)
    return `${item.incidentLabels.length} registros`;
  return "0 registros";
}

function teamSummary(item: WorkPortfolioItem) {
  if (!item.team?.length) return valueOr(item.responsible, "Sin equipo registrado");
  const [first, ...rest] = item.team;
  return rest.length ? `${first.name} +${rest.length}` : first.name;
}

function visitSummary(item: WorkPortfolioItem) {
  return item.visit ? valueOr(item.visit.date, "Sin fecha de visita registrada") : "Sin visita registrada";
}

function isWorkInProgress(item: WorkPortfolioItem) {
  return item.active === true;
}

function formatCurrencyAmount(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function hasSecondaryActions(
  actions: WorkPortfolioActionHrefs | null | undefined,
) {
  return Boolean(
    actions?.part || actions?.incident || actions?.visit || actions?.status,
  );
}
