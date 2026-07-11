import { NextResponse } from "next/server";
import { runProactiveEvaluation, type ProactiveEvaluationType } from "@/lib/proactive-evaluation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authorizeInternalRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { type?: ProactiveEvaluationType; triggeredBy?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const result = await runProactiveEvaluation({
      type: body.type ?? "scheduled",
      triggeredBy: body.triggeredBy ?? "internal_endpoint"
    });
    return NextResponse.json({
      ok: result.ok,
      locked: result.locked,
      runId: result.runId,
      status: result.status,
      message: result.message,
      summary: result.summary
    }, { status: result.locked ? 423 : 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "La reevaluación proactiva falló. Revisa el centro de control interno." }, { status: 500 });
  }
}

function authorizeInternalRequest(request: Request) {
  const expected = process.env.PROACTIVE_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!expected) return { ok: false as const, status: 503, error: "El secreto interno de cron no está configurado." };

  const headerSecret = request.headers.get("x-capataz-cron-secret");
  const auth = request.headers.get("authorization");
  const bearerSecret = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const provided = headerSecret ?? bearerSecret;
  if (!provided || provided !== expected) return { ok: false as const, status: 401, error: "No autorizado." };
  return { ok: true as const, status: 200 };
}
