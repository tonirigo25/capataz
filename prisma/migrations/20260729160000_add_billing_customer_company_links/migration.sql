-- Additive association allowing one provider customer to be linked to multiple companies.
-- Legacy BillingCustomer rows and constraints remain unchanged.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE "BillingCustomerCompanyLink" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "externalCustomerId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingCustomerCompanyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingCustomerCompanyLink_provider_externalCustomerId_companyId_key"
  ON "BillingCustomerCompanyLink"("provider", "externalCustomerId", "companyId");

CREATE INDEX "BillingCustomerCompanyLink_companyId_idx"
  ON "BillingCustomerCompanyLink"("companyId");

CREATE INDEX "BillingCustomerCompanyLink_provider_externalCustomerId_idx"
  ON "BillingCustomerCompanyLink"("provider", "externalCustomerId");

ALTER TABLE "BillingCustomerCompanyLink"
  ADD CONSTRAINT "BillingCustomerCompanyLink_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BillingCustomerCompanyLink" (
  "id",
  "provider",
  "externalCustomerId",
  "companyId",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy_', "id"),
  "provider",
  "externalCustomerId",
  "companyId",
  "createdAt",
  "updatedAt"
FROM "BillingCustomer"
ON CONFLICT ("provider", "externalCustomerId", "companyId") DO NOTHING;
