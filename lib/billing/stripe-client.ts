import Stripe from "stripe";
import { billingEnvironment, type BillingEnvironment } from "@/lib/billing/config";

let stripeClient: Stripe | undefined;

export function getStripeClient(environment: BillingEnvironment = process.env) {
  if (environment === process.env && stripeClient) return stripeClient;
  const secret = environment.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED:STRIPE_SECRET_KEY");
  const livemode = stripeKeyIsLive(secret);
  if (livemode && billingEnvironment(environment) !== "production") {
    throw new Error("STRIPE_LIVE_KEY_OUTSIDE_PRODUCTION_FORBIDDEN");
  }
  const client = new Stripe(secret, { maxNetworkRetries: 2, timeout: 20_000 });
  if (environment === process.env) stripeClient = client;
  return client;
}

export function stripeKeyIsLive(secret = process.env.STRIPE_SECRET_KEY?.trim() ?? "") {
  if (/^(?:sk|rk)_live_/.test(secret)) return true;
  if (/^(?:sk|rk)_test_/.test(secret)) return false;
  throw new Error("STRIPE_KEY_MODE_INVALID");
}

export function requireStripeWebhookSecret(environment: BillingEnvironment = process.env) {
  const value = environment.STRIPE_WEBHOOK_SECRET?.trim();
  if (!value) throw new Error("STRIPE_NOT_CONFIGURED:STRIPE_WEBHOOK_SECRET");
  return value;
}
