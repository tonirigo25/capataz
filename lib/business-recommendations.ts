import type {
  BusinessRecommendationStatus as PrismaBusinessRecommendationStatus,
  BusinessSignalLevel,
  BusinessSignalSource,
  Prisma
} from "@prisma/client";
import {
  formatSignalLevel,
  getBusinessSignals,
  resolveSnoozeUntil,
  signalLevelRank,
  signalSourceLabel,
  type BusinessSignal,
  type SignalSnoozePreset
} from "@/lib/business-signals";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { logProactiveAuditEvent } from "@/lib/proactive-audit";
import { cooldownUntilForRule, materialChangeExceeded, materialChangeExplanation, stableMaterialHash } from "@/lib/proactive-rules";
import {
  resolveRecommendationAction,
  serializeRecommendationActions,
  type RecommendationAction,
  type RecommendationActionContext,
  type RecommendationEntityType
} from "@/lib/recommendation-actions";

export type BusinessRecommendationStatus = PrismaBusinessRecommendationStatus;

export type BusinessRecommendation = {
  id: string;
  fingerprint: string;
  signalFingerprint: string | null;
  type: string;
  title: string;
  summary: string;
  detailedExplanation: string;
  level: BusinessSignalLevel;
  levelText: string;
  status: BusinessRecommendationStatus;
  statusLabel: string;
  source: BusinessSignalSource;
  sourceLabel: string;
  ruleId: string | null;
  ruleVersion: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  entityHref: string | null;
  clientId: string | null;
  workId: string | null;
  invoiceId: string | null;
  budgetId: string | null;
  amount: number | null;
  score: number;
  priority: number;
  detectedAt: Date;
  recommendedAt: Date;
  dueAt: Date | null;
  expiresAt: Date | null;
  shownAt: Date | null;
  viewedAt: Date | null;
  reviewedAt: Date | null;
  reactivatedAt: Date | null;
  lastEvaluatedAt: Date | null;
  cooldownUntil: Date | null;
  changeHash: string | null;
  preferredAction: RecommendationAction | null;
  suggestedActions: RecommendationAction[];
  alternativeActions: RecommendationAction[];
  requiresConfirmation: boolean;
  evidence: RecommendationEvidence;
  context: RecommendationContext;
  dismissedAt: Date | null;
  dismissedReason: string | null;
  snoozedUntil: Date | null;
  acceptedAt: Date | null;
  actionStartedAt: Date | null;
  completedAt: Date | null;
  outcome: RecommendationOutcome | null;
  utilityScore: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RecommendationEvidence = {
  signalTitle?: string;
  signalSummary?: string;
  signalWhy?: string;
  signalRule?: string;
  dataUsed: string[];
  scoreBreakdown: Array<{ label: string; value: number; detail: string }>;
  consequence?: string;
};

export type RecommendationContext = {
  signalId?: string;
  signalFingerprint?: string;
  signalType?: string;
  signalStatus?: string;
  sourceModule?: string;
  entity?: { type: string; id: string; label: string; href: string } | null;
  preferredActionId?: string | null;
  generatedFrom?: "signal";
};

export type RecommendationOutcome = {
  status: string;
  message: string;
  entityType?: string;
  entityId?: string;
  href?: string;
  at?: string;
};

export type BusinessRecommendationGroup = {
  key: string;
  title: string;
  source: BusinessSignalSource;
  level: BusinessSignalLevel;
  status: BusinessRecommendationStatus | "mixed";
  count: number;
  totalAmount: number;
  maxPriority: number;
  topRecommendations: BusinessRecommendation[];
  explanation: string;
};

export type BusinessRecommendationSummary = {
  total: number;
  active: number;
  viewed: number;
  accepted: number;
  inProgress: number;
  completed: number;
  snoozed: number;
  dismissed: number;
  obsolete: number;
  failed: number;
  critical: number;
  important: number;
  totalAmount: number;
  top: BusinessRecommendation | null;
  generatedAt: Date;
};

export type BusinessRecommendationsParams = {
  status?: BusinessRecommendationStatus | "all" | "history";
  level?: BusinessSignalLevel | "all";
  source?: BusinessSignalSource | "all";
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  budgetId?: string;
  q?: string;
  limit?: number;
  now?: Date;
  sync?: boolean;
  respectCooldown?: boolean;
};

export type BusinessRecommendationsResult = {
  recommendations: BusinessRecommendation[];
  groups: BusinessRecommendationGroup[];
  summary: BusinessRecommendationSummary;
  generatedAt: Date;
  filters: Required<Omit<BusinessRecommendationsParams, "now" | "sync" | "respectCooldown" | "clientId" | "workId" | "invoiceId" | "budgetId">> & {
    clientId: string;
    workId: string;
    invoiceId: string;
    budgetId: string;
  };
  persistenceAvailable: boolean;
};

type RecommendationDraft = Omit<
  BusinessRecommendation,
  "id" | "status" | "statusLabel" | "shownAt" | "viewedAt" | "reviewedAt" | "reactivatedAt" | "lastEvaluatedAt" | "cooldownUntil" | "changeHash" | "dismissedAt" | "dismissedReason" | "snoozedUntil" | "acceptedAt" | "actionStartedAt" | "completedAt" | "outcome" | "utilityScore" | "createdAt" | "updatedAt"
> & {
  status: BusinessRecommendationStatus;
};

type RecommendationState = {
  id: string;
  fingerprint: string;
  signalFingerprint: string | null;
  type: string;
  title: string;
  summary: string;
  detailedExplanation: string;
  level: BusinessSignalLevel;
  status: BusinessRecommendationStatus;
  source: BusinessSignalSource;
  ruleId: string | null;
  ruleVersion: string | null;
  entityType: string | null;
  entityId: string | null;
  clientId: string | null;
  workId: string | null;
  invoiceId: string | null;
  budgetId: string | null;
  amount: number | null;
  score: number;
  priority: number;
  detectedAt: Date;
  recommendedAt: Date;
  dueAt: Date | null;
  expiresAt: Date | null;
  shownAt: Date | null;
  viewedAt: Date | null;
  reviewedAt: Date | null;
  reactivatedAt: Date | null;
  lastEvaluatedAt: Date | null;
  cooldownUntil: Date | null;
  changeHash: string | null;
  preferredActionId: string | null;
  requiresConfirmation: boolean;
  suggestedActions: Prisma.JsonValue | null;
  alternativeActions: Prisma.JsonValue | null;
  evidence: Prisma.JsonValue | null;
  context: Prisma.JsonValue | null;
  dismissedAt: Date | null;
  dismissedReason: string | null;
  snoozedUntil: Date | null;
  snoozeReason: string | null;
  acceptedAt: Date | null;
  actionStartedAt: Date | null;
  completedAt: Date | null;
  outcome: Prisma.JsonValue | null;
  utilityScore: number;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_LIMIT = 80;
const ACTIVE_STATUSES: BusinessRecommendationStatus[] = ["active", "viewed", "accepted", "in_progress", "failed"];
const HISTORICAL_STATUSES: BusinessRecommendationStatus[] = ["completed", "dismissed", "obsolete"];

export async function getBusinessRecommendations(params: BusinessRecommendationsParams = {}): Promise<BusinessRecommendationsResult> {
  const now = params.now ?? new Date();
  const signalResult = await getBusinessSignals({ status: "active", limit: 300, now });
  const drafts = buildRecommendationDraftsFromSignals(signalResult.signals, now);
  const shouldSync = params.sync !== false;
  const { states, persistenceAvailable } = shouldSync
    ? await loadOrSyncRecommendationStates(drafts, now)
    : { states: new Map<string, RecommendationState>(), persistenceAvailable: false };
  const recommendations = states.size ? mergeRecommendationStates(drafts, states) : drafts.map(recommendationWithActiveState);
  return filterAndGroupRecommendations(recommendations, params, now, persistenceAvailable);
}

export async function getTodayRecommendationBrief(limit = 4) {
  const preferences = await loadRecommendationPreferences();
  const maxToday = preferences.find((preference) => preference.scopeType === "today" && preference.maxToday)?.maxToday ?? limit;
  const result = await getBusinessRecommendations({ status: "active", limit: Math.min(limit, maxToday), respectCooldown: true });
  return { recommendations: result.recommendations.slice(0, Math.min(limit, maxToday)), summary: result.summary };
}

export async function getRecommendationsForClient(clientId: string, limit = 3) {
  return getBusinessRecommendations({ status: "active", clientId, limit });
}

export async function getRecommendationsForWork(workId: string, limit = 3) {
  return getBusinessRecommendations({ status: "active", workId, limit });
}

export async function getTreasuryRecommendations(limit = 5) {
  return getBusinessRecommendations({ status: "active", source: "tesoreria", limit });
}

export async function markRecommendationViewed(fingerprint: string) {
  const state = await getRecommendationStateByFingerprint(fingerprint);
  if (!state) throw new Error("La recomendacion no existe o la migracion no esta aplicada.");
  const now = new Date();
  await prisma.businessRecommendation.update({
    where: { fingerprint },
    data: {
      status: state.status === "active" ? "viewed" : state.status,
      shownAt: state.shownAt ?? now,
      viewedAt: state.viewedAt ?? now,
      reviewedAt: now,
      cooldownUntil: cooldownUntilForRule(state.ruleId ?? state.type, state.level, now),
      utilityScore: { increment: 1 }
    }
  });
  await logRecommendationEvent({ recommendationId: state.id, actionId: "mark_reviewed", status: "success", entityType: state.entityType, entityId: state.entityId, result: { status: "viewed" } });
  await logProactiveAuditEvent({
    eventType: "recommendation_status_changed",
    origin: "user",
    recommendationFingerprint: fingerprint,
    actionId: "mark_reviewed",
    entityType: state.entityType,
    entityId: state.entityId,
    previousStatus: state.status,
    nextStatus: state.status === "active" ? "viewed" : state.status,
    reason: "Revisada por el usuario; sigue activa mientras persista la causa.",
    ruleId: state.ruleId,
    values: { cooldownUntil: cooldownUntilForRule(state.ruleId ?? state.type, state.level, now).toISOString() }
  });
}

export async function snoozeBusinessRecommendation(fingerprint: string, preset: SignalSnoozePreset, reason?: string) {
  const until = resolveSnoozeUntil(preset);
  return snoozeBusinessRecommendationUntil(fingerprint, until, reason ?? `Pospuesta hasta ${formatDate(until)}`);
}

export async function snoozeBusinessRecommendationUntil(fingerprint: string, until: Date, reason?: string) {
  const state = await getRecommendationStateByFingerprint(fingerprint);
  if (!state) throw new Error("La recomendacion no existe o la migracion no esta aplicada.");
  await prisma.businessRecommendation.update({
    where: { fingerprint },
    data: {
      status: "snoozed",
      snoozedUntil: until,
      snoozeReason: reason ?? null,
      cooldownUntil: until,
      utilityScore: { increment: 1 }
    }
  });
  await logRecommendationEvent({
    recommendationId: state.id,
    actionId: "snooze_recommendation",
    status: "success",
    entityType: state.entityType,
    entityId: state.entityId,
    result: { status: "snoozed", until: until.toISOString(), reason: reason ?? null }
  });
  await logProactiveAuditEvent({
    eventType: "recommendation_status_changed",
    origin: "user",
    recommendationFingerprint: fingerprint,
    actionId: "snooze_recommendation",
    entityType: state.entityType,
    entityId: state.entityId,
    previousStatus: state.status,
    nextStatus: "snoozed",
    reason: reason ?? "Pospuesta por el usuario",
    ruleId: state.ruleId,
    values: { until: until.toISOString() }
  });
}

export async function dismissBusinessRecommendation(fingerprint: string, reason = "", dismissedBy = "usuario") {
  const state = await getRecommendationStateByFingerprint(fingerprint);
  if (!state) throw new Error("La recomendacion no existe o la migracion no esta aplicada.");
  await prisma.businessRecommendation.update({
    where: { fingerprint },
    data: {
      status: "dismissed",
      dismissedAt: new Date(),
      dismissedReason: reason || null,
      outcome: { status: "dismissed", message: reason || "Descartada por el usuario", by: dismissedBy },
      utilityScore: { decrement: 1 }
    }
  });
  await logRecommendationEvent({
    recommendationId: state.id,
    actionId: "dismiss_recommendation",
    status: "success",
    entityType: state.entityType,
    entityId: state.entityId,
    result: { status: "dismissed", reason: reason || null }
  });
  await logProactiveAuditEvent({
    eventType: "recommendation_status_changed",
    origin: "user",
    recommendationFingerprint: fingerprint,
    actionId: "dismiss_recommendation",
    entityType: state.entityType,
    entityId: state.entityId,
    previousStatus: state.status,
    nextStatus: "dismissed",
    reason: reason || "Descartada por el usuario",
    ruleId: state.ruleId,
    values: { dismissedBy }
  });
}

export async function acceptBusinessRecommendation(fingerprint: string) {
  const state = await getRecommendationStateByFingerprint(fingerprint);
  if (!state) throw new Error("La recomendacion no existe o la migracion no esta aplicada.");
  await prisma.businessRecommendation.update({
    where: { fingerprint },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
      utilityScore: { increment: 2 }
    }
  });
  await logRecommendationEvent({
    recommendationId: state.id,
    actionId: state.preferredActionId ?? "accept",
    status: "success",
    entityType: state.entityType,
    entityId: state.entityId,
    result: { status: "accepted" }
  });
  await logProactiveAuditEvent({
    eventType: "recommendation_status_changed",
    origin: "user",
    recommendationFingerprint: fingerprint,
    actionId: state.preferredActionId ?? "accept",
    entityType: state.entityType,
    entityId: state.entityId,
    previousStatus: state.status,
    nextStatus: "accepted",
    reason: "Aceptada por el usuario; no implica ejecución externa automática.",
    ruleId: state.ruleId
  });
}

export async function reactivateBusinessRecommendation(fingerprint: string, reason = "Reactivada manualmente por el usuario") {
  const state = await getRecommendationStateByFingerprint(fingerprint);
  if (!state) throw new Error("La recomendacion no existe o la migracion no esta aplicada.");
  const now = new Date();
  await prisma.businessRecommendation.update({
    where: { fingerprint },
    data: {
      status: "active",
      snoozedUntil: null,
      snoozeReason: null,
      cooldownUntil: null,
      reactivatedAt: now,
      outcome: { status: "reactivated", message: reason, at: now.toISOString() }
    }
  });
  await logRecommendationEvent({
    recommendationId: state.id,
    actionId: "reactivate_recommendation",
    status: "success",
    entityType: state.entityType,
    entityId: state.entityId,
    result: { status: "active", reason }
  });
  await logProactiveAuditEvent({
    eventType: "recommendation_status_changed",
    origin: "user",
    recommendationFingerprint: fingerprint,
    actionId: "reactivate_recommendation",
    entityType: state.entityType,
    entityId: state.entityId,
    previousStatus: state.status,
    nextStatus: "active",
    reason,
    ruleId: state.ruleId
  });
}

export async function executeConfirmedRecommendationAction({
  fingerprint,
  actionId,
  userIntent,
  idempotencyKey
}: {
  fingerprint: string;
  actionId: string;
  userIntent?: string;
  idempotencyKey?: string;
}) {
  const state = await getRecommendationStateByFingerprint(fingerprint);
  if (!state) throw new Error("La recomendacion no existe o la migracion no esta aplicada.");
  const recommendation = recommendationFromState(state);
  const action = [...recommendation.suggestedActions, ...recommendation.alternativeActions].find((item) => item.id === actionId);
  if (!action) throw new Error("Accion no permitida para esta recomendacion.");
  if (!action.requiresConfirmation) throw new Error("Esta accion no requiere ejecucion server confirmada.");
  if (!["active", "viewed", "accepted", "failed"].includes(state.status)) {
    await logRecommendationEvent({ recommendationId: state.id, actionId, status: "skipped", entityType: state.entityType, entityId: state.entityId, result: { status: state.status } });
    return { status: "skipped", message: "La recomendacion ya no esta activa.", recommendation };
  }

  const key = idempotencyKey ?? `${fingerprint}:${actionId}:${state.entityId ?? state.invoiceId ?? state.budgetId ?? "business"}`;
  const previous = await prisma.recommendationActionLog.findUnique({ where: { idempotencyKey: key } });
  if (previous?.status === "success") {
    return { status: "success", message: "Esta accion ya se realizo.", recommendation, entityId: readResultEntityId(previous.result) };
  }

  const stillValid = await isRecommendationStillValid(state);
  if (!stillValid) {
    await prisma.businessRecommendation.update({
      where: { fingerprint },
      data: { status: "obsolete", outcome: { status: "obsolete", message: "La señal origen ya no esta activa." } }
    });
    await logRecommendationEvent({ recommendationId: state.id, actionId, status: "skipped", idempotencyKey: key, entityType: state.entityType, entityId: state.entityId, result: { status: "obsolete" } });
    await logProactiveAuditEvent({
      eventType: "recommendation_status_changed",
      origin: "action",
      recommendationFingerprint: fingerprint,
      actionId,
      entityType: state.entityType,
      entityId: state.entityId,
      previousStatus: state.status,
      nextStatus: "obsolete",
      reason: "La señal origen ya no está activa.",
      ruleId: state.ruleId,
      idempotencyKey: key,
      result: "skipped"
    });
    return { status: "obsolete", message: "Esta recomendacion ya no es necesaria.", recommendation };
  }

  try {
    await prisma.businessRecommendation.update({
      where: { fingerprint },
      data: { status: "accepted", acceptedAt: state.acceptedAt ?? new Date(), actionStartedAt: new Date() }
    });
    const result = await executeKnownAction(state, actionId);
    await prisma.businessRecommendation.update({
      where: { fingerprint },
      data: {
        status: "in_progress",
        outcome: result as unknown as Prisma.InputJsonObject,
        utilityScore: { increment: 3 }
      }
    });
    await logRecommendationEvent({
      recommendationId: state.id,
      actionId,
      status: "success",
      idempotencyKey: key,
      entityType: result.entityType ?? state.entityType,
      entityId: result.entityId ?? state.entityId,
      userIntent,
      result: result as unknown as Prisma.InputJsonObject
    });
    await logProactiveAuditEvent({
      eventType: "recommendation_action_executed",
      origin: "action",
      recommendationFingerprint: fingerprint,
      actionId,
      entityType: result.entityType ?? state.entityType,
      entityId: result.entityId ?? state.entityId,
      previousStatus: state.status,
      nextStatus: "in_progress",
      reason: result.message,
      ruleId: state.ruleId,
      idempotencyKey: key,
      result: result.status,
      confirmation: true,
      payload: { safeAction: action.kind, externalAction: false }
    });
    return { status: "success", message: result.message, recommendation, entityId: result.entityId, href: result.href };
  } catch (error) {
    const message = sanitizeError(error);
    await prisma.businessRecommendation.update({
      where: { fingerprint },
      data: { status: "failed", outcome: { status: "failed", message } }
    });
    await logRecommendationEvent({ recommendationId: state.id, actionId, status: "failed", idempotencyKey: key, entityType: state.entityType, entityId: state.entityId, userIntent, error: message });
    await logProactiveAuditEvent({
      eventType: "recommendation_action_failed",
      origin: "action",
      recommendationFingerprint: fingerprint,
      actionId,
      entityType: state.entityType,
      entityId: state.entityId,
      previousStatus: state.status,
      nextStatus: "failed",
      reason: "Falló la acción confirmada.",
      ruleId: state.ruleId,
      idempotencyKey: key,
      error: message,
      confirmation: true
    });
    return { status: "failed", message, recommendation };
  }
}

export function buildRecommendationDraftsFromSignalsForTest(signals: BusinessSignal[], now = new Date()) {
  return buildRecommendationDraftsFromSignals(signals, now);
}

export function previewRecommendationStatusForTest({
  status,
  snoozedUntil,
  lastPriority,
  priority,
  ruleVersion,
  signalRuleVersion,
  changeHash,
  nextChangeHash,
  now = new Date()
}: {
  status?: BusinessRecommendationStatus;
  snoozedUntil?: Date | null;
  lastPriority?: number;
  priority?: number;
  ruleVersion?: string | null;
  signalRuleVersion?: string | null;
  changeHash?: string | null;
  nextChangeHash?: string | null;
  now?: Date;
}) {
  return nextRecommendationStatus(
    { status: status ?? "active", snoozedUntil: snoozedUntil ?? null, priority: lastPriority ?? priority ?? 0, ruleVersion: ruleVersion ?? null, changeHash: changeHash ?? null },
    { priority: priority ?? 0, ruleVersion: signalRuleVersion ?? ruleVersion ?? null, type: "test", ruleId: "test" },
    now,
    nextChangeHash ?? changeHash ?? null
  );
}

function buildRecommendationDraftsFromSignals(signals: BusinessSignal[], now: Date): RecommendationDraft[] {
  const drafts = signals
    .filter((signal) => signal.status === "active")
    .map((signal) => recommendationFromSignal(signal, now))
    .filter((recommendation): recommendation is RecommendationDraft => Boolean(recommendation));
  return dedupeRecommendationDrafts(drafts);
}

function recommendationFromSignal(signal: BusinessSignal, now: Date): RecommendationDraft | null {
  const ids = idsFromSignal(signal);
  const spec = recommendationSpec(signal, ids);
  if (!spec) return null;
  const actionContext: RecommendationActionContext = {
    recommendationFingerprint: spec.fingerprint,
    entityType: spec.entityType,
    entityId: spec.entityId,
    clientId: ids.clientId,
    workId: ids.workId,
    invoiceId: ids.invoiceId,
    budgetId: ids.budgetId,
    amount: signal.relatedAmount,
    title: spec.title,
    reason: signal.explanation.why,
    returnTo: "/recomendaciones"
  };
  const actions = spec.actionIds
    .map((actionId) => resolveRecommendationAction(actionId, actionContext))
    .filter((action): action is RecommendationAction => Boolean(action));
  if (!actions.length) return null;
  const preferredAction = actions.find((action) => action.id === spec.preferredActionId) ?? actions[0] ?? null;
  const alternativeActions = actions.filter((action) => action.id !== preferredAction?.id).slice(0, 5);
  const priority = recommendationPriority(signal, preferredAction?.requiresConfirmation ?? false);
  return {
    fingerprint: spec.fingerprint,
    signalFingerprint: signal.fingerprint,
    type: spec.type,
    title: spec.title,
    summary: spec.summary,
    detailedExplanation: detailedExplanationForSignal(signal, preferredAction),
    level: signal.level,
    levelText: formatSignalLevel(signal.level),
    status: "active",
    source: signal.source,
    sourceLabel: signalSourceLabel(signal.source),
    ruleId: signal.ruleId,
    ruleVersion: signal.ruleVersion,
    entityType: spec.entityType,
    entityId: spec.entityId,
    entityLabel: signal.entity?.label ?? signal.client?.label ?? signal.work?.label ?? null,
    entityHref: signal.entity?.href ?? signal.client?.href ?? signal.work?.href ?? null,
    clientId: ids.clientId,
    workId: ids.workId,
    invoiceId: ids.invoiceId,
    budgetId: ids.budgetId,
    amount: signal.relatedAmount,
    score: signal.score,
    priority,
    detectedAt: signal.detectedAt,
    recommendedAt: now,
    dueAt: signal.fecha,
    expiresAt: signal.expiresAt,
    preferredAction,
    suggestedActions: preferredAction ? [preferredAction, ...alternativeActions.slice(0, 2)] : alternativeActions.slice(0, 3),
    alternativeActions,
    requiresConfirmation: Boolean(preferredAction?.requiresConfirmation),
    evidence: {
      signalTitle: signal.title,
      signalSummary: signal.summary,
      signalWhy: signal.explanation.why,
      signalRule: signal.explanation.rule,
      dataUsed: signal.explanation.dataUsed,
      scoreBreakdown: signal.explanation.scoreBreakdown,
      consequence: signal.explanation.consequence
    },
    context: {
      signalId: signal.id,
      signalFingerprint: signal.fingerprint,
      signalType: signal.type,
      signalStatus: signal.status,
      sourceModule: signal.source,
      entity: signal.entity,
      preferredActionId: preferredAction?.id ?? null,
      generatedFrom: "signal"
    }
  };
}

function recommendationSpec(signal: BusinessSignal, ids: ReturnType<typeof idsFromSignal>) {
  const key = ids.invoiceId ?? ids.budgetId ?? ids.workId ?? ids.clientId ?? signal.entity?.id ?? stableSignalSuffix(signal.fingerprint);
  const isInvoice = ids.invoiceId || signal.entity?.type === "factura" || ["facturas", "cobros"].includes(signal.source);
  const isBudget = ids.budgetId || signal.entity?.type === "presupuesto" || signal.source === "presupuestos";
  const isWork = ids.workId || signal.entity?.type === "obra" || ["obras", "rentabilidad", "materiales"].includes(signal.source);
  const isClient = ids.clientId || signal.entity?.type === "cliente" || ["crm", "datos"].includes(signal.source);

  if (isInvoice) {
    const overdue = /overdue|partial|vencid|cobro/i.test(`${signal.type} ${signal.title}`);
    return {
      type: overdue ? "invoice_collection" : "invoice_review",
      fingerprint: `recommendation:${overdue ? "invoice_collection" : "invoice_review"}:${key}`,
      title: overdue ? `Revisar cobro de ${signal.entity?.label ?? "factura pendiente"}` : `Revisar factura ${signal.entity?.label ?? "pendiente"}`,
      summary: signal.explanation.why,
      entityType: "invoice",
      entityId: ids.invoiceId ?? signal.entity?.id ?? null,
      preferredActionId: overdue ? "create_collection_followup" : "view_invoice",
      actionIds: ["create_collection_followup", "view_invoice", "register_payment", "view_client", "generate_invoice_pdf"]
    };
  }
  if (isBudget) {
    const followup = /stalled|caduc|expir|respuesta|enviado/i.test(`${signal.type} ${signal.title}`);
    return {
      type: followup ? "budget_followup" : "budget_review",
      fingerprint: `recommendation:${followup ? "budget_followup" : "budget_review"}:${key}`,
      title: followup ? `Hacer seguimiento de ${signal.entity?.label ?? "presupuesto"}` : `Revisar presupuesto ${signal.entity?.label ?? ""}`.trim(),
      summary: signal.explanation.why,
      entityType: "budget",
      entityId: ids.budgetId ?? signal.entity?.id ?? null,
      preferredActionId: followup ? "create_budget_followup" : "view_budget",
      actionIds: ["create_budget_followup", "view_budget", "generate_budget_pdf", "view_client", "view_work"]
    };
  }
  if (isWork) {
    const costReview = ["rentabilidad", "materiales", "gastos"].includes(signal.source) || /margin|cost|material|margen|coste/i.test(`${signal.type} ${signal.title}`);
    return {
      type: costReview ? "work_cost_review" : "work_operational_review",
      fingerprint: `recommendation:${costReview ? "work_cost_review" : "work_operational_review"}:${key}`,
      title: costReview ? `Revisar costes de ${signal.work?.label ?? signal.entity?.label ?? "obra"}` : `Revisar obra ${signal.work?.label ?? signal.entity?.label ?? ""}`.trim(),
      summary: signal.explanation.why,
      entityType: "work",
      entityId: ids.workId ?? signal.entity?.id ?? null,
      preferredActionId: costReview ? "review_work_costs" : "view_work",
      actionIds: ["review_work_costs", "view_work", "create_visit_draft", "view_client", "view_expenses"]
    };
  }
  if (isClient) {
    const dataCompletion = /data|datos|cif|nif|incomplet/i.test(`${signal.type} ${signal.title}`);
    return {
      type: dataCompletion ? "client_data_completion" : "client_review",
      fingerprint: `recommendation:${dataCompletion ? "client_data_completion" : "client_review"}:${key}`,
      title: dataCompletion ? `Completar datos de ${signal.client?.label ?? signal.entity?.label ?? "cliente"}` : `Revisar cliente ${signal.client?.label ?? signal.entity?.label ?? ""}`.trim(),
      summary: signal.explanation.why,
      entityType: "client",
      entityId: ids.clientId ?? signal.entity?.id ?? null,
      preferredActionId: dataCompletion ? "complete_client_data" : "view_client",
      actionIds: ["complete_client_data", "view_client", "view_alerts"]
    };
  }
  if (signal.source === "tesoreria") {
    return {
      type: "treasury_review",
      fingerprint: `recommendation:treasury_review:${key}`,
      title: `Revisar tesoreria: ${signal.title}`,
      summary: signal.explanation.why,
      entityType: "treasury",
      entityId: null,
      preferredActionId: "view_treasury",
      actionIds: ["view_treasury", "consult_conservative_scenario", "view_alerts"]
    };
  }
  if (["agenda", "visitas"].includes(signal.source)) {
    return {
      type: "agenda_followup",
      fingerprint: `recommendation:agenda_followup:${key}`,
      title: `Revisar agenda: ${signal.title}`,
      summary: signal.explanation.why,
      entityType: "agenda",
      entityId: signal.entity?.id ?? null,
      preferredActionId: "view_agenda",
      actionIds: ["view_agenda", "view_client", "view_work"]
    };
  }
  if (signal.source === "recordatorios") {
    return {
      type: "reminder_followup",
      fingerprint: `recommendation:reminder_followup:${key}`,
      title: `Revisar recordatorio: ${signal.title}`,
      summary: signal.explanation.why,
      entityType: "reminder",
      entityId: signal.entity?.id ?? null,
      preferredActionId: "view_reminders",
      actionIds: ["view_reminders", "view_client", "view_work"]
    };
  }
  if (signal.source === "documentos") {
    return {
      type: "document_review",
      fingerprint: `recommendation:document_review:${key}`,
      title: `Revisar documentacion: ${signal.title}`,
      summary: signal.explanation.why,
      entityType: "document",
      entityId: signal.entity?.id ?? null,
      preferredActionId: "view_documents",
      actionIds: ["view_documents", "view_client", "view_work"]
    };
  }
  if (["gastos", "materiales"].includes(signal.source)) {
    return {
      type: "expense_review",
      fingerprint: `recommendation:expense_review:${key}`,
      title: `Revisar gasto o material: ${signal.title}`,
      summary: signal.explanation.why,
      entityType: "expense",
      entityId: signal.entity?.id ?? null,
      preferredActionId: "view_expenses",
      actionIds: ["view_expenses", "view_work", "view_treasury"]
    };
  }
  return {
    type: "business_review",
    fingerprint: `recommendation:business_review:${key}`,
    title: `Revisar: ${signal.title}`,
    summary: signal.explanation.why,
    entityType: "business",
    entityId: null,
    preferredActionId: "view_alerts",
    actionIds: ["view_alerts"]
  };
}

async function loadOrSyncRecommendationStates(drafts: RecommendationDraft[], now: Date) {
  try {
    const states = await syncRecommendationStates(drafts, now);
    return { states, persistenceAvailable: true };
  } catch (error) {
    if (isRecommendationTableMissing(error)) return { states: new Map<string, RecommendationState>(), persistenceAvailable: false };
    throw error;
  }
}

async function syncRecommendationStates(drafts: RecommendationDraft[], now: Date) {
  const fingerprints = drafts.map((draft) => draft.fingerprint);
  const existing = await prisma.businessRecommendation.findMany({
    where: fingerprints.length
      ? { OR: [{ fingerprint: { in: fingerprints } }, { status: { in: [...ACTIVE_STATUSES, "snoozed"] } }] }
      : { status: { in: [...ACTIVE_STATUSES, "snoozed"] } }
  });
  const existingMap = new Map(existing.map((state) => [state.fingerprint, state as RecommendationState]));
  const current = new Set(fingerprints);
  const auditEvents: Array<Parameters<typeof logProactiveAuditEvent>[0]> = [];

  for (const draft of drafts) {
    const previous = existingMap.get(draft.fingerprint);
    const changeHash = recommendationChangeHash(draft);
    const status = nextRecommendationStatus(previous, draft, now, changeHash);
    const update = recommendationUpdateInput(draft, status, previous, now, changeHash);
    await prisma.businessRecommendation.upsert({
      where: { fingerprint: draft.fingerprint },
      create: recommendationCreateInput(draft, status, changeHash),
      update
    });
    if (!previous) {
      auditEvents.push({
        eventType: "recommendation_created",
        origin: "evaluation",
        recommendationFingerprint: draft.fingerprint,
        signalFingerprint: draft.signalFingerprint,
        entityType: draft.entityType,
        entityId: draft.entityId,
        nextStatus: status,
        reason: "Nueva recomendación derivada de señal activa.",
        ruleId: draft.ruleId,
        values: { priority: draft.priority, level: draft.level, changeHash }
      });
    } else if (previous.status !== status) {
      auditEvents.push({
        eventType: "recommendation_status_changed",
        origin: "evaluation",
        recommendationFingerprint: draft.fingerprint,
        signalFingerprint: draft.signalFingerprint,
        entityType: draft.entityType,
        entityId: draft.entityId,
        previousStatus: previous.status,
        nextStatus: status,
        reason: status === "active" && previous.status !== "active"
          ? materialChangeExplanation({ previousPriority: previous.priority, nextPriority: draft.priority, previousHash: previous.changeHash, nextHash: changeHash, ruleId: draft.ruleId })
          : `Estado actualizado por evaluación determinista: ${status}.`,
        ruleId: draft.ruleId,
        values: { previousPriority: previous.priority, nextPriority: draft.priority, changeHash }
      });
    }
  }

  const obsoleteCandidates = existing.filter((state) => !current.has(state.fingerprint) && ["active", "viewed", "accepted", "in_progress", "snoozed", "failed"].includes(state.status));
  if (obsoleteCandidates.length) {
    for (const state of obsoleteCandidates) {
      await prisma.businessRecommendation.update({
        where: { fingerprint: state.fingerprint },
        data: {
          status: "obsolete",
          lastEvaluatedAt: now,
          cooldownUntil: null,
          outcome: { status: "obsolete", message: "La señal origen ya no esta activa." }
        }
      });
      auditEvents.push({
        eventType: "recommendation_status_changed",
        origin: "evaluation",
        recommendationFingerprint: state.fingerprint,
        signalFingerprint: state.signalFingerprint,
        entityType: state.entityType,
        entityId: state.entityId,
        previousStatus: state.status,
        nextStatus: "obsolete",
        reason: "La señal origen ya no está activa.",
        ruleId: state.ruleId,
        values: { priority: state.priority }
      });
    }
  }

  await Promise.all(auditEvents.map((event) => logProactiveAuditEvent(event)));

  const refreshed = await prisma.businessRecommendation.findMany({
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 600
  });
  return new Map(refreshed.map((state) => [state.fingerprint, state as RecommendationState]));
}

function recommendationCreateInput(draft: RecommendationDraft, status: BusinessRecommendationStatus, changeHash: string): Prisma.BusinessRecommendationCreateInput {
  return {
    fingerprint: draft.fingerprint,
    signalFingerprint: draft.signalFingerprint,
    type: draft.type,
    title: draft.title,
    summary: draft.summary,
    detailedExplanation: draft.detailedExplanation,
    level: draft.level,
    status,
    source: draft.source,
    ruleId: draft.ruleId,
    ruleVersion: draft.ruleVersion,
    entityType: draft.entityType,
    entityId: draft.entityId,
    clientId: draft.clientId,
    workId: draft.workId,
    invoiceId: draft.invoiceId,
    budgetId: draft.budgetId,
    amount: draft.amount,
    score: draft.score,
    priority: draft.priority,
    detectedAt: draft.detectedAt,
    recommendedAt: draft.recommendedAt,
    dueAt: draft.dueAt,
    expiresAt: draft.expiresAt,
    shownAt: new Date(),
    lastEvaluatedAt: new Date(),
    changeHash,
    preferredActionId: draft.preferredAction?.id ?? null,
    requiresConfirmation: draft.requiresConfirmation,
    suggestedActions: serializeRecommendationActions(draft.suggestedActions),
    alternativeActions: serializeRecommendationActions(draft.alternativeActions),
    evidence: draft.evidence as unknown as Prisma.InputJsonObject,
    context: draft.context as unknown as Prisma.InputJsonObject
  };
}

function recommendationUpdateInput(draft: RecommendationDraft, status: BusinessRecommendationStatus, previous: RecommendationState | undefined, now: Date, changeHash: string): Prisma.BusinessRecommendationUpdateInput {
  const materiallyChanged = Boolean(previous?.changeHash && previous.changeHash !== changeHash);
  return {
    signalFingerprint: draft.signalFingerprint,
    type: draft.type,
    title: draft.title,
    summary: draft.summary,
    detailedExplanation: draft.detailedExplanation,
    level: draft.level,
    status,
    source: draft.source,
    ruleId: draft.ruleId,
    ruleVersion: draft.ruleVersion,
    entityType: draft.entityType,
    entityId: draft.entityId,
    clientId: draft.clientId,
    workId: draft.workId,
    invoiceId: draft.invoiceId,
    budgetId: draft.budgetId,
    amount: draft.amount,
    score: draft.score,
    priority: draft.priority,
    detectedAt: draft.detectedAt,
    recommendedAt: previous?.recommendedAt ?? now,
    dueAt: draft.dueAt,
    expiresAt: draft.expiresAt,
    shownAt: previous?.shownAt ?? now,
    reactivatedAt: status === "active" && previous?.status && previous.status !== "active" ? now : previous?.reactivatedAt,
    lastEvaluatedAt: now,
    cooldownUntil: materiallyChanged ? null : previous?.cooldownUntil ?? null,
    changeHash,
    preferredActionId: draft.preferredAction?.id ?? null,
    requiresConfirmation: draft.requiresConfirmation,
    suggestedActions: serializeRecommendationActions(draft.suggestedActions),
    alternativeActions: serializeRecommendationActions(draft.alternativeActions),
    evidence: draft.evidence as unknown as Prisma.InputJsonObject,
    context: draft.context as unknown as Prisma.InputJsonObject,
    ...(status === "active" && previous?.status === "snoozed" ? { snoozedUntil: null, snoozeReason: null } : {})
  };
}

function mergeRecommendationStates(drafts: RecommendationDraft[], states: Map<string, RecommendationState>): BusinessRecommendation[] {
  const byFingerprint = new Map(drafts.map((draft) => [draft.fingerprint, draft]));
  const fromStates = [...states.values()].map((state) => recommendationFromState(state));
  const missingDrafts = drafts.filter((draft) => !states.has(draft.fingerprint)).map(recommendationWithActiveState);
  return [...fromStates, ...missingDrafts]
    .map((recommendation) => {
      const draft = byFingerprint.get(recommendation.fingerprint);
      if (!draft) return recommendation;
      if (recommendation.status === "active" || recommendation.status === "viewed" || recommendation.status === "failed") {
        return { ...recommendation, preferredAction: draft.preferredAction, suggestedActions: draft.suggestedActions, alternativeActions: draft.alternativeActions };
      }
      return recommendation;
    })
    .sort(compareRecommendations);
}

function filterAndGroupRecommendations(
  recommendations: BusinessRecommendation[],
  params: BusinessRecommendationsParams,
  now: Date,
  persistenceAvailable: boolean
): BusinessRecommendationsResult {
  const status = params.status ?? "active";
  const level = params.level ?? "all";
  const source = params.source ?? "all";
  const q = params.q?.trim().toLowerCase() ?? "";
  const limit = params.limit ?? DEFAULT_LIMIT;
  const filtered = recommendations.filter((recommendation) => {
    if (status === "active" && !ACTIVE_STATUSES.includes(recommendation.status)) return false;
    if (status === "history" && !HISTORICAL_STATUSES.includes(recommendation.status)) return false;
    if (status !== "active" && status !== "history" && status !== "all" && recommendation.status !== status) return false;
    if (level !== "all" && recommendation.level !== level) return false;
    if (source !== "all" && recommendation.source !== source) return false;
    if (params.clientId && recommendation.clientId !== params.clientId) return false;
    if (params.workId && recommendation.workId !== params.workId) return false;
    if (params.invoiceId && recommendation.invoiceId !== params.invoiceId) return false;
    if (params.budgetId && recommendation.budgetId !== params.budgetId) return false;
    if (recommendation.status === "snoozed" && recommendation.snoozedUntil && recommendation.snoozedUntil > now && status === "active") return false;
    if (params.respectCooldown && status === "active" && recommendation.cooldownUntil && recommendation.cooldownUntil > now && recommendation.level !== "critico") return false;
    if (!q) return true;
    const haystack = [recommendation.title, recommendation.summary, recommendation.detailedExplanation, recommendation.entityLabel, recommendation.type, recommendation.sourceLabel].join(" ").toLowerCase();
    return haystack.includes(q);
  }).sort(compareRecommendations).slice(0, limit);
  return {
    recommendations: filtered,
    groups: groupRecommendations(filtered),
    summary: summarizeRecommendations(filtered, now),
    generatedAt: now,
    filters: {
      status,
      level,
      source,
      q,
      limit,
      clientId: params.clientId ?? "",
      workId: params.workId ?? "",
      invoiceId: params.invoiceId ?? "",
      budgetId: params.budgetId ?? ""
    },
    persistenceAvailable
  };
}

function groupRecommendations(recommendations: BusinessRecommendation[]): BusinessRecommendationGroup[] {
  const groups = new Map<string, BusinessRecommendation[]>();
  for (const recommendation of recommendations) {
    const key = `${recommendation.source}:${recommendation.type}:${recommendation.status}`;
    groups.set(key, [...(groups.get(key) ?? []), recommendation]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort(compareRecommendations);
    const first = sorted[0];
    const status: BusinessRecommendationStatus | "mixed" = sorted.every((item) => item.status === first.status) ? first.status : "mixed";
    return {
      key,
      title: groupTitle(first, sorted.length),
      source: first.source,
      level: first.level,
      status,
      count: sorted.length,
      totalAmount: sorted.reduce((total, item) => total + (item.amount ?? 0), 0),
      maxPriority: sorted[0]?.priority ?? 0,
      topRecommendations: sorted.slice(0, 3),
      explanation: sorted.length === 1 ? first.summary : `${sorted.length} recomendaciones de ${signalSourceLabel(first.source)}. Las ${Math.min(3, sorted.length)} principales concentran prioridad ${sorted.slice(0, 3).map((item) => item.priority).join(", ")}.`
    };
  }).sort((a, b) => b.maxPriority - a.maxPriority || b.count - a.count);
}

function summarizeRecommendations(recommendations: BusinessRecommendation[], generatedAt: Date): BusinessRecommendationSummary {
  return {
    total: recommendations.length,
    active: recommendations.filter((item) => item.status === "active" || item.status === "viewed" || item.status === "accepted" || item.status === "in_progress" || item.status === "failed").length,
    viewed: recommendations.filter((item) => item.status === "viewed").length,
    accepted: recommendations.filter((item) => item.status === "accepted").length,
    inProgress: recommendations.filter((item) => item.status === "in_progress").length,
    completed: recommendations.filter((item) => item.status === "completed").length,
    snoozed: recommendations.filter((item) => item.status === "snoozed").length,
    dismissed: recommendations.filter((item) => item.status === "dismissed").length,
    obsolete: recommendations.filter((item) => item.status === "obsolete").length,
    failed: recommendations.filter((item) => item.status === "failed").length,
    critical: recommendations.filter((item) => item.level === "critico").length,
    important: recommendations.filter((item) => item.level === "importante").length,
    totalAmount: recommendations.reduce((total, item) => total + (item.amount ?? 0), 0),
    top: recommendations[0] ?? null,
    generatedAt
  };
}

function recommendationFromState(state: RecommendationState): BusinessRecommendation {
  const context = contextFromJson(state.context);
  const actionContext: RecommendationActionContext = {
    recommendationFingerprint: state.fingerprint,
    entityType: normalizeEntityType(state.entityType),
    entityId: state.entityId,
    clientId: state.clientId,
    workId: state.workId,
    invoiceId: state.invoiceId,
    budgetId: state.budgetId,
    amount: state.amount,
    title: state.title,
    reason: state.summary,
    returnTo: "/recomendaciones"
  };
  const suggestedActions = actionsFromJson(state.suggestedActions, actionContext);
  const alternativeActions = actionsFromJson(state.alternativeActions, actionContext);
  const preferredAction = state.preferredActionId
    ? [...suggestedActions, ...alternativeActions].find((action) => action.id === state.preferredActionId) ?? null
    : suggestedActions[0] ?? null;
  return {
    id: state.id,
    fingerprint: state.fingerprint,
    signalFingerprint: state.signalFingerprint,
    type: state.type,
    title: state.title,
    summary: state.summary,
    detailedExplanation: state.detailedExplanation,
    level: state.level,
    levelText: formatSignalLevel(state.level),
    status: state.status,
    statusLabel: recommendationStatusLabel(state.status),
    source: state.source,
    sourceLabel: signalSourceLabel(state.source),
    ruleId: state.ruleId,
    ruleVersion: state.ruleVersion,
    entityType: state.entityType,
    entityId: state.entityId,
    entityLabel: context.entity?.label ?? null,
    entityHref: context.entity?.href ?? entityHrefFromState(state),
    clientId: state.clientId,
    workId: state.workId,
    invoiceId: state.invoiceId,
    budgetId: state.budgetId,
    amount: state.amount,
    score: state.score,
    priority: state.priority,
    detectedAt: state.detectedAt,
    recommendedAt: state.recommendedAt,
    dueAt: state.dueAt,
    expiresAt: state.expiresAt,
    shownAt: state.shownAt,
    viewedAt: state.viewedAt,
    reviewedAt: state.reviewedAt,
    reactivatedAt: state.reactivatedAt,
    lastEvaluatedAt: state.lastEvaluatedAt,
    cooldownUntil: state.cooldownUntil,
    changeHash: state.changeHash,
    preferredAction,
    suggestedActions,
    alternativeActions,
    requiresConfirmation: state.requiresConfirmation,
    evidence: evidenceFromJson(state.evidence),
    context,
    dismissedAt: state.dismissedAt,
    dismissedReason: state.dismissedReason,
    snoozedUntil: state.snoozedUntil,
    acceptedAt: state.acceptedAt,
    actionStartedAt: state.actionStartedAt,
    completedAt: state.completedAt,
    outcome: outcomeFromJson(state.outcome),
    utilityScore: state.utilityScore,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

function recommendationWithActiveState(draft: RecommendationDraft): BusinessRecommendation {
  const now = new Date();
  return {
    ...draft,
    id: draft.fingerprint,
    statusLabel: recommendationStatusLabel(draft.status),
    shownAt: now,
    viewedAt: null,
    reviewedAt: null,
    reactivatedAt: null,
    lastEvaluatedAt: null,
    cooldownUntil: null,
    changeHash: recommendationChangeHash(draft),
    dismissedAt: null,
    dismissedReason: null,
    snoozedUntil: null,
    acceptedAt: null,
    actionStartedAt: null,
    completedAt: null,
    outcome: null,
    utilityScore: 0,
    createdAt: now,
    updatedAt: now
  };
}

function nextRecommendationStatus(
  state: Pick<RecommendationState, "status" | "snoozedUntil" | "priority" | "ruleVersion" | "changeHash"> | undefined,
  draft: Pick<RecommendationDraft, "priority" | "ruleVersion" | "ruleId" | "type">,
  now: Date,
  changeHash: string | null = null
): BusinessRecommendationStatus {
  if (!state) return "active";
  if (state.status === "snoozed") return state.snoozedUntil && state.snoozedUntil > now ? "snoozed" : "active";
  if (state.status === "dismissed") {
    return materialChangeExceeded({
      previousPriority: state.priority,
      nextPriority: draft.priority,
      previousRuleVersion: state.ruleVersion,
      nextRuleVersion: draft.ruleVersion,
      previousHash: state.changeHash,
      nextHash: changeHash,
      ruleId: draft.ruleId ?? draft.type
    }) ? "active" : "dismissed";
  }
  if (state.status === "obsolete") return "active";
  if (state.status === "completed") {
    return materialChangeExceeded({
      previousPriority: state.priority,
      nextPriority: draft.priority,
      previousRuleVersion: state.ruleVersion,
      nextRuleVersion: draft.ruleVersion,
      previousHash: state.changeHash,
      nextHash: changeHash,
      ruleId: draft.ruleId ?? draft.type
    }) ? "active" : "completed";
  }
  if (state.status === "accepted" || state.status === "in_progress" || state.status === "viewed" || state.status === "failed") return state.status;
  return "active";
}

export function recommendationChangeHashForTest(recommendation: Pick<RecommendationDraft, "type" | "ruleVersion" | "priority" | "score" | "amount" | "entityType" | "entityId" | "clientId" | "workId" | "invoiceId" | "budgetId" | "dueAt" | "expiresAt">) {
  return recommendationChangeHash(recommendation as RecommendationDraft);
}

function recommendationChangeHash(recommendation: RecommendationDraft) {
  return stableMaterialHash({
    type: recommendation.type,
    ruleVersion: recommendation.ruleVersion,
    priorityBucket: Math.floor(recommendation.priority / 5),
    scoreBucket: Math.floor(recommendation.score / 5),
    amount: recommendation.amount,
    entityType: recommendation.entityType,
    entityId: recommendation.entityId,
    clientId: recommendation.clientId,
    workId: recommendation.workId,
    invoiceId: recommendation.invoiceId,
    budgetId: recommendation.budgetId,
    dueAt: recommendation.dueAt,
    expiresAt: recommendation.expiresAt
  });
}

async function executeKnownAction(state: RecommendationState, actionId: string) {
  if (actionId === "create_collection_followup") {
    if (!state.invoiceId || !state.clientId) throw new Error("Faltan datos de factura o cliente para crear seguimiento.");
    const invoice = await prisma.invoice.findUnique({ where: { id: state.invoiceId }, include: { client: true } });
    if (!invoice || invoice.pendiente <= 0 || invoice.estado === "pagada") return { status: "obsolete", message: "La factura ya no requiere seguimiento.", entityType: "invoice", entityId: state.invoiceId, href: `/dinero/${state.invoiceId}` };
    const existingReminder = await prisma.reminder.findFirst({
      where: {
        facturaId: state.invoiceId,
        tipo: "factura_vencida",
        estado: { in: ["borrador", "pendiente_confirmacion", "programado", "fallido"] }
      },
      orderBy: { fechaProgramada: "asc" }
    });
    if (existingReminder) {
      return { status: "skipped", message: "Ya existe un seguimiento interno activo para esta factura.", entityType: "reminder", entityId: existingReminder.id, href: "/recordatorios" };
    }
    const reminder = await prisma.reminder.create({
      data: {
        clienteId: state.clientId,
        obraId: state.workId,
        facturaId: state.invoiceId,
        tipo: "factura_vencida",
        canal: "interno",
        mensaje: `Seguimiento de cobro recomendado: ${invoice.numero}. ${state.summary}`,
        fechaProgramada: tomorrowAtNine(),
        estado: "programado",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      }
    });
    return { status: "action_created", message: "Seguimiento interno de cobro creado para manana.", entityType: "reminder", entityId: reminder.id, href: "/recordatorios" };
  }
  if (actionId === "create_budget_followup") {
    if (!state.budgetId || !state.clientId) throw new Error("Faltan datos de presupuesto o cliente para crear seguimiento.");
    const budget = await prisma.budget.findUnique({ where: { id: state.budgetId }, include: { client: true } });
    if (!budget || ["rechazado", "aceptado"].includes(budget.estado)) return { status: "obsolete", message: "El presupuesto ya no requiere seguimiento.", entityType: "budget", entityId: state.budgetId, href: `/presupuestos/${state.budgetId}` };
    const existingReminder = await prisma.reminder.findFirst({
      where: {
        presupuestoId: state.budgetId,
        tipo: "seguimiento_presupuesto",
        estado: { in: ["borrador", "pendiente_confirmacion", "programado", "fallido"] }
      },
      orderBy: { fechaProgramada: "asc" }
    });
    if (existingReminder) {
      return { status: "skipped", message: "Ya existe un seguimiento interno activo para este presupuesto.", entityType: "reminder", entityId: existingReminder.id, href: "/recordatorios" };
    }
    const reminder = await prisma.reminder.create({
      data: {
        clienteId: state.clientId,
        obraId: state.workId,
        presupuestoId: state.budgetId,
        tipo: "seguimiento_presupuesto",
        canal: "interno",
        mensaje: `Seguimiento de presupuesto recomendado: ${budget.numero}. ${state.summary}`,
        fechaProgramada: tomorrowAtNine(),
        estado: "programado",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      }
    });
    return { status: "action_created", message: "Seguimiento interno de presupuesto creado para manana.", entityType: "reminder", entityId: reminder.id, href: "/recordatorios" };
  }
  throw new Error("Accion confirmada no implementada.");
}

async function isRecommendationStillValid(state: RecommendationState) {
  if (!state.signalFingerprint) return true;
  const signals = await getBusinessSignals({ status: "active", limit: 300 });
  return signals.signals.some((signal) => signal.fingerprint === state.signalFingerprint && signal.status === "active");
}

async function getRecommendationStateByFingerprint(fingerprint: string) {
  try {
    return await prisma.businessRecommendation.findUnique({ where: { fingerprint } }) as RecommendationState | null;
  } catch (error) {
    if (isRecommendationTableMissing(error)) return null;
    throw error;
  }
}

async function logRecommendationEvent({
  recommendationId,
  actionId,
  status,
  idempotencyKey,
  entityType,
  entityId,
  userIntent,
  payload,
  result,
  error,
  metadata
}: {
  recommendationId?: string | null;
  actionId: string;
  status: "pending" | "success" | "failed" | "skipped";
  idempotencyKey?: string;
  entityType?: string | null;
  entityId?: string | null;
  userIntent?: string;
  payload?: Prisma.InputJsonObject;
  result?: Prisma.InputJsonObject;
  error?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  if (idempotencyKey) {
    await prisma.recommendationActionLog.upsert({
      where: { idempotencyKey },
      create: { recommendationId, actionId, status, idempotencyKey, entityType, entityId, userIntent, payload, result, error, metadata },
      update: { status, entityType, entityId, userIntent, payload, result, error, metadata }
    });
    return;
  }
  await prisma.recommendationActionLog.create({ data: { recommendationId, actionId, status, entityType, entityId, userIntent, payload, result, error, metadata } });
}

async function loadRecommendationPreferences() {
  try {
    return await prisma.recommendationPreference.findMany({ where: { userKey: "default" } });
  } catch (error) {
    if (isRecommendationTableMissing(error)) return [];
    throw error;
  }
}

function idsFromSignal(signal: BusinessSignal) {
  const entityType = signal.entity?.type ?? null;
  const entityId = signal.entity?.id ?? null;
  return {
    clientId: signal.client?.id ?? (entityType === "cliente" ? entityId : null),
    workId: signal.work?.id ?? (entityType === "obra" ? entityId : null),
    invoiceId: entityType === "factura" ? entityId : null,
    budgetId: entityType === "presupuesto" ? entityId : null
  };
}

function recommendationPriority(signal: BusinessSignal, requiresConfirmation: boolean) {
  const severity = signalLevelRank(signal.level) * 6;
  const amount = signal.relatedAmount ? Math.min(12, Math.round(Math.log10(Math.max(10, signal.relatedAmount)) * 3)) : 0;
  const actionability = requiresConfirmation ? 5 : 3;
  return Math.max(1, Math.min(100, Math.round(signal.score + severity + amount + actionability)));
}

function detailedExplanationForSignal(signal: BusinessSignal, preferredAction: RecommendationAction | null) {
  const parts = [
    signal.explanation.why,
    `Regla: ${signal.explanation.rule}.`,
    `Prioridad ${signal.prioridad}/100 y nivel ${formatSignalLevel(signal.level)}.`,
    signal.relatedAmount ? `Impacto economico relacionado: ${formatCurrency(signal.relatedAmount)}.` : null,
    signal.fecha ? `Fecha relevante: ${formatDate(signal.fecha)}.` : null,
    preferredAction ? `Accion sugerida: ${preferredAction.label}. ${preferredAction.expectedOutcome}` : null,
    `Si no haces nada: ${signal.explanation.consequence}`
  ];
  return parts.filter(Boolean).join(" ");
}

function dedupeRecommendationDrafts(drafts: RecommendationDraft[]) {
  const byFingerprint = new Map<string, RecommendationDraft>();
  for (const draft of drafts) {
    const previous = byFingerprint.get(draft.fingerprint);
    if (!previous || compareRecommendations(draft, previous) < 0) byFingerprint.set(draft.fingerprint, draft);
  }
  return [...byFingerprint.values()].sort(compareRecommendations);
}

function compareRecommendations(a: Pick<BusinessRecommendation, "priority" | "score" | "amount" | "dueAt" | "recommendedAt">, b: Pick<BusinessRecommendation, "priority" | "score" | "amount" | "dueAt" | "recommendedAt">) {
  return b.priority - a.priority
    || b.score - a.score
    || (b.amount ?? 0) - (a.amount ?? 0)
    || dateRank(a.dueAt) - dateRank(b.dueAt)
    || dateRank(a.recommendedAt) - dateRank(b.recommendedAt);
}

function groupTitle(recommendation: BusinessRecommendation, count: number) {
  if (count === 1) return recommendation.title;
  const labels: Record<string, string> = {
    invoice_collection: "Cobros prioritarios",
    invoice_review: "Facturas a revisar",
    budget_followup: "Seguimiento de presupuestos",
    work_cost_review: "Costes y margen de obras",
    work_operational_review: "Obras con atencion operativa",
    client_data_completion: "Datos de cliente pendientes",
    treasury_review: "Tesoreria",
    agenda_followup: "Agenda y visitas",
    reminder_followup: "Recordatorios",
    document_review: "Documentacion",
    expense_review: "Gastos y materiales"
  };
  return labels[recommendation.type] ?? "Recomendaciones operativas";
}

export function recommendationStatusLabel(status: BusinessRecommendationStatus | "mixed") {
  const labels: Record<BusinessRecommendationStatus | "mixed", string> = {
    active: "Activa",
    viewed: "Vista",
    accepted: "Aceptada",
    in_progress: "En curso",
    completed: "Completada",
    snoozed: "Pospuesta",
    dismissed: "Descartada",
    obsolete: "Obsoleta",
    failed: "Fallida",
    mixed: "Mixto"
  };
  return labels[status];
}

function actionsFromJson(value: Prisma.JsonValue | null, context: RecommendationActionContext): RecommendationAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string") return null;
      return resolveRecommendationAction(item.id, context);
    })
    .filter((action): action is RecommendationAction => Boolean(action));
}

function evidenceFromJson(value: Prisma.JsonValue | null): RecommendationEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { dataUsed: [], scoreBreakdown: [] };
  const item = value as Record<string, unknown>;
  return {
    signalTitle: typeof item.signalTitle === "string" ? item.signalTitle : undefined,
    signalSummary: typeof item.signalSummary === "string" ? item.signalSummary : undefined,
    signalWhy: typeof item.signalWhy === "string" ? item.signalWhy : undefined,
    signalRule: typeof item.signalRule === "string" ? item.signalRule : undefined,
    dataUsed: Array.isArray(item.dataUsed) ? item.dataUsed.filter((entry): entry is string => typeof entry === "string") : [],
    scoreBreakdown: Array.isArray(item.scoreBreakdown)
      ? item.scoreBreakdown.map((part) => {
        if (!part || typeof part !== "object") return null;
        const entry = part as Record<string, unknown>;
        return typeof entry.label === "string" && typeof entry.value === "number" && typeof entry.detail === "string" ? { label: entry.label, value: entry.value, detail: entry.detail } : null;
      }).filter((part): part is { label: string; value: number; detail: string } => Boolean(part))
      : [],
    consequence: typeof item.consequence === "string" ? item.consequence : undefined
  };
}

function contextFromJson(value: Prisma.JsonValue | null): RecommendationContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const item = value as Record<string, unknown>;
  const entity = item.entity && typeof item.entity === "object" && !Array.isArray(item.entity)
    ? item.entity as Record<string, unknown>
    : null;
  return {
    signalId: typeof item.signalId === "string" ? item.signalId : undefined,
    signalFingerprint: typeof item.signalFingerprint === "string" ? item.signalFingerprint : undefined,
    signalType: typeof item.signalType === "string" ? item.signalType : undefined,
    signalStatus: typeof item.signalStatus === "string" ? item.signalStatus : undefined,
    sourceModule: typeof item.sourceModule === "string" ? item.sourceModule : undefined,
    preferredActionId: typeof item.preferredActionId === "string" ? item.preferredActionId : null,
    generatedFrom: item.generatedFrom === "signal" ? "signal" : undefined,
    entity: entity && typeof entity.type === "string" && typeof entity.id === "string" && typeof entity.label === "string" && typeof entity.href === "string"
      ? { type: entity.type, id: entity.id, label: entity.label, href: entity.href }
      : null
  };
}

function outcomeFromJson(value: Prisma.JsonValue | null): RecommendationOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  return typeof item.status === "string" && typeof item.message === "string"
    ? {
      status: item.status,
      message: item.message,
      entityType: typeof item.entityType === "string" ? item.entityType : undefined,
      entityId: typeof item.entityId === "string" ? item.entityId : undefined,
      href: typeof item.href === "string" ? item.href : undefined,
      at: typeof item.at === "string" ? item.at : undefined
    }
    : null;
}

function entityHrefFromState(state: RecommendationState) {
  if (state.invoiceId) return `/dinero/${state.invoiceId}`;
  if (state.budgetId) return `/presupuestos/${state.budgetId}`;
  if (state.workId) return `/obras/${state.workId}`;
  if (state.clientId) return `/clientes/${state.clientId}`;
  if (state.source === "tesoreria") return "/tesoreria";
  return null;
}

function normalizeEntityType(value: string | null): RecommendationEntityType | "business" {
  if (value === "client" || value === "work" || value === "invoice" || value === "budget" || value === "treasury" || value === "agenda" || value === "reminder" || value === "document" || value === "expense") return value;
  return "business";
}

function readResultEntityId(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entityId = (value as Record<string, unknown>).entityId;
  return typeof entityId === "string" ? entityId : undefined;
}

function isRecommendationTableMissing(error: unknown) {
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "P2021" || /BusinessRecommendation|RecommendationActionLog|RecommendationPreference|table .*Recommendation/i.test(maybe.message ?? "");
}

function dateRank(value: Date | null | undefined) {
  return value ? value.getTime() : Number.MAX_SAFE_INTEGER;
}

function stableSignalSuffix(fingerprint: string) {
  return fingerprint.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function sanitizeError(error: unknown) {
  if (!(error instanceof Error)) return "Error no identificado.";
  return error.message.replace(/DATABASE_URL|OPENAI_API_KEY|TOKEN|PASSWORD|SECRET/gi, "[redacted]");
}
