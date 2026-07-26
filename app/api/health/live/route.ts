import { publicRequestContext } from "@/lib/platform/request-boundary";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return publicRequestContext("GET /api/health/live", undefined, async () => {
  return NextResponse.json({ ok: true });

  });
}
