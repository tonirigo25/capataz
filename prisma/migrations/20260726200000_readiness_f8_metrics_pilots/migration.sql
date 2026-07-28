-- Orqena readiness F8: minimized analytics, pilot governance, support SLA and verified unit-economics inputs.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "ProductEvent" ADD COLUMN "eventId" TEXT;

ALTER TABLE "PilotCohort"
  ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contractStatus" TEXT NOT NULL DEFAULT 'NOT_RECORDED',
  ADD COLUMN "consentStatus" TEXT NOT NULL DEFAULT 'NOT_RECORDED',
  ADD COLUMN "successCriteria" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "cadence" TEXT NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "handoff" JSONB,
  ADD COLUMN "resultStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "outcome" JSONB;

ALTER TABLE "PilotFeedback"
  ADD COLUMN "score" INTEGER,
  ADD COLUMN "consentGranted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contactAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'IN_APP';

ALTER TABLE "SupportTicket"
  ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
  ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
  ADD COLUMN "supportMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resolutionCode" TEXT,
  ADD COLUMN "satisfactionScore" INTEGER,
  ADD COLUMN "satisfactionConsentAt" TIMESTAMP(3);

CREATE TABLE "ProductExperiment" (
  "id" TEXT NOT NULL,
  "experimentKey" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "hypothesis" TEXT NOT NULL,
  "primaryMetric" TEXT NOT NULL,
  "guardrails" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "decision" TEXT,
  "decisionAt" TIMESTAMP(3),
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductExperiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyServiceCost" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "sourceType" TEXT NOT NULL,
  "sourceReferenceHash" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "planKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyServiceCost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestimonialConsent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "subjectHash" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "artifactReferenceHash" TEXT,
  "grantedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestimonialConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductEvent_eventId_key" ON "ProductEvent"("eventId");
CREATE UNIQUE INDEX "ProductExperiment_experimentKey_key" ON "ProductExperiment"("experimentKey");
CREATE INDEX "ProductExperiment_status_startsAt_idx" ON "ProductExperiment"("status", "startsAt");
CREATE UNIQUE INDEX "CompanyServiceCost_companyId_category_periodStart_periodEnd_sourceReferenceHash_key" ON "CompanyServiceCost"("companyId", "category", "periodStart", "periodEnd", "sourceReferenceHash");
CREATE INDEX "CompanyServiceCost_companyId_periodStart_periodEnd_idx" ON "CompanyServiceCost"("companyId", "periodStart", "periodEnd");
CREATE INDEX "CompanyServiceCost_category_periodStart_idx" ON "CompanyServiceCost"("category", "periodStart");
CREATE UNIQUE INDEX "TestimonialConsent_companyId_subjectHash_key" ON "TestimonialConsent"("companyId", "subjectHash");
CREATE INDEX "TestimonialConsent_status_grantedAt_idx" ON "TestimonialConsent"("status", "grantedAt");

ALTER TABLE "CompanyServiceCost" ADD CONSTRAINT "CompanyServiceCost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestimonialConsent" ADD CONSTRAINT "TestimonialConsent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
