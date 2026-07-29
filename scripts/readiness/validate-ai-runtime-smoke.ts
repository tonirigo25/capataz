import assert from "node:assert/strict";
import { AiGatewayError, type GovernedAiRequest, type StrictJsonSchema } from "../../lib/ai/contracts";
import { FakeGovernedAiTransport } from "../../lib/ai/fake-transport";
import { InMemoryAiGovernanceStore, syntheticAiPolicy } from "../../lib/ai/in-memory-store";
import { shouldEscalateToReasoning } from "../../lib/ai/model-policy";
import { executeRuntimeAiRequest } from "../../lib/ai/runtime-gateway";

const companyId = "company-synthetic-a";
const actorId = "user-synthetic-a";
const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
  AI_PROVIDER_CONFIGURED: "true",
  AI_ENABLED: "true",
  AI_GLOBAL_ENABLED: "true",
  AI_PROVIDER_MODE: "fake",
  AI_COMPANY_ALLOWLIST: companyId,
  AI_GLOBAL_MONTHLY_BUDGET_EUR: "25",
  AI_DEFAULT_COMPANY_MONTHLY_BUDGET_EUR: "5",
  AI_DEFAULT_USER_DAILY_REQUEST_LIMIT: "50",
  AI_MAX_INPUT_TOKENS_PER_REQUEST: "4096",
  AI_MAX_OUTPUT_TOKENS_PER_REQUEST: "1024",
};
const outputSchema: StrictJsonSchema = { type: "object", additionalProperties: false, required: ["answer", "confidence"], properties: { answer: { type: "string", minLength: 1 }, confidence: { type: "number", minimum: 0, maximum: 1 } } };
let serial = 0;

function request(overrides: Partial<GovernedAiRequest> = {}): GovernedAiRequest {
  serial += 1;
  return {
    companyId,
    actorId,
    role: "OWNER",
    scopes: ["orqena.use"],
    purpose: "chat-command",
    classification: "CONFIDENTIAL",
    operationKey: "synthetic.smoke",
    idempotencyKey: `synthetic-smoke-${serial}`,
    requestId: `synthetic-request-${serial}`,
    correlationId: "synthetic-correlation",
    lane: "fast",
    promptVersion: "synthetic-v1",
    schemaVersion: 1,
    payload: { message: "fixture sintética", context: {} },
    outputSchema,
    maxOutputTokens: 128,
    estimatedCostCeilingEur: 0.01,
    ...overrides,
  };
}

function setup(transport: FakeGovernedAiTransport, environment: NodeJS.ProcessEnv = baseEnvironment) {
  return { environment, store: new InMemoryAiGovernanceStore([syntheticAiPolicy()]), transport };
}

async function expectCode(code: string, operation: () => Promise<unknown>) {
  await assert.rejects(operation, (error: unknown) => error instanceof AiGatewayError && error.code === code);
}

const results: string[] = [];
function pass(name: string, condition: unknown) { assert.ok(condition, name); results.push(name); }

async function main() {
{
  const response = await executeRuntimeAiRequest(request(), setup(new FakeGovernedAiTransport([{ type: "result", output: { answer: "ok", confidence: 1 } }])));
  pass("A6-01-responses-text-simple", response.status === "COMPLETED");
}
{
  const response = await executeRuntimeAiRequest(request(), setup(new FakeGovernedAiTransport([{ type: "result", output: { answer: "structured", confidence: 0.9 } }])));
  pass("A6-02-structured-output-valid", response.status === "COMPLETED" && typeof (response.output as { answer?: unknown }).answer === "string");
}
{
  const response = await executeRuntimeAiRequest(request(), setup(new FakeGovernedAiTransport([{ type: "empty" }])));
  pass("A6-03-structured-output-invalid-fallback", response.status === "DEGRADED" && response.reviewRequired);
}
{
  pass("A6-04-fast-reasoning-escalation", shouldEscalateToReasoning({ lane: "fast", ambiguityScore: 0.8 }));
}
{
  const transport = new FakeGovernedAiTransport([{ type: "result", output: { answer: "redacted", confidence: 1 } }]);
  await executeRuntimeAiRequest(request({ payload: { message: "synthetic@example.invalid ES0000000000000000000000 600000000", context: {} } }), setup(transport));
  const sent = JSON.stringify(transport.calls[0]?.payload);
  pass("A6-05-pii-redaction", !sent.includes("synthetic@example.invalid") && !sent.includes("600000000") && !sent.includes("ES0000000000000000000000"));
}
{
  const transport = new FakeGovernedAiTransport([{ type: "result", output: { answer: "never", confidence: 1 } }]);
  await expectCode("AI_COMPANY_NOT_ALLOWLISTED", () => executeRuntimeAiRequest(request({ companyId: "company-synthetic-b" }), setup(transport)));
  pass("A6-06-tenant-and-company-allowlist", transport.calls.length === 0);
}
{
  const policy = syntheticAiPolicy();
  const response = await executeRuntimeAiRequest(request({ lane: "transcription", purpose: "transcription", operationKey: "synthetic.transcription", payload: { audioRef: "synthetic-audio", mimeType: "audio/webm", sizeBytes: 128 }, outputSchema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } } }), {
    environment: baseEnvironment,
    store: new InMemoryAiGovernanceStore([policy]),
    transport: new FakeGovernedAiTransport([{ type: "result", output: { text: "audio sintético" } }]),
  });
  pass("A6-07-transcription-synthetic", response.status === "COMPLETED");
}
{
  await expectCode("AI_GLOBAL_BUDGET_EXCEEDED", () => executeRuntimeAiRequest(request(), setup(new FakeGovernedAiTransport(), { ...baseEnvironment, AI_GLOBAL_MONTHLY_BUDGET_EUR: "0.005" })));
  pass("A6-08-budget-hard-cap", true);
}
{
  const policy = syntheticAiPolicy(); policy.timeoutMs = 5;
  const response = await executeRuntimeAiRequest(request(), { environment: baseEnvironment, store: new InMemoryAiGovernanceStore([policy]), transport: new FakeGovernedAiTransport([{ type: "hang-until-abort" }]) });
  pass("A6-09-timeout-manual-fallback", response.status === "DEGRADED" && response.reasonCode === "AI_PROVIDER_TIMEOUT");
}
{
  const response = await executeRuntimeAiRequest(request({ sensitiveEffect: { type: "invoice.send", entityType: "Invoice", entityId: "invoice-synthetic", destination: "email-outbox" } }), setup(new FakeGovernedAiTransport([{ type: "result", output: { answer: "proposal", confidence: 1 } }])));
  pass("A6-10-human-confirmation-no-effect", response.status === "REQUIRES_CONFIRMATION");
}

console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AI_RUNTIME_SMOKE_FAILED");
  process.exitCode = 1;
});
