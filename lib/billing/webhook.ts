import type Stripe from "stripe";
import { Prisma, type SubscriptionStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  billingEnvironment,
  billingPlanForStripePrice,
  isBillingEnabled,
  normalizeBillingInterval,
  normalizeBillingPlanKey,
  pastDueGraceDays,
  stripePriceForPlan,
} from "@/lib/billing/config";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { validateLiveCheckoutCustomerDetails } from "@/lib/billing/guards";

const NON_TERMINAL_LOCAL_STATUSES = new Set<SubscriptionStatus>(["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"]);
const RECLAIM_AFTER_MS = 5 * 60_000;

export async function enqueueStripeEvent(
  event: Stripe.Event,
  options: { effectsEnabled?: boolean } = {},
) {
  const effectsEnabled = options.effectsEnabled ?? true;
  const existing = await prisma.billingEvent.findUnique({
    where: { provider_externalEventId: { provider: "stripe", externalEventId: event.id } },
  });
  if (existing) {
    return { duplicate: true, result: existing.status, billingEventId: existing.id };
  }
  const companyId = await companyIdForEvent(event);
  if (!companyId) throw new Error("STRIPE_COMPANY_NOT_RESOLVED");
  const projection = eventProjection(event);
  try {
    const record = await prisma.billingEvent.create({
      data: {
        companyId,
        provider: "stripe",
        externalEventId: event.id,
        eventType: event.type,
        payload: projection,
        payloadHash: createHash("sha256").update(JSON.stringify(projection)).digest("hex"),
        occurredAt: new Date(event.created * 1_000),
        status: effectsEnabled ? "RECEIVED" : "VERIFIED_BILLING_DISABLED",
        signatureVerified: true,
        attempts: 0,
        processedAt: effectsEnabled ? null : new Date(),
      },
    });
    return { duplicate: false, result: record.status, billingEventId: record.id };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrent = await prisma.billingEvent.findUniqueOrThrow({
      where: { provider_externalEventId: { provider: "stripe", externalEventId: event.id } },
    });
    return { duplicate: true, result: concurrent.status, billingEventId: concurrent.id };
  }
}

export async function processStripeEvent(
  event: Stripe.Event,
  options: { effectsEnabled?: boolean } = {},
) {
  return enqueueStripeEvent(event, options);
}

export async function processPendingStripeEvents(input: {
  batchSize?: number;
  now?: Date;
} = {}) {
  const now = input.now ?? new Date();
  const batchSize = Math.max(1, Math.min(input.batchSize ?? 50, 200));
  if (!isBillingEnabled()) {
    const disabled = await prisma.billingEvent.updateMany({
      where: { provider: "stripe", status: { in: ["RECEIVED", "RETRY"] } },
      data: { status: "VERIFIED_BILLING_DISABLED", processedAt: now, lastError: null },
    });
    return { examined: disabled.count, processed: disabled.count, failed: 0, skipped: "billing_disabled" as const };
  }
  const staleProcessing = new Date(now.getTime() - RECLAIM_AFTER_MS);
  const candidates = await prisma.billingEvent.findMany({
    where: {
      provider: "stripe",
      OR: [
        { status: { in: ["RECEIVED", "RETRY"] } },
        { status: "PROCESSING", updatedAt: { lte: staleProcessing } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true, externalEventId: true },
  });
  let processed = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const event = await getStripeClient().events.retrieve(candidate.externalEventId);
      const result = await processBillingEvent(candidate.id, event);
      if (isTerminalBillingEventResult(result)) processed += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { examined: candidates.length, processed, failed, skipped: null };
}

async function processBillingEvent(recordId: string, event: Stripe.Event) {
  const claim = await claimBillingEvent(recordId, event);
  if (claim.kind === "terminal") return claim.status;
  if (claim.kind === "busy") return "PROCESSING";
  try {
    const eventCompanyId = await companyIdForEvent(event);
    if (!eventCompanyId || eventCompanyId !== claim.record.companyId) {
      throw new Error("STRIPE_EVENT_CROSS_TENANT");
    }
    const result = await applyEvent(event, claim.record.occurredAt ?? new Date(event.created * 1_000));
    await prisma.billingEvent.update({
      where: { id: claim.record.id },
      data: {
        companyId: result.companyId ?? claim.record.companyId,
        processedAt: new Date(),
        status: result.result,
        lastError: null,
      },
    });
    return result.result;
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0].slice(0, 120) : "STRIPE_EVENT_FAILED";
    await prisma.billingEvent.update({
      where: { id: claim.record.id },
      data: { processedAt: null, status: "RETRY", lastError: code },
    });
    throw error;
  }
}

async function claimBillingEvent(recordId: string, event: Stripe.Event) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-event:${recordId}`}, 0))`;
    const record = await transaction.billingEvent.findUniqueOrThrow({ where: { id: recordId } });
    if (record.externalEventId !== event.id || record.eventType !== event.type) {
      throw new Error("STRIPE_EVENT_CLAIM_MISMATCH");
    }
    if (isTerminalBillingEventResult(record.status)) {
      return { kind: "terminal" as const, status: record.status };
    }
    if (record.status === "PROCESSING" && record.updatedAt > new Date(Date.now() - RECLAIM_AFTER_MS)) {
      return { kind: "busy" as const };
    }
    const claimed = await transaction.billingEvent.update({
      where: { id: record.id },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
    });
    return { kind: "claimed" as const, record: claimed };
  }, { isolationLevel: "Serializable" });
}

async function applyEvent(event: Stripe.Event, eventCreatedAt: Date) {
  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    const companyId = await resolveCompany(
      session.metadata?.companyId || session.client_reference_id,
      await companyIdForCustomer(idOf(session.customer), session.metadata?.companyId),
    );
    if (!companyId) throw new Error("STRIPE_COMPANY_NOT_RESOLVED");
    if (event.type === "checkout.session.completed" && event.livemode) {
      try {
        validateLiveCheckoutCustomerDetails(session.customer_details);
        await assertLiveCustomerReadyById(idOf(session.customer), companyId);
      } catch (error) {
        const reasonCode = error instanceof Error
          ? error.message.split(":")[0].slice(0, 120)
          : "BILLING_LIVE_CHECKOUT_REJECTED";
        await rejectLiveCheckout(session, companyId, reasonCode, eventCreatedAt);
        return { companyId, result: "PROCESSED" };
      }
    }
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await clearCheckoutSessionReservation(session.id, companyId, eventCreatedAt);
    }
    return { companyId, result: "RECORDED_NO_ACCESS_CHANGE" };
  }
  if (event.type === "customer.tax_id.updated") {
    return persistTaxIdVerification(event.data.object as Stripe.TaxId, eventCreatedAt);
  }
  if (event.type === "customer.subscription.trial_will_end") {
    const object = event.data.object as Stripe.Subscription;
    return {
      companyId: await companyIdForSubscription(object),
      result: "RECORDED_NO_ACCESS_CHANGE",
    };
  }
  if (event.type.startsWith("customer.subscription.")) {
    const object = event.data.object as Stripe.Subscription;
    const current = event.type === "customer.subscription.deleted"
      ? object
      : await getStripeClient().subscriptions.retrieve(object.id);
    return synchronizeSubscription(current, eventCreatedAt, event.type, event.livemode);
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return {
        companyId: await companyIdForCustomer(idOf(invoice.customer), invoiceCompanyId(invoice)),
        result: "RECORDED_NO_ACCESS_CHANGE",
      };
    }
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    return synchronizeSubscription(subscription, eventCreatedAt, event.type, event.livemode);
  }
  return { companyId: await companyIdForEvent(event), result: "RECORDED_NO_ACCESS_CHANGE" };
}

async function synchronizeSubscription(
  subscription: Stripe.Subscription,
  eventCreatedAt: Date,
  eventType: string,
  eventLivemode: boolean,
) {
  const companyId = await companyIdForSubscription(subscription);
  if (!companyId) throw new Error("STRIPE_COMPANY_NOT_RESOLVED");
  assertStripeEnvironment(subscription, eventLivemode);
  if (eventLivemode && subscription.status !== "canceled") {
    await assertLiveCustomerReady(subscription, companyId);
  }
  const resolvedPlan = planForSubscription(subscription);
  const period = subscriptionPeriod(subscription);

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${companyId}`}, 0))`;
    const exact = await transaction.subscription.findFirst({
      where: {
        companyId,
        OR: [
          { stripeSubscriptionId: subscription.id },
          { externalSubscriptionId: subscription.id },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    const current = exact ?? await transaction.subscription.findFirst({
      where: {
        companyId,
        stripeSubscriptionId: null,
        externalSubscriptionId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!current) throw new Error("STRIPE_SUBSCRIPTION_NOT_CONFIGURED");
    const conflicting = await transaction.subscription.findFirst({
      where: {
        companyId,
        status: { in: [...NON_TERMINAL_LOCAL_STATUSES] },
        id: { not: current.id },
        OR: [
          { stripeSubscriptionId: { not: null } },
          { externalSubscriptionId: { not: null } },
        ],
      },
      select: { id: true },
    });
    if (conflicting) throw new Error("BILLING_ACTIVE_SUBSCRIPTION_EXISTS");
    if (shouldIgnoreStripeEvent(current.metadata, Math.floor(eventCreatedAt.getTime() / 1_000))) {
      return { companyId, result: "IGNORED_OUT_OF_ORDER" };
    }

    const plan = await transaction.plan.findUnique({ where: { key: resolvedPlan.planKey } });
    if (!plan) throw new Error("STRIPE_PLAN_NOT_PROVISIONED");
    const validTrial = subscription.status === "trialing"
      && Boolean(subscription.trial_end && subscription.trial_end * 1_000 > eventCreatedAt.getTime());
    const paymentSettled = eventType === "invoice.paid";
    const planMayChange = paymentSettled || validTrial;
    const mappedStatus = mapStripeSubscriptionStatus(subscription.status, eventType);
    let nextStatus: SubscriptionStatus;
    if (paymentSettled) nextStatus = validTrial ? "TRIALING" : "ACTIVE";
    else if (eventType === "invoice.payment_failed") nextStatus = "PAST_DUE";
    else if (validTrial) nextStatus = "TRIALING";
    else if (["CANCELED", "PAUSED", "EXPIRED"].includes(mappedStatus)) nextStatus = mappedStatus;
    else if (mappedStatus === "PAST_DUE" || current.status === "PAST_DUE") nextStatus = "PAST_DUE";
    else nextStatus = current.status === "ACTIVE" ? "ACTIVE" : "EXPIRED";

    const previousMetadata = jsonObject(current.metadata);
    const checkoutRejected = typeof previousMetadata.checkoutRejectedReason === "string";
    const data: Prisma.SubscriptionUpdateInput = {
      provider: "stripe",
      status: nextStatus,
      externalCustomerId: idOf(subscription.customer),
      externalSubscriptionId: subscription.id,
      stripeSubscriptionId: subscription.id,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1_000) : null,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1_000) : null,
      lastProviderEventAt: eventCreatedAt,
      metadata: {
        ...previousMetadata,
        stripeLastEventCreated: Math.floor(eventCreatedAt.getTime() / 1_000),
        stripeEventType: eventType,
        providerPlanPending: planMayChange ? null : metadataPlanKey(resolvedPlan.planKey),
        providerIntervalPending: planMayChange ? null : resolvedPlan.interval,
        environment: billingEnvironment(),
      },
    };
    if (eventType === "invoice.paid" && !validTrial) data.status = "ACTIVE";
    if (planMayChange) {
      data.plan = { connect: { id: plan.id } };
      data.providerPriceId = resolvedPlan.priceId;
      data.stripePriceId = resolvedPlan.priceId;
      data.scheduledPlanKey = null;
    }
    if (eventType === "invoice.payment_failed") {
      if (current.status !== "PAST_DUE" || !current.graceEndsAt) {
        const graceEndsAt = new Date(eventCreatedAt.getTime() + pastDueGraceDays() * 86_400_000);
        data.graceEndsAt = graceEndsAt;
        data.readOnlyAt = graceEndsAt;
      }
    } else if (paymentSettled || validTrial) {
      data.graceEndsAt = null;
      data.readOnlyAt = null;
    }
    if (checkoutRejected) {
      data.status = "CANCELED";
      data.currentPeriodEnd = eventCreatedAt;
      data.readOnlyAt = eventCreatedAt;
      data.graceEndsAt = null;
    }
    const updated = await transaction.subscription.update({ where: { id: current.id }, data });
    await transaction.subscriptionHistory.create({
      data: {
        subscriptionId: current.id,
        action: eventType,
        fromStatus: current.status,
        toStatus: updated.status,
        fromPlanKey: undefined,
        toPlanKey: planMayChange ? resolvedPlan.planKey : undefined,
        reason: planMayChange ? undefined : "awaiting_invoice_paid",
      },
    });
    return { companyId, result: "PROCESSED" };
  }, { isolationLevel: "Serializable" });
}

async function persistTaxIdVerification(taxId: Stripe.TaxId, eventCreatedAt: Date) {
  const customerId = idOf(taxId.customer);
  const companyId = await canonicalCompanyIdForCustomer(customerId);
  if (!companyId || !customerId) throw new Error("STRIPE_COMPANY_NOT_RESOLVED");
  const verificationStatus = taxId.verification?.status ?? "unavailable";
  const reviewRequired = verificationStatus !== "verified";
  await prisma.$transaction(async (transaction) => {
    await transaction.billingCustomer.updateMany({
      where: { provider: "stripe", externalCustomerId: customerId },
      data: { taxId: taxId.value },
    });
    const links = await transaction.billingCustomerCompanyLink.findMany({
      where: { provider: "stripe", externalCustomerId: customerId },
      select: { companyId: true },
    });
    const companyIds = [...new Set([companyId, ...links.map((link) => link.companyId)])];
    const subscriptions = await transaction.subscription.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["companyId"],
    });
    for (const subscription of subscriptions) {
      await transaction.subscription.update({
        where: { id: subscription.id },
        data: {
          metadata: {
            ...jsonObject(subscription.metadata),
            taxIdType: taxId.type,
            taxIdVerificationStatus: verificationStatus,
            taxIdReviewRequired: reviewRequired,
            taxIdUpdatedAt: eventCreatedAt.toISOString(),
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          companyId: subscription.companyId,
          action: "billing.tax_id.verification_updated",
          targetType: "Subscription",
          targetId: subscription.id,
          metadata: { verificationStatus, reviewRequired, taxIdType: taxId.type },
        },
      });
    }
  });
  return { companyId, result: "PROCESSED" };
}

async function assertLiveCustomerReady(subscription: Stripe.Subscription, companyId: string) {
  return assertLiveCustomerReadyById(idOf(subscription.customer), companyId);
}

async function assertLiveCustomerReadyById(customerId: string | null, companyId: string) {
  if (!customerId) throw new Error("STRIPE_CUSTOMER_UNRESOLVED");
  const resolvedCompany = await companyIdForCustomer(customerId, companyId);
  if (resolvedCompany !== companyId) throw new Error("STRIPE_EVENT_CROSS_TENANT");
  const customer = await getStripeClient().customers.retrieve(customerId);
  if (customer.deleted) throw new Error("STRIPE_CUSTOMER_DELETED");
  const address = customer.address;
  if (!customer.name || !customer.email || !address?.line1 || !address.city || !address.postal_code) {
    throw new Error("BILLING_B2B_PROFILE_INCOMPLETE");
  }
  if (address.country !== "ES") throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  if (/^(?:35|38|51|52)/.test(address.postal_code.replace(/\s/g, ""))) {
    throw new Error("BILLING_TAX_TERRITORY_NOT_ALLOWED");
  }
  const taxIds = await getStripeClient().customers.listTaxIds(customerId, { limit: 100 });
  const hasSpanishNif = taxIds.data.some((taxId) => (
    taxId.type === "es_cif" && Boolean(taxId.value?.trim())
  ));
  const hasVerifiedEuVat = taxIds.data.some((taxId) => (
    taxId.type === "eu_vat" && taxId.verification?.status === "verified"
  ));
  // Stripe accepts Spanish NIF/CIF values but does not validate that tax-ID
  // type against a government database. VIES verification remains mandatory
  // for EU VAT IDs; the cross-border gate is still disabled separately.
  if (!hasSpanishNif && !hasVerifiedEuVat) {
    throw new Error("BILLING_TAX_ID_NOT_VERIFIED");
  }
}

async function rejectLiveCheckout(
  receivedSession: Stripe.Checkout.Session,
  companyId: string,
  reasonCode: string,
  eventCreatedAt: Date,
) {
  const stripe = getStripeClient();
  let session = receivedSession;
  let subscriptionId = idOf(session.subscription);
  if (!subscriptionId) {
    session = await stripe.checkout.sessions.retrieve(receivedSession.id, {
      expand: ["subscription"],
    });
    subscriptionId = idOf(session.subscription);
  }
  if (subscriptionId) {
    await stripe.subscriptions.cancel(subscriptionId, {
      invoice_now: false,
      prorate: false,
    });
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${companyId}`}, 0))`;
    const current = await transaction.subscription.findFirst({
      where: {
        companyId,
        OR: [
          { providerCheckoutId: receivedSession.id },
          ...(subscriptionId
            ? [
                { stripeSubscriptionId: subscriptionId },
                { externalSubscriptionId: subscriptionId },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (!current) throw new Error("STRIPE_SUBSCRIPTION_NOT_CONFIGURED");
    const metadata = { ...jsonObject(current.metadata) };
    delete metadata.billingCheckoutReservation;
    const updated = await transaction.subscription.update({
      where: { id: current.id },
      data: {
        status: "CANCELED",
        providerCheckoutId: null,
        providerVersion: null,
        cancelAtPeriodEnd: false,
        canceledAt: eventCreatedAt,
        currentPeriodEnd: eventCreatedAt,
        readOnlyAt: eventCreatedAt,
        lastProviderEventAt: eventCreatedAt,
        metadata: {
          ...metadata,
          checkoutRejectedReason: reasonCode,
          checkoutRejectedAt: eventCreatedAt.toISOString(),
          stripeLastEventCreated: Math.floor(eventCreatedAt.getTime() / 1_000),
          stripeEventType: "checkout.session.completed",
        },
      },
    });
    await transaction.subscriptionHistory.create({
      data: {
        subscriptionId: current.id,
        action: "billing.checkout.live_rejected",
        fromStatus: current.status,
        toStatus: updated.status,
        reason: reasonCode,
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId,
        action: "billing.checkout.live_rejected",
        targetType: "Subscription",
        targetId: current.id,
        reason: reasonCode,
        provider: "stripe",
        metadata: {
          reasonCode,
          subscriptionCanceled: Boolean(subscriptionId),
        },
      },
    });
  }, { isolationLevel: "Serializable" });
}

async function clearCheckoutSessionReservation(
  checkoutSessionId: string,
  companyId: string,
  eventCreatedAt: Date,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${companyId}`}, 0))`;
    const current = await transaction.subscription.findFirst({
      where: { companyId, providerCheckoutId: checkoutSessionId },
      orderBy: { createdAt: "desc" },
    });
    if (!current) return;
    const metadata = { ...jsonObject(current.metadata) };
    delete metadata.billingCheckoutReservation;
    await transaction.subscription.update({
      where: { id: current.id },
      data: {
        providerCheckoutId: null,
        providerVersion: null,
        lastProviderEventAt: eventCreatedAt,
        metadata,
      },
    });
  }, { isolationLevel: "Serializable" });
}

async function companyIdForSubscription(subscription: Stripe.Subscription) {
  return resolveCompany(
    subscription.metadata?.companyId,
    await companyIdForCustomer(idOf(subscription.customer), subscription.metadata?.companyId),
  );
}

async function companyIdForCustomer(customerId: string | null, metadataCompanyId?: string | null) {
  if (!customerId) return metadataCompanyId?.trim() || null;
  const [links, direct] = await Promise.all([
    prisma.billingCustomerCompanyLink.findMany({
      where: { provider: "stripe", externalCustomerId: customerId },
      select: { companyId: true },
    }),
    prisma.billingCustomer.findUnique({
      where: { provider_externalCustomerId: { provider: "stripe", externalCustomerId: customerId } },
      select: { companyId: true },
    }),
  ]);
  const companyIds = [...new Set([...links.map((link) => link.companyId), ...(direct ? [direct.companyId] : [])])];
  const metadata = metadataCompanyId?.trim();
  if (metadata) {
    if (companyIds.length && !companyIds.includes(metadata)) throw new Error("STRIPE_EVENT_CROSS_TENANT");
    return metadata;
  }
  if (companyIds.length > 1) throw new Error("STRIPE_EVENT_COMPANY_AMBIGUOUS");
  return companyIds[0] ?? null;
}

async function canonicalCompanyIdForCustomer(customerId: string | null) {
  if (!customerId) return null;
  const direct = await prisma.billingCustomer.findUnique({
    where: { provider_externalCustomerId: { provider: "stripe", externalCustomerId: customerId } },
    select: { companyId: true },
  });
  if (!direct) throw new Error("STRIPE_CUSTOMER_UNRESOLVED");
  const linked = await prisma.billingCustomerCompanyLink.findFirst({
    where: { provider: "stripe", externalCustomerId: customerId, companyId: direct.companyId },
  });
  if (!linked) throw new Error("STRIPE_CUSTOMER_LINK_MISSING");
  return direct.companyId;
}

async function companyIdForEvent(event: Stripe.Event): Promise<string | null> {
  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata?.companyId || session.client_reference_id;
    return resolveCompany(metadata, await companyIdForCustomer(idOf(session.customer), metadata));
  }
  if (event.type.startsWith("customer.subscription.")) {
    return companyIdForSubscription(event.data.object as Stripe.Subscription);
  }
  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoiceCompanyId(invoice);
    return companyIdForCustomer(idOf(invoice.customer), metadata);
  }
  if (event.type === "customer.tax_id.updated") {
    const taxId = event.data.object as Stripe.TaxId;
    return canonicalCompanyIdForCustomer(idOf(taxId.customer));
  }
  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const metadata = dispute.metadata?.companyId;
    if (metadata) return metadata;
    const chargeId = idOf(dispute.charge);
    if (!chargeId) throw new Error("STRIPE_DISPUTE_CHARGE_UNRESOLVED");
    const charge = await getStripeClient().charges.retrieve(chargeId);
    return companyIdForCustomer(idOf(charge.customer), charge.metadata?.companyId);
  }
  return null;
}

async function resolveCompany(metadataCompanyId: string | null | undefined, customerCompanyId: string | null) {
  const normalizedMetadata = metadataCompanyId?.trim() || null;
  if (normalizedMetadata && customerCompanyId && normalizedMetadata !== customerCompanyId) {
    throw new Error("STRIPE_EVENT_CROSS_TENANT");
  }
  return normalizedMetadata ?? customerCompanyId;
}

function assertStripeEnvironment(subscription: Stripe.Subscription, livemode: boolean) {
  const eventEnvironment = subscription.metadata?.environment?.trim().toLowerCase();
  const currentEnvironment = billingEnvironment();
  if (eventEnvironment && eventEnvironment !== currentEnvironment) {
    throw new Error("STRIPE_EVENT_ENVIRONMENT_MISMATCH");
  }
  if (livemode !== (currentEnvironment === "production")) {
    throw new Error("STRIPE_EVENT_MODE_MISMATCH");
  }
}

function eventProjection(event: Stripe.Event) {
  const object = event.data.object as {
    id?: string;
    object?: string;
    customer?: string | { id: string } | null;
    subscription?: string | { id: string } | null;
    metadata?: Record<string, string>;
  };
  return {
    eventId: event.id,
    eventType: event.type,
    created: event.created,
    livemode: event.livemode,
    objectId: object.id ?? null,
    objectType: object.object ?? null,
    customerId: idOf(object.customer),
    subscriptionId: idOf(object.subscription),
    metadataCompanyId: object.metadata?.companyId ?? null,
  };
}

function planForSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) throw new Error("STRIPE_PLAN_NOT_RESOLVED");
  const metadataPlan = subscription.metadata?.planKey;
  const metadataInterval = subscription.metadata?.interval;
  if (metadataPlan && metadataInterval) {
    const planKey = normalizeBillingPlanKey(metadataPlan);
    const interval = normalizeBillingInterval(metadataInterval);
    if (stripePriceForPlan(planKey, interval) !== priceId) {
      throw new Error("STRIPE_PRICE_METADATA_MISMATCH");
    }
    return { planKey, interval, priceId };
  }
  return { ...billingPlanForStripePrice(priceId), priceId };
}

function metadataPlanKey(planKey: ReturnType<typeof normalizeBillingPlanKey>) {
  return planKey === "PROFESSIONAL" ? "pro" : planKey.toLowerCase();
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
  eventType: string,
): SubscriptionStatus {
  if (eventType === "invoice.payment_failed") return "PAST_DUE";
  if (eventType === "invoice.paid") return "ACTIVE";
  if (eventType === "customer.subscription.deleted" || status === "canceled") return "CANCELED";
  if (eventType === "customer.subscription.paused" || status === "paused") return "PAUSED";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  if (status === "active") return "ACTIVE";
  return "EXPIRED";
}

export function isTerminalBillingEventResult(value: string) {
  return [
    "PROCESSED",
    "IGNORED_OUT_OF_ORDER",
    "RECORDED_NO_ACCESS_CHANGE",
    "VERIFIED_BILLING_DISABLED",
  ].includes(value);
}

export function shouldIgnoreStripeEvent(metadata: unknown, incomingCreated: number) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const previous = Number((metadata as Record<string, unknown>).stripeLastEventCreated);
  return Number.isFinite(previous) && previous > incomingCreated;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const legacy = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const start = item?.current_period_start ?? legacy.current_period_start ?? subscription.created;
  const end = item?.current_period_end ?? legacy.current_period_end ?? start + 30 * 86_400;
  return { start: new Date(start * 1_000), end: new Date(end * 1_000) };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const value = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } };
  };
  return idOf(value.subscription ?? value.parent?.subscription_details?.subscription);
}

function invoiceCompanyId(invoice: Stripe.Invoice) {
  const value = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: Record<string, string> };
    parent?: { subscription_details?: { metadata?: Record<string, string> } };
  };
  return value.subscription_details?.metadata?.companyId
    || value.parent?.subscription_details?.metadata?.companyId
    || invoice.metadata?.companyId
    || null;
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}
