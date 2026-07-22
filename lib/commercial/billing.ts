import type { PrismaClient, SubscriptionStatus } from "@prisma/client";
import type { PlanKey } from "./plans";

export interface BillingProvider { changePlan(input: { companyId: string; planKey: PlanKey; actorId: string; reason: string }): Promise<void>; setStatus(input: { companyId: string; status: SubscriptionStatus; actorId: string; reason: string }): Promise<void>; }

export class LocalBillingProvider implements BillingProvider {
  constructor(private prisma: PrismaClient) {}
  async changePlan({ companyId, planKey, actorId, reason }: { companyId: string; planKey: PlanKey; actorId: string; reason: string }) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { plan: true } });
      const next = await tx.plan.findUniqueOrThrow({ where: { key: planKey } });
      if (!current) throw new Error("SUBSCRIPTION_NOT_CONFIGURED");
      await tx.subscription.update({ where: { id: current.id }, data: { planId: next.id, scheduledPlanKey: null } });
      await tx.subscriptionHistory.create({ data: { subscriptionId: current.id, action: "plan_changed_local", fromPlanKey: current.plan.key, toPlanKey: planKey, reason } });
      await tx.auditLog.create({ data: { companyId, userActorId: actorId, action: "subscription.plan_changed", targetType: "Subscription", targetId: current.id, metadata: { from: current.plan.key, to: planKey, provider: "local" }, reason } });
    });
  }
  async setStatus({ companyId, status, actorId, reason }: { companyId: string; status: SubscriptionStatus; actorId: string; reason: string }) {
    await this.prisma.$transaction(async (tx) => { const current = await tx.subscription.findFirstOrThrow({ where: { companyId }, orderBy: { createdAt: "desc" } }); await tx.subscription.update({ where: { id: current.id }, data: { status } }); await tx.subscriptionHistory.create({ data: { subscriptionId: current.id, action: "status_changed_local", fromStatus: current.status, toStatus: status, reason } }); await tx.auditLog.create({ data: { companyId, userActorId: actorId, action: "subscription.status_changed", targetType: "Subscription", targetId: current.id, reason, metadata: { from: current.status, to: status } } }); });
  }
}

export function getBillingProvider(prisma: PrismaClient): BillingProvider { return new LocalBillingProvider(prisma); }
