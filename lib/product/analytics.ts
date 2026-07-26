import { Prisma, type PrismaClient } from "@prisma/client";
import { stableReference, stableStringify } from "@/lib/ai/redaction";

type Rule = "boolean" | "number" | readonly string[];
type EventRule = Record<string, Rule>;

export const firstPartyEventCatalog: Record<string, EventRule> = {
  "user.active": { surface: ["app", "mobile", "public"] },
  "activation.company.completed": { milestone: ["company"], withinSevenDays: "boolean", measurementVersion: ["f7-v1"] },
  "activation.client.completed": { milestone: ["client"], withinSevenDays: "boolean", measurementVersion: ["f7-v1"] },
  "activation.budget.completed": { milestone: ["budget"], withinSevenDays: "boolean", measurementVersion: ["f7-v1"] },
  "activation.document.completed": { milestone: ["document"], withinSevenDays: "boolean", measurementVersion: ["f7-v1"] },
  "activation.completed": { milestone: ["all"], withinSevenDays: "boolean", measurementVersion: ["f7-v1"] },
  "onboarding.session": { durationMinutes: "number", completed: "boolean", version: ["v1"] },
  "outcome.time_saved": { minutes: "number", methodology: ["self_reported", "workflow_baseline_v1"] },
  "outcome.debt_recovered": { amountEur: "number", methodology: ["overdue_payment_v1"] },
  "outcome.ai_action": { outcome: ["accepted", "corrected", "rejected"], minutesSaved: "number" },
  "feedback.nps": { score: "number", consent: ["explicit"] },
  "feedback.csat": { score: "number", consent: ["explicit"] },
  "support.session": { minutes: "number", category: ["ACCESS", "BILLING", "DOCUMENTS", "OPERATIONS", "PRIVACY", "OTHER"] },
  "web.vital": { metric: ["LCP", "CLS", "INP", "FCP", "TTFB"], value: "number", rating: ["good", "needs-improvement", "poor"], routeGroup: ["public", "auth", "app", "platform"] },
};

const SENSITIVE_VALUE = /sk-(?:proj-)?|Bearer\s+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:\+34[ .-]?)?[6789](?:[ .-]?\d){8}\b|\b(?:[XYZ]\d{7,8}[A-Z]|\d{8}[A-Z])\b/i;

export function validateFirstPartyEvent(eventName: string, properties: Record<string, unknown>) {
  const rule = firstPartyEventCatalog[eventName];
  if (!rule) throw new Error("PRODUCT_EVENT_NOT_ALLOWLISTED");
  const unknown = Object.keys(properties).filter((key) => !(key in rule));
  if (unknown.length) throw new Error(`PRODUCT_EVENT_PROPERTY_NOT_ALLOWLISTED:${unknown.sort().join(",")}`);
  for (const [key, value] of Object.entries(properties)) {
    const expected = rule[key];
    if (expected === "number" && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100_000_000)) throw new Error(`PRODUCT_EVENT_PROPERTY_INVALID:${key}`);
    if (expected === "boolean" && typeof value !== "boolean") throw new Error(`PRODUCT_EVENT_PROPERTY_INVALID:${key}`);
    if (Array.isArray(expected) && (typeof value !== "string" || !expected.includes(value))) throw new Error(`PRODUCT_EVENT_PROPERTY_INVALID:${key}`);
  }
  if (SENSITIVE_VALUE.test(stableStringify(properties))) throw new Error("PRODUCT_EVENT_SENSITIVE_VALUE_REJECTED");
  return properties as Prisma.InputJsonObject;
}

export async function recordFirstPartyEvent(prisma: PrismaClient, input: {
  eventId: string;
  companyId?: string;
  actorId?: string;
  eventName: string;
  properties: Record<string, unknown>;
  occurredAt?: Date;
}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(input.eventId)) throw new Error("PRODUCT_EVENT_ID_INVALID");
  const properties = validateFirstPartyEvent(input.eventName, input.properties);
  const existing = await prisma.productEvent.findUnique({ where: { eventId: input.eventId } });
  if (existing) {
    const same = existing.companyId === (input.companyId ?? null) && existing.eventName === input.eventName && stableStringify(existing.properties) === stableStringify(properties);
    if (!same) throw new Error("PRODUCT_EVENT_ID_REUSED");
    return { event: existing, replayed: true };
  }
  const event = await prisma.productEvent.create({ data: { eventId: input.eventId, companyId: input.companyId, actorHash: input.actorId ? stableReference(input.actorId) : null, eventName: input.eventName, properties, occurredAt: input.occurredAt ?? new Date() } });
  return { event, replayed: false };
}
