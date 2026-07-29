import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { STRIPE_WEBHOOK_EVENTS } from "../lib/billing/config";

const CATALOG = [
  { variable: "STRIPE_PRICE_STARTER_MONTHLY", lookupKey: "capataz_starter_monthly_v1", amount: 3_900, interval: "month" },
  { variable: "STRIPE_PRICE_STARTER_ANNUAL", lookupKey: "capataz_starter_annual_v1", amount: 39_000, interval: "year" },
  { variable: "STRIPE_PRICE_PRO_MONTHLY", lookupKey: "capataz_pro_monthly_v1", amount: 7_900, interval: "month" },
  { variable: "STRIPE_PRICE_PRO_ANNUAL", lookupKey: "capataz_pro_annual_v1", amount: 79_000, interval: "year" },
  { variable: "STRIPE_PRICE_BUSINESS_MONTHLY", lookupKey: "capataz_business_monthly_v1", amount: 14_900, interval: "month" },
  { variable: "STRIPE_PRICE_BUSINESS_ANNUAL", lookupKey: "capataz_business_annual_v1", amount: 149_000, interval: "year" },
] as const;

const REMOTE_SCENARIOS = new Map([
  ["S01", "starter mensual con tarjeta"],
  ["S02", "pro anual con tarjeta"],
  ["S03", "business mensual con Link"],
  ["S04", "trial de 3 días"],
  ["S05", "fin de trial y primer pago"],
  ["S06", "3DS requerido"],
  ["S07", "SEPA en processing"],
  ["S08", "SEPA pagado"],
  ["S09", "SEPA fallido"],
  ["S10", "tax España"],
  ["S11", "tax ID español"],
  ["S12", "empresa UE con VAT ID válido"],
  ["S13", "VAT ID inválido"],
  ["S14", "VAT ID pendiente"],
  ["S15", "cliente sin dirección"],
  ["S19", "upgrade con prorrata"],
  ["S20", "downgrade al final"],
  ["S21", "cambio mensual/anual"],
  ["S22", "cancelación al final"],
  ["S23", "impago días 0–3"],
  ["S24", "sólo lectura desde día 4"],
  ["S25", "recuperación de pago"],
] as const);

type RemoteResult = {
  id: string;
  name: string;
  status: "PASS" | "NOT_RUN";
  evidence?: string;
  cause?: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`REMOTE_SANDBOX_VARIABLE_REQUIRED:${name}`);
  return value;
}

function abbreviated(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function safeCause(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) return `STRIPE_${error.code || error.type}`;
  if (error instanceof Error) return error.message.split(":")[0].slice(0, 100);
  return "REMOTE_SANDBOX_OPERATION_FAILED";
}

function initialScenarioResults(allowWrites: boolean): Map<string, RemoteResult> {
  return new Map([...REMOTE_SCENARIOS].map(([id, name]) => [id, {
    id,
    name,
    status: "NOT_RUN",
    cause: allowWrites
      ? "The remote flow has not produced complete evidence yet."
      : "Read-only mode: set STRIPE_SANDBOX_REMOTE_ALLOW_WRITES=true to create disposable Sandbox fixtures.",
  }]));
}

function markPass(results: Map<string, RemoteResult>, id: string, evidence: string) {
  const current = results.get(id);
  if (!current) throw new Error(`REMOTE_SCENARIO_UNKNOWN:${id}`);
  results.set(id, { id, name: current.name, status: "PASS", evidence });
}

function markNotRun(results: Map<string, RemoteResult>, id: string, cause: string) {
  const current = results.get(id);
  if (!current || current.status === "PASS") return;
  results.set(id, { id, name: current.name, status: "NOT_RUN", cause });
}

async function readOnlyInventory(stripe: Stripe, portalConfigurationId: string, expectedWebhookUrl: string) {
  const priceIds = CATALOG.map((entry) => required(entry.variable));
  assert.equal(new Set(priceIds).size, CATALOG.length, "Sandbox Price IDs must be unique");
  const prices = await Promise.all(priceIds.map((id) => stripe.prices.retrieve(id)));
  const productIds = new Set<string>();

  for (const [index, price] of prices.entries()) {
    const expected = CATALOG[index];
    assert.equal(price.livemode, false, `${expected.variable} must be Sandbox`);
    assert.equal(price.active, true, `${expected.variable} must be active`);
    assert.equal(price.currency, "eur", `${expected.variable} must use EUR`);
    assert.equal(price.unit_amount, expected.amount, `${expected.variable} amount drift`);
    assert.equal(price.recurring?.interval, expected.interval, `${expected.variable} interval drift`);
    assert.equal(price.recurring?.usage_type, "licensed", `${expected.variable} must not be metered`);
    assert.equal(price.tax_behavior, "exclusive", `${expected.variable} must be tax-exclusive`);
    assert.equal(price.lookup_key, expected.lookupKey, `${expected.variable} lookup key drift`);
    assert.equal(typeof price.product, "string", `${expected.variable} must reference a Product ID`);
    productIds.add(price.product as string);
  }
  assert.equal(productIds.size, 3, "Sandbox catalog must contain exactly three Products");

  const products = await Promise.all([...productIds].map((id) => stripe.products.retrieve(id)));
  for (const product of products) {
    assert.equal(product.livemode, false, "Product must be Sandbox");
    assert.equal(product.active, true, "Product must be active");
    assert.equal(product.tax_code, "txcd_10103001", "Product SaaS tax code drift");
    assert.equal(product.metadata.product_family, "capataz", "Product family drift");
    assert.equal(product.metadata.version, "v1", "Product version drift");
    assert.equal(product.metadata.environment, "sandbox", "Product environment drift");
  }

  const portal = await stripe.billingPortal.configurations.retrieve(portalConfigurationId);
  assert.equal(portal.livemode, false, "Portal configuration must be Sandbox");
  assert.equal(portal.active, true, "Portal configuration must be active");
  assert.equal(portal.features.invoice_history.enabled, true, "Portal invoice history must be enabled");
  assert.equal(portal.features.payment_method_update.enabled, true, "Portal payment updates must be enabled");
  assert.equal(portal.features.subscription_cancel.enabled, true, "Portal cancellation must be enabled");
  assert.equal(portal.features.subscription_cancel.mode, "at_period_end", "Portal cancellation must be scheduled");

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  assert.ok(endpoints.data.every((endpoint) => !endpoint.livemode), "Live webhook endpoint returned by Sandbox account");
  const webhook = endpoints.data.find((endpoint) => endpoint.url === expectedWebhookUrl);
  assert.ok(webhook, "Expected Sandbox webhook endpoint was not found");
  for (const event of STRIPE_WEBHOOK_EVENTS) {
    assert.ok(
      webhook.enabled_events.includes(event) || webhook.enabled_events.includes("*"),
      `Sandbox webhook is missing ${event}`,
    );
  }
  const taxSettings = await stripe.tax.settings.retrieve();
  const paymentMethodConfigurations = await stripe.paymentMethodConfigurations.list({ limit: 100 });
  const paymentMethods = paymentMethodConfigurations.data.find((configuration) => configuration.is_default);
  assert.ok(paymentMethods, "Default Sandbox PaymentMethodConfiguration was not found");
  assert.equal(paymentMethods.livemode, false, "Payment method configuration must be Sandbox");
  assert.equal(paymentMethods.active, true, "Payment method configuration must be active");
  for (const [name, method] of [
    ["card", paymentMethods.card],
    ["link", paymentMethods.link],
    ["sepa_debit", paymentMethods.sepa_debit],
  ] as const) {
    assert.equal(method?.available, true, `${name} must be available`);
    assert.equal(method?.display_preference.preference, "on", `${name} preference must be on`);
  }

  const registrations = await stripe.tax.registrations.list({ limit: 100 });
  const spanishRegistration = registrations.data.find((registration) => (
    registration.country === "ES" && registration.status === "active"
  ));
  assert.ok(spanishRegistration, "Active Spanish Sandbox Tax Registration was not found");
  assert.equal(spanishRegistration.livemode, false, "Spanish Tax Registration must be Sandbox");
  assert.equal(spanishRegistration.country_options.es?.type, "standard", "Spanish registration type drift");
  assert.equal(
    spanishRegistration.country_options.es?.standard?.place_of_supply_scheme,
    "standard",
    "Spanish place-of-supply scheme drift",
  );
  return {
    prices,
    products,
    portal,
    webhook,
    taxSettings,
    paymentMethods,
    spanishRegistration,
  };
}

async function pollTaxId(
  stripe: Stripe,
  customerId: string,
  taxIdId: string,
  expected: "verified" | "unverified" | "pending",
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const taxId = await stripe.customers.retrieveTaxId(customerId, taxIdId);
    const status = taxId.verification?.status ?? "pending";
    if (status === expected) return taxId;
    if (expected === "pending" && status === "pending") return taxId;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`VAT_STATUS_NOT_REACHED_${expected.toUpperCase()}`);
}

async function runWriteSandboxFixtures(
  stripe: Stripe,
  priceIds: string[],
  portalConfigurationId: string,
  results: Map<string, RemoteResult>,
) {
  const runId = `capataz_${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const cleanup = {
    checkoutSessions: [] as string[],
    customers: [] as string[],
    testClocks: [] as string[],
  };
  const created = {
    runId,
    checkouts: [] as string[],
    portalSessions: 0,
    testClocks: 0,
    taxCalculations: 0,
    taxIds: 0,
  };
  const cleanupErrors: string[] = [];

  try {
    let clockCustomer: Stripe.Customer | null = null;
    try {
      const clock = await stripe.testHelpers.testClocks.create({
        frozen_time: Math.floor(Date.now() / 1_000),
        name: runId,
      });
      assert.equal(clock.livemode, false, "Test Clock must be Sandbox");
      cleanup.testClocks.push(clock.id);
      created.testClocks += 1;
      clockCustomer = await stripe.customers.create({
        email: `capataz+${runId}@example.invalid`,
        name: "Capataz Sandbox Fixture",
        address: { line1: "Calle Sandbox 1", postal_code: "28001", city: "Madrid", country: "ES" },
        test_clock: clock.id,
        metadata: { run_id: runId, environment: "sandbox", synthetic: "true" },
      });
      assert.equal(clockCustomer.livemode, false, "Fixture Customer must be Sandbox");
      cleanup.customers.push(clockCustomer.id);
    } catch (error) {
      for (const id of ["S04", "S05", "S23", "S24", "S25"]) {
        markNotRun(results, id, `Test Clock fixture failed: ${safeCause(error)}`);
      }
    }

    if (clockCustomer) {
      const fixtureSpecs = [
        { scenario: "S01", price: priceIds[0], methods: ["card"] as const },
        { scenario: "S02", price: priceIds[3], methods: ["card"] as const },
        { scenario: "S03", price: priceIds[4], methods: ["card"] as const },
        { scenario: "S07", price: priceIds[0], methods: ["sepa_debit"] as const },
      ];
      for (const spec of fixtureSpecs) {
        try {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: clockCustomer.id,
            line_items: [{ price: spec.price, quantity: 1 }],
            payment_method_types: [...spec.methods],
            payment_method_collection: "always",
            billing_address_collection: "required",
            tax_id_collection: { enabled: true },
            automatic_tax: { enabled: true },
            customer_update: { name: "auto", address: "auto" },
            success_url: `https://example.invalid/stripe-sandbox/success?run_id=${runId}`,
            cancel_url: `https://example.invalid/stripe-sandbox/cancel?run_id=${runId}`,
            metadata: { run_id: runId, scenario: spec.scenario, environment: "sandbox" },
            subscription_data: {
              trial_period_days: 3,
              metadata: { run_id: runId, scenario: spec.scenario, environment: "sandbox" },
            },
          });
          assert.equal(session.livemode, false, "Checkout fixture must be Sandbox");
          cleanup.checkoutSessions.push(session.id);
          created.checkouts.push(abbreviated(session.id));
          markNotRun(
            results,
            spec.scenario,
            spec.scenario === "S03"
              ? "Checkout fixture created; Link visibility requires hosted Checkout UI."
              : "Checkout fixture created; test payment and webhook completion were not executed.",
          );
        } catch (error) {
          markNotRun(results, spec.scenario, `Checkout fixture failed: ${safeCause(error)}`);
        }
      }
      try {
        await stripe.billingPortal.sessions.create({
          customer: clockCustomer.id,
          configuration: portalConfigurationId,
          return_url: `https://example.invalid/stripe-sandbox/portal-return?run_id=${runId}`,
        });
        created.portalSessions += 1;
        for (const id of ["S19", "S20", "S21", "S22"]) {
          markNotRun(results, id, "Portal session created; an authenticated UI transition and resulting subscription event remain unexecuted.");
        }
      } catch (error) {
        for (const id of ["S19", "S20", "S21", "S22"]) {
          markNotRun(results, id, `Portal fixture failed: ${safeCause(error)}`);
        }
      }
    }

    try {
      const calculation = await stripe.tax.calculations.create({
        currency: "eur",
        customer_details: {
          address_source: "billing",
          address: { line1: "Calle Sandbox 1", postal_code: "28001", city: "Madrid", country: "ES" },
        },
        line_items: [{
          amount: 3_900,
          quantity: 1,
          reference: `${runId}_S10`,
          tax_behavior: "exclusive",
          tax_code: "txcd_10103001",
          metadata: { run_id: runId, scenario: "S10" },
        }],
      });
      assert.equal(calculation.livemode, false, "Tax calculation must be Sandbox");
      if (!calculation.id) throw new Error("STRIPE_TAX_CALCULATION_ID_MISSING");
      created.taxCalculations += 1;
      markPass(results, "S10", `Stripe Tax calculation ${abbreviated(calculation.id)} completed in Sandbox.`);
    } catch (error) {
      markNotRun(results, "S10", `Stripe Tax calculation failed: ${safeCause(error)}`);
    }

    try {
      const customer = await stripe.customers.create({
        email: `capataz+nif-s11-${runId}@example.invalid`,
        name: "Capataz NIF Sandbox Fixture",
        address: { line1: "Calle Sandbox 1", postal_code: "28001", city: "Madrid", country: "ES" },
        metadata: { run_id: runId, scenario: "S11", environment: "sandbox", synthetic: "true" },
      });
      assert.equal(customer.livemode, false, "Spanish NIF fixture Customer must be Sandbox");
      cleanup.customers.push(customer.id);
      const taxId = await stripe.customers.createTaxId(customer.id, { type: "es_cif", value: "B12345678" });
      assert.equal(taxId.livemode, false, "Spanish NIF fixture must be Sandbox");
      assert.equal(taxId.type, "es_cif", "Spanish NIF fixture type drift");
      created.taxIds += 1;
      markPass(
        results,
        "S11",
        `Spanish es_cif ${abbreviated(taxId.id)} was accepted on a synthetic Sandbox customer.`,
      );
    } catch (error) {
      markNotRun(results, "S11", `Spanish NIF fixture failed: ${safeCause(error)}`);
    }

    for (const fixture of [
      { scenario: "S12", value: "DE000000000", expected: "verified" as const },
      { scenario: "S13", value: "DE111111111", expected: "unverified" as const },
      { scenario: "S14", value: "DE222222222", expected: "pending" as const },
    ]) {
      let customer: Stripe.Customer | null = null;
      try {
        customer = await stripe.customers.create({
          email: `capataz+vat-${fixture.scenario.toLowerCase()}-${runId}@example.invalid`,
          name: "Capataz VAT Sandbox Fixture",
          address: { line1: "Sandboxstrasse 1", postal_code: "10115", city: "Berlin", country: "DE" },
          metadata: { run_id: runId, scenario: fixture.scenario, environment: "sandbox", synthetic: "true" },
        });
        assert.equal(customer.livemode, false, "VAT fixture Customer must be Sandbox");
        cleanup.customers.push(customer.id);
        const taxId = await stripe.customers.createTaxId(customer.id, { type: "eu_vat", value: fixture.value });
        assert.equal(taxId.livemode, false, "Tax ID must be Sandbox");
        created.taxIds += 1;
        const verified = await pollTaxId(stripe, customer.id, taxId.id, fixture.expected);
        markPass(
          results,
          fixture.scenario,
          `Sandbox VAT state ${verified.verification?.status ?? "pending"} observed on ${abbreviated(taxId.id)}.`,
        );
      } catch (error) {
        markNotRun(results, fixture.scenario, `VAT fixture failed: ${safeCause(error)}`);
      }
    }

    markNotRun(results, "S06", "3DS requires hosted Checkout UI and a Stripe test card; no card data is embedded in this runner.");
    for (const id of ["S08", "S09"]) {
      markNotRun(results, id, "SEPA settlement/failure is asynchronous and was not simulated by fixture creation.");
    }
    markNotRun(results, "S15", "Missing-address rejection requires hosted Checkout UI completion.");
  } finally {
    for (const sessionId of cleanup.checkoutSessions.reverse()) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
      } catch (error) {
        cleanupErrors.push(`checkout:${abbreviated(sessionId)}:${safeCause(error)}`);
      }
    }
    for (const customerId of cleanup.customers.reverse()) {
      try {
        await stripe.customers.del(customerId);
      } catch (error) {
        cleanupErrors.push(`customer:${abbreviated(customerId)}:${safeCause(error)}`);
      }
    }
    for (const clockId of cleanup.testClocks.reverse()) {
      try {
        await stripe.testHelpers.testClocks.del(clockId);
      } catch (error) {
        cleanupErrors.push(`clock:${abbreviated(clockId)}:${safeCause(error)}`);
      }
    }
  }
  return { created, cleanupErrors };
}

async function main() {
  if (process.env.STRIPE_REMOTE_SANDBOX_ENABLED !== "true") {
    throw new Error("REMOTE_SANDBOX_EXPLICIT_OPT_IN_REQUIRED");
  }
  if (process.env.BILLING_ENABLED !== "false") {
    throw new Error("REMOTE_SANDBOX_REQUIRES_BILLING_DISABLED");
  }

  const secretKey = required("STRIPE_SECRET_KEY");
  if (/^(?:sk|rk)_live_/.test(secretKey)) throw new Error("REMOTE_SANDBOX_LIVE_KEY_FORBIDDEN");
  if (!/^(?:sk|rk)_test_/.test(secretKey)) throw new Error("REMOTE_SANDBOX_TEST_KEY_REQUIRED");

  const allowWrites = process.env.STRIPE_SANDBOX_REMOTE_ALLOW_WRITES === "true";
  const portalConfigurationId = required("STRIPE_PORTAL_CONFIGURATION_ID");
  const expectedWebhookUrl = required("STRIPE_REMOTE_SANDBOX_WEBHOOK_URL");
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
  const inventory = await readOnlyInventory(stripe, portalConfigurationId, expectedWebhookUrl);
  const scenarios = initialScenarioResults(allowWrites);
  const writeEvidence = allowWrites
    ? await runWriteSandboxFixtures(
      stripe,
      inventory.prices.map((price) => price.id),
      portalConfigurationId,
      scenarios,
    )
    : null;

  const scenarioResults = [...scenarios.values()];
  console.log(JSON.stringify({
    ok: writeEvidence?.cleanupErrors.length ? false : true,
    evidence: allowWrites ? "remote-sandbox-disposable-fixtures" : "remote-sandbox-read-only-inventory",
    mode: allowWrites ? "sandbox-writes" : "read-only",
    liveObjectsCreated: 0,
    catalog: {
      prices: inventory.prices.length,
      products: inventory.products.length,
      priceIds: inventory.prices.map((price) => abbreviated(price.id)),
    },
    portal: { id: abbreviated(inventory.portal.id), active: inventory.portal.active },
    webhook: { id: abbreviated(inventory.webhook.id), eventCoverage: STRIPE_WEBHOOK_EVENTS.length },
    tax: {
      status: inventory.taxSettings.status,
      headOfficeCountry: inventory.taxSettings.head_office?.address.country ?? null,
      spanishRegistration: {
        id: abbreviated(inventory.spanishRegistration.id),
        status: inventory.spanishRegistration.status,
        type: inventory.spanishRegistration.country_options.es?.type ?? null,
        placeOfSupplyScheme: inventory.spanishRegistration.country_options.es?.standard?.place_of_supply_scheme ?? null,
      },
    },
    paymentMethods: {
      id: abbreviated(inventory.paymentMethods.id),
      default: inventory.paymentMethods.is_default,
      card: inventory.paymentMethods.card?.available ?? false,
      link: inventory.paymentMethods.link?.available ?? false,
      sepaDebit: inventory.paymentMethods.sepa_debit?.available ?? false,
    },
    writes: writeEvidence,
    scenarios: {
      required: scenarioResults.length,
      passed: scenarioResults.filter((result) => result.status === "PASS").length,
      notRun: scenarioResults.filter((result) => result.status === "NOT_RUN").length,
      results: scenarioResults,
    },
    isolatedEvidence: {
      command: "npx tsx scripts/validate-stripe-billing-isolated.ts",
      covers: ["S17", "S18", "S26", "S27", "S28", "S29", "S30", "S31", "S32", "S33", "S34"],
    },
  }, null, 2));
  if (writeEvidence?.cleanupErrors.length) process.exitCode = 1;
}

main().catch((error) => {
  const message = safeCause(error);
  console.error(`[stripe-remote-sandbox] FAIL ${message}`);
  process.exitCode = 1;
});
