import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as durableAuditDatabase } from "../prisma";
import { getEntitlements } from "./authorization";
import type { EntitlementKey } from "./catalog";
import {
  assertUsageMutationAllowed,
  evaluateUsageLimit,
  runtimeUsageLimitKeys,
  type RuntimeUsageLimitKey,
} from "./limits";

type UsageTransaction = Prisma.TransactionClient;

export function currentUsagePeriod(now = new Date()) {
  return {
    periodStart: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ),
    periodEnd: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ),
  };
}

export async function acquireEntitlementLimitLock(
  transaction: UsageTransaction,
  companyId: string,
  limitKey: RuntimeUsageLimitKey,
  lockScope = "current",
) {
  if (!runtimeUsageLimitKeys.includes(limitKey))
    throw new Error("USAGE_LIMIT_KEY_NOT_APPROVED");
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`commercial:${limitKey}:${companyId}:${lockScope}`}, 0))`;
}

export async function assertEntitlementMutationAllowed(
  transaction: UsageTransaction,
  input: {
    companyId: string;
    limitKey: RuntimeUsageLimitKey;
    quantity?: number;
    lockScope?: string;
    measure: (transaction: UsageTransaction) => Promise<number>;
    audit?: {
      actorId?: string;
      origin: string;
      targetType?: string;
      targetId?: string;
      idempotencyKey?: string;
      scopeKey?: string;
    };
  },
) {
  await acquireEntitlementLimitLock(
    transaction,
    input.companyId,
    input.limitKey,
    input.lockScope,
  );
  const [commercial, used] = await Promise.all([
    getEntitlements(input.companyId, transaction),
    input.measure(transaction),
  ]);
  const configured = commercial.values[input.limitKey];
  if (typeof configured !== "number")
    throw new Error(`USAGE_LIMIT_NOT_CONFIGURED:${input.limitKey}`);
  const decision = evaluateUsageLimit({
    used,
    limit: configured,
    quantity: input.quantity ?? 1,
    operation: "CREATE",
  });
  if (decision.blocked) {
    await persistBlockedLimitAudit({
      companyId: input.companyId,
      limitKey: input.limitKey,
      lockScope: input.lockScope,
      actorId: input.audit?.actorId,
      origin: input.audit?.origin,
      targetType: input.audit?.targetType,
      targetId: input.audit?.targetId,
      idempotencyKey: input.audit?.idempotencyKey,
      scopeKey: input.audit?.scopeKey,
      decision,
    });
    assertUsageMutationAllowed(decision);
  }
  if (input.audit)
    await transaction.auditLog.create({
      data: {
        companyId: input.companyId,
        userActorId: input.audit.actorId,
        action: "commercial.limit_evaluated",
        targetType: input.audit.targetType ?? "Entitlement",
        targetId: input.audit.targetId,
        metadata: {
          origin: input.audit.origin,
          limitKey: input.limitKey,
          used: decision.used,
          requested: decision.requested,
          projected: decision.projected,
          limit: decision.limit,
          warning: decision.warning,
          outcome: decision.audit.outcome,
          automaticCharge: false,
        },
      },
    });
  return decision;
}

export async function assertDocumentCreationAllowed(
  transaction: UsageTransaction,
  input: {
    companyId: string;
    quantity?: number;
    sizeBytes?: number;
    now?: Date;
    actorId?: string;
    origin?: string;
    targetId?: string;
  },
) {
  const { periodStart, periodEnd } = currentUsagePeriod(input.now);
  const documentDecision = await assertEntitlementMutationAllowed(transaction, {
    companyId: input.companyId,
    limitKey: "max_documents",
    lockScope: periodStart.toISOString(),
    quantity: input.quantity ?? 1,
    audit: input.origin
      ? {
          actorId: input.actorId,
          origin: input.origin,
          targetType: "Document",
          targetId: input.targetId,
        }
      : undefined,
    measure: (tx) =>
      tx.document.count({
        where: {
          companyId: input.companyId,
          archivedAt: null,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
  });
  const sizeBytes = input.sizeBytes ?? 0;
  const storageDecision =
    sizeBytes > 0
      ? await assertStorageMutationAllowed(transaction, {
          companyId: input.companyId,
          sizeBytes,
          actorId: input.actorId,
          origin: input.origin,
          targetId: input.targetId,
        })
      : null;
  return { documentDecision, storageDecision };
}

export async function assertStorageMutationAllowed(
  transaction: UsageTransaction,
  input: {
    companyId: string;
    sizeBytes: number;
    actorId?: string;
    origin?: string;
    targetId?: string;
  },
) {
  return assertEntitlementMutationAllowed(transaction, {
    companyId: input.companyId,
    limitKey: "storage_bytes",
    quantity: input.sizeBytes,
    audit: input.origin
      ? {
          actorId: input.actorId,
          origin: input.origin,
          targetType: "StoredObject",
          targetId: input.targetId,
        }
      : undefined,
    measure: async (tx) => {
      const [documents, objects] = await Promise.all([
        tx.document.aggregate({
          where: {
            companyId: input.companyId,
            archivedAt: null,
            storedObjectId: null,
          },
          _sum: { size: true },
        }),
        tx.storedObject.aggregate({
          where: { companyId: input.companyId, deletedAt: null },
          _sum: { sizeBytes: true },
        }),
      ]);
      return (
        Number(documents._sum.size ?? 0) +
        Number(objects._sum.sizeBytes ?? 0)
      );
    },
  });
}

export async function recordUsage(prisma: PrismaClient, input: { companyId: string; metric: string; quantity: number; idempotencyKey: string; origin: string; reference?: string; periodStart: Date; periodEnd: Date }) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("USAGE_QUANTITY_MUST_BE_POSITIVE");
  if (input.periodEnd <= input.periodStart) throw new Error("USAGE_PERIOD_INVALID");
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`usage:${input.companyId}:${input.metric}:${input.periodStart.toISOString()}`}, 0))`;
    const existing = await transaction.usageRecord.findUnique({ where: { companyId_metric_idempotencyKey: { companyId: input.companyId, metric: input.metric, idempotencyKey: input.idempotencyKey } } });
    if (existing) {
      if (Number(existing.quantity) !== input.quantity || existing.periodStart.getTime() !== input.periodStart.getTime() || existing.periodEnd.getTime() !== input.periodEnd.getTime()) throw new Error("USAGE_IDEMPOTENCY_CONFLICT");
      return existing;
    }
    return transaction.usageRecord.create({ data: input });
  }, { isolationLevel: "Serializable" });
}

type LimitedUsageInput = {
  companyId: string;
  metric: string;
  quantity: number;
  idempotencyKey: string;
  origin: string;
  reference?: string;
  periodStart: Date;
  periodEnd: Date;
} & (
  | { limitKey: RuntimeUsageLimitKey; limit?: never }
  | { limit: number; limitKey?: never }
);

export async function recordLimitedUsage(prisma: PrismaClient, input: LimitedUsageInput) {
  if ("limit" in input && (!Number.isFinite(input.limit) || input.limit! < 0))
    throw new Error("USAGE_LIMIT_INVALID");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("USAGE_QUANTITY_MUST_BE_POSITIVE");
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`usage:${input.companyId}:${input.metric}:${input.periodStart.toISOString()}`}, 0))`;
    const existing = await transaction.usageRecord.findUnique({ where: { companyId_metric_idempotencyKey: { companyId: input.companyId, metric: input.metric, idempotencyKey: input.idempotencyKey } } });
    const aggregate = await transaction.usageRecord.aggregate({ where: { companyId: input.companyId, metric: input.metric, periodStart: { gte: input.periodStart }, periodEnd: { lte: input.periodEnd } }, _sum: { quantity: true } });
    const used = Number(aggregate._sum.quantity ?? 0);
    if (existing) {
      if (
        Number(existing.quantity) !== input.quantity ||
        existing.periodStart.getTime() !== input.periodStart.getTime() ||
        existing.periodEnd.getTime() !== input.periodEnd.getTime() ||
        existing.origin !== input.origin ||
        (existing.reference ?? undefined) !== input.reference
      )
        throw new Error("USAGE_IDEMPOTENCY_CONFLICT");
      const configured = await resolveLimitedUsageLimit(transaction, input);
      const replayDecision = evaluateUsageLimit({
        used,
        limit: configured,
        operation: "READ",
      });
      return { record: existing, replayed: true, decision: replayDecision };
    }
    const decision =
      "limitKey" in input && input.limitKey
        ? await assertEntitlementMutationAllowed(transaction, {
            companyId: input.companyId,
            limitKey: input.limitKey,
            lockScope: input.periodStart.toISOString(),
            quantity: input.quantity,
            measure: async () => used,
            audit: {
              origin: input.origin,
              targetType: "UsageRecord",
              targetId: input.reference,
              idempotencyKey: input.idempotencyKey,
              scopeKey: input.metric,
            },
          })
        : await evaluateExplicitLimitedUsage(input, used);
    const record = await transaction.usageRecord.create({ data: { companyId: input.companyId, metric: input.metric, quantity: input.quantity, idempotencyKey: input.idempotencyKey, origin: input.origin, reference: input.reference, periodStart: input.periodStart, periodEnd: input.periodEnd } });
    return { record, replayed: false, decision };
  }, { isolationLevel: "Serializable" });
}

async function evaluateExplicitLimitedUsage(
  input: LimitedUsageInput,
  used: number,
) {
  const decision = evaluateUsageLimit({
    used,
    limit: input.limit!,
    quantity: input.quantity,
    operation: "CREATE",
  });
  if (!decision.blocked) return decision;
  await persistBlockedLimitAudit({
    companyId: input.companyId,
    limitKey: "explicit",
    lockScope: input.periodStart.toISOString(),
    origin: input.origin,
    targetType: "UsageRecord",
    targetId: input.reference,
    idempotencyKey: input.idempotencyKey,
    scopeKey: input.metric,
    decision,
  });
  assertUsageMutationAllowed(decision);
  return decision;
}

async function persistBlockedLimitAudit(input: {
  companyId: string;
  limitKey: string;
  lockScope?: string;
  actorId?: string;
  origin?: string;
  targetType?: string;
  targetId?: string;
  idempotencyKey?: string;
  scopeKey?: string;
  decision: ReturnType<typeof evaluateUsageLimit>;
}) {
  const origin = safeAuditLabel(input.origin, "runtime_limit_guard");
  const targetType = safeAuditLabel(input.targetType, "Entitlement");
  const targetReferenceHash = input.targetId
    ? shortHash(input.targetId)
    : undefined;
  const requestId = `limit-blocked:${shortHash(JSON.stringify({
    companyId: input.companyId,
    limitKey: input.limitKey,
    lockScope: input.lockScope ?? "current",
    actorId: input.actorId ?? null,
    originHash: shortHash(input.origin ?? origin),
    targetReferenceHash: targetReferenceHash ?? null,
    idempotencyHash: input.idempotencyKey
      ? shortHash(input.idempotencyKey)
      : null,
    scopeHash: input.scopeKey ? shortHash(input.scopeKey) : null,
    used: input.decision.used,
    requested: input.decision.requested,
    projected: input.decision.projected,
    limit: input.decision.limit,
  }))}`;
  await durableAuditDatabase.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`commercial-limit-audit:${requestId}`}, 0))`;
    const existing = await transaction.auditLog.findFirst({
      where: {
        companyId: input.companyId,
        action: "commercial.limit_evaluated",
        requestId,
      },
      select: { id: true },
    });
    if (existing) return;
    await transaction.auditLog.create({
      data: {
        companyId: input.companyId,
        userActorId: input.actorId,
        action: "commercial.limit_evaluated",
        targetType,
        requestId,
        metadata: {
          origin,
          limitKey: input.limitKey,
          used: input.decision.used,
          requested: input.decision.requested,
          projected: input.decision.projected,
          limit: input.decision.limit,
          warning: input.decision.warning,
          outcome: "blocked",
          automaticCharge: false,
          ...(targetReferenceHash ? { targetReferenceHash } : {}),
        },
      },
    });
  }, { isolationLevel: "Serializable" });
}

function safeAuditLabel(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9._:-]{1,80}$/.test(normalized)
    ? normalized
    : fallback;
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function resolveLimitedUsageLimit(
  transaction: UsageTransaction,
  input: LimitedUsageInput,
) {
  if ("limit" in input && typeof input.limit === "number") return input.limit;
  const commercial = await getEntitlements(input.companyId, transaction);
  const configured = commercial.values[input.limitKey!];
  if (typeof configured !== "number")
    throw new Error(`USAGE_LIMIT_NOT_CONFIGURED:${input.limitKey}`);
  return configured;
}

export async function getRemainingUsage(prisma: PrismaClient, companyId: string, metric: string, limitKey: EntitlementKey, periodStart: Date, periodEnd: Date) {
  const [aggregate, commercial] = await Promise.all([prisma.usageRecord.aggregate({ where: { companyId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }, _sum: { quantity: true } }), getEntitlements(companyId)]);
  const used = Number(aggregate._sum.quantity ?? new Prisma.Decimal(0)); const limit = Number(commercial.values[limitKey] ?? 0);
  const decision = evaluateUsageLimit({ used, limit, operation: "READ" });
  return {
    used,
    limit,
    remaining: decision.remaining,
    reached: used >= limit,
    warning: decision.warning,
    canCreate: used < limit,
    readAllowed: decision.allowed,
    nextAction: decision.nextAction,
  };
}
