import { NextResponse } from "next/server";
import { checkCapatazAIModels, getCapatazAIStatus } from "@/lib/ai/capataz-ai";
import { getOptionalSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getOptionalSession();
  const platform = session ? await prisma.platformAccount.findFirst({ where: { userId: session.userId, status: "ACTIVE" }, select: { id: true } }) : null;
  if (!platform) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
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
