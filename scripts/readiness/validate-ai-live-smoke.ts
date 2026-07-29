import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import type { AiLane, GovernedAiRequest, StrictJsonSchema } from "../../lib/ai/contracts";
import { OpenAiTranscriptionTransport } from "../../lib/ai/openai-transport";
import { executeRuntimeAiRequest, readRuntimeAiControl } from "../../lib/ai/runtime-gateway";

const companyId = process.env.AI_LIVE_SMOKE_COMPANY_ID?.trim();
const audioPath = process.env.AI_LIVE_SMOKE_AUDIO_PATH?.trim();
if (process.env.AI_LIVE_SMOKE !== "true") throw new Error("AI_LIVE_SMOKE_EXPLICIT_OPT_IN_REQUIRED");
if (!companyId) throw new Error("AI_LIVE_SMOKE_COMPANY_ID_REQUIRED");
const controlledCompanyId = companyId;

const control = readRuntimeAiControl();
if (!control.liveConfigurationComplete || control.providerMode !== "openai") throw new Error("AI_LIVE_CONFIGURATION_INCOMPLETE");
if (!control.companyAllowlist.includes(controlledCompanyId)) throw new Error("AI_LIVE_SMOKE_COMPANY_NOT_ALLOWLISTED");

const outputSchema: StrictJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "confidence"],
  properties: {
    answer: { type: "string", minLength: 1, maxLength: 160 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

function syntheticRequest(lane: AiLane, purpose: string): GovernedAiRequest {
  const id = randomUUID();
  return {
    companyId: controlledCompanyId,
    actorId: "synthetic-live-smoke-actor",
    role: "OWNER",
    scopes: ["orqena.use"],
    purpose,
    classification: "INTERNAL",
    operationKey: `synthetic.${purpose}.${lane}`,
    idempotencyKey: `synthetic-live-${id}`,
    requestId: id,
    correlationId: id,
    lane,
    promptVersion: "synthetic-live-v1",
    schemaVersion: 1,
    payload: { message: "Fixture sintética: devuelve una confirmación breve sin datos personales.", context: { fixture: true } },
    outputSchema,
    maxOutputTokens: 128,
    estimatedCostCeilingEur: lane === "reasoning" ? 0.05 : 0.02,
  };
}

async function run(request: GovernedAiRequest, options: Parameters<typeof executeRuntimeAiRequest>[1] = {}) {
  const response = await executeRuntimeAiRequest(request, options);
  if (response.status !== "COMPLETED" || response.source !== "openai" || !response.usageEventId) throw new Error("AI_LIVE_SMOKE_CALL_FAILED");
  const evidence = await prisma.aiUsageEvent.findUnique({
    where: { id: response.usageEventId },
    select: {
      requestId: true,
      correlationId: true,
      purpose: true,
      modelSnapshot: true,
      schemaVersion: true,
      inputTokens: true,
      outputTokens: true,
      costAmount: true,
      latencyMs: true,
      outcome: true,
      storeRequested: true,
      modelVersion: { select: { provider: true, model: true } },
      promptVersion: { select: { version: true } },
    },
  });
  if (!evidence || evidence.storeRequested) throw new Error("AI_LIVE_SMOKE_EVIDENCE_INVALID");
  return {
    requestId: evidence.requestId,
    correlationId: evidence.correlationId,
    provider: evidence.modelVersion.provider,
    model: evidence.modelVersion.model,
    modelSnapshot: evidence.modelSnapshot,
    promptVersion: evidence.promptVersion.version,
    schemaVersion: evidence.schemaVersion,
    inputTokens: evidence.inputTokens,
    outputTokens: evidence.outputTokens,
    costEstimatedEur: evidence.costAmount === null ? null : Number(evidence.costAmount),
    latencyMs: evidence.latencyMs,
    status: evidence.outcome,
    store: false,
  };
}

async function main() {
  const results = [
    await run(syntheticRequest("fast", "chat-command")),
    await run(syntheticRequest("reasoning", "chat-command")),
  ];
  if (audioPath) {
    const bytes = await readFile(audioPath);
    const audio = new File([bytes], "synthetic-voice.wav", { type: "audio/wav" });
    const request = syntheticRequest("transcription", "transcription");
    request.payload = { audioRef: "synthetic-audio-fixture", mimeType: "audio/wav", sizeBytes: audio.size };
    request.outputSchema = { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string", minLength: 1, maxLength: 500 } } };
    request.maxOutputTokens = 128;
    results.push(await run(request, { transport: new OpenAiTranscriptionTransport({
      apiKey: process.env.OPENAI_API_KEY ?? "",
      audio,
      baseUrl: process.env.OPENAI_BASE_URL,
      projectId: process.env.OPENAI_PROJECT_ID,
      language: "es",
    }) }));
  }
  console.log(JSON.stringify({ ok: true, fixture: "synthetic-only", rawContentLogged: false, calls: results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AI_LIVE_SMOKE_FAILED");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
