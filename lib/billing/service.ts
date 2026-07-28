import type Stripe from "stripe";
import type { PlanKey } from "@/lib/commercial/plans";
import { prisma } from "@/lib/prisma";
import { billingAppUrl, isBillingEnabled, pastDueGraceDays, stripePriceForPlan, stripeTrialDays } from "@/lib/billing/config";
import { getStripeClient } from "@/lib/billing/stripe-client";

const ACTIVE_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

export async function createCheckout(input: { companyId: string; userEmail: string; companyName: string; planKey: PlanKey }) {
  if (!isBillingEnabled()) throw new Error("BILLING_DISABLED");
  const stripe = getStripeClient();
  const priceId = stripePriceForPlan(input.planKey);
  const active = await prisma.subscription.findFirst({
    where: { companyId: input.companyId, status: { in: [...ACTIVE_STATUSES] }, stripeSubscriptionId: { not: null } },
    select: { id: true },
  });
  if (active) throw new Error("BILLING_ACTIVE_SUBSCRIPTION_EXISTS");
  const customer = await getOrCreateCustomer(stripe, input);
  const trialDays = stripeTrialDays();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: billingAppUrl("/plan-y-uso?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: billingAppUrl("/plan-y-uso?checkout=cancelled"),
    client_reference_id: input.companyId,
    metadata: { companyId: input.companyId, planKey: input.planKey },
    subscription_data: {
      metadata: { companyId: input.companyId, planKey: input.planKey },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    allow_promotion_codes: false,
  });
}

export async function createPortal(input: { companyId: string }) {
  if (!isBillingEnabled()) throw new Error("BILLING_DISABLED");
  const customer = await prisma.billingCustomer.findUnique({ where: { companyId: input.companyId } });
  if (!customer) throw new Error("BILLING_CUSTOMER_NOT_FOUND");
  return getStripeClient().billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: billingAppUrl("/plan-y-uso"),
  });
}

export function paidAccessState(subscription: { status: string; currentPeriodEnd: Date } | null, now = new Date()) {
  if (!isBillingEnabled()) return { paidAccess: false, basicAccess: true, reason: "billing_disabled" as const };
  if (!subscription) return { paidAccess: false, basicAccess: true, reason: "no_subscription" as const };
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return { paidAccess: true, basicAccess: true, reason: "active" as const };
  }
  if (subscription.status === "PAST_DUE") {
    const graceEndsAt = new Date(subscription.currentPeriodEnd.getTime() + pastDueGraceDays() * 86_400_000);
    return { paidAccess: now < graceEndsAt, basicAccess: true, reason: now < graceEndsAt ? "past_due_grace" as const : "past_due_expired" as const, graceEndsAt };
  }
  return { paidAccess: false, basicAccess: true, reason: "inactive" as const };
}

async function getOrCreateCustomer(
  stripe: Stripe,
  input: { companyId: string; userEmail: string; companyName: string },
) {
  const existing = await prisma.billingCustomer.findUnique({ where: { companyId: input.companyId } });
  if (existing) return existing;
  const created = await stripe.customers.create({
    email: input.userEmail,
    name: input.companyName,
    metadata: { companyId: input.companyId },
  }, { idempotencyKey: `billing-customer:${input.companyId}` });
  try {
    return await prisma.billingCustomer.create({
      data: { companyId: input.companyId, stripeCustomerId: created.id },
    });
  } catch (error) {
    const concurrent = await prisma.billingCustomer.findUnique({ where: { companyId: input.companyId } });
    if (concurrent) return concurrent;
    throw error;
  }
}
