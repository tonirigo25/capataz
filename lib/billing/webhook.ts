import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { planCatalog, type PlanKey } from "@/lib/commercial/plans";

export async function processStripeEvent(event: Stripe.Event) {
  const existing = await prisma.billingEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing && isTerminalBillingEventResult(existing.processingResult)) {
    return { duplicate: true, result: existing.processingResult };
  }
  const record = existing
    ? await prisma.billingEvent.update({ where: { id: existing.id }, data: { processingResult: "PROCESSING" } })
    : await prisma.billingEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        eventCreatedAt: new Date(event.created * 1_000),
        processingResult: "PROCESSING",
      },
    });

  try {
    const result = await applyEvent(event, record.eventCreatedAt);
    await prisma.billingEvent.update({
      where: { id: record.id },
      data: { companyId: result.companyId, processedAt: new Date(), processingResult: result.result },
    });
    return { duplicate: false, result: result.result };
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0].slice(0, 120) : "STRIPE_EVENT_FAILED";
    await prisma.billingEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), processingResult: `FAILED:${code}` } });
    throw error;
  }
}

async function applyEvent(event: Stripe.Event, eventCreatedAt: Date) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const companyId = session.metadata?.companyId || session.client_reference_id || await companyIdForCustomer(idOf(session.customer));
    return { companyId, result: "RECORDED_NO_ACCESS_CHANGE" };
  }
  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object as Stripe.Subscription;
    return { companyId: await companyIdForSubscription(subscription), result: "RECORDED_NO_ACCESS_CHANGE" };
  }
  if (event.type.startsWith("customer.subscription.")) {
    return synchronizeSubscription(event.data.object as Stripe.Subscription, eventCreatedAt, event.type);
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return { companyId: await companyIdForCustomer(idOf(invoice.customer)), result: "RECORDED_NO_ACCESS_CHANGE" };
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    return synchronizeSubscription(subscription, eventCreatedAt, event.type);
  }
  return { companyId: null, result: "RECORDED_NO_ACCESS_CHANGE" };
}

async function synchronizeSubscription(subscription: Stripe.Subscription, eventCreatedAt: Date, eventType: string) {
  const companyId = await companyIdForSubscription(subscription);
  if (!companyId) throw new Error("STRIPE_COMPANY_NOT_RESOLVED");
  const current = await prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
  if (shouldIgnoreStripeEvent(current?.metadata, Math.floor(eventCreatedAt.getTime() / 1_000))) {
    return { companyId, result: "IGNORED_OUT_OF_ORDER" };
  }

  const planKey = planKeyForSubscription(subscription);
  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan) throw new Error("STRIPE_PLAN_NOT_PROVISIONED");
  const status = mapStripeSubscriptionStatus(subscription.status, eventType);
  const period = subscriptionPeriod(subscription);
  const data = {
    planId: plan.id,
    provider: "stripe",
    status,
    externalCustomerId: idOf(subscription.customer),
    externalSubscriptionId: subscription.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price?.id ?? null,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1_000) : null,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1_000) : null,
    metadata: { stripeLastEventCreated: Math.floor(eventCreatedAt.getTime() / 1_000), stripeEventType: eventType },
  };
  if (current) {
    await prisma.subscription.update({ where: { id: current.id }, data });
  } else {
    await prisma.subscription.create({ data: { companyId, startedAt: new Date(subscription.created * 1_000), ...data } });
  }
  return { companyId, result: "PROCESSED" };
}

async function companyIdForSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.companyId || companyIdForCustomer(idOf(subscription.customer));
}

async function companyIdForCustomer(customerId: string | null) {
  if (!customerId) return null;
  return (await prisma.billingCustomer.findUnique({ where: { stripeCustomerId: customerId }, select: { companyId: true } }))?.companyId ?? null;
}

function planKeyForSubscription(subscription: Stripe.Subscription): PlanKey {
  const metadataKey = subscription.metadata?.planKey as PlanKey | undefined;
  if (metadataKey && metadataKey in planCatalog) return metadataKey;
  const priceId = subscription.items.data[0]?.price?.id;
  const match = ([
    ["STARTER", process.env.STRIPE_PRICE_STARTER],
    ["PROFESSIONAL", process.env.STRIPE_PRICE_PRO],
    ["BUSINESS", process.env.STRIPE_PRICE_BUSINESS],
  ] as const).find(([, configured]) => configured && configured === priceId);
  if (!match) throw new Error("STRIPE_PLAN_NOT_RESOLVED");
  return match[0];
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status, eventType: string): SubscriptionStatus {
  if (eventType === "invoice.payment_failed") return "PAST_DUE";
  if (eventType === "customer.subscription.deleted") return "CANCELED";
  if (eventType === "customer.subscription.paused") return "PAUSED";
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  if (status === "paused") return "PAUSED";
  if (status === "canceled") return "CANCELED";
  return "EXPIRED";
}

export function isTerminalBillingEventResult(value: string) {
  return ["PROCESSED", "IGNORED_OUT_OF_ORDER", "RECORDED_NO_ACCESS_CHANGE"].includes(value);
}

export function shouldIgnoreStripeEvent(metadata: unknown, incomingCreated: number) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const previous = Number((metadata as Record<string, unknown>).stripeLastEventCreated);
  return Number.isFinite(previous) && previous > incomingCreated;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number };
  const legacy = subscription as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
  const start = item?.current_period_start ?? legacy.current_period_start ?? subscription.created;
  const end = item?.current_period_end ?? legacy.current_period_end ?? start + 30 * 86_400;
  return { start: new Date(start * 1_000), end: new Date(end * 1_000) };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const value = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null; parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } } };
  return idOf(value.subscription ?? value.parent?.subscription_details?.subscription);
}

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}
