import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { stableReference } from "@/lib/ai/redaction";
import { sanitizeSupportText } from "@/lib/product/support-service";

const PILOT_STATUSES = new Set(["PLANNED", "ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"]);
const PILOT_RESULT_STATUSES = new Set(["PENDING", "SUCCESS", "PARTIAL", "FAILED", "WITHDRAWN"]);
const CONTRACT_STATUSES = new Set(["NOT_RECORDED", "DRAFT", "SIGNED", "EXPIRED"]);
const CONSENT_STATUSES = new Set(["NOT_RECORDED", "REQUESTED", "GRANTED", "WITHDRAWN"]);
const FEEDBACK_CATEGORIES = new Set(["NPS", "CSAT", "PRODUCT", "ONBOARDING", "SUPPORT", "CHURN"]);
const TESTIMONIAL_SCOPES = new Set(["anonymous_quote", "named_quote", "logo", "case_study"]);
const COST_CATEGORIES = new Set(["INFRASTRUCTURE", "AI", "STORAGE", "EMAIL", "SUPPORT"]);
const COST_SOURCES = new Set(["PROVIDER_INVOICE", "MEASURED_USAGE", "TIME_LOG"]);

export async function upsertPilotCohort(prisma: PrismaClient, input: {
  companyId: string; cohortKey: string; status: string; startsAt: Date; endsAt?: Date; paid: boolean; contractStatus: string; consentStatus: string;
  goals: string[]; successCriteria: string[]; cadence: "WEEKLY" | "FORTNIGHTLY"; onboardingStartedAt?: Date; onboardingCompletedAt?: Date;
  resultStatus?: "PENDING" | "SUCCESS" | "PARTIAL" | "FAILED" | "WITHDRAWN"; outcome?: { summary: string; metrics: string[] };
  handoff?: { commercialSummary: string; supportNeeds: string; productFocus: string };
}) {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(input.cohortKey) || !PILOT_STATUSES.has(input.status) || !PILOT_RESULT_STATUSES.has(input.resultStatus ?? "PENDING") || !CONTRACT_STATUSES.has(input.contractStatus) || !CONSENT_STATUSES.has(input.consentStatus)) throw new Error("PILOT_CONFIGURATION_INVALID");
  if (input.endsAt && input.endsAt <= input.startsAt || input.onboardingStartedAt && input.onboardingCompletedAt && input.onboardingCompletedAt < input.onboardingStartedAt) throw new Error("PILOT_TIMELINE_INVALID");
  if (!input.goals.length || !input.successCriteria.length || input.goals.length > 8 || input.successCriteria.length > 8) throw new Error("PILOT_SUCCESS_CRITERIA_REQUIRED");
  const safeGoals = input.goals.map((value) => sanitizeSupportText(value, 120)).filter(Boolean);
  const safeCriteria = input.successCriteria.map((value) => sanitizeSupportText(value, 120)).filter(Boolean);
  const handoff = input.handoff ? {
    commercialSummary: sanitizeSupportText(input.handoff.commercialSummary, 240),
    supportNeeds: sanitizeSupportText(input.handoff.supportNeeds, 240),
    productFocus: sanitizeSupportText(input.handoff.productFocus, 240),
  } : undefined;
  const outcome = input.outcome ? { summary: sanitizeSupportText(input.outcome.summary, 500), metrics: input.outcome.metrics.map((value) => sanitizeSupportText(value, 120)).filter(Boolean).slice(0, 12) } : undefined;
  const data = { status: input.status, startsAt: input.startsAt, endsAt: input.endsAt, paid: input.paid, contractStatus: input.contractStatus, consentStatus: input.consentStatus, goals: safeGoals, successCriteria: safeCriteria, cadence: input.cadence, onboardingStartedAt: input.onboardingStartedAt, onboardingCompletedAt: input.onboardingCompletedAt, resultStatus: input.resultStatus ?? "PENDING", outcome, handoff };
  return prisma.pilotCohort.upsert({
    where: { companyId_cohortKey: { companyId: input.companyId, cohortKey: input.cohortKey } },
    create: { companyId: input.companyId, cohortKey: input.cohortKey, ...data },
    update: data,
  });
}

export async function recordPilotFeedback(prisma: PrismaClient, input: { companyId: string; cohortId?: string; actorId: string; category: string; score?: number; comment?: string; consentGranted: boolean; contactAllowed: boolean }) {
  if (!FEEDBACK_CATEGORIES.has(input.category) || !input.consentGranted) throw new Error("PILOT_FEEDBACK_CONSENT_REQUIRED");
  if (input.score !== undefined) {
    const valid = input.category === "NPS" ? input.score >= 0 && input.score <= 10 : input.score >= 1 && input.score <= 5;
    if (!Number.isInteger(input.score) || !valid) throw new Error("PILOT_FEEDBACK_SCORE_INVALID");
  }
  if (input.cohortId && !await prisma.pilotCohort.findFirst({ where: { id: input.cohortId, companyId: input.companyId }, select: { id: true } })) throw new Error("PILOT_COHORT_NOT_FOUND");
  const content = sanitizeSupportText(input.comment ?? "", 1000);
  return prisma.pilotFeedback.create({ data: { companyId: input.companyId, cohortId: input.cohortId, category: input.category, score: input.score, content, reporterHash: stableReference(input.actorId), consentGranted: true, contactAllowed: input.contactAllowed, source: "IN_APP", sentiment: input.score === undefined ? null : input.category === "NPS" ? input.score >= 9 ? "PROMOTER" : input.score >= 7 ? "PASSIVE" : "DETRACTOR" : input.score >= 4 ? "POSITIVE" : input.score === 3 ? "NEUTRAL" : "NEGATIVE" } });
}

export async function setTestimonialConsent(prisma: PrismaClient, input: { companyId: string; actorId: string; scopes: string[]; granted: boolean; artifactReference?: string }) {
  const subjectHash = stableReference(input.actorId);
  const existing = !input.granted && !input.scopes.length ? await prisma.testimonialConsent.findUnique({ where: { companyId_subjectHash: { companyId: input.companyId, subjectHash } } }) : null;
  const previousScopes = Array.isArray(existing?.scope) ? existing.scope.flatMap((value) => typeof value === "string" ? [value] : []) : [];
  const scopes = [...new Set(input.scopes.length ? input.scopes : previousScopes)];
  if (!scopes.length || scopes.some((scope) => !TESTIMONIAL_SCOPES.has(scope))) throw new Error("TESTIMONIAL_SCOPE_INVALID");
  const now = new Date();
  return prisma.testimonialConsent.upsert({
    where: { companyId_subjectHash: { companyId: input.companyId, subjectHash } },
    create: { companyId: input.companyId, subjectHash, scope: scopes, status: input.granted ? "GRANTED" : "WITHDRAWN", grantedAt: input.granted ? now : null, withdrawnAt: input.granted ? null : now, artifactReferenceHash: input.artifactReference ? stableReference(input.artifactReference) : null },
    update: { scope: scopes, status: input.granted ? "GRANTED" : "WITHDRAWN", grantedAt: input.granted ? now : undefined, withdrawnAt: input.granted ? null : now, artifactReferenceHash: input.artifactReference ? stableReference(input.artifactReference) : undefined },
  });
}

export async function registerVerifiedServiceCost(prisma: PrismaClient, input: { companyId: string; periodStart: Date; periodEnd: Date; category: string; amount: number; sourceType: string; sourceReference: string; verified: boolean; planKey?: string }) {
  if (!COST_CATEGORIES.has(input.category) || !COST_SOURCES.has(input.sourceType) || !Number.isFinite(input.amount) || input.amount < 0 || input.periodEnd <= input.periodStart) throw new Error("SERVICE_COST_INVALID");
  const sourceReferenceHash = createHash("sha256").update(input.sourceReference).digest("hex");
  return prisma.companyServiceCost.upsert({
    where: { companyId_category_periodStart_periodEnd_sourceReferenceHash: { companyId: input.companyId, category: input.category, periodStart: input.periodStart, periodEnd: input.periodEnd, sourceReferenceHash } },
    create: { companyId: input.companyId, periodStart: input.periodStart, periodEnd: input.periodEnd, category: input.category, amount: new Prisma.Decimal(input.amount), sourceType: input.sourceType, sourceReferenceHash, verified: input.verified, planKey: input.planKey },
    update: { amount: new Prisma.Decimal(input.amount), verified: input.verified, planKey: input.planKey },
  });
}

export async function upsertProductExperiment(prisma: PrismaClient, input: { experimentKey: string; area: "ONBOARDING" | "PRICING" | "PRODUCT"; hypothesis: string; primaryMetric: string; guardrails: string[]; status: "DRAFT" | "RUNNING" | "DECIDED" | "STOPPED"; decision?: string }) {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(input.experimentKey) || !input.hypothesis.trim() || !input.primaryMetric.trim() || !input.guardrails.length) throw new Error("EXPERIMENT_CONTRACT_INVALID");
  const data = { area: input.area, hypothesis: sanitizeSupportText(input.hypothesis, 500), primaryMetric: input.primaryMetric.slice(0, 120), guardrails: input.guardrails.map((value) => value.slice(0, 120)), status: input.status, decision: input.decision ? sanitizeSupportText(input.decision, 500) : null, decisionAt: input.status === "DECIDED" ? new Date() : null };
  return prisma.productExperiment.upsert({ where: { experimentKey: input.experimentKey }, create: { experimentKey: input.experimentKey, ...data }, update: data });
}

export async function updateSupportTicketOperations(prisma: PrismaClient, input: { companyId: string; ticketId: string; status: string; minutes: number; resolutionCode?: string; satisfactionScore?: number; satisfactionConsent: boolean }) {
  const statuses = new Set(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]);
  const resolutionCodes = new Set(["GUIDANCE", "CONFIGURATION", "DEFECT", "FEATURE_REQUEST", "ACCESS_RECOVERY", "NO_ACTION"]);
  if (!statuses.has(input.status) || !Number.isInteger(input.minutes) || input.minutes < 0 || input.minutes > 480 || input.resolutionCode && !resolutionCodes.has(input.resolutionCode)) throw new Error("SUPPORT_OPERATION_INVALID");
  if (input.satisfactionScore !== undefined && (!input.satisfactionConsent || !Number.isInteger(input.satisfactionScore) || input.satisfactionScore < 1 || input.satisfactionScore > 5)) throw new Error("SUPPORT_SATISFACTION_CONSENT_REQUIRED");
  const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { id: input.ticketId, companyId: input.companyId } });
  const now = new Date();
  return prisma.supportTicket.update({ where: { id: ticket.id }, data: {
    status: input.status,
    supportMinutes: { increment: input.minutes },
    firstResponseAt: ticket.firstResponseAt ?? (input.status !== "OPEN" ? now : undefined),
    resolvedAt: ["RESOLVED", "CLOSED"].includes(input.status) ? ticket.resolvedAt ?? now : undefined,
    resolutionCode: input.resolutionCode,
    satisfactionScore: input.satisfactionScore,
    satisfactionConsentAt: input.satisfactionScore !== undefined ? now : undefined,
  } });
}
