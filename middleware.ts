import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { resolveHostRouting } from "@/lib/host-routing";
import { shouldSendNoIndexHeader, X_ROBOTS_TAG_VALUE } from "@/lib/public-indexing";
import { isInternalApi, isProtectedPage, isPublicApi, isPublicResource, safeReturnPath } from "@/lib/route-access";

const INTERNAL_MARKETING_REWRITE_HEADER = "x-orqena-internal-marketing-rewrite";
const INTERNAL_MARKETING_REWRITE_TOKEN = crypto.randomUUID();

function applyIndexingPolicy(request: NextRequest, response: NextResponse, site: "app" | "marketing" | "platform") {
  if (site === "app" || (site === "platform" && shouldSendNoIndexHeader(request.nextUrl.pathname))) {
    response.headers.set("X-Robots-Tag", X_ROBOTS_TAG_VALUE);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    pathname.startsWith("/marketing-internal")
    && request.headers.get(INTERNAL_MARKETING_REWRITE_HEADER) === INTERNAL_MARKETING_REWRITE_TOKEN
  ) {
    return applyIndexingPolicy(request, NextResponse.next(), "marketing");
  }
  const developmentSite = resolveDevelopmentSite(request);
  const routing = resolveHostRouting({
    host: request.headers.get("host") ?? "",
    pathname,
    search,
    nodeEnv: process.env.NODE_ENV,
    developmentSite,
  });

  if (routing.action === "redirect") {
    return NextResponse.redirect(routing.location, routing.status);
  }
  if (routing.action === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = routing.pathname;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(INTERNAL_MARKETING_REWRITE_HEADER, INTERNAL_MARKETING_REWRITE_TOKEN);
    return applyIndexingPolicy(request, NextResponse.rewrite(url, { request: { headers: requestHeaders } }), routing.site);
  }
  if (routing.action === "reject") {
    return new NextResponse(routing.status === 421 ? "Host no permitido" : "No encontrado", {
      status: routing.status,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": X_ROBOTS_TAG_VALUE },
    });
  }
  if (routing.action === "robots") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  const visualQa = process.env.CAPATAZ_VISUAL_QA === "true" && process.env.NODE_ENV !== "production";
  if (isPublicResource(pathname) || isPublicApi(pathname) || isInternalApi(pathname)) {
    const response = NextResponse.next();
    return pathname.endsWith(".html") || !isPublicResource(pathname)
      ? applyIndexingPolicy(request, response, routing.site)
      : response;
  }

  if (isProtectedPage(pathname) && !visualQa && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeReturnPath(pathname, search));
    return applyIndexingPolicy(request, NextResponse.redirect(loginUrl), routing.site);
  }

  // A cookie only avoids an early redirect. The authenticated app layout validates
  // the opaque token and active company membership against PostgreSQL.
  return applyIndexingPolicy(request, NextResponse.next(), routing.site);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"]
};

function resolveDevelopmentSite(request: NextRequest): "app" | "marketing" | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const configured = process.env.CAPATAZ_DEV_HOST_MODE?.trim().toLowerCase();
  const requested = request.headers.get("x-orqena-host-mode")?.trim().toLowerCase();
  const mode = requested || configured;
  return mode === "app" || mode === "marketing" ? mode : undefined;
}
