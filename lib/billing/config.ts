import type { PlanKey } from "@/lib/commercial/plans";

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export function isBillingEnabled(environment = process.env) {
  return environment.BILLING_ENABLED === "true";
}

export function stripePriceForPlan(planKey: PlanKey, environment = process.env) {
  const variable = {
    STARTER: "STRIPE_PRICE_STARTER",
    PROFESSIONAL: "STRIPE_PRICE_PRO",
    BUSINESS: "STRIPE_PRICE_BUSINESS",
    ENTERPRISE: "",
  }[planKey];
  if (!variable) throw new Error("BILLING_PLAN_NOT_CHECKOUT_ELIGIBLE");
  const value = environment[variable]?.trim();
  if (!value) throw new Error(`BILLING_PRICE_NOT_CONFIGURED:${variable}`);
  return value;
}

export function billingAppUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() || "https://app.orqenatech.com";
  const url = new URL(pathname, base);
  if (process.env.NODE_ENV === "production" && url.hostname !== "app.orqenatech.com") {
    throw new Error("BILLING_APP_URL_INVALID");
  }
  return url.toString();
}

export function pastDueGraceDays(environment = process.env) {
  const value = Number(environment.BILLING_PAST_DUE_GRACE_DAYS ?? 7);
  return Number.isInteger(value) && value >= 0 && value <= 30 ? value : 7;
}

export function stripeTrialDays(environment = process.env) {
  const raw = environment.STRIPE_TRIAL_DAYS?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 90) throw new Error("BILLING_TRIAL_DAYS_INVALID");
  return value;
}
