import { Prisma, type PrismaClient } from "@prisma/client";
import { getEntitlements } from "./authorization";
import type { EntitlementKey } from "./catalog";

export async function recordUsage(prisma: PrismaClient, input: { companyId: string; metric: string; quantity: number; idempotencyKey: string; origin: string; reference?: string; periodStart: Date; periodEnd: Date }) {
  return prisma.usageRecord.upsert({ where: { companyId_metric_idempotencyKey: { companyId: input.companyId, metric: input.metric, idempotencyKey: input.idempotencyKey } }, update: {}, create: input });
}
export async function getRemainingUsage(prisma: PrismaClient, companyId: string, metric: string, limitKey: EntitlementKey, periodStart: Date, periodEnd: Date) {
  const [aggregate, commercial] = await Promise.all([prisma.usageRecord.aggregate({ where: { companyId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }, _sum: { quantity: true } }), getEntitlements(companyId)]);
  const used = Number(aggregate._sum.quantity ?? new Prisma.Decimal(0)); const limit = Number(commercial.values[limitKey] ?? 0);
  return { used, limit, remaining: Math.max(0, limit - used), reached: used >= limit };
}
