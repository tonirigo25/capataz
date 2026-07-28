import type { AiGatewayResponse, GovernedAiRequest } from "@/lib/ai/contracts";
import type {
  AcquiredAiOperation,
  AiCircuitRecord,
  AiGovernanceStore,
  AiPolicyRecord,
} from "@/lib/ai/governed-gateway";

type Operation = {
  companyId: string;
  idempotencyKey: string;
  requestHash: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  lockedUntil?: Date;
  response?: AiGatewayResponse;
  errorCode?: string;
};

export class InMemoryAiGovernanceStore implements AiGovernanceStore {
  readonly policies = new Map<string, AiPolicyRecord>();
  readonly operations = new Map<string, Operation>();
  readonly usage: Array<{
    id: string;
    companyId: string;
    actorIdHash: string;
    cost: number;
    requestId: string;
    correlationId: string;
    causationId?: string;
    requestHash: string;
    outputHash: string;
    estimated: boolean;
    retries: number;
    latencyMs: number;
  }> = [];
  readonly outbox: Array<{ companyId: string; idempotencyKey: string; outputHash: string }> = [];
  readonly circuits = new Map<string, AiCircuitRecord>();

  constructor(policies: AiPolicyRecord[] = []) {
    for (const policy of policies) this.policies.set(policy.companyId, policy);
  }

  getPolicy(companyId: string) {
    return Promise.resolve(this.policies.get(companyId) ?? null);
  }

  getMonthlySpend(companyId: string, actorIdHash: string) {
    return Promise.resolve({
      company: this.usage.filter((item) => item.companyId === companyId).reduce((sum, item) => sum + item.cost, 0),
      actor: this.usage.filter((item) => item.companyId === companyId && item.actorIdHash === actorIdHash).reduce((sum, item) => sum + item.cost, 0),
    });
  }

  countActiveOperations(companyId: string, now: Date) {
    return Promise.resolve([...this.operations.values()].filter((item) => item.companyId === companyId && item.status === "IN_PROGRESS" && item.lockedUntil && item.lockedUntil > now).length);
  }

  acquireOperation(input: {
    companyId: string;
    actorIdHash: string;
    purpose: string;
    idempotencyKey: string;
    requestHash: string;
    lockedUntil: Date;
    contentExpiresAt: Date;
  }): Promise<AcquiredAiOperation> {
    const key = `${input.companyId}:${input.idempotencyKey}`;
    const existing = this.operations.get(key);
    if (!existing) {
      this.operations.set(key, { companyId: input.companyId, idempotencyKey: input.idempotencyKey, requestHash: input.requestHash, status: "IN_PROGRESS", lockedUntil: input.lockedUntil });
      return Promise.resolve({ kind: "acquired" });
    }
    if (existing.requestHash !== input.requestHash) return Promise.resolve({ kind: "conflict", code: "AI_IDEMPOTENCY_KEY_REUSED" });
    if (existing.status === "COMPLETED" && existing.response) return Promise.resolve({ kind: "replay", response: existing.response });
    return Promise.resolve({ kind: "conflict", code: "AI_OPERATION_IN_PROGRESS" });
  }

  completeOperation(input: {
    request: GovernedAiRequest;
    requestHash: string;
    actorIdHash: string;
    response: AiGatewayResponse;
    outputHash: string;
    provider: string;
    providerReferenceHash?: string;
    model: string;
    modelSnapshot: string;
    inputTokens?: number;
    outputTokens?: number;
    costAmount?: number;
    estimatedUsage: boolean;
    latencyMs: number;
    retryCount: number;
    escalated: boolean;
    contentExpiresAt: Date;
    effectConfirmed: boolean;
  }) {
    const id = `usage-${this.usage.length + 1}`;
    this.usage.push({
      id,
      companyId: input.request.companyId,
      actorIdHash: input.actorIdHash,
      cost: input.costAmount ?? 0,
      requestId: input.request.requestId,
      correlationId: input.request.correlationId,
      causationId: input.request.causationId,
      requestHash: input.requestHash,
      outputHash: input.outputHash,
      estimated: input.estimatedUsage,
      retries: input.retryCount,
      latencyMs: input.latencyMs,
    });
    const key = `${input.request.companyId}:${input.request.idempotencyKey}`;
    this.operations.set(key, {
      companyId: input.request.companyId,
      idempotencyKey: input.request.idempotencyKey,
      requestHash: input.requestHash,
      status: "COMPLETED",
      response: input.response,
    });
    if (input.request.sensitiveEffect && input.effectConfirmed) this.outbox.push({ companyId: input.request.companyId, idempotencyKey: input.request.idempotencyKey, outputHash: input.outputHash });
    return Promise.resolve(id);
  }

  failOperation(input: { companyId: string; idempotencyKey: string; requestHash: string; errorCode: string; attemptCount: number }) {
    this.operations.set(`${input.companyId}:${input.idempotencyKey}`, {
      companyId: input.companyId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      status: "FAILED",
      errorCode: input.errorCode,
    });
    return Promise.resolve();
  }

  getCircuit(environment: string, provider: string): Promise<AiCircuitRecord> {
    return Promise.resolve(this.circuits.get(`${environment}:${provider}`) ?? { state: "CLOSED", consecutiveFailure: 0 });
  }

  circuitSucceeded(environment: string, provider: string) {
    this.circuits.set(`${environment}:${provider}`, { state: "CLOSED", consecutiveFailure: 0 });
    return Promise.resolve();
  }

  circuitFailed(input: { environment: string; provider: string; errorCode: string; now: Date; threshold: number; openedUntil: Date }) {
    const key = `${input.environment}:${input.provider}`;
    const failures = (this.circuits.get(key)?.consecutiveFailure ?? 0) + 1;
    this.circuits.set(key, {
      state: failures >= input.threshold ? "OPEN" : "CLOSED",
      consecutiveFailure: failures,
      openedUntil: failures >= input.threshold ? input.openedUntil : undefined,
    });
    return Promise.resolve();
  }
}

export function syntheticAiPolicy(companyId = "company-synthetic-a"): AiPolicyRecord {
  return {
    companyId,
    enabled: true,
    killSwitch: false,
    allowedPurposes: ["chat-command", "document-extraction"],
    prohibitedData: ["rawDocument", "bankAccount"],
    approvedModels: ["gpt-4.1-mini", "gpt-5.5"],
    allowedRoles: ["OWNER", "ADMIN"],
    allowedScopes: ["orqena.use", "documents.extract"],
    allowedFields: { "chat-command": ["message", "context"], "document-extraction": ["documentRef", "mimeType"] },
    approvedClassifications: ["PUBLIC", "INTERNAL", "CONFIDENTIAL"],
    dataProfile: "synthetic-minimized-v1",
    companyMonthlyBudget: 2,
    userMonthlyBudget: 1,
    operationBudget: 0.25,
    maxInputTokens: 1024,
    maxOutputTokens: 256,
    maxPayloadBytes: 4096,
    maxConcurrency: 2,
    timeoutMs: 50,
    retentionDays: 7,
    humanReviewRequired: true,
    sensitiveEffectsNeedOutbox: true,
  };
}
