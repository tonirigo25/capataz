import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type BrowserRequestVerdict = { allowed: true } | { allowed: false; code: "HOST_NOT_ALLOWED" | "ORIGIN_REQUIRED" | "ORIGIN_NOT_ALLOWED" };

export function validateBrowserRequest(request: NextRequest): BrowserRequestVerdict {
  const configuredOrigins = allowedOrigins(process.env);
  const requestOrigin = request.nextUrl.origin;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  const environment = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();

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
