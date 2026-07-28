import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requirePlatformAccount } from "@/lib/commercial/platform";
import { prisma } from "@/lib/prisma";
import { registerVerifiedServiceCost, updateSupportTicketOperations, upsertPilotCohort, upsertProductExperiment } from "@/lib/product/pilot-governance";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

export async function savePilotCohortUseCase(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_OWNER");
  const companyId = text(formData, "companyId");
  const cohort = await upsertPilotCohort(prisma, { companyId, cohortKey: text(formData, "cohortKey"), status: text(formData, "status"), startsAt: date(formData, "startsAt"), endsAt: optionalDate(formData, "endsAt"), paid: formData.get("paid") === "on", contractStatus: text(formData, "contractStatus"), consentStatus: text(formData, "consentStatus"), goals: list(formData, "goals"), successCriteria: list(formData, "successCriteria"), cadence: text(formData, "cadence") as "WEEKLY" | "FORTNIGHTLY", onboardingStartedAt: optionalDate(formData, "onboardingStartedAt"), onboardingCompletedAt: optionalDate(formData, "onboardingCompletedAt"), resultStatus: (text(formData, "resultStatus") || "PENDING") as "PENDING" | "SUCCESS" | "PARTIAL" | "FAILED" | "WITHDRAWN", outcome: { summary: text(formData, "outcomeSummary"), metrics: list(formData, "outcomeMetrics") }, handoff: { commercialSummary: text(formData, "commercialSummary"), supportNeeds: text(formData, "supportNeeds"), productFocus: text(formData, "productFocus") } });
  await prisma.$transaction((transaction) => appendSensitiveAuditLog(transaction, { companyId, platformActorId: actor.platformAccountId, actorType: "platform", action: "pilot.cohort.updated", targetType: "PilotCohort", targetId: cohort.id, metadata: { status: cohort.status, paid: cohort.paid, contractStatus: cohort.contractStatus, consentStatus: cohort.consentStatus } }));
  revalidatePath("/plataforma/salud");
}

export async function saveServiceCostUseCase(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_OWNER");
  const companyId = text(formData, "companyId");
  const cost = await registerVerifiedServiceCost(prisma, { companyId, periodStart: date(formData, "periodStart"), periodEnd: date(formData, "periodEnd"), category: text(formData, "category"), amount: number(formData, "amount"), sourceType: text(formData, "sourceType"), sourceReference: text(formData, "sourceReference"), verified: formData.get("verified") === "on", planKey: text(formData, "planKey") || undefined });
  await prisma.$transaction((transaction) => appendSensitiveAuditLog(transaction, { companyId, platformActorId: actor.platformAccountId, actorType: "platform", action: "unit_economics.cost_recorded", targetType: "CompanyServiceCost", targetId: cost.id, metadata: { category: cost.category, sourceType: cost.sourceType, verified: cost.verified, currency: cost.currency } }));
  revalidatePath("/plataforma/salud");
}

export async function saveProductExperimentUseCase(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_OWNER");
  const experiment = await upsertProductExperiment(prisma, { experimentKey: text(formData, "experimentKey"), area: text(formData, "area") as "ONBOARDING" | "PRICING" | "PRODUCT", hypothesis: text(formData, "hypothesis"), primaryMetric: text(formData, "primaryMetric"), guardrails: list(formData, "guardrails"), status: text(formData, "status") as "DRAFT" | "RUNNING" | "DECIDED" | "STOPPED", decision: text(formData, "decision") || undefined });
  await prisma.auditLog.create({ data: { platformActorId: actor.platformAccountId, actorType: "platform", action: "product.experiment.updated", targetType: "ProductExperiment", targetId: experiment.id, metadata: { experimentKey: experiment.experimentKey, area: experiment.area, status: experiment.status, primaryMetric: experiment.primaryMetric } } });
  revalidatePath("/plataforma/salud");
}

export async function updateSupportTicketUseCase(formData: FormData) {
  const actor = await requirePlatformAccount("PLATFORM_SUPPORT");
  const companyId = text(formData, "companyId");
  const ticket = await updateSupportTicketOperations(prisma, { companyId, ticketId: text(formData, "ticketId"), status: text(formData, "status"), minutes: number(formData, "minutes"), resolutionCode: text(formData, "resolutionCode") || undefined, satisfactionScore: text(formData, "satisfactionScore") ? number(formData, "satisfactionScore") : undefined, satisfactionConsent: formData.get("satisfactionConsent") === "on" });
  await prisma.$transaction((transaction) => appendSensitiveAuditLog(transaction, { companyId, platformActorId: actor.platformAccountId, actorType: "platform", action: "support.ticket.updated", targetType: "SupportTicket", targetId: ticket.id, metadata: { status: ticket.status, supportMinutes: ticket.supportMinutes, resolutionCode: ticket.resolutionCode } }));
  revalidatePath("/plataforma/salud");
}

function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function list(formData: FormData, key: string) { return text(formData, key).split(/[,\n]/).map((value) => value.trim()).filter(Boolean); }
function number(formData: FormData, key: string) { const value = Number(text(formData, key)); if (!Number.isFinite(value)) throw new Error("NUMBER_INVALID"); return value; }
function date(formData: FormData, key: string) { const value = new Date(text(formData, key)); if (Number.isNaN(value.getTime())) throw new Error("DATE_INVALID"); return value; }
function optionalDate(formData: FormData, key: string) { return text(formData, key) ? date(formData, key) : undefined; }
