import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { resolveHostRouting } from "@/lib/host-routing";
import { shouldSendNoIndexHeader, X_ROBOTS_TAG_VALUE } from "@/lib/public-indexing";
import { isInternalApi, isProtectedPage, isPublicApi, isPublicResource, safeReturnPath } from "@/lib/route-access";
import { validateBrowserRequest } from "@/lib/security/browser-request";

const INTERNAL_MARKETING_REWRITE_HEADER = "x-orqena-internal-marketing-rewrite";
const INTERNAL_MARKETING_REWRITE_TOKEN = crypto.randomUUID();

type RoutedSite = "app" | "marketing" | "platform" | "unknown";

function applyResponsePolicies(
  request: NextRequest,
  response: NextResponse,
  requestId: string,
  contentSecurityPolicy: string,
  site: RoutedSite,
) {
  response.headers.set("X-Request-Id", requestId);
  response.headers.set(
    process.env.CSP_ENFORCE === "true" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    contentSecurityPolicy,
  );
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/security/csp-report"');
  if (request.nextUrl.pathname.startsWith("/api/")) response.headers.set("Cache-Control", "no-store");
  if (site === "app" || site === "unknown" || shouldSendNoIndexHeader(request.nextUrl.pathname)) {
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
    return applyResponsePolicies(request, response, requestId, contentSecurityPolicy, "unknown");
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-request-id", requestId);
  forwardedHeaders.set("x-correlation-id", validRequestId(request.headers.get("x-correlation-id")) ?? requestId);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("content-security-policy", contentSecurityPolicy);

  if (
    pathname.startsWith("/marketing-internal")
    && request.headers.get(INTERNAL_MARKETING_REWRITE_HEADER) === INTERNAL_MARKETING_REWRITE_TOKEN
  ) {
    return applyResponsePolicies(
      request,
      NextResponse.next({ request: { headers: forwardedHeaders } }),
      requestId,
      contentSecurityPolicy,
      "marketing",
    );
  }

  const routing = resolveHostRouting({
    host: request.headers.get("host") ?? "",
    pathname,
    search,
    nodeEnv: process.env.NODE_ENV,
    developmentSite: resolveDevelopmentSite(request),
    hasSessionCookie: request.cookies.has(SESSION_COOKIE_NAME),
  });

  if (routing.action === "redirect") {
    return applyResponsePolicies(
      request,
      NextResponse.redirect(routing.location, routing.status),
      requestId,
      contentSecurityPolicy,
      "unknown",
    );
  }
  if (routing.action === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = routing.pathname;
    forwardedHeaders.set(INTERNAL_MARKETING_REWRITE_HEADER, INTERNAL_MARKETING_REWRITE_TOKEN);
    return applyResponsePolicies(
      request,
      NextResponse.rewrite(url, { request: { headers: forwardedHeaders } }),
      requestId,
      contentSecurityPolicy,
      routing.site,
    );
  }
  if (routing.action === "reject") {
    const response = new NextResponse(routing.status === 421 ? "Host no permitido" : "No encontrado", {
      status: routing.status,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": X_ROBOTS_TAG_VALUE },
    });
    return applyResponsePolicies(request, response, requestId, contentSecurityPolicy, routing.site);
  }
  if (routing.action === "robots") {
    const response = new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
    return applyResponsePolicies(request, response, requestId, contentSecurityPolicy, routing.site);
  }

  const visualQa = process.env.CAPATAZ_VISUAL_QA === "true" && process.env.NODE_ENV !== "production";
  if (isPublicResource(pathname) || isPublicApi(pathname) || isInternalApi(pathname)) {
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    return pathname.endsWith(".html") || !isPublicResource(pathname)
      ? applyResponsePolicies(request, response, requestId, contentSecurityPolicy, routing.site)
      : response;
  }

  if (isProtectedPage(pathname) && !visualQa && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeReturnPath(pathname, search));
    return applyResponsePolicies(
      request,
      NextResponse.redirect(loginUrl),
      requestId,
      contentSecurityPolicy,
      routing.site,
    );
  }

  // A cookie only avoids an early redirect. The authenticated app layout validates
  // the opaque token and active company membership against PostgreSQL.
  return applyResponsePolicies(
    request,
    NextResponse.next({ request: { headers: forwardedHeaders } }),
    requestId,
    contentSecurityPolicy,
    routing.site,
  );
}

function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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

function resolveDevelopmentSite(request: NextRequest): "app" | "marketing" | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const configured = process.env.CAPATAZ_DEV_HOST_MODE?.trim().toLowerCase();
  const requested = request.headers.get("x-orqena-host-mode")?.trim().toLowerCase();
  const mode = requested || configured;
  return mode === "app" || mode === "marketing" ? mode : undefined;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
