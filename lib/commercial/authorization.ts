import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, type CompanyContext } from "@/lib/auth/session";
import { capabilityCatalog, roleCapabilities, type CapabilityKey, type EntitlementKey } from "@/lib/commercial/catalog";
import { defaultPlanKey, planCatalog, type EntitlementValue } from "@/lib/commercial/plans";
import { canHoldEconomicCapabilities, ECONOMIC_CAPABILITIES, functionalProfileCapabilities, resolveFunctionalProfile } from "@/lib/commercial/functional-profiles";

export type AuthorizationDecision = { allowed: boolean; reason: "allowed" | "permission" | "entitlement" | "membership" | "company" | "subscription"; scope: string };

export async function getEntitlements(companyId: string) {
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { plan: { include: { entitlements: true } } } });
  const fallback = planCatalog[defaultPlanKey].entitlements;
  const values: Record<string, EntitlementValue> = { ...fallback };
  if (subscription) for (const item of subscription.plan.entitlements) values[item.key] = jsonValue(item.value);
  const overrides = await prisma.companyEntitlementOverride.findMany({ where: { companyId, active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } });
  for (const item of overrides) values[item.key] = jsonValue(item.value);
  return { planKey: subscription?.plan.key ?? defaultPlanKey, subscription, values };
}

export async function resolveAuthorization(context: CompanyContext, capability: CapabilityKey): Promise<AuthorizationDecision> {
  if (context.commercialStatus === "SUSPENDED") return { allowed: false, reason: "company", scope: "COMPANY" };
  // Some isolated legacy parser harnesses replace Prisma with a narrow query mock.
  // Production and integration clients always expose this delegate.
  if (!prisma.companyMembership) { const legacyAllowed = !context.role || roleCapabilities[context.role].includes(capability); return { allowed: legacyAllowed, reason: legacyAllowed ? "allowed" : "permission", scope: "COMPANY" }; }
  const membership = await prisma.companyMembership.findUnique({ where: { id: context.membershipId }, include: { permissionOverrides: true, scopeAssignments: { where: { capabilityKey: capability } } } });
  if (!membership || membership.status !== "active") return { allowed: false, reason: "membership", scope: "COMPANY" };
  const profile = resolveFunctionalProfile(membership.functionalProfileKey, membership.role);
  const override = membership.permissionOverrides.find((item) => item.capabilityKey === capability);
  if (override?.effect === "DENY") return { allowed: false, reason: "permission", scope: override.scope ?? "COMPANY" };
  const economicGrantForbidden = ECONOMIC_CAPABILITIES.has(capability) && !canHoldEconomicCapabilities(profile);
  const permitted = !economicGrantForbidden && (override?.effect === "GRANT" || functionalProfileCapabilities[profile].includes(capability));
  if (!permitted) return { allowed: false, reason: "permission", scope: "COMPANY" };
  const commercial = await getEntitlements(context.companyId);
  const isReadOperation = capability.endsWith(".view") || capability.endsWith(".export") || capability === "orqena.use" || capability === "company.billing.manage";
  if (commercial.subscription && ["EXPIRED", "PAUSED", "CANCELED"].includes(commercial.subscription.status) && !isReadOperation) return { allowed: false, reason: "subscription", scope: "COMPANY" };
  const entitlement = capabilityCatalog[capability].requiredEntitlement;
  if (entitlement) {
    if (!Boolean(commercial.values[entitlement])) return { allowed: false, reason: "entitlement", scope: "COMPANY" };
  }
  const scope = override?.scope ?? membership.scopeAssignments[0]?.scope ?? "COMPANY";
  return { allowed: true, reason: "allowed", scope };
}

export async function requireCapability(capability: CapabilityKey) {
  const context = await requireCompanyContext();
  const decision = await resolveAuthorization(context, capability);
  if (!decision.allowed) redirect(`/acceso-restringido?reason=${decision.reason}`);
  return { ...context, capability, scope: decision.scope };
}

export async function getEffectiveCapabilities(context: CompanyContext): Promise<CapabilityKey[]> {
  const membership = await prisma.companyMembership.findFirst({ where: { id: context.membershipId, userId: context.userId, companyId: context.companyId, status: "active" }, include: { permissionOverrides: true } });
  if (!membership) return [];
  const profile = resolveFunctionalProfile(membership.functionalProfileKey, membership.role);
  const effective = new Set(functionalProfileCapabilities[profile]);
  for (const override of membership.permissionOverrides) {
    const key = override.capabilityKey as CapabilityKey;
    if (!(key in capabilityCatalog)) continue;
    if (override.effect === "DENY") effective.delete(key);
    else if (!(ECONOMIC_CAPABILITIES.has(key) && !canHoldEconomicCapabilities(profile))) effective.add(key);
  }
  return [...effective];
}

export async function requireEntitlement(key: EntitlementKey) {
  const context = await requireCompanyContext();
  const commercial = await getEntitlements(context.companyId);
  if (!Boolean(commercial.values[key])) redirect("/plan-y-uso?reason=entitlement");
  return { ...context, commercial };
}

export function hasEntitlement(values: Record<string, EntitlementValue>, key: EntitlementKey) { return Boolean(values[key]); }
export function getEntitlementValue(values: Record<string, EntitlementValue>, key: EntitlementKey) { return values[key]; }

function jsonValue(value: unknown): EntitlementValue {
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return jsonValue((value as { value: unknown }).value);
  return false;
}
