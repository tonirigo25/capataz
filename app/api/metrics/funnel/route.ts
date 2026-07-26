import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/platform/rate-limit";
import { publicRequestContext } from "@/lib/platform/request-boundary";
import { recordFirstPartyEvent } from "@/lib/product/analytics";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/metrics/funnel", request, async () => {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 8_192) {
      return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
    }

    const input = await request.json() as Record<string, unknown>;
    if (input.consent !== true) return NextResponse.json({ ok: false, error: "CONSENT_REQUIRED" }, { status: 403 });
    const sourceAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = await consumeRateLimit({ prisma, scope: "public_funnel", subject: sourceAddress, limit: 120, windowMs: 3_600_000 });
    if (!limit.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: rateLimitHeaders(limit) });

    try {
      const result = await recordFirstPartyEvent(prisma, {
        eventId: String(input.eventId ?? ""),
        eventName: String(input.eventName ?? ""),
        properties: isRecord(input.properties) ? input.properties : {},
      });
      return NextResponse.json({ ok: true, replayed: result.replayed }, { status: result.replayed ? 200 : 201, headers: rateLimitHeaders(limit) });
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400, headers: rateLimitHeaders(limit) });
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
