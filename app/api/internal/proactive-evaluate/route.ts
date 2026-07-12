import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runProactiveEvaluation, type ProactiveEvaluationType } from "@/lib/proactive-evaluation";
import { processAutomationMaintenance } from "@/lib/automations/automation-scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(request: Request) {
  const auth = authorizeInternalRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const payload = await readEmptyPayload(request);
  if (!payload.ok) {
    return NextResponse.json({ ok: false, error: "Payload no permitido." }, { status: 400 });
  }

  try {
    const [result,automations] = await Promise.all([runProactiveEvaluation({
      type: "scheduled" satisfies ProactiveEvaluationType,
      triggeredBy: "railway_cron"
    }),processAutomationMaintenance()]);
    return NextResponse.json({
      ok: result.ok,
      locked: result.locked,
      runId: result.runId,
      status: result.status,
      message: result.message,
      summary: result.summary,
      proactive: result.summary,
      automations
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
  if (!provided || !secretsMatch(provided, expected)) return { ok: false as const, status: 401, error: "No autorizado." };
  return { ok: true as const, status: 200 };
}

async function readEmptyPayload(request: Request) {
  try {
    const body = await request.json();
    return { ok: Boolean(body) && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 0 };
  } catch {
    return { ok: false };
  }
}

function secretsMatch(provided: string, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
