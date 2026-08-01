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
  CircleDollarSign,
  ClipboardCheck,
  FileWarning,
  MapPin,
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
    setSelectedId("");
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }

  function closeDrawer() {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-surface shadow-soft ${selected ? "min-[1440px]:grid min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(19rem,20rem)]" : ""}`}>
      <section className={`min-w-0 border-border ${selected ? "min-[1440px]:border-r" : ""}`} aria-label="Trabajos filtrados">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-subtle px-4 py-3">
          <div>
            <p className="type-label">Trabajos visibles</p>
            <p className="type-meta mt-1">Selecciona un trabajo para consultar su contexto real.</p>
          </div>
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface px-3 text-sm font-bold text-content" aria-label={`${items.length} trabajos registrados`}>
            {items.length}
          </span>
        </div>

        {items.length ? (
          <>
            <div className="hidden min-[1440px]:block" aria-label="Listado de trabajos">
              <div aria-hidden="true" className="grid min-h-11 grid-cols-[minmax(7rem,2fr)_3.7rem_3.5rem_4.2rem_4.5rem_3.7rem_5.3rem] items-center gap-1 border-b border-border bg-surface px-3 text-[10px] font-semibold text-content-secondary">
                <span>Obra</span>
                <span>Estado</span>
                <span>Avance</span>
                <span>Equipo</span>
                <span>Próxima visita</span>
                <span>Incidencias</span>
                <span>Presupuesto vs Real</span>
              </div>
              <div className="divide-y divide-border" role="list">
                {items.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <article key={item.id} role="listitem">
                    <button type="button" aria-pressed={active} aria-label={`Abrir detalle de ${item.title}`} onClick={(event) => selectWork(item, event.currentTarget)} className={`grid min-h-[4.65rem] w-full grid-cols-[minmax(7rem,2fr)_3.7rem_3.5rem_4.2rem_4.5rem_3.7rem_5.3rem] items-center gap-1 px-3 text-left text-[10px] outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${active ? "bg-brand-soft" : "bg-surface"}`}>
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
                      <span className={item.risk ? "font-semibold text-danger" : "text-content-secondary"}>{incidentSummary(item)}</span>
                      <span className="min-w-0"><FinancialSummary item={item} /></span>
                    </button>
                    </article>
                  );
                })}
              </div>
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
  const sizeClass = large ? "h-16 w-16" : "h-11 w-12";
  if (item.thumbnailUrl) {
    return <Image src={item.thumbnailUrl} alt={`Vista de ${item.title}`} width={large ? 64 : 48} height={large ? 64 : 44} unoptimized className={`${sizeClass} shrink-0 rounded-lg border border-border object-cover`} />;
  }
  return <span role="img" aria-label={`Sin imagen registrada para ${item.title}`} className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-subtle text-content-secondary`}><BriefcaseBusiness size={large ? 24 : 18} aria-hidden="true" /></span>;
}

function TableProgress({ item }: { item: WorkPortfolioItem }) {
  const progress = normalizedProgress(item.progressPercent);
  if (progress == null) return <span className="text-content-secondary">Sin avance registrado</span>;
  return <span><strong className="block text-content">{progress}%</strong><progress className="mt-1 h-1.5 w-full accent-brand" max={100} value={progress}>{progress}%</progress></span>;
}

function FinancialSummary({ item }: { item: WorkPortfolioItem }) {
  if (item.budget == null && item.cost == null && item.margin == null) return <span className="text-content-secondary">Sin presupuesto/coste calculado</span>;
  return <span><span className="block truncate font-semibold text-content">{item.budget ?? "Sin presupuesto calculado"} vs {item.cost ?? "Sin coste calculado"}</span>{item.margin != null ? <span className={`mt-0.5 block truncate font-semibold ${item.marginRisk ? "text-danger" : "text-success"}`}>{item.margin}</span> : null}</span>;
}

function PortfolioSummary({ items }: { items: WorkPortfolioItem[] }) {
  const riskItems = items.filter((item) => item.risk).slice(0, 2);
  const activeItems = items.filter(isWorkInProgress);
  const closingItems = items.filter((item) => item.closingSoon === true).slice(0, 2);
  const recordedProgress = activeItems.map((item) => normalizedProgress(item.progressPercent)).filter((value): value is number => value != null);
  const averageProgress = recordedProgress.length ? Math.round(recordedProgress.reduce((sum, value) => sum + value, 0) / recordedProgress.length) : null;
  const budgetAmounts = activeItems.map((item) => item.budgetAmount).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const totalBudget = budgetAmounts.length ? budgetAmounts.reduce((sum, value) => sum + value, 0) : null;

  return <div className="grid grid-cols-1 gap-3 border-t border-border bg-subtle p-3 md:grid-cols-2 min-[1200px]:grid-cols-3">
    <SummaryCard title="Trabajos en riesgo" count={riskItems.length}>
      {riskItems.length ? <ul className="space-y-2">{riskItems.map((item) => <li key={item.id}><Link href={`/obras/${item.id}`} className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-content hover:underline"><span className="truncate">{item.title}</span><span className="shrink-0 text-danger">{item.margin ?? item.cost ?? "Sin margen/coste calculado"}</span></Link></li>)}</ul> : <p className="type-secondary">Sin trabajos en riesgo registrados.</p>}
    </SummaryCard>
    <SummaryCard title="Trabajos en curso" count={activeItems.length}>
      <div className="grid grid-cols-2 gap-3"><SummaryMetric label="Avance medio registrado" value={averageProgress == null ? "Sin avance calculado" : `${averageProgress}%`} /><SummaryMetric label="Presupuesto registrado" value={totalBudget == null ? "Sin presupuesto calculado" : formatCurrencyAmount(totalBudget)} /></div>
    </SummaryCard>
    <SummaryCard title="Trabajos por cerrar" count={closingItems.length}>
      {closingItems.length ? <ul className="space-y-2">{closingItems.map((item) => <li key={item.id}><Link href={`/obras/${item.id}`} className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-content hover:underline"><span className="truncate">{item.title}</span><span className="shrink-0 text-content-secondary">{valueOr(item.nextAction, "Sin siguiente acción registrada")}</span></Link></li>)}</ul> : <p className="type-secondary">Sin trabajos por cerrar registrados.</p>}
    </SummaryCard>
  </div>;
}

function SummaryCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-surface p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-content">{title}</h3><span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-brand-soft px-2 text-xs font-bold text-content">{count}</span></div>{children}</section>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div><strong className="block text-lg text-content">{value}</strong><span className="type-meta mt-1 block">{label}</span></div>;
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

        <DetailSection icon={FileWarning} title="Incidencias">
          {hasIncidentData(item) ? (
            <>
              {item.incidentCount != null ? (
                <p
                  className={`font-semibold ${item.incidentCount > 0 ? "text-danger" : "text-content"}`}
                >
                  {item.incidentCount} registradas
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
            <p className="type-secondary">Sin incidencias registradas.</p>
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
  if (item.incidentCount != null) return `${item.incidentCount} registradas`;
  if (item.incidentLabels?.length)
    return `${item.incidentLabels.length} registradas`;
  return "Sin incidencias registradas";
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
