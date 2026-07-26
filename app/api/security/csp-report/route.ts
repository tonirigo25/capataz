import { publicRequestContext } from "@/lib/platform/request-boundary";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/platform/rate-limit";

export async function POST(request: NextRequest) {
  return publicRequestContext("POST /api/security/csp-report", request, async () => {
  const subject = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await consumeRateLimit({ prisma, scope: "csp_report", subject, limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: rateLimitHeaders(limit) });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return NextResponse.json({ ok: false }, { status: 415 });
  const report = await request.json().catch(() => null) as Record<string, unknown> | null;
  const body = report && typeof report["csp-report"] === "object" ? report["csp-report"] as Record<string, unknown> : report;
  log("warn", "csp_violation", {
    status: typeof body?.["disposition"] === "string" ? body["disposition"] : "report",
    resourceType: typeof body?.["effective-directive"] === "string" ? body["effective-directive"] : "unknown",
  });
  return NextResponse.json({ ok: true }, { status: 202, headers: rateLimitHeaders(limit) });

  });
}
