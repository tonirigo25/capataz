import { createHash, randomUUID } from "node:crypto";
import { Prisma, type BillingCustomer } from "@prisma/client";
import type Stripe from "stripe";
import type { PlanKey } from "@/lib/commercial/plans";
import { hashCanonical } from "@/lib/platform/idempotency";
import { prisma } from "@/lib/prisma";
import {
  billingEnvironment,
  billingAppUrl,
  billingPlanForStripePrice,
  isBillingEnabled,
  normalizeBillingInterval,
  normalizeBillingPlanKey,
  stripePriceForPlan,
  stripeTrialDays,
  type BillingInterval,
  type BillingPlanKey,
} from "@/lib/billing/config";
import { getStripeClient, stripeKeyIsLive } from "@/lib/billing/stripe-client";
import {
  checkoutReservationIsFresh,
  validateBillingProfile,
  type BillingProfile,
} from "@/lib/billing/guards";

const ACTIVE_LOCAL_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"] as const;
const ACTIVE_STRIPE_STATUSES = new Set(["trialing", "active", "past_due", "unpaid", "incomplete", "paused"]);
const PLAN_RANK: Record<BillingPlanKey, number> = { STARTER: 1, PROFESSIONAL: 2, BUSINESS: 3 };

type BillingCustomerReference = {
  externalCustomerId: string;
  ownerRecord: BillingCustomer | null;
  linkCount: number;
};

export async function createCheckout(input: {
  companyId: string;
  planKey: PlanKey | string;
  interval?: BillingInterval | string;
  idempotencyKey: string;
}) {
  if (!isBillingEnabled()) throw new Error("BILLING_DISABLED");
  const stripe = getStripeClient();
  const livemode = stripeKeyIsLive();
  const planKey = normalizeBillingPlanKey(String(input.planKey));
  const interval = normalizeBillingInterval(input.interval);
  const priceId = stripePriceForPlan(planKey, interval);
  const payload = { planKey, interval, priceId, currency: "EUR" };
  const operation = await claimBillingOperation({
    companyId: input.companyId,
    operation: "checkout",
    clientKey: input.idempotencyKey,
    payload,
  });
  if (operation.kind === "replay") {
    return stripe.checkout.sessions.retrieve(operation.reference);
  }

  let reservation: { subscriptionId: string; reservationId: string } | null = null;
  try {
    const profile = await loadBillingProfile(input.companyId);
    validateBillingProfile(profile, livemode);
    const customer = await getOrCreateCustomer(stripe, input.companyId, profile, livemode);
    const openSessions = await stripe.checkout.sessions.list({
      customer: customer.externalCustomerId,
      status: "open",
      limit: 100,
    });
    const existingOpen = openSessions.data.find((session) => (
      session.expires_at > Math.floor(Date.now() / 1_000)
      && (session.metadata?.companyId === input.companyId || session.client_reference_id === input.companyId)
    ));
    if (existingOpen) {
      if (existingOpen.metadata?.billingPayloadHash !== operation.requestHash) {
        throw new Error("BILLING_OPEN_CHECKOUT_EXISTS");
      }
      await completeBillingOperation(operation.recordId, existingOpen.id);
      return existingOpen;
    }

    const providerSubscriptions = await stripe.subscriptions.list({
      customer: customer.externalCustomerId,
      status: "all",
      limit: 100,
    });
    if (providerSubscriptions.data.some((subscription) => (
      ACTIVE_STRIPE_STATUSES.has(subscription.status)
      && (
        subscription.metadata.companyId === input.companyId
        || (!subscription.metadata.companyId && customer.linkCount === 1)
      )
    ))) {
      throw new Error("BILLING_ACTIVE_SUBSCRIPTION_EXISTS");
    }

    const reservationId = `pending:${randomUUID()}`;
    const subscriptionId = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${input.companyId}`}, 0))`;
      const pending = await transaction.subscription.findFirst({
        where: {
          companyId: input.companyId,
          providerCheckoutId: { startsWith: "pending:" },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (pending && checkoutReservationIsFresh(pending.metadata)) {
        throw new Error("BILLING_CHECKOUT_IN_PROGRESS");
      }
      const active = await transaction.subscription.findFirst({
        where: {
          companyId: input.companyId,
          status: { in: [...ACTIVE_LOCAL_STATUSES] },
          OR: [
            { stripeSubscriptionId: { not: null } },
            { externalSubscriptionId: { not: null } },
          ],
        },
        select: { id: true },
      });
      if (active) throw new Error("BILLING_ACTIVE_SUBSCRIPTION_EXISTS");
      const current = pending ?? await transaction.subscription.findFirst({
        where: { companyId: input.companyId },
        orderBy: { createdAt: "desc" },
      });
      if (!current) throw new Error("BILLING_SUBSCRIPTION_NOT_CONFIGURED");
      await transaction.subscription.update({
        where: { id: current.id },
        data: {
          provider: "stripe",
          providerCheckoutId: reservationId,
          providerPriceId: priceId,
          stripePriceId: priceId,
          providerVersion: operation.requestHash,
          metadata: {
            ...jsonObject(current.metadata),
            billingCheckoutReservation: {
              id: reservationId,
              createdAt: new Date().toISOString(),
              payloadHash: operation.requestHash,
            },
          },
        },
      });
      return current.id;
    }, { isolationLevel: "Serializable" });
    reservation = { subscriptionId, reservationId };

    const trialDays = stripeTrialDays();
    const metadata = {
      companyId: input.companyId,
      planKey: stripeMetadataPlanKey(planKey),
      interval,
      environment: billingEnvironment(),
      billingPayloadHash: operation.requestHash,
    };
    const checkoutCustomerUpdate = livemode
      ? { name: "auto" as const }
      : { name: "auto" as const, address: "auto" as const };
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.externalCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card", "sepa_debit"],
      payment_method_collection: "always",
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      customer_update: checkoutCustomerUpdate,
      success_url: billingAppUrl("/plan-y-uso?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: billingAppUrl("/plan-y-uso?checkout=cancelled"),
      client_reference_id: input.companyId,
      locale: "es",
      metadata,
      subscription_data: {
        metadata,
        trial_period_days: trialDays,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      },
      custom_text: {
        submit: {
          message: `Prueba gratuita de ${trialDays} días. Después se renovará automáticamente con la periodicidad mostrada. Puedes cancelar desde el portal antes del primer cargo.`,
        },
      },
      allow_promotion_codes: false,
    }, { idempotencyKey: operation.stripeIdempotencyKey });
    await completeCheckoutReservation(subscriptionId, input.companyId, reservationId, session.id);
    await completeBillingOperation(operation.recordId, session.id);
    return session;
  } catch (error) {
    if (reservation) {
      await clearCheckoutReservation(
        reservation.subscriptionId,
        input.companyId,
        reservation.reservationId,
      );
    }
    await releaseBillingOperation(operation.recordId);
    throw error;
  }
}

export async function createPortal(input: { companyId: string; idempotencyKey: string }) {
  if (!isBillingEnabled()) throw new Error("BILLING_DISABLED");
  const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim();
  if (!configuration) throw new Error("STRIPE_NOT_CONFIGURED:STRIPE_PORTAL_CONFIGURATION_ID");
  const customer = await resolveBillingCustomer(input.companyId);
  if (!customer) throw new Error("BILLING_CUSTOMER_NOT_FOUND");
  await ensureCustomerLink(customer.externalCustomerId, input.companyId);
  const portalCustomerLinkCount = await countCustomerLinks(customer.externalCustomerId);
  if (portalCustomerLinkCount !== 1) {
    throw new Error("BILLING_SHARED_CUSTOMER_PORTAL_FORBIDDEN");
  }
  const operation = await claimBillingOperation({
    companyId: input.companyId,
    operation: "portal",
    clientKey: input.idempotencyKey,
    payload: { customerId: customer.externalCustomerId, configuration },
  });
  const stripe = getStripeClient();
  if (operation.kind === "replay") {
    return stripe.billingPortal.sessions.create({
      customer: customer.externalCustomerId,
      configuration,
      return_url: billingAppUrl("/plan-y-uso"),
    }, { idempotencyKey: operation.stripeIdempotencyKey });
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.externalCustomerId,
      configuration,
      return_url: billingAppUrl("/plan-y-uso"),
    }, { idempotencyKey: operation.stripeIdempotencyKey });
    await completeBillingOperation(operation.recordId, session.id);
    return session;
  } catch (error) {
    await releaseBillingOperation(operation.recordId);
    throw error;
  }
}

export async function changeSubscription(input: {
  companyId: string;
  planKey: PlanKey | string;
  interval?: BillingInterval | string;
  idempotencyKey: string;
}) {
  if (!isBillingEnabled()) throw new Error("BILLING_DISABLED");
  const targetPlanKey = normalizeBillingPlanKey(String(input.planKey));
  const targetInterval = normalizeBillingInterval(input.interval);
  const targetPriceId = stripePriceForPlan(targetPlanKey, targetInterval);
  const local = await prisma.subscription.findFirst({
    where: {
      companyId: input.companyId,
      status: { in: [...ACTIVE_LOCAL_STATUSES] },
      stripeSubscriptionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!local?.stripeSubscriptionId) throw new Error("BILLING_ACTIVE_SUBSCRIPTION_NOT_FOUND");

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(local.stripeSubscriptionId);
  const linkedCompany = await companyIdForCustomerLink(idOf(subscription.customer), subscription.metadata.companyId);
  if (linkedCompany !== input.companyId) throw new Error("STRIPE_EVENT_CROSS_TENANT");
  const currentItem = subscription.items.data[0];
  if (!currentItem?.price.id) throw new Error("STRIPE_PLAN_NOT_RESOLVED");
  const current = billingPlanForStripePrice(currentItem.price.id);
  if (currentItem.price.id === targetPriceId) throw new Error("BILLING_SUBSCRIPTION_CHANGE_NOT_NEEDED");
  const periodEndChange = PLAN_RANK[targetPlanKey] < PLAN_RANK[current.planKey]
    || (
      targetPlanKey === current.planKey
      && current.interval === "year"
      && targetInterval === "month"
    );
  if (periodEndChange) return scheduleDowngrade(input);
  const immediateChange = PLAN_RANK[targetPlanKey] > PLAN_RANK[current.planKey]
    || (
      targetPlanKey === current.planKey
      && current.interval === "month"
      && targetInterval === "year"
    );
  if (!immediateChange) throw new Error("BILLING_SUBSCRIPTION_CHANGE_INVALID");

  const operation = await claimBillingOperation({
    companyId: input.companyId,
    operation: "subscription-change",
    clientKey: input.idempotencyKey,
    payload: {
      subscriptionId: subscription.id,
      targetPlanKey,
      targetInterval,
      targetPriceId,
      behavior: "immediate_proration",
    },
  });
  if (operation.kind === "replay") {
    return {
      id: operation.reference,
      scheduledPlanKey: targetPlanKey,
      effectiveAt: new Date(),
      mode: "immediate" as const,
    };
  }

  try {
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: currentItem.id, price: targetPriceId, quantity: 1 }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      metadata: {
        ...subscription.metadata,
        companyId: input.companyId,
        planKey: stripeMetadataPlanKey(targetPlanKey),
        interval: targetInterval,
        environment: billingEnvironment(),
      },
    }, { idempotencyKey: operation.stripeIdempotencyKey });
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${input.companyId}`}, 0))`;
      const currentLocal = await transaction.subscription.findUnique({ where: { id: local.id } });
      if (!currentLocal || currentLocal.companyId !== input.companyId) {
        throw new Error("BILLING_ACTIVE_SUBSCRIPTION_NOT_FOUND");
      }
      await transaction.subscription.update({
        where: { id: currentLocal.id },
        data: {
          metadata: {
            ...jsonObject(currentLocal.metadata),
            providerPlanPending: targetPlanKey,
            providerIntervalPending: targetInterval,
            providerChangeRequestedAt: new Date().toISOString(),
            providerChangeMode: "immediate_proration",
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          companyId: input.companyId,
          action: "billing.subscription.change_requested",
          targetType: "Subscription",
          targetId: currentLocal.id,
          metadata: {
            targetPlanKey,
            targetInterval,
            mode: "immediate_proration",
          },
        },
      });
    }, { isolationLevel: "Serializable" });
    await completeBillingOperation(operation.recordId, updated.id);
    return {
      id: updated.id,
      scheduledPlanKey: targetPlanKey,
      effectiveAt: new Date(),
      mode: "immediate" as const,
    };
  } catch (error) {
    await releaseBillingOperation(operation.recordId);
    throw error;
  }
}

export async function scheduleDowngrade(input: {
  companyId: string;
  planKey: PlanKey | string;
  interval?: BillingInterval | string;
  idempotencyKey: string;
}) {
  if (!isBillingEnabled()) throw new Error("BILLING_DISABLED");
  const targetPlanKey = normalizeBillingPlanKey(String(input.planKey));
  const targetInterval = normalizeBillingInterval(input.interval);
  const targetPriceId = stripePriceForPlan(targetPlanKey, targetInterval);
  const local = await prisma.subscription.findFirst({
    where: { companyId: input.companyId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (!local?.stripeSubscriptionId) throw new Error("BILLING_ACTIVE_SUBSCRIPTION_NOT_FOUND");
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(local.stripeSubscriptionId);
  const linkedCompany = await companyIdForCustomerLink(idOf(subscription.customer), subscription.metadata.companyId);
  if (linkedCompany !== input.companyId) throw new Error("STRIPE_EVENT_CROSS_TENANT");
  const currentItem = subscription.items.data[0];
  if (!currentItem?.price.id) throw new Error("STRIPE_PLAN_NOT_RESOLVED");
  const current = billingPlanForStripePrice(currentItem.price.id);
  const intervalDowngrade = targetPlanKey === current.planKey
    && current.interval === "year"
    && targetInterval === "month";
  if (
    targetPriceId === currentItem.price.id
    || (
      PLAN_RANK[targetPlanKey] >= PLAN_RANK[current.planKey]
      && !intervalDowngrade
    )
  ) {
    throw new Error("BILLING_DOWNGRADE_TARGET_INVALID");
  }
  const period = subscriptionPeriod(subscription);
  const operation = await claimBillingOperation({
    companyId: input.companyId,
    operation: "downgrade",
    clientKey: input.idempotencyKey,
    payload: {
      subscriptionId: local.stripeSubscriptionId,
      targetPlanKey,
      targetInterval,
      targetPriceId,
      effectiveAt: period.end.toISOString(),
    },
  });
  if (operation.kind === "replay") {
    return {
      id: operation.reference,
      scheduledPlanKey: targetPlanKey,
      effectiveAt: period.end,
      mode: "period_end" as const,
    };
  }

  try {
    const existingScheduleId = idOf(subscription.schedule);
    const schedule = existingScheduleId
      ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
      : await stripe.subscriptionSchedules.create(
          { from_subscription: subscription.id },
          { idempotencyKey: `${operation.stripeIdempotencyKey}:create` },
        );
    const updatedSchedule = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      metadata: {
        companyId: input.companyId,
        targetPlanKey: stripeMetadataPlanKey(targetPlanKey),
        targetInterval,
        environment: billingEnvironment(),
      },
      phases: [
        {
          start_date: Math.floor(period.start.getTime() / 1_000),
          end_date: Math.floor(period.end.getTime() / 1_000),
          items: [{ price: currentItem.price.id, quantity: currentItem.quantity ?? 1 }],
          proration_behavior: "none",
        },
        {
          start_date: Math.floor(period.end.getTime() / 1_000),
          items: [{ price: targetPriceId, quantity: 1 }],
          proration_behavior: "none",
        },
      ],
    });
    await prisma.subscription.update({
      where: { id: local.id },
      data: {
        scheduledPlanKey: targetPlanKey,
        metadata: {
          ...jsonObject(local.metadata),
          stripeScheduleId: updatedSchedule.id,
          scheduledPlanKey: targetPlanKey,
          scheduledInterval: targetInterval,
          scheduledAt: new Date().toISOString(),
        },
      },
    });
    await completeBillingOperation(operation.recordId, updatedSchedule.id);
    return {
      id: updatedSchedule.id,
      scheduledPlanKey: targetPlanKey,
      effectiveAt: period.end,
      mode: "period_end" as const,
    };
  } catch (error) {
    await releaseBillingOperation(operation.recordId);
    throw error;
  }
}

export function paidAccessState(
  subscription: {
    status: string;
    currentPeriodEnd: Date;
    graceEndsAt?: Date | null;
  } | null,
  now = new Date(),
) {
  if (!isBillingEnabled()) return { paidAccess: false, basicAccess: true, reason: "billing_disabled" as const };
  if (!subscription) return { paidAccess: false, basicAccess: true, reason: "no_subscription" as const };
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return { paidAccess: true, basicAccess: true, reason: "active" as const };
  }
  if (subscription.status === "PAST_DUE") {
    const graceEndsAt = subscription.graceEndsAt ?? null;
    const inGrace = Boolean(graceEndsAt && now < graceEndsAt);
    return { paidAccess: inGrace, basicAccess: true, reason: inGrace ? "past_due_grace" as const : "past_due_expired" as const, graceEndsAt };
  }
  if (subscription.status === "CANCELED" && now < subscription.currentPeriodEnd) {
    return { paidAccess: true, basicAccess: true, reason: "canceled_period_remaining" as const };
  }
  return { paidAccess: false, basicAccess: true, reason: "inactive" as const };
}

async function loadBillingProfile(companyId: string): Promise<BillingProfile> {
  const [company, customer] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        razonSocial: true,
        nombreComercial: true,
        email: true,
        direccion: true,
        codigoPostal: true,
        ciudad: true,
        pais: true,
        taxId: true,
      },
    }),
    resolveBillingCustomer(companyId),
  ]);
  if (!company) throw new Error("BILLING_COMPANY_NOT_FOUND");
  const record = customer?.ownerRecord;
  const countryCode = normalizeCompanyCountry(record?.countryCode || company.pais || "");
  const companyProfile = {
    legalName: (company.razonSocial || "").trim(),
    email: (company.email || "").trim().toLowerCase(),
    addressLine: (company.direccion || "").trim(),
    postalCode: (company.codigoPostal || "").trim(),
    city: (company.ciudad || "").trim(),
    countryCode: normalizeCompanyCountry(company.pais || ""),
    taxId: (company.taxId || "").trim().toUpperCase(),
  };
  const profile = record ? {
    legalName: (record.legalName || companyProfile.legalName).trim(),
    email: (record.email || companyProfile.email).trim().toLowerCase(),
    addressLine: (record.addressLine || companyProfile.addressLine).trim(),
    postalCode: (record.postalCode || companyProfile.postalCode).trim(),
    city: (record.city || companyProfile.city).trim(),
    countryCode,
    taxId: (record.taxId || companyProfile.taxId).trim().toUpperCase(),
  } : companyProfile;
  if (record && record.companyId !== companyId) {
    const canonical = [
      record.legalName,
      record.email,
      record.addressLine,
      record.postalCode,
      record.city,
      record.countryCode,
      record.taxId,
    ].map((value) => value?.trim().toUpperCase() || "");
    const requested = [
      companyProfile.legalName,
      companyProfile.email,
      companyProfile.addressLine,
      companyProfile.postalCode,
      companyProfile.city,
      companyProfile.countryCode,
      companyProfile.taxId,
    ].map((value) => value.trim().toUpperCase());
    if (canonical.some((value, index) => value && value !== requested[index])) {
      throw new Error("BILLING_SHARED_CUSTOMER_PROFILE_CONFLICT");
    }
  }
  return profile;
}

async function getOrCreateCustomer(
  stripe: Stripe,
  companyId: string,
  profile: BillingProfile,
  livemode: boolean,
): Promise<BillingCustomerReference> {
  const existing = await resolveBillingCustomer(companyId);
  if (existing) {
    const remote = await stripe.customers.retrieve(existing.externalCustomerId);
    if (remote.deleted) throw new Error("STRIPE_CUSTOMER_DELETED");
    await stripe.customers.update(existing.externalCustomerId, {
      email: profile.email,
      name: profile.legalName,
      address: {
        line1: profile.addressLine,
        postal_code: profile.postalCode,
        city: profile.city,
        country: profile.countryCode,
      },
      metadata: { ...remote.metadata, environment: billingEnvironment() },
    });
    await ensureCustomerTaxId(stripe, existing.externalCustomerId, profile);
    if (existing.ownerRecord?.companyId === companyId) {
      await prisma.billingCustomer.update({
        where: { id: existing.ownerRecord.id },
        data: {
          email: profile.email,
          legalName: profile.legalName,
          taxId: profile.taxId,
          addressLine: profile.addressLine,
          postalCode: profile.postalCode,
          city: profile.city,
          countryCode: profile.countryCode,
          livemode,
        },
      });
    }
    await ensureCustomerLink(existing.externalCustomerId, companyId);
    return { ...existing, linkCount: await countCustomerLinks(existing.externalCustomerId) };
  }

  const environment = billingEnvironment();
  const created = await stripe.customers.create({
    email: profile.email,
    name: profile.legalName,
    address: {
      line1: profile.addressLine,
      postal_code: profile.postalCode,
      city: profile.city,
      country: profile.countryCode,
    },
    metadata: { primaryCompanyId: companyId, environment },
  }, { idempotencyKey: serverStripeKey(companyId, "customer", hashCanonical(profile)) });
  await ensureCustomerTaxId(stripe, created.id, profile);
  try {
    const ownerRecord = await prisma.$transaction(async (transaction) => {
      const billingCustomer = await transaction.billingCustomer.create({
        data: {
          companyId,
          provider: "stripe",
          externalCustomerId: created.id,
          email: profile.email,
          currency: "EUR",
          livemode: created.livemode,
          legalName: profile.legalName,
          taxId: profile.taxId,
          addressLine: profile.addressLine,
          postalCode: profile.postalCode,
          city: profile.city,
          countryCode: profile.countryCode,
        },
      });
      await transaction.billingCustomerCompanyLink.create({
        data: { provider: "stripe", externalCustomerId: created.id, companyId },
      });
      return billingCustomer;
    });
    return { externalCustomerId: created.id, ownerRecord, linkCount: 1 };
  } catch (error) {
    const concurrent = await resolveBillingCustomer(companyId);
    if (concurrent) return concurrent;
    throw error;
  }
}

async function resolveBillingCustomer(companyId: string): Promise<BillingCustomerReference | null> {
  const direct = await prisma.billingCustomer.findUnique({ where: { companyId } });
  const link = await prisma.billingCustomerCompanyLink.findFirst({
    where: { provider: "stripe", companyId },
    orderBy: { createdAt: "asc" },
  });
  const externalCustomerId = link?.externalCustomerId || direct?.externalCustomerId;
  if (!externalCustomerId) return null;
  const ownerRecord = direct?.externalCustomerId === externalCustomerId
    ? direct
    : await prisma.billingCustomer.findUnique({
        where: {
          provider_externalCustomerId: { provider: "stripe", externalCustomerId },
        },
      });
  return {
    externalCustomerId,
    ownerRecord,
    linkCount: await countCustomerLinks(externalCustomerId),
  };
}

async function ensureCustomerLink(externalCustomerId: string, companyId: string) {
  await prisma.billingCustomerCompanyLink.upsert({
    where: {
      provider_externalCustomerId_companyId: {
        provider: "stripe",
        externalCustomerId,
        companyId,
      },
    },
    update: {},
    create: { provider: "stripe", externalCustomerId, companyId },
  });
}

async function countCustomerLinks(externalCustomerId: string) {
  const count = await prisma.billingCustomerCompanyLink.count({
    where: { provider: "stripe", externalCustomerId },
  });
  if (count) return count;
  return prisma.billingCustomer.count({
    where: { provider: "stripe", externalCustomerId },
  });
}

async function ensureCustomerTaxId(stripe: Stripe, customerId: string, profile: BillingProfile) {
  const type = profile.countryCode === "ES" ? "es_cif" as const : "eu_vat" as const;
  const value = profile.countryCode === "ES"
    ? profile.taxId.replace(/^ES/i, "")
    : profile.taxId;
  const existing = await stripe.customers.listTaxIds(customerId, { limit: 100 });
  if (existing.data.some((taxId) => taxId.type === type && taxId.value.replace(/\s/g, "").toUpperCase() === value.replace(/\s/g, "").toUpperCase())) {
    return;
  }
  await stripe.customers.createTaxId(customerId, { type, value });
}

async function companyIdForCustomerLink(customerId: string | null, metadataCompanyId?: string | null) {
  if (!customerId) throw new Error("STRIPE_CUSTOMER_UNRESOLVED");
  const links = await prisma.billingCustomerCompanyLink.findMany({
    where: { provider: "stripe", externalCustomerId: customerId },
    select: { companyId: true },
  });
  const direct = await prisma.billingCustomer.findUnique({
    where: { provider_externalCustomerId: { provider: "stripe", externalCustomerId: customerId } },
    select: { companyId: true },
  });
  const companyIds = [...new Set([...links.map((link) => link.companyId), ...(direct ? [direct.companyId] : [])])];
  const metadata = metadataCompanyId?.trim();
  if (metadata) {
    if (!companyIds.includes(metadata)) throw new Error("STRIPE_EVENT_CROSS_TENANT");
    return metadata;
  }
  if (companyIds.length !== 1) throw new Error("STRIPE_EVENT_COMPANY_AMBIGUOUS");
  return companyIds[0];
}

async function claimBillingOperation(input: {
  companyId: string;
  operation: "checkout" | "portal" | "downgrade" | "subscription-change";
  clientKey: string;
  payload: unknown;
}) {
  const clientKey = requireIdempotencyKey(input.clientKey);
  const namespace = `billing.${input.operation}.v2`;
  const requestHash = hashCanonical(input.payload);
  const recordId = createHash("sha256")
    .update(`${input.companyId}:${namespace}:${clientKey}`)
    .digest("hex");
  const stripeIdempotencyKey = serverStripeKey(
    input.companyId,
    input.operation,
    `${clientKey}:${requestHash}`,
  );
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${recordId}, 0))`;
    const existing = await transaction.idempotencyRecord.findUnique({ where: { id: recordId } });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
      }
      const response = jsonObject(existing.responseBody);
      if (existing.completedAt && typeof response.reference === "string") {
        return {
          kind: "replay" as const,
          reference: response.reference,
          stripeIdempotencyKey,
          requestHash,
        };
      }
      if (existing.lockedUntil && existing.lockedUntil > new Date()) {
        throw new Error("IDEMPOTENCY_OPERATION_IN_PROGRESS");
      }
      await transaction.idempotencyRecord.update({
        where: { id: recordId },
        data: { lockedUntil: new Date(Date.now() + 60_000) },
      });
    } else {
      await transaction.idempotencyRecord.create({
        data: {
          id: recordId,
          companyId: input.companyId,
          namespace,
          idempotencyKey: clientKey,
          requestHash,
          schemaVersion: 2,
          lockedUntil: new Date(Date.now() + 60_000),
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
    }
    return {
      kind: "create" as const,
      recordId,
      stripeIdempotencyKey,
      requestHash,
    };
  }, { isolationLevel: "Serializable" });
}

async function completeBillingOperation(recordId: string, reference: string) {
  await prisma.idempotencyRecord.update({
    where: { id: recordId },
    data: {
      responseStatus: 200,
      responseBody: { reference },
      completedAt: new Date(),
      lockedUntil: null,
    },
  });
}

async function releaseBillingOperation(recordId: string) {
  await prisma.idempotencyRecord.updateMany({
    where: { id: recordId, completedAt: null },
    data: { lockedUntil: null },
  }).catch(() => undefined);
}

function serverStripeKey(companyId: string, operation: string, payloadHash: string) {
  return `capataz:${operation}:${createHash("sha256")
    .update(`${companyId}:${operation}:${payloadHash}`)
    .digest("hex")}`;
}

function requireIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error("BILLING_IDEMPOTENCY_KEY_INVALID");
  }
  return normalized;
}

function stripeMetadataPlanKey(planKey: BillingPlanKey) {
  if (planKey === "PROFESSIONAL") return "pro";
  return planKey.toLowerCase();
}

function normalizeCompanyCountry(value: string) {
  const normalized = value.trim().toUpperCase();
  if (["ES", "ESPAÑA", "ESPANA", "SPAIN"].includes(normalized)) return "ES";
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  throw new Error("BILLING_COUNTRY_REQUIRED");
}

async function clearCheckoutReservation(subscriptionId: string, companyId: string, reservationId: string) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${companyId}`}, 0))`;
    const current = await transaction.subscription.findFirst({
      where: { id: subscriptionId, companyId, providerCheckoutId: reservationId },
    });
    if (!current) return;
    await transaction.subscription.update({
      where: { id: current.id },
      data: {
        providerCheckoutId: null,
        providerVersion: null,
        metadata: withoutCheckoutReservation(current.metadata),
      },
    });
  }, { isolationLevel: "Serializable" }).catch(() => undefined);
}

async function completeCheckoutReservation(
  subscriptionId: string,
  companyId: string,
  reservationId: string,
  checkoutSessionId: string,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-subscription:${companyId}`}, 0))`;
    const current = await transaction.subscription.findFirst({
      where: { id: subscriptionId, companyId, providerCheckoutId: reservationId },
    });
    if (!current) throw new Error("BILLING_CHECKOUT_RESERVATION_LOST");
    await transaction.subscription.update({
      where: { id: current.id },
      data: {
        providerCheckoutId: checkoutSessionId,
        metadata: withoutCheckoutReservation(current.metadata),
      },
    });
  }, { isolationLevel: "Serializable" });
}

function withoutCheckoutReservation(metadata: unknown) {
  const next = { ...jsonObject(metadata) };
  delete next.billingCheckoutReservation;
  return next;
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

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}
