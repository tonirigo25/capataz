import { Prisma, type PrismaClient, type SubscriptionStatus } from "@prisma/client";
import type { BillingProvider } from "@/lib/platform/providers/contracts";
import { executeIdempotent, hashCanonical } from "@/lib/platform/idempotency";
import { verifyStripeWebhook } from "@/lib/platform/webhooks";
import { queueEmailEvent } from "@/lib/email/outbox";
import { stripePriceForPlan } from "@/lib/billing/config";
import type { PlanKey } from "./plans";

type OwnerContext = { companyId: string; userId: string; role: string };
type StripeObject = {
  id: string;
  customer?: string;
  subscription?: string;
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
  trial_end?: number | null;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  cancellation_details?: { reason?: string | null; comment?: string | null };
  metadata?: Record<string, string>;
};
type StripeEvent = { id: string; type: string; created: number; data: { object: StripeObject } };
const CHURN_REASONS = new Set(["customer_service", "low_quality", "missing_features", "switched_service", "too_complex", "too_expensive", "unused", "other", "unknown"]);

export function sanitizeChurnComment(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SECRET]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+34[ .-]?)?[6789](?:[ .-]?\d){8}\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:[XYZ]\d{7,8}[A-Z]|\d{8}[A-Z])\b/gi, "[REDACTED_TAX_ID]")
    .replace(/\s+/g, " ").trim().slice(0, 500);
}

function requireOwner(context: OwnerContext) {
  if (context.role !== "OWNER") throw new Error("BILLING_OWNER_REQUIRED");
}

function httpsReturnUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("BILLING_RETURN_URL_MUST_BE_HTTPS");
  return url.href;
}

export async function createAuthenticatedCheckout(prisma: PrismaClient, input: {
  context: OwnerContext;
  planKey: PlanKey;
  interval: "month" | "year";
  currency: "EUR";
  returnUrl: string;
  idempotencyKey: string;
  provider: BillingProvider;
}) {
  requireOwner(input.context);
  const returnUrl = httpsReturnUrl(input.returnUrl);
  // Compatibility adapter for isolated provider-contract tests. Live Stripe
  // prices are resolved exclusively from the canonical environment catalog.
  const mapping = input.provider.mode === "live" && input.provider.name === "stripe"
    ? null
    : await prisma.billingPriceMapping.findUniqueOrThrow({
        where: { provider_planKey_interval_currency: { provider: input.provider.name, planKey: input.planKey, interval: input.interval, currency: input.currency } },
      });
  if (mapping && !mapping.active) throw new Error("BILLING_PRICE_MAPPING_INACTIVE");
  const priceId = mapping?.externalPriceId ?? stripePriceForPlan(input.planKey, input.interval);
  const customer = await prisma.billingCustomer.findUnique({ where: { companyId: input.context.companyId } });
  const result = await executeIdempotent({
    prisma,
    companyId: input.context.companyId,
    namespace: "billing.checkout",
    key: input.idempotencyKey,
    request: { planKey: input.planKey, interval: input.interval, currency: input.currency, priceSource: mapping ? "legacy-test-adapter" : "canonical-environment", returnUrl, provider: input.provider.name, customerId: customer?.externalCustomerId ?? null },
    operation: async (transaction) => {
      const receipt = await input.provider.createCheckout({ companyId: input.context.companyId, customerId: customer?.externalCustomerId, priceKey: priceId, returnUrl, idempotencyKey: input.idempotencyKey });
      const subscription = await transaction.subscription.findFirstOrThrow({ where: { companyId: input.context.companyId }, orderBy: { createdAt: "desc" } });
      await transaction.subscription.update({ where: { id: subscription.id }, data: { providerCheckoutId: receipt.reference, providerPriceId: priceId, provider: input.provider.name } });
      await transaction.auditLog.create({ data: { companyId: input.context.companyId, userActorId: input.context.userId, action: "billing.checkout.created", targetType: "Subscription", targetId: subscription.id, metadata: { planKey: input.planKey, interval: input.interval, provider: input.provider.name, checkoutReference: receipt.reference } } });
      return receipt;
    },
  });
  return result;
}

export async function createAuthenticatedCustomerPortal(prisma: PrismaClient, input: {
  context: OwnerContext;
  returnUrl: string;
  idempotencyKey: string;
  provider: BillingProvider;
}) {
  requireOwner(input.context);
  const returnUrl = httpsReturnUrl(input.returnUrl);
  const customer = await prisma.billingCustomer.findUniqueOrThrow({ where: { companyId: input.context.companyId } });
  const result = await executeIdempotent({
    prisma,
    companyId: input.context.companyId,
    namespace: "billing.portal",
    key: input.idempotencyKey,
    request: { customerId: customer.externalCustomerId, returnUrl, provider: input.provider.name },
    operation: async (transaction) => {
      const receipt = await input.provider.createPortal({ companyId: input.context.companyId, customerId: customer.externalCustomerId, returnUrl, idempotencyKey: input.idempotencyKey });
      await transaction.auditLog.create({ data: { companyId: input.context.companyId, userActorId: input.context.userId, action: "billing.portal.created", targetType: "BillingCustomer", targetId: customer.id, metadata: { provider: input.provider.name, portalReference: receipt.reference } } });
      return receipt;
    },
  });
  return result;
}

const stripeStatuses: Record<string, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  paused: "PAUSED",
  canceled: "CANCELED",
  incomplete_expired: "EXPIRED",
  unpaid: "PAST_DUE",
};

function dateFromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1_000) : undefined;
}

function sanitizedEvent(event: StripeEvent) {
  const object = event.data.object;
  return {
    eventId: event.id,
    eventType: event.type,
    created: event.created,
    objectId: object.id,
    customerId: object.customer ?? null,
    subscriptionId: object.subscription ?? (event.type.startsWith("customer.subscription.") ? object.id : null),
    status: object.status ?? null,
    currentPeriodStart: object.current_period_start ?? null,
    currentPeriodEnd: object.current_period_end ?? null,
    trialEnd: object.trial_end ?? null,
    cancelAtPeriodEnd: object.cancel_at_period_end ?? false,
    canceledAt: object.canceled_at ?? null,
    cancellationReason: CHURN_REASONS.has(object.cancellation_details?.reason ?? "") ? object.cancellation_details?.reason ?? null : "other",
    cancellationComment: sanitizeChurnComment(object.cancellation_details?.comment),
    companyId: object.metadata?.companyId ?? null,
  };
}

export async function ingestStripeBillingWebhook(prisma: PrismaClient, input: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  now?: number;
  graceDays?: number;
}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("LEGACY_STRIPE_WEBHOOK_RETIRED_USE_CANONICAL_ENDPOINT");
  }
  verifyStripeWebhook({ rawBody: input.rawBody, signatureHeader: input.signatureHeader, secret: input.webhookSecret }, input.now);
  const event = JSON.parse(input.rawBody) as StripeEvent;
  if (!event.id || !event.type || !event.data?.object?.id || !Number.isInteger(event.created)) throw new Error("STRIPE_EVENT_INVALID");
  const sanitized = sanitizedEvent(event);
  const customer = sanitized.customerId ? await prisma.billingCustomer.findUnique({ where: { provider_externalCustomerId: { provider: "stripe", externalCustomerId: sanitized.customerId } } }) : null;
  const companyId = sanitized.companyId ?? customer?.companyId;
  if (!companyId) throw new Error("STRIPE_EVENT_COMPANY_UNRESOLVED");
  if (customer && sanitized.companyId && customer.companyId !== sanitized.companyId) throw new Error("STRIPE_EVENT_CROSS_TENANT");
  const subscription = await prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { company: true } });
  if (!subscription) throw new Error("STRIPE_SUBSCRIPTION_NOT_CONFIGURED");

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing:${companyId}`}, 0))`;
    const duplicate = await transaction.billingEvent.findUnique({ where: { provider_externalEventId: { provider: "stripe", externalEventId: event.id } } });
    if (duplicate) return { billingEvent: duplicate, replayed: true };
    const occurredAt = new Date(event.created * 1_000);
    const billingEvent = await transaction.billingEvent.create({ data: { companyId, subscriptionId: subscription.id, provider: "stripe", externalEventId: event.id, eventType: event.type, payload: sanitized, payloadHash: hashCanonical(sanitized), occurredAt, signatureVerified: true, status: "PROCESSING", attempts: 1 } });
    if (subscription.lastProviderEventAt && occurredAt < subscription.lastProviderEventAt) {
      const stale = await transaction.billingEvent.update({ where: { id: billingEvent.id }, data: { status: "IGNORED_STALE", processedAt: new Date() } });
      return { billingEvent: stale, replayed: false };
    }
    const update: Prisma.SubscriptionUpdateInput = { lastProviderEventAt: occurredAt };
    let nextStatus: SubscriptionStatus | undefined;
    const subscriptionLifecycleEvent = event.type.startsWith("customer.subscription.");
    if (subscriptionLifecycleEvent) nextStatus = stripeStatuses[sanitized.status ?? ""];
    if (event.type === "invoice.payment_failed") {
      nextStatus = "PAST_DUE";
      update.graceEndsAt = new Date(occurredAt.getTime() + (input.graceDays ?? 7) * 86_400_000);
      update.readOnlyAt = update.graceEndsAt;
      await queueEmailEvent(transaction as never, { companyId, eventKey: "billing_payment_failed", recipient: subscription.company.email ?? "billing-contact-missing@example.invalid", payload: { subscriptionId: subscription.id, billingEventId: billingEvent.id }, idempotencyKey: `billing-payment-failed:${event.id}` });
      await transaction.task.create({ data: { companyId, title: "Revisar pago de la suscripción", description: "El proveedor ha informado de un pago fallido. Revisar sin efectuar cargos manuales.", category: "billing", priority: "high", origin: `billing:${event.id}`, dueAt: update.graceEndsAt as Date } });
    }
    if (event.type === "invoice.paid") {
      nextStatus = "ACTIVE";
      update.graceEndsAt = null;
      update.readOnlyAt = null;
    }
    if (nextStatus) update.status = nextStatus;
    if (subscriptionLifecycleEvent) {
      if (sanitized.subscriptionId) update.externalSubscriptionId = sanitized.subscriptionId;
      if (sanitized.currentPeriodStart) update.currentPeriodStart = dateFromUnix(sanitized.currentPeriodStart);
      if (sanitized.currentPeriodEnd) update.currentPeriodEnd = dateFromUnix(sanitized.currentPeriodEnd);
      update.trialEndsAt = dateFromUnix(sanitized.trialEnd) ?? null;
      update.cancelAtPeriodEnd = sanitized.cancelAtPeriodEnd;
      update.canceledAt = dateFromUnix(sanitized.canceledAt) ?? null;
      if (sanitized.cancellationReason) update.cancellationReason = sanitized.cancellationReason;
      if (sanitized.cancellationComment) update.cancellationComment = sanitized.cancellationComment;
    }
    const updated = await transaction.subscription.update({ where: { id: subscription.id }, data: update });
    await transaction.subscriptionHistory.create({ data: { subscriptionId: subscription.id, action: event.type, fromStatus: subscription.status, toStatus: updated.status, reason: sanitized.cancellationReason ?? undefined } });
    const processed = await transaction.billingEvent.update({ where: { id: billingEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });
    return { billingEvent: processed, replayed: false };
  });
}

export async function reconcileBillingSubscription(prisma: PrismaClient, input: {
  companyId: string;
  provider: string;
  providerSnapshot: { status: SubscriptionStatus; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; planKey: string; mrrEur?: number };
}) {
  const local = await prisma.subscription.findFirstOrThrow({ where: { companyId: input.companyId }, orderBy: { createdAt: "desc" }, include: { plan: true } });
  const localSnapshot = { status: local.status, currentPeriodStart: local.currentPeriodStart.toISOString(), currentPeriodEnd: local.currentPeriodEnd.toISOString(), cancelAtPeriodEnd: local.cancelAtPeriodEnd, planKey: local.plan.key };
  if (input.providerSnapshot.mrrEur !== undefined && (!Number.isFinite(input.providerSnapshot.mrrEur) || input.providerSnapshot.mrrEur < 0)) throw new Error("BILLING_MRR_INVALID");
  const providerState = {
    status: input.providerSnapshot.status,
    currentPeriodStart: input.providerSnapshot.currentPeriodStart,
    currentPeriodEnd: input.providerSnapshot.currentPeriodEnd,
    cancelAtPeriodEnd: input.providerSnapshot.cancelAtPeriodEnd,
    planKey: input.providerSnapshot.planKey,
  };
  const divergences = Object.entries(providerState).flatMap(([field, providerValue]) => localSnapshot[field as keyof typeof localSnapshot] === providerValue ? [] : [{ field, local: String(localSnapshot[field as keyof typeof localSnapshot]), provider: String(providerValue) }]);
  return prisma.billingReconciliationRun.create({ data: { companyId: input.companyId, provider: input.provider, status: divergences.length ? "DIVERGED" : "MATCHED", localSnapshot, providerSnapshot: input.providerSnapshot, divergences, divergenceCount: divergences.length, correctionMode: "AUDIT_ONLY", completedAt: new Date() } });
}

export async function cancellationMetrics(prisma: PrismaClient, companyId: string) {
  const rows = await prisma.subscription.findMany({ where: { companyId, cancellationReason: { not: null } }, select: { cancellationReason: true, canceledAt: true, plan: { select: { key: true } } } });
  return rows.map((row) => ({ planKey: row.plan.key, reason: row.cancellationReason!, cohort: row.canceledAt?.toISOString().slice(0, 7) ?? "scheduled" }));
}
