import { publicRequestContext } from "@/lib/platform/request-boundary";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function readinessErrorSummary(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError", code: null };

  const code =
    "code" in error && typeof error.code === "string"
      ? error.code
      : null;
  const message = error.message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/giu, "postgresql://[redacted]@")
    .slice(0, 800);

  return { name: error.name, code, message };
}

export async function GET() {
  return publicRequestContext("GET /api/health/ready", undefined, async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({
      event: "readiness_database_probe_failed",
      ...readinessErrorSummary(error),
    }));
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  });
}
