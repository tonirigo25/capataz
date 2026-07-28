-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "chainScope" TEXT,
ADD COLUMN     "chainVersion" INTEGER,
ADD COLUMN     "entryHash" TEXT,
ADD COLUMN     "previousHash" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "secondFactorVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoredObject" ADD COLUMN     "deletionEvidenceHash" TEXT,
ADD COLUMN     "legalHoldUntil" TIMESTAMP(3),
ADD COLUMN     "quarantineReason" TEXT,
ADD COLUMN     "retainUntil" TIMESTAMP(3),
ADD COLUMN     "retentionKey" TEXT;

-- CreateTable
CREATE TABLE "MfaFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TOTP',
    "label" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'aes-256-gcm',
    "ciphertext" TEXT NOT NULL,
    "initializationVector" TEXT NOT NULL,
    "authenticationTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfaFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subprocessor" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "dataCategories" JSONB NOT NULL,
    "processingLocations" JSONB NOT NULL,
    "safeguards" JSONB,
    "privacyUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "versionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subprocessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubprocessorChange" (
    "id" TEXT NOT NULL,
    "subprocessorId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "noticeRequired" BOOLEAN NOT NULL DEFAULT true,
    "noticeDueAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubprocessorChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "subjectReference" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataGovernanceExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionType" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "policyKey" TEXT,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "manifest" JSONB NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataGovernanceExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDataExport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "privacyRequestId" TEXT,
    "exportType" TEXT NOT NULL,
    "subjectReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "manifest" JSONB NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "packageHash" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "objectCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequestEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorReference" TEXT,
    "communicationRef" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRiskAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processingActivityId" TEXT,
    "assessmentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "highRisk" BOOLEAN NOT NULL DEFAULT false,
    "risks" JSONB NOT NULL,
    "safeguards" JSONB NOT NULL,
    "residualRisk" JSONB NOT NULL,
    "owner" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalMetric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "dimensions" JSONB,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobHeartbeat" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "jobKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "release" TEXT,
    "status" TEXT NOT NULL DEFAULT 'HEALTHY',
    "lastStartedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "expectedEverySeconds" INTEGER NOT NULL,
    "deadLetterCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyntheticCheckRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "checkKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "release" TEXT,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "assertionCount" INTEGER NOT NULL,
    "failureCode" TEXT,
    "evidenceHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyntheticCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTimelineEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "incidentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemAction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "incidentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "evidenceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostmortemAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaFactor_userId_status_idx" ON "MfaFactor"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subprocessor_key_key" ON "Subprocessor"("key");

-- CreateIndex
CREATE INDEX "Subprocessor_status_effectiveAt_idx" ON "Subprocessor"("status", "effectiveAt");

-- CreateIndex
CREATE INDEX "SubprocessorChange_noticeRequired_noticeDueAt_idx" ON "SubprocessorChange"("noticeRequired", "noticeDueAt");

-- CreateIndex
CREATE INDEX "LegalHold_companyId_status_resourceType_resourceId_idx" ON "LegalHold"("companyId", "status", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "LegalHold_companyId_subjectReference_status_idx" ON "LegalHold"("companyId", "subjectReference", "status");

-- CreateIndex
CREATE INDEX "DataGovernanceExecution_companyId_executionType_startedAt_idx" ON "DataGovernanceExecution"("companyId", "executionType", "startedAt");

-- CreateIndex
CREATE INDEX "DataGovernanceExecution_status_startedAt_idx" ON "DataGovernanceExecution"("status", "startedAt");

-- CreateIndex
CREATE INDEX "CompanyDataExport_companyId_exportType_createdAt_idx" ON "CompanyDataExport"("companyId", "exportType", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyDataExport_privacyRequestId_idx" ON "CompanyDataExport"("privacyRequestId");

-- CreateIndex
CREATE INDEX "PrivacyRequestEvent_companyId_privacyRequestId_occurredAt_idx" ON "PrivacyRequestEvent"("companyId", "privacyRequestId", "occurredAt");

-- CreateIndex
CREATE INDEX "PrivacyRiskAssessment_companyId_status_highRisk_idx" ON "PrivacyRiskAssessment"("companyId", "status", "highRisk");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyRiskAssessment_companyId_assessmentType_version_key" ON "PrivacyRiskAssessment"("companyId", "assessmentType", "version");

-- CreateIndex
CREATE INDEX "OperationalMetric_metricKey_measuredAt_idx" ON "OperationalMetric"("metricKey", "measuredAt");

-- CreateIndex
CREATE INDEX "OperationalMetric_companyId_metricKey_measuredAt_idx" ON "OperationalMetric"("companyId", "metricKey", "measuredAt");

-- CreateIndex
CREATE INDEX "JobHeartbeat_status_updatedAt_idx" ON "JobHeartbeat"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobHeartbeat_environment_jobKey_companyId_key" ON "JobHeartbeat"("environment", "jobKey", "companyId");

-- CreateIndex
CREATE INDEX "SyntheticCheckRun_environment_checkKey_startedAt_idx" ON "SyntheticCheckRun"("environment", "checkKey", "startedAt");

-- CreateIndex
CREATE INDEX "SyntheticCheckRun_status_startedAt_idx" ON "SyntheticCheckRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "IncidentTimelineEvent_incidentId_occurredAt_idx" ON "IncidentTimelineEvent"("incidentId", "occurredAt");

-- CreateIndex
CREATE INDEX "IncidentTimelineEvent_companyId_occurredAt_idx" ON "IncidentTimelineEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "PostmortemAction_incidentId_status_dueAt_idx" ON "PostmortemAction"("incidentId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "AuditLog_chainScope_createdAt_id_idx" ON "AuditLog"("chainScope", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "MfaFactor" ADD CONSTRAINT "MfaFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubprocessorChange" ADD CONSTRAINT "SubprocessorChange_subprocessorId_fkey" FOREIGN KEY ("subprocessorId") REFERENCES "Subprocessor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataGovernanceExecution" ADD CONSTRAINT "DataGovernanceExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataExport" ADD CONSTRAINT "CompanyDataExport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequestEvent" ADD CONSTRAINT "PrivacyRequestEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequestEvent" ADD CONSTRAINT "PrivacyRequestEvent_privacyRequestId_fkey" FOREIGN KEY ("privacyRequestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRiskAssessment" ADD CONSTRAINT "PrivacyRiskAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalMetric" ADD CONSTRAINT "OperationalMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobHeartbeat" ADD CONSTRAINT "JobHeartbeat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyntheticCheckRun" ADD CONSTRAINT "SyntheticCheckRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTimelineEvent" ADD CONSTRAINT "IncidentTimelineEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTimelineEvent" ADD CONSTRAINT "IncidentTimelineEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemAction" ADD CONSTRAINT "PostmortemAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemAction" ADD CONSTRAINT "PostmortemAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "BusinessPartnerHistory_companyId_businessPartnerId_createdAt_id" RENAME TO "BusinessPartnerHistory_companyId_businessPartnerId_createdA_idx";

-- RenameIndex
ALTER INDEX "PurchaseInvoiceHistory_companyId_purchaseInvoiceId_createdAt_id" RENAME TO "PurchaseInvoiceHistory_companyId_purchaseInvoiceId_createdA_idx";
