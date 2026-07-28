-- Additive Stripe billing foundation integrated with readiness M04/F4.
-- BillingCustomer and BillingEvent already exist in the canonical readiness train.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "Subscription"
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId" TEXT;

CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key"
  ON "Subscription"("stripeSubscriptionId");

CREATE INDEX "BillingCustomer_createdAt_idx" ON "BillingCustomer"("createdAt");
