import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allowedBillingAppHosts } from "../../lib/billing/config";
import {
  assertLocalPlanSimulationAllowed,
  CHECKOUT_RESERVATION_TTL_MS,
  checkoutReservationIsFresh,
  validateBillingProfile,
  validateLiveCheckoutCustomerDetails,
} from "../../lib/billing/guards";
import { commercialAccessPolicy } from "../../lib/commercial/access-policy";

const completeProfile = {
  legalName: "Empresa de prueba",
  email: "billing@example.invalid",
  addressLine: "Calle Mayor 1",
  postalCode: "28001",
  city: "Madrid",
  countryCode: "ES",
  taxId: "B12345678",
};

describe("Stripe billing P1 guards", () => {
  it("keeps the local plan simulator outside production and hosted environments", () => {
    expect(() => assertLocalPlanSimulationAllowed({
      NODE_ENV: "production",
      APP_ENV: "production",
      BILLING_ENABLED: "false",
    })).toThrow("LOCAL_PLAN_SIMULATION_FORBIDDEN");
    expect(() => assertLocalPlanSimulationAllowed({
      NODE_ENV: "development",
      APP_ENV: "staging",
      BILLING_ENABLED: "false",
    })).toThrow("LOCAL_PLAN_SIMULATION_FORBIDDEN");
    expect(() => assertLocalPlanSimulationAllowed({
      NODE_ENV: "test",
      APP_ENV: "test",
      BILLING_ENABLED: "false",
    })).not.toThrow();
  });

  it("fails closed for incomplete, cross-border and excluded Spanish tax territories in Live", () => {
    expect(() => validateBillingProfile({ ...completeProfile, taxId: "" }, true))
      .toThrow("BILLING_B2B_PROFILE_INCOMPLETE");
    expect(() => validateBillingProfile({ ...completeProfile, countryCode: "DE" }, true))
      .toThrow("BILLING_COUNTRY_NOT_ALLOWED");
    expect(() => validateBillingProfile({ ...completeProfile, postalCode: "35001" }, true))
      .toThrow("BILLING_TAX_TERRITORY_NOT_ALLOWED");
    expect(() => validateBillingProfile({ ...completeProfile, countryCode: "DE", postalCode: "10115" }, false))
      .not.toThrow();
  });

  it("accepts only canonical or explicitly configured billing hosts in production builds", () => {
    const hosts = allowedBillingAppHosts({
      BILLING_APP_ALLOWED_HOSTS: "review.orqenatech.com,staging.orqenatech.com",
      RAILWAY_PUBLIC_DOMAIN: "capataz-production.up.railway.app",
    });
    expect(hosts).toContain("app.orqenatech.com");
    expect(hosts).toContain("review.orqenatech.com");
    expect(hosts).toContain("capataz-production.up.railway.app");
    expect(hosts).not.toContain("example.com");
  });

  it("revalidates the final Live Checkout address fail-closed", () => {
    const details = {
      name: completeProfile.legalName,
      email: completeProfile.email,
      address: {
        line1: completeProfile.addressLine,
        city: completeProfile.city,
        postal_code: completeProfile.postalCode,
        country: completeProfile.countryCode,
      },
    };
    expect(() => validateLiveCheckoutCustomerDetails(details)).not.toThrow();
    expect(() => validateLiveCheckoutCustomerDetails({
      ...details,
      address: { ...details.address, country: "DE" },
    })).toThrow("BILLING_COUNTRY_NOT_ALLOWED");
    expect(() => validateLiveCheckoutCustomerDetails({
      ...details,
      address: { ...details.address, postal_code: "38001" },
    })).toThrow("BILLING_TAX_TERRITORY_NOT_ALLOWED");
    expect(() => validateLiveCheckoutCustomerDetails({
      ...details,
      address: { ...details.address, line1: "" },
    })).toThrow("BILLING_B2B_PROFILE_INCOMPLETE");
  });

  it("keeps fresh checkout reservations exclusive and makes stale reservations recoverable", () => {
    const createdAt = new Date("2026-07-29T10:00:00.000Z");
    const metadata = {
      billingCheckoutReservation: {
        id: "pending:test",
        createdAt: createdAt.toISOString(),
        payloadHash: "safe-hash",
      },
    };
    expect(checkoutReservationIsFresh(metadata, new Date(createdAt.getTime() + CHECKOUT_RESERVATION_TTL_MS - 1)))
      .toBe(true);
    expect(checkoutReservationIsFresh(metadata, new Date(createdAt.getTime() + CHECKOUT_RESERVATION_TTL_MS)))
      .toBe(false);
    expect(checkoutReservationIsFresh({}, createdAt)).toBe(false);
  });

  it("protects inactive reservations, past-due state, and shared-customer portals", () => {
    const service = readFileSync("lib/billing/service.ts", "utf8");
    const webhook = readFileSync("lib/billing/webhook.ts", "utf8");
    expect(service).toMatch(
      /const pending = await transaction\.subscription\.findFirst\(\{\s*where:\s*\{\s*companyId:\s*input\.companyId,\s*providerCheckoutId:\s*\{\s*startsWith:\s*"pending:"\s*\}/,
    );
    expect(service).toContain("portalCustomerLinkCount !== 1");
    expect(service).toContain("BILLING_SHARED_CUSTOMER_PORTAL_FORBIDDEN");
    expect(webhook).toContain(
      'mappedStatus === "PAST_DUE" || current.status === "PAST_DUE"',
    );
  });

  it("keeps invoice.paid canonical and canceled access through current_period_end", () => {
    expect(commercialAccessPolicy({
      status: "CANCELED",
      graceEndsAt: null,
      currentPeriodEnd: new Date("2026-08-01T00:00:00Z"),
      now: new Date("2026-07-29T00:00:00Z"),
    }).access).toBe("FULL");
    expect(commercialAccessPolicy({
      status: "CANCELED",
      graceEndsAt: null,
      currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
      now: new Date("2026-07-29T00:00:00Z"),
    }).access).toBe("READ_ONLY");
  });

  it("queues webhooks durably and schedules cross-product downgrades", () => {
    const route = readFileSync("app/api/billing/stripe/webhook/route.ts", "utf8");
    const scheduler = readFileSync("app/api/internal/proactive-evaluate/route.ts", "utf8");
    const service = readFileSync("lib/billing/service.ts", "utf8");
    const webhook = readFileSync("lib/billing/webhook.ts", "utf8");
    const portalConfig = readFileSync("infra/stripe/configure-catalog.mjs", "utf8");
    const subscriptionRoute = readFileSync("app/api/billing/subscription-change/route.ts", "utf8");
    expect(route).toContain("processStripeEvent");
    expect(webhook).toMatch(/processStripeEvent[\s\S]*return enqueueStripeEvent/);
    expect(scheduler).toContain("processPendingStripeEvents");
    expect(service).toContain("BILLING_OPEN_CHECKOUT_EXISTS");
    expect(service).toContain("STRIPE_PORTAL_CONFIGURATION_ID");
    expect(service).toContain("subscriptionSchedules.update");
    expect(service).toContain("checkoutReservationIsFresh");
    expect(service).toContain("proration_behavior: \"always_invoice\"");
    expect(service).toContain("payment_behavior: \"pending_if_incomplete\"");
    expect(service.match(/billing-subscription:/g)?.length).toBeGreaterThanOrEqual(3);
    expect(webhook).toContain("billing-subscription:");
    expect(webhook).toContain("validateLiveCheckoutCustomerDetails");
    expect(webhook).toContain("subscriptions.cancel");
    expect(portalConfig).toContain("subscription_update: { enabled: false }");
    expect(subscriptionRoute).toContain("requireBillingContext");
    expect(webhook).toContain('if (eventType === "invoice.paid" && !validTrial) data.status = "ACTIVE"');
    expect(webhook).toContain("providerPlanPending");
  });
});
