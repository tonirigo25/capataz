import Link from "next/link";
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Info,
  Lightbulb,
  PauseCircle,
  Search,
  ShieldAlert,
  SlidersHorizontal
} from "lucide-react";
import { dismissSignalAction, resolveSignalAction, snoozeSignalAction } from "@/app/(app)/alertas/actions";
import { CompactFilterBar, EmptyState, PageHeader, ResultCount } from "@/components/ui-primitives";
import {
  formatSignalLevel,
  getBusinessSignals,
  signalSourceLabel,
  signalStatusLabel,
  type BusinessSignal,
  type BusinessSignalGroup,
  type BusinessSignalLevel,
  type BusinessSignalSource,
  type BusinessSignalStatus
} from "@/lib/business-signals";
import { requireCompanyContext } from "@/lib/auth/session";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type AlertsSearchParams = {
  estado?: string;
  nivel?: string;
  origen?: string;
  q?: string;
};

const STATUS_OPTIONS: Array<{ value: BusinessSignalStatus | "all" | "history"; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "snoozed", label: "Pospuestas" },
  { value: "dismissed", label: "Descartadas" },
  { value: "resolved", label: "Resueltas" },
  { value: "expired", label: "Expiradas" },
  { value: "history", label: "Histórico" },
  { value: "all", label: "Todas" }
];

const LEVEL_OPTIONS: Array<{ value: BusinessSignalLevel | "all"; label: string }> = [
  { value: "all", label: "Todos los niveles" },
  { value: "critico", label: "CRÍTICO" },
  { value: "importante", label: "IMPORTANTE" },
  { value: "atencion", label: "ATENCIÓN" },
  { value: "info", label: "INFO" }
];

const SOURCE_OPTIONS: Array<{ value: BusinessSignalSource | "all"; label: string }> = [
  "all",
  "crm",
  "obras",
  "facturas",
  "cobros",
  "tesoreria",
  "agenda",
  "documentos",
  "materiales",
  "rentabilidad",
  "recordatorios",
  "visitas",
  "gastos",
  "presupuestos",
  "datos"
].map((value) => ({ value: value as BusinessSignalSource | "all", label: value === "all" ? "Todos los orígenes" : signalSourceLabel(value as BusinessSignalSource) }));

export default async function AlertsPage({
  searchParams
}: {
  searchParams: Promise<AlertsSearchParams>;
}) {
  const query = await searchParams;
  const estado = validStatus(query.estado);
  const nivel = validLevel(query.nivel);
  const origen = validSource(query.origen);
  const q = query.q?.trim() ?? "";
  const { companyId } = await requireCompanyContext();
  const result = await getBusinessSignals({ companyId, status: estado, level: nivel, source: origen, q, limit: 250 });

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Director de operaciones"
        title="Centro de alertas"
        description="Riesgos, prioridades y datos que requieren atención. Orqena prepara acciones para que puedas revisarlas antes de confirmar."
        badge={<span className="rounded-full bg-obra-yellow px-3 py-1 text-xs font-black text-obra-ink">{result.summary.active} activas</span>}
        secondaryActions={<Link href="/recomendaciones" className="secondary-button"><Lightbulb size={18} /> Ver recomendaciones</Link>}
      >
        <CompactFilterBar><form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]" action="/alertas">
          <FilterSelect name="estado" label="Estado" value={estado} options={STATUS_OPTIONS} />
          <FilterSelect name="nivel" label="Nivel" value={nivel} options={LEVEL_OPTIONS} />
          <FilterSelect name="origen" label="Origen" value={origen} options={SOURCE_OPTIONS} />
          <label className="block">
            <span className="label mb-1 block">Buscar</span>
            <span className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field min-h-11 pl-10" name="q" placeholder="Cliente, obra, factura, regla..." defaultValue={q} />
            </span>
          </label>
          <button className="secondary-button self-end" type="submit">
            <SlidersHorizontal size={18} />
            Filtrar
          </button>
        </form></CompactFilterBar>
      </PageHeader>

      <ResultCount shown={result.signals.length} total={result.signals.length} noun="alertas" />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label="Activas" value={result.summary.active} icon={ShieldAlert} tone="warning" />
        <Metric label="Críticas" value={result.summary.critical} icon={AlertTriangle} tone="danger" />
        <Metric label="Importantes" value={result.summary.important} icon={Info} tone="warning" />
        <Metric label="Pospuestas" value={result.summary.snoozed} icon={PauseCircle} tone="neutral" />
        <Metric label="Resueltas" value={result.summary.resolved} icon={CheckCircle2} tone="success" />
        <Metric label="Expiradas" value={result.summary.expired} icon={Clock3} tone="neutral" />
        <Metric label="Impacto activo" value={formatCurrency(result.summary.totalAmount)} icon={Clock3} tone="neutral" />
      </section>

      {result.summary.top ? (
        <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black uppercase">
                <AlertTriangle size={18} />
                Prioridad principal · {result.summary.top.levelText}
              </p>
              <h2 className="mt-2 text-xl font-black">{result.summary.top.title}</h2>
              <p className="mt-1 text-sm leading-6">{result.summary.top.explanation.why}</p>
            </div>
            {result.summary.top.entity ? (
              <Link href={result.summary.top.entity.href} className="secondary-button bg-white">
                Abrir dato
                <ChevronRight size={18} />
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Agrupación</p>
            <h2 className="text-xl font-black text-obra-ink">Señales agrupadas por tipo y estado</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Cada grupo muestra como máximo las 3 señales principales para evitar ruido.</p>
          </div>
          <p className="text-sm font-bold text-slate-500">Generado {formatDate(result.generatedAt)}</p>
        </div>

        {result.groups.length ? (
          <div className="grid gap-4">
            {result.groups.map((group) => (
              <SignalGroupCard key={group.key} group={group} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No hay señales con estos filtros"
            description="Puedes ampliar estado, nivel u origen. Las señales descartadas o resueltas siguen en histórico; no se borran."
            icon={BellOff}
          />
        )}
      </section>
    </main>
  );
}

function SignalGroupCard({ group }: { group: BusinessSignalGroup }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{signalSourceLabel(group.source)} · {formatSignalLevel(group.level)} · prioridad {group.maxScore}</p>
          <h3 className="mt-1 text-lg font-black text-obra-ink">{group.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{group.explanation}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-60">
          <Mini label="Señales" value={group.count} />
          <Mini label="Impacto" value={group.totalAmount ? formatCurrency(group.totalAmount) : "Sin importe"} />
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {group.topSignals.map((signal) => (
          <SignalCard key={signal.fingerprint} signal={signal} />
        ))}
      </div>
    </section>
  );
}

function SignalCard({ signal }: { signal: BusinessSignal }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-slate-500">
            <span>{signal.levelText}</span>
            <span>·</span>
            <span>{signalStatusLabel(signal.status)}</span>
            <span>·</span>
            <span>{signal.fecha ? formatDate(signal.fecha) : "Sin fecha"}</span>
          </p>
          <h4 className="mt-1 text-base font-black text-obra-ink">{signal.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">{signal.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            <span className="rounded-full bg-white px-2.5 py-1">Prioridad {signal.prioridad}/100</span>
            <span className="rounded-full bg-white px-2.5 py-1">{signal.sourceLabel}</span>
            {signal.relatedAmount ? <span className="rounded-full bg-white px-2.5 py-1">{formatCurrency(signal.relatedAmount)}</span> : null}
            {signal.snoozedUntil ? <span className="rounded-full bg-white px-2.5 py-1">Hasta {formatDate(signal.snoozedUntil)}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {signal.entity ? (
            <Link href={signal.entity.href} className="secondary-button min-h-10 px-3 py-1 text-xs">
              Abrir
              <ChevronRight size={16} />
            </Link>
          ) : null}
          {signal.status !== "resolved" ? (
            <>
              <form action={snoozeSignalAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="fingerprint" value={signal.fingerprint} />
                <button className="secondary-button min-h-10 px-3 py-1 text-xs" name="preset" value="tomorrow" type="submit">Mañana</button>
                <button className="secondary-button min-h-10 px-3 py-1 text-xs" name="preset" value="week" type="submit">Esta semana no</button>
              </form>
              <form action={resolveSignalAction}>
                <input type="hidden" name="fingerprint" value={signal.fingerprint} />
                <button className="secondary-button min-h-10 px-3 py-1 text-xs" type="submit">Resolver</button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-black text-obra-ink">Por qué aparece</summary>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 lg:grid-cols-2">
          <div>
            <p className="font-black text-obra-ink">Explicación</p>
            <p className="mt-1">{signal.explanation.why}</p>
            <p className="mt-3 font-black text-obra-ink">Regla aplicada</p>
            <p className="mt-1">{signal.explanation.rule}</p>
            <p className="mt-3 font-black text-obra-ink">Si no haces nada</p>
            <p className="mt-1">{signal.explanation.consequence}</p>
          </div>
          <div>
            <p className="font-black text-obra-ink">Datos usados</p>
            <ul className="mt-1 grid gap-1">
              {signal.explanation.dataUsed.map((item) => <li key={item}>- {item}</li>)}
            </ul>
            <p className="mt-3 font-black text-obra-ink">Puntuación</p>
            <ul className="mt-1 grid gap-1">
              {signal.explanation.scoreBreakdown.map((item) => <li key={`${item.label}-${item.detail}`}>- {item.label}: {item.value} · {item.detail}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {signal.suggestedActions.map((action) => (
              <Link key={`${signal.fingerprint}-${action.href}-${action.label}`} href={action.href} className="secondary-button min-h-10 px-3 py-1 text-xs">
                {action.label}
              </Link>
            ))}
          </div>
          {signal.status !== "dismissed" && signal.status !== "resolved" ? (
            <form action={dismissSignalAction} className="flex flex-col gap-2 sm:min-w-80 sm:flex-row">
              <input type="hidden" name="fingerprint" value={signal.fingerprint} />
              <input className="field min-h-10 text-sm" name="reason" placeholder="Motivo de descarte" />
              <button className="secondary-button min-h-10 px-3 py-1 text-xs" type="submit">Descartar</button>
            </form>
          ) : (
            <p className="text-xs font-bold text-slate-500">
              {signal.dismissedAt ? `Descartada ${formatDate(signal.dismissedAt)}${signal.dismissedReason ? `: ${signal.dismissedReason}` : ""}` : null}
              {signal.resolvedAt ? ` Resuelta ${formatDate(signal.resolvedAt)}.` : null}
            </p>
          )}
        </div>
      </details>
    </article>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof ShieldAlert; tone: "neutral" | "success" | "warning" | "danger" }) {
  const classes = {
    neutral: "border-slate-200 bg-white text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800"
  }[tone];

  return (
    <article className={`rounded-xl border p-4 shadow-soft ${classes}`}>
      <Icon size={19} />
      <p className="mt-2 text-sm font-bold opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-obra-ink">{value}</p>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      <select className="field min-h-11" name={name} defaultValue={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function validStatus(value: string | undefined): BusinessSignalStatus | "all" | "history" {
  return STATUS_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalStatus | "all" | "history" : "active";
}

function validLevel(value: string | undefined): BusinessSignalLevel | "all" {
  return LEVEL_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalLevel | "all" : "all";
}

function validSource(value: string | undefined): BusinessSignalSource | "all" {
  return SOURCE_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalSource | "all" : "all";
}
