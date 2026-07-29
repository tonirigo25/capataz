import { createHash, randomUUID } from "node:crypto";
import { publicRequestContext } from "@/lib/platform/request-boundary";
import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/commercial/authorization";
import { getOptionalSession, resolveActiveCompany, type CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/platform/rate-limit";
import { OpenAiTranscriptionTransport } from "@/lib/ai/openai-transport";
import { executeRuntimeAiRequest, readRuntimeAiControl } from "@/lib/ai/runtime-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/capataz/transcribe", request, async () => {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const active = await resolveActiveCompany(session.userId);
  if (!active.membership || active.requiresSelection) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const membership = active.membership;
  const context: CompanyContext = { ...session, companyId: membership.companyId, membershipId: membership.id, role: membership.role, isDemo: membership.company.isDemo, companyName: membership.company.nombreComercial, companyStatus: membership.company.status, commercialStatus: membership.company.commercialStatus ?? "ACTIVE" };
  const authorization = await resolveAuthorization(context, "orqena.use");
  if (!authorization.allowed) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const control = (() => {
    try { return readRuntimeAiControl(); } catch { return null; }
  })();
  if (!control?.voiceEnabled || !control.companyAllowlist.includes(membership.companyId)) return NextResponse.json({ error: "La transcripción está desactivada. Puedes escribir el mensaje manualmente." }, { status: 503 });
  const limit = await consumeRateLimit({ prisma, scope: "ai_transcription", subject: session.userId, companyId: membership.companyId, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429, headers: rateLimitHeaders(limit) });

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "No he recibido audio para transcribir." }, { status: 400 });
  }

  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "El audio es demasiado grande. Prueba con un dictado más corto." }, { status: 413 });
  }

  const digest = createHash("sha256").update(Buffer.from(await audio.arrayBuffer())).digest("hex");
  const operationDigest = createHash("sha256").update(JSON.stringify({
    companyId: membership.companyId,
    actorId: session.userId,
    audioDigest: digest,
    modelSnapshot: control.transcriptionSnapshot,
    promptVersion: "transcription-es-v1",
    schemaVersion: 1,
  })).digest("hex");
  const requestId = request.headers.get("x-request-id")?.match(/^[A-Za-z0-9._:-]{1,96}$/)?.[0] ?? randomUUID();
  const result = await executeRuntimeAiRequest({
    companyId: membership.companyId,
    actorId: session.userId,
    role: membership.role,
    scopes: ["orqena.use"],
    purpose: "transcription",
    classification: "CONFIDENTIAL",
    operationKey: "capataz.voice.transcribe",
    idempotencyKey: `transcription-${operationDigest}`,
    requestId,
    correlationId: requestId,
    lane: "transcription",
    promptVersion: "transcription-es-v1",
    schemaVersion: 1,
    payload: { audioRef: digest, mimeType: audio.type || "application/octet-stream", sizeBytes: audio.size },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: { text: { type: "string", minLength: 1, maxLength: 12_000 } },
    },
    maxOutputTokens: Math.min(control.maxOutputTokens, 512),
    estimatedCostCeilingEur: 0.1,
  }, {
    transport: new OpenAiTranscriptionTransport({
      apiKey: process.env.OPENAI_API_KEY ?? "",
      audio,
      baseUrl: process.env.OPENAI_BASE_URL,
      projectId: process.env.OPENAI_PROJECT_ID,
      language: "es",
    }),
  }).catch(() => null);
  if (!result || result.status !== "COMPLETED" || result.output === null || Array.isArray(result.output) || typeof result.output !== "object") {
    return NextResponse.json({ error: "No he podido transcribir el audio. Puedes escribir el mensaje manualmente." }, { status: 503 });
  }
  const text = typeof result.output.text === "string" ? result.output.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "La transcripción ha llegado vacía." }, { status: 422 });
  }

  return NextResponse.json({ text });

  });
}
