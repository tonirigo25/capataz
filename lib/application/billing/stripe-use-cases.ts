import Stripe from "stripe";
import { navigateAction } from "@/lib/application/action-effects";
import { requireCapability } from "@/lib/commercial/authorization";
import { planCatalog, type PlanKey } from "@/lib/commercial/plans";
import { createAuthenticatedCheckout, createAuthenticatedCustomerPortal } from "@/lib/commercial/subscription-service";
import { StripeBillingProvider } from "@/lib/platform/providers/production";
import { prisma } from "@/lib/prisma";

function provider() {
  if (process.env.BILLING_ENABLED !== "true" || !process.env.STRIPE_SECRET_KEY) throw new Error("BILLING_PROVIDER_NOT_ENABLED");
  return new StripeBillingProvider(new Stripe(process.env.STRIPE_SECRET_KEY));
}

function returnUrl() {
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error("APP_BASE_URL_NOT_CONFIGURED");
  return new URL("/plan-y-uso", base).href;
}

export async function startStripeCheckout(formData: FormData) {
  const auth = await requireCapability("company.billing.manage");
  const planKey = String(formData.get("planKey") ?? "") as PlanKey;
  const interval = String(formData.get("interval") ?? "") as "month" | "year";
  if (auth.role !== "OWNER" || !(planKey in planCatalog) || !["month", "year"].includes(interval) || formData.get("confirm") !== "CONTINUAR_STRIPE") throw new Error("BILLING_CHECKOUT_INPUT_INVALID");
  const result = await createAuthenticatedCheckout(prisma, { context: auth, planKey, interval, currency: "EUR", returnUrl: returnUrl(), idempotencyKey: String(formData.get("idempotencyKey") ?? ""), provider: provider() });
  const url = result.value.url;
  if (!url || new URL(url).protocol !== "https:") throw new Error("BILLING_CHECKOUT_URL_INVALID");
  navigateAction(url);
}

export async function openStripeCustomerPortal(formData: FormData) {
  const auth = await requireCapability("company.billing.manage");
  if (auth.role !== "OWNER" || formData.get("confirm") !== "ABRIR_PORTAL") throw new Error("BILLING_PORTAL_INPUT_INVALID");
  const result = await createAuthenticatedCustomerPortal(prisma, { context: auth, returnUrl: returnUrl(), idempotencyKey: String(formData.get("idempotencyKey") ?? ""), provider: provider() });
  const url = result.value.url;
  if (!url || new URL(url).protocol !== "https:") throw new Error("BILLING_PORTAL_URL_INVALID");
  navigateAction(url);
}
