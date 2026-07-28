import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STRIPE_WEBHOOK_EVENTS } from "../lib/billing/config";
import {
  isTerminalBillingEventResult,
  mapStripeSubscriptionStatus,
  shouldIgnoreStripeEvent,
} from "../lib/billing/webhook";

const checkoutRoute = readFileSync("app/api/billing/checkout/route.ts", "utf8");
const portalRoute = readFileSync("app/api/billing/portal/route.ts", "utf8");
const webhookRoute = readFileSync("app/api/billing/stripe/webhook/route.ts", "utf8");
const service = readFileSync("lib/billing/service.ts", "utf8");
const authorization = readFileSync("lib/billing/auth.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
let cases = 0;

function match(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, label);
  cases += 1;
}
function equal(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label);
  cases += 1;
}

match(checkoutRoute, /requireBillingContext\(\)[\s\S]*companyId:\s*context\.companyId/, "checkout is authenticated and company-scoped");
assert.doesNotMatch(checkoutRoute, /input\.companyId|body\.companyId/, "checkout never trusts a client companyId");
cases += 1;
match(portalRoute, /requireBillingContext\(\)[\s\S]*companyId:\s*context\.companyId/, "portal is authenticated and company-scoped");
match(authorization, /resolveAuthorization\(context,\s*"company\.billing\.manage"\)/, "billing requires the scoped management permission");
match(service, /billingCustomer\.findUnique\(\{\s*where:\s*\{\s*companyId:/, "portal customer is resolved by company");
match(service, /BILLING_CUSTOMER_NOT_FOUND/, "portal fails explicitly without a customer");
match(service, /success_url:[\s\S]*checkout=success/, "checkout uses an app success URL");
assert.doesNotMatch(checkoutRoute, /subscription\.(?:create|update)|entitlement\.(?:create|update)|planId:/, "checkout success cannot grant access");
cases += 1;
match(webhookRoute, /request\.text\(\)/, "webhook reads the raw body");
match(webhookRoute, /constructEvent\(body,\s*signature,\s*requireStripeWebhookSecret\(\)\)/, "webhook verifies its signature");
match(schema, /stripeEventId\s+String\s+@unique/, "billing events are idempotent");

equal(isTerminalBillingEventResult("PROCESSED"), true, "duplicate processed event");
equal(isTerminalBillingEventResult("IGNORED_OUT_OF_ORDER"), true, "duplicate ignored event");
equal(isTerminalBillingEventResult("FAILED:TRANSIENT"), false, "failed event may retry");
equal(shouldIgnoreStripeEvent({ stripeLastEventCreated: 200 }, 199), true, "older event is ignored");
equal(shouldIgnoreStripeEvent({ stripeLastEventCreated: 200 }, 200), false, "equal timestamp remains idempotent");
equal(mapStripeSubscriptionStatus("active", "invoice.paid"), "ACTIVE", "invoice paid");
equal(mapStripeSubscriptionStatus("active", "invoice.payment_failed"), "PAST_DUE", "payment failed");
equal(mapStripeSubscriptionStatus("active", "customer.subscription.paused"), "PAUSED", "pause");
equal(mapStripeSubscriptionStatus("paused", "customer.subscription.resumed"), "PAUSED", "resume follows retrieved Stripe status");
equal(mapStripeSubscriptionStatus("canceled", "customer.subscription.deleted"), "CANCELED", "cancellation");
equal(STRIPE_WEBHOOK_EVENTS, [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
], "required event matrix");

console.log(`[stripe-billing] OK ${cases} casos`);
