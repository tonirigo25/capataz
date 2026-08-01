import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Lightbulb,
  Search,
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
import {
  getBusinessRecommendations,
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
import { requireCapability } from "@/lib/commercial/authorization";
import { getProactiveAuditEventsForRecommendations } from "@/lib/proactive-evaluation";
import styles from "./recommendations-page.module.css";

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
  const { companyId } = await requireCapability("orqena.execute");
  const result = await getBusinessRecommendations({ companyId, status: estado, level: nivel, source: origen, q, limit: 250 });
  const recommendationHistory = await getProactiveAuditEventsForRecommendations(result.recommendations.map((item) => item.fingerprint));

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <ol>
          <li><Link href="/hoy">Hoy</Link></li>
          <li aria-hidden="true"><ChevronRight size={13} /></li>
          <li><span aria-current="page">Recomendaciones</span></li>
        </ol>
      </nav>

      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}><Sparkles size={14} aria-hidden="true" /> Director de operaciones</p>
          <div className={styles.titleLine}>
            <h1>Recomendaciones</h1>
            <span className={styles.activeBadge}>{result.summary.active} activas</span>
          </div>
          <p>Prioridades explicadas con evidencia, impacto y confirmación humana antes de cualquier cambio.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/recomendaciones/control" className={styles.secondaryButton}><Activity size={16} /> Control proactivo</Link>
          <Link href="/alertas" className={styles.secondaryButton}><AlertTriangle size={16} /> Ver alertas</Link>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Resumen de recomendaciones">
        <Metric label="Activas" value={result.summary.active} icon={Lightbulb} tone="warning" />
        <Metric label="Importantes" value={result.summary.important} icon={AlertTriangle} tone="danger" />
        <Metric label="En curso" value={result.summary.inProgress} icon={Clock3} tone="info" />
        <Metric label="Impacto identificado" value={formatCurrency(result.summary.totalAmount)} icon={Sparkles} tone="success" />
      </section>

      <form className={styles.filters} action="/recomendaciones">
        <FilterSelect name="estado" label="Estado" value={estado} options={STATUS_OPTIONS} />
        <FilterSelect name="nivel" label="Nivel" value={nivel} options={LEVEL_OPTIONS} />
        <FilterSelect name="origen" label="Origen" value={origen} options={SOURCE_OPTIONS} />
        <label className={styles.searchField}>
          <span>Buscar</span>
          <span className={styles.searchControl}>
            <Search size={15} aria-hidden="true" />
            <input name="q" placeholder="Cliente, obra, factura o acción" defaultValue={q} />
          </span>
        </label>
        <button className={styles.filterButton} type="submit">
          <SlidersHorizontal size={16} />
          Filtrar
        </button>
      </form>

      <div className={styles.resultLine}>
        <p><strong>{result.recommendations.length}</strong> recomendaciones visibles</p>
        <p>Actualizado {formatDate(result.generatedAt)}</p>
      </div>

      {!result.persistenceAvailable ? (
        <aside className={styles.persistenceNotice} role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Persistencia pendiente</strong>
            <p>La lectura funciona en modo derivado. Posponer, descartar y ejecutar requieren la migración de recomendaciones aplicada.</p>
          </div>
        </aside>
      ) : null}

      {result.summary.top ? <FeaturedRecommendation recommendation={result.summary.top} /> : null}

      <section className={styles.groupsSection} aria-labelledby="recommendation-groups-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Prioridades por área</p>
            <h2 id="recommendation-groups-title">Recomendaciones agrupadas</h2>
          </div>
          <p>Se muestran las tres principales de cada grupo para mantener el foco.</p>
        </div>

        {result.groups.length ? (
          <div className={styles.groups}>
            {result.groups.map((group) => <RecommendationGroupCard key={group.key} group={group} historyByFingerprint={recommendationHistory} />)}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <CheckCircle2 size={24} aria-hidden="true" />
            <div>
              <h3>No hay recomendaciones con estos filtros</h3>
              <p>Amplía los filtros para revisar otras prioridades y estados.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

type RecommendationHistory = Awaited<ReturnType<typeof getProactiveAuditEventsForRecommendations>>;

function FeaturedRecommendation({ recommendation }: { recommendation: BusinessRecommendation }) {
  return (
    <section className={styles.featured} aria-labelledby="featured-recommendation-title">
      <div className={styles.featuredIcon}><Lightbulb size={19} aria-hidden="true" /></div>
      <div className={styles.featuredBody}>
        <p className={styles.featuredEyebrow}>Recomendación prioritaria · {recommendation.levelText}</p>
        <h2 id="featured-recommendation-title">{recommendation.title}</h2>
        <p>{recommendation.summary}</p>
        <div className={styles.metaChips}>
          <span>{recommendation.sourceLabel}</span>
          <span>{recommendation.statusLabel}</span>
          {recommendation.amount ? <span>{formatCurrency(recommendation.amount)}</span> : null}
        </div>
      </div>
      <div className={styles.featuredAction}><PrimaryAction recommendation={recommendation} featured /></div>
    </section>
  );
}

function RecommendationGroupCard({ group, historyByFingerprint }: { group: BusinessRecommendationGroup; historyByFingerprint: RecommendationHistory }) {
  return (
    <section className={styles.group}>
      <header className={styles.groupHeader}>
        <div className={styles.groupCopy}>
          <p>{signalSourceLabel(group.source)} · {formatSignalLevel(group.level)}</p>
          <h3>{group.title}</h3>
          <span>{withoutOpaquePriority(group.explanation)}</span>
        </div>
        <dl className={styles.groupSummary}>
          <div><dt>Recomendaciones</dt><dd>{group.count}</dd></div>
          <div><dt>Impacto</dt><dd>{group.totalAmount ? formatCurrency(group.totalAmount) : "Sin importe"}</dd></div>
        </dl>
      </header>

      <div className={styles.recommendationRows}>
        {group.topRecommendations.map((recommendation) => (
          <RecommendationCard key={recommendation.fingerprint} recommendation={recommendation} history={historyByFingerprint[recommendation.fingerprint] ?? []} />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({ recommendation, history }: { recommendation: BusinessRecommendation; history: RecommendationHistory[string] }) {
  return (
    <article className={styles.recommendation} data-recommendation-level={recommendation.level} data-recommendation-source={recommendation.source}>
      <div className={styles.recommendationMain}>
        <div className={styles.recommendationCopy}>
          <div className={styles.recommendationMeta}>
            <span className={`${styles.levelBadge} ${levelClass(recommendation.level)}`}>{recommendation.levelText}</span>
            <span>{recommendation.statusLabel}</span>
            <span>{recommendation.dueAt ? formatDate(recommendation.dueAt) : "Sin vencimiento"}</span>
          </div>
          <h4>{recommendation.title}</h4>
          <p>{recommendation.summary}</p>
          <div className={styles.metaChips}>
            <span>{recommendation.sourceLabel}</span>
            {recommendation.amount ? <span>{formatCurrency(recommendation.amount)}</span> : null}
            {recommendation.snoozedUntil ? <span>Pospuesta hasta {formatDate(recommendation.snoozedUntil)}</span> : null}
          </div>
        </div>

        <div className={styles.rowActions}>
          <PrimaryAction recommendation={recommendation} />
          {recommendation.entityHref ? (
            <Link href={recommendation.entityHref} className={styles.secondaryButton}>
              Abrir entidad
              <ArrowRight size={15} />
            </Link>
          ) : null}
          <form action={markRecommendationViewedAction}>
            <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
            <button className={styles.ghostButton} type="submit">Marcar revisada</button>
          </form>
        </div>
      </div>

      <details className={styles.evidence}>
        <summary>Regla, evidencia e historial</summary>
        <div className={styles.evidenceGrid}>
          <section>
            <h5>Explicación</h5>
            <p>{recommendation.detailedExplanation}</p>
            <h5>Señal origen</h5>
            <p>{recommendation.evidence.signalTitle ?? recommendation.title}</p>
            <h5>Resultado esperado</h5>
            <p>{recommendation.preferredAction?.expectedOutcome ?? "Revisar la información y decidir la siguiente acción."}</p>
          </section>
          <section>
            <h5>Datos usados</h5>
            <ul>
              {recommendation.evidence.dataUsed.length ? recommendation.evidence.dataUsed.map((item) => <li key={item}>{item}</li>) : <li>Señal persistida y entidad relacionada.</li>}
            </ul>
            <h5>Criterios aplicados</h5>
            <ul>{recommendation.evidence.scoreBreakdown.map((item) => <li key={`${item.label}-${item.detail}`}><strong>{item.label}:</strong> {item.detail}</li>)}</ul>
          </section>
        </div>

        <div className={styles.followupActions}>
          <div>
            {recommendation.alternativeActions.slice(0, 2).map((action) => action.href ? (
              <Link key={`${recommendation.fingerprint}-${action.id}`} href={action.href} className={styles.secondaryButton}>{action.label}</Link>
            ) : null)}
            <form action={snoozeRecommendationAction}>
              <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
              <button className={styles.ghostButton} name="preset" value="tomorrow" type="submit">Mañana</button>
              <button className={styles.ghostButton} name="preset" value="week" type="submit">Esta semana no</button>
            </form>
          </div>
          {recommendation.status !== "dismissed" && recommendation.status !== "completed" && recommendation.status !== "obsolete" ? (
            <form action={dismissRecommendationAction} className={styles.dismissForm}>
              <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
              <input name="reason" placeholder="Motivo de descarte" aria-label="Motivo de descarte" />
              <button className={styles.ghostButton} type="submit">Descartar</button>
            </form>
          ) : (
            <p className={styles.closedState}>
              {recommendation.dismissedAt ? `Descartada ${formatDate(recommendation.dismissedAt)}${recommendation.dismissedReason ? `: ${recommendation.dismissedReason}` : ""}` : null}
              {recommendation.completedAt ? ` Completada ${formatDate(recommendation.completedAt)}.` : null}
              {recommendation.outcome ? ` ${recommendation.outcome.message}` : null}
            </p>
          )}
        </div>

        <section className={styles.history}>
          <h5>Historial</h5>
          {history.length ? (
            <ol>
              {history.map((event) => (
                <li key={`${event.eventType}-${event.createdAt.toISOString()}`}>
                  <strong>{formatDate(event.createdAt)} · {eventLabel(event.eventType)}</strong>
                  <span>{event.previousStatus ? `${event.previousStatus} → ${event.nextStatus ?? "sin cambio"}. ` : ""}{event.reason ?? "Evento registrado por el sistema proactivo."}</span>
                </li>
              ))}
            </ol>
          ) : <p>Aún no hay actividad del sistema proactivo para esta recomendación.</p>}
        </section>
      </details>
    </article>
  );
}

function PrimaryAction({ recommendation, featured = false }: { recommendation: BusinessRecommendation; featured?: boolean }) {
  const action = recommendation.preferredAction ?? recommendation.suggestedActions[0];
  if (!action) return null;
  const actionClassName = featured ? styles.primaryButton : styles.secondaryButton;

  if (action.href) {
    return <Link href={action.href} className={actionClassName}>{action.label}<ArrowRight size={15} /></Link>;
  }

  if (action.requiresConfirmation) {
    return (
      <details className={styles.confirmation}>
        <summary className={actionClassName}>{action.label}</summary>
        <div>
          <p>{action.description}</p>
          <ul>{(action.preview ?? []).slice(0, 3).map((row) => <li key={`${action.id}-${row.label}`}><strong>{row.label}:</strong> {row.value}</li>)}</ul>
          <form action={executeRecommendationAction}>
            <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
            <input type="hidden" name="actionId" value={action.id} />
            <input type="hidden" name="confirmed" value="true" />
            <input type="hidden" name="idempotencyKey" value={`${recommendation.fingerprint}:${action.id}`} />
            <button className={styles.primaryButton} type="submit">Confirmar</button>
          </form>
        </div>
      </details>
    );
  }

  return (
    <form action={acceptRecommendationAction}>
      <input type="hidden" name="fingerprint" value={recommendation.fingerprint} />
      <button className={actionClassName} type="submit">{action.label}</button>
    </form>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Lightbulb; tone: "success" | "warning" | "danger" | "info" }) {
  const toneClass = {
    success: styles.metricSuccess,
    warning: styles.metricWarning,
    danger: styles.metricDanger,
    info: styles.metricInfo
  }[tone];

  return (
    <article className={`${styles.metric} ${toneClass}`}>
      <span className={styles.metricIcon}><Icon size={17} aria-hidden="true" /></span>
      <div><p>{label}</p><strong>{value}</strong></div>
    </article>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select name={name} defaultValue={value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    </label>
  );
}

function levelClass(level: BusinessSignalLevel) {
  return {
    critico: styles.levelCritical,
    importante: styles.levelImportant,
    atencion: styles.levelAttention,
    info: styles.levelInfo
  }[level];
}

function withoutOpaquePriority(explanation: string) {
  return explanation.replace(/\s*Las \d+ principales concentran prioridad [0-9,\s]+\.?/iu, "").trim();
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

function validStatus(value: string | undefined): BusinessRecommendationStatus | "all" | "history" {
  return STATUS_OPTIONS.some((option) => option.value === value) ? value as BusinessRecommendationStatus | "all" | "history" : "active";
}

function validLevel(value: string | undefined): BusinessSignalLevel | "all" {
  return LEVEL_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalLevel | "all" : "all";
}

function validSource(value: string | undefined): BusinessSignalSource | "all" {
  return SOURCE_OPTIONS.some((option) => option.value === value) ? value as BusinessSignalSource | "all" : "all";
}
