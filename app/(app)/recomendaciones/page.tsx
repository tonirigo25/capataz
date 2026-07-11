import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Filter,
  Lightbulb,
  PauseCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import {
  acceptRecommendationAction,
  dismissRecommendationAction,
  executeRecommendationAction,
  markRecommendationViewedAction,
  snoozeRecommendationAction
} from "@/app/(app)/recomendaciones/actions";
import { EmptyState, Notice, PageHeader } from "@/components/ui-primitives";
import {
  getBusinessRecommendations,
  recommendationStatusLabel,
  type BusinessRecommendation,
  type BusinessRecommendationGroup,
  type BusinessRecommendationStatus
} from "@/lib/business-recommendations";
import {
  formatSignalLevel,
  signalSourceLabel,
  type BusinessSignalLevel,
  type BusinessSignalSource
} from "@/lib/business-signals";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProactiveAuditEventsForRecommendations } from "@/lib/proactive-evaluation";

export const dynamic = "force-dynamic";

type RecommendationsSearchParams = {
  estado?: string;
  nivel?: string;
  origen?: string;
  q?: string;
};

const STATUS_OPTIONS: Array<{ value: BusinessRecommendationStatus | "all" | "history"; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "viewed", label: "Vistas" },
  { value: "accepted", label: "Aceptadas" },
  { value: "in_progress", label: "En curso" },
  { value: "snoozed", label: "Pospuestas" },
  { value: "completed", label: "Completadas" },
  { value: "dismissed", label: "Descartadas" },
  { value: "obsolete", label: "Obsoletas" },
  { value: "failed", label: "Fallidas" },
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

export default async function RecommendationsPage({
  searchParams
}: {
  searchParams: Promise<RecommendationsSearchParams>;
}) {
  const query = await searchParams;
  const estado = validStatus(query.estado);
  const nivel = validLevel(query.nivel);
  const origen = validSource(query.origen);
  const q = query.q?.trim() ?? "";
  const result = await getBusinessRecommendations({ status: estado, level: nivel, source: origen, q, limit: 250 });
  const recommendationHistory = await getProactiveAuditEventsForRecommendations(result.recommendations.map((item) => item.fingerprint));

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Director de operaciones"
        title="Centro de recomendaciones"
        description="Acciones operativas derivadas de señales reales. Capataz prioriza y explica; cualquier acción que modifique datos requiere confirmación explícita."
        badge={<span className="rounded-full bg-obra-yellow px-3 py-1 text-xs font-black text-obra-ink">{result.summary.active} activas</span>}
        secondaryActions={
          <>
            <Link href="/recomendaciones/control" className="secondary-button"><Activity size={18} /> Control proactivo</Link>
            <Link href="/alertas" className="secondary-button"><AlertTriangle size={18} /> Ver alertas</Link>
          </>
        }
      >
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]" action="/recomendaciones">
          <FilterSelect name="estado" label="Estado" value={estado} options={STATUS_OPTIONS} />
          <FilterSelect name="nivel" label="Nivel" value={nivel} options={LEVEL_OPTIONS} />
          <FilterSelect name="origen" label="Origen" value={origen} options={SOURCE_OPTIONS} />
          <label className="block">
            <span className="label mb-1 block">Buscar</span>
            <span className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field min-h-11 pl-10" name="q" placeholder="Cliente, obra, factura, acción..." defaultValue={q} />
            </span>
          </label>
          <button className="secondary-button self-end" type="submit">
            <SlidersHorizontal size={18} />
            Filtrar
          </button>
        </form>
      </PageHeader>

      {!result.persistenceAvailable ? (
        <Notice
          tone="warning"
          title="Persistencia pendiente"
          description="La lectura de recomendaciones funciona en modo derivado. Posponer, descartar y ejecutar requieren la migración de recomendaciones aplicada."
        />
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label="Activas" value={result.summary.active} icon={Lightbulb} tone="warning" />
        <Metric label="Importantes" value={result.summary.important} icon={AlertTriangle} tone="danger" />
        <Metric label="En curso" value={result.summary.inProgress} icon={Clock3} tone="info" />
        <Metric label="Completadas" value={result.summary.completed} icon={CheckCircle2} tone="success" />
        <Metric label="Pospuestas" value={result.summary.snoozed} icon={PauseCircle} tone="neutral" />
        <Metric label="Descartadas" value={result.summary.dismissed} icon={ShieldCheck} tone="neutral" />
        <Metric label="Impacto" value={formatCurrency(result.summary.totalAmount)} icon={Sparkles} tone="neutral" />
      </section>

      {result.summary.top ? (
        <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black uppercase"><Lightbulb size={18} /> Siguiente mejor acción · prioridad {result.summary.top.priority}/100</p>
              <h2 className="mt-2 text-xl font-black">{result.summary.top.title}</h2>
              <p className="mt-1 text-sm leading-6">{result.summary.top.summary}</p>
            </div>
            <PrimaryAction recommendation={result.summary.top} compact />
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Agrupación</p>
            <h2 className="text-xl font-black text-obra-ink">Recomendaciones agrupadas por tipo</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Cada grupo enseña las 3 principales para evitar ruido. Las acciones de negocio no se ejecutan con el primer clic.</p>
          </div>
          <p className="text-sm font-bold text-slate-500">Generado {formatDate(result.generatedAt)}</p>
        </div>

        {result.groups.length ? (
          <div className="grid gap-4">
            {result.groups.map((group) => <RecommendationGroupCard key={group.key} group={group} historyByFingerprint={recommendationHistory} />)}
          </div>
        ) : (
          <EmptyState
            title="No hay recomendaciones con estos filtros"
            description="Puedes ampliar estado, nivel u origen. Capataz no inventa consejos genéricos cuando no hay señales accionables."
            icon={CheckCircle2}
          />
        )}
      </section>
    </main>
  );
}

type RecommendationHistory = Awaited<ReturnType<typeof getProactiveAuditEventsForRecommendations>>;

function RecommendationGroupCard({ group, historyByFingerprint }: { group: BusinessRecommendationGroup; historyByFingerprint: RecommendationHistory }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{signalSourceLabel(group.source)} · {formatSignalLevel(group.level)} · prioridad {group.maxPriority}</p>
          <h3 className="mt-1 text-lg font-black text-obra-ink">{group.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{group.explanation}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-60">
          <Mini label="Recomendaciones" value={group.count} />
          <Mini label="Impacto" value={group.totalAmount ? formatCurrency(group.totalAmount) : "Sin importe"} />
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {group.topRecommendations.map((recommendation) => (
          <RecommendationCard key={recommendation.fingerprint} recommendation={recommendation} history={historyByFingerprint[recommendation.fingerprint] ?? []} />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({ recommendation, history }: { recommendation: BusinessRecommendation; history: RecommendationHistory[string] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-slate-500">
            <span>{recommendation.levelText}</span>
            <span>·</span>
            <span>{recommendation.statusLabel}</span>
            <span>·</span>
            <span>{recommendation.dueAt ? formatDate(recommendation.dueAt) : "Sin vencimiento"}</span>
          </p>
          <h4 className="mt-1 text-base font-black text-obra-ink">{recommendation.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">{recommendation.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            <span className="rounded-full bg-white px-2.5 py-1">Prioridad {recommendation.priority}/100</span>
            <span className="rounded-full bg-white px-2.5 py-1">{recommendation.sourceLabel}</span>
            {recommendation.amount ? <span className="rounded-full bg-white px-2.5 py-1">{formatCurrency(recommendation.amount)}</span> : null}
            {recommendation.snoozedUntil ? <span className="rounded-full bg-white px-2.5 py-1">Hasta {formatDate(recommendation.snoozedUntil)}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">
          <PrimaryAction recommendation={recommendation} />
          {recommendation.entityHref ? (
            <Link href={recommendation.entityHref} className="secondary-button min-h-10 px-3 py-1 text-xs">
              Abrir entidad
              <ArrowRight size={16} />
            </Link>
          ) : null}
          <form action={markRecommendationViewedAction}>
            <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
            <button className="secondary-button min-h-10 px-3 py-1 text-xs" type="submit">Marcar revisada</button>
          </form>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-black text-obra-ink">Por qué y seguimiento</summary>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 lg:grid-cols-2">
          <div>
            <p className="font-black text-obra-ink">Explicación</p>
            <p className="mt-1">{recommendation.detailedExplanation}</p>
            <p className="mt-3 font-black text-obra-ink">Señal origen</p>
            <p className="mt-1">{recommendation.evidence.signalTitle ?? recommendation.title}</p>
            <p className="mt-3 font-black text-obra-ink">Resultado esperado</p>
            <p className="mt-1">{recommendation.preferredAction?.expectedOutcome ?? "Revisar la información y decidir la siguiente acción."}</p>
          </div>
          <div>
            <p className="font-black text-obra-ink">Datos usados</p>
            <ul className="mt-1 grid gap-1">
              {recommendation.evidence.dataUsed.length ? recommendation.evidence.dataUsed.map((item) => <li key={item}>- {item}</li>) : <li>- Señal persistida y entidad relacionada.</li>}
            </ul>
            <p className="mt-3 font-black text-obra-ink">Puntuación</p>
            <ul className="mt-1 grid gap-1">
              {recommendation.evidence.scoreBreakdown.map((item) => <li key={`${item.label}-${item.detail}`}>- {item.label}: {item.value} · {item.detail}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 xl:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-2">
            {recommendation.alternativeActions.slice(0, 2).map((action) => action.href ? (
              <Link key={`${recommendation.fingerprint}-${action.id}`} href={action.href} className="secondary-button min-h-10 px-3 py-1 text-xs">
                {action.label}
              </Link>
            ) : null)}
            <form action={snoozeRecommendationAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
              <button className="secondary-button min-h-10 px-3 py-1 text-xs" name="preset" value="tomorrow" type="submit">Mañana</button>
              <button className="secondary-button min-h-10 px-3 py-1 text-xs" name="preset" value="week" type="submit">Esta semana no</button>
            </form>
          </div>
          {recommendation.status !== "dismissed" && recommendation.status !== "completed" && recommendation.status !== "obsolete" ? (
            <form action={dismissRecommendationAction} className="flex flex-col gap-2 sm:min-w-80 sm:flex-row">
              <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
              <input className="field min-h-10 text-sm" name="reason" placeholder="Motivo de descarte" />
              <button className="secondary-button min-h-10 px-3 py-1 text-xs" type="submit">Descartar</button>
            </form>
          ) : (
            <p className="text-xs font-bold text-slate-500">
              {recommendation.dismissedAt ? `Descartada ${formatDate(recommendation.dismissedAt)}${recommendation.dismissedReason ? `: ${recommendation.dismissedReason}` : ""}` : null}
              {recommendation.completedAt ? ` Completada ${formatDate(recommendation.completedAt)}.` : null}
              {recommendation.outcome ? ` ${recommendation.outcome.message}` : null}
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="font-black text-obra-ink">Historial</p>
          {history.length ? (
            <ol className="mt-2 grid gap-2">
              {history.map((event) => (
                <li key={`${event.eventType}-${event.createdAt.toISOString()}`} className="rounded-lg bg-slate-50 p-2">
                  <p className="text-xs font-black uppercase text-slate-500">{formatDate(event.createdAt)} · {eventLabel(event.eventType)}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {event.previousStatus ? `${event.previousStatus} -> ${event.nextStatus ?? "sin cambio"}. ` : ""}
                    {event.reason ?? "Evento registrado por el sistema proactivo."}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Aún no hay actividad del sistema proactivo para esta recomendación.</p>
          )}
        </div>
      </details>
    </article>
  );
}

function PrimaryAction({ recommendation, compact = false }: { recommendation: BusinessRecommendation; compact?: boolean }) {
  const action = recommendation.preferredAction ?? recommendation.suggestedActions[0];
  if (!action) return null;
  if (action.href) {
    return (
      <Link href={action.href} className={`${compact ? "primary-button bg-white text-obra-ink" : "primary-button min-h-10 px-3 py-1 text-xs"}`}>
        {action.label}
        <ArrowRight size={16} />
      </Link>
    );
  }
  if (action.requiresConfirmation) {
    return (
      <details className="rounded-lg border border-amber-200 bg-white p-2 text-sm">
        <summary className="cursor-pointer font-black text-obra-ink">{action.label}</summary>
        <div className="mt-2 grid gap-2">
          <p className="text-xs leading-5 text-slate-600">{action.description}</p>
          <ul className="grid gap-1 text-xs text-slate-600">
            {(action.preview ?? []).slice(0, 3).map((row) => <li key={`${action.id}-${row.label}`}><strong>{row.label}:</strong> {row.value}</li>)}
          </ul>
          <form action={executeRecommendationAction}>
            <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
            <input type="hidden" name="actionId" value={action.id} />
            <input type="hidden" name="confirmed" value="true" />
            <input type="hidden" name="idempotencyKey" value={`${recommendation.fingerprint}:${action.id}`} />
            <button className="primary-button min-h-10 w-full px-3 py-1 text-xs" type="submit">Confirmar</button>
          </form>
        </div>
      </details>
    );
  }
  return (
    <form action={acceptRecommendationAction}>
      <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
      <button className="primary-button min-h-10 px-3 py-1 text-xs" type="submit">{action.label}</button>
    </form>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Lightbulb; tone: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const classes = {
    neutral: "border-slate-200 bg-white text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800"
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

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    recommendation_created: "Creada",
    recommendation_status_changed: "Cambio de estado",
    recommendation_action_executed: "Acción ejecutada",
    recommendation_action_failed: "Acción fallida",
    evaluation_completed: "Evaluación",
    evaluation_failed: "Error de evaluación"
  };
  return labels[eventType] ?? eventType.replaceAll("_", " ");
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
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function validStatus(value: string | undefined): BusinessRecommendationStatus | "all" | "history" {
  return STATUS_OPTIONS.some((option) => option.value === value) ? value as BusinessRecommendationStatus | "all" | "history" : "active";
}

function validLevel(value: string | undefined): BusinessSignalLevel | "all" {
  return LEVEL_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalLevel | "all" : "all";
}

function validSource(value: string | undefined): BusinessSignalSource | "all" {
  return SOURCE_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalSource | "all" : "all";
}
