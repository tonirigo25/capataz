import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SECRET_KEY_PATTERN = /(secret|token|password|passwd|api[_-]?key|openai|database_url|private|credential|authorization|cookie|iban|datosBancarios|telefono|email)/i;

export type ProactiveAuditInput = {
  runId?: string | null;
  eventType: string;
  origin?: string;
  signalFingerprint?: string | null;
  recommendationFingerprint?: string | null;
  actionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  userKey?: string | null;
  previousStatus?: string | null;
  nextStatus?: string | null;
  reason?: string | null;
  ruleId?: string | null;
  values?: unknown;
  idempotencyKey?: string | null;
  result?: string | null;
  error?: unknown;
  confirmation?: boolean;
  payload?: unknown;
};

export async function logProactiveAuditEvent(input: ProactiveAuditInput) {
  try {
    await prisma.proactiveAuditEvent.create({
      data: {
        runId: input.runId ?? null,
        eventType: input.eventType,
        origin: input.origin ?? "system",
        signalFingerprint: input.signalFingerprint ?? null,
        recommendationFingerprint: input.recommendationFingerprint ?? null,
        actionId: input.actionId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        userKey: input.userKey ?? null,
        previousStatus: input.previousStatus ?? null,
        nextStatus: input.nextStatus ?? null,
        reason: input.reason ?? null,
        ruleId: input.ruleId ?? null,
        values: toJson(input.values),
        idempotencyKey: input.idempotencyKey ?? null,
        result: input.result ?? null,
        error: input.error ? sanitizeErrorMessage(input.error) : null,
        confirmation: input.confirmation ?? false,
        payload: toJson(input.payload)
      }
    });
  } catch (error) {
    if (isAuditTableMissing(error)) return;
    throw error;
  }
}

export function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Error no identificado.");
  return message
    .replace(/DATABASE_URL|OPENAI_API_KEY|PROACTIVE_CRON_SECRET|CRON_SECRET|TOKEN|PASSWORD|SECRET/gi, "[redacted]")
    .slice(0, 500);
}

export function sanitizeAuditPayload(value: unknown): Prisma.InputJsonValue | undefined {
  const sanitized = sanitizeValue(value, 0);
  return sanitized === undefined ? undefined : sanitized as Prisma.InputJsonValue;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return sanitizeAuditPayload(value);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value === "string" ? redactString(value) : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return String(value);

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 40)
    .map(([key, item]) => [key, SECRET_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeValue(item, depth + 1)] as const);
  return Object.fromEntries(entries.filter(([, item]) => item !== undefined));
}

function redactString(value: string) {
  if (value.length > 240) return `${value.slice(0, 240)}...`;
  if (/sk-[A-Za-z0-9_-]+/.test(value)) return value.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]");
  if (/postgres(?:ql)?:\/\//i.test(value)) return "[redacted-database-url]";
  return value;
}

function isAuditTableMissing(error: unknown) {
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "P2021" || /ProactiveAuditEvent|table .*ProactiveAuditEvent/i.test(maybe.message ?? "");
}
