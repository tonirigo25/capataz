import Stripe from "stripe";

const MODE = process.argv.includes("--live") ? "live" : "sandbox";
const APPLY = process.argv.includes("--apply");
const expectedLive = MODE === "live";

if (expectedLive && process.env.BILLING_ENABLED !== "false") {
  throw new Error("STRIPE_LIVE_CATALOG_REQUIRES_BILLING_DISABLED");
}

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) throw new Error("STRIPE_SECRET_KEY_REQUIRED");
if (expectedLive && !/^(?:sk|rk)_live_/.test(secretKey)) throw new Error("STRIPE_LIVE_KEY_REQUIRED");
if (!expectedLive && !/^(?:sk|rk)_test_/.test(secretKey)) throw new Error("STRIPE_TEST_KEY_REQUIRED");

const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
const environment = expectedLive ? "live" : "sandbox";

const catalog = [
  {
    planKey: "starter",
    name: "Capataz Inicial",
    prices: [
      { interval: "monthly", stripeInterval: "month", amount: 3_900 },
      { interval: "annual", stripeInterval: "year", amount: 39_000 },
    ],
  },
  {
    planKey: "pro",
    name: "Capataz Equipo",
    prices: [
      { interval: "monthly", stripeInterval: "month", amount: 7_900 },
      { interval: "annual", stripeInterval: "year", amount: 79_000 },
    ],
  },
  {
    planKey: "business",
    name: "Capataz Control",
    prices: [
      { interval: "monthly", stripeInterval: "month", amount: 14_900 },
      { interval: "annual", stripeInterval: "year", amount: 149_000 },
    ],
  },
];

function metadata(planKey) {
  return {
    plan_key: planKey,
    product_family: "capataz",
    version: "v1",
    environment,
  };
}

async function findProduct(planKey) {
  const matches = [];
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (
      product.metadata.plan_key === planKey &&
      product.metadata.product_family === "capataz" &&
      product.metadata.version === "v1" &&
      product.metadata.environment === environment
    ) {
      matches.push(product);
    }
  }
  if (matches.length > 1) throw new Error(`STRIPE_DUPLICATE_PRODUCT:${planKey}:${environment}`);
  return matches[0] ?? null;
}

async function ensureProduct(entry) {
  let product = await findProduct(entry.planKey);
  if (!product) {
    if (!APPLY) return { id: null, action: "create-required" };
    product = await stripe.products.create({
      active: true,
      name: entry.name,
      statement_descriptor: "ORQENATECH",
      tax_code: "txcd_10103001",
      metadata: metadata(entry.planKey),
    });
    return { id: product.id, action: "created" };
  }

  const valid =
    product.active &&
    product.name === entry.name &&
    product.statement_descriptor === "ORQENATECH" &&
    product.tax_code === "txcd_10103001";
  if (!valid) throw new Error(`STRIPE_PRODUCT_DRIFT:${entry.planKey}:${environment}`);
  return { id: product.id, action: "reused" };
}

async function ensurePrice(productId, planKey, priceSpec) {
  const lookupKey = `capataz_${planKey}_${priceSpec.interval}_v1`;
  const found = await stripe.prices.list({ active: true, lookup_keys: [lookupKey], limit: 10 });
  if (found.data.length > 1) throw new Error(`STRIPE_DUPLICATE_PRICE:${lookupKey}`);
  let price = found.data[0] ?? null;

  if (!price) {
    if (!APPLY) return { id: null, lookupKey, action: "create-required" };
    price = await stripe.prices.create({
      active: true,
      currency: "eur",
      unit_amount: priceSpec.amount,
      product: productId,
      recurring: { interval: priceSpec.stripeInterval, interval_count: 1, usage_type: "licensed" },
      tax_behavior: "exclusive",
      lookup_key: lookupKey,
      metadata: {
        plan_key: planKey,
        billing_interval: priceSpec.interval,
        environment,
      },
    });
    return { id: price.id, lookupKey, action: "created" };
  }

  const valid =
    price.livemode === expectedLive &&
    price.product === productId &&
    price.currency === "eur" &&
    price.unit_amount === priceSpec.amount &&
    price.recurring?.interval === priceSpec.stripeInterval &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed" &&
    price.tax_behavior === "exclusive";
  if (!valid) throw new Error(`STRIPE_PRICE_DRIFT:${lookupKey}`);
  return { id: price.id, lookupKey, action: "reused" };
}

async function ensurePortalConfiguration(products) {
  const name = `Capataz ${expectedLive ? "Live" : "Sandbox"} v1`;
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const matches = configurations.data.filter((configuration) => configuration.name === name);
  if (matches.length > 1) throw new Error(`STRIPE_DUPLICATE_PORTAL_CONFIGURATION:${environment}`);

  const params = {
    name,
    default_return_url: "https://app.orqenatech.com/plan-y-uso",
    business_profile: {
      headline: "Capataz, by Orqena",
      privacy_policy_url: "https://orqenatech.com/privacidad",
      terms_of_service_url: "https://orqenatech.com/terminos",
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
        },
      },
      // Product and interval changes are server-authorized per company.
      // The hosted portal cannot enforce cross-product upgrade/downgrade policy.
      subscription_update: { enabled: false },
    },
  };

  if (!matches[0]) {
    if (!APPLY) return { id: null, action: "create-required" };
    const created = await stripe.billingPortal.configurations.create(params);
    return { id: created.id, action: "created" };
  }
  if (!APPLY) return { id: matches[0].id, action: "verify-required" };
  const updated = await stripe.billingPortal.configurations.update(matches[0].id, params);
  return { id: updated.id, action: "updated" };
}

const resolvedProducts = [];
for (const entry of catalog) {
  const product = await ensureProduct(entry);
  if (APPLY && !product.id) throw new Error(`STRIPE_PRODUCT_ID_MISSING:${entry.planKey}`);
  const prices = [];
  for (const priceSpec of entry.prices) {
    prices.push(await ensurePrice(product.id, entry.planKey, priceSpec));
  }
  resolvedProducts.push({ planKey: entry.planKey, ...product, prices });
}

const portal = await ensurePortalConfiguration(resolvedProducts);
const priceIds = Object.fromEntries(
  resolvedProducts.flatMap((product) =>
    product.prices.map((price, index) => [
      `STRIPE_PRICE_${product.planKey.toUpperCase()}_${catalog.find((entry) => entry.planKey === product.planKey).prices[index].interval.toUpperCase()}`,
      price.id,
    ]),
  ),
);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      mode: MODE,
      apply: APPLY,
      products: resolvedProducts.map((product) => ({
        planKey: product.planKey,
        id: product.id,
        action: product.action,
        prices: product.prices,
      })),
      portal,
      priceIds,
    },
    null,
    2,
  )}\n`,
);
