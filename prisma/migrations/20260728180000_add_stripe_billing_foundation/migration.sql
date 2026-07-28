-- Additive Stripe billing foundation. Existing plans, subscriptions and entitlements remain authoritative.
ALTER TABLE "Subscription"
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId" TEXT;

CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key"
  ON "Subscription"("stripeSubscriptionId");

CREATE TABLE "BillingCustomer" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingCustomer_companyId_key" ON "BillingCustomer"("companyId");
CREATE UNIQUE INDEX "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");
CREATE INDEX "BillingCustomer_createdAt_idx" ON "BillingCustomer"("createdAt");

ALTER TABLE "BillingCustomer"
  ADD CONSTRAINT "BillingCustomer_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventCreatedAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3),
  "processingResult" TEXT NOT NULL,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE INDEX "BillingEvent_companyId_eventCreatedAt_idx" ON "BillingEvent"("companyId", "eventCreatedAt");
CREATE INDEX "BillingEvent_processingResult_createdAt_idx" ON "BillingEvent"("processingResult", "createdAt");

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
