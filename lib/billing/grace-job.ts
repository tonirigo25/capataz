import type { Prisma, PrismaClient } from "@prisma/client";
import { isBillingEnabled } from "@/lib/billing/config";
import { prisma } from "@/lib/prisma";

export async function enforceExpiredBillingGrace(input: {
  database?: PrismaClient;
  now?: Date;
  batchSize?: number;
} = {}) {
  if (!isBillingEnabled()) return { examined: 0, enforced: 0, skipped: "billing_disabled" as const };
  const database = input.database ?? prisma;
  const now = input.now ?? new Date();
  const batchSize = Math.max(1, Math.min(input.batchSize ?? 100, 500));
  const candidates = await database.subscription.findMany({
    where: { status: "PAST_DUE", graceEndsAt: { lte: now } },
    orderBy: { graceEndsAt: "asc" },
    take: batchSize,
    select: { id: true },
  });
  let enforced = 0;
  for (const candidate of candidates) {
    const changed = await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-grace:${candidate.id}`}, 0))`;
      const current = await transaction.subscription.findUnique({ where: { id: candidate.id } });
      if (!current || current.status !== "PAST_DUE" || !current.graceEndsAt || current.graceEndsAt > now) return false;
      const marker = current.graceEndsAt.toISOString();
      const metadata = jsonObject(current.metadata);
      if (metadata.billingGraceEnforcedFor === marker) return false;
      await transaction.subscription.update({
        where: { id: current.id },
        data: {
          readOnlyAt: current.graceEndsAt,
          metadata: { ...metadata, billingGraceEnforcedFor: marker },
        },
      });
      await transaction.subscriptionHistory.create({
        data: {
          subscriptionId: current.id,
          action: "billing.grace_expired",
          fromStatus: current.status,
          toStatus: current.status,
          reason: "payment_grace_expired_read_only",
        },
      });
      await transaction.auditLog.create({
        data: {
          companyId: current.companyId,
          action: "billing.access_changed_to_read_only",
          targetType: "Subscription",
          targetId: current.id,
          metadata: { reason: "payment_grace_expired", graceEndsAt: marker },
        },
      });
      return true;
    }, { isolationLevel: "Serializable" });
    if (changed) enforced += 1;
  }
  return { examined: candidates.length, enforced, skipped: null };
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}
