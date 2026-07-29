import { setTimeout as delay } from "node:timers/promises";
import {
  AiGatewayError,
  AiTransportError,
  type AiGatewayResponse,
  type AiTransport,
  type GovernedAiRequest,
  type JsonValue,
} from "@/lib/ai/contracts";
import { hashJson, minimizeAndRedactPayload, stableReference } from "@/lib/ai/redaction";
import { resolveAiModel } from "@/lib/ai/model-policy";
import { assertStrictJsonSchema, validateJsonSchema } from "@/lib/ai/schema-validation";

export type AiPolicyRecord = {
  companyId: string;
  enabled: boolean;
  killSwitch: boolean;
  allowedPurposes: string[];
  prohibitedData: string[];
  approvedModels: string[];
  allowedRoles: string[];
  allowedScopes: string[];
  allowedFields: Record<string, string[]>;
  approvedClassifications: string[];
  dataProfile: string;
  companyMonthlyBudget: number;
  userMonthlyBudget: number;
  operationBudget: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxPayloadBytes: number;
  maxConcurrency: number;
  timeoutMs: number;
  retentionDays: number;
  humanReviewRequired: boolean;
  sensitiveEffectsNeedOutbox: boolean;
};

export type AiCircuitRecord = {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  consecutiveFailure: number;
  openedUntil?: Date;
};

export type AcquiredAiOperation =
  | { kind: "acquired" }
  | { kind: "replay"; response: AiGatewayResponse }
  | { kind: "conflict"; code: "AI_IDEMPOTENCY_KEY_REUSED" | "AI_OPERATION_IN_PROGRESS" };

export interface AiGovernanceStore {
  getPolicy(companyId: string): Promise<AiPolicyRecord | null>;
  getUsage(input: {
    companyId: string;
    actorIdHash: string;
    monthStart: Date;
    dayStart: Date;
  }): Promise<{ global: number; company: number; actor: number; actorDailyRequests: number }>;
  countActiveOperations(companyId: string, now: Date): Promise<number>;
  acquireOperation(input: {
    companyId: string;
    actorIdHash: string;
    purpose: string;
    idempotencyKey: string;
    requestHash: string;
    lockedUntil: Date;
    contentExpiresAt: Date;
    monthStart: Date;
    dayStart: Date;
    estimatedCostCeilingEur: number;
    globalMonthlyBudgetEur: number;
    companyMonthlyBudgetEur: number;
    userMonthlyBudgetEur: number;
    userDailyRequestLimit: number;
  }): Promise<AcquiredAiOperation>;
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
  }): Promise<string>;
  failOperation(input: {
    companyId: string;
    idempotencyKey: string;
    requestHash: string;
    errorCode: string;
    attemptCount: number;
  }): Promise<void>;
  getCircuit(environment: string, provider: string): Promise<AiCircuitRecord>;
  circuitSucceeded(environment: string, provider: string): Promise<void>;
  circuitFailed(input: { environment: string; provider: string; errorCode: string; now: Date; threshold: number; openedUntil: Date }): Promise<void>;
}

export type GovernedAiDependencies = {
  store: AiGovernanceStore;
  transport: AiTransport;
  environment: string;
  globalEnabled: boolean;
  companyAllowlist?: readonly string[];
  globalMonthlyBudgetEur?: number;
  companyMonthlyBudgetEur?: number;
  userDailyRequestLimit?: number;
  maxInputTokensPerRequest?: number;
  maxOutputTokensPerRequest?: number;
  liveConfigurationComplete?: boolean;
  modelEnvironment?: NodeJS.ProcessEnv;
  now?: () => Date;
  monotonicNow?: () => number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
};

const MAX_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function asPositiveFinite(value: number, code: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new AiGatewayError(code);
  return value;
}

function safeRequest(request: GovernedAiRequest): void {
  const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  for (const [name, value] of Object.entries({
    companyId: request.companyId,
    actorId: request.actorId,
    purpose: request.purpose,
    operationKey: request.operationKey,
    idempotencyKey: request.idempotencyKey,
    requestId: request.requestId,
    correlationId: request.correlationId,
  })) if (!safeId.test(value)) throw new AiGatewayError("AI_INVALID_IDENTIFIER", name);
  if (request.causationId && !safeId.test(request.causationId)) throw new AiGatewayError("AI_INVALID_IDENTIFIER", "causationId");
  asPositiveFinite(request.maxOutputTokens, "AI_INVALID_OUTPUT_LIMIT");
  asPositiveFinite(request.estimatedCostCeilingEur, "AI_INVALID_COST_CEILING");
  if (!Number.isInteger(request.schemaVersion) || request.schemaVersion < 1) throw new AiGatewayError("AI_INVALID_SCHEMA_VERSION");
}

function deterministicFallback(reasonCode: string, schemaVersion: number): AiGatewayResponse {
  return {
    status: "DEGRADED",
    source: "deterministic-fallback",
    output: {
      reasonCode,
      message: "La ayuda automática no está disponible. Continúa con el flujo manual y revisa los datos antes de guardar.",
      manualAction: "continue-manually",
    },
    reviewRequired: true,
    schemaVersion,
    reasonCode,
  };
}

function parseRetryable(error: unknown): AiTransportError {
  if (error instanceof AiTransportError) return error;
  if (error instanceof AiGatewayError) return new AiTransportError(error.code, { retryable: false, status: error.status, cause: error });
  if (error instanceof DOMException && error.name === "AbortError") return new AiTransportError("AI_PROVIDER_TIMEOUT", { retryable: true, cause: error });
  if (error instanceof Error && error.name === "AbortError") return new AiTransportError("AI_PROVIDER_TIMEOUT", { retryable: true, cause: error });
  return new AiTransportError("AI_PROVIDER_FAILURE", { retryable: false, cause: error });
}

function canRetry(error: AiTransportError): boolean {
  return error.retryable && (error.status === undefined || RETRYABLE_STATUS.has(error.status));
}

async function callWithTimeout<T>(input: {
  timeoutMs: number;
  operation: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    return await input.operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeGovernedAiRequest(
  request: GovernedAiRequest,
  dependencies: GovernedAiDependencies,
): Promise<AiGatewayResponse> {
  safeRequest(request);
  assertStrictJsonSchema(request.outputSchema);
  const now = dependencies.now?.() ?? new Date();
  const monotonicNow = dependencies.monotonicNow ?? (() => Date.now());
  const sleep = dependencies.sleep ?? ((milliseconds, signal) => delay(milliseconds, undefined, { signal }));
  const random = dependencies.random ?? Math.random;
  const actorIdHash = stableReference(request.actorId);
  const policy = await dependencies.store.getPolicy(request.companyId);
  if (!dependencies.globalEnabled || !policy?.enabled || policy.killSwitch) throw new AiGatewayError("AI_DISABLED_FAIL_CLOSED");
  if (dependencies.companyAllowlist && !dependencies.companyAllowlist.includes(request.companyId)) throw new AiGatewayError("AI_COMPANY_NOT_ALLOWLISTED");
  if (dependencies.transport.mode === "live" && !dependencies.liveConfigurationComplete) throw new AiGatewayError("AI_LIVE_CONFIGURATION_INCOMPLETE");
  if (!policy.allowedPurposes.includes(request.purpose)) throw new AiGatewayError("AI_PURPOSE_NOT_ALLOWED");
  if (!policy.allowedRoles.includes(request.role)) throw new AiGatewayError("AI_ROLE_NOT_ALLOWED");
  if (!request.scopes.some((scope) => policy.allowedScopes.includes(scope))) throw new AiGatewayError("AI_SCOPE_NOT_ALLOWED");
  if (!policy.approvedClassifications.includes(request.classification)) throw new AiGatewayError("AI_CLASSIFICATION_NOT_ALLOWED");
  if (policy.prohibitedData.some((field) => Object.hasOwn(request.payload, field))) throw new AiGatewayError("AI_PROHIBITED_DATA_PRESENT");

  const minimizedPayload = minimizeAndRedactPayload({
    payload: request.payload,
    allowedFields: policy.allowedFields[request.purpose] ?? [],
    companyId: request.companyId,
  });
  const serializedBytes = Buffer.byteLength(JSON.stringify(minimizedPayload));
  const approximateInputTokens = Math.ceil(serializedBytes / 4);
  const companyMonthlyBudgetEur = Math.min(
    policy.companyMonthlyBudget,
    asPositiveFinite(dependencies.companyMonthlyBudgetEur ?? policy.companyMonthlyBudget, "AI_COMPANY_BUDGET_INVALID"),
  );
  const maxInputTokens = Math.min(
    policy.maxInputTokens,
    asPositiveFinite(dependencies.maxInputTokensPerRequest ?? policy.maxInputTokens, "AI_INPUT_LIMIT_INVALID"),
  );
  const maxOutputTokens = Math.min(
    policy.maxOutputTokens,
    asPositiveFinite(dependencies.maxOutputTokensPerRequest ?? policy.maxOutputTokens, "AI_OUTPUT_LIMIT_INVALID"),
  );
  if (serializedBytes > policy.maxPayloadBytes) throw new AiGatewayError("AI_PAYLOAD_LIMIT_EXCEEDED");
  if (approximateInputTokens > maxInputTokens) throw new AiGatewayError("AI_INPUT_TOKEN_LIMIT_EXCEEDED");
  if (request.maxOutputTokens > maxOutputTokens) throw new AiGatewayError("AI_OUTPUT_TOKEN_LIMIT_EXCEEDED");
  if (request.estimatedCostCeilingEur > policy.operationBudget) throw new AiGatewayError("AI_OPERATION_BUDGET_EXCEEDED");

  const globalMonthlyBudgetEur = asPositiveFinite(dependencies.globalMonthlyBudgetEur ?? 25, "AI_GLOBAL_BUDGET_INVALID");
  const userDailyRequestLimit = asPositiveFinite(dependencies.userDailyRequestLimit ?? 50, "AI_USER_DAILY_LIMIT_INVALID");
  if (!Number.isInteger(userDailyRequestLimit)) throw new AiGatewayError("AI_USER_DAILY_LIMIT_INVALID");
  const currentMonth = monthStart(now);
  const currentDay = dayStart(now);
  const spend = await dependencies.store.getUsage({ companyId: request.companyId, actorIdHash, monthStart: currentMonth, dayStart: currentDay });
  if (spend.global + request.estimatedCostCeilingEur > globalMonthlyBudgetEur) throw new AiGatewayError("AI_GLOBAL_BUDGET_EXCEEDED");
  if (spend.company + request.estimatedCostCeilingEur > companyMonthlyBudgetEur) throw new AiGatewayError("AI_COMPANY_BUDGET_EXCEEDED");
  if (spend.actor + request.estimatedCostCeilingEur > policy.userMonthlyBudget) throw new AiGatewayError("AI_USER_BUDGET_EXCEEDED");
  if (spend.actorDailyRequests >= userDailyRequestLimit) throw new AiGatewayError("AI_USER_DAILY_REQUEST_LIMIT_EXCEEDED");
  if (await dependencies.store.countActiveOperations(request.companyId, now) >= policy.maxConcurrency) throw new AiGatewayError("AI_CONCURRENCY_LIMIT_EXCEEDED");

  const model = resolveAiModel({
    lane: request.lane,
    approvedModels: policy.approvedModels,
    environment: dependencies.modelEnvironment,
    live: dependencies.transport.mode === "live",
  });
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, asPositiveFinite(policy.timeoutMs, "AI_INVALID_TIMEOUT"));
  const contentExpiresAt = new Date(now.getTime() + policy.retentionDays * 86_400_000);
  const requestHash = hashJson({
    contractVersion: 1,
    companyId: request.companyId,
    actorIdHash,
    purpose: request.purpose,
    lane: request.lane,
    promptVersion: request.promptVersion,
    schemaVersion: request.schemaVersion,
    outputSchema: request.outputSchema,
    providerModel: model.providerModel,
    modelSnapshot: model.modelSnapshot,
    maxOutputTokens: request.maxOutputTokens,
    payload: minimizedPayload,
  });
  const acquired = await dependencies.store.acquireOperation({
    companyId: request.companyId,
    actorIdHash,
    purpose: request.purpose,
    idempotencyKey: request.idempotencyKey,
    requestHash,
    lockedUntil: new Date(now.getTime() + timeoutMs * model.maxAttempts),
    contentExpiresAt,
    monthStart: currentMonth,
    dayStart: currentDay,
    estimatedCostCeilingEur: request.estimatedCostCeilingEur,
    globalMonthlyBudgetEur,
    companyMonthlyBudgetEur,
    userMonthlyBudgetEur: policy.userMonthlyBudget,
    userDailyRequestLimit,
  });
  if (acquired.kind === "conflict") throw new AiGatewayError(acquired.code);
  if (acquired.kind === "replay") return { ...acquired.response, source: "idempotent-replay", replayed: true };

  const circuit = await dependencies.store.getCircuit(dependencies.environment, dependencies.transport.name);
  if (circuit.state === "OPEN" && circuit.openedUntil && circuit.openedUntil > now) {
    const fallback = deterministicFallback("AI_CIRCUIT_OPEN", request.schemaVersion);
    await dependencies.store.failOperation({ companyId: request.companyId, idempotencyKey: request.idempotencyKey, requestHash, errorCode: "AI_CIRCUIT_OPEN", attemptCount: 0 });
    return fallback;
  }

  const startedAt = monotonicNow();
  let transportResult: Awaited<ReturnType<AiTransport["complete"]>> | undefined;
  let lastError: AiTransportError | undefined;
  let attempts = 0;
  for (let attempt = 1; attempt <= model.maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      const candidate = await callWithTimeout({
        timeoutMs,
        operation: (signal) => dependencies.transport.complete({
          model: model.providerModel,
          modelSnapshot: model.modelSnapshot,
          lane: request.lane,
          purpose: request.purpose,
          promptVersion: request.promptVersion,
          schemaVersion: request.schemaVersion,
          payload: minimizedPayload,
          outputSchema: request.outputSchema,
          maxOutputTokens: request.maxOutputTokens,
          store: false,
          idempotencyKey: request.idempotencyKey,
          metadata: {
            purpose: request.purpose,
            prompt_version: request.promptVersion,
            schema_version: String(request.schemaVersion),
            company_ref: stableReference(request.companyId),
            actor_ref: actorIdHash,
            correlation_ref: stableReference(request.correlationId),
          },
          signal,
        }),
      });
      validateJsonSchema(candidate.output, request.outputSchema);
      transportResult = candidate;
      break;
    } catch (error) {
      lastError = parseRetryable(error);
      if (!canRetry(lastError) || attempt === model.maxAttempts) break;
      const base = Math.min(2_000, 100 * 2 ** (attempt - 1));
      const jitter = Math.floor(base * 0.25 * Math.max(0, Math.min(1, random())));
      await sleep(base + jitter);
    }
  }

  if (!transportResult) {
    const code = lastError?.code ?? "AI_PROVIDER_FAILURE";
    await dependencies.store.failOperation({ companyId: request.companyId, idempotencyKey: request.idempotencyKey, requestHash, errorCode: code, attemptCount: attempts });
    await dependencies.store.circuitFailed({
      environment: dependencies.environment,
      provider: dependencies.transport.name,
      errorCode: code,
      now,
      threshold: 3,
      openedUntil: new Date(now.getTime() + 30_000),
    });
    return deterministicFallback(code, request.schemaVersion);
  }

  await dependencies.store.circuitSucceeded(dependencies.environment, dependencies.transport.name);
  const expectedConfirmation = request.sensitiveEffect
    ? `CONFIRM_AI_EFFECT:${request.sensitiveEffect.type}:${request.sensitiveEffect.entityId}`
    : undefined;
  const effectConfirmed = !request.sensitiveEffect || (!policy.humanReviewRequired && !policy.sensitiveEffectsNeedOutbox)
    || request.sensitiveEffect.confirmation === expectedConfirmation;
  const response: AiGatewayResponse = {
    status: request.sensitiveEffect && !effectConfirmed ? "REQUIRES_CONFIRMATION" : "COMPLETED",
    source: dependencies.transport.mode === "fake" ? "fake" : "openai",
    output: transportResult.output,
    reviewRequired: policy.humanReviewRequired || Boolean(request.sensitiveEffect),
    schemaVersion: request.schemaVersion,
  };
  const conservativelyEstimatedCost = transportResult.estimatedCostEur ?? request.estimatedCostCeilingEur;
  const usageEventId = await dependencies.store.completeOperation({
    request,
    requestHash,
    actorIdHash,
    response,
    outputHash: hashJson(transportResult.output),
    provider: transportResult.provider,
    providerReferenceHash: transportResult.providerReference ? stableReference(transportResult.providerReference) : undefined,
    model: transportResult.model,
    modelSnapshot: transportResult.modelSnapshot,
    inputTokens: transportResult.inputTokens,
    outputTokens: transportResult.outputTokens,
    costAmount: conservativelyEstimatedCost,
    estimatedUsage: transportResult.usageIsSyntheticOrEstimated || transportResult.estimatedCostEur === undefined,
    latencyMs: Math.max(0, Math.round(monotonicNow() - startedAt)),
    retryCount: attempts - 1,
    escalated: request.lane === "reasoning",
    contentExpiresAt,
    effectConfirmed,
  });
  return { ...response, usageEventId };
}

export function safeAiUsageLog(input: {
  event: string;
  requestId: string;
  correlationId: string;
  companyId: string;
  actorId: string;
  purpose: string;
  outcome: string;
  tokens?: number;
  cost?: number;
  latencyMs?: number;
}): Record<string, string | number> {
  return {
    event: input.event,
    requestId: input.requestId,
    correlationId: input.correlationId,
    companyRef: stableReference(input.companyId),
    actorRef: stableReference(input.actorId),
    purpose: input.purpose,
    outcome: input.outcome,
    ...(input.tokens === undefined ? {} : { tokens: input.tokens }),
    ...(input.cost === undefined ? {} : { cost: input.cost }),
    ...(input.latencyMs === undefined ? {} : { latencyMs: input.latencyMs }),
  };
}

export function assertNoRawContentInUsageLog(log: Record<string, unknown>): void {
  const forbiddenKeys = /prompt|payload|content|output|input|secret|tokenValue|authorization/i;
  for (const key of Object.keys(log)) if (forbiddenKeys.test(key)) throw new AiGatewayError("AI_USAGE_LOG_CONTAINS_RAW_CONTENT", key);
}

export function jsonObject(value: JsonValue): Record<string, JsonValue> {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new AiGatewayError("AI_JSON_OBJECT_REQUIRED");
  return value;
}
