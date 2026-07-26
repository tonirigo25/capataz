import { Prisma, type PrismaClient } from "@prisma/client";
import { AiGatewayError } from "@/lib/ai/contracts";
import { stableReference } from "@/lib/ai/redaction";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

const REVIEW_OUTCOMES = new Set(["ACCEPTED", "CORRECTED", "REJECTED"]);

export async function recordAiReview(prisma: PrismaClient, input: {
  companyId: string;
  actorId: string;
  usageEventId: string;
  outcome: string;
  correctionKinds?: string[];
  reasonCode?: string;
}) {
  if (!REVIEW_OUTCOMES.has(input.outcome)) throw new AiGatewayError("AI_REVIEW_OUTCOME_INVALID");
  const usage = await prisma.aiUsageEvent.findFirst({ where: { id: input.usageEventId, companyId: input.companyId }, select: { id: true } });
  if (!usage) throw new AiGatewayError("AI_USAGE_EVENT_NOT_FOUND");
  const safeKinds = [...new Set(input.correctionKinds ?? [])].filter((value) => /^[a-z0-9_.:-]{1,64}$/i.test(value)).slice(0, 12);
  const safeReason = input.reasonCode?.trim().replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 64);
  return prisma.$transaction(async (transaction) => {
    const review = await transaction.aiReviewEvent.create({
      data: {
        companyId: input.companyId,
        usageEventId: usage.id,
        actorIdHash: stableReference(input.actorId),
        outcome: input.outcome,
        correctionKinds: safeKinds,
        reasonCode: safeReason,
      },
    });
    await transaction.aiUsageEvent.update({
      where: { id: usage.id },
      data: { humanReviewed: true, outcome: input.outcome },
    });
    return review;
  });
}

export async function aiUsageSummary(prisma: PrismaClient, input: { companyId: string; since: Date }) {
  const [usage, outcomes, calls] = await Promise.all([
    prisma.aiUsageEvent.aggregate({
      where: { companyId: input.companyId, createdAt: { gte: input.since } },
      _sum: { inputTokens: true, outputTokens: true, costAmount: true, latencyMs: true },
      _count: { _all: true },
    }),
    prisma.aiReviewEvent.groupBy({
      by: ["outcome"],
      where: { companyId: input.companyId, createdAt: { gte: input.since } },
      _count: { _all: true },
    }),
    prisma.aiUsageEvent.findMany({
      where: { companyId: input.companyId, createdAt: { gte: input.since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        purpose: true,
        lane: true,
        modelSnapshot: true,
        inputTokens: true,
        outputTokens: true,
        costAmount: true,
        latencyMs: true,
        outcome: true,
        estimatedUsage: true,
        humanReviewed: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    callCount: usage._count._all,
    inputTokens: usage._sum.inputTokens ?? 0,
    outputTokens: usage._sum.outputTokens ?? 0,
    aggregateCostEur: Number(usage._sum.costAmount ?? 0),
    aggregateLatencyMs: usage._sum.latencyMs ?? 0,
    reviewOutcomes: Object.fromEntries(outcomes.map((item) => [item.outcome, item._count._all])),
    calls,
  };
}

export async function purgeExpiredAiContent(prisma: PrismaClient, now = new Date()) {
  return prisma.$transaction(async (transaction) => {
    const operations = await transaction.aiGatewayOperation.updateMany({
      where: { contentExpiresAt: { lte: now }, contentPurgedAt: null },
      data: { responseEnvelope: Prisma.DbNull, contentPurgedAt: now },
    });
    const usage = await transaction.aiUsageEvent.updateMany({
      where: { contentExpiresAt: { lte: now }, contentPurgedAt: null },
      data: { contentPurgedAt: now },
    });
    return { operationsPurged: operations.count, usageMarked: usage.count };
  });
}

export async function setCompanyAiKillSwitch(prisma: PrismaClient, input: { companyId: string; actorId: string; killSwitch: boolean }) {
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.companyAiPolicy.updateMany({ where: { companyId: input.companyId }, data: { killSwitch: input.killSwitch } });
    if (updated.count !== 1) throw new AiGatewayError("AI_POLICY_NOT_CONFIGURED");
    await appendSensitiveAuditLog(transaction, {
      companyId: input.companyId,
      userActorId: input.actorId,
      action: input.killSwitch ? "ai.kill_switch.enabled" : "ai.kill_switch.disabled",
      targetType: "CompanyAiPolicy",
      targetId: input.companyId,
      metadata: { killSwitch: input.killSwitch },
    });
    return updated;
  });
}
