import type { PrismaClient } from "@prisma/client";

export const DEMO_REQUEST_RETENTION_STATUSES = ["PENDING", "DECLINED", "SPAM"] as const;
export const DEMO_REQUEST_PROTECTED_STATUSES = ["IN_REVIEW", "QUALIFIED", "CONVERTED", "LEGAL_HOLD"] as const;

export async function pruneExpiredDemoRequests(
  prisma: PrismaClient,
  input: { now?: Date; retentionDays: number; dryRun: boolean },
) {
  if (!Number.isSafeInteger(input.retentionDays) || input.retentionDays < 30 || input.retentionDays > 3_650) {
    throw new Error("DEMO_RETENTION_DAYS_INVALID");
  }
  const now = input.now ?? new Date();
  const before = new Date(now.getTime() - input.retentionDays * 24 * 60 * 60 * 1_000);
  const where = {
    status: { in: [...DEMO_REQUEST_RETENTION_STATUSES] },
    createdAt: { lt: before },
  };
  const candidates = await prisma.demoRequest.findMany({
    where,
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 5_000,
  });
  if (input.dryRun || candidates.length === 0) {
    return { dryRun: input.dryRun, before, candidates: candidates.length, deleted: 0 };
  }
  const ids = candidates.map((item) => item.id);
  const applied = await prisma.$transaction(async (transaction) => {
    const deleted = await transaction.demoRequest.deleteMany({ where: { id: { in: ids }, ...where } });
    await transaction.auditLog.create({
      data: {
        action: "demo_request.retention_applied",
        targetType: "DemoRequest",
        metadata: {
          retentionDays: input.retentionDays,
          candidateCount: candidates.length,
          deletedCount: deleted.count,
          protectedStatuses: [...DEMO_REQUEST_PROTECTED_STATUSES],
        },
        actorType: "job",
      },
    });
    return deleted.count;
  });
  return { dryRun: false, before, candidates: candidates.length, deleted: applied };
}
