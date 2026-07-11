-- Deterministic business signals, risk alerts and lifecycle state.
CREATE TYPE "BusinessSignalLevel" AS ENUM ('info', 'atencion', 'importante', 'critico');
CREATE TYPE "BusinessSignalStatus" AS ENUM ('active', 'snoozed', 'dismissed', 'resolved', 'expired');
CREATE TYPE "BusinessSignalSource" AS ENUM (
  'crm',
  'obras',
  'facturas',
  'cobros',
  'tesoreria',
  'agenda',
  'documentos',
  'materiales',
  'rentabilidad',
  'chat',
  'recordatorios',
  'visitas',
  'gastos',
  'presupuestos',
  'datos'
);

CREATE TABLE "BusinessSignalState" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "level" "BusinessSignalLevel" NOT NULL,
  "status" "BusinessSignalStatus" NOT NULL DEFAULT 'active',
  "source" "BusinessSignalSource" NOT NULL,
  "ruleId" TEXT,
  "ruleVersion" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "clientId" TEXT,
  "workId" TEXT,
  "invoiceId" TEXT,
  "budgetId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "lastPriority" INTEGER NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shownAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "dismissedReason" TEXT,
  "dismissedBy" TEXT,
  "snoozedUntil" TIMESTAMP(3),
  "snoozeReason" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "explanation" JSONB,
  "suggestedActions" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessSignalState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessSignalPreference" (
  "id" TEXT NOT NULL,
  "userKey" TEXT NOT NULL DEFAULT 'default',
  "scopeType" TEXT NOT NULL,
  "scopeValue" TEXT,
  "rule" TEXT NOT NULL,
  "weightDelta" INTEGER NOT NULL DEFAULT 0,
  "neverHide" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessSignalPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessSignalState_fingerprint_key" ON "BusinessSignalState"("fingerprint");
CREATE INDEX "BusinessSignalState_status_lastPriority_idx" ON "BusinessSignalState"("status", "lastPriority");
CREATE INDEX "BusinessSignalState_type_idx" ON "BusinessSignalState"("type");
CREATE INDEX "BusinessSignalState_level_idx" ON "BusinessSignalState"("level");
CREATE INDEX "BusinessSignalState_source_idx" ON "BusinessSignalState"("source");
CREATE INDEX "BusinessSignalState_ruleId_idx" ON "BusinessSignalState"("ruleId");
CREATE INDEX "BusinessSignalState_clientId_idx" ON "BusinessSignalState"("clientId");
CREATE INDEX "BusinessSignalState_workId_idx" ON "BusinessSignalState"("workId");
CREATE INDEX "BusinessSignalState_invoiceId_idx" ON "BusinessSignalState"("invoiceId");
CREATE INDEX "BusinessSignalState_budgetId_idx" ON "BusinessSignalState"("budgetId");
CREATE INDEX "BusinessSignalState_entityType_entityId_idx" ON "BusinessSignalState"("entityType", "entityId");
CREATE INDEX "BusinessSignalState_expiresAt_idx" ON "BusinessSignalState"("expiresAt");
CREATE INDEX "BusinessSignalState_snoozedUntil_idx" ON "BusinessSignalState"("snoozedUntil");
CREATE INDEX "BusinessSignalState_resolvedAt_idx" ON "BusinessSignalState"("resolvedAt");

CREATE UNIQUE INDEX "BusinessSignalPreference_userKey_scopeType_scopeValue_rule_key" ON "BusinessSignalPreference"("userKey", "scopeType", "scopeValue", "rule");
CREATE INDEX "BusinessSignalPreference_scopeType_scopeValue_idx" ON "BusinessSignalPreference"("scopeType", "scopeValue");
