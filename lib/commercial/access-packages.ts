import type { CapabilityKey } from "@/lib/commercial/catalog";

export const accessPackageKeys = [
  "CRM_CORE", "SALES_QUOTES", "SALES_PRICING", "SALES_APPROVAL", "SALES_INVOICING",
  "PROCUREMENT", "SUPPLIER_INVOICING", "ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE",
  "TREASURY", "BANKING", "TAX", "PROJECT_BUDGET_CONTROL", "INTERNAL_COSTS", "MARGIN",
  "PROFITABILITY", "OPERATIONS", "TEAM_SUPERVISION", "OPERATIONAL_DOCUMENTS",
  "COMMERCIAL_DOCUMENTS", "FINANCIAL_DOCUMENTS", "AUDIT_READ", "ACCESS_GOVERNANCE",
  "ORQENA_QUERY", "ORQENA_ACTIONS"
] as const;

export type AccessPackageKey = (typeof accessPackageKeys)[number];

export const accessPackageLabels: Record<AccessPackageKey, string> = {
  CRM_CORE: "Clientes y contactos", SALES_QUOTES: "Presupuestos", SALES_PRICING: "Precios de venta",
  SALES_APPROVAL: "Aprobaciones comerciales", SALES_INVOICING: "Facturación emitida", PROCUREMENT: "Compras y proveedores",
  SUPPLIER_INVOICING: "Facturación recibida", ACCOUNTS_RECEIVABLE: "Cobros", ACCOUNTS_PAYABLE: "Pagos",
  TREASURY: "Tesorería", BANKING: "Banca", TAX: "Fiscalidad", PROJECT_BUDGET_CONTROL: "Control presupuestario del trabajo",
  INTERNAL_COSTS: "Costes internos", MARGIN: "Márgenes", PROFITABILITY: "Rentabilidad", OPERATIONS: "Operaciones",
  TEAM_SUPERVISION: "Supervisión de equipo", OPERATIONAL_DOCUMENTS: "Documentos operativos",
  COMMERCIAL_DOCUMENTS: "Documentos comerciales", FINANCIAL_DOCUMENTS: "Documentos financieros",
  AUDIT_READ: "Auditoría de lectura", ACCESS_GOVERNANCE: "Gobierno de accesos", ORQENA_QUERY: "Consultas con Orqena",
  ORQENA_ACTIONS: "Acciones confirmadas con Orqena"
};

export const accessPackageCapabilities: Record<AccessPackageKey, readonly CapabilityKey[]> = {
  CRM_CORE: ["company.view", "clients.view", "clients.create", "clients.update", "followups.view", "followups.manage", "agenda.view", "agenda.manage", "tasks.view", "tasks.manage"],
  SALES_QUOTES: ["sales.budgets.view", "sales.budgets.create", "sales.budgets.update", "sales.budgets.send"],
  SALES_PRICING: ["sales.pricing.view", "sales.discount.apply"],
  SALES_APPROVAL: ["sales.budgets.approve"],
  SALES_INVOICING: ["sales.invoices.view", "sales.invoices.create", "sales.invoices.issue", "sales.invoices.send", "sales.invoices.void"],
  PROCUREMENT: ["purchases.suppliers.view", "purchases.suppliers.manage", "purchase_cost.view"],
  SUPPLIER_INVOICING: ["purchases.received_invoices.view", "purchases.received_invoices.manage"],
  ACCOUNTS_RECEIVABLE: ["sales.invoices.view", "treasury.collections.register"],
  ACCOUNTS_PAYABLE: ["purchases.received_invoices.view", "treasury.payments.register"],
  TREASURY: ["treasury.view", "treasury.manage"], BANKING: ["banking.view"], TAX: ["tax.view"],
  PROJECT_BUDGET_CONTROL: ["project_budget_control.view"], INTERNAL_COSTS: ["internal_cost.view"],
  MARGIN: ["margin_percent.view", "margin_amount.view"], PROFITABILITY: ["profitability.view", "reports.view"],
  OPERATIONS: ["company.view", "work.view", "work.create", "work.update", "agenda.view", "agenda.manage", "tasks.view", "tasks.manage"],
  TEAM_SUPERVISION: ["company.view", "company.members.view", "work.view", "work.update", "agenda.view", "agenda.manage", "tasks.view", "tasks.manage"],
  OPERATIONAL_DOCUMENTS: ["documents.view", "documents.upload", "documents.manage"],
  COMMERCIAL_DOCUMENTS: ["documents.view", "documents.upload"], FINANCIAL_DOCUMENTS: ["documents.view", "documents.upload", "documents.manage"],
  AUDIT_READ: ["company.view", "documents.view", "reports.view", "reports.export"],
  ACCESS_GOVERNANCE: ["company.members.view", "company.members.invite", "company.members.update", "company.members.remove", "company.teams.manage"],
  ORQENA_QUERY: ["orqena.use"], ORQENA_ACTIONS: ["orqena.use", "orqena.execute", "orqena.memory.manage"]
};

export function capabilitiesForPackages(packages: readonly AccessPackageKey[]) {
  return [...new Set(packages.flatMap((key) => accessPackageCapabilities[key]))];
}
