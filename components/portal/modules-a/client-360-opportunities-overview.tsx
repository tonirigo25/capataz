import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Target,
  UserRound,
} from "lucide-react";

export type ClientOpportunityTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

export type ClientOpportunityAction = {
  label: string;
  href: string | null;
  allowed: boolean;
  icon?: "more" | "view";
};

export type ClientOpportunityMetric = {
  value: number | null;
  detail?: string | null;
  tone?: ClientOpportunityTone;
};

export type ClientOpportunitySummary = {
  /** Must equal scope.clientId. */
  clientId: string;
  totalCount: ClientOpportunityMetric;
  totalValue: ClientOpportunityMetric;
  weightedValue: ClientOpportunityMetric;
  averageProbabilityPercent: ClientOpportunityMetric;
  wonCount: ClientOpportunityMetric;
};

export type ClientOpportunityRecord = {
  id: string;
  /** Must equal scope.clientId. */
  clientId: string;
  title: string | null;
  amount: number | null;
  probabilityPercent: number | null;
  nextStep?: string | null;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  dateLabel?: string | null;
  dateTone?: ClientOpportunityTone;
  statusLabel?: string | null;
  statusTone?: ClientOpportunityTone;
  openAction?: ClientOpportunityAction | null;
  moreAction?: ClientOpportunityAction | null;
};

export type ClientOpportunityStage = {
  id: string;
  /** Must equal scope.clientId. */
  clientId: string;
  label: string;
  count: number | null;
  totalAmount: number | null;
  tone?: ClientOpportunityTone;
  opportunities: ClientOpportunityRecord[];
  addAction?: ClientOpportunityAction | null;
  moreAction?: ClientOpportunityAction | null;
};

export type ClientOpportunityFilterOption = {
  value: string;
  label: string;
};

export type ClientOpportunitySelectFilter = {
  name: string;
  label: string;
  value?: string;
  options: ClientOpportunityFilterOption[];
};

export type ClientOpportunityFilters = {
  allowed: boolean;
  actionHref: string | null;
  searchName?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  responsible?: ClientOpportunitySelectFilter | null;
  status?: ClientOpportunitySelectFilter | null;
  segment?: ClientOpportunitySelectFilter | null;
  hiddenFields?: Array<{ name: string; value: string }>;
  submitLabel?: string;
  moreAction?: ClientOpportunityAction | null;
};

export type Client360OpportunitiesOverviewProps = {
  scope: {
    clientId: string | null;
    clientName: string | null;
    /** Set only after the server has authorized and scoped the query. */
    verifiedClientScope: boolean;
  };
  summary: ClientOpportunitySummary | null;
  stages: ClientOpportunityStage[] | null;
  currency: string | null;
  breadcrumbs?: ClientOpportunityAction[];
  actions?: {
    export?: ClientOpportunityAction | null;
    create?: ClientOpportunityAction | null;
    convertToBudget?: ClientOpportunityAction | null;
  };
  filters?: ClientOpportunityFilters | null;
  views?: {
    board?: ClientOpportunityAction | null;
    list?: ClientOpportunityAction | null;
    active: "board" | "list";
  } | null;
  className?: string;
};

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const metricDefinitions: Array<{
  key: keyof Omit<ClientOpportunitySummary, "clientId">;
  label: string;
  format: "count" | "money" | "percent";
}> = [
  { key: "totalCount", label: "Total oportunidades", format: "count" },
  { key: "totalValue", label: "Valor total", format: "money" },
  { key: "weightedValue", label: "Valor ponderado", format: "money" },
  { key: "averageProbabilityPercent", label: "Probabilidad media", format: "percent" },
  { key: "wonCount", label: "Oportunidades ganadas", format: "count" },
];

/**
 * Cliente 360 opportunity board.
 *
 * This component never consumes or reconstructs a global pipeline. Summary,
 * stage and card values must already be authorized and scoped to one client.
 * Any scope mismatch blocks the complete data view.
 */
export function Client360OpportunitiesOverview({
  scope,
  summary,
  stages,
  currency,
  breadcrumbs = [],
  actions,
  filters,
  views,
  className = "",
}: Client360OpportunitiesOverviewProps) {
  const scopedStages = stages ?? [];
  const scopeAccepted = hasVerifiedScope(scope, summary, scopedStages);
  const money = createMoneyFormatter(currency);

  if (!scopeAccepted) {
    return (
      <section
        className={`grid min-h-64 place-content-center justify-items-center rounded-xl border border-danger/25 bg-danger/5 p-6 text-center ${className}`}
        aria-labelledby="client-opportunities-scope-title"
      >
        <Target size={24} className="text-danger" aria-hidden="true" />
        <h2 id="client-opportunities-scope-title" className="mt-3 text-sm font-black text-content">
          Oportunidades no disponibles
        </h2>
        <p className="mt-2 max-w-md text-xs leading-5 text-content-secondary">
          No se recibió un alcance de cliente autorizado y coherente. Esta vista no utiliza datos del pipeline global.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`grid min-w-0 gap-4 ${className}`}
      aria-labelledby="client-opportunities-title"
      data-client-id={scope.clientId}
      data-client-opportunities-overview
    >
      <header className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}
          <h2 id="client-opportunities-title" className="mt-1 text-xl font-black tracking-tight text-content sm:text-2xl">
            Cliente 360 · Oportunidades
          </h2>
          <p className="mt-1 truncate text-xs font-semibold text-content-secondary" title={scope.clientName ?? undefined}>
            {scope.clientName?.trim() || "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end" aria-label="Acciones de oportunidades del cliente">
          <ActionLink action={actions?.export} icon={Download} />
          <ActionLink action={actions?.create} icon={ChevronDown} primary iconPosition="end" />
          <ActionLink action={actions?.convertToBudget} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Indicadores recibidos de oportunidades del cliente">
        {metricDefinitions.map((definition) => (
          <MetricCard
            key={definition.key}
            label={definition.label}
            metric={summary[definition.key]}
            format={definition.format}
            money={money}
          />
        ))}
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        {filters?.allowed && safeHref(filters.actionHref) ? (
          <OpportunityFilters filters={filters} />
        ) : (
          <p className="flex min-h-11 items-center text-[10px] text-content-secondary">No hay filtros autorizados para esta vista.</p>
        )}
        {views ? <ViewSwitch views={views} /> : null}
      </div>

      {scopedStages.length ? views?.active === "list" ? (
        <OpportunityList stages={scopedStages} money={money} />
      ) : (
        <div
          className="grid min-w-0 auto-cols-[minmax(14rem,82vw)] grid-flow-col gap-2 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-6 xl:auto-cols-auto"
          tabIndex={0}
          role="region"
          aria-label="Tablero desplazable de oportunidades de este cliente"
        >
          {scopedStages.map((stage) => (
            <OpportunityColumn key={stage.id} stage={stage} money={money} />
          ))}
        </div>
      ) : (
        <HonestEmpty
          title="No hay fases informadas"
          detail="No se ha recibido un tablero autorizado para este cliente."
        />
      )}
    </section>
  );
}

function Breadcrumbs({ items }: { items: ClientOpportunityAction[] }) {
  const visibleItems = items.filter(canRenderAction);
  if (!visibleItems.length) return null;

  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[10px] font-semibold text-content-secondary">
        {visibleItems.map((item, index) => (
          <li key={`${item.href}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {index ? <ChevronRight size={12} aria-hidden="true" /> : null}
            <Link href={item.href!} className="max-w-36 truncate hover:text-content hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function MetricCard({
  label,
  metric,
  format,
  money,
}: {
  label: string;
  metric: ClientOpportunityMetric;
  format: "count" | "money" | "percent";
  money: Intl.NumberFormat | null;
}) {
  const value = formatMetric(metric.value, format, money);
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3">
      <h3 className="min-w-0 text-[10px] font-semibold leading-4 text-content-secondary">{label}</h3>
      <strong className="mt-2 block truncate text-xl font-black tabular-nums text-content" title={value}>
        {value}
      </strong>
      <p className={`mt-1 min-h-4 truncate text-[9px] ${toneText(metric.tone)}`} title={metric.detail ?? undefined}>
        {metric.detail ?? "—"}
      </p>
    </article>
  );
}

function OpportunityFilters({ filters }: { filters: ClientOpportunityFilters }) {
  return (
    <form action={filters.actionHref!} method="get" className="grid min-w-0 gap-2 md:grid-cols-[minmax(12rem,1fr)_auto]">
      {filters.hiddenFields?.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-content-secondary">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Buscar oportunidad</span>
        <input
          type="search"
          name={filters.searchName ?? "q"}
          defaultValue={filters.searchValue}
          placeholder={filters.searchPlaceholder ?? "Buscar oportunidad…"}
          className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none placeholder:text-content-tertiary"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {filters.responsible ? <SelectFilter filter={filters.responsible} /> : null}
        {filters.status ? <SelectFilter filter={filters.status} /> : null}
        {filters.segment ? <SelectFilter filter={filters.segment} /> : null}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[10px] font-bold text-content hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Search size={14} aria-hidden="true" />
          {filters.submitLabel ?? "Aplicar"}
        </button>
        <ActionLink action={filters.moreAction} icon={Filter} />
      </div>
    </form>
  );
}

function SelectFilter({ filter }: { filter: ClientOpportunitySelectFilter }) {
  return (
    <label className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[10px] text-content-secondary">
      <span className="font-semibold">{filter.label}:</span>
      <select name={filter.name} defaultValue={filter.value ?? ""} className="max-w-32 border-0 bg-transparent font-bold text-content outline-none">
        <option value="">Todos</option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ViewSwitch({
  views,
}: {
  views: NonNullable<Client360OpportunitiesOverviewProps["views"]>;
}) {
  return (
    <nav className="flex items-center gap-1 justify-self-start rounded-lg border border-border bg-subtle p-1 lg:justify-self-end" aria-label="Vista de oportunidades">
      <ViewLink action={views.board} icon={LayoutGrid} active={views.active === "board"} fallbackLabel="Tablero" />
      <ViewLink action={views.list} icon={List} active={views.active === "list"} fallbackLabel="Lista" />
    </nav>
  );
}

function ViewLink({
  action,
  icon: Icon,
  active,
  fallbackLabel,
}: {
  action?: ClientOpportunityAction | null;
  icon: Icon;
  active: boolean;
  fallbackLabel: string;
}) {
  if (!canRenderAction(action)) return null;
  return (
    <Link
      href={action.href}
      aria-label={action.label || fallbackLabel}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? "bg-surface text-brand shadow-sm" : "text-content-secondary hover:text-content"}`}
    >
      <Icon size={15} aria-hidden="true" />
    </Link>
  );
}

function OpportunityColumn({ stage, money }: { stage: ClientOpportunityStage; money: Intl.NumberFormat | null }) {
  return (
    <section className={`flex min-h-[24rem] min-w-0 flex-col rounded-xl border ${toneColumn(stage.tone)}`} aria-labelledby={`opportunity-stage-${safeId(stage.id)}`}>
      <header className="border-b border-current/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id={`opportunity-stage-${safeId(stage.id)}`} className="flex min-w-0 items-center gap-2 text-[10px] font-black text-content">
              <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(stage.tone)}`} aria-hidden="true" />
              <span className="truncate">{stage.label.trim() || "—"}</span>
              <span className="rounded-full bg-surface/80 px-1.5 py-0.5 text-[8px] tabular-nums text-content-secondary">
                {formatCount(stage.count)}
              </span>
            </h3>
            <p className="mt-1 text-[9px] font-bold tabular-nums text-content-secondary">{formatMoney(stage.totalAmount, money)}</p>
          </div>
          <IconAction action={stage.moreAction} icon={MoreHorizontal} />
        </div>
      </header>

      <div className="grid content-start gap-2 p-2">
        {stage.opportunities.length ? (
          stage.opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} money={money} />
          ))
        ) : (
          <div className="grid min-h-28 place-content-center rounded-lg border border-dashed border-border bg-surface/50 p-3 text-center">
            <p className="text-[9px] text-content-secondary">Sin oportunidades informadas en esta fase.</p>
          </div>
        )}
      </div>

      {canRenderAction(stage.addAction) ? (
        <Link
          href={stage.addAction.href}
          className="mx-2 mb-2 mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface/50 px-2 text-[9px] font-bold text-content-secondary hover:border-brand hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Plus size={13} aria-hidden="true" />
          {stage.addAction.label}
        </Link>
      ) : null}
    </section>
  );
}

function OpportunityCard({ opportunity, money }: { opportunity: ClientOpportunityRecord; money: Intl.NumberFormat | null }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-[10px] font-black leading-4 text-content">
            {canRenderAction(opportunity.openAction) ? (
              <Link href={opportunity.openAction.href} className="hover:text-brand-strong hover:underline">
                {opportunity.title ?? "—"}
              </Link>
            ) : opportunity.title ?? "—"}
          </h4>
          <strong className="mt-1 block truncate text-xs font-black tabular-nums text-content">
            {formatMoney(opportunity.amount, money)}
          </strong>
        </div>
        <IconAction action={opportunity.moreAction} icon={MoreHorizontal} />
      </div>

      {opportunity.statusLabel ? (
        <span className={`mt-2 inline-flex min-h-6 items-center gap-1 rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(opportunity.statusTone)}`}>
          {opportunity.statusTone === "success" ? <Check size={11} aria-hidden="true" /> : null}
          {opportunity.statusLabel}
        </span>
      ) : null}

      <dl className="mt-3 grid gap-2 border-t border-border pt-2">
        {finite(opportunity.probabilityPercent) ? <div className="flex min-w-0 items-baseline gap-1 text-[8px]">
          <dt className="shrink-0 text-content-secondary">Probabilidad:</dt>
          <dd className="truncate font-semibold text-content">{formatPercent(opportunity.probabilityPercent)}</dd>
        </div> : null}
        {opportunity.nextStep ? (
          <div className="min-w-0 text-[8px] leading-4">
            <dt className="inline text-content-secondary">Próximo paso: </dt>
            <dd className="inline font-semibold text-content">{opportunity.nextStep}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex min-w-0 items-end justify-between gap-2 border-t border-border pt-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <UserRound size={12} className="shrink-0 text-content-secondary" aria-hidden="true" />
          <span className="min-w-0">
            <strong className="block truncate text-[8px] text-content">{opportunity.responsibleName ?? "—"}</strong>
            {opportunity.responsibleRole ? <span className="block truncate text-[7px] text-content-secondary">{opportunity.responsibleRole}</span> : null}
          </span>
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-right text-[8px] font-semibold ${toneText(opportunity.dateTone)}`}>
          {opportunity.dateLabel && (opportunity.dateTone === "warning" || opportunity.dateTone === "danger") ? <CalendarClock size={11} aria-hidden="true" /> : null}
          {opportunity.dateLabel ?? "—"}
        </span>
      </div>
    </article>
  );
}

function OpportunityList({ stages, money }: { stages: ClientOpportunityStage[]; money: Intl.NumberFormat | null }) {
  const rows = stages.flatMap((stage) => stage.opportunities.map((opportunity) => ({ stage, opportunity })));
  if (!rows.length) return <HonestEmpty title="No hay oportunidades registradas" detail="Los presupuestos del cliente aparecerán aquí cuando existan." />;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="hidden grid-cols-[minmax(13rem,1.35fr)_minmax(7rem,.65fr)_minmax(7rem,.6fr)_minmax(11rem,1fr)_minmax(8rem,.7fr)_3rem] gap-3 border-b border-border bg-subtle px-3 py-2 text-[8px] font-bold uppercase tracking-wide text-content-tertiary lg:grid">
        <span>Oportunidad</span><span>Etapa</span><span>Importe</span><span>Próxima acción</span><span>Validez</span><span className="sr-only">Abrir</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ stage, opportunity }) => (
          <article key={opportunity.id} className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(13rem,1.35fr)_minmax(7rem,.65fr)_minmax(7rem,.6fr)_minmax(11rem,1fr)_minmax(8rem,.7fr)_3rem] lg:items-center">
            <div className="min-w-0"><strong className="block truncate text-[10px] text-content">{opportunity.title ?? "—"}</strong>{opportunity.statusLabel ? <span className={`mt-1 inline-flex min-h-5 items-center rounded-md border px-1.5 text-[8px] font-bold ${toneBadge(opportunity.statusTone)}`}>{opportunity.statusLabel}</span> : null}</div>
            <span className={`w-fit rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(stage.tone)}`}>{stage.label}</span>
            <strong className="text-[10px] tabular-nums text-content">{formatMoney(opportunity.amount, money)}</strong>
            <span className="text-[9px] leading-4 text-content-secondary">{opportunity.nextStep ?? "Sin próximo paso registrado"}</span>
            <span className={`text-[9px] ${toneText(opportunity.dateTone)}`}>{opportunity.dateLabel ?? "—"}</span>
            <IconAction action={opportunity.openAction} icon={Eye} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ActionLink({ action, icon: Icon, primary = false, iconPosition = "start" }: { action?: ClientOpportunityAction | null; icon?: Icon; primary?: boolean; iconPosition?: "start" | "end" }) {
  if (!canRenderAction(action)) return null;
  return (
    <Link
      href={action.href}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}
    >
      {Icon && iconPosition === "start" ? <Icon size={15} aria-hidden="true" /> : null}
      {action.label}
      {Icon && iconPosition === "end" ? <Icon size={14} aria-hidden="true" /> : null}
    </Link>
  );
}

function IconAction({ action, icon: Icon }: { action?: ClientOpportunityAction | null; icon: Icon }) {
  if (!canRenderAction(action)) return null;
  const ActionIcon = action.icon === "view" ? Eye : Icon;
  return (
    <Link
      href={action.href}
      aria-label={action.label}
      title={action.label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <ActionIcon size={15} aria-hidden="true" />
    </Link>
  );
}

function HonestEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-64 place-content-center justify-items-center rounded-xl border border-dashed border-border bg-surface p-6 text-center">
      <Target size={22} className="text-content-tertiary" aria-hidden="true" />
      <h3 className="mt-3 text-xs font-black text-content">{title}</h3>
      <p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p>
    </div>
  );
}

function hasVerifiedScope(
  scope: Client360OpportunitiesOverviewProps["scope"],
  summary: ClientOpportunitySummary | null,
  stages: ClientOpportunityStage[],
): summary is ClientOpportunitySummary {
  if (!scope.verifiedClientScope || !scope.clientId || !summary || summary.clientId !== scope.clientId) return false;
  return stages.every(
    (stage) => stage.clientId === scope.clientId
      && stage.opportunities.every((opportunity) => opportunity.clientId === scope.clientId),
  );
}

function canRenderAction(action: ClientOpportunityAction | null | undefined): action is ClientOpportunityAction & { href: string } {
  return Boolean(action?.allowed && safeHref(action.href) && action.label.trim());
}

function safeHref(href: string | null | undefined): href is string {
  return Boolean(href && (href.startsWith("/") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")));
}

function createMoneyFormatter(currency: string | null) {
  if (!currency?.trim()) return null;
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return null;
  }
}

function formatMetric(value: number | null, format: "count" | "money" | "percent", money: Intl.NumberFormat | null) {
  if (format === "money") return formatMoney(value, money);
  if (format === "percent") return formatPercent(value);
  return formatCount(value);
}

function formatMoney(value: number | null, formatter: Intl.NumberFormat | null) {
  return finite(value) && formatter ? formatter.format(value) : "—";
}

function formatCount(value: number | null) {
  return finite(value) && Number.isInteger(value) && value >= 0 ? new Intl.NumberFormat("es-ES").format(value) : "—";
}

function formatPercent(value: number | null) {
  return finite(value) && value >= 0 && value <= 100
    ? `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} %`
    : "—";
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function toneText(tone?: ClientOpportunityTone) {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "info" || tone === "brand") return "text-brand-strong";
  return "text-content-secondary";
}

function toneBadge(tone?: ClientOpportunityTone) {
  if (tone === "success") return "border-success/20 bg-success/10 text-success";
  if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning";
  if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger";
  if (tone === "info" || tone === "brand") return "border-brand/20 bg-brand-soft text-brand-strong";
  return "border-border bg-subtle text-content-secondary";
}

function toneColumn(tone?: ClientOpportunityTone) {
  if (tone === "success") return "border-success/20 bg-success/5";
  if (tone === "warning") return "border-warning/20 bg-warning/5";
  if (tone === "danger") return "border-danger/20 bg-danger/5";
  if (tone === "info" || tone === "brand") return "border-brand/20 bg-brand-soft/40";
  return "border-border bg-subtle/60";
}

function toneDot(tone?: ClientOpportunityTone) {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "info" || tone === "brand") return "bg-brand";
  return "bg-content-tertiary";
}
