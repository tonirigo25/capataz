import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/system-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSystemStatus();
  const healthy = status.database === "ok" && status.missingPublicVars.length === 0 && status.missingServerVars.length === 0;

  return NextResponse.json(
    {
      ok: healthy,
      ...status
    },
    { status: healthy ? 200 : 503 }
  );
}
