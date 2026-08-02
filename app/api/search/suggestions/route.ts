import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/search";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const TAKE_PER_GROUP = 3;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1_024) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  const payload = await request.json().catch(() => null) as { query?: unknown } | null;
  const query = (typeof payload?.query === "string" ? payload.query : "").trim().slice(0, MAX_QUERY_LENGTH);

  try {
    await requireCapability("company.view");
    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { query, groups: {}, total: 0 },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const groups = await globalSearch(query, { takePerGroup: TAKE_PER_GROUP });
    const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
    return NextResponse.json(
      { query, groups, total },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const redirect = Boolean(
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT"),
    );
    if (!redirect) console.error("[global-search-suggestions] request failed");
    return NextResponse.json(
      { error: redirect ? "UNAUTHORIZED" : "SEARCH_UNAVAILABLE" },
      {
        status: redirect ? 401 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
