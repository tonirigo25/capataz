import type { CompanyRole } from "@prisma/client";
import { capabilityCatalog, type CapabilityKey } from "@/lib/commercial/catalog";

export const functionalProfileKeys = ["OWNER", "PURCHASING_MANAGER", "GENERAL_MANAGER", "ADMINISTRATIVE", "SALES", "WORK_MANAGER", "WORKER", "VIEWER", "EXTERNAL_COLLABORATOR"] as const;
export type FunctionalProfileKey = typeof functionalProfileKeys[number];

export const ECONOMIC_CAPABILITIES = new Set<CapabilityKey>([
  "sales.budgets.view", "sales.budgets.create", "sales.budgets.update", "sales.budgets.approve", "sales.budgets.send",
  "sales.invoices.view", "sales.invoices.create", "sales.invoices.issue", "sales.invoices.void", "sales.invoices.send",
  "purchases.suppliers.view", "purchases.suppliers.manage", "purchases.received_invoices.view", "purchases.received_invoices.manage",
  "treasury.view", "treasury.manage", "treasury.payments.register", "treasury.collections.register", "reports.view", "reports.export"
]);

const all = Object.keys(capabilityCatalog) as CapabilityKey[];
const operational = all.filter((key) => !ECONOMIC_CAPABILITIES.has(key) && !key.startsWith("company.billing") && !key.includes("members."));
const readOperational = operational.filter((key) => key.endsWith(".view") || key === "orqena.use");

export const functionalProfileCapabilities: Record<FunctionalProfileKey, readonly CapabilityKey[]> = {
  OWNER: all,
  PURCHASING_MANAGER: all.filter((key) => ECONOMIC_CAPABILITIES.has(key) || ["company.view", "clients.view", "work.view", "documents.view", "documents.upload", "agenda.view", "agenda.manage", "orqena.use", "orqena.execute"].includes(key)),
  GENERAL_MANAGER: operational.filter((key) => !key.startsWith("company.") || key === "company.view" || key === "company.members.view"),
  ADMINISTRATIVE: ["company.view", "clients.view", "clients.create", "clients.update", "agenda.view", "agenda.manage", "tasks.view", "tasks.manage", "followups.view", "followups.manage", "documents.view", "documents.upload", "orqena.use"],
  SALES: ["company.view", "clients.view", "clients.create", "clients.update", "work.view", "agenda.view", "agenda.manage", "tasks.view", "tasks.manage", "followups.view", "followups.manage", "documents.view", "orqena.use"],
  WORK_MANAGER: ["company.view", "clients.view", "work.view", "work.update", "agenda.view", "agenda.manage", "tasks.view", "tasks.manage", "documents.view", "documents.upload", "orqena.use"],
  WORKER: ["company.view", "work.view", "work.update", "agenda.view", "tasks.view", "tasks.manage", "documents.view", "documents.upload", "orqena.use"],
  VIEWER: readOperational,
  EXTERNAL_COLLABORATOR: ["company.view", "work.view", "agenda.view", "documents.view", "documents.upload", "orqena.use"]
};

export const functionalProfileLabels: Record<FunctionalProfileKey, string> = {
  OWNER: "Propietario", PURCHASING_MANAGER: "Jefe de compras", GENERAL_MANAGER: "Gerente", ADMINISTRATIVE: "Administrativo", SALES: "Comercial", WORK_MANAGER: "Responsable de trabajo", WORKER: "Empleado", VIEWER: "Solo lectura", EXTERNAL_COLLABORATOR: "Colaborador externo"
};

export const legacyRoleProfile: Record<CompanyRole, FunctionalProfileKey> = { OWNER: "OWNER", ADMIN: "ADMINISTRATIVE", MANAGER: "GENERAL_MANAGER", MEMBER: "WORKER", VIEWER: "VIEWER" };

export const sectorProfileLabels: Record<string, Partial<Record<FunctionalProfileKey, string>>> = {
  construction: { WORK_MANAGER: "Jefe de obra", WORKER: "Operario" },
  installations: { WORK_MANAGER: "Responsable de instalación", WORKER: "Técnico" },
  professional_services: { WORK_MANAGER: "Responsable de proyecto", WORKER: "Profesional" },
  repair_workshop: { WORK_MANAGER: "Jefe de taller", WORKER: "Técnico" },
  hospitality: { WORK_MANAGER: "Responsable de servicio", WORKER: "Empleado" },
  consulting: { WORK_MANAGER: "Responsable de proyecto", WORKER: "Consultor" }
};

export function resolveFunctionalProfile(value: string | null | undefined, role: CompanyRole): FunctionalProfileKey {
  return functionalProfileKeys.includes(value as FunctionalProfileKey) ? value as FunctionalProfileKey : legacyRoleProfile[role];
}

export function canHoldEconomicCapabilities(profile: FunctionalProfileKey) {
  return profile === "OWNER" || profile === "PURCHASING_MANAGER";
}
