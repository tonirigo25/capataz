-- Orqena readiness M06: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "version" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalDocumentVersionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "lawfulBasis" TEXT NOT NULL,
    "dataCategories" JSONB NOT NULL,
    "subjectTypes" JSONB NOT NULL,
    "recipients" JSONB,
    "transferDetails" JSONB,
    "retentionKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "legalHoldDays" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "subjectReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "assignedTo" TEXT,
    "identityVerifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidence" JSONB,
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBreachIncident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "containedAt" TIMESTAMP(3),
    "authorityNotifiedAt" TIMESTAMP(3),
    "subjectsNotifiedAt" TIMESTAMP(3),
    "assessment" JSONB NOT NULL,
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataBreachIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_documentKey_effectiveAt_idx" ON "LegalDocumentVersion"("documentKey", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_documentKey_locale_version_key" ON "LegalDocumentVersion"("documentKey", "locale", "version");

-- CreateIndex
CREATE INDEX "LegalAcceptance_companyId_acceptedAt_idx" ON "LegalAcceptance"("companyId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_userId_legalDocumentVersionId_purpose_key" ON "LegalAcceptance"("userId", "legalDocumentVersionId", "purpose");

-- CreateIndex
CREATE INDEX "ProcessingActivity_companyId_active_idx" ON "ProcessingActivity"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingActivity_companyId_key_key" ON "ProcessingActivity"("companyId", "key");

-- CreateIndex
CREATE INDEX "RetentionPolicy_companyId_enabled_idx" ON "RetentionPolicy"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_companyId_key_key" ON "RetentionPolicy"("companyId", "key");

-- CreateIndex
CREATE INDEX "PrivacyRequest_companyId_status_dueAt_idx" ON "PrivacyRequest"("companyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_companyId_subjectId_purpose_createdAt_idx" ON "ConsentRecord"("companyId", "subjectId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "DataBreachIncident_companyId_status_detectedAt_idx" ON "DataBreachIncident"("companyId", "status", "detectedAt");

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_legalDocumentVersionId_fkey" FOREIGN KEY ("legalDocumentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingActivity" ADD CONSTRAINT "ProcessingActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataBreachIncident" ADD CONSTRAINT "DataBreachIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
