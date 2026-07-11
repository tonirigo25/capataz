-- Final proactive system lifecycle, audit, locking and control-center support.
-- This migration is additive: it preserves existing signal and recommendation history.

ALTER TABLE "BusinessSignalState"
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reactivatedAt" TIMESTAMP(3),
ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3),
ADD COLUMN "cooldownUntil" TIMESTAMP(3),
ADD COLUMN "changeHash" TEXT;

ALTER TABLE "BusinessRecommendation"
ADD COLUMN "viewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reactivatedAt" TIMESTAMP(3),
ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3),
ADD COLUMN "cooldownUntil" TIMESTAMP(3),
ADD COLUMN "changeHash" TEXT;

CREATE TABLE "ProactiveEvaluationRun" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'full',
  "status" TEXT NOT NULL DEFAULT 'running',
  "lockKey" TEXT NOT NULL DEFAULT 'proactive-evaluation',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "processedSignals" INTEGER NOT NULL DEFAULT 0,
  "createdSignals" INTEGER NOT NULL DEFAULT 0,
  "updatedSignals" INTEGER NOT NULL DEFAULT 0,
  "resolvedSignals" INTEGER NOT NULL DEFAULT 0,
  "reactivatedSignals" INTEGER NOT NULL DEFAULT 0,
  "expiredSignals" INTEGER NOT NULL DEFAULT 0,
  "processedRecommendations" INTEGER NOT NULL DEFAULT 0,
  "createdRecommendations" INTEGER NOT NULL DEFAULT 0,
  "updatedRecommendations" INTEGER NOT NULL DEFAULT 0,
  "resolvedRecommendations" INTEGER NOT NULL DEFAULT 0,
  "obsoleteRecommendations" INTEGER NOT NULL DEFAULT 0,
  "reactivatedRecommendations" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
  "durationMs" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProactiveEvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProactiveRuleExecution" (
  "id" TEXT NOT NULL,
  "runId" TEXT,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "entityType" TEXT,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "resolved" INTEGER NOT NULL DEFAULT 0,
  "reactivated" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProactiveRuleExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProactiveAuditEvent" (
  "id" TEXT NOT NULL,
  "runId" TEXT,
  "eventType" TEXT NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'system',
  "signalFingerprint" TEXT,
  "recommendationFingerprint" TEXT,
  "actionId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "userKey" TEXT,
  "previousStatus" TEXT,
  "nextStatus" TEXT,
  "reason" TEXT,
  "ruleId" TEXT,
  "values" JSONB,
  "idempotencyKey" TEXT,
  "result" TEXT,
  "error" TEXT,
  "confirmation" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProactiveAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProactiveSystemPreference" (
  "id" TEXT NOT NULL,
  "userKey" TEXT NOT NULL DEFAULT 'default',
  "evaluationFrequencyMinutes" INTEGER NOT NULL DEFAULT 360,
  "urgentEvaluationFrequencyMinutes" INTEGER NOT NULL DEFAULT 60,
  "maintenanceFrequencyMinutes" INTEGER NOT NULL DEFAULT 1440,
  "todayRecommendationLimit" INTEGER NOT NULL DEFAULT 4,
  "minimumPriority" INTEGER NOT NULL DEFAULT 1,
  "enabledCategories" JSONB,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "cooldownDays" JSONB,
  "minimumAmount" DOUBLE PRECISION,
  "showLevels" JSONB,
  "groupingMode" TEXT NOT NULL DEFAULT 'type',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProactiveSystemPreference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessSignalState_cooldownUntil_idx" ON "BusinessSignalState"("cooldownUntil");
CREATE INDEX "BusinessSignalState_changeHash_idx" ON "BusinessSignalState"("changeHash");
CREATE INDEX "BusinessSignalState_lastEvaluatedAt_idx" ON "BusinessSignalState"("lastEvaluatedAt");

CREATE INDEX "BusinessRecommendation_cooldownUntil_idx" ON "BusinessRecommendation"("cooldownUntil");
CREATE INDEX "BusinessRecommendation_changeHash_idx" ON "BusinessRecommendation"("changeHash");
CREATE INDEX "BusinessRecommendation_lastEvaluatedAt_idx" ON "BusinessRecommendation"("lastEvaluatedAt");
CREATE INDEX "BusinessRecommendation_reactivatedAt_idx" ON "BusinessRecommendation"("reactivatedAt");

CREATE INDEX "ProactiveEvaluationRun_status_startedAt_idx" ON "ProactiveEvaluationRun"("status", "startedAt");
CREATE INDEX "ProactiveEvaluationRun_type_startedAt_idx" ON "ProactiveEvaluationRun"("type", "startedAt");
CREATE INDEX "ProactiveEvaluationRun_lockKey_status_idx" ON "ProactiveEvaluationRun"("lockKey", "status");
CREATE INDEX "ProactiveEvaluationRun_archivedAt_idx" ON "ProactiveEvaluationRun"("archivedAt");
CREATE UNIQUE INDEX "ProactiveEvaluationRun_running_lock_key" ON "ProactiveEvaluationRun"("lockKey") WHERE "status" = 'running';

CREATE INDEX "ProactiveRuleExecution_runId_idx" ON "ProactiveRuleExecution"("runId");
CREATE INDEX "ProactiveRuleExecution_ruleId_idx" ON "ProactiveRuleExecution"("ruleId");
CREATE INDEX "ProactiveRuleExecution_status_idx" ON "ProactiveRuleExecution"("status");
CREATE INDEX "ProactiveRuleExecution_entityType_idx" ON "ProactiveRuleExecution"("entityType");
CREATE INDEX "ProactiveRuleExecution_startedAt_idx" ON "ProactiveRuleExecution"("startedAt");

CREATE INDEX "ProactiveAuditEvent_runId_idx" ON "ProactiveAuditEvent"("runId");
CREATE INDEX "ProactiveAuditEvent_eventType_createdAt_idx" ON "ProactiveAuditEvent"("eventType", "createdAt");
CREATE INDEX "ProactiveAuditEvent_origin_idx" ON "ProactiveAuditEvent"("origin");
CREATE INDEX "ProactiveAuditEvent_signalFingerprint_idx" ON "ProactiveAuditEvent"("signalFingerprint");
CREATE INDEX "ProactiveAuditEvent_recommendationFingerprint_idx" ON "ProactiveAuditEvent"("recommendationFingerprint");
CREATE INDEX "ProactiveAuditEvent_actionId_idx" ON "ProactiveAuditEvent"("actionId");
CREATE INDEX "ProactiveAuditEvent_entityType_entityId_idx" ON "ProactiveAuditEvent"("entityType", "entityId");
CREATE INDEX "ProactiveAuditEvent_ruleId_idx" ON "ProactiveAuditEvent"("ruleId");
CREATE INDEX "ProactiveAuditEvent_idempotencyKey_idx" ON "ProactiveAuditEvent"("idempotencyKey");
CREATE INDEX "ProactiveAuditEvent_createdAt_idx" ON "ProactiveAuditEvent"("createdAt");

CREATE UNIQUE INDEX "ProactiveSystemPreference_userKey_key" ON "ProactiveSystemPreference"("userKey");

ALTER TABLE "ProactiveRuleExecution"
ADD CONSTRAINT "ProactiveRuleExecution_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ProactiveEvaluationRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProactiveAuditEvent"
ADD CONSTRAINT "ProactiveAuditEvent_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ProactiveEvaluationRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
