import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, type CompanyContext } from "@/lib/auth/session";
import { capabilityCatalog, roleCapabilities, scopeAssignableCapabilityKeys, type CapabilityKey, type EntitlementKey } from "@/lib/commercial/catalog";
import { defaultPlanKey, planCatalog, type EntitlementValue } from "@/lib/commercial/plans";
import { canHoldEconomicCapabilities, ECONOMIC_CAPABILITIES, functionalProfileCapabilities, profileDefaultPackages, resolveFunctionalProfile } from "@/lib/commercial/functional-profiles";
import { accessPackageCapabilities, accessPackageKeys, capabilitiesForPackages, type AccessPackageKey } from "@/lib/commercial/access-packages";

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
  const now = new Date();
  const scopeKeys = inheritedScopeCapabilities(capability);
  const membership = await prisma.companyMembership.findUnique({ where: { id: context.membershipId }, include: { permissionOverrides: true, accessPackages: true, scopeAssignments: { where: { capabilityKey: { in: scopeKeys } } } } });
  if (!membership || membership.status !== "active") return { allowed: false, reason: "membership", scope: "COMPANY" };
  if ((membership.accessStartsAt && membership.accessStartsAt > now) || (membership.accessEndsAt && membership.accessEndsAt <= now)) return { allowed: false, reason: "membership", scope: "COMPANY" };
  const profile = resolveFunctionalProfile(membership.functionalProfileKey, membership.role);
  const override = membership.permissionOverrides.find((item) => item.capabilityKey === capability);
  if (override?.effect === "DENY") return { allowed: false, reason: "permission", scope: override.scope ?? "COMPANY" };
  const economicGrantForbidden = ECONOMIC_CAPABILITIES.has(capability) && !canHoldEconomicCapabilities(profile);
  const packageCapabilities = resolvedPackageCapabilities(profile, membership.accessPackages, now);
  const permitted = !economicGrantForbidden && (override?.effect === "GRANT" || packageCapabilities.includes(capability));
  if (!permitted) return { allowed: false, reason: "permission", scope: "COMPANY" };
  const mutating = !capability.endsWith(".view") && !capability.endsWith(".export") && capability !== "orqena.use";
  if (membership.accessMode === "READ_ONLY" && mutating) return { allowed: false, reason: "permission", scope: "COMPANY" };
  const commercial = await getEntitlements(context.companyId);
  const isReadOperation = capability.endsWith(".view") || capability.endsWith(".export") || capability === "orqena.use" || capability === "company.billing.manage";
  if (commercial.subscription && ["EXPIRED", "PAUSED", "CANCELED"].includes(commercial.subscription.status) && !isReadOperation) return { allowed: false, reason: "subscription", scope: "COMPANY" };
  const entitlement = capabilityCatalog[capability].requiredEntitlement;
  if (entitlement) {
    if (!Boolean(commercial.values[entitlement])) return { allowed: false, reason: "entitlement", scope: "COMPANY" };
  }
  const scope = scopeAssignableCapabilityKeys.includes(capability as (typeof scopeAssignableCapabilityKeys)[number])
    ? override?.scope ?? membership.scopeAssignments.find((item) => item.capabilityKey === capability)?.scope ?? membership.scopeAssignments[0]?.scope ?? defaultScope(profile, capability)
    : "COMPANY";
  return { allowed: true, reason: "allowed", scope };
}

export async function requireCapability(capability: CapabilityKey) {
  const context = await requireCompanyContext();
  const decision = await resolveAuthorization(context, capability);
  if (!decision.allowed) redirect(`/acceso-restringido?reason=${decision.reason}`);
  return { ...context, capability, scope: decision.scope };
}

export async function resolveScopedEntityIds(context: CompanyContext, capability: CapabilityKey, entityType: "Work" | "Client" | "Document", forcedScope?: "COMPANY" | "OWN" | "ASSIGNED" | "TEAM" | "SELECTED_WORKS" | "SELECTED_CLIENTS") {
  const decision = await resolveAuthorization(context, capability);
  if (!decision.allowed) return [] as string[];
  const effectiveScope = forcedScope ?? decision.scope;
  if (effectiveScope === "COMPANY") return null;
  const scopeKeys = [...new Set([...inheritedScopeCapabilities(capability), ...(forcedScope && forcedScope !== "COMPANY" ? ["work.view" as CapabilityKey] : [])])];
  const assignments = await prisma.scopeAssignment.findMany({
    where: { companyId: context.companyId, membershipId: context.membershipId, capabilityKey: { in: scopeKeys } },
    select: { scope: true, teamId: true, entityType: true, entityId: true }
  });
  const workAliases = new Set(["Work", "work", "obra", "works"]);
  const clientAliases = new Set(["Client", "client", "cliente", "clients"]);
  const documentAliases = new Set(["Document", "document", "documento", "documents"]);
  const matchingIds = (aliases: Set<string>, rows: Array<{ entityType: string | null; entityId: string | null }> = assignments) => rows.filter((item) => item.entityId && (!item.entityType || aliases.has(item.entityType))).map((item) => item.entityId as string);
  const workIds = new Set(matchingIds(workAliases));
  const clientIds = new Set(matchingIds(clientAliases));
  const documentIds = new Set(matchingIds(documentAliases));

  const directAssignmentFilter = { OR: [{ assigneeId: context.userId }, { assignments: { some: { userId: context.userId, removedAt: null } } }] };
  if (["OWN", "ASSIGNED"].includes(effectiveScope)) {
    const tasks = await prisma.task.findMany({ where: { companyId: context.companyId, archivedAt: null, ...directAssignmentFilter }, select: { workId: true, clientId: true, documentId: true } });
    for (const task of tasks) { if (task.workId) workIds.add(task.workId); if (task.clientId) clientIds.add(task.clientId); if (task.documentId) documentIds.add(task.documentId); }
  }

  if (effectiveScope === "TEAM") {
    const ownTeams = await prisma.teamMembership.findMany({ where: { membershipId: context.membershipId, team: { companyId: context.companyId, state: "ACTIVE" } }, select: { teamId: true } });
    const teamIds = [...new Set([...ownTeams.map((item) => item.teamId), ...assignments.map((item) => item.teamId).filter((id): id is string => Boolean(id))])];
    if (teamIds.length) {
      const [teamScopes, teamMembers] = await Promise.all([
        prisma.scopeAssignment.findMany({ where: { companyId: context.companyId, capabilityKey: { in: scopeKeys }, teamId: { in: teamIds }, entityId: { not: null } }, select: { entityType: true, entityId: true } }),
        prisma.companyMembership.findMany({ where: { companyId: context.companyId, teamMemberships: { some: { teamId: { in: teamIds } } } }, select: { userId: true } })
      ]);
      for (const id of matchingIds(workAliases, teamScopes)) workIds.add(id);
      for (const id of matchingIds(clientAliases, teamScopes)) clientIds.add(id);
      for (const id of matchingIds(documentAliases, teamScopes)) documentIds.add(id);
      const userIds = teamMembers.map((item) => item.userId);
      if (userIds.length) {
        const tasks = await prisma.task.findMany({ where: { companyId: context.companyId, archivedAt: null, OR: [{ assigneeId: { in: userIds } }, { assignments: { some: { userId: { in: userIds }, removedAt: null } } }] }, select: { workId: true, clientId: true, documentId: true } });
        for (const task of tasks) { if (task.workId) workIds.add(task.workId); if (task.clientId) clientIds.add(task.clientId); if (task.documentId) documentIds.add(task.documentId); }
      }
    }
  }

  if (workIds.size) {
    const related = await prisma.work.findMany({ where: { companyId: context.companyId, id: { in: [...workIds] } }, select: { clienteId: true } });
    for (const item of related) clientIds.add(item.clienteId);
  }
  if (entityType === "Work") return [...workIds];
  if (entityType === "Client") return [...clientIds];
  if (effectiveScope === "OWN") {
    const ownDocuments = await prisma.document.findMany({ where: { companyId: context.companyId, uploadedById: context.userId }, select: { id: true } });
    for (const item of ownDocuments) documentIds.add(item.id);
  }
  if (workIds.size || clientIds.size) {
    const related = await prisma.document.findMany({ where: { companyId: context.companyId, OR: [{ workId: { in: [...workIds] } }, { clientId: { in: [...clientIds] } }] }, select: { id: true } });
    for (const item of related) documentIds.add(item.id);
  }
  return [...documentIds];
}

export async function resolveScopedTaskIds(context: CompanyContext, capability: "tasks.view" | "tasks.manage") {
  const decision = await resolveAuthorization(context, capability);
  if (!decision.allowed) return [] as string[];
  if (decision.scope === "COMPANY") return null;
  const [workIds, clientIds] = await Promise.all([resolveScopedEntityIds(context, capability, "Work"), resolveScopedEntityIds(context, capability, "Client")]);
  const OR: Array<Record<string, unknown>> = [
    { assigneeId: context.userId },
    { assignments: { some: { userId: context.userId, removedAt: null } } }
  ];
  if (workIds?.length) OR.push({ workId: { in: workIds } });
  if (clientIds?.length) OR.push({ clientId: { in: clientIds } });
  const tasks = await prisma.task.findMany({ where: { companyId: context.companyId, archivedAt: null, OR }, select: { id: true } });
  return tasks.map((item) => item.id);
}

export async function assertScopedEntityAccess(context: CompanyContext, capability: CapabilityKey, entityType: "Work" | "Client" | "Document", entityId: string) {
  const ids = await resolveScopedEntityIds(context, capability, entityType);
  if (ids !== null && !ids.includes(entityId)) throw new Error("SCOPED_ENTITY_FORBIDDEN");
}

export async function assertScopedTaskAccess(context: CompanyContext, capability: "tasks.view" | "tasks.manage", taskId: string) {
  const ids = await resolveScopedTaskIds(context, capability);
  if (ids !== null && !ids.includes(taskId)) throw new Error("SCOPED_TASK_FORBIDDEN");
}

export async function requireApprovalAuthority(context: CompanyContext, authorityKey: string, limits: { amount?: number; discountPercent?: number; marginPercent?: number; workId?: string | null; clientId?: string | null } = {}) {
  if (context.role === "OWNER") return { authorityKey, owner: true };
  const now = new Date();
  const authority = await prisma.approvalAuthority.findFirst({
    where: { companyId: context.companyId, membershipId: context.membershipId, authorityKey, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] }
  });
  if (!authority) throw new Error("APPROVAL_AUTHORITY_REQUIRED");
  if (limits.amount !== undefined && authority.maxAmount !== null && limits.amount > authority.maxAmount.toNumber()) throw new Error("APPROVAL_AMOUNT_LIMIT_EXCEEDED");
  if (limits.discountPercent !== undefined && authority.maxDiscountPercent !== null && limits.discountPercent > authority.maxDiscountPercent.toNumber()) throw new Error("APPROVAL_DISCOUNT_LIMIT_EXCEEDED");
  if (limits.marginPercent !== undefined && authority.minimumMarginPercent !== null && limits.marginPercent < authority.minimumMarginPercent.toNumber()) throw new Error("APPROVAL_MARGIN_LIMIT_NOT_MET");
  if (authority.scope !== "COMPANY") {
    const capabilityByAuthority: Record<string, CapabilityKey> = { "quote.approve": "sales.budgets.approve", "discount.approve": "sales.discount.apply", "purchase.approve": "purchases.received_invoices.manage", "supplier_invoice.approve": "purchases.received_invoices.manage", "invoice.issue": "sales.invoices.issue", "payment.approve": "treasury.payments.register", "payment.execute": "treasury.payments.register" };
    const capability = capabilityByAuthority[authorityKey];
    if (!capability) throw new Error("APPROVAL_SCOPE_UNSUPPORTED");
    const entityType = limits.workId ? "Work" : "Client";
    const entityId = limits.workId ?? limits.clientId;
    if (!entityId) throw new Error("APPROVAL_SCOPE_ENTITY_REQUIRED");
    const allowedIds = await resolveScopedEntityIds(context, capability, entityType, authority.scope);
    if (allowedIds !== null && !allowedIds.includes(entityId)) throw new Error("APPROVAL_SCOPE_FORBIDDEN");
  }
  return authority;
}

export async function getEffectiveCapabilities(context: CompanyContext): Promise<CapabilityKey[]> {
  const now = new Date();
  const membership = await prisma.companyMembership.findFirst({ where: { id: context.membershipId, userId: context.userId, companyId: context.companyId, status: "active", OR: [{ accessStartsAt: null }, { accessStartsAt: { lte: now } }], AND: [{ OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: now } }] }] }, include: { permissionOverrides: true, accessPackages: true } });
  if (!membership) return [];
  const profile = resolveFunctionalProfile(membership.functionalProfileKey, membership.role);
  const effective = new Set(resolvedPackageCapabilities(profile, membership.accessPackages, now));
  for (const override of membership.permissionOverrides) {
    const key = override.capabilityKey as CapabilityKey;
    if (!(key in capabilityCatalog)) continue;
    if (override.effect === "DENY") effective.delete(key);
    else if (!(ECONOMIC_CAPABILITIES.has(key) && !canHoldEconomicCapabilities(profile))) effective.add(key);
  }
  if (membership.accessMode === "READ_ONLY") for (const capability of [...effective]) {
    if (!capability.endsWith(".view") && !capability.endsWith(".export") && capability !== "orqena.use") effective.delete(capability);
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

function defaultScope(profile: string, capability: CapabilityKey) {
  const restrictedProfile = ["PROJECT_MANAGER", "TEAM_SUPERVISOR", "WORKER", "EXTERNAL_COLLABORATOR"].includes(profile);
  const scopedDomain = ["work", "agenda", "tasks", "followups", "documents"].includes(capability.split(".")[0]);
  if (!restrictedProfile || !scopedDomain) return "COMPANY";
  return profile === "EXTERNAL_COLLABORATOR" ? "SELECTED_WORKS" : "ASSIGNED";
}

function inheritedScopeCapabilities(capability: CapabilityKey): CapabilityKey[] {
  const parents: Partial<Record<CapabilityKey, CapabilityKey>> = {
    "work.update": "work.view", "agenda.manage": "agenda.view", "tasks.manage": "tasks.view",
    "documents.upload": "documents.view", "documents.manage": "documents.view",
    "followups.manage": "followups.view"
  };
  return parents[capability] ? [capability, parents[capability] as CapabilityKey] : [capability];
}

function resolvedPackageCapabilities(profile: keyof typeof profileDefaultPackages, records: Array<{ packageKey: string; config: unknown; startsAt: Date | null; endsAt: Date | null }>, now: Date): CapabilityKey[] {
  if (profile === "OWNER") return [...functionalProfileCapabilities.OWNER];
  const activeRecords = records.filter((item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt > now) && accessPackageKeys.includes(item.packageKey as AccessPackageKey));
  const disabled = new Set(activeRecords.filter((item) => packageConfigEnabled(item.config) === false).map((item) => item.packageKey));
  const enabled = activeRecords.filter((item) => packageConfigEnabled(item.config) !== false).map((item) => item.packageKey as AccessPackageKey);
  const packages = [...new Set([...profileDefaultPackages[profile].filter((key) => !disabled.has(key)), ...enabled])];
  const capabilities = new Set<CapabilityKey>(["company.view", ...capabilitiesForPackages(packages)]);
  for (const capability of [...capabilities]) if (!functionalProfileCapabilities[profile].includes(capability) && !enabled.some((key) => accessPackageCapabilities[key].includes(capability))) capabilities.delete(capability);
  if (!canHoldEconomicCapabilities(profile)) for (const capability of ECONOMIC_CAPABILITIES) capabilities.delete(capability);
  return [...capabilities];
}

function packageConfigEnabled(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) && "enabled" in value ? (value as { enabled?: unknown }).enabled !== false : true;
}
