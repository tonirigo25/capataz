import type { Prisma, PrismaClient } from "@prisma/client";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

export type BreachRisk = "UNLIKELY" | "RISK" | "HIGH_RISK";

export async function registerDataBreach(prisma: PrismaClient, input: { companyId: string; title: string; severity: "SEV1" | "SEV2" | "SEV3" | "SEV4"; detectedAt: Date; discoveredAt?: Date; categories: string[]; subjectCategories: string[]; estimatedSubjects: number; initialMeasures: string[]; actor: string }) {
  const discoveredAt = input.discoveredAt ?? input.detectedAt;
  const authorityDecisionDueAt = new Date(discoveredAt.getTime() + 72 * 60 * 60 * 1_000);
  const assessment = { schemaVersion: 1, risk: "PENDING", discoveredAt: discoveredAt.toISOString(), authorityDecisionDueAt: authorityDecisionDueAt.toISOString(), categories: input.categories, subjectCategories: input.subjectCategories, estimatedSubjects: input.estimatedSubjects, measures: input.initialMeasures, notifyAuthority: null, notifySubjects: null, decisionReason: null };
  return prisma.$transaction(async (transaction) => {
    const breach = await transaction.dataBreachIncident.create({ data: { companyId: input.companyId, title: input.title, severity: input.severity, detectedAt: input.detectedAt, assessment } });
    const incident = await transaction.incident.create({ data: { companyId: input.companyId, incidentKey: `breach:${breach.id}`, severity: input.severity, title: input.title, summary: "Personal data breach under assessment", startedAt: input.detectedAt, detectedAt: discoveredAt } });
    await transaction.incidentTimelineEvent.create({ data: { companyId: input.companyId, incidentId: incident.id, eventType: "DETECTED", actor: input.actor, summary: "Breach registered and 72-hour assessment clock started", evidence: { dataBreachIncidentId: breach.id, authorityDecisionDueAt: authorityDecisionDueAt.toISOString() }, occurredAt: discoveredAt } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.breach_registered", targetType: "DataBreachIncident", targetId: breach.id, metadata: { incidentId: incident.id, severity: input.severity, authorityDecisionDueAt: authorityDecisionDueAt.toISOString() }, actorType: "user" });
    return { breach, incident, authorityDecisionDueAt };
  });
}

export async function decideBreachNotification(prisma: PrismaClient, input: { companyId: string; breachId: string; risk: BreachRisk; reason: string; actor: string; now?: Date }) {
  if (!input.reason.trim()) throw new Error("BREACH_DECISION_REASON_REQUIRED");
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const breach = await transaction.dataBreachIncident.findFirstOrThrow({ where: { id: input.breachId, companyId: input.companyId } });
    const current = breach.assessment as Record<string, unknown>;
    const assessment: Prisma.InputJsonValue = { ...current, risk: input.risk, notifyAuthority: input.risk !== "UNLIKELY", notifySubjects: input.risk === "HIGH_RISK", decisionReason: input.reason, decisionAt: now.toISOString(), decisionBy: input.actor } as Prisma.InputJsonObject;
    const updated = await transaction.dataBreachIncident.update({ where: { id: breach.id }, data: { assessment } });
    const incident = await transaction.incident.findUniqueOrThrow({ where: { incidentKey: `breach:${breach.id}` } });
    await transaction.incidentTimelineEvent.create({ data: { companyId: input.companyId, incidentId: incident.id, eventType: "NOTIFICATION_DECIDED", actor: input.actor, summary: `${input.risk}: ${input.reason}`, occurredAt: now } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.breach_notification_decided", targetType: "DataBreachIncident", targetId: breach.id, reason: input.reason, metadata: { risk: input.risk, notifyAuthority: input.risk !== "UNLIKELY", notifySubjects: input.risk === "HIGH_RISK" }, actorType: "user" });
    return updated;
  });
}

export async function recordBreachNotification(prisma: PrismaClient, input: { companyId: string; breachId: string; audience: "AUTHORITY" | "SUBJECTS"; communicationRef: string; actor: string; now?: Date }) {
  if (!input.communicationRef.trim()) throw new Error("BREACH_NOTIFICATION_REFERENCE_REQUIRED");
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const breach = await transaction.dataBreachIncident.findFirstOrThrow({ where: { id: input.breachId, companyId: input.companyId } });
    const field = input.audience === "AUTHORITY" ? { authorityNotifiedAt: now } : { subjectsNotifiedAt: now };
    const updated = await transaction.dataBreachIncident.update({ where: { id: breach.id }, data: field });
    const incident = await transaction.incident.findUniqueOrThrow({ where: { incidentKey: `breach:${breach.id}` } });
    await transaction.incidentTimelineEvent.create({ data: { companyId: input.companyId, incidentId: incident.id, eventType: `${input.audience}_NOTIFIED`, actor: input.actor, summary: `Communication recorded as ${input.communicationRef}`, occurredAt: now } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, action: "privacy.breach_notification_recorded", targetType: "DataBreachIncident", targetId: breach.id, metadata: { audience: input.audience, communicationRef: input.communicationRef }, actorType: "user" });
    return updated;
  });
}
