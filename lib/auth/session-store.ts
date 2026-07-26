import { createOpaqueToken, hashToken } from "@/lib/auth/crypto";
import type { PrismaClient } from "@prisma/client";

export async function rotateSessionRecord(input: {
  prisma: PrismaClient;
  sessionId: string;
  userId: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipHash?: string | null;
  secondFactorVerifiedAt?: Date | null;
}) {
  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const session = await input.prisma.$transaction(async (transaction) => {
    const revoked = await transaction.session.updateMany({ where: { id: input.sessionId, userId: input.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) throw new Error("SESSION_ROTATION_CONFLICT");
    return transaction.session.create({ data: { userId: input.userId, tokenHash, expiresAt: input.expiresAt, userAgent: input.userAgent, ipHash: input.ipHash, secondFactorVerifiedAt: input.secondFactorVerifiedAt } });
  });
  return { token, tokenHash, session };
}
