import type { BusinessRecommendationStatus, BusinessSignalStatus, Prisma } from "@prisma/client";
import { getBusinessRecommendations } from "@/lib/business-recommendations";
import { getBusinessSignals } from "@/lib/business-signals";
import { formatCurrency } from "@/lib/format";
import { logProactiveAuditEvent, sanitizeErrorMessage } from "@/lib/proactive-audit";
import { proactiveRulePolicy } from "@/lib/proactive-rules";
import { prisma } from "@/lib/prisma";

const LOCK_KEY = "proactive-evaluation";
const LOCK_TIMEOUT_MS = 20 * 60 * 1000;
const MUTATION_MIN_INTERVAL_MS = 2 * 60 * 1000;

export type ProactiveEvaluationType = "manual" | "scheduled" | "mutation" | "maintenance" | "full";

export type ProactiveEvaluationOptions = {
  type?: ProactiveEvaluationType;
  triggeredBy?: string;
  scope?: ProactiveEvaluationScope;
  now?: Date;
};

export type ProactiveEvaluationScope = {
  companyId?: string;
  entityType?: string;
  entityId?: string | null;
  clientId?: string | null;
  workId?: string | null;
  invoiceId?: string | null;
  budgetId?: string | null;
  reason?: string;
};

export type ProactiveEvaluationResult = {
  ok: boolean;
  locked: boolean;
  runId: string | null;
  status: string;
  message: string;
  summary: ProactiveRunSummary;
};

export type ProactiveRunSummary = {
  processedSignals: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
  reactivatedSignals: number;
  expiredSignals: number;
  processedRecommendations: number;
  createdRecommendations: number;
  updatedRecommendations: number;
  resolvedRecommendations: number;
  obsoleteRecommendations: number;
  reactivatedRecommendations: number;
  durationMs: number;
  errors: number;
};

type SnapshotSignal = {
  fingerprint: string;
  status: BusinessSignalStatus;
  lastPriority: number;
  changeHash: string | null;
  ruleId: string | null;
  type: string;
};

type SnapshotRecommendation = {
  fingerprint: string;
  status: BusinessRecommendationStatus;
  priority: number;
  changeHash: string | null;
  ruleId: string | null;
  type: string;
};

export async function runProactiveEvaluation(options: ProactiveEvaluationOptions = {}): Promise<ProactiveEvaluationResult> {
  const startedAt = options.now ?? new Date();
  const type = options.type ?? "full";
  const triggeredBy = options.triggeredBy ?? "manual";
  const staleBefore = new Date(startedAt.getTime() - LOCK_TIMEOUT_MS);

  await recoverStaleLocks(staleBefore, startedAt);

  const run = await createEvaluationRun({ type, triggeredBy, startedAt, scope: options.scope });
  if (!run) {
    const running = await prisma.proactiveEvaluationRun.findFirst({
      where: { lockKey: LOCK_KEY, status: "running" },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, triggeredBy: true }
    });
    return {
      ok: false,
      locked: true,
      runId: running?.id ?? null,
      status: "skipped",
      message: "Ya hay una reevaluación proactiva en curso.",
      summary: emptySummary()
    };
  }

  try {
    const before = await snapshotProactiveState();
    const signals = await getBusinessSignals({ status: "all", limit: 600, now: startedAt });
    const recommendations = await getBusinessRecommendations({ status: "all", limit: 600, now: startedAt });
    await recordRuleExecutions(run.id, signals.signals, recommendations.recommendations, startedAt);
    const after = await snapshotProactiveState();
    const summary = diffSnapshots(before, after, Date.now() - startedAt.getTime());

    await prisma.proactiveEvaluationRun.update({
      where: { id: run.id },
      data: {
        status: summary.errors ? "partial" : "completed",
        completedAt: new Date(),
        processedSignals: summary.processedSignals,
        createdSignals: summary.createdSignals,
        updatedSignals: summary.updatedSignals,
        resolvedSignals: summary.resolvedSignals,
        reactivatedSignals: summary.reactivatedSignals,
        expiredSignals: summary.expiredSignals,
        processedRecommendations: summary.processedRecommendations,
        createdRecommendations: summary.createdRecommendations,
        updatedRecommendations: summary.updatedRecommendations,
        resolvedRecommendations: summary.resolvedRecommendations,
        obsoleteRecommendations: summary.obsoleteRecommendations,
        reactivatedRecommendations: summary.reactivatedRecommendations,
        durationMs: summary.durationMs,
        metadata: {
          scope: options.scope as Prisma.InputJsonObject | undefined,
          generatedAt: signals.generatedAt.toISOString(),
          recommendationGeneratedAt: recommendations.generatedAt.toISOString()
        }
      }
    });

    await logProactiveAuditEvent({
      runId: run.id,
      eventType: "evaluation_completed",
      origin: triggeredBy,
      reason: "Reevaluación proactiva completada.",
      values: summary
    });

    return {
      ok: true,
      locked: false,
      runId: run.id,
      status: summary.errors ? "partial" : "completed",
      message: "Reevaluación proactiva completada.",
      summary
    };
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await prisma.proactiveEvaluationRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorSummary: message,
        durationMs: Date.now() - startedAt.getTime()
      }
    });
    await logProactiveAuditEvent({
      runId: run.id,
      eventType: "evaluation_failed",
      origin: triggeredBy,
      reason: "Falló la reevaluación proactiva.",
      error: message
    });
    throw error;
  }
}

export async function reevaluateProactiveAfterMutation(scope: ProactiveEvaluationScope) {
  // The proactive engine still has global fingerprints and unscoped persistence.
  // Core ERP mutations must not invoke it until that subsystem is tenant-safe.
  if (scope.companyId) return null;
  try {
    const since = new Date(Date.now() - MUTATION_MIN_INTERVAL_MS);
    const recent = await prisma.proactiveEvaluationRun.findFirst({
      where: {
        type: "mutation",
        status: { in: ["running", "completed", "partial"] },
        startedAt: { gte: since }
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true }
    });
    if (recent) {
      await logProactiveAuditEvent({
        eventType: "evaluation_skipped",
        origin: "mutation",
        entityType: scope.entityType,
        entityId: scope.entityId,
        reason: "Reevaluación de mutación omitida por cooldown interno.",
        values: { recentRunId: recent.id, recentStatus: recent.status, scope }
      });
      return null;
    }
    return await runProactiveEvaluation({ type: "mutation", triggeredBy: "mutation", scope });
  } catch (error) {
    await logProactiveAuditEvent({
      eventType: "evaluation_failed",
      origin: "mutation",
      entityType: scope.entityType,
      entityId: scope.entityId,
      reason: "Falló la reevaluación tras mutación; la mutación principal ya estaba confirmada.",
      error
    });
    return null;
  }
}

export async function getProactiveControlData(now = new Date()) {
  try {
    const [runs, signals, recommendations, auditEvents, actionLogs, settings] = await Promise.all([
      prisma.proactiveEvaluationRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
      prisma.businessSignalState.findMany({
        select: { type: true, status: true, level: true, ruleId: true, lastPriority: true, createdAt: true, updatedAt: true, resolvedAt: true, reactivatedAt: true }
      }),
      prisma.businessRecommendation.findMany({
        select: { type: true, status: true, level: true, ruleId: true, priority: true, recommendedAt: true, updatedAt: true, completedAt: true, dismissedAt: true, reactivatedAt: true, acceptedAt: true, actionStartedAt: true }
      }),
      prisma.proactiveAuditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.recommendationActionLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      ensureDefaultProactiveSettings()
    ]);

    const metrics = buildControlMetrics(signals, recommendations, runs, actionLogs);
    return {
      now,
      settings,
      runs,
      latestRun: runs[0] ?? null,
      auditEvents,
      metrics,
      noisyRules: detectNoisyRules(recommendations),
      dailySummary: await getProactiveDailySummary(now),
      weeklySummary: await getProactiveWeeklySummary(now)
    };
  } catch (error) {
    if (isProactiveTableMissing(error)) {
      return {
        now,
        settings: null,
        runs: [],
        latestRun: null,
        auditEvents: [],
        metrics: emptyControlMetrics(),
        noisyRules: [],
        dailySummary: { title: "No hay recomendaciones prioritarias.", lines: [] },
        weeklySummary: { title: "El sistema proactivo todavía no se ha evaluado.", lines: [] }
      };
    }
    throw error;
  }
}

export async function getProactiveDailySummary(now = new Date()) {
  const result = await getBusinessRecommendations({ status: "active", limit: 30, now, respectCooldown: true });
  const counts = countBy(result.recommendations, (item) => item.type);
  const lines = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type, count]) => `${count} ${labelForRecommendationType(type, count)}`);
  return {
    title: lines.length ? "Hoy Capataz recomienda revisar:" : "No hay recomendaciones prioritarias.",
    lines
  };
}

export async function getProactiveWeeklySummary(now = new Date()) {
  const weekStart = startOfWeek(now);
  const [newSignals, completedRecommendations, resolvedSignals, openCritical] = await Promise.all([
    prisma.businessSignalState.count({ where: { firstDetectedAt: { gte: weekStart } } }),
    prisma.businessRecommendation.count({ where: { completedAt: { gte: weekStart } } }),
    prisma.businessSignalState.count({ where: { resolvedAt: { gte: weekStart } } }),
    prisma.businessSignalState.count({ where: { status: "active", level: "critico" } })
  ]);
  const lines = [
    `${newSignals} señales nuevas`,
    `${completedRecommendations} recomendaciones completadas`,
    `${resolvedSignals} problemas resueltos`,
    `${openCritical} alertas críticas abiertas`
  ];
  return { title: "Resumen semanal interno", lines };
}

export async function getProactiveAuditEventsForRecommendations(fingerprints: string[]) {
  if (!fingerprints.length) return {} as Record<string, Array<{ eventType: string; previousStatus: string | null; nextStatus: string | null; reason: string | null; createdAt: Date }>>;
  try {
    const events = await prisma.proactiveAuditEvent.findMany({
      where: { recommendationFingerprint: { in: [...new Set(fingerprints)] } },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        recommendationFingerprint: true,
        eventType: true,
        previousStatus: true,
        nextStatus: true,
        reason: true,
        createdAt: true
      }
    });
    const grouped: Record<string, Array<{ eventType: string; previousStatus: string | null; nextStatus: string | null; reason: string | null; createdAt: Date }>> = {};
    for (const event of events) {
      if (!event.recommendationFingerprint) continue;
      grouped[event.recommendationFingerprint] ??= [];
      if (grouped[event.recommendationFingerprint].length < 8) {
        grouped[event.recommendationFingerprint].push({
          eventType: event.eventType,
          previousStatus: event.previousStatus,
          nextStatus: event.nextStatus,
          reason: event.reason,
          createdAt: event.createdAt
        });
      }
    }
    return grouped;
  } catch (error) {
    if (isProactiveTableMissing(error)) return {};
    throw error;
  }
}

async function recoverStaleLocks(staleBefore: Date, now: Date) {
  try {
    const result = await prisma.proactiveEvaluationRun.updateMany({
      where: { lockKey: LOCK_KEY, status: "running", startedAt: { lt: staleBefore } },
      data: {
        status: "failed",
        failedAt: now,
        errorSummary: "Lock huérfano recuperado por timeout."
      }
    });
    if (result.count) {
      await logProactiveAuditEvent({
        eventType: "evaluation_lock_recovered",
        origin: "system",
        reason: "Se liberó un lock huérfano por timeout.",
        values: { recovered: result.count }
      });
    }
  } catch (error) {
    if (!isProactiveTableMissing(error)) throw error;
  }
}

async function createEvaluationRun({
  type,
  triggeredBy,
  startedAt,
  scope
}: {
  type: string;
  triggeredBy: string;
  startedAt: Date;
  scope?: ProactiveEvaluationScope;
}) {
  try {
    return await prisma.proactiveEvaluationRun.create({
      data: {
        type,
        status: "running",
        lockKey: LOCK_KEY,
        startedAt,
        triggeredBy,
        metadata: scope ? { scope: scope as Prisma.InputJsonObject } : undefined
      }
    });
  } catch (error) {
    if (isUniqueLockError(error)) return null;
    throw error;
  }
}

async function snapshotProactiveState() {
  const [signals, recommendations] = await Promise.all([
    prisma.businessSignalState.findMany({ select: { fingerprint: true, status: true, lastPriority: true, changeHash: true, ruleId: true, type: true } }),
    prisma.businessRecommendation.findMany({ select: { fingerprint: true, status: true, priority: true, changeHash: true, ruleId: true, type: true } })
  ]);
  return {
    signals: new Map(signals.map((item) => [item.fingerprint, item as SnapshotSignal])),
    recommendations: new Map(recommendations.map((item) => [item.fingerprint, item as SnapshotRecommendation]))
  };
}

function diffSnapshots(
  before: Awaited<ReturnType<typeof snapshotProactiveState>>,
  after: Awaited<ReturnType<typeof snapshotProactiveState>>,
  durationMs: number
): ProactiveRunSummary {
  const signalDiff = diffEntitySnapshots(before.signals, after.signals);
  const recommendationDiff = diffEntitySnapshots(before.recommendations, after.recommendations);
  return {
    processedSignals: after.signals.size,
    createdSignals: signalDiff.created,
    updatedSignals: signalDiff.updated,
    resolvedSignals: signalDiff.toStatus("resolved"),
    reactivatedSignals: signalDiff.toStatus("active", ["snoozed", "dismissed", "resolved", "expired"]),
    expiredSignals: signalDiff.toStatus("expired"),
    processedRecommendations: after.recommendations.size,
    createdRecommendations: recommendationDiff.created,
    updatedRecommendations: recommendationDiff.updated,
    resolvedRecommendations: recommendationDiff.toStatus("completed"),
    obsoleteRecommendations: recommendationDiff.toStatus("obsolete"),
    reactivatedRecommendations: recommendationDiff.toStatus("active", ["snoozed", "dismissed", "obsolete", "failed", "completed"]),
    durationMs,
    errors: 0
  };
}

function diffEntitySnapshots<T extends { fingerprint: string; status: string; changeHash: string | null }>(before: Map<string, T>, after: Map<string, T>) {
  const transitions: Array<{ previous?: string; next: string }> = [];
  let created = 0;
  let updated = 0;
  for (const item of after.values()) {
    const previous = before.get(item.fingerprint);
    if (!previous) {
      created += 1;
      transitions.push({ next: item.status });
      continue;
    }
    if (previous.status !== item.status || previous.changeHash !== item.changeHash) {
      updated += 1;
      transitions.push({ previous: previous.status, next: item.status });
    }
  }
  return {
    created,
    updated,
    toStatus(status: string, from?: string[]) {
      return transitions.filter((transition) => transition.next === status && (!from || (transition.previous && from.includes(transition.previous)))).length;
    }
  };
}

async function recordRuleExecutions(runId: string, signals: Array<{ ruleId: string; type: string; status: string }>, recommendations: Array<{ ruleId: string | null; type: string; status: string }>, startedAt: Date) {
  const byRule = new Map<string, { processed: number; active: number; resolved: number }>();
  for (const item of [...signals, ...recommendations]) {
    const key = item.ruleId ?? item.type;
    const entry = byRule.get(key) ?? { processed: 0, active: 0, resolved: 0 };
    entry.processed += 1;
    if (item.status === "active" || item.status === "viewed") entry.active += 1;
    if (item.status === "resolved" || item.status === "completed" || item.status === "obsolete") entry.resolved += 1;
    byRule.set(key, entry);
  }
  await prisma.proactiveRuleExecution.createMany({
    data: [...byRule.entries()].map(([ruleId, stats]) => ({
      runId,
      ruleId,
      status: "completed",
      processed: stats.processed,
      updated: stats.active,
      resolved: stats.resolved,
      startedAt,
      completedAt: new Date(),
      metadata: { policy: proactiveRulePolicy(ruleId).description }
    }))
  });
}

async function ensureDefaultProactiveSettings() {
  return prisma.proactiveSystemPreference.upsert({
    where: { userKey: "default" },
    update: {},
    create: {
      userKey: "default",
      evaluationFrequencyMinutes: 360,
      urgentEvaluationFrequencyMinutes: 60,
      maintenanceFrequencyMinutes: 1440,
      todayRecommendationLimit: 4,
      minimumPriority: 1,
      quietHoursStart: "20:00",
      quietHoursEnd: "08:00",
      cooldownDays: { invoice_overdue: 3, work_no_activity: 7, client_data_incomplete: 14, treasury_negative_cash: 1 },
      showLevels: ["info", "atencion", "importante", "critico"],
      groupingMode: "type"
    }
  });
}

function buildControlMetrics(
  signals: Array<{ type: string; status: BusinessSignalStatus; level: string; ruleId: string | null; lastPriority: number }>,
  recommendations: Array<{ type: string; status: BusinessRecommendationStatus; level: string; ruleId: string | null; priority: number; recommendedAt: Date; acceptedAt: Date | null; completedAt: Date | null; dismissedAt: Date | null; actionStartedAt: Date | null }>,
  runs: Array<{ status: string; durationMs: number | null }>,
  actionLogs: Array<{ status: string }>
) {
  const totalRecommendations = recommendations.length;
  const accepted = recommendations.filter((item) => ["accepted", "in_progress", "completed"].includes(item.status)).length;
  const completed = recommendations.filter((item) => item.status === "completed").length;
  const completionTimes = recommendations
    .filter((item) => item.completedAt)
    .map((item) => (item.completedAt?.getTime() ?? 0) - item.recommendedAt.getTime())
    .filter((value) => value > 0);
  return {
    signalsActive: signals.filter((item) => item.status === "active").length,
    recommendationsActive: recommendations.filter((item) => ["active", "viewed", "accepted", "in_progress", "failed"].includes(item.status)).length,
    criticalSignals: signals.filter((item) => item.status === "active" && item.level === "critico").length,
    importantRecommendations: recommendations.filter((item) => ["critico", "importante"].includes(item.level)).length,
    accepted,
    completed,
    snoozed: recommendations.filter((item) => item.status === "snoozed").length,
    dismissed: recommendations.filter((item) => item.status === "dismissed").length,
    obsolete: recommendations.filter((item) => item.status === "obsolete").length,
    failedRuns: runs.filter((item) => item.status === "failed").length,
    failedActions: actionLogs.filter((item) => item.status === "failed").length,
    averageTimeToActionHours: completionTimes.length ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) / 36_000) / 100 : 0,
    acceptanceRate: totalRecommendations ? Math.round((accepted / totalRecommendations) * 100) : 0,
    completionRate: totalRecommendations ? Math.round((completed / totalRecommendations) * 100) : 0,
    frequentTypes: topCounts(recommendations, (item) => item.type),
    mostDismissedTypes: topCounts(recommendations.filter((item) => item.status === "dismissed"), (item) => item.type)
  };
}

function emptyControlMetrics() {
  return {
    signalsActive: 0,
    recommendationsActive: 0,
    criticalSignals: 0,
    importantRecommendations: 0,
    accepted: 0,
    completed: 0,
    snoozed: 0,
    dismissed: 0,
    obsolete: 0,
    failedRuns: 0,
    failedActions: 0,
    averageTimeToActionHours: 0,
    acceptanceRate: 0,
    completionRate: 0,
    frequentTypes: [],
    mostDismissedTypes: []
  };
}

function detectNoisyRules(recommendations: Array<{ ruleId: string | null; type: string; status: BusinessRecommendationStatus }>) {
  const byRule = new Map<string, { total: number; dismissed: number; active: number }>();
  for (const item of recommendations) {
    const key = item.ruleId ?? item.type;
    const entry = byRule.get(key) ?? { total: 0, dismissed: 0, active: 0 };
    entry.total += 1;
    if (item.status === "dismissed") entry.dismissed += 1;
    if (["active", "viewed", "accepted", "in_progress", "failed"].includes(item.status)) entry.active += 1;
    byRule.set(key, entry);
  }
  return [...byRule.entries()]
    .map(([ruleId, stats]) => ({
      ruleId,
      ...stats,
      dismissRate: stats.total ? Math.round((stats.dismissed / stats.total) * 100) : 0,
      warning: stats.total >= 3 && stats.dismissed / stats.total >= 0.5
        ? "Esta regla genera muchas recomendaciones descartadas."
        : stats.active >= 8
          ? "Esta regla concentra muchas recomendaciones activas."
          : ""
    }))
    .filter((item) => item.warning)
    .sort((a, b) => b.dismissRate - a.dismissRate || b.active - a.active)
    .slice(0, 8);
}

function emptySummary(): ProactiveRunSummary {
  return {
    processedSignals: 0,
    createdSignals: 0,
    updatedSignals: 0,
    resolvedSignals: 0,
    reactivatedSignals: 0,
    expiredSignals: 0,
    processedRecommendations: 0,
    createdRecommendations: 0,
    updatedRecommendations: 0,
    resolvedRecommendations: 0,
    obsoleteRecommendations: 0,
    reactivatedRecommendations: 0,
    durationMs: 0,
    errors: 0
  };
}

function topCounts<T>(items: T[], getKey: (item: T) => string) {
  return [...countBy(items, getKey).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function labelForRecommendationType(type: string, count: number) {
  const plural = count === 1 ? 0 : 1;
  const labels: Record<string, [string, string]> = {
    invoice_collection: ["factura vencida", "facturas vencidas"],
    invoice_review: ["factura a revisar", "facturas a revisar"],
    budget_followup: ["presupuesto pendiente", "presupuestos pendientes"],
    work_cost_review: ["obra con margen a revisar", "obras con margen a revisar"],
    work_operational_review: ["obra con atención operativa", "obras con atención operativa"],
    client_data_completion: ["cliente con datos pendientes", "clientes con datos pendientes"],
    treasury_review: ["riesgo de tesorería", "riesgos de tesorería"],
    agenda_followup: ["seguimiento de agenda", "seguimientos de agenda"],
    reminder_followup: ["recordatorio pendiente", "recordatorios pendientes"],
    document_review: ["documento pendiente", "documentos pendientes"],
    expense_review: ["gasto a revisar", "gastos a revisar"]
  };
  return labels[type]?.[plural] ?? (count === 1 ? "recomendación" : "recomendaciones");
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
}

function isUniqueLockError(error: unknown) {
  const maybe = error as { code?: string; meta?: { target?: string[] | string } };
  return maybe.code === "P2002";
}

function isProactiveTableMissing(error: unknown) {
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "P2021" || /Proactive(EvaluationRun|AuditEvent|RuleExecution|SystemPreference)|column .*changeHash|column .*cooldownUntil/i.test(maybe.message ?? "");
}

export function formatProactiveSummaryLine(summary: ProactiveRunSummary) {
  return `${summary.processedSignals} señales, ${summary.processedRecommendations} recomendaciones, ${summary.reactivatedSignals + summary.reactivatedRecommendations} reactivadas, ${summary.resolvedSignals + summary.obsoleteRecommendations} resueltas u obsoletas en ${summary.durationMs} ms.`;
}

export function formatRecommendationAmount(value: number | null | undefined) {
  return value ? formatCurrency(value) : "Sin importe";
}
