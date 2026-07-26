import { NextResponse } from "next/server";
import { publicRequestContext } from "@/lib/platform/request-boundary";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/platform/rate-limit";
import { prisma } from "@/lib/prisma";
import { recordFirstPartyEvent } from "@/lib/product/analytics";

export async function POST(request: Request) {
  if (process.env.ANALYTICS_ENABLED !== "true") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return publicRequestContext("POST /api/metrics/web-vitals", request, async () => {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 2_048) return NextResponse.json({ ok: false }, { status: 413 });
    const subject = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = await consumeRateLimit({ prisma, scope: "web_vitals", subject, limit: 120, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: rateLimitHeaders(limit) });
    try {
      const body = await request.json() as Record<string, unknown>;
      const metric = String(body.metric ?? "");
      if (!/^(LCP|CLS|INP|FCP|TTFB)$/.test(metric)) throw new Error("WEB_VITAL_INVALID");
      await recordFirstPartyEvent(prisma, { eventId: `webvital:${String(body.id ?? "")}`.slice(0, 128), eventName: "web.vital", properties: { metric, value: Number(body.value), rating: String(body.rating ?? ""), routeGroup: String(body.routeGroup ?? "") } });
      return NextResponse.json({ ok: true }, { status: 202, headers: rateLimitHeaders(limit) });
    } catch {
      return NextResponse.json({ ok: false }, { status: 400, headers: rateLimitHeaders(limit) });
    }
  });
}
