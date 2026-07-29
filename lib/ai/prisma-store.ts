import { Prisma, type PrismaClient } from "@prisma/client";
import { AiGatewayError, type AiGatewayResponse, type GovernedAiRequest } from "@/lib/ai/contracts";
import type {
  AcquiredAiOperation,
  AiCircuitRecord,
  AiGovernanceStore,
  AiPolicyRecord,
} from "@/lib/ai/governed-gateway";
import { hashJson } from "@/lib/ai/redaction";
import {
  acquireEntitlementLimitLock,
  assertEntitlementMutationAllowed,
  currentUsagePeriod,
} from "@/lib/commercial/usage";

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fieldMap(value: Prisma.JsonValue): Record<string, string[]> {
  if (value === null || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, Array.isArray(child) ? child.filter((item): item is string => typeof item === "string") : []]));
}

function replayEnvelope(value: Prisma.JsonValue | null): AiGatewayResponse | null {
  if (value === null || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, Prisma.JsonValue>;
  if (!(["COMPLETED", "DEGRADED", "REQUIRES_CONFIRMATION"] as const).includes(record.status as never)) return null;
  if (!(["fake", "openai", "deterministic-fallback", "idempotent-replay"] as const).includes(record.source as never)) return null;
  if (typeof record.reviewRequired !== "boolean" || typeof record.schemaVersion !== "number" || !("output" in record)) return null;
  return record as unknown as AiGatewayResponse;
}

function reservedCost(value: Prisma.JsonValue | null): number {
  if (value === null || Array.isArray(value) || typeof value !== "object") return 0;
  const amount = (value as Record<string, Prisma.JsonValue>).budgetReservationEur;
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export class PrismaAiGovernanceStore implements AiGovernanceStore {
  constructor(private readonly prisma: PrismaClient) {}

  async getPolicy(companyId: string): Promise<AiPolicyRecord | null> {
    const policy = await this.prisma.companyAiPolicy.findUnique({ where: { companyId } });
    if (!policy) return null;
    return {
      companyId: policy.companyId,
      enabled: policy.enabled,
      killSwitch: policy.killSwitch,
      allowedPurposes: stringArray(policy.allowedPurposes),
      prohibitedData: stringArray(policy.prohibitedData),
      approvedModels: stringArray(policy.approvedModels),
      allowedRoles: stringArray(policy.allowedRoles),
      allowedScopes: stringArray(policy.allowedScopes),
      allowedFields: fieldMap(policy.allowedFields),
      approvedClassifications: stringArray(policy.approvedClassifications),
      dataProfile: policy.dataProfile,
      companyMonthlyBudget: Number(policy.companyMonthlyBudget),
      userMonthlyBudget: Number(policy.userMonthlyBudget),
      operationBudget: Number(policy.operationBudget),
      maxInputTokens: policy.maxInputTokens,
      maxOutputTokens: policy.maxOutputTokens,
      maxPayloadBytes: policy.maxPayloadBytes,
      maxConcurrency: policy.maxConcurrency,
      timeoutMs: policy.timeoutMs,
      retentionDays: policy.retentionDays,
      humanReviewRequired: policy.humanReviewRequired,
      sensitiveEffectsNeedOutbox: policy.sensitiveEffectsNeedOutbox,
    };
  }

  async getUsage(input: { companyId: string; actorIdHash: string; monthStart: Date; dayStart: Date }) {
    const [global, company, actor, actorDailyRequests] = await Promise.all([
      this.prisma.aiUsageEvent.aggregate({ where: { createdAt: { gte: input.monthStart } }, _sum: { costAmount: true } }),
      this.prisma.aiUsageEvent.aggregate({ where: { companyId: input.companyId, createdAt: { gte: input.monthStart } }, _sum: { costAmount: true } }),
      this.prisma.aiUsageEvent.aggregate({ where: { companyId: input.companyId, actorIdHash: input.actorIdHash, createdAt: { gte: input.monthStart } }, _sum: { costAmount: true } }),
      this.prisma.aiUsageEvent.count({ where: { companyId: input.companyId, actorIdHash: input.actorIdHash, createdAt: { gte: input.dayStart } } }),
    ]);
    return { global: Number(global._sum.costAmount ?? 0), company: Number(company._sum.costAmount ?? 0), actor: Number(actor._sum.costAmount ?? 0), actorDailyRequests };
  }

  countActiveOperations(companyId: string, now: Date) {
    return this.prisma.aiGatewayOperation.count({ where: { companyId, status: "IN_PROGRESS", lockedUntil: { gt: now } } });
  }

  async acquireOperation(input: {
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
  }): Promise<AcquiredAiOperation> {
    return this.prisma.$transaction(async (transaction) => {
      const { periodStart, periodEnd } = currentUsagePeriod();
      await acquireEntitlementLimitLock(
        transaction,
        input.companyId,
        "monthly_orqena_actions",
        periodStart.toISOString(),
      );
      const existing = await transaction.aiGatewayOperation.findUnique({
        where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        if (existing.requestHash !== input.requestHash)
          return {
            kind: "conflict",
            code: "AI_IDEMPOTENCY_KEY_REUSED",
          };
        if (existing.status === "COMPLETED") {
          const response = replayEnvelope(existing.responseEnvelope);
          if (response) return { kind: "replay", response };
        }
        if (existing.status !== "FAILED") return { kind: "conflict", code: "AI_OPERATION_IN_PROGRESS" };
      }
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(178527291)`;
      const [global, company, actor, actorDailyRequests, activeOperations] = await Promise.all([
        transaction.aiUsageEvent.aggregate({ where: { createdAt: { gte: input.monthStart } }, _sum: { costAmount: true } }),
        transaction.aiUsageEvent.aggregate({ where: { companyId: input.companyId, createdAt: { gte: input.monthStart } }, _sum: { costAmount: true } }),
        transaction.aiUsageEvent.aggregate({ where: { companyId: input.companyId, actorIdHash: input.actorIdHash, createdAt: { gte: input.monthStart } }, _sum: { costAmount: true } }),
        transaction.aiUsageEvent.count({ where: { companyId: input.companyId, actorIdHash: input.actorIdHash, createdAt: { gte: input.dayStart } } }),
        transaction.aiGatewayOperation.findMany({
          where: { status: "IN_PROGRESS", lockedUntil: { gt: new Date() }, createdAt: { gte: input.monthStart } },
          select: { companyId: true, actorIdHash: true, responseEnvelope: true, createdAt: true },
        }),
      ]);
      const globalReserved = activeOperations.reduce((sum, item) => sum + reservedCost(item.responseEnvelope), 0);
      const companyReserved = activeOperations.filter((item) => item.companyId === input.companyId).reduce((sum, item) => sum + reservedCost(item.responseEnvelope), 0);
      const actorReserved = activeOperations.filter((item) => item.companyId === input.companyId && item.actorIdHash === input.actorIdHash).reduce((sum, item) => sum + reservedCost(item.responseEnvelope), 0);
      const actorDailyInFlight = activeOperations.filter((item) => item.companyId === input.companyId && item.actorIdHash === input.actorIdHash && item.createdAt >= input.dayStart).length;
      if (Number(global._sum.costAmount ?? 0) + globalReserved + input.estimatedCostCeilingEur > input.globalMonthlyBudgetEur) throw new AiGatewayError("AI_GLOBAL_BUDGET_EXCEEDED");
      if (Number(company._sum.costAmount ?? 0) + companyReserved + input.estimatedCostCeilingEur > input.companyMonthlyBudgetEur) throw new AiGatewayError("AI_COMPANY_BUDGET_EXCEEDED");
      if (Number(actor._sum.costAmount ?? 0) + actorReserved + input.estimatedCostCeilingEur > input.userMonthlyBudgetEur) throw new AiGatewayError("AI_USER_BUDGET_EXCEEDED");
      if (actorDailyRequests + actorDailyInFlight >= input.userDailyRequestLimit) throw new AiGatewayError("AI_USER_DAILY_REQUEST_LIMIT_EXCEEDED");
      await assertEntitlementMutationAllowed(transaction, {
        companyId: input.companyId,
        limitKey: "monthly_orqena_actions",
        lockScope: periodStart.toISOString(),
        audit: {
          origin: "ai_gateway",
          targetType: "AiGatewayOperation",
        },
        measure: async (tx) => {
          const [completedUsage, operationsInFlight] = await Promise.all([
            tx.aiUsageEvent.count({
              where: {
                companyId: input.companyId,
                createdAt: { gte: periodStart, lt: periodEnd },
              },
            }),
            tx.aiGatewayOperation.count({
              where: {
                companyId: input.companyId,
                status: "IN_PROGRESS",
                createdAt: { gte: periodStart, lt: periodEnd },
              },
            }),
          ]);
          return completedUsage + operationsInFlight;
        },
      });
      const operationData = {
        actorIdHash: input.actorIdHash,
        purpose: input.purpose,
        requestHash: input.requestHash,
        status: "IN_PROGRESS",
        lockedUntil: input.lockedUntil,
        contentExpiresAt: input.contentExpiresAt,
        contentPurgedAt: null,
        responseEnvelope: { budgetReservationEur: input.estimatedCostCeilingEur },
        responseHash: null,
        errorCode: null,
        attemptCount: 0,
        completedAt: null,
      };
      if (existing?.status === "FAILED") {
        await transaction.aiGatewayOperation.update({
          where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
          data: operationData,
        });
      } else {
        await transaction.aiGatewayOperation.create({ data: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
          ...operationData,
        } });
      }
      return { kind: "acquired" };
    }, { isolationLevel: "Serializable" });
  }

  async completeOperation(input: {
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
  }): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const modelVersion = await transaction.aiModelVersion.upsert({
        where: { provider_model_version: { provider: input.provider, model: input.model, version: input.modelSnapshot } },
        create: { provider: input.provider, model: input.model, version: input.modelSnapshot, capabilities: { structuredOutputs: true, storeFalse: true }, active: true },
        update: { active: true },
      });
      const promptVersion = await transaction.aiPromptVersion.upsert({
        where: { promptKey_version: { promptKey: input.request.purpose, version: input.request.promptVersion } },
        create: {
          promptKey: input.request.purpose,
          version: input.request.promptVersion,
          contentHash: hashJson({ promptKey: input.request.purpose, version: input.request.promptVersion }),
          template: "Versioned prompt content is deployed from the reviewed application contract.",
          schemaVersion: input.request.schemaVersion,
          active: true,
        },
        update: { active: true, schemaVersion: input.request.schemaVersion },
      });
      const usage = await transaction.aiUsageEvent.create({
        data: {
          companyId: input.request.companyId,
          modelVersionId: modelVersion.id,
          promptVersionId: promptVersion.id,
          purpose: input.request.purpose,
          actorIdHash: input.actorIdHash,
          requestId: input.request.requestId,
          correlationId: input.request.correlationId,
          causationId: input.request.causationId,
          operationKey: input.request.operationKey,
          idempotencyKey: input.request.idempotencyKey,
          lane: input.request.lane,
          modelSnapshot: input.modelSnapshot,
          schemaVersion: input.request.schemaVersion,
          requestHash: input.requestHash,
          outputHash: input.outputHash,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costAmount: input.costAmount,
          storeRequested: false,
          humanReviewed: input.effectConfirmed && Boolean(input.request.sensitiveEffect),
          escalated: input.escalated,
          retryCount: input.retryCount,
          latencyMs: input.latencyMs,
          providerRefHash: input.providerReferenceHash,
          estimatedUsage: input.estimatedUsage,
          contentExpiresAt: input.contentExpiresAt,
          outcome: input.response.status,
          metadata: {
            contractVersion: 1,
            dataProfile: "minimized-redacted-v1",
            transportMode: input.response.source === "fake" ? "fake" : "live",
          },
        },
      });
      await transaction.aiGatewayOperation.updateMany({
        where: {
          companyId: input.request.companyId,
          idempotencyKey: input.request.idempotencyKey,
          requestHash: input.requestHash,
          status: "IN_PROGRESS",
        },
        data: {
          status: "COMPLETED",
          responseEnvelope: input.response as unknown as Prisma.InputJsonValue,
          responseHash: hashJson(input.response),
          attemptCount: input.retryCount + 1,
          lockedUntil: null,
          completedAt: new Date(),
        },
      });
      if (input.request.sensitiveEffect && input.effectConfirmed) {
        await transaction.businessEvent.create({
          data: {
            type: "ai.effect.proposed",
            companyId: input.request.companyId,
            actorId: input.request.actorId,
            entityType: input.request.sensitiveEffect.entityType,
            entityId: input.request.sensitiveEffect.entityId,
            correlationId: input.request.correlationId,
            causationId: input.request.causationId,
            requestId: input.request.requestId,
            operation: input.request.operationKey,
            payloadSanitized: {
              usageEventId: usage.id,
              outputHash: input.outputHash,
              purpose: input.request.purpose,
              humanConfirmed: true,
            },
            occurredAt: new Date(),
            schemaVersion: 1,
            idempotencyKey: `ai-effect:${input.request.companyId}:${input.request.idempotencyKey}`,
            destination: input.request.sensitiveEffect.destination,
            deliveryStatus: "PENDING",
          },
        });
      }
      return usage.id;
    });
  }

  async failOperation(input: { companyId: string; idempotencyKey: string; requestHash: string; errorCode: string; attemptCount: number }) {
    await this.prisma.aiGatewayOperation.updateMany({
      where: { companyId: input.companyId, idempotencyKey: input.idempotencyKey, requestHash: input.requestHash, status: "IN_PROGRESS" },
      data: { status: "FAILED", errorCode: input.errorCode, attemptCount: input.attemptCount, lockedUntil: null, completedAt: new Date() },
    });
  }

  async getCircuit(environment: string, provider: string): Promise<AiCircuitRecord> {
    const row = await this.prisma.aiCircuitState.findUnique({ where: { environment_provider: { environment, provider } } });
    if (!row) return { state: "CLOSED", consecutiveFailure: 0 };
    return { state: row.state as AiCircuitRecord["state"], consecutiveFailure: row.consecutiveFailure, openedUntil: row.openedUntil ?? undefined };
  }

  async circuitSucceeded(environment: string, provider: string) {
    await this.prisma.aiCircuitState.upsert({
      where: { environment_provider: { environment, provider } },
      create: { environment, provider, state: "CLOSED", consecutiveFailure: 0 },
      update: { state: "CLOSED", consecutiveFailure: 0, openedUntil: null, halfOpenLeaseUntil: null, lastFailureCode: null },
    });
  }

  async circuitFailed(input: { environment: string; provider: string; errorCode: string; now: Date; threshold: number; openedUntil: Date }) {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.aiCircuitState.findUnique({ where: { environment_provider: { environment: input.environment, provider: input.provider } } });
      const failures = (current?.consecutiveFailure ?? 0) + 1;
      await transaction.aiCircuitState.upsert({
        where: { environment_provider: { environment: input.environment, provider: input.provider } },
        create: {
          environment: input.environment,
          provider: input.provider,
          state: failures >= input.threshold ? "OPEN" : "CLOSED",
          consecutiveFailure: failures,
          openedUntil: failures >= input.threshold ? input.openedUntil : null,
          lastFailureCode: input.errorCode,
          lastFailureAt: input.now,
        },
        update: {
          state: failures >= input.threshold ? "OPEN" : "CLOSED",
          consecutiveFailure: failures,
          openedUntil: failures >= input.threshold ? input.openedUntil : null,
          lastFailureCode: input.errorCode,
          lastFailureAt: input.now,
        },
      });
    });
  }
}
