-- Bloque 3 Prompt 3 Parte 2: recomendaciones proactivas.
-- Migracion no destructiva: solo crea enums, tablas e indices nuevos.

CREATE TYPE "BusinessRecommendationStatus" AS ENUM (
  'active',
  'viewed',
  'accepted',
  'in_progress',
  'completed',
  'snoozed',
  'dismissed',
  'obsolete',
  'failed'
);

CREATE TYPE "RecommendationActionLogStatus" AS ENUM (
  'pending',
  'success',
  'failed',
  'skipped'
);

CREATE TABLE "BusinessRecommendation" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "signalFingerprint" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detailedExplanation" TEXT NOT NULL,
  "level" "BusinessSignalLevel" NOT NULL,
  "status" "BusinessRecommendationStatus" NOT NULL DEFAULT 'active',
  "source" "BusinessSignalSource" NOT NULL,
  "ruleId" TEXT,
  "ruleVersion" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "clientId" TEXT,
  "workId" TEXT,
  "invoiceId" TEXT,
  "budgetId" TEXT,
  "amount" DOUBLE PRECISION,
  "score" INTEGER NOT NULL DEFAULT 0,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recommendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "shownAt" TIMESTAMP(3),
  "preferredActionId" TEXT,
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "suggestedActions" JSONB,
  "alternativeActions" JSONB,
  "evidence" JSONB,
  "context" JSONB,
  "dismissedAt" TIMESTAMP(3),
  "dismissedReason" TEXT,
  "snoozedUntil" TIMESTAMP(3),
  "snoozeReason" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "actionStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "outcome" JSONB,
  "utilityScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationActionLog" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT,
  "actionId" TEXT NOT NULL,
  "status" "RecommendationActionLogStatus" NOT NULL DEFAULT 'pending',
  "idempotencyKey" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "userIntent" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecommendationActionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationPreference" (
  "id" TEXT NOT NULL,
  "userKey" TEXT NOT NULL DEFAULT 'default',
  "scopeType" TEXT NOT NULL,
  "scopeValue" TEXT,
  "rule" TEXT NOT NULL,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "priorityDelta" INTEGER NOT NULL DEFAULT 0,
  "minAmount" DOUBLE PRECISION,
  "maxToday" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecommendationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessRecommendation_fingerprint_key" ON "BusinessRecommendation"("fingerprint");
CREATE INDEX "BusinessRecommendation_status_priority_idx" ON "BusinessRecommendation"("status", "priority");
CREATE INDEX "BusinessRecommendation_type_idx" ON "BusinessRecommendation"("type");
CREATE INDEX "BusinessRecommendation_level_idx" ON "BusinessRecommendation"("level");
CREATE INDEX "BusinessRecommendation_source_idx" ON "BusinessRecommendation"("source");
CREATE INDEX "BusinessRecommendation_ruleId_idx" ON "BusinessRecommendation"("ruleId");
CREATE INDEX "BusinessRecommendation_clientId_idx" ON "BusinessRecommendation"("clientId");
CREATE INDEX "BusinessRecommendation_workId_idx" ON "BusinessRecommendation"("workId");
CREATE INDEX "BusinessRecommendation_invoiceId_idx" ON "BusinessRecommendation"("invoiceId");
CREATE INDEX "BusinessRecommendation_budgetId_idx" ON "BusinessRecommendation"("budgetId");
CREATE INDEX "BusinessRecommendation_entityType_entityId_idx" ON "BusinessRecommendation"("entityType", "entityId");
CREATE INDEX "BusinessRecommendation_signalFingerprint_idx" ON "BusinessRecommendation"("signalFingerprint");
CREATE INDEX "BusinessRecommendation_snoozedUntil_idx" ON "BusinessRecommendation"("snoozedUntil");
CREATE INDEX "BusinessRecommendation_dueAt_idx" ON "BusinessRecommendation"("dueAt");
CREATE INDEX "BusinessRecommendation_expiresAt_idx" ON "BusinessRecommendation"("expiresAt");
CREATE INDEX "BusinessRecommendation_completedAt_idx" ON "BusinessRecommendation"("completedAt");

CREATE UNIQUE INDEX "RecommendationActionLog_idempotencyKey_key" ON "RecommendationActionLog"("idempotencyKey");
CREATE INDEX "RecommendationActionLog_recommendationId_idx" ON "RecommendationActionLog"("recommendationId");
CREATE INDEX "RecommendationActionLog_actionId_idx" ON "RecommendationActionLog"("actionId");
CREATE INDEX "RecommendationActionLog_status_idx" ON "RecommendationActionLog"("status");
CREATE INDEX "RecommendationActionLog_entityType_entityId_idx" ON "RecommendationActionLog"("entityType", "entityId");
CREATE INDEX "RecommendationActionLog_createdAt_idx" ON "RecommendationActionLog"("createdAt");

CREATE UNIQUE INDEX "RecommendationPreference_userKey_scopeType_scopeValue_rule_key" ON "RecommendationPreference"("userKey", "scopeType", "scopeValue", "rule");
CREATE INDEX "RecommendationPreference_scopeType_scopeValue_idx" ON "RecommendationPreference"("scopeType", "scopeValue");
CREATE INDEX "RecommendationPreference_disabled_idx" ON "RecommendationPreference"("disabled");
