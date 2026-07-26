import { Prisma, type PrismaClient } from "@prisma/client";
import { getEntitlements } from "./authorization";
import type { EntitlementKey } from "./catalog";

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

export async function recordLimitedUsage(prisma: PrismaClient, input: { companyId: string; metric: string; limit: number; quantity: number; idempotencyKey: string; origin: string; reference?: string; periodStart: Date; periodEnd: Date }) {
  if (!Number.isFinite(input.limit) || input.limit < 0) throw new Error("USAGE_LIMIT_INVALID");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("USAGE_QUANTITY_MUST_BE_POSITIVE");
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`usage:${input.companyId}:${input.metric}:${input.periodStart.toISOString()}`}, 0))`;
    const existing = await transaction.usageRecord.findUnique({ where: { companyId_metric_idempotencyKey: { companyId: input.companyId, metric: input.metric, idempotencyKey: input.idempotencyKey } } });
    if (existing) {
      if (Number(existing.quantity) !== input.quantity) throw new Error("USAGE_IDEMPOTENCY_CONFLICT");
      return { record: existing, replayed: true };
    }
    const aggregate = await transaction.usageRecord.aggregate({ where: { companyId: input.companyId, metric: input.metric, periodStart: { gte: input.periodStart }, periodEnd: { lte: input.periodEnd } }, _sum: { quantity: true } });
    const used = Number(aggregate._sum.quantity ?? 0);
    if (used + input.quantity > input.limit) throw new Error("USAGE_LIMIT_REACHED_NO_AUTOMATIC_CHARGE");
    const record = await transaction.usageRecord.create({ data: { companyId: input.companyId, metric: input.metric, quantity: input.quantity, idempotencyKey: input.idempotencyKey, origin: input.origin, reference: input.reference, periodStart: input.periodStart, periodEnd: input.periodEnd } });
    return { record, replayed: false };
  }, { isolationLevel: "Serializable" });
}
export async function getRemainingUsage(prisma: PrismaClient, companyId: string, metric: string, limitKey: EntitlementKey, periodStart: Date, periodEnd: Date) {
  const [aggregate, commercial] = await Promise.all([prisma.usageRecord.aggregate({ where: { companyId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }, _sum: { quantity: true } }), getEntitlements(companyId)]);
  const used = Number(aggregate._sum.quantity ?? new Prisma.Decimal(0)); const limit = Number(commercial.values[limitKey] ?? 0);
  return { used, limit, remaining: Math.max(0, limit - used), reached: used >= limit };
}
