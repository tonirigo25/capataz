import { NextResponse } from "next/server";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export const dynamic = "force-dynamic";

export async function GET() {
  return publicRequestContext("GET /api/health", undefined, async () => {
    const commit = process.env.APP_RELEASE_SHA?.trim()
      || process.env.RAILWAY_GIT_COMMIT_SHA?.trim()
      || process.env.GIT_COMMIT_SHA?.trim()
      || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
      || "unknown";
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
