import * as Sentry from "@sentry/nextjs";
import { createHash } from "node:crypto";

const allowedContext = new Set(["requestId", "correlationId", "operation", "route", "status", "jobKey", "provider", "errorCode", "release", "environment"]);

export function sanitizeErrorTrackingEvent(input: { error: unknown; context?: Record<string, unknown> }) {
  const error = input.error instanceof Error ? input.error : new Error("Unknown application error");
  const context: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input.context ?? {})) {
    if (!allowedContext.has(key)) continue;
    if (typeof value === "string") context[key] = redact(value);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) context[key] = value;
  }
  return { name: error.name, message: redact(error.message), fingerprint: createHash("sha256").update(`${error.name}:${error.message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[email]")}`).digest("hex").slice(0, 24), context };
}

export function captureConfiguredError(input: { error: unknown; context?: Record<string, unknown> }, reporter: { captureException(error: Error, options: object): string } = Sentry) {
  if (!process.env.ERROR_TRACKING_DSN) return { sent: false, reason: "disabled" as const };
  const sanitized = sanitizeErrorTrackingEvent(input);
  const id = reporter.captureException(new Error(sanitized.message), { fingerprint: [sanitized.fingerprint], contexts: { orqena: sanitized.context } });
  return { sent: true, id, sanitized };
}

function redact(value: string) {
  return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]").replace(/\b(?:\+34\s*)?(?:6|7|8|9)\d{8}\b/g, "[redacted-phone]").replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{12,}\b/g, "[redacted-token]").slice(0, 500);
}
