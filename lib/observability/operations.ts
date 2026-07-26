import { Prisma, type PrismaClient } from "@prisma/client";
import { sha256, stableJson } from "@/lib/security/audit-chain";

export const operationalMetricCatalog = {
  "http.errors.rate": { unit: "ratio", warning: 0.01, critical: 0.02, direction: "above" },
  "http.latency.p95": { unit: "ms", warning: 1_000, critical: 2_000, direction: "above" },
  "jobs.success.rate": { unit: "ratio", warning: 0.99, critical: 0.95, direction: "below" },
  "queue.depth": { unit: "count", warning: 50, critical: 100, direction: "above" },
  "database.latency.p95": { unit: "ms", warning: 250, critical: 500, direction: "above" },
  "provider.errors.rate": { unit: "ratio", warning: 0.01, critical: 0.03, direction: "above" },
  "dead_letters.count": { unit: "count", warning: 1, critical: 10, direction: "above" },
} as const;

export const severityPolicy = {
  SEV1: { acknowledgeMinutes: 10, updateMinutes: 30, targetRestoreMinutes: 60, audience: ["incident-commander", "security", "leadership", "affected-customers"] },
  SEV2: { acknowledgeMinutes: 20, updateMinutes: 60, targetRestoreMinutes: 240, audience: ["incident-commander", "engineering", "affected-customers"] },
  SEV3: { acknowledgeMinutes: 60, updateMinutes: 240, targetRestoreMinutes: 1_440, audience: ["engineering", "support"] },
  SEV4: { acknowledgeMinutes: 240, updateMinutes: 1_440, targetRestoreMinutes: 4_320, audience: ["owner"] },
} as const;

export async function recordOperationalMetric(prisma: PrismaClient, input: { companyId?: string; metricKey: keyof typeof operationalMetricCatalog; value: number; dimensions?: Record<string, string | number | boolean>; measuredAt?: Date }) {
  if (!Number.isFinite(input.value)) throw new Error("OPERATIONAL_METRIC_VALUE_INVALID");
  const definition = operationalMetricCatalog[input.metricKey];
  const dimensions = input.dimensions ? sanitizeDimensions(input.dimensions) : undefined;
  return prisma.operationalMetric.create({ data: { companyId: input.companyId, metricKey: input.metricKey, value: new Prisma.Decimal(input.value), unit: definition.unit, dimensions, measuredAt: input.measuredAt } });
}

export async function evaluateOperationalAlerts(prisma: PrismaClient, input: { environment: string; since: Date; now?: Date }) {
  const now = input.now ?? new Date();
  const rows = await prisma.operationalMetric.findMany({ where: { measuredAt: { gte: input.since } }, orderBy: { measuredAt: "desc" } });
  const latest = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!latest.has(row.metricKey)) latest.set(row.metricKey, row);
  const alerts: Array<{ metricKey: string; severity: "SEV2" | "SEV3"; value: number; threshold: number }> = [];
  for (const [metricKey, definition] of Object.entries(operationalMetricCatalog)) {
    const row = latest.get(metricKey);
    if (!row) continue;
    const value = row.value.toNumber();
    const critical = definition.direction === "above" ? value >= definition.critical : value <= definition.critical;
    const warning = definition.direction === "above" ? value >= definition.warning : value <= definition.warning;
    if (!critical && !warning) continue;
    const severity = critical ? "SEV2" : "SEV3";
    const threshold = critical ? definition.critical : definition.warning;
    const incidentKey = `metric:${input.environment}:${metricKey}:${now.toISOString().slice(0, 10)}`;
    await prisma.incident.upsert({ where: { incidentKey }, update: { summary: `${metricKey}=${value} crossed ${threshold}`, severity }, create: { incidentKey, severity, title: `Operational threshold: ${metricKey}`, summary: `${metricKey}=${value} crossed ${threshold}`, startedAt: row.measuredAt, detectedAt: now } });
    alerts.push({ metricKey, severity, value, threshold });
  }
  return alerts;
}

export async function recordJobHeartbeat(prisma: PrismaClient, input: { companyId?: string; jobKey: string; environment: string; outcome: "STARTED" | "SUCCEEDED" | "FAILED"; expectedEverySeconds: number; deadLetterCount?: number; metadata?: Prisma.InputJsonValue; now?: Date }) {
  const now = input.now ?? new Date();
  const key = { environment: input.environment, jobKey: input.jobKey, companyId: input.companyId ?? null };
  const dates = input.outcome === "STARTED" ? { lastStartedAt: now } : input.outcome === "SUCCEEDED" ? { lastSucceededAt: now, status: "HEALTHY" } : { lastFailedAt: now, status: "FAILED" };
  const existing = await prisma.jobHeartbeat.findFirst({ where: key, select: { id: true } });
  return existing
    ? prisma.jobHeartbeat.update({ where: { id: existing.id }, data: { ...dates, expectedEverySeconds: input.expectedEverySeconds, deadLetterCount: input.deadLetterCount ?? 0, metadata: input.metadata } })
    : prisma.jobHeartbeat.create({ data: { ...key, ...dates, expectedEverySeconds: input.expectedEverySeconds, deadLetterCount: input.deadLetterCount ?? 0, metadata: input.metadata } });
}

export async function detectStaleHeartbeats(prisma: PrismaClient, input: { environment: string; now?: Date; toleranceFactor?: number }) {
  const now = input.now ?? new Date();
  const tolerance = input.toleranceFactor ?? 2;
  const heartbeats = await prisma.jobHeartbeat.findMany({ where: { environment: input.environment } });
  const stale = heartbeats.filter((heartbeat) => !heartbeat.lastSucceededAt || now.getTime() - heartbeat.lastSucceededAt.getTime() > heartbeat.expectedEverySeconds * tolerance * 1_000 || heartbeat.deadLetterCount > 0);
  for (const heartbeat of stale) {
    const incidentKey = `heartbeat:${input.environment}:${heartbeat.jobKey}:${heartbeat.companyId ?? "platform"}`;
    const incident = await prisma.incident.upsert({ where: { incidentKey }, update: { status: "OPEN", severity: heartbeat.deadLetterCount >= 10 ? "SEV2" : "SEV3", summary: `Heartbeat expired or dead letters present for ${heartbeat.jobKey}` }, create: { companyId: heartbeat.companyId, incidentKey, severity: heartbeat.deadLetterCount >= 10 ? "SEV2" : "SEV3", title: `Job unhealthy: ${heartbeat.jobKey}`, summary: `Heartbeat expired or dead letters present for ${heartbeat.jobKey}`, startedAt: heartbeat.lastSucceededAt ?? heartbeat.updatedAt, detectedAt: now } });
    await prisma.incidentTimelineEvent.create({ data: { companyId: heartbeat.companyId, incidentId: incident.id, eventType: "DETECTED", actor: "heartbeat-monitor", summary: `deadLetters=${heartbeat.deadLetterCount}; expectedEverySeconds=${heartbeat.expectedEverySeconds}`, occurredAt: now } });
    await prisma.jobHeartbeat.update({ where: { id: heartbeat.id }, data: { status: "STALE" } });
  }
  return stale;
}

export async function runSyntheticSmoke(prisma: PrismaClient, input: { baseUrl: string; environment: string; release?: string; fetcher?: typeof fetch; authenticatedProbe?: () => Promise<void>; now?: Date }) {
  const startedAt = input.now ?? new Date();
  const fetcher = input.fetcher ?? fetch;
  const checks = ["/", "/login", "/api/health/live", "/api/health/ready"];
  const outcomes: Array<{ path: string; status: number; ok: boolean }> = [];
  for (const path of checks) {
    const response = await fetcher(new URL(path, input.baseUrl), { method: "GET", redirect: "manual", cache: "no-store" });
    outcomes.push({ path, status: response.status, ok: response.status >= 200 && response.status < 400 });
  }
  if (input.authenticatedProbe) await input.authenticatedProbe();
  const completedAt = new Date();
  const ok = outcomes.every((outcome) => outcome.ok);
  const evidenceHash = sha256(stableJson(outcomes));
  const record = await prisma.syntheticCheckRun.create({ data: { checkKey: "public-auth-critical-readonly", environment: input.environment, release: input.release, status: ok ? "PASS" : "FAIL", durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()), assertionCount: outcomes.length + (input.authenticatedProbe ? 1 : 0), failureCode: ok ? null : "HTTP_ASSERTION_FAILED", evidenceHash, startedAt, completedAt } });
  return { record, outcomes };
}

export async function createIncident(prisma: PrismaClient, input: { companyId?: string; incidentKey: string; severity: keyof typeof severityPolicy; title: string; summary: string; actor: string; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const incident = await transaction.incident.create({ data: { companyId: input.companyId, incidentKey: input.incidentKey, severity: input.severity, title: input.title, summary: input.summary, startedAt: now, detectedAt: now } });
    await transaction.incidentTimelineEvent.create({ data: { companyId: input.companyId, incidentId: incident.id, eventType: "DETECTED", actor: input.actor, summary: input.summary, occurredAt: now } });
    return incident;
  });
}

export async function closeIncidentWithPostmortem(prisma: PrismaClient, input: { incidentId: string; rootCause: string; resolution: string; actor: string; actions: Array<{ description: string; owner: string; dueAt: Date }>; now?: Date }) {
  if (!input.rootCause.trim() || !input.resolution.trim() || !input.actions.length) throw new Error("POSTMORTEM_INCOMPLETE");
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const incident = await transaction.incident.findUniqueOrThrow({ where: { id: input.incidentId } });
    await transaction.incident.update({ where: { id: incident.id }, data: { status: "CLOSED", rootCause: input.rootCause, summary: input.resolution, mitigatedAt: incident.mitigatedAt ?? now, resolvedAt: now, postmortemUrl: `internal://incident/${incident.id}/postmortem` } });
    await transaction.incidentTimelineEvent.create({ data: { companyId: incident.companyId, incidentId: incident.id, eventType: "CLOSED", actor: input.actor, summary: input.resolution, occurredAt: now } });
    await transaction.postmortemAction.createMany({ data: input.actions.map((action) => ({ companyId: incident.companyId, incidentId: incident.id, description: action.description, owner: action.owner, dueAt: action.dueAt })) });
    return transaction.incident.findUniqueOrThrow({ where: { id: incident.id }, include: { timeline: true, actions: true } });
  });
}

function sanitizeDimensions(input: Record<string, string | number | boolean>) {
  const allowed = new Set(["route", "method", "statusClass", "jobKey", "provider", "operation", "environment", "release"]);
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) if (allowed.has(key)) result[key] = value;
  return result;
}
