import type { NextRequest } from "next/server";
import { resolveExternalRequestHost } from "./request-host";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const HOST_AGNOSTIC_HEALTH_PATHS = new Set([
  "/api/status",
  "/api/health",
  "/api/health/live",
  "/api/health/ready",
]);

export type BrowserRequestVerdict = { allowed: true } | { allowed: false; code: "HOST_NOT_ALLOWED" | "ORIGIN_REQUIRED" | "ORIGIN_NOT_ALLOWED" };

export function validateBrowserRequest(request: NextRequest): BrowserRequestVerdict {
  const configuredOrigins = allowedOrigins(process.env);
  const requestOrigin = request.nextUrl.origin;
  const host = resolveExternalRequestHost({
    forwardedHost: request.headers.get("x-forwarded-host"),
    host: request.headers.get("host"),
    urlHostname: request.nextUrl.hostname,
  });
  const environment = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();

  // Railway probes the container through an internal hostname. These endpoints
  // are public, read-only and explicitly host-agnostic in host-routing.ts.
  if (SAFE_METHODS.has(request.method) && HOST_AGNOSTIC_HEALTH_PATHS.has(request.nextUrl.pathname)) {
    return { allowed: true };
  }

  if (environment === "production" && configuredOrigins.size > 0) {
    const allowedHosts = new Set([...configuredOrigins].map((origin) => new URL(origin).host.toLowerCase()));
    if (!host || !allowedHosts.has(host)) return { allowed: false, code: "HOST_NOT_ALLOWED" };
  }
  if (SAFE_METHODS.has(request.method)) return { allowed: true };

  const origin = request.headers.get("origin");
  const browserMutation = Boolean(origin || request.headers.get("sec-fetch-site") || request.cookies.get("capataz_session"));
  if (!browserMutation) return { allowed: true };
  if (!origin) return { allowed: false, code: "ORIGIN_REQUIRED" };

  if (environment !== "production") configuredOrigins.add(requestOrigin);
  if (!configuredOrigins.has(normalizeOrigin(origin))) return { allowed: false, code: "ORIGIN_NOT_ALLOWED" };
  return { allowed: true };
}

export function allowedOrigins(env: NodeJS.ProcessEnv): Set<string> {
  const origins = new Set<string>();
  for (const value of [env.APP_BASE_URL, env.NEXT_PUBLIC_WEB_BASE_URL, ...(env.TRUSTED_BROWSER_ORIGINS?.split(",") ?? [])]) {
    if (!value?.trim()) continue;
    try { origins.add(new URL(value.trim()).origin); } catch { /* startup validation reports malformed values */ }
  }
  return origins;
}

function normalizeOrigin(value: string) {
  try { return new URL(value).origin; } catch { return "invalid:"; }
}
