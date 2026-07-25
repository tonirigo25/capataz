-- Orqena readiness M08: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "actorHash" TEXT,
    "eventName" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDailyMetric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "dimensions" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotCohort" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "goals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotFeedback" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cohortId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT,
    "sentiment" TEXT,
    "content" TEXT NOT NULL,
    "reporterHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalReference" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "incidentKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "mitigatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "postmortemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductEvent_companyId_eventName_occurredAt_idx" ON "ProductEvent"("companyId", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "CompanyDailyMetric_metricKey_metricDate_idx" ON "CompanyDailyMetric"("metricKey", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDailyMetric_companyId_metricDate_metricKey_key" ON "CompanyDailyMetric"("companyId", "metricDate", "metricKey");

-- CreateIndex
CREATE INDEX "PilotCohort_status_startsAt_idx" ON "PilotCohort"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotCohort_companyId_cohortKey_key" ON "PilotCohort"("companyId", "cohortKey");

-- CreateIndex
CREATE INDEX "PilotFeedback_companyId_status_createdAt_idx" ON "PilotFeedback"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_companyId_status_priority_createdAt_idx" ON "SupportTicket"("companyId", "status", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_incidentKey_key" ON "Incident"("incidentKey");

-- CreateIndex
CREATE INDEX "Incident_status_severity_startedAt_idx" ON "Incident"("status", "severity", "startedAt");

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDailyMetric" ADD CONSTRAINT "CompanyDailyMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "PilotCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
