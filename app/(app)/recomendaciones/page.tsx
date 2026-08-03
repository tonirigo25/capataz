import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSearch,
  History,
  Lightbulb,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  acceptRecommendationAction,
  dismissRecommendationAction,
  executeRecommendationAction,
  markRecommendationViewedAction,
  snoozeRecommendationAction,
} from "@/app/(app)/recomendaciones/actions";
import {
  getBusinessRecommendations,
  type BusinessRecommendation,
  type BusinessRecommendationStatus,
} from "@/lib/business-recommendations";
import {
  signalSourceLabel,
  type BusinessSignalLevel,
  type BusinessSignalSource,
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
  seleccion?: string;
};

type CurrentFilters = {
  estado: BusinessRecommendationStatus | "all" | "history";
  nivel: BusinessSignalLevel | "all";
  origen: BusinessSignalSource | "all";
  q: string;
};

const STATUS_OPTIONS: Array<{
  value: BusinessRecommendationStatus | "all" | "history";
  label: string;
}> = [
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
  { value: "all", label: "Todas" },
];

const LEVEL_OPTIONS: Array<{
  value: BusinessSignalLevel | "all";
  label: string;
}> = [
  { value: "all", label: "Todos los niveles" },
  { value: "critico", label: "CRÍTICO" },
  { value: "importante", label: "IMPORTANTE" },
  { value: "atencion", label: "ATENCIÓN" },
  { value: "info", label: "INFO" },
];

const SOURCE_OPTIONS: Array<{
  value: BusinessSignalSource | "all";
  label: string;
}> = [
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
  "datos",
].map((value) => ({
  value: value as BusinessSignalSource | "all",
  label:
    value === "all"
      ? "Todos los orígenes"
      : signalSourceLabel(value as BusinessSignalSource),
}));

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<RecommendationsSearchParams>;
}) {
  const query = await searchParams;
  const filters: CurrentFilters = {
    estado: validStatus(query.estado),
    nivel: validLevel(query.nivel),
    origen: validSource(query.origen),
    q: query.q?.trim() ?? "",
  };
  const { companyId } = await requireCapability("orqena.execute");
  const result = await getBusinessRecommendations({
    companyId,
    status: filters.estado,
    level: filters.nivel,
    source: filters.origen,
    q: filters.q,
    limit: 250,
  });
  const selectedRecommendation = query.seleccion
    ? (result.recommendations.find((item) => item.id === query.seleccion) ??
      null)
    : null;
  const recommendationHistory = selectedRecommendation
    ? await getProactiveAuditEventsForRecommendations([
        selectedRecommendation.fingerprint,
      ])
    : {};
  const activeFilterCount = [
    filters.estado !== "active",
    filters.nivel !== "all",
    filters.origen !== "all",
    Boolean(filters.q),
  ].filter(Boolean).length;

  return (
    <main className={styles.page}>
      <RecommendationBreadcrumbs
        filters={filters}
        recommendation={selectedRecommendation}
      />

      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>
            <Sparkles size={14} aria-hidden="true" />
            Decisiones supervisadas
          </p>
          <div className={styles.titleLine}>
            <h1>Centro de recomendaciones</h1>
            <span className={styles.activeBadge}>
              {result.summary.active} activas
            </span>
          </div>
          <p>
            Prioridades explicadas con origen, impacto y confirmación humana
            antes de ejecutar cambios.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/recomendaciones/control"
            className={styles.secondaryButton}
          >
            <Activity size={16} /> Control proactivo
          </Link>
          <Link href="/alertas" className={styles.secondaryButton}>
            <AlertTriangle size={16} /> Alertas
          </Link>
        </div>
      </header>

      <section
        className={styles.metrics}
        aria-label="Resumen de recomendaciones"
      >
        <Metric
          label="Activas"
          value={result.summary.active}
          icon={Lightbulb}
          tone="warning"
          href={recommendationsHref({ ...filters, estado: "active" })}
        />
        <Metric
          label="Importantes"
          value={result.summary.important}
          icon={AlertTriangle}
          tone="danger"
          href={recommendationsHref({
            ...filters,
            estado: "all",
            nivel: "importante",
          })}
        />
        <Metric
          label="En curso"
          value={result.summary.inProgress}
          icon={Clock3}
          tone="info"
          href={recommendationsHref({ ...filters, estado: "in_progress" })}
        />
        <Metric
          label="Impacto identificado"
          value={formatCurrency(result.summary.totalAmount)}
          icon={Sparkles}
          tone="success"
        />
      </section>

      <RecommendationFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
      />

      <div className={styles.resultLine} aria-live="polite">
        <p>
          <strong>{result.recommendations.length}</strong> recomendaciones
          visibles
        </p>
        <p>Actualizado {formatDate(result.generatedAt)}</p>
      </div>

      {!result.persistenceAvailable ? (
        <aside className={styles.persistenceNotice} role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Acciones temporalmente no disponibles</strong>
            <p>
              La lectura derivada continúa operativa. Las transiciones se
              mantienen bloqueadas hasta disponer de persistencia.
            </p>
          </div>
        </aside>
      ) : null}

      <section
        className={styles.workspace}
        data-has-selection={selectedRecommendation ? "true" : "false"}
        aria-label="Listado y detalle de recomendaciones"
      >
        <div className={styles.listPane}>
          <header className={styles.paneHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Prioridad registrada</p>
              <h2>Listado</h2>
            </div>
            <span>{result.recommendations.length}</span>
          </header>

          {result.recommendations.length ? (
            <div className={styles.recommendationList}>
              {result.recommendations.map((recommendation) => (
                <RecommendationListItem
                  key={recommendation.id}
                  recommendation={recommendation}
                  href={recommendationsHref(filters, recommendation.id)}
                  selected={recommendation.id === selectedRecommendation?.id}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <CheckCircle2 size={24} aria-hidden="true" />
              <div>
                <h3>No hay recomendaciones con estos filtros</h3>
                <p>Amplía los filtros para revisar otras prioridades.</p>
              </div>
            </div>
          )}
        </div>

        <aside
          className={styles.detailPane}
          aria-label="Detalle de recomendación"
        >
          {selectedRecommendation ? (
            <RecommendationDetail
              recommendation={selectedRecommendation}
              history={
                recommendationHistory[selectedRecommendation.fingerprint] ?? []
              }
              persistenceAvailable={result.persistenceAvailable}
              backHref={recommendationsHref(filters)}
            />
          ) : (
            <RecommendationDetailEmpty
              selectionRequested={Boolean(query.seleccion)}
              clearHref={recommendationsHref(filters)}
            />
          )}
        </aside>
      </section>
    </main>
  );
}

type RecommendationHistory = Awaited<
  ReturnType<typeof getProactiveAuditEventsForRecommendations>
>[string];

function RecommendationBreadcrumbs({
  filters,
  recommendation,
}: {
  filters: CurrentFilters;
  recommendation: BusinessRecommendation | null;
}) {
  return (
    <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
      <ol>
        <li>
          <Link href="/hoy">Hoy</Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={13} />
        </li>
        <li>
          {recommendation ? (
            <Link href={recommendationsHref(filters)}>Recomendaciones</Link>
          ) : (
            <span aria-current="page">Recomendaciones</span>
          )}
        </li>
        {recommendation ? (
          <>
            <li aria-hidden="true">
              <ChevronRight size={13} />
            </li>
            <li className={styles.breadcrumbCurrent}>
              <span aria-current="page">{recommendation.title}</span>
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}

function RecommendationFilters({
  filters,
  activeFilterCount,
}: {
  filters: CurrentFilters;
  activeFilterCount: number;
}) {
  return (
    <form className={styles.filters} action="/recomendaciones">
      <FilterSelect
        name="estado"
        label="Estado"
        value={filters.estado}
        options={STATUS_OPTIONS}
      />
      <FilterSelect
        name="nivel"
        label="Nivel"
        value={filters.nivel}
        options={LEVEL_OPTIONS}
      />
      <FilterSelect
        name="origen"
        label="Origen"
        value={filters.origen}
        options={SOURCE_OPTIONS}
      />
      <label className={styles.searchField}>
        <span>Buscar</span>
        <span className={styles.searchControl}>
          <Search size={15} aria-hidden="true" />
          <input
            name="q"
            placeholder="Cliente, obra, factura o acción"
            defaultValue={filters.q}
          />
        </span>
      </label>
      <div className={styles.filterActions}>
        {activeFilterCount ? (
          <Link href="/recomendaciones" className={styles.ghostButton}>
            Limpiar ({activeFilterCount})
          </Link>
        ) : null}
        <button className={styles.filterButton} type="submit">
          <SlidersHorizontal size={16} /> Filtrar
        </button>
      </div>
    </form>
  );
}

function RecommendationListItem({
  recommendation,
  href,
  selected,
}: {
  recommendation: BusinessRecommendation;
  href: string;
  selected: boolean;
}) {
  return (
    <article
      className={styles.recommendationRow}
      data-level={recommendation.level}
      data-selected={selected ? "true" : "false"}
    >
      <Link href={href} aria-current={selected ? "true" : undefined}>
        <span className={styles.rowMarker} aria-hidden="true" />
        <span className={styles.rowContent}>
          <span className={styles.recommendationMeta}>
            <span
              className={`${styles.levelBadge} ${levelClass(recommendation.level)}`}
            >
              {recommendation.levelText}
            </span>
            <span>{recommendation.sourceLabel}</span>
            <span>{recommendation.statusLabel}</span>
          </span>
          <strong>{recommendation.title}</strong>
          <span className={styles.rowSummary}>{recommendation.summary}</span>
          <span className={styles.rowFacts}>
            {recommendation.amount ? (
              <span>{formatCurrency(recommendation.amount)}</span>
            ) : null}
            <span>
              {recommendation.dueAt
                ? `Vence ${formatDate(recommendation.dueAt)}`
                : `Detectada ${formatDate(recommendation.detectedAt)}`}
            </span>
          </span>
        </span>
        <ChevronRight size={17} className={styles.rowChevron} />
      </Link>
    </article>
  );
}

function RecommendationDetail({
  recommendation,
  history,
  persistenceAvailable,
  backHref,
}: {
  recommendation: BusinessRecommendation;
  history: RecommendationHistory;
  persistenceAvailable: boolean;
  backHref: string;
}) {
  const preferredAction =
    recommendation.preferredAction ?? recommendation.suggestedActions[0];
  const terminal = ["dismissed", "completed", "obsolete"].includes(
    recommendation.status,
  );

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <Link href={backHref} className={styles.backLink}>
          <ArrowLeft size={15} /> Volver al listado
        </Link>
        <div className={styles.detailBadges}>
          <span
            className={`${styles.levelBadge} ${levelClass(recommendation.level)}`}
          >
            {recommendation.levelText}
          </span>
          <span>{recommendation.sourceLabel}</span>
          <span>{recommendation.statusLabel}</span>
        </div>
        <h2>{recommendation.title}</h2>
        <p>{recommendation.summary}</p>
      </header>

      <dl className={styles.detailFacts}>
        <DetailFact
          label="Impacto registrado"
          value={
            recommendation.amount
              ? formatCurrency(recommendation.amount)
              : "Sin importe asociado"
          }
        />
        <DetailFact
          label="Entidad"
          value={recommendation.entityLabel ?? "Sin entidad relacionada"}
        />
        <DetailFact
          label="Detectada"
          value={formatDate(recommendation.detectedAt)}
        />
        <DetailFact
          label="Vencimiento"
          value={
            recommendation.dueAt
              ? formatDate(recommendation.dueAt)
              : "Sin vencimiento"
          }
        />
      </dl>

      <section
        className={styles.actionSection}
        aria-labelledby="recommendation-actions-title"
      >
        <div className={styles.detailSectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Siguiente paso</p>
            <h3 id="recommendation-actions-title">Acciones disponibles</h3>
          </div>
          {recommendation.requiresConfirmation ? (
            <span className={styles.humanBadge}>
              <ShieldCheck size={13} /> Confirmación humana
            </span>
          ) : null}
        </div>
        <div className={styles.primaryActions}>
          <PrimaryAction
            recommendation={recommendation}
            persistenceAvailable={persistenceAvailable}
          />
          {recommendation.entityHref ? (
            <Link
              href={recommendation.entityHref}
              className={styles.secondaryButton}
            >
              Abrir entidad <ExternalLink size={14} />
            </Link>
          ) : null}
          {persistenceAvailable && !terminal ? (
            <form action={markRecommendationViewedAction}>
              <input
                type="hidden"
                name="fingerprint"
                value={recommendation.fingerprint}
              />
              <button className={styles.ghostButton} type="submit">
                Marcar revisada
              </button>
            </form>
          ) : null}
        </div>
        {preferredAction?.description ? (
          <p className={styles.actionExplanation}>
            {preferredAction.description}
          </p>
        ) : null}
      </section>

      <section
        className={styles.evidenceSection}
        aria-labelledby="recommendation-evidence-title"
      >
        <div className={styles.detailSectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Trazabilidad</p>
            <h3 id="recommendation-evidence-title">Por qué y seguimiento</h3>
          </div>
          <span className={styles.ruleId}>
            {recommendation.ruleId ?? "Regla no persistida"}
          </span>
        </div>
        <div className={styles.evidenceGrid}>
          <div>
            <h4>Explicación</h4>
            <p>{recommendation.detailedExplanation}</p>
            <h4>Resultado esperado</h4>
            <p>
              {preferredAction?.expectedOutcome ??
                recommendation.evidence.consequence ??
                "Sin resultado esperado persistido."}
            </p>
          </div>
          <div>
            <h4>Datos usados</h4>
            {recommendation.evidence.dataUsed.length ? (
              <ul>
                {recommendation.evidence.dataUsed.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No hay un desglose de datos persistido.</p>
            )}
            <h4>Criterios aplicados</h4>
            {recommendation.evidence.scoreBreakdown.length ? (
              <ul>
                {recommendation.evidence.scoreBreakdown.map((item) => (
                  <li key={`${item.label}-${item.detail}`}>
                    <strong>{item.label}:</strong> {item.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No hay criterios desglosados para esta señal.</p>
            )}
          </div>
        </div>
      </section>

      {persistenceAvailable ? (
        <section
          className={styles.followupSection}
          aria-labelledby="recommendation-followup-title"
        >
          <div className={styles.detailSectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Control</p>
              <h3 id="recommendation-followup-title">Posponer o cerrar</h3>
            </div>
          </div>
          {!terminal ? (
            <div className={styles.followupActions}>
              <div className={styles.alternativeActions}>
                {recommendation.alternativeActions
                  .filter((action) => Boolean(action.href))
                  .slice(0, 2)
                  .map((action) => (
                    <Link
                      key={`${recommendation.fingerprint}-${action.id}`}
                      href={action.href!}
                      className={styles.secondaryButton}
                    >
                      {action.label}
                    </Link>
                  ))}
                <form action={snoozeRecommendationAction}>
                  <input
                    type="hidden"
                    name="fingerprint"
                    value={recommendation.fingerprint}
                  />
                  <button
                    className={styles.ghostButton}
                    name="preset"
                    value="tomorrow"
                    type="submit"
                  >
                    Posponer a mañana
                  </button>
                  <button
                    className={styles.ghostButton}
                    name="preset"
                    value="week"
                    type="submit"
                  >
                    Posponer una semana
                  </button>
                </form>
              </div>
              <form
                action={dismissRecommendationAction}
                className={styles.dismissForm}
              >
                <input
                  type="hidden"
                  name="fingerprint"
                  value={recommendation.fingerprint}
                />
                <label>
                  <span>Motivo del descarte</span>
                  <input
                    name="reason"
                    placeholder="Explica por qué no aplica"
                    maxLength={240}
                    required
                  />
                </label>
                <button className={styles.ghostButton} type="submit">
                  Descartar recomendación
                </button>
              </form>
            </div>
          ) : (
            <p className={styles.closedState}>
              {recommendation.dismissedAt
                ? `Descartada ${formatDate(recommendation.dismissedAt)}${recommendation.dismissedReason ? `: ${recommendation.dismissedReason}` : ""}.`
                : null}
              {recommendation.completedAt
                ? ` Completada ${formatDate(recommendation.completedAt)}.`
                : null}
              {recommendation.outcome
                ? ` ${recommendation.outcome.message}`
                : null}
            </p>
          )}
        </section>
      ) : null}

      <section
        className={styles.history}
        aria-labelledby="recommendation-history-title"
      >
        <div className={styles.detailSectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Auditoría</p>
            <h3 id="recommendation-history-title">Historial</h3>
          </div>
          <History size={16} aria-hidden="true" />
        </div>
        {history.length ? (
          <ol>
            {history.map((event) => (
              <li key={`${event.eventType}-${event.createdAt.toISOString()}`}>
                <strong>
                  {formatDate(event.createdAt)} · {eventLabel(event.eventType)}
                </strong>
                <span>
                  {event.previousStatus
                    ? `${event.previousStatus} → ${event.nextStatus ?? "sin cambio"}. `
                    : ""}
                  {event.reason ??
                    "Evento registrado por el sistema proactivo."}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>Aún no hay actividad registrada para esta recomendación.</p>
        )}
      </section>
    </div>
  );
}

function RecommendationDetailEmpty({
  selectionRequested,
  clearHref,
}: {
  selectionRequested: boolean;
  clearHref: string;
}) {
  return (
    <div className={styles.detailEmpty}>
      <span>
        <FileSearch size={22} aria-hidden="true" />
      </span>
      <h2>
        {selectionRequested
          ? "La recomendación ya no está en este listado"
          : "Selecciona una recomendación"}
      </h2>
      <p>
        {selectionRequested
          ? "Puede haber cambiado de estado o quedar fuera de los filtros actuales."
          : "Abre una fila para consultar evidencia, entidad, acciones e historial sin perder los filtros."}
      </p>
      {selectionRequested ? (
        <Link href={clearHref} className={styles.secondaryButton}>
          Volver al listado
        </Link>
      ) : null}
    </div>
  );
}

function PrimaryAction({
  recommendation,
  persistenceAvailable,
}: {
  recommendation: BusinessRecommendation;
  persistenceAvailable: boolean;
}) {
  const action =
    recommendation.preferredAction ?? recommendation.suggestedActions[0];
  if (!action) return null;

  if (action.href) {
    return (
      <Link href={action.href} className={styles.primaryButton}>
        {action.label} <ArrowRight size={15} />
      </Link>
    );
  }

  if (!persistenceAvailable) {
    return (
      <button className={styles.primaryButton} type="button" disabled>
        {action.label}
      </button>
    );
  }

  if (action.requiresConfirmation) {
    return (
      <details className={styles.confirmation}>
        <summary className={styles.primaryButton}>{action.label}</summary>
        <div>
          <p>{action.description}</p>
          {action.preview?.length ? (
            <ul>
              {action.preview.slice(0, 4).map((row) => (
                <li key={`${action.id}-${row.label}`}>
                  <strong>{row.label}:</strong> {row.value}
                </li>
              ))}
            </ul>
          ) : null}
          <form action={executeRecommendationAction}>
            <input
              type="hidden"
              name="fingerprint"
              value={recommendation.fingerprint}
            />
            <input type="hidden" name="actionId" value={action.id} />
            <input type="hidden" name="confirmed" value="true" />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`${recommendation.fingerprint}:${action.id}`}
            />
            <button className={styles.primaryButton} type="submit">
              Confirmar acción
            </button>
          </form>
        </div>
      </details>
    );
  }

  return (
    <form action={acceptRecommendationAction}>
      <input
        type="hidden"
        name="fingerprint"
        value={recommendation.fingerprint}
      />
      <button className={styles.primaryButton} type="submit">
        {action.label}
      </button>
    </form>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "success" | "warning" | "danger" | "info";
  href?: string;
}) {
  const toneClass = {
    success: styles.metricSuccess,
    warning: styles.metricWarning,
    danger: styles.metricDanger,
    info: styles.metricInfo,
  }[tone];
  const content = (
    <>
      <span className={styles.metricIcon}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <span>
        <span className={styles.metricLabel}>{label}</span>
        <strong>{value}</strong>
      </span>
      {href ? (
        <ChevronRight size={15} className={styles.metricChevron} />
      ) : null}
    </>
  );

  return href ? (
    <Link className={`${styles.metric} ${toneClass}`} href={href}>
      {content}
    </Link>
  ) : (
    <article className={`${styles.metric} ${toneClass}`}>{content}</article>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function recommendationsHref(filters: CurrentFilters, selection?: string) {
  const params = new URLSearchParams({
    estado: filters.estado,
    nivel: filters.nivel,
    origen: filters.origen,
  });
  if (filters.q) params.set("q", filters.q);
  if (selection) params.set("seleccion", selection);
  return `/recomendaciones?${params.toString()}`;
}

function levelClass(level: BusinessSignalLevel) {
  return {
    critico: styles.levelCritical,
    importante: styles.levelImportant,
    atencion: styles.levelAttention,
    info: styles.levelInfo,
  }[level];
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    recommendation_created: "Creada",
    recommendation_status_changed: "Cambio de estado",
    recommendation_action_executed: "Acción ejecutada",
    recommendation_action_failed: "Acción fallida",
    evaluation_completed: "Evaluación",
    evaluation_failed: "Error de evaluación",
  };
  return labels[eventType] ?? eventType.replaceAll("_", " ");
}

function validStatus(
  value: string | undefined,
): BusinessRecommendationStatus | "all" | "history" {
  return STATUS_OPTIONS.some((option) => option.value === value)
    ? (value as BusinessRecommendationStatus | "all" | "history")
    : "active";
}

function validLevel(value: string | undefined): BusinessSignalLevel | "all" {
  return LEVEL_OPTIONS.some((option) => option.value === value)
    ? (value as BusinessSignalLevel | "all")
    : "all";
}

function validSource(value: string | undefined): BusinessSignalSource | "all" {
  return SOURCE_OPTIONS.some((option) => option.value === value)
    ? (value as BusinessSignalSource | "all")
    : "all";
}
