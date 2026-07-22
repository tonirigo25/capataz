import type { PrismaClient, Prisma } from "@prisma/client";
import { createOpaqueToken } from "@/lib/auth/crypto";
import { defaultPlanKey } from "./plans";

type Db = PrismaClient | Prisma.TransactionClient;
export type ProvisionCompanyInput = { userId: string; name: string; organizationType: "SELF_EMPLOYED" | "COMPANY"; sectorKey: string; country?: string; mainGoal?: string; teamSize?: string; planKey?: string; idempotencyKey: string; isDemo?: boolean; demoScenarioKey?: string };

export async function provisionCompany(prisma: PrismaClient, input: ProvisionCompanyInput) {
  return prisma.$transaction((tx) => provisionCompanyInTransaction(tx, input));
}

export async function provisionCompanyInTransaction(tx: Prisma.TransactionClient, input: ProvisionCompanyInput) {
    const existing = await tx.company.findUnique({ where: { provisioningKey: input.idempotencyKey }, include: { memberships: true } });
    if (existing) {
      if (!existing.memberships.some((item) => item.userId === input.userId)) throw new Error("PROVISIONING_KEY_CONFLICT");
      return existing;
    }
    const plan = await tx.plan.findUnique({ where: { key: input.planKey ?? defaultPlanKey } });
    if (!plan) throw new Error("COMMERCIAL_PLANS_NOT_CONFIGURED");
    const now = new Date();
    const company = await tx.company.create({ data: { slug: `${slugify(input.name)}-${createOpaqueToken().slice(0, 7).toLowerCase()}`, nombreComercial: input.name, organizationType: input.organizationType, sectorKey: input.sectorKey, pais: input.country ?? "España", businessProfileVersion: "1", onboardingState: { step: 6, mainGoal: input.mainGoal ?? "", teamSize: input.teamSize ?? "" }, provisioningKey: input.idempotencyKey, isDemo: input.isDemo ?? false, demoScenarioKey: input.demoScenarioKey, commercialStatus: "ACTIVE" } });
    const membership = await tx.companyMembership.create({ data: { companyId: company.id, userId: input.userId, role: "OWNER", status: "active", acceptedAt: now, joinedAt: now, origin: input.isDemo ? "demo" : "provisioning", isDemo: input.isDemo ?? false } });
    await tx.subscription.create({ data: { companyId: company.id, planId: plan.id, status: "TRIALING", trialEndsAt: new Date(now.getTime() + 14 * 86_400_000), currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000), provider: "local", metadata: { simulated: true } } });
    await tx.user.update({ where: { id: input.userId }, data: { activeCompanyId: company.id } });
    await tx.auditLog.createMany({ data: [
      { companyId: company.id, userActorId: input.userId, action: "company.provisioned", targetType: "Company", targetId: company.id, metadata: { isDemo: input.isDemo ?? false, sectorKey: input.sectorKey } },
      { companyId: company.id, userActorId: input.userId, action: "membership.owner_created", targetType: "CompanyMembership", targetId: membership.id }
    ] });
    return company;
}

export async function ensureBasePlans(db: Db) {
  const { planCatalog } = await import("./plans");
  for (const [key, plan] of Object.entries(planCatalog)) {
    const record = await db.plan.upsert({ where: { key }, update: { name: plan.name, description: plan.description, audience: plan.audience, commercialState: plan.commercialState }, create: { key, name: plan.name, description: plan.description, audience: plan.audience, commercialState: plan.commercialState } });
    for (const [entitlementKey, value] of Object.entries(plan.entitlements)) await db.planEntitlement.upsert({ where: { planId_key: { planId: record.id, key: entitlementKey } }, update: { value, type: typeof value === "boolean" ? "BOOLEAN" : typeof value === "number" ? "INTEGER" : "STRING" }, create: { planId: record.id, key: entitlementKey, value, type: typeof value === "boolean" ? "BOOLEAN" : typeof value === "number" ? "INTEGER" : "STRING" } });
  }
}

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "empresa"; }
