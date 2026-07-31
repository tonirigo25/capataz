import { createHash } from "node:crypto";
import { resolveReleaseSha } from "@/lib/observability/release-sha";
import { getRequestContext } from "@/lib/platform/request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

const SAFE_FIELDS = new Set([
  "event", "requestId", "correlationId", "causationId", "companyId", "actorType",
  "actorIdHash", "jobId", "provider", "operation", "status", "statusCode", "durationMs",
  "membershipIdHash",
  "attempt", "errorCode", "resourceType", "resourceId", "release", "environment", "deploymentId",
]);
const SENSITIVE_KEY = /email|name|phone|address|payload|body|content|password|secret|token|cookie|authorization|certificate|key/i;
const SENSITIVE_VALUE = /(?:Bearer\s+|sk-[A-Za-z0-9]|-----BEGIN|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const context = getRequestContext();
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event: cleanString(event, 100),
    requestId: context?.requestId,
    correlationId: context?.correlationId,
    causationId: context?.causationId,
    companyId: context?.companyId,
    actorType: context?.actor.type,
    actorIdHash: context?.actor.id ? hashIdentifier(context.actor.id) : undefined,
    membershipIdHash: context?.membershipId ? hashIdentifier(context.membershipId) : undefined,
    jobId: context?.jobId,
    provider: context?.provider,
    operation: context?.operation,
    release: context?.release ?? resolveReleaseSha(),
    environment: context?.environment ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NEXT_PUBLIC_APP_ENV,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (!SAFE_FIELDS.has(key) || SENSITIVE_KEY.test(key)) continue;
    entry[key] = sanitizeValue(value);
  }
  const line = JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

export function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN_ERROR";
  const normalized = error.name.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
  return normalized.slice(0, 80) || "ERROR";
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (typeof value === "string") return SENSITIVE_VALUE.test(value) ? "[redacted]" : cleanString(value, 180);
  return undefined;
}

function cleanString(value: string, max: number) {
  return value.replace(/[\r\n\t]/g, " ").slice(0, max);
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
