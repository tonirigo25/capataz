import { NextResponse } from "next/server";
import { resolveReleaseSha } from "@/lib/observability/release-sha";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export const dynamic = "force-dynamic";

export async function GET() {
  return publicRequestContext("GET /api/health", undefined, async () => {
    const commit = resolveReleaseSha();
    return NextResponse.json(
      {
        ok: true,
        service: "capataz",
        version: process.env.npm_package_version || "0.1.0",
        commit,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
