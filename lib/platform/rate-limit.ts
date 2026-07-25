import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type RateLimitInput = {
  prisma: PrismaClient;
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
  companyId?: string;
  now?: Date;
};

export async function consumeRateLimit(input: RateLimitInput) {
  if (!Number.isInteger(input.limit) || input.limit < 1) throw new Error("INVALID_RATE_LIMIT");
  if (!Number.isInteger(input.windowMs) || input.windowMs < 1_000) throw new Error("INVALID_RATE_WINDOW");
  const now = input.now ?? new Date();
  const windowStart = Math.floor(now.getTime() / input.windowMs) * input.windowMs;
  const subjectHash = createHash("sha256").update(input.subject).digest("hex");
  const id = createHash("sha256").update(`rate:${input.companyId ?? "global"}:${input.scope}:${subjectHash}:${windowStart}`).digest("hex");
  const expiresAt = new Date(windowStart + input.windowMs);
  const record = await input.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
    const existing = await transaction.idempotencyRecord.findUnique({ where: { id }, select: { responseStatus: true } });
    if (existing) {
      return transaction.idempotencyRecord.update({ where: { id }, data: { responseStatus: { increment: 1 } }, select: { responseStatus: true } });
    }
    return transaction.idempotencyRecord.create({
      data: {
        id,
        companyId: input.companyId,
        namespace: `rate_limit:${input.scope}`,
        idempotencyKey: `${subjectHash}:${windowStart}`,
        requestHash: subjectHash,
        responseStatus: 1,
        schemaVersion: 1,
        expiresAt,
      },
      select: { responseStatus: true },
    });
  });
  const count = record.responseStatus ?? 1;
  return {
    allowed: count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    resetAt: expiresAt,
  };
}

export function rateLimitHeaders(result: Awaited<ReturnType<typeof consumeRateLimit>>) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };
}
