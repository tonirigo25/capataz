-- Orqena readiness F6: additive AI governance, budget, replay and review evidence.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "CompanyAiPolicy"
  ADD COLUMN "killSwitch" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowedRoles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "allowedScopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "allowedFields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "approvedClassifications" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "companyMonthlyBudget" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "userMonthlyBudget" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "operationBudget" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "maxInputTokens" INTEGER NOT NULL DEFAULT 4096,
  ADD COLUMN "maxOutputTokens" INTEGER NOT NULL DEFAULT 1024,
  ADD COLUMN "maxPayloadBytes" INTEGER NOT NULL DEFAULT 65536,
  ADD COLUMN "maxConcurrency" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
  ADD COLUMN "retentionDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "sensitiveEffectsNeedOutbox" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AiUsageEvent"
  ADD COLUMN "actorIdHash" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "causationId" TEXT,
  ADD COLUMN "operationKey" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "lane" TEXT NOT NULL DEFAULT 'fast',
  ADD COLUMN "modelSnapshot" TEXT,
  ADD COLUMN "outputHash" TEXT,
  ADD COLUMN "escalated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "latencyMs" INTEGER,
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "providerRefHash" TEXT,
  ADD COLUMN "estimatedUsage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contentExpiresAt" TIMESTAMP(3),
  ADD COLUMN "contentPurgedAt" TIMESTAMP(3);

CREATE TABLE "AiGatewayOperation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorIdHash" TEXT,
  "purpose" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "responseEnvelope" JSONB,
  "responseHash" TEXT,
  "errorCode" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "contentExpiresAt" TIMESTAMP(3),
  "contentPurgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiGatewayOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiReviewEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "usageEventId" TEXT NOT NULL,
  "actorIdHash" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "correctionKinds" JSONB,
  "reasonCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCircuitState" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'CLOSED',
  "consecutiveFailure" INTEGER NOT NULL DEFAULT 0,
  "openedUntil" TIMESTAMP(3),
  "halfOpenLeaseUntil" TIMESTAMP(3),
  "lastFailureCode" TEXT,
  "lastFailureAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCircuitState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiGatewayOperation_companyId_idempotencyKey_key" ON "AiGatewayOperation"("companyId", "idempotencyKey");
CREATE INDEX "AiGatewayOperation_companyId_status_createdAt_idx" ON "AiGatewayOperation"("companyId", "status", "createdAt");
CREATE INDEX "AiGatewayOperation_contentExpiresAt_contentPurgedAt_idx" ON "AiGatewayOperation"("contentExpiresAt", "contentPurgedAt");
CREATE INDEX "AiUsageEvent_companyId_actorIdHash_createdAt_idx" ON "AiUsageEvent"("companyId", "actorIdHash", "createdAt");
CREATE INDEX "AiUsageEvent_correlationId_idx" ON "AiUsageEvent"("correlationId");
CREATE INDEX "AiUsageEvent_contentExpiresAt_contentPurgedAt_idx" ON "AiUsageEvent"("contentExpiresAt", "contentPurgedAt");
CREATE INDEX "AiReviewEvent_companyId_outcome_createdAt_idx" ON "AiReviewEvent"("companyId", "outcome", "createdAt");
CREATE INDEX "AiReviewEvent_usageEventId_createdAt_idx" ON "AiReviewEvent"("usageEventId", "createdAt");
CREATE UNIQUE INDEX "AiCircuitState_environment_provider_key" ON "AiCircuitState"("environment", "provider");
CREATE INDEX "AiCircuitState_state_openedUntil_idx" ON "AiCircuitState"("state", "openedUntil");

ALTER TABLE "AiGatewayOperation" ADD CONSTRAINT "AiGatewayOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiReviewEvent" ADD CONSTRAINT "AiReviewEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiReviewEvent" ADD CONSTRAINT "AiReviewEvent_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "AiUsageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
