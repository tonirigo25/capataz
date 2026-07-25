-- Orqena readiness M07: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- CreateTable
CREATE TABLE "CompanyAiPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedPurposes" JSONB NOT NULL,
    "prohibitedData" JSONB NOT NULL,
    "approvedModels" JSONB NOT NULL,
    "dataProfile" TEXT NOT NULL,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAiPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelVersion" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptVersion" (
    "id" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "requestHash" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costAmount" DECIMAL(18,6),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "storeRequested" BOOLEAN NOT NULL DEFAULT false,
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvaluationRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "suiteKey" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metrics" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAiPolicy_companyId_key" ON "CompanyAiPolicy"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AiModelVersion_provider_model_version_key" ON "AiModelVersion"("provider", "model", "version");

-- CreateIndex
CREATE INDEX "AiPromptVersion_promptKey_active_idx" ON "AiPromptVersion"("promptKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptVersion_promptKey_version_key" ON "AiPromptVersion"("promptKey", "version");

-- CreateIndex
CREATE INDEX "AiUsageEvent_companyId_purpose_createdAt_idx" ON "AiUsageEvent"("companyId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AiEvaluationRun_companyId_suiteKey_createdAt_idx" ON "AiEvaluationRun"("companyId", "suiteKey", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyAiPolicy" ADD CONSTRAINT "CompanyAiPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "AiModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AiPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "AiModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AiPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
