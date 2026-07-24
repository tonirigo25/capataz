import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";

export async function requireActiveOwner() {
  const context = await requireCompanyContext();
  if (context.role !== "OWNER") throw new Error("OWNER_REQUIRED");
  const membership = await prisma.companyMembership.findFirst({
    where: { id: context.membershipId, userId: context.userId, companyId: context.companyId, role: "OWNER", status: "active", company: { status: "active", archivedAt: null } }
  });
  if (!membership) throw new Error("ACTIVE_OWNER_REQUIRED");
  return { ...context, ownerMembership: membership };
}

export async function invalidateMembershipAccess(tx: typeof prisma, input: { companyId: string; membershipId: string; userId: string; actorId: string; reason: string }) {
  const now = new Date();
  const conversations = await tx.chatConversation.findMany({ where: { companyId: input.companyId, ownerUserId: input.userId, pendingConfirmation: { not: Prisma.JsonNull } }, select: { id: true, pendingConfirmation: true } });
  for (const conversation of conversations) {
    const pending = conversation.pendingConfirmation && typeof conversation.pendingConfirmation === "object" && !Array.isArray(conversation.pendingConfirmation) ? conversation.pendingConfirmation as Record<string, unknown> : {};
    await tx.chatConversation.update({ where: { id: conversation.id }, data: { pendingConfirmation: { ...pending, status: "INVALIDATED", invalidatedAt: now.toISOString(), reason: input.reason } } });
  }
  await tx.session.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.companyMembership.update({ where: { id: input.membershipId }, data: { accessVersion: { increment: 1 } } });
  await tx.auditLog.create({ data: { companyId: input.companyId, userActorId: input.actorId, action: "membership.access_invalidated", targetType: "CompanyMembership", targetId: input.membershipId, reason: input.reason } });
}
