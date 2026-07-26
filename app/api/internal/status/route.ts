import { internalRequestContext } from "@/lib/platform/request-boundary";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth/session";
import { internalReleaseMetadata } from "@/lib/observability/release";
import { prisma } from "@/lib/prisma";
import { getSystemStatus } from "@/lib/system-status";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return internalRequestContext("GET /api/internal/status", request, async () => {
  if (!(await authorized(request))) return NextResponse.json({ ok: false }, { status: 404 });
  const [system, release] = await Promise.all([getSystemStatus(), internalReleaseMetadata()]);
  const ok = system.database === "ok" && system.missingPublicVars.length === 0 && system.missingServerVars.length === 0;
  return NextResponse.json({ ok, system, release }, { status: ok ? 200 : 503 });

  });
}

async function authorized(request: NextRequest) {
  const configured = process.env.JOB_RUNNER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (configured && supplied && safeEqual(configured, supplied)) return true;
  const session = await getOptionalSession();
  if (!session) return false;
  const account = await prisma.platformAccount.findUnique({ where: { userId: session.userId }, select: { status: true, role: true } });
  return account?.status === "ACTIVE" && ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(account.role);
}

function safeEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}
