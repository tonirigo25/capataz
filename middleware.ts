import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { shouldSendNoIndexHeader, X_ROBOTS_TAG_VALUE } from "@/lib/public-indexing";
import { isInternalApi, isProtectedPage, isPublicApi, isPublicResource, safeReturnPath } from "@/lib/route-access";
import { validateBrowserRequest } from "@/lib/security/browser-request";

function applyResponsePolicies(request: NextRequest, response: NextResponse, requestId: string, contentSecurityPolicy: string) {
  response.headers.set("X-Request-Id", requestId);
  response.headers.set(process.env.CSP_ENFORCE === "true" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", contentSecurityPolicy);
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/security/csp-report"');
  if (request.nextUrl.pathname.startsWith("/api/")) response.headers.set("Cache-Control", "no-store");
  if (shouldSendNoIndexHeader(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", X_ROBOTS_TAG_VALUE);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestId = validRequestId(request.headers.get("x-request-id")) ?? crypto.randomUUID();
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const verdict = validateBrowserRequest(request);
  if (!verdict.allowed) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ ok: false, error: verdict.code, requestId }, { status: 403 })
      : new NextResponse("Forbidden", { status: 403 });
    return applyResponsePolicies(request, response, requestId, contentSecurityPolicy);
  }
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-request-id", requestId);
  forwardedHeaders.set("x-correlation-id", validRequestId(request.headers.get("x-correlation-id")) ?? requestId);
  forwardedHeaders.set("x-nonce", nonce);
  // Next reads this request-only header to apply the nonce to framework scripts.
  forwardedHeaders.set("content-security-policy", contentSecurityPolicy);
  const visualQa = process.env.CAPATAZ_VISUAL_QA === "true" && process.env.NODE_ENV !== "production";
  if (isPublicResource(pathname) || isPublicApi(pathname) || isInternalApi(pathname)) {
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    return pathname.endsWith(".html") || !isPublicResource(pathname)
      ? applyResponsePolicies(request, response, requestId, contentSecurityPolicy)
      : response;
  }

  if (isProtectedPage(pathname) && !visualQa && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeReturnPath(pathname, search));
    return applyResponsePolicies(request, NextResponse.redirect(loginUrl), requestId, contentSecurityPolicy);
  }

  // A cookie only avoids an early redirect. The authenticated app layout validates
  // the opaque token and active company membership against PostgreSQL.
  return applyResponsePolicies(request, NextResponse.next({ request: { headers: forwardedHeaders } }), requestId, contentSecurityPolicy);
}

function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Next still emits framework and component styles inline; scripts do not use unsafe-inline.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.resend.com https://api.stripe.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "report-uri /api/security/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

function validRequestId(value: string | null) {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized) ? normalized : null;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"]
};
