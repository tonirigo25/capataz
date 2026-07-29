import type { PlanKey } from "@/lib/commercial/plans";

export type BillingPlanKey = Exclude<PlanKey, "ENTERPRISE">;
export type BillingInterval = "month" | "year";
export type BillingEnvironment = Readonly<Record<string, string | undefined>>;

const PRICE_VARIABLES = {
  STARTER: {
    month: "STRIPE_PRICE_STARTER_MONTHLY",
    year: "STRIPE_PRICE_STARTER_ANNUAL",
    legacy: "STRIPE_PRICE_STARTER",
  },
  PROFESSIONAL: {
    month: "STRIPE_PRICE_PRO_MONTHLY",
    year: "STRIPE_PRICE_PRO_ANNUAL",
    legacy: "STRIPE_PRICE_PRO",
  },
  BUSINESS: {
    month: "STRIPE_PRICE_BUSINESS_MONTHLY",
    year: "STRIPE_PRICE_BUSINESS_ANNUAL",
    legacy: "STRIPE_PRICE_BUSINESS",
  },
} as const satisfies Record<BillingPlanKey, Record<BillingInterval, string> & { legacy: string }>;

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
]);

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.created",
  "invoice.finalized",
  "invoice.finalization_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "customer.tax_id.updated",
  "charge.dispute.created",
] as const;

export function isBillingEnabled(environment: BillingEnvironment = process.env) {
  return environment.BILLING_ENABLED === "true";
}

export function normalizeBillingPlanKey(value: string): BillingPlanKey {
  const normalized = value.trim().toUpperCase();
  if (normalized === "STARTER") return "STARTER";
  if (normalized === "PRO" || normalized === "PROFESSIONAL") return "PROFESSIONAL";
  if (normalized === "BUSINESS") return "BUSINESS";
  throw new Error("BILLING_PLAN_NOT_CHECKOUT_ELIGIBLE");
}

export function normalizeBillingInterval(value: string | undefined): BillingInterval {
  const normalized = value?.trim().toLowerCase() || "month";
  if (normalized === "month" || normalized === "monthly") return "month";
  if (normalized === "year" || normalized === "annual" || normalized === "yearly") return "year";
  throw new Error("BILLING_INTERVAL_INVALID");
}

export function stripePriceForPlan(
  planKey: PlanKey | string,
  intervalOrEnvironment: BillingInterval | BillingEnvironment = "month",
  suppliedEnvironment: BillingEnvironment = process.env,
) {
  const interval = typeof intervalOrEnvironment === "string"
    ? normalizeBillingInterval(intervalOrEnvironment)
    : "month";
  const environment = typeof intervalOrEnvironment === "string"
    ? suppliedEnvironment
    : intervalOrEnvironment;
  const normalizedPlan = normalizeBillingPlanKey(String(planKey));
  const variables = PRICE_VARIABLES[normalizedPlan];
  const canonicalVariable = variables[interval];
  const canonical = environment[canonicalVariable]?.trim();
  const legacy = interval === "month" ? environment[variables.legacy]?.trim() : undefined;
  if (canonical && legacy && canonical !== legacy) {
    throw new Error(`BILLING_PRICE_CONFIGURATION_AMBIGUOUS:${canonicalVariable}:${variables.legacy}`);
  }
  const value = canonical || legacy;
  if (!value) throw new Error(`BILLING_PRICE_NOT_CONFIGURED:${canonicalVariable}`);
  return value;
}

export function billingPlanForStripePrice(priceId: string, environment: BillingEnvironment = process.env) {
  const matches: Array<{ planKey: BillingPlanKey; interval: BillingInterval }> = [];
  for (const planKey of Object.keys(PRICE_VARIABLES) as BillingPlanKey[]) {
    for (const interval of ["month", "year"] as const) {
      try {
        if (stripePriceForPlan(planKey, interval, environment) === priceId) matches.push({ planKey, interval });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("BILLING_PRICE_NOT_CONFIGURED")) throw error;
      }
    }
  }
  if (matches.length !== 1) {
    throw new Error(matches.length ? "BILLING_PRICE_CONFIGURATION_AMBIGUOUS" : "STRIPE_PLAN_NOT_RESOLVED");
  }
  return matches[0];
}

export function billingEnvironment(environment: BillingEnvironment = process.env) {
  return (environment.NEXT_PUBLIC_APP_ENV || environment.APP_ENV || environment.NODE_ENV || "development")
    .trim()
    .toLowerCase();
}

export function billingAllowedCountries(environment: BillingEnvironment = process.env) {
  const configured = (environment.BILLING_ALLOWED_COUNTRIES || "ES")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (!configured.length || configured.some((value) => !/^[A-Z]{2}$/.test(value))) {
    throw new Error("BILLING_ALLOWED_COUNTRIES_INVALID");
  }
  return new Set(configured);
}

export function assertBillingCountryAllowed(
  countryCode: string,
  input: { livemode: boolean; environment?: BillingEnvironment },
) {
  const environment = input.environment ?? process.env;
  const normalized = countryCode.trim().toUpperCase();
  if (!EU_COUNTRIES.has(normalized)) throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  if (!input.livemode) return normalized;
  const crossBorderEnabled = environment.EU_B2B_CROSS_BORDER_ENABLED === "true";
  if (!crossBorderEnabled && normalized !== "ES") throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  if (!billingAllowedCountries(environment).has(normalized)) throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  return normalized;
}

export function billingAppUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() || "https://app.orqenatech.com";
  const url = new URL(pathname, base);
  if (process.env.NODE_ENV === "production" && !allowedBillingAppHosts().has(url.hostname.toLowerCase())) {
    throw new Error("BILLING_APP_URL_INVALID");
  }
  return url.toString();
}

export function allowedBillingAppHosts(environment: BillingEnvironment = process.env) {
  const hosts = new Set(["app.orqenatech.com"]);
  const explicit = [
    environment.BILLING_APP_ALLOWED_HOSTS,
    environment.RAILWAY_PUBLIC_DOMAIN,
  ].filter(Boolean).flatMap((value) => String(value).split(","));
  for (const raw of explicit) {
    const normalized = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (normalized && /^[a-z0-9.-]+(?::\d+)?$/.test(normalized)) {
      hosts.add(normalized.split(":")[0]);
    }
  }
  return hosts;
}

export function pastDueGraceDays(environment: BillingEnvironment = process.env) {
  const value = Number(environment.BILLING_PAST_DUE_GRACE_DAYS ?? 3);
  if (!Number.isInteger(value) || value < 0 || value > 30) throw new Error("BILLING_PAST_DUE_GRACE_DAYS_INVALID");
  return value;
}

export function stripeTrialDays(environment: BillingEnvironment = process.env) {
  const raw = environment.STRIPE_TRIAL_DAYS?.trim();
  if (!raw) return 3;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 90) throw new Error("BILLING_TRIAL_DAYS_INVALID");
  return value;
}
