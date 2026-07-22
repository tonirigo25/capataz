-- Orqena Macrofase 1: additive company profiles, controlled memory and conversation state.
CREATE TYPE "OrganizationType" AS ENUM ('SELF_EMPLOYED', 'COMPANY');
CREATE TYPE "BusinessMemoryScope" AS ENUM ('COMPANY', 'USER', 'CLIENT', 'WORK', 'PARTNER');
CREATE TYPE "BusinessMemoryCategory" AS ENUM ('FACT', 'PREFERENCE', 'TERMINOLOGY', 'PROCESS', 'DEFAULT', 'ALIAS');
CREATE TYPE "BusinessMemoryStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "BusinessMemorySourceType" AS ENUM ('USER_MESSAGE', 'CONFIRMED_ACTION', 'MANUAL_SETTING', 'IMPORT', 'SYSTEM_DERIVED');

ALTER TABLE "Company"
  ADD COLUMN "organizationType" "OrganizationType",
  ADD COLUMN "sectorKey" TEXT,
  ADD COLUMN "terminologyOverrides" JSONB,
  ADD COLUMN "businessProfileVersion" TEXT,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingState" JSONB;

ALTER TABLE "ChatConversation"
  ADD COLUMN "structuredContext" JSONB,
  ADD COLUMN "pendingConfirmation" JSONB;

CREATE TABLE "BusinessMemory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "scope" "BusinessMemoryScope" NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "category" "BusinessMemoryCategory" NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceType" "BusinessMemorySourceType" NOT NULL,
  "sourceConversationId" TEXT,
  "sourceMessageId" TEXT,
  "confidence" DOUBLE PRECISION,
  "status" "BusinessMemoryStatus" NOT NULL DEFAULT 'SUGGESTED',
  "confirmedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "BusinessMemory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BusinessMemory_companyId_status_updatedAt_idx" ON "BusinessMemory"("companyId", "status", "updatedAt");
CREATE INDEX "BusinessMemory_companyId_scope_entityType_entityId_idx" ON "BusinessMemory"("companyId", "scope", "entityType", "entityId");
CREATE INDEX "BusinessMemory_companyId_category_key_idx" ON "BusinessMemory"("companyId", "category", "key");
CREATE INDEX "BusinessMemory_userId_status_idx" ON "BusinessMemory"("userId", "status");
CREATE INDEX "BusinessMemory_expiresAt_idx" ON "BusinessMemory"("expiresAt");
ALTER TABLE "BusinessMemory" ADD CONSTRAINT "BusinessMemory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMemory" ADD CONSTRAINT "BusinessMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessMemory" ADD CONSTRAINT "BusinessMemory_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
