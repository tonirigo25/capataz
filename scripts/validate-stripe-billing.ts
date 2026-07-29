import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STRIPE_WEBHOOK_EVENTS,
  assertBillingCountryAllowed,
  billingPlanForStripePrice,
  normalizeBillingInterval,
  normalizeBillingPlanKey,
  pastDueGraceDays,
  stripePriceForPlan,
  stripeTrialDays,
} from "../lib/billing/config";
import { paidAccessState } from "../lib/billing/service";
import {
  isTerminalBillingEventResult,
  mapStripeSubscriptionStatus,
  shouldIgnoreStripeEvent,
} from "../lib/billing/webhook";
import {
  approvedMemberLimitForPlan,
  evaluateUsageLimit,
} from "../lib/commercial/limits";

type ScenarioResult = {
  id: `S${string}`;
  name: string;
  contractStatus: "PASS";
  contractEvidence: "executable-contract";
  remoteSandboxStatus: "PASS" | "NOT_RUN" | "NOT_REQUIRED";
};

const REMOTE_SANDBOX_SCENARIOS = new Set([
  "S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10",
  "S11", "S12", "S13", "S14", "S15",
  "S19", "S20", "S21", "S22", "S23", "S24", "S25",
]);

const checkoutRoute = readFileSync("app/api/billing/checkout/route.ts", "utf8");
const portalRoute = readFileSync("app/api/billing/portal/route.ts", "utf8");
const webhookRoute = readFileSync("app/api/billing/stripe/webhook/route.ts", "utf8");
const service = readFileSync("lib/billing/service.ts", "utf8");
const webhook = readFileSync("lib/billing/webhook.ts", "utf8");
const authorization = readFileSync("lib/billing/auth.ts", "utf8");
const graceJob = readFileSync("lib/billing/grace-job.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const stripeCatalog = readFileSync("infra/stripe/configure-catalog.mjs", "utf8");
const billingPolicy = readFileSync("docs/billing/STRIPE_BILLING_V1.md", "utf8");
const taxPolicy = readFileSync("docs/billing/TAX_AND_LIVE_AUTHORIZATION.md", "utf8");
const remoteSandboxRunner = readFileSync("scripts/validate-stripe-sandbox-remote.ts", "utf8");
const remoteEvidence = JSON.parse(
  readFileSync("docs/billing/evidence/stripe-sandbox-remote-2026-07-29.json", "utf8"),
) as {
  liveObjectsCreated: number;
  remoteScenarios: Record<string, {
    status: string;
    livemode?: boolean;
    verificationStatus?: string;
  }> & {
    S10: {
      status: string;
      livemode: boolean;
      amountExclusive: number;
      taxExclusive: number;
      total: number;
      effectiveRate: number;
      taxCode: string;
    };
  };
};

const priceEnvironment = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "sandbox",
  BILLING_ALLOWED_COUNTRIES: "ES",
  EU_B2B_CROSS_BORDER_ENABLED: "false",
  STRIPE_TRIAL_DAYS: "3",
  BILLING_PAST_DUE_GRACE_DAYS: "3",
  STRIPE_PRICE_STARTER_MONTHLY: "price_test_starter_month",
  STRIPE_PRICE_STARTER_ANNUAL: "price_test_starter_year",
  STRIPE_PRICE_PRO_MONTHLY: "price_test_pro_month",
  STRIPE_PRICE_PRO_ANNUAL: "price_test_pro_year",
  STRIPE_PRICE_BUSINESS_MONTHLY: "price_test_business_month",
  STRIPE_PRICE_BUSINESS_ANNUAL: "price_test_business_year",
} satisfies NodeJS.ProcessEnv;

const results: ScenarioResult[] = [];

function scenario(id: ScenarioResult["id"], name: string, validation: () => void) {
  validation();
  const recordedRemotePass = remoteEvidence.remoteScenarios[id]?.status === "PASS";
  results.push({
    id,
    name,
    contractStatus: "PASS",
    contractEvidence: "executable-contract",
    remoteSandboxStatus: recordedRemotePass
      ? "PASS"
      : REMOTE_SANDBOX_SCENARIOS.has(id)
        ? "NOT_RUN"
        : "NOT_REQUIRED",
  });
}

function matches(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, label);
}

function rejects(action: () => unknown, pattern: RegExp, label: string) {
  assert.throws(action, pattern, label);
}

function withBillingEnabled<T>(action: () => T): T {
  const previous = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = "true";
  try {
    return action();
  } finally {
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  }
}

scenario("S01", "starter mensual con tarjeta", () => {
  assert.equal(stripePriceForPlan("STARTER", "month", priceEnvironment), "price_test_starter_month");
  matches(service, /mode:\s*"subscription"[\s\S]*quantity:\s*1[\s\S]*payment_method_types:\s*\["card",\s*"sepa_debit"\]/, "Checkout must be a one-unit card/SEPA subscription");
});

scenario("S02", "pro anual con tarjeta", () => {
  assert.equal(normalizeBillingPlanKey("pro"), "PROFESSIONAL");
  assert.equal(normalizeBillingInterval("annual"), "year");
  assert.equal(stripePriceForPlan("PROFESSIONAL", "year", priceEnvironment), "price_test_pro_year");
});

scenario("S03", "business mensual con Link", () => {
  assert.equal(stripePriceForPlan("BUSINESS", "month", priceEnvironment), "price_test_business_month");
  matches(billingPolicy, /Link[\s\S]*(?:card|tarjeta)/i, "Link eligibility through the card payment method must be documented");
});

scenario("S04", "trial de 3 días", () => {
  assert.equal(stripeTrialDays(priceEnvironment), 3);
  matches(service, /payment_method_collection:\s*"always"[\s\S]*trial_period_days:\s*trialDays/, "Trial must always collect a payment method");
});

scenario("S05", "fin de trial y primer pago", () => {
  assert.equal(mapStripeSubscriptionStatus("active", "invoice.paid"), "ACTIVE");
  matches(webhook, /eventType === "invoice\.paid"[\s\S]*data\.status = "ACTIVE"/, "invoice.paid must activate access");
});

scenario("S06", "3DS requerido", () => {
  assert.ok(STRIPE_WEBHOOK_EVENTS.includes("invoice.payment_action_required"));
  matches(webhook, /checkout\.session\.[\s\S]*RECORDED_NO_ACCESS_CHANGE/, "Checkout completion cannot grant access before canonical billing events");
});

scenario("S07", "SEPA en processing", () => {
  matches(service, /payment_method_types:\s*\["card",\s*"sepa_debit"\]/, "SEPA must be an allowed payment method");
  matches(billingPolicy, /processing[\s\S]*invoice\.paid/i, "SEPA processing must not be treated as paid");
});

scenario("S08", "SEPA pagado", () => {
  assert.ok(STRIPE_WEBHOOK_EVENTS.includes("checkout.session.async_payment_succeeded"));
  assert.ok(STRIPE_WEBHOOK_EVENTS.includes("invoice.paid"));
  assert.equal(mapStripeSubscriptionStatus("active", "invoice.paid"), "ACTIVE");
});

scenario("S09", "SEPA fallido", () => {
  assert.ok(STRIPE_WEBHOOK_EVENTS.includes("checkout.session.async_payment_failed"));
  assert.equal(mapStripeSubscriptionStatus("active", "invoice.payment_failed"), "PAST_DUE");
});

scenario("S10", "tax España", () => {
  assert.equal(assertBillingCountryAllowed("ES", { livemode: true, environment: priceEnvironment }), "ES");
  matches(service, /automatic_tax:\s*\{\s*enabled:\s*true\s*\}/, "Automatic tax must be enabled");
  matches(service, /billing_address_collection:\s*"required"/, "Billing address must be required");
  matches(stripeCatalog, /tax_behavior:\s*"exclusive"/, "Prices must be tax-exclusive");
  assert.deepEqual(remoteEvidence.remoteScenarios.S10, {
    status: "PASS",
    evidence: "stripe-tax-calculation",
    idAbbreviated: "taxcalc_1TyY9…",
    livemode: false,
    currency: "eur",
    amountExclusive: 3900,
    taxExclusive: 819,
    total: 4719,
    effectiveRate: 0.21,
    location: { country: "ES", city: "Madrid", postalCode: "28001" },
    taxCode: "txcd_10103001",
  }, "Recorded S10 Sandbox calculation must remain exact and non-Live");
});

scenario("S11", "tax ID español", () => {
  matches(service, /tax_id_collection:\s*\{\s*enabled:\s*true\s*\}/, "Checkout must collect a tax ID");
  matches(service, /const checkoutCustomerUpdate = livemode[\s\S]*name:\s*"auto"[\s\S]*address:\s*"auto"/, "Checkout must collect legal name and address in Sandbox without overwriting the validated Live address");
  matches(service, /validateBillingProfile\(profile,\s*livemode\)/, "Server must validate the persisted B2B billing profile");
  matches(service, /email:\s*profile\.email[\s\S]*name:\s*profile\.legalName/, "Customer creation must use controlled profile email and legal name");
});

scenario("S12", "empresa UE con VAT ID válido", () => {
  assert.equal(assertBillingCountryAllowed("DE", { livemode: false, environment: priceEnvironment }), "DE");
  matches(taxPolicy, /validaci[oó]n[\s\S]*as[ií]ncrona/i, "VAT validation must be documented as asynchronous");
  matches(taxPolicy, /`000000000`\s*\|\s*verified/i, "Sandbox must trace the official verified test state");
});

scenario("S13", "VAT ID inválido", () => {
  matches(taxPolicy, /`111111111`\s*\|\s*unverified/i, "Sandbox must trace the official unverified test state");
  matches(taxPolicy, /unverified[\s\S]*(?:bloque|revisi[oó]n)/i, "Unverified VAT IDs must fail closed or require review");
});

scenario("S14", "VAT ID pendiente", () => {
  matches(taxPolicy, /`222222222`\s*\|\s*pending/i, "Sandbox must trace the official pending test state");
  matches(taxPolicy, /pending[\s\S]*(?:bloque|revisi[oó]n)/i, "Pending VAT IDs must fail closed or require review");
  assert.deepEqual(remoteEvidence.remoteScenarios.S14, {
    status: "PASS",
    evidence: "sandbox-customer-tax-id",
    livemode: false,
    verificationStatus: "pending",
  }, "Recorded S14 pending Tax ID must remain exact and non-Live");
});

scenario("S15", "cliente sin dirección", () => {
  matches(service, /billing_address_collection:\s*"required"/, "Checkout must reject missing billing address");
  matches(service, /const checkoutCustomerUpdate = livemode[\s\S]*address:\s*"auto"/, "Sandbox customer address must be persisted");
  matches(webhook, /validateLiveCheckoutCustomerDetails\(session\.customer_details\)/, "Live Checkout must revalidate the final address");
});

scenario("S16", "checkout UE bloqueado en Live", () => {
  rejects(
    () => assertBillingCountryAllowed("DE", { livemode: true, environment: priceEnvironment }),
    /BILLING_COUNTRY_NOT_ALLOWED/,
    "Live cross-border Checkout must be disabled",
  );
});

scenario("S17", "evento duplicado", () => {
  assert.equal(isTerminalBillingEventResult("PROCESSED"), true);
  matches(schema, /@@unique\(\[provider,\s*externalEventId\]\)/, "Stripe event IDs must be unique per provider");
});

scenario("S18", "evento fuera de orden", () => {
  assert.equal(shouldIgnoreStripeEvent({ stripeLastEventCreated: 200 }, 199), true);
  assert.equal(shouldIgnoreStripeEvent({ stripeLastEventCreated: 200 }, 200), false);
});

scenario("S19", "upgrade con prorrata", () => {
  matches(service, /subscriptions\.update[\s\S]*proration_behavior:\s*"always_invoice"[\s\S]*payment_behavior:\s*"pending_if_incomplete"/, "Server-authorized upgrades must invoice proration immediately and fail safely");
  matches(stripeCatalog, /subscription_update:\s*\{\s*enabled:\s*false\s*\}/, "Portal must not allow unscoped cross-product changes");
  matches(billingPolicy, /(?:upgrade|mejora)[\s\S]*inmediat[\s\S]*prorrata/i, "Immediate upgrade semantics must be documented");
});

scenario("S20", "downgrade al final", () => {
  matches(service, /intervalDowngrade[\s\S]*subscriptionSchedules\.update[\s\S]*proration_behavior:\s*"none"/, "Plan and annual-to-month decreases must be server-scheduled");
  matches(billingPolicy, /downgrade[\s\S]*(?:servidor|Subscription Schedule)[\s\S]*(?:final|period)/i, "Cross-product downgrade must be server-scheduled at period end");
});

scenario("S21", "cambio mensual/anual", () => {
  assert.deepEqual(billingPlanForStripePrice("price_test_pro_month", priceEnvironment), { planKey: "PROFESSIONAL", interval: "month" });
  assert.deepEqual(billingPlanForStripePrice("price_test_pro_year", priceEnvironment), { planKey: "PROFESSIONAL", interval: "year" });
});

scenario("S22", "cancelación al final", () => {
  matches(stripeCatalog, /subscription_cancel:\s*\{[\s\S]*mode:\s*"at_period_end"/, "Portal cancellation must occur at period end");
  matches(webhook, /cancelAtPeriodEnd:\s*subscription\.cancel_at_period_end/, "Cancellation scheduling must be synchronized locally");
});

scenario("S23", "impago días 0–3", () => {
  assert.equal(pastDueGraceDays(priceEnvironment), 3);
  const state = withBillingEnabled(() => paidAccessState({
    status: "PAST_DUE",
    currentPeriodEnd: new Date("2026-08-31T00:00:00Z"),
    graceEndsAt: new Date("2026-08-04T00:00:00Z"),
  }, new Date("2026-08-03T23:59:59Z")));
  assert.equal(state.paidAccess, true);
  assert.equal(state.reason, "past_due_grace");
});

scenario("S24", "sólo lectura desde día 4", () => {
  const state = withBillingEnabled(() => paidAccessState({
    status: "PAST_DUE",
    currentPeriodEnd: new Date("2026-08-31T00:00:00Z"),
    graceEndsAt: new Date("2026-08-04T00:00:00Z"),
  }, new Date("2026-08-04T00:00:00Z")));
  assert.equal(state.paidAccess, false);
  assert.equal(state.basicAccess, true);
  matches(graceJob, /billingGraceEnforcedFor[\s\S]*billing\.access_changed_to_read_only/, "Grace expiry job must be replay-safe and audited");
});

scenario("S25", "recuperación de pago", () => {
  assert.equal(mapStripeSubscriptionStatus("active", "invoice.paid"), "ACTIVE");
  matches(webhook, /eventType === "invoice\.paid"[\s\S]*graceEndsAt = null[\s\S]*readOnlyAt = null/, "Recovered payment must clear read-only grace markers");
});

scenario("S26", "Customer Portal sin autorización", () => {
  matches(portalRoute, /requireBillingContext\(\)/, "Portal must require a server-side billing context");
  matches(authorization, /resolveAuthorization\(context,\s*"company\.billing\.manage"\)/, "Portal requires scoped billing management authorization");
  matches(remoteSandboxRunner, /STRIPE_PORTAL_CONFIGURATION_ID/, "Remote inventory must retrieve the environment-specific Portal configuration");
});

scenario("S27", "companyId cruzado", () => {
  matches(checkoutRoute, /companyId:\s*context\.companyId/, "Checkout company must come from the authenticated context");
  assert.doesNotMatch(checkoutRoute, /input\.companyId|body\.companyId/, "Checkout must never trust client companyId");
});

scenario("S28", "segunda suscripción activa", () => {
  matches(service, /BILLING_ACTIVE_SUBSCRIPTION_EXISTS/, "Server must reject a second active subscription");
  matches(service, /pg_advisory_xact_lock[\s\S]*billing-subscription:/, "Company subscription reservation must use the shared lock");
  matches(webhook, /pg_advisory_xact_lock[\s\S]*billing-subscription:/, "Webhook synchronization must use the same shared lock");
});

scenario("S29", "success URL sin webhook", () => {
  matches(service, /success_url:[\s\S]*checkout=success/, "Checkout uses a non-authoritative success URL");
  assert.doesNotMatch(checkoutRoute, /subscription\.(?:create|update)|entitlement\.(?:create|update)|planId:/, "Success URL handling must not grant access");
  matches(webhook, /checkout\.session\.[\s\S]*RECORDED_NO_ACCESS_CHANGE/, "Checkout events are non-authoritative for access");
});

scenario("S30", "billing flag false", () => {
  matches(service, /if \(!isBillingEnabled\(\)\) throw new Error\("BILLING_DISABLED"\)/, "Checkout and Portal must fail closed");
  matches(webhookRoute, /processStripeEvent\(event,\s*\{\s*effectsEnabled:\s*isBillingEnabled\(\)\s*\}\)/, "Verified Live webhooks must have effects disabled while billing is off");
  matches(remoteSandboxRunner, /REMOTE_SANDBOX_LIVE_KEY_FORBIDDEN/, "Remote Sandbox runner must reject Live keys");
  matches(remoteSandboxRunner, /STRIPE_SANDBOX_REMOTE_ALLOW_WRITES[\s\S]*allowWrites[\s\S]*runWriteSandboxFixtures/, "Sandbox writes must require a separate explicit opt-in");
  matches(remoteSandboxRunner, /example\.invalid/, "Sandbox fixture identities must use reserved synthetic addresses");
});

scenario("S31", "aviso de límite al 80 %", () => {
  assert.equal(approvedMemberLimitForPlan("starter"), 2);
  const decision = evaluateUsageLimit({ used: 1, limit: 5, quantity: 3, operation: "CREATE" });
  assert.equal(decision.utilization, 0.8);
  assert.equal(decision.warning, true);
  assert.equal(decision.allowed, true);
  assert.equal(decision.audit.automaticCharge, false);
});

scenario("S32", "bloqueo al 100 %", () => {
  assert.equal(approvedMemberLimitForPlan("pro"), 5);
  assert.equal(approvedMemberLimitForPlan("business"), 15);
  const decision = evaluateUsageLimit({ used: 5, limit: 5, quantity: 1, operation: "CREATE" });
  assert.equal(decision.blocked, true);
  assert.equal(decision.nextAction, "offer_plan_change_or_renewal");
  assert.equal(decision.audit.automaticCharge, false);
});

scenario("S33", "lectura permitida tras bloqueo", () => {
  const decision = evaluateUsageLimit({ used: 6, limit: 5, operation: "READ" });
  assert.equal(decision.allowed, true);
  assert.equal(decision.blocked, false);
});

scenario("S34", "no borrado de datos", () => {
  const inactive = withBillingEnabled(() => paidAccessState({
    status: "UNPAID",
    currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
  }, new Date("2026-07-29T00:00:00Z")));
  assert.equal(inactive.paidAccess, false);
  assert.equal(inactive.basicAccess, true);
  assert.doesNotMatch(service + webhook + graceJob, /\.(?:delete|deleteMany)\s*\(/, "Billing transitions must never delete customer data");
});

assert.equal(results.length, 34, "The Sandbox contract matrix must contain exactly 34 scenarios");
assert.deepEqual(
  results.map((result) => result.id),
  Array.from({ length: 34 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`),
  "Scenario IDs must be stable and contiguous",
);

console.log(JSON.stringify({
  ok: true,
  verdict: "CONTRACT_PASS_REMOTE_SANDBOX_PARTIAL",
  contract: {
    scenarioCount: results.length,
    passed: results.filter((result) => result.contractStatus === "PASS").length,
  },
  remoteSandbox: {
    required: results.filter((result) => result.remoteSandboxStatus !== "NOT_REQUIRED").length,
    passed: results.filter((result) => result.remoteSandboxStatus === "PASS").length,
    notRun: results.filter((result) => result.remoteSandboxStatus === "NOT_RUN").length,
  },
  liveChargesCreated: remoteEvidence.liveObjectsCreated,
  results,
}, null, 2));
