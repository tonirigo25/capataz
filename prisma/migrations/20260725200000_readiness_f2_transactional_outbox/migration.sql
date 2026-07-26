-- Orqena readiness F2: promote the existing business event log to a generic outbox.
-- Existing events remain processed historical records and are never re-emitted.
-- Rollback: stop workers, retain columns, and revert writers to historical-only mode.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "BusinessEvent"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "destination" TEXT,
  ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'PROCESSED',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;

CREATE UNIQUE INDEX "BusinessEvent_idempotencyKey_key" ON "BusinessEvent"("idempotencyKey");
CREATE INDEX "BusinessEvent_deliveryStatus_availableAt_idx" ON "BusinessEvent"("deliveryStatus", "availableAt");
CREATE INDEX "BusinessEvent_companyId_deliveryStatus_idx" ON "BusinessEvent"("companyId", "deliveryStatus");
