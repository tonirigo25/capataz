import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta OPENAI_API_KEY en el backend." }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "No he recibido audio para transcribir." }, { status: 400 });
  }

  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "El audio es demasiado grande. Prueba con un dictado más corto." }, { status: 413 });
  }

  const payload = new FormData();
  payload.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  payload.append("language", "es");
  payload.append("file", audio, audio.name || "dictado.webm");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: payload
  }).catch((error) => {
    throw new Error(error instanceof Error ? error.message : "Error conectando con OpenAI");
  });

  const result = await response.json().catch(() => null) as { text?: string; error?: { message?: string } } | null;
  if (!response.ok) {
    return NextResponse.json({ error: sanitizeTranscriptionError(result?.error?.message || `OpenAI devolvió HTTP ${response.status}`) }, { status: response.status });
  }

  const text = result?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "La transcripción ha llegado vacía." }, { status: 422 });
  }

  return NextResponse.json({ text });
}

function sanitizeTranscriptionError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_*.-]+/g, "[OPENAI_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}
