import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/system-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSystemStatus();
  return NextResponse.json({
    ok: status.database === "ok" && status.missingPublicVars.length === 0,
    ...status
  });
}
