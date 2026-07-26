-- Orqena readiness F4: additive commercial, email worker and private storage controls.
-- Rollback is logical: disable billing/email/storage provider flags and retain audit data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "Company"
  ADD COLUMN "logoStoredObjectId" TEXT,
  ADD COLUMN "sealStoredObjectId" TEXT;

ALTER TABLE "Subscription"
  ADD COLUMN "graceEndsAt" TIMESTAMP(3),
  ADD COLUMN "readOnlyAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancellationComment" TEXT,
  ADD COLUMN "lastProviderEventAt" TIMESTAMP(3);

ALTER TABLE "BillingCustomer"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "taxId" TEXT,
  ADD COLUMN "addressLine" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "countryCode" TEXT DEFAULT 'ES';

ALTER TABLE "BillingEvent"
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "occurredAt" TIMESTAMP(3);

ALTER TABLE "EmailOutbox"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "recipientHash" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3),
  ADD COLUMN "trackingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EmailTemplateVersion"
  ADD COLUMN "allowedVariables" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "trackingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StoredObject"
  ADD COLUMN "safeName" TEXT,
  ADD COLUMN "providerVersion" TEXT,
  ADD COLUMN "contentDisposition" TEXT DEFAULT 'attachment';

CREATE TABLE "BillingReconciliationRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "localSnapshot" JSONB NOT NULL,
  "providerSnapshot" JSONB NOT NULL,
  "divergences" JSONB NOT NULL,
  "divergenceCount" INTEGER NOT NULL DEFAULT 0,
  "correctionMode" TEXT NOT NULL DEFAULT 'AUDIT_ONLY',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BillingReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_logoStoredObjectId_key" ON "Company"("logoStoredObjectId");
CREATE UNIQUE INDEX "Company_sealStoredObjectId_key" ON "Company"("sealStoredObjectId");
CREATE UNIQUE INDEX "EmailOutbox_companyId_idempotencyKey_key" ON "EmailOutbox"("companyId", "idempotencyKey");
CREATE INDEX "EmailOutbox_providerMessageId_idx" ON "EmailOutbox"("providerMessageId");
CREATE INDEX "BillingReconciliationRun_companyId_startedAt_idx" ON "BillingReconciliationRun"("companyId", "startedAt");
CREATE INDEX "BillingReconciliationRun_status_startedAt_idx" ON "BillingReconciliationRun"("status", "startedAt");

ALTER TABLE "Company" ADD CONSTRAINT "Company_logoStoredObjectId_fkey"
  FOREIGN KEY ("logoStoredObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_sealStoredObjectId_fkey"
  FOREIGN KEY ("sealStoredObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingReconciliationRun" ADD CONSTRAINT "BillingReconciliationRun_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Global suppressions need the same uniqueness guarantee as tenant suppressions.
CREATE UNIQUE INDEX "EmailSuppression_global_emailHash_key"
  ON "EmailSuppression"("emailHash") WHERE "companyId" IS NULL;
