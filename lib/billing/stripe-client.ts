import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripeClient(environment = process.env) {
  if (environment === process.env && stripeClient) return stripeClient;
  const secret = environment.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED:STRIPE_SECRET_KEY");
  if (secret.startsWith("sk_live_")) throw new Error("STRIPE_LIVE_KEY_FORBIDDEN");
  const client = new Stripe(secret, { maxNetworkRetries: 2, timeout: 20_000 });
  if (environment === process.env) stripeClient = client;
  return client;
}

export function requireStripeWebhookSecret(environment = process.env) {
  const value = environment.STRIPE_WEBHOOK_SECRET?.trim();
  if (!value) throw new Error("STRIPE_NOT_CONFIGURED:STRIPE_WEBHOOK_SECRET");
  return value;
}
