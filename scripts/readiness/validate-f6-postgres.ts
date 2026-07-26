import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { FakeGovernedAiTransport } from "../../lib/ai/fake-transport";
import { executeGovernedAiRequest } from "../../lib/ai/governed-gateway";
import { PrismaAiGovernanceStore } from "../../lib/ai/prisma-store";
import { aiUsageSummary, purgeExpiredAiContent, recordAiReview, setCompanyAiKillSwitch } from "../../lib/ai/governance-service";
import type { GovernedAiRequest, StrictJsonSchema } from "../../lib/ai/contracts";

const prisma = new PrismaClient();
const now = new Date("2026-07-26T16:00:00.000Z");
const schema: StrictJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "confidence"],
  properties: { decision: { type: "string", minLength: 1 }, confidence: { type: "number", minimum: 0, maximum: 1 } },
};

async function main() {
  let passed = 0;
  async function check(name: string, operation: () => unknown | Promise<unknown>) {
    await operation();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  }

  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations[0]?.count, 43);
  const suffix = Date.now().toString(36);
  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { slug: `f6-a-${suffix}`, nombreComercial: "F6 Synthetic Alpha" } }),
    prisma.company.create({ data: { slug: `f6-b-${suffix}`, nombreComercial: "F6 Synthetic Beta" } }),
  ]);
  const [userA, userB] = await Promise.all([
    prisma.user.create({ data: { email: `f6-a-${suffix}@example.invalid`, emailNormalized: `f6-a-${suffix}@example.invalid`, passwordHash: "synthetic-only", displayName: "F6 Alpha", status: "active" } }),
    prisma.user.create({ data: { email: `f6-b-${suffix}@example.invalid`, emailNormalized: `f6-b-${suffix}@example.invalid`, passwordHash: "synthetic-only", displayName: "F6 Beta", status: "active" } }),
  ]);
  for (const company of [companyA, companyB]) await prisma.companyAiPolicy.create({
    data: {
      companyId: company.id,
      enabled: true,
      killSwitch: false,
      allowedPurposes: ["chat-command"],
      prohibitedData: ["rawDocument", "bankAccount"],
      approvedModels: ["gpt-4.1-mini", "gpt-5.5"],
      allowedRoles: ["OWNER"],
      allowedScopes: ["orqena.use"],
      allowedFields: { "chat-command": ["message", "context"] },
      approvedClassifications: ["INTERNAL"],
      dataProfile: "synthetic-minimized-v1",
      companyMonthlyBudget: 1,
      userMonthlyBudget: 0.5,
      operationBudget: 0.1,
      maxInputTokens: 1024,
      maxOutputTokens: 128,
      maxPayloadBytes: 4096,
      maxConcurrency: 2,
      timeoutMs: 50,
      retentionDays: 7,
      humanReviewRequired: true,
      sensitiveEffectsNeedOutbox: true,
    },
  });

  const store = new PrismaAiGovernanceStore(prisma);
  const transport = new FakeGovernedAiTransport([{ type: "result", output: { decision: "synthetic-review", confidence: 0.91 }, inputTokens: 24, outputTokens: 9, costEur: 0.00003 }]);
  let serial = 0;
  const request = (overrides: Partial<GovernedAiRequest> = {}): GovernedAiRequest => {
    serial += 1;
    return {
      companyId: companyA.id,
      actorId: userA.id,
      role: "OWNER",
      scopes: ["orqena.use"],
      purpose: "chat-command",
      classification: "INTERNAL",
      operationKey: "chat.interpret",
      idempotencyKey: `f6-pg-${serial}`,
      lane: "fast",
      promptVersion: "chat-command.v1",
      schemaVersion: 1,
      payload: { message: "Fixture sintética sin datos reales", context: { companyId: companyA.id } },
      outputSchema: schema,
      maxOutputTokens: 64,
      estimatedCostCeilingEur: 0.01,
      requestId: `f6-request-${serial}`,
      correlationId: `f6-correlation-${serial}`,
      causationId: `f6-causation-${serial}`,
      ...overrides,
    };
  };
  const deps = { store, transport, environment: "test", globalEnabled: true, now: () => now, monotonicNow: (() => { let value = 50; return () => ++value; })(), sleep: async () => undefined, random: () => 0 };

  let usageEventId = "";
  await check("governed fake call persists versioned usage without content", async () => {
    const result = await executeGovernedAiRequest(request({ payload: { message: `Escribe a synthetic@example.invalid y no guardes el secreto sk-${"proj-synthetic"}`, context: { companyId: companyA.id } } }), deps);
    assert.equal(result.status, "COMPLETED");
    usageEventId = result.usageEventId ?? "";
    const usage = await prisma.aiUsageEvent.findUniqueOrThrow({ where: { id: usageEventId }, include: { modelVersion: true, promptVersion: true } });
    assert.equal(usage.storeRequested, false);
    assert.equal(usage.estimatedUsage, true);
    assert.equal(usage.inputTokens, 24);
    assert.equal(usage.outputTokens, 9);
    assert.equal(Number(usage.costAmount), 0.00003);
    assert.equal(usage.requestId?.startsWith("f6-request-"), true);
    assert.equal(usage.correlationId?.startsWith("f6-correlation-"), true);
    assert.equal(usage.modelVersion.version, "synthetic-fast-v1");
    assert.equal(usage.promptVersion.version, "chat-command.v1");
    assert.doesNotMatch(JSON.stringify(usage), /synthetic@example\.invalid|sk-proj-synthetic/);
  });

  await check("database idempotency replays without a second provider call", async () => {
    const replayRequest = request();
    const first = await executeGovernedAiRequest(replayRequest, deps);
    const calls = transport.calls.length;
    const replay = await executeGovernedAiRequest(replayRequest, deps);
    assert.equal(first.status, "COMPLETED");
    assert.equal(replay.replayed, true);
    assert.equal(transport.calls.length, calls);
    assert.equal(await prisma.aiUsageEvent.count({ where: { idempotencyKey: replayRequest.idempotencyKey } }), 1);
  });

  await check("tenant B cannot be injected into tenant A context", async () => {
    await assert.rejects(() => executeGovernedAiRequest(request({ payload: { message: "synthetic", context: { companyId: companyB.id } } }), deps), /AI_CROSS_TENANT_CONTEXT_REJECTED/);
    assert.equal(await prisma.aiUsageEvent.count({ where: { companyId: companyB.id } }), 0);
  });

  await check("sensitive proposal requires confirmation before outbox", async () => {
    const effect = { type: "invoice.send", entityType: "Invoice", entityId: `invoice-${suffix}`, destination: "email-outbox" };
    const unconfirmed = await executeGovernedAiRequest(request({ sensitiveEffect: effect }), deps);
    assert.equal(unconfirmed.status, "REQUIRES_CONFIRMATION");
    assert.equal(await prisma.businessEvent.count({ where: { companyId: companyA.id, type: "ai.effect.proposed" } }), 0);
    const confirmed = await executeGovernedAiRequest(request({ sensitiveEffect: { ...effect, confirmation: `CONFIRM_AI_EFFECT:invoice.send:invoice-${suffix}` } }), deps);
    assert.equal(confirmed.status, "COMPLETED");
    const event = await prisma.businessEvent.findFirstOrThrow({ where: { companyId: companyA.id, type: "ai.effect.proposed" } });
    assert.equal(event.deliveryStatus, "PENDING");
    assert.doesNotMatch(JSON.stringify(event.payloadSanitized), /synthetic-review|prompt|document/i);
  });

  await check("review metrics are company scoped", async () => {
    await recordAiReview(prisma, { companyId: companyA.id, actorId: userA.id, usageEventId, outcome: "CORRECTED", correctionKinds: ["amount", "tax"], reasonCode: "synthetic_correction" });
    await assert.rejects(() => recordAiReview(prisma, { companyId: companyB.id, actorId: userB.id, usageEventId, outcome: "ACCEPTED" }), /AI_USAGE_EVENT_NOT_FOUND/);
    const summary = await aiUsageSummary(prisma, { companyId: companyA.id, since: new Date("2026-01-01T00:00:00.000Z") });
    assert.equal(summary.reviewOutcomes.CORRECTED, 1);
    assert.equal(summary.callCount >= 4, true);
  });

  await check("expired response content is purged while hashes remain", async () => {
    const result = await purgeExpiredAiContent(prisma, new Date("2026-08-10T00:00:00.000Z"));
    assert.equal(result.operationsPurged >= 1, true);
    const operation = await prisma.aiGatewayOperation.findFirstOrThrow({ where: { companyId: companyA.id, status: "COMPLETED" } });
    assert.equal(operation.responseEnvelope, null);
    assert.match(operation.responseHash ?? "", /^[a-f0-9]{64}$/);
    assert(operation.contentPurgedAt);
    const usage = await prisma.aiUsageEvent.findUniqueOrThrow({ where: { id: usageEventId } });
    assert.match(usage.requestHash, /^[a-f0-9]{64}$/);
    assert.match(usage.outputHash ?? "", /^[a-f0-9]{64}$/);
    assert(usage.contentPurgedAt);
  });

  await check("kill switch blocks before provider invocation", async () => {
    await setCompanyAiKillSwitch(prisma, { companyId: companyA.id, actorId: userA.id, killSwitch: true });
    const calls = transport.calls.length;
    await assert.rejects(() => executeGovernedAiRequest(request(), deps), /AI_DISABLED_FAIL_CLOSED/);
    assert.equal(transport.calls.length, calls);
    assert.equal(await prisma.auditLog.count({ where: { companyId: companyA.id, action: "ai.kill_switch.enabled" } }), 1);
  });

  await check("no credential or raw prompt reached persisted AI evidence", async () => {
    const rows = await prisma.$queryRaw<Array<{ blob: string }>>`
      SELECT CONCAT_WS(' ', COALESCE(u."metadata"::text, ''), COALESCE(o."responseEnvelope"::text, ''), COALESCE(u."errorCode", ''), COALESCE(o."errorCode", '')) AS blob
      FROM "AiUsageEvent" u LEFT JOIN "AiGatewayOperation" o ON u."companyId" = o."companyId"
      WHERE u."companyId" = ${companyA.id}`;
    const blob = rows.map((row) => row.blob).join(" ");
    assert.doesNotMatch(blob, /sk-proj-|synthetic@example\.invalid|Ignora las reglas|OPENAI_API_KEY/i);
  });

  console.log(JSON.stringify({ ok: true, passed, migrations: migrations[0]?.count, providerCalls: transport.calls.length, liveCalls: 0 }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
