import { NextRequest, NextResponse } from "next/server";
import { resolveExternalRequestHost } from "@/lib/security/request-host";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export const dynamic = "force-dynamic";

export const SECURITY_CONTACT = "https://github.com/tonirigo25/capataz/security/advisories/new";
export const SECURITY_POLICY = "https://orqenatech.com/seguridad";
export const SECURITY_PREFERRED_LANGUAGES = "es, en";
export const SECURITY_EXPIRES = "2027-07-01T00:00:00.000Z";

export const SECURITY_CANONICALS = {
  "orqenatech.com": "https://orqenatech.com/.well-known/security.txt",
  "app.orqenatech.com": "https://app.orqenatech.com/.well-known/security.txt",
} as const;

export function buildSecurityText(canonical: string) {
  return [
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${SECURITY_EXPIRES}`,
    `Canonical: ${canonical}`,
    `Policy: ${SECURITY_POLICY}`,
    `Preferred-Languages: ${SECURITY_PREFERRED_LANGUAGES}`,
    "",
  ].join("\n");
}

export function GET(request: NextRequest) {
  return publicRequestContext("GET /.well-known/security.txt", request, async () => {
    const hostname = resolveExternalRequestHost({
      forwardedHost: request.headers.get("x-forwarded-host"),
      host: request.headers.get("host"),
      urlHostname: request.nextUrl.hostname,
    });
    const canonical = SECURITY_CANONICALS[hostname as keyof typeof SECURITY_CANONICALS];
    if (!canonical) {
      return new NextResponse("Not found\n", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    return new NextResponse(buildSecurityText(canonical), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-language": "es, en",
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
