-- Orqena readiness F7: reversible imports, preferences and authenticated support context.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "SupportTicket"
  ADD COLUMN "actorIdHash" TEXT NOT NULL DEFAULT 'legacy-unknown',
  ADD COLUMN "route" TEXT,
  ADD COLUMN "release" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "context" JSONB;

CREATE TABLE "SupportTicketAttachment" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "storedObjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyExperiencePreference" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "aiSuggestionsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "operationalEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "marketingEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "policyVersion" TEXT NOT NULL DEFAULT 'v1',
  "updatedByHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyExperiencePreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyImportBatch" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorIdHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "invalidRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL,
  "appliedRows" INTEGER NOT NULL DEFAULT 0,
  "confirmationKey" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyImportRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "dedupeKey" TEXT,
  "status" TEXT NOT NULL,
  "errorCodes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "normalizedData" JSONB,
  "createdEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicketAttachment_ticketId_storedObjectId_key" ON "SupportTicketAttachment"("ticketId", "storedObjectId");
CREATE INDEX "SupportTicketAttachment_storedObjectId_idx" ON "SupportTicketAttachment"("storedObjectId");
CREATE UNIQUE INDEX "CompanyExperiencePreference_companyId_key" ON "CompanyExperiencePreference"("companyId");
CREATE UNIQUE INDEX "CompanyImportBatch_companyId_sourceHash_kind_key" ON "CompanyImportBatch"("companyId", "sourceHash", "kind");
CREATE INDEX "CompanyImportBatch_companyId_status_createdAt_idx" ON "CompanyImportBatch"("companyId", "status", "createdAt");
CREATE UNIQUE INDEX "CompanyImportRow_batchId_rowNumber_key" ON "CompanyImportRow"("batchId", "rowNumber");
CREATE INDEX "CompanyImportRow_batchId_status_idx" ON "CompanyImportRow"("batchId", "status");
CREATE INDEX "SupportTicket_correlationId_idx" ON "SupportTicket"("correlationId");

ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyExperiencePreference" ADD CONSTRAINT "CompanyExperiencePreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyImportBatch" ADD CONSTRAINT "CompanyImportBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyImportRow" ADD CONSTRAINT "CompanyImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CompanyImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
