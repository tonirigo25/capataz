import { NextRequest, NextResponse } from "next/server";
import { appleAppSiteAssociation, resolveMobileAssociationConfig } from "@/lib/mobile/association";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  try {
    const config = resolveMobileAssociationConfig(process.env);
    const payload = config && request.nextUrl.hostname.toLowerCase() === config.host ? appleAppSiteAssociation(config) : null;
    if (!payload) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json(payload, { headers: { "content-type": "application/json", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
