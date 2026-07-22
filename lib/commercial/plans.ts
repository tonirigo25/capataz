import type { EntitlementKey } from "./catalog";

export type EntitlementValue = boolean | number | string;
export const planCatalog = {
  STARTER: plan("Starter", "Para empezar con la operación diaria", { multi_company: false, advanced_permissions: false, team_management: true, team_scopes: false, orqena_chat: true, orqena_actions: false, orqena_memory: true, exports: false, automations: false, audit_log: false, max_members: 3, max_companies: 1, max_documents: 250, storage_bytes: 1_000_000_000, monthly_orqena_actions: 0, max_automations: 0 }),
  PROFESSIONAL: plan("Professional", "Para equipos que coordinan toda la actividad", { multi_company: true, advanced_permissions: true, team_management: true, team_scopes: true, orqena_chat: true, orqena_actions: true, orqena_memory: true, exports: true, automations: true, audit_log: true, max_members: 12, max_companies: 3, max_documents: 2500, storage_bytes: 10_000_000_000, monthly_orqena_actions: 500, max_automations: 20 }),
  BUSINESS: plan("Business", "Para empresas con control avanzado", { multi_company: true, advanced_permissions: true, custom_roles: true, team_management: true, team_scopes: true, orqena_chat: true, orqena_actions: true, orqena_memory: true, document_extraction: true, advanced_reports: true, exports: true, automations: true, priority_support: true, audit_log: true, api_access: true, increased_storage: true, max_members: 50, max_companies: 10, max_documents: 20000, storage_bytes: 100_000_000_000, monthly_orqena_actions: 5000, max_automations: 100 }),
  ENTERPRISE: plan("Enterprise", "Configuración adaptada a organizaciones complejas", { multi_company: true, advanced_permissions: true, custom_roles: true, team_management: true, team_scopes: true, orqena_chat: true, orqena_actions: true, orqena_memory: true, document_extraction: true, advanced_reports: true, exports: true, automations: true, priority_support: true, audit_log: true, custom_branding: true, api_access: true, increased_storage: true, max_members: 1000, max_companies: 100, max_documents: 1000000, storage_bytes: 1_000_000_000_000, monthly_orqena_actions: 100000, max_automations: 1000 })
} as const;

function plan(name: string, description: string, entitlements: Partial<Record<EntitlementKey, EntitlementValue>>) {
  return { name, description, audience: description, price: null, currency: null, period: null, commercialState: "internal", entitlements };
}
export type PlanKey = keyof typeof planCatalog;
export const defaultPlanKey: PlanKey = "STARTER";

