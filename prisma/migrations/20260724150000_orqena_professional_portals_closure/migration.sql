-- Additive closure for professional portals, owner governance and local email outbox.
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'pending_owner_approval';
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'PENDING_EMPLOYEE';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ACCEPTED';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'PENDING_OWNER_APPROVAL';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'OWNER_APPROVED';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'OWNER_REJECTED';

CREATE TYPE "MembershipAccessMode" AS ENUM ('STANDARD', 'READ_ONLY');
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED');
CREATE TYPE "DocumentClassification" AS ENUM ('OPERATIONAL', 'COMMERCIAL', 'FINANCIAL', 'RESTRICTED');

-- Existing documents are classified conservatively. New records use the application default.
ALTER TABLE "Document" ADD COLUMN "classification" "DocumentClassification" NOT NULL DEFAULT 'RESTRICTED';
ALTER TABLE "Document" ALTER COLUMN "classification" SET DEFAULT 'OPERATIONAL';
ALTER TABLE "CompanyMembership"
  ADD COLUMN "accessMode" "MembershipAccessMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "accessStartsAt" TIMESTAMP(3),
  ADD COLUMN "accessEndsAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Invitation"
  ADD COLUMN "functionalProfileKey" TEXT,
  ADD COLUMN "accessMode" "MembershipAccessMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "accessPackageKeys" JSONB,
  ADD COLUMN "scopeTemplate" JSONB,
  ADD COLUMN "approvalTemplate" JSONB,
  ADD COLUMN "fieldVisibilityTemplate" JSONB,
  ADD COLUMN "employeeAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "ownerApprovedAt" TIMESTAMP(3),
  ADD COLUMN "ownerApprovedById" TEXT;

CREATE TABLE "MembershipAccessPackage" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "packageKey" TEXT NOT NULL,
  "config" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipAccessPackage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipAccessPackage_membershipId_packageKey_key" ON "MembershipAccessPackage"("membershipId", "packageKey");
CREATE INDEX "MembershipAccessPackage_companyId_packageKey_idx" ON "MembershipAccessPackage"("companyId", "packageKey");
CREATE INDEX "MembershipAccessPackage_membershipId_startsAt_endsAt_idx" ON "MembershipAccessPackage"("membershipId", "startsAt", "endsAt");
ALTER TABLE "MembershipAccessPackage" ADD CONSTRAINT "MembershipAccessPackage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipAccessPackage" ADD CONSTRAINT "MembershipAccessPackage_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ApprovalAuthority" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "authorityKey" TEXT NOT NULL,
  "maxAmount" DECIMAL(14,2),
  "maxDiscountPercent" DECIMAL(5,2),
  "minimumMarginPercent" DECIMAL(5,2),
  "scope" "ScopeType" NOT NULL DEFAULT 'COMPANY',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalAuthority_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApprovalAuthority_membershipId_authorityKey_key" ON "ApprovalAuthority"("membershipId", "authorityKey");
CREATE INDEX "ApprovalAuthority_companyId_authorityKey_idx" ON "ApprovalAuthority"("companyId", "authorityKey");
CREATE INDEX "ApprovalAuthority_membershipId_startsAt_endsAt_idx" ON "ApprovalAuthority"("membershipId", "startsAt", "endsAt");
ALTER TABLE "ApprovalAuthority" ADD CONSTRAINT "ApprovalAuthority_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalAuthority" ADD CONSTRAINT "ApprovalAuthority_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MembershipFieldVisibilityPolicy" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "changedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipFieldVisibilityPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipFieldVisibilityPolicy_membershipId_fieldKey_key" ON "MembershipFieldVisibilityPolicy"("membershipId", "fieldKey");
CREATE INDEX "MembershipFieldVisibilityPolicy_companyId_fieldKey_visible_idx" ON "MembershipFieldVisibilityPolicy"("companyId", "fieldKey", "visible");
ALTER TABLE "MembershipFieldVisibilityPolicy" ADD CONSTRAINT "MembershipFieldVisibilityPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipFieldVisibilityPolicy" ADD CONSTRAINT "MembershipFieldVisibilityPolicy_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailOutbox" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "invitationId" TEXT,
  "eventKey" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT,
  "textBody" TEXT,
  "payload" JSONB,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailOutbox_companyId_status_availableAt_idx" ON "EmailOutbox"("companyId", "status", "availableAt");
CREATE INDEX "EmailOutbox_invitationId_eventKey_idx" ON "EmailOutbox"("invitationId", "eventKey");
CREATE INDEX "EmailOutbox_recipient_createdAt_idx" ON "EmailOutbox"("recipient", "createdAt");
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "outboxId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "EmailOutboxStatus" NOT NULL,
  "errorCode" TEXT,
  "errorDetail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailDeliveryAttempt_outboxId_attempt_key" ON "EmailDeliveryAttempt"("outboxId", "attempt");
CREATE INDEX "EmailDeliveryAttempt_status_createdAt_idx" ON "EmailDeliveryAttempt"("status", "createdAt");
ALTER TABLE "EmailDeliveryAttempt" ADD CONSTRAINT "EmailDeliveryAttempt_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "EmailOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlSource" TEXT NOT NULL,
  "textSource" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplateVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailTemplateVersion_templateKey_version_key" ON "EmailTemplateVersion"("templateKey", "version");
CREATE INDEX "EmailTemplateVersion_templateKey_active_idx" ON "EmailTemplateVersion"("templateKey", "active");

CREATE TABLE "DemoRequest" (
  "id" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "phone" TEXT,
  "teamSize" TEXT,
  "sectorKey" TEXT,
  "message" TEXT,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "source" TEXT NOT NULL DEFAULT 'public-web',
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoRequest_requestHash_key" ON "DemoRequest"("requestHash");
CREATE INDEX "DemoRequest_emailNormalized_createdAt_idx" ON "DemoRequest"("emailNormalized", "createdAt");
CREATE INDEX "DemoRequest_status_createdAt_idx" ON "DemoRequest"("status", "createdAt");
