export const entitlementKeys = ["multi_company", "advanced_permissions", "custom_roles", "team_management", "team_scopes", "orqena_chat", "orqena_actions", "orqena_memory", "document_extraction", "advanced_reports", "exports", "automations", "priority_support", "audit_log", "custom_branding", "api_access", "increased_storage", "max_members", "max_companies", "max_documents", "storage_bytes", "monthly_orqena_actions", "monthly_transcriptions", "max_automations"] as const;
export type EntitlementKey = typeof entitlementKeys[number];
type CapabilityMetadata = { domain: string; action: string; description: string; sensitivity: "normal" | "sensitive" | "critical"; requiredEntitlement?: EntitlementKey; supportsScope: boolean; confirmation: boolean; dependencies: string[] };

export const capabilityCatalog = {
  "company.view": meta("company", "view", "Ver la empresa", "normal"),
  "company.update": meta("company", "update", "Editar la empresa", "sensitive"),
  "company.billing.manage": meta("company", "billing.manage", "Gestionar plan y suscripción", "critical"),
  "company.members.view": meta("company", "members.view", "Ver miembros", "normal"),
  "company.members.invite": meta("company", "members.invite", "Invitar miembros", "sensitive", "team_management"),
  "company.members.update": meta("company", "members.update", "Cambiar miembros", "critical", "advanced_permissions"),
  "company.members.remove": meta("company", "members.remove", "Revocar miembros", "critical", "advanced_permissions", true),
  "company.teams.manage": meta("company", "teams.manage", "Gestionar equipos", "sensitive", "team_scopes"),
  "clients.view": scoped("clients", "view", "Ver clientes"),
  "clients.create": meta("clients", "create", "Crear clientes", "normal"),
  "clients.update": scoped("clients", "update", "Editar clientes"),
  "clients.archive": meta("clients", "archive", "Archivar clientes", "sensitive", undefined, true),
  "clients.export": meta("clients", "export", "Exportar clientes", "sensitive", "exports"),
  "work.view": scoped("work", "view", "Ver trabajo"),
  "work.create": meta("work", "create", "Crear trabajo", "normal"),
  "work.update": scoped("work", "update", "Editar trabajo"),
  "work.archive": meta("work", "archive", "Archivar trabajo", "sensitive", undefined, true),
  "sales.budgets.view": scoped("sales", "budgets.view", "Ver presupuestos"),
  "sales.budgets.create": meta("sales", "budgets.create", "Crear presupuestos", "normal"),
  "sales.budgets.update": meta("sales", "budgets.update", "Editar presupuestos", "normal"),
  "sales.budgets.approve": meta("sales", "budgets.approve", "Aprobar presupuestos", "sensitive", undefined, true),
  "sales.budgets.send": meta("sales", "budgets.send", "Preparar envío de presupuestos", "sensitive", undefined, true),
  "sales.invoices.view": scoped("sales", "invoices.view", "Ver facturas"),
  "sales.invoices.create": meta("sales", "invoices.create", "Crear facturas", "sensitive"),
  "sales.invoices.issue": meta("sales", "invoices.issue", "Emitir facturas", "critical", undefined, true),
  "sales.invoices.void": meta("sales", "invoices.void", "Anular facturas", "critical", undefined, true),
  "sales.invoices.send": meta("sales", "invoices.send", "Preparar envío de facturas", "sensitive", undefined, true),
  "purchases.suppliers.view": meta("purchases", "suppliers.view", "Ver proveedores", "normal"),
  "purchases.suppliers.manage": meta("purchases", "suppliers.manage", "Gestionar proveedores", "normal"),
  "purchases.received_invoices.view": meta("purchases", "received_invoices.view", "Ver facturas recibidas", "sensitive"),
  "purchases.received_invoices.manage": meta("purchases", "received_invoices.manage", "Gestionar facturas recibidas", "sensitive"),
  "treasury.view": meta("treasury", "view", "Ver tesorería", "sensitive"),
  "treasury.manage": meta("treasury", "manage", "Gestionar tesorería", "critical"),
  "treasury.payments.register": meta("treasury", "payments.register", "Registrar pagos", "sensitive"),
  "treasury.collections.register": meta("treasury", "collections.register", "Registrar cobros", "sensitive"),
  "documents.view": scoped("documents", "view", "Ver documentos"),
  "documents.upload": meta("documents", "upload", "Subir documentos", "normal"),
  "documents.manage": meta("documents", "manage", "Gestionar documentos", "sensitive"),
  "documents.delete": meta("documents", "delete", "Eliminar documentos", "critical", undefined, true),
  "agenda.view": meta("agenda", "view", "Ver agenda", "normal"),
  "agenda.manage": meta("agenda", "manage", "Gestionar agenda", "normal"),
  "orqena.use": meta("orqena", "use", "Usar Orqena", "normal", "orqena_chat"),
  "orqena.execute": meta("orqena", "execute", "Confirmar acciones de Orqena", "sensitive", "orqena_actions", true),
  "orqena.memory.manage": meta("orqena", "memory.manage", "Gestionar memoria", "sensitive", "orqena_memory"),
  "reports.view": meta("reports", "view", "Ver informes", "normal"),
  "reports.export": meta("reports", "export", "Exportar informes", "sensitive", "exports")
} as const;

function meta(domain: string, action: string, description: string, sensitivity: "normal" | "sensitive" | "critical", requiredEntitlement?: EntitlementKey, confirmation = false): CapabilityMetadata {
  return { domain, action, description, sensitivity, requiredEntitlement, supportsScope: false, confirmation, dependencies: [] };
}
function scoped(domain: string, action: string, description: string): CapabilityMetadata {
  return { ...meta(domain, action, description, "normal"), supportsScope: true };
}

export type CapabilityKey = keyof typeof capabilityCatalog;

const operational = Object.keys(capabilityCatalog).filter((key) => !key.startsWith("company.billing") && !key.includes("members.remove")) as CapabilityKey[];
export const roleCapabilities: Record<"OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER", readonly CapabilityKey[]> = {
  OWNER: Object.keys(capabilityCatalog) as CapabilityKey[],
  ADMIN: operational,
  MANAGER: operational.filter((key) => !key.startsWith("company.") || key === "company.view" || key === "company.members.view"),
  MEMBER: ["company.view", "clients.view", "clients.create", "clients.update", "work.view", "work.create", "work.update", "sales.budgets.view", "sales.budgets.create", "documents.view", "documents.upload", "agenda.view", "agenda.manage", "orqena.use"],
  VIEWER: ["company.view", "clients.view", "work.view", "sales.budgets.view", "sales.invoices.view", "documents.view", "agenda.view", "reports.view"]
};
