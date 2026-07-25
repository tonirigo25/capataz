import type { PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/platform/rate-limit";

export type PlatformActor = { platformAccountId: string; platformRole: PlatformRole };

export async function startSupportAccess(actor: PlatformActor, input: { companyId: string; reason: string; ticket?: string; minutes: number }) {
  const companyId = input.companyId.trim();
  const reason = input.reason.trim().slice(0, 300);
  const minutes = Math.min(120, Math.max(5, Math.floor(input.minutes)));
  if (!companyId || !reason) throw new Error("SUPPORT_INPUT_REQUIRED");
  const limit = await consumeRateLimit({ prisma, scope: "support_access", subject: actor.platformAccountId, companyId, limit: 10, windowMs: 60_000 });
  if (!limit.allowed) throw new Error("SUPPORT_RATE_LIMITED");
  return prisma.$transaction(async (transaction) => {
    const company = await transaction.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new Error("COMPANY_NOT_FOUND");
    const grant = await transaction.supportAccessGrant.create({
      data: {
        companyId,
        platformAccountId: actor.platformAccountId,
        reason,
        ticketReference: input.ticket?.trim().slice(0, 100) || null,
        capabilityKeys: ["company.view", "company.configuration.view"],
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });
    await transaction.auditLog.create({ data: { companyId, platformActorId: actor.platformAccountId, action: "support.access_started", targetType: "SupportAccessGrant", targetId: grant.id, reason, metadata: { expiresAt: grant.expiresAt.toISOString() } } });
    return grant;
  });
}

export async function endSupportAccess(actor: PlatformActor, grantId: string) {
  return prisma.$transaction(async (transaction) => {
    const grant = await transaction.supportAccessGrant.findFirstOrThrow({ where: { id: grantId, platformAccountId: actor.platformAccountId, status: "ACTIVE" } });
    await transaction.supportAccessGrant.update({ where: { id: grant.id }, data: { status: "CLOSED", endedAt: new Date() } });
    await transaction.auditLog.create({ data: { companyId: grant.companyId, platformActorId: actor.platformAccountId, action: "support.access_ended", targetType: "SupportAccessGrant", targetId: grant.id } });
  });
}

export async function setCompanySuspension(actor: PlatformActor, input: { companyId: string; suspended: boolean; reason: string }) {
  const reason = input.reason.trim().slice(0, 300);
  if (!input.companyId || !reason) throw new Error("SUSPENSION_INPUT_REQUIRED");
  return prisma.$transaction([
    prisma.company.update({ where: { id: input.companyId }, data: { commercialStatus: input.suspended ? "SUSPENDED" : "ACTIVE" } }),
    prisma.auditLog.create({ data: { companyId: input.companyId, platformActorId: actor.platformAccountId, action: input.suspended ? "company.suspended" : "company.reactivated", targetType: "Company", targetId: input.companyId, reason } }),
  ]);
}
