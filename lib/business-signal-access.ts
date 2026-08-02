import type { BusinessSignalSource } from "@prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import type { BusinessRecommendation } from "@/lib/business-recommendations";
import type { BusinessSignal } from "@/lib/business-signals";
import {
  resolveAuthorization,
  resolveScopedEntityIds
} from "@/lib/commercial/authorization";
import type { CapabilityKey } from "@/lib/commercial/catalog";

type AccessEntry = {
  allowed: boolean;
  scope: string;
  workIds: string[] | null;
  clientIds: string[] | null;
  documentIds: string[] | null;
};

export type BusinessSignalAccess = Map<CapabilityKey, AccessEntry>;

const SOURCE_CAPABILITIES: Record<Exclude<BusinessSignalSource, "datos">, CapabilityKey> = {
  crm: "clients.view",
  obras: "work.view",
  facturas: "sales.invoices.view",
  cobros: "sales.invoices.view",
  tesoreria: "treasury.view",
  agenda: "agenda.view",
  documentos: "documents.view",
  materiales: "purchase_cost.view",
  rentabilidad: "profitability.view",
  chat: "orqena.use",
  recordatorios: "followups.view",
  visitas: "agenda.view",
  gastos: "purchases.received_invoices.view",
  presupuestos: "sales.budgets.view"
};

const REQUIRED_CAPABILITIES = [...new Set<CapabilityKey>([
  ...Object.values(SOURCE_CAPABILITIES),
  "reports.view"
])];

export async function resolveBusinessSignalAccess(context: CompanyContext): Promise<BusinessSignalAccess> {
  const entries: Array<[CapabilityKey, AccessEntry]> = await Promise.all(REQUIRED_CAPABILITIES.map(async (capability): Promise<[CapabilityKey, AccessEntry]> => {
    const decision = await resolveAuthorization(context, capability);
    if (!decision.allowed) {
      return [capability, { allowed: false, scope: decision.scope, workIds: [], clientIds: [], documentIds: [] }];
    }
    const [workIds, clientIds, documentIds] = await Promise.all([
      resolveScopedEntityIds(context, capability, "Work"),
      resolveScopedEntityIds(context, capability, "Client"),
      resolveScopedEntityIds(context, capability, "Document")
    ]);
    return [capability, { allowed: true, scope: decision.scope, workIds, clientIds, documentIds }];
  }));
  return new Map(entries);
}

export function filterBusinessSignalsForAccess(signals: BusinessSignal[], access: BusinessSignalAccess) {
  return signals.filter((signal) => accessAllows(access, {
    source: signal.source,
    entityType: signal.entity?.type ?? null,
    entityId: signal.entity?.id ?? null,
    workId: signal.work?.id ?? null,
    clientId: signal.client?.id ?? null
  }));
}

export function filterBusinessRecommendationsForAccess(recommendations: BusinessRecommendation[], access: BusinessSignalAccess) {
  return recommendations.filter((recommendation) => accessAllows(access, {
    source: recommendation.source,
    entityType: recommendation.entityType,
    entityId: recommendation.entityId,
    workId: recommendation.workId,
    clientId: recommendation.clientId
  }));
}

function accessAllows(access: BusinessSignalAccess, item: {
  source: BusinessSignalSource;
  entityType: string | null;
  entityId: string | null;
  workId: string | null;
  clientId: string | null;
}) {
  const capability = capabilityFor(item.source, item.entityType);
  const entry = access.get(capability);
  if (!entry?.allowed) return false;
  if (entry.scope === "COMPANY") return true;
  if (item.workId) return entry.workIds === null || entry.workIds.includes(item.workId);
  if (item.clientId) return entry.clientIds === null || entry.clientIds.includes(item.clientId);
  if (isDocumentType(item.entityType) && item.entityId) return entry.documentIds === null || entry.documentIds.includes(item.entityId);
  return false;
}

function capabilityFor(source: BusinessSignalSource, entityType: string | null): CapabilityKey {
  if (source !== "datos") return SOURCE_CAPABILITIES[source];
  const normalized = entityType?.trim().toLowerCase() ?? "";
  if (["factura", "invoice"].includes(normalized)) return "sales.invoices.view";
  if (["presupuesto", "budget"].includes(normalized)) return "sales.budgets.view";
  if (["cliente", "client"].includes(normalized)) return "clients.view";
  if (["obra", "work"].includes(normalized)) return "work.view";
  if (isDocumentType(normalized)) return "documents.view";
  if (["tesoreria", "treasury"].includes(normalized)) return "treasury.view";
  return "reports.view";
}

function isDocumentType(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return ["documento", "document", "archivo", "file"].includes(normalized);
}
