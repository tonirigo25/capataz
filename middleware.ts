import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { isInternalApi, isProtectedPage, isPublicApi, isPublicResource, safeReturnPath } from "@/lib/route-access";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const visualQa = process.env.CAPATAZ_VISUAL_QA === "true" && process.env.NODE_ENV !== "production";
  if (isPublicResource(pathname) || isPublicApi(pathname) || isInternalApi(pathname)) {
    return NextResponse.next();
  }

  if (isProtectedPage(pathname) && !visualQa && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeReturnPath(pathname, search));
    return NextResponse.redirect(loginUrl);
  }

  // A cookie only avoids an early redirect. The authenticated app layout validates
  // the opaque token and active company membership against PostgreSQL.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"]
};
