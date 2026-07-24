import type { ScopeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CompanyContext } from "@/lib/auth/session";
import { getEffectiveCapabilities } from "@/lib/commercial/authorization";
import { accessPackageKeys, capabilitiesForPackages, type AccessPackageKey } from "@/lib/commercial/access-packages";
import { canHoldEconomicCapabilities, ECONOMIC_CAPABILITIES, functionalProfileCapabilities, functionalProfileLabels, profileDefaultPackages, resolveFunctionalProfile, sectorProfileLabels } from "@/lib/commercial/functional-profiles";
import { createActions, primaryNavigation, secondaryNavigation, type ProductDestination, type ProductNavigationGroup } from "@/lib/product-navigation";

export type PortalManifest = {
  version: number;
  profile: string;
  profileLabel: string;
  readOnly: boolean;
  safeHome: string;
  navigation: ProductDestination[];
  navigationGroups: ProductNavigationGroup[];
  mobileNavigation: ProductDestination[];
  homeWidgets: string[];
  quickActions: { href: string; label: string; capability?: string }[];
  searchableDomains: string[];
  notificationDomains: string[];
  orqenaTools: string[];
  documentClasses: Array<"OPERATIONAL" | "COMMERCIAL" | "FINANCIAL" | "RESTRICTED">;
  settingsSections: string[];
  packages: AccessPackageKey[];
  scopes: { capabilityKey: string; scope: ScopeType; entityType?: string | null; entityId?: string | null }[];
  approvalAuthorities: { key: string; maxAmount?: string; maxDiscountPercent?: string; minimumMarginPercent?: string; scope: ScopeType; endsAt?: string }[];
  fieldVisibility: Record<string, boolean>;
  capabilityHash: string;
};

const homeWidgets: Record<string, string[]> = {
  OWNER: ["decisions", "business", "operations", "economy", "team"], GENERAL_MANAGER: ["operations", "risks", "workload", "team", "approvals"],
  SALES_MANAGER: ["pipeline", "quotes", "followups", "sales-team", "approvals"], SALES: ["clients", "quotes", "followups", "agenda", "tasks"],
  ADMINISTRATIVE: ["agenda", "pending-data", "documents", "followups", "tasks"], FINANCE: ["collections", "payments", "invoices", "due-dates", "treasury", "incidents"],
  PROCUREMENT_MANAGER: ["requests", "suppliers", "orders", "supplier-invoices", "due-dates", "incidents"], PROJECT_MANAGER: ["work", "blockers", "team", "agenda", "tasks"],
  TEAM_SUPERVISOR: ["daily-plan", "team", "progress", "incidents", "materials"], WORKER: ["tasks", "agenda", "assigned-work", "progress"],
  EXTERNAL_COLLABORATOR: ["assignments", "deliveries", "documents"], ADVISOR_AUDITOR: ["assigned-reports", "documents", "period"]
};

export async function buildPortalManifest(context: CompanyContext): Promise<PortalManifest> {
  const now = new Date();
  const [membership, company, capabilities] = await Promise.all([
    prisma.companyMembership.findFirstOrThrow({ where: { id: context.membershipId, companyId: context.companyId, userId: context.userId }, include: { user: { select: { emailNormalized: true } }, accessPackages: true, scopeAssignments: true, approvalAuthorities: true, fieldVisibilityPolicies: true } }),
    prisma.company.findUniqueOrThrow({ where: { id: context.companyId }, select: { sectorKey: true } }),
    getEffectiveCapabilities(context)
  ]);
  const profile = resolveFunctionalProfile(membership.functionalProfileKey, membership.role);
  const pendingInvitation = membership.status === "pending_owner_approval" ? await prisma.invitation.findFirst({ where: { companyId: context.companyId, emailNormalized: membership.user.emailNormalized, status: "PENDING_OWNER_APPROVAL" }, orderBy: { createdAt: "desc" } }) : null;
  const pendingPackages = Array.isArray(pendingInvitation?.accessPackageKeys) ? pendingInvitation.accessPackageKeys.filter((key): key is AccessPackageKey => typeof key === "string" && accessPackageKeys.includes(key as AccessPackageKey)) : [];
  const pendingScopes = jsonObjects(pendingInvitation?.scopeTemplate).filter((item) => typeof item.capabilityKey === "string" && typeof item.scope === "string");
  const pendingAuthorities = jsonObjects(pendingInvitation?.approvalTemplate).filter((item) => typeof item.authorityKey === "string");
  const pendingFields = asRecord(pendingInvitation?.fieldVisibilityTemplate);
  const previewCapabilities = membership.status === "active" ? capabilities : [...new Set([...functionalProfileCapabilities[profile], ...capabilitiesForPackages(pendingPackages)])].filter((key) => !(ECONOMIC_CAPABILITIES.has(key) && !canHoldEconomicCapabilities(profile)));
  const capabilitySet = new Set<string>(previewCapabilities);
  const allowed = (item: { capability?: string }) => !item.capability || capabilitySet.has(item.capability);
  const navigation = primaryNavigation.filter(allowed);
  const navigationGroups = secondaryNavigation.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length);
  const orqena = { href: "/capataz", label: "Orqena", icon: "bot" as const, capability: "orqena.use" };
  if (allowed(orqena)) navigation.push(orqena);
  const preferredMobile = mobileRoutes(profile);
  const allNavigation = [...navigation, ...navigationGroups.flatMap((group) => group.items)];
  const mobileNavigation = preferredMobile.map((href) => allNavigation.find((item) => item.href === href)).filter((item): item is ProductDestination => Boolean(item)).slice(0, 4);
  const currentPackageRecords = membership.accessPackages.filter((item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt > now));
  const disabledPackages = new Set(currentPackageRecords.filter((item) => item.config && typeof item.config === "object" && !Array.isArray(item.config) && "enabled" in item.config && item.config.enabled === false).map((item) => item.packageKey));
  const grantedPackages = currentPackageRecords.filter((item) => !disabledPackages.has(item.packageKey)).map((item) => item.packageKey).filter((key): key is AccessPackageKey => accessPackageKeys.includes(key as AccessPackageKey));
  const packages = membership.status === "active"
    ? [...new Set([...profileDefaultPackages[profile].filter((key) => !disabledPackages.has(key)), ...grantedPackages])]
    : [...new Set([...profileDefaultPackages[profile], ...pendingPackages])];
  const fieldVisibility = defaultFieldVisibility(capabilitySet);
  for (const policy of membership.fieldVisibilityPolicies) fieldVisibility[policy.fieldKey] = policy.visible && fieldVisibility[policy.fieldKey] !== false;
  if (membership.status !== "active") for (const [fieldKey, visible] of Object.entries(pendingFields)) if (typeof visible === "boolean") fieldVisibility[fieldKey] = visible && fieldVisibility[fieldKey] !== false;
  const profileLabel = sectorProfileLabels[company.sectorKey ?? ""]?.[profile] ?? functionalProfileLabels[profile];
  const documentClasses: PortalManifest["documentClasses"] = [];
  if (packages.includes("OPERATIONAL_DOCUMENTS")) documentClasses.push("OPERATIONAL");
  if (packages.includes("COMMERCIAL_DOCUMENTS")) documentClasses.push("COMMERCIAL");
  if (packages.includes("FINANCIAL_DOCUMENTS")) documentClasses.push("FINANCIAL");
  if (profile === "OWNER") documentClasses.push("RESTRICTED");
  return {
    version: membership.accessVersion, profile, profileLabel, readOnly: membership.accessMode === "READ_ONLY", safeHome: navigation[0]?.href ?? "/acceso-restringido",
    navigation, navigationGroups, mobileNavigation, homeWidgets: homeWidgets[profile] ?? [],
    quickActions: createActions.filter(allowed).map(({ href, label, capability }) => ({ href, label, capability })),
    searchableDomains: domainsForCapabilities(previewCapabilities), notificationDomains: domainsForCapabilities(previewCapabilities),
    orqenaTools: capabilitySet.has("orqena.execute") ? ["query", "propose", "confirm"] : capabilitySet.has("orqena.use") ? ["query"] : [],
    documentClasses, settingsSections: profile === "OWNER" ? ["account", "company", "portal", "team", "access", "plan", "memory", "security", "integrations"] : ["account", "portal", "memory", "security"],
    packages, scopes: membership.status === "active" ? membership.scopeAssignments.map((item) => ({ capabilityKey: item.capabilityKey, scope: item.scope, entityType: item.entityType, entityId: item.entityId })) : pendingScopes.map((item) => ({ capabilityKey: String(item.capabilityKey), scope: String(item.scope) as ScopeType, entityType: typeof item.entityType === "string" ? item.entityType : null, entityId: typeof item.entityId === "string" ? item.entityId : null })),
    approvalAuthorities: membership.status === "active" ? membership.approvalAuthorities.filter((item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt > now)).map((item) => ({ key: item.authorityKey, maxAmount: item.maxAmount?.toString(), maxDiscountPercent: item.maxDiscountPercent?.toString(), minimumMarginPercent: item.minimumMarginPercent?.toString(), scope: item.scope, endsAt: item.endsAt?.toISOString() })) : pendingAuthorities.map((item) => ({ key: String(item.authorityKey), maxAmount: scalarString(item.maxAmount), maxDiscountPercent: scalarString(item.maxDiscountPercent), minimumMarginPercent: scalarString(item.minimumMarginPercent), scope: (typeof item.scope === "string" ? item.scope : "COMPANY") as ScopeType, endsAt: typeof item.endsAt === "string" ? item.endsAt : undefined })),
    fieldVisibility, capabilityHash: `${membership.accessVersion}:${previewCapabilities.slice().sort().join("|")}`
  };
}

function jsonObjects(value: unknown) { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []; }
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function scalarString(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : undefined; }

function mobileRoutes(profile: string) {
  if (profile === "WORKER") return ["/hoy", "/obras", "/tareas", "/capataz"];
  if (profile === "FINANCE") return ["/hoy", "/dinero", "/tesoreria", "/capataz"];
  if (["SALES", "SALES_MANAGER"].includes(profile)) return ["/hoy", "/clientes", "/presupuestos", "/capataz"];
  return ["/hoy", "/clientes", "/obras", "/capataz"];
}

function domainsForCapabilities(capabilities: string[]) {
  return [...new Set(capabilities.map((key) => key.split(".")[0]).filter((domain) => !["company", "orqena"].includes(domain)))];
}

function defaultFieldVisibility(capabilities: Set<string>): Record<string, boolean> {
  return {
    sale_price: capabilities.has("sales.pricing.view"), purchase_cost: capabilities.has("purchase_cost.view"),
    internal_cost: capabilities.has("internal_cost.view"), margin_percent: capabilities.has("margin_percent.view"),
    margin_amount: capabilities.has("margin_amount.view"), profit: capabilities.has("profitability.view"), treasury: capabilities.has("treasury.view"),
    banking: capabilities.has("banking.view"), tax: capabilities.has("tax.view")
  };
}
