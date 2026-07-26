import { NextRequest, NextResponse } from "next/server";
import { androidAssetLinks, resolveMobileAssociationConfig } from "@/lib/mobile/association";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return publicRequestContext("GET /.well-known/assetlinks.json", request, async () => {
    try {
      const config = resolveMobileAssociationConfig(process.env);
      const payload = config && request.nextUrl.hostname.toLowerCase() === config.host ? androidAssetLinks(config) : null;
      if (!payload) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json(payload, { headers: { "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
    } catch {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
  });
}
