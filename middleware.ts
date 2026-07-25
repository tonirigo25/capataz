import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { shouldSendNoIndexHeader, X_ROBOTS_TAG_VALUE } from "@/lib/public-indexing";
import { isInternalApi, isProtectedPage, isPublicApi, isPublicResource, safeReturnPath } from "@/lib/route-access";

function applyIndexingPolicy(request: NextRequest, response: NextResponse) {
  if (shouldSendNoIndexHeader(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", X_ROBOTS_TAG_VALUE);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const visualQa = process.env.CAPATAZ_VISUAL_QA === "true" && process.env.NODE_ENV !== "production";
  if (isPublicResource(pathname) || isPublicApi(pathname) || isInternalApi(pathname)) {
    const response = NextResponse.next();
    return pathname.endsWith(".html") || !isPublicResource(pathname)
      ? applyIndexingPolicy(request, response)
      : response;
  }

  if (isProtectedPage(pathname) && !visualQa && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeReturnPath(pathname, search));
    return applyIndexingPolicy(request, NextResponse.redirect(loginUrl));
  }

  // A cookie only avoids an early redirect. The authenticated app layout validates
  // the opaque token and active company membership against PostgreSQL.
  return applyIndexingPolicy(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"]
};
