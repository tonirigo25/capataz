import type { CompanyRole } from "@prisma/client";
import { capabilityCatalog, type CapabilityKey } from "@/lib/commercial/catalog";
import { capabilitiesForPackages, type AccessPackageKey } from "@/lib/commercial/access-packages";

export const functionalProfileKeys = ["OWNER", "GENERAL_MANAGER", "SALES_MANAGER", "SALES", "ADMINISTRATIVE", "FINANCE", "PROCUREMENT_MANAGER", "PROJECT_MANAGER", "TEAM_SUPERVISOR", "WORKER", "EXTERNAL_COLLABORATOR", "ADVISOR_AUDITOR"] as const;
export type FunctionalProfileKey = (typeof functionalProfileKeys)[number];

export const profileAliases: Record<string, FunctionalProfileKey> = {
  PURCHASING_MANAGER: "PROCUREMENT_MANAGER", WORK_MANAGER: "PROJECT_MANAGER", VIEWER: "ADVISOR_AUDITOR"
};

export const profileDefaultPackages: Record<FunctionalProfileKey, readonly AccessPackageKey[]> = {
  OWNER: ["CRM_CORE", "SALES_QUOTES", "SALES_PRICING", "SALES_APPROVAL", "SALES_INVOICING", "PROCUREMENT", "SUPPLIER_INVOICING", "ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE", "TREASURY", "BANKING", "TAX", "PROJECT_BUDGET_CONTROL", "INTERNAL_COSTS", "MARGIN", "PROFITABILITY", "OPERATIONS", "TEAM_SUPERVISION", "OPERATIONAL_DOCUMENTS", "COMMERCIAL_DOCUMENTS", "FINANCIAL_DOCUMENTS", "AUDIT_READ", "ACCESS_GOVERNANCE", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  GENERAL_MANAGER: ["CRM_CORE", "SALES_QUOTES", "SALES_APPROVAL", "OPERATIONS", "TEAM_SUPERVISION", "OPERATIONAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  SALES_MANAGER: ["CRM_CORE", "SALES_QUOTES", "SALES_PRICING", "SALES_APPROVAL", "COMMERCIAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  SALES: ["CRM_CORE", "SALES_QUOTES", "SALES_PRICING", "COMMERCIAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  ADMINISTRATIVE: ["CRM_CORE", "OPERATIONAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  FINANCE: ["SALES_INVOICING", "SUPPLIER_INVOICING", "ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE", "TREASURY", "TAX", "FINANCIAL_DOCUMENTS", "ORQENA_QUERY"],
  PROCUREMENT_MANAGER: ["PROCUREMENT", "SUPPLIER_INVOICING", "ACCOUNTS_PAYABLE", "OPERATIONAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  PROJECT_MANAGER: ["OPERATIONS", "TEAM_SUPERVISION", "PROJECT_BUDGET_CONTROL", "OPERATIONAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  TEAM_SUPERVISOR: ["OPERATIONS", "TEAM_SUPERVISION", "OPERATIONAL_DOCUMENTS", "ORQENA_QUERY", "ORQENA_ACTIONS"],
  WORKER: ["OPERATIONS", "OPERATIONAL_DOCUMENTS", "ORQENA_QUERY"],
  EXTERNAL_COLLABORATOR: ["OPERATIONS", "OPERATIONAL_DOCUMENTS"],
  ADVISOR_AUDITOR: ["AUDIT_READ", "FINANCIAL_DOCUMENTS", "ORQENA_QUERY"]
};

const all = Object.keys(capabilityCatalog) as CapabilityKey[];
export const functionalProfileCapabilities = Object.fromEntries(functionalProfileKeys.map((profile) => {
  if (profile === "OWNER") return [profile, all];
  const capabilities = new Set<CapabilityKey>(["company.view", ...capabilitiesForPackages(profileDefaultPackages[profile])]);
  if (["PROJECT_MANAGER", "TEAM_SUPERVISOR", "WORKER", "EXTERNAL_COLLABORATOR"].includes(profile)) for (const key of ["clients.view", "clients.create", "clients.update", "work.create"] as CapabilityKey[]) capabilities.delete(key);
  if (profile === "ADVISOR_AUDITOR") for (const key of [...capabilities]) if (!key.endsWith(".view") && !key.endsWith(".export") && key !== "orqena.use" && key !== "company.view") capabilities.delete(key);
  return [profile, [...capabilities]];
})) as unknown as Record<FunctionalProfileKey, readonly CapabilityKey[]>;

export const ECONOMIC_CAPABILITIES = new Set<CapabilityKey>([
  "sales.budgets.view", "sales.budgets.create", "sales.budgets.update", "sales.budgets.approve", "sales.budgets.send",
  "sales.pricing.view", "sales.discount.apply", "sales.invoices.view", "sales.invoices.create", "sales.invoices.issue",
  "sales.invoices.send", "sales.invoices.void", "purchases.suppliers.view", "purchases.suppliers.manage",
  "purchases.received_invoices.view", "purchases.received_invoices.manage", "treasury.collections.register",
  "treasury.payments.register", "purchase_cost.view", "project_budget_control.view", "internal_cost.view",
  "margin_percent.view", "margin_amount.view", "profitability.view", "reports.view", "reports.export",
  "treasury.view", "treasury.manage", "banking.view", "tax.view"
]);

export const functionalProfileLabels: Record<FunctionalProfileKey, string> = {
  OWNER: "Propietario", GENERAL_MANAGER: "Dirección general", SALES_MANAGER: "Responsable comercial", SALES: "Comercial",
  ADMINISTRATIVE: "Administración", FINANCE: "Finanzas y contabilidad", PROCUREMENT_MANAGER: "Compras y aprovisionamiento",
  PROJECT_MANAGER: "Responsable de proyecto", TEAM_SUPERVISOR: "Supervisor de equipo", WORKER: "Profesional",
  EXTERNAL_COLLABORATOR: "Colaborador externo", ADVISOR_AUDITOR: "Asesor o auditor"
};

export const legacyRoleProfile: Record<CompanyRole, FunctionalProfileKey> = { OWNER: "OWNER", ADMIN: "ADMINISTRATIVE", MANAGER: "GENERAL_MANAGER", MEMBER: "WORKER", VIEWER: "ADVISOR_AUDITOR" };

export const sectorProfileLabels: Record<string, Partial<Record<FunctionalProfileKey, string>>> = {
  construction: { PROJECT_MANAGER: "Jefe de obra", TEAM_SUPERVISOR: "Encargado", WORKER: "Operario" },
  installations: { PROJECT_MANAGER: "Responsable de instalación", TEAM_SUPERVISOR: "Coordinador", WORKER: "Técnico" },
  professional_services: { PROJECT_MANAGER: "Responsable de proyecto", TEAM_SUPERVISOR: "Coordinador", WORKER: "Profesional" },
  repair_workshop: { PROJECT_MANAGER: "Jefe de taller", TEAM_SUPERVISOR: "Encargado", WORKER: "Técnico" },
  hospitality: { PROJECT_MANAGER: "Responsable de servicio", TEAM_SUPERVISOR: "Supervisor", WORKER: "Empleado" },
  consulting: { PROJECT_MANAGER: "Responsable de proyecto", TEAM_SUPERVISOR: "Coordinador", WORKER: "Consultor" }
};

export function resolveFunctionalProfile(value: string | null | undefined, role: CompanyRole): FunctionalProfileKey {
  if (value && value in profileAliases) return profileAliases[value];
  return functionalProfileKeys.includes(value as FunctionalProfileKey) ? value as FunctionalProfileKey : legacyRoleProfile[role];
}

export function canHoldEconomicCapabilities(profile: FunctionalProfileKey) {
  return !["WORKER", "EXTERNAL_COLLABORATOR"].includes(profile);
}

export function canUseAccessPackages(profile: FunctionalProfileKey, packages: readonly AccessPackageKey[]) {
  if (packages.includes("ACCESS_GOVERNANCE") && profile !== "OWNER") return false;
  return canHoldEconomicCapabilities(profile) || !capabilitiesForPackages(packages).some((key) => ECONOMIC_CAPABILITIES.has(key));
}
