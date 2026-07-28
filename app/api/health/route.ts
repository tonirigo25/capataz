import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA?.trim()
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
}
