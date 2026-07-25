-- Orqena readiness M05: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "EmailDeliveryAttempt" ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "retryAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "emailHash" TEXT NOT NULL,
    "emailEncrypted" TEXT,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailWebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "outboxId" TEXT,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSuppression_emailHash_active_idx" ON "EmailSuppression"("emailHash", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_companyId_emailHash_key" ON "EmailSuppression"("companyId", "emailHash");

-- CreateIndex
CREATE INDEX "EmailWebhookEvent_providerMessageId_occurredAt_idx" ON "EmailWebhookEvent"("providerMessageId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailWebhookEvent_companyId_occurredAt_idx" ON "EmailWebhookEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailWebhookEvent_provider_externalEventId_key" ON "EmailWebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "EmailDeliveryAttempt_provider_providerMessageId_idx" ON "EmailDeliveryAttempt"("provider", "providerMessageId");

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailWebhookEvent" ADD CONSTRAINT "EmailWebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailWebhookEvent" ADD CONSTRAINT "EmailWebhookEvent_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "EmailOutbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
