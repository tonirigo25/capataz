-- Orqena readiness M03: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- CreateTable
CREATE TABLE "ElectronicInvoiceArtifact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicInvoiceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoiceDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectronicInvoiceDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoiceStatusEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicInvoiceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElectronicInvoiceArtifact_companyId_status_generatedAt_idx" ON "ElectronicInvoiceArtifact"("companyId", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicInvoiceArtifact_fiscalDocumentId_format_schemaVer_key" ON "ElectronicInvoiceArtifact"("fiscalDocumentId", "format", "schemaVersion");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceDelivery_companyId_status_availableAt_idx" ON "ElectronicInvoiceDelivery"("companyId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceDelivery_artifactId_createdAt_idx" ON "ElectronicInvoiceDelivery"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceStatusEvent_companyId_eventType_occurredAt_idx" ON "ElectronicInvoiceStatusEvent"("companyId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceStatusEvent_artifactId_occurredAt_idx" ON "ElectronicInvoiceStatusEvent"("artifactId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceArtifact" ADD CONSTRAINT "ElectronicInvoiceArtifact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceArtifact" ADD CONSTRAINT "ElectronicInvoiceArtifact_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceDelivery" ADD CONSTRAINT "ElectronicInvoiceDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceDelivery" ADD CONSTRAINT "ElectronicInvoiceDelivery_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ElectronicInvoiceArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceStatusEvent" ADD CONSTRAINT "ElectronicInvoiceStatusEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceStatusEvent" ADD CONSTRAINT "ElectronicInvoiceStatusEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ElectronicInvoiceArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
