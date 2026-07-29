import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260729160000_add_billing_customer_company_links/migration.sql",
  "utf8",
);

describe("BillingCustomerCompanyLink", () => {
  it("adds a many-company association without relaxing the legacy model", () => {
    const legacy = schema.match(
      /model BillingCustomer \{[\s\S]*?\n\}/u,
    )?.[0];
    expect(legacy).toContain("companyId          String   @unique");
    expect(legacy).toContain("@@unique([provider, externalCustomerId])");

    const links = schema.match(
      /model BillingCustomerCompanyLink \{[\s\S]*?\n\}/u,
    )?.[0];
    expect(links).toContain(
      "@@unique([provider, externalCustomerId, companyId])",
    );
    expect(links).toContain("@@index([companyId])");
    expect(links).toContain("@@index([provider, externalCustomerId])");
    expect(links).toContain("onDelete: Restrict");
  });

  it("creates only additive PostgreSQL objects", () => {
    expect(migration).toContain('CREATE TABLE "BillingCustomerCompanyLink"');
    expect(migration).toContain(
      'REFERENCES "Company"("id")\n  ON DELETE RESTRICT ON UPDATE CASCADE',
    );
    expect(migration).not.toMatch(
      /^\s*(?:DROP\b|DELETE\s+FROM\b|UPDATE\s+"|TRUNCATE\b)/imu,
    );
    expect(migration).not.toContain('ALTER TABLE "BillingCustomer"');
  });

  it("backfills legacy associations idempotently without copying PII", () => {
    expect(migration).toContain('FROM "BillingCustomer"');
    expect(migration).toContain(
      'ON CONFLICT ("provider", "externalCustomerId", "companyId") DO NOTHING',
    );
    for (const piiColumn of [
      '"email"',
      '"legalName"',
      '"taxId"',
      '"addressLine"',
      '"postalCode"',
      '"city"',
    ])
      expect(migration).not.toContain(piiColumn);
  });
});
