import type { BusinessRecommendation, Prisma } from "@prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import { resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";

export type TodayRailRecommendation = {
  id: string;
  fingerprint: string;
  title: string;
  description: string;
  source: string;
  href: string;
  amount: number | null;
  dueAt: string | null;
  score: number;
  preferredActionId: string | null;
  requiresConfirmation: boolean;
  evidence: Array<{ label: string; value: string }>;
};

export type PortalRailArea = "hoy" | "dashboard" | "clients" | "work" | "budgets" | "finance" | "documents" | "agenda" | "team" | "settings" | "orqena";
export type PortalRailRecommendations = Partial<Record<PortalRailArea, TodayRailRecommendation>> & {
  dashboardAlerts?: TodayRailRecommendation[];
};

export async function getPersistedTodayRailRecommendation(
  context: CompanyContext,
  capabilities: string[],
  now = new Date(),
): Promise<TodayRailRecommendation | null> {
  const recommendations = await getPersistedPortalRailRecommendations(context, capabilities, now);
  return recommendations.hoy ?? null;
}

export async function getPersistedPortalRailRecommendations(
  context: CompanyContext,
  capabilities: string[],
  now = new Date(),
): Promise<PortalRailRecommendations> {
  const capabilitySet = new Set(capabilities);
  if (!capabilitySet.has("orqena.use")) return {};
  const canReadExecutiveDashboard = [
    "reports.view",
    "sales.invoices.view",
    "treasury.view",
    "margin_percent.view",
    "profitability.view",
  ].every((capability) => capabilitySet.has(capability));

  const [workIds, clientIds, documentIds] = await Promise.all([
    capabilitySet.has("work.view") ? resolveScopedEntityIds(context, "work.view", "Work") : Promise.resolve([]),
    capabilitySet.has("clients.view") ? resolveScopedEntityIds(context, "clients.view", "Client") : Promise.resolve([]),
    capabilitySet.has("documents.view") ? resolveScopedEntityIds(context, "documents.view", "Document") : Promise.resolve([]),
  ]);
  const visibilityFilters: Prisma.BusinessRecommendationWhereInput[] = [];
  if (!capabilitySet.has("work.view")) visibilityFilters.push({ workId: null });
  else if (workIds !== null) visibilityFilters.push({ OR: [{ workId: null }, { workId: { in: workIds } }] });
  if (!capabilitySet.has("clients.view")) visibilityFilters.push({ clientId: null });
  else if (clientIds !== null) visibilityFilters.push({ OR: [{ clientId: null }, { clientId: { in: clientIds } }] });
  if (!capabilitySet.has("documents.view")) visibilityFilters.push({ entityType: { notIn: ["document", "Document"] } });
  else if (documentIds !== null) visibilityFilters.push({ OR: [{ entityType: { notIn: ["document", "Document"] } }, { entityId: null }, { entityId: { in: documentIds } }] });
  if (!capabilitySet.has("sales.invoices.view")) visibilityFilters.push({ invoiceId: null, entityType: { notIn: ["invoice", "Invoice"] } });
  if (!capabilitySet.has("sales.budgets.view")) visibilityFilters.push({ budgetId: null, entityType: { notIn: ["budget", "Budget"] } });
  if (!capabilitySet.has("treasury.view")) visibilityFilters.push({ source: { not: "tesoreria" } });
  const candidates = await prisma.businessRecommendation.findMany({
    where: {
      companyId: context.companyId,
      status: { in: ["active", "viewed"] },
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, ...visibilityFilters],
    },
    orderBy: [{ priority: "desc" }, { score: "desc" }, { dueAt: "asc" }, { recommendedAt: "desc" }],
    take: 24,
  });

  const visible = candidates.filter((item) => {
    if (item.workId && (!capabilitySet.has("work.view") || (workIds !== null && !workIds.includes(item.workId)))) return false;
    if (item.clientId && (!capabilitySet.has("clients.view") || (clientIds !== null && !clientIds.includes(item.clientId)))) return false;
    if (item.entityType === "document" && item.entityId && (!capabilitySet.has("documents.view") || (documentIds !== null && !documentIds.includes(item.entityId)))) return false;
    if (item.invoiceId && !capabilitySet.has("sales.invoices.view")) return false;
    if (item.budgetId && !capabilitySet.has("sales.budgets.view")) return false;
    if (item.source === "tesoreria" && !capabilitySet.has("treasury.view")) return false;
    return true;
  });
  const recommendations: PortalRailRecommendations = {};
  const dashboardRecommendations: TodayRailRecommendation[] = [];
  for (const item of visible) {
    const area = recommendationArea(item);
    if (area === "dashboard" && !canReadExecutiveDashboard) continue;
    const serialized = serializeRecommendation(item);
    if (!recommendations.hoy) recommendations.hoy = serialized;
    if (!recommendations[area]) recommendations[area] = serialized;
    if (canReadExecutiveDashboard && (area === "dashboard" || area === "finance")) dashboardRecommendations.push(serialized);
  }
  if (!recommendations.dashboard && dashboardRecommendations.length) recommendations.dashboard = dashboardRecommendations[0];
  if (dashboardRecommendations.length > 1) recommendations.dashboardAlerts = dashboardRecommendations.slice(1, 5);
  return recommendations;
}

function serializeRecommendation(item: BusinessRecommendation): TodayRailRecommendation {
  return {
    id: item.id,
    fingerprint: item.fingerprint,
    title: item.title,
    description: item.summary || item.detailedExplanation,
    source: recommendationSource(item.context, item.source, item.entityType),
    href: recommendationHref(item),
    amount: item.amount,
    dueAt: item.dueAt?.toISOString() ?? null,
    score: item.score,
    preferredActionId: preferredActionId(item.context),
    requiresConfirmation: item.requiresConfirmation,
    evidence: safeEvidence(item.evidence),
  };
}

function recommendationArea(item: { invoiceId: string | null; budgetId: string | null; workId: string | null; clientId: string | null; source: string; entityType: string | null }): Exclude<PortalRailArea, "hoy" | "settings"> {
  const source = `${item.source} ${item.entityType ?? ""}`.toLocaleLowerCase("es-ES");
  if (sourceMatch(source, ["document", "documento", "archivo", "extraction"])) return "documents";
  if (sourceMatch(source, ["equipo", "team", "member", "persona", "staff"])) return "team";
  if (sourceMatch(source, ["agenda", "visita", "calendar", "cita"])) return "agenda";
  if (item.invoiceId || sourceMatch(source, ["tesorer", "factura", "cobro", "pago", "finance", "finanza"])) return "finance";
  if (item.budgetId || sourceMatch(source, ["presupuesto", "budget", "quote"])) return "budgets";
  if (item.workId || sourceMatch(source, ["obra", "trabajo", "operacion", "work", "task"])) return "work";
  if (item.clientId || sourceMatch(source, ["cliente", "client", "crm", "comercial", "followup", "seguimiento"])) return "clients";
  if (sourceMatch(source, ["orqena", "automat", "ai", "ia"])) return "orqena";
  return "dashboard";
}

function sourceMatch(source: string, needles: string[]) {
  return needles.some((needle) => source.includes(needle));
}

function recommendationHref(item: { invoiceId: string | null; budgetId: string | null; workId: string | null; clientId: string | null; source: string }) {
  if (item.invoiceId) return `/dinero/${item.invoiceId}`;
  if (item.budgetId) return `/presupuestos/${item.budgetId}`;
  if (item.workId) return `/obras/${item.workId}`;
  if (item.clientId) return `/clientes/${item.clientId}`;
  if (item.source === "tesoreria") return "/tesoreria";
  return "/recomendaciones";
}

function recommendationSource(value: unknown, source: string, entityType: string | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    for (const key of ["sourceLabel", "entityLabel", "originLabel", "label"]) {
      if (typeof item[key] === "string" && item[key].trim()) return item[key].trim();
    }
  }
  return [source, entityType].filter(Boolean).join(" · ") || "Datos autorizados de la empresa";
}

function safeEvidence(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  const labels: Record<string, string> = {
    probabilityDelta: "Probabilidad",
    cycleDeltaDays: "Ciclo",
    amount: "Importe",
    confidence: "Confianza",
    reason: "Señal",
  };
  const direct = Object.entries(labels).flatMap(([key, label]) => {
    const raw = item[key];
    if (typeof raw !== "string" && typeof raw !== "number") return [];
    return [{ label, value: evidenceValue(label, raw) }];
  });
  const breakdown = Array.isArray(item.scoreBreakdown)
    ? item.scoreBreakdown.flatMap((part) => {
        if (!part || typeof part !== "object" || Array.isArray(part)) return [];
        const record = part as Record<string, unknown>;
        if (typeof record.label !== "string" || typeof record.value !== "number") return [];
        return [{ label: record.label, value: evidenceValue(record.label, record.value) }];
      })
    : [];
  return [...direct, ...breakdown].slice(0, 3);
}

function evidenceValue(label: string, value: string | number) {
  if (typeof value === "string") return value;
  const normalized = label.toLocaleLowerCase("es-ES");
  if (normalized.includes("probabilidad") || normalized.includes("confianza")) return `${value > 0 ? "▲ " : ""}${value}%`;
  if (normalized.includes("ciclo") || normalized.includes("día")) return `${value > 0 ? "+" : ""}${value} días`;
  return value > 0 ? `+${value}` : String(value);
}

function preferredActionId(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value.preferredActionId === "string" && value.preferredActionId.trim()
    ? value.preferredActionId.trim()
    : null;
}
