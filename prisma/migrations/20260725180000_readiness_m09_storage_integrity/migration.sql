-- Orqena readiness M09: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- AlterTable
ALTER TABLE "Document" ADD COLUMN "storedObjectId" TEXT;

-- CreateTable
CREATE TABLE "StoredObject" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "versionId" TEXT,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "encryption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SCAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadScan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "storedObjectId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineVersion" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredObject_companyId_status_createdAt_idx" ON "StoredObject"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StoredObject_companyId_sha256_idx" ON "StoredObject"("companyId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "StoredObject_provider_bucket_objectKey_versionId_key" ON "StoredObject"("provider", "bucket", "objectKey", "versionId");

-- CreateIndex
CREATE INDEX "UploadScan_companyId_status_createdAt_idx" ON "UploadScan"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadScan_storedObjectId_engine_key" ON "UploadScan"("storedObjectId", "engine");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storedObjectId_key" ON "Document"("storedObjectId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredObject" ADD CONSTRAINT "StoredObject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadScan" ADD CONSTRAINT "UploadScan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadScan" ADD CONSTRAINT "UploadScan_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
