import { NextResponse } from "next/server";
import { checkCapatazAIModels, getCapatazAIStatus } from "@/lib/ai/capataz-ai";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const live = url.searchParams.get("live") === "1";
  const status = getCapatazAIStatus();

  if (!live) {
    return NextResponse.json({
      ok: status.configured,
      liveCheck: "disabled",
      ...status
    });
  }

  const check = await checkCapatazAIModels();
  return NextResponse.json(
    {
      ...status,
      liveCheck: check
    },
    { status: check.ok ? 200 : 503 }
  );
}
