import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { PrismaClient, type SubscriptionStatus } from "@prisma/client";
import { Webhook } from "standardwebhooks";
import type { BillingProvider, EmailDeliveryProvider, ProviderReceipt, StorageProvider } from "../../lib/platform/providers/contracts";
import { cancellationMetrics, createAuthenticatedCheckout, createAuthenticatedCustomerPortal, ingestStripeBillingWebhook, reconcileBillingSubscription } from "../../lib/commercial/subscription-service";
import { recordLimitedUsage } from "../../lib/commercial/usage";
import { claimEmailBatch, ingestResendWebhook, processClaimedEmail, queueEmailEvent, replayDeadLetter } from "../../lib/email/outbox";
import { PrivateStorageService } from "../../lib/private-storage";

const prisma = new PrismaClient();
const companyA = "f4-company-a";
const companyB = "f4-company-b";
const ownerId = "f4-owner";
const memberId = "f4-member";
const now = new Date("2026-07-26T12:00:00Z");

class CountingBillingProvider implements BillingProvider {
  readonly name = "fake-billing-counting";
  readonly mode = "fake" as const;
  checkoutCalls = 0;
  portalCalls = 0;
  async createCheckout(input: { companyId: string; priceKey: string; customerId?: string; returnUrl: string; idempotencyKey: string }) { this.checkoutCalls += 1; return receipt(this.name, `checkout-${this.checkoutCalls}`, input.idempotencyKey); }
  async createPortal(input: { companyId: string; customerId: string; returnUrl: string; idempotencyKey: string }) { this.portalCalls += 1; return receipt(this.name, `portal-${this.portalCalls}`, input.idempotencyKey); }
}

class CountingEmailProvider implements EmailDeliveryProvider {
  readonly name = "fake-email-counting";
  readonly mode = "fake" as const;
  calls = 0;
  constructor(private readonly failUntil = 0) {}
  async send(input: { recipient: string; subject: string; text: string; idempotencyKey: string }) { this.calls += 1; if (this.calls <= this.failUntil) throw new Error("FAKE_EMAIL_TRANSIENT"); return receipt(this.name, `message-${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16)}`, input.idempotencyKey); }
}

class MutableStorageProvider implements StorageProvider {
  readonly name = "mutable-private";
  readonly mode = "fake" as const;
  readonly values = new Map<string, Uint8Array>();
  async put(input: { companyId: string; objectKey: string; bytes: Uint8Array; contentType: string; idempotencyKey: string }) { this.values.set(`${input.companyId}/${input.objectKey}`, input.bytes.slice()); return { ...receipt(this.name, `version-${input.idempotencyKey}`, input.idempotencyKey), sha256: createHash("sha256").update(input.bytes).digest("hex") }; }
  async get(input: { companyId: string; objectKey: string }) { const value = this.values.get(`${input.companyId}/${input.objectKey}`); if (!value) throw new Error("OBJECT_NOT_FOUND"); return value.slice(); }
  async delete(input: { companyId: string; objectKey: string; idempotencyKey: string }) { this.values.delete(`${input.companyId}/${input.objectKey}`); return receipt(this.name, `deleted-${input.objectKey}`, input.idempotencyKey); }
}

function receipt(provider: string, reference: string, idempotencyKey: string): ProviderReceipt { return { provider, mode: "fake", reference, idempotencyKey, acceptedAt: now.toISOString() }; }
function stripeSignature(rawBody: string, secret: string, timestamp: number) { return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`; }

async function sendStripeEvent(input: { id: string; type: string; created: number; status?: string; cancelAtPeriodEnd?: boolean; cancellationReason?: string }) {
  const body = JSON.stringify({ id: input.id, type: input.type, created: input.created, data: { object: { id: input.type.startsWith("customer.subscription") ? "sub-f4-a" : `invoice-${input.id}`, customer: "cus-f4-a", subscription: "sub-f4-a", status: input.status, current_period_start: input.created - 100, current_period_end: input.created + 2_592_000, trial_end: input.status === "trialing" ? input.created + 86_400 : null, cancel_at_period_end: input.cancelAtPeriodEnd ?? false, cancellation_details: input.cancellationReason ? { reason: input.cancellationReason, comment: "customer supplied" } : undefined, metadata: { companyId: companyA } } } });
  const secret = "f4-stripe-secret";
  return ingestStripeBillingWebhook(prisma, { rawBody: body, signatureHeader: stripeSignature(body, secret, input.created), webhookSecret: secret, now: input.created * 1_000, graceDays: 7 });
}

async function rejected(operation: () => Promise<unknown>, expected: RegExp) { try { await operation(); } catch (error) { assert.match(error instanceof Error ? error.message : String(error), expected); return true; } return false; }

async function main() {
  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations[0]?.count, 43);
  const plan = await prisma.plan.create({ data: { key: "PROFESSIONAL", name: "Professional", description: "F4", audience: "F4", commercialState: "active" } });
  await prisma.company.createMany({ data: [
    { id: companyA, slug: companyA, nombreComercial: "F4 A", email: "billing-a@example.invalid" },
    { id: companyB, slug: companyB, nombreComercial: "F4 B", email: "billing-b@example.invalid" },
  ] });
  await prisma.user.createMany({ data: [
    { id: ownerId, email: "owner-f4@example.invalid", emailNormalized: "owner-f4@example.invalid", passwordHash: "test", displayName: "Owner", status: "active", emailVerifiedAt: now, activeCompanyId: companyA },
    { id: memberId, email: "member-f4@example.invalid", emailNormalized: "member-f4@example.invalid", passwordHash: "test", displayName: "Member", status: "active", emailVerifiedAt: now, activeCompanyId: companyA },
  ] });
  await prisma.companyMembership.createMany({ data: [
    { userId: ownerId, companyId: companyA, role: "OWNER", status: "active", acceptedAt: now },
    { userId: memberId, companyId: companyA, role: "MEMBER", status: "active", acceptedAt: now },
  ] });
  const subscription = await prisma.subscription.create({ data: { companyId: companyA, planId: plan.id, status: "TRIALING", provider: "stripe", externalCustomerId: "cus-f4-a", externalSubscriptionId: "sub-f4-a", currentPeriodStart: now, currentPeriodEnd: new Date("2026-08-26T12:00:00Z") } });
  await prisma.subscription.create({ data: { companyId: companyB, planId: plan.id, status: "ACTIVE", provider: "stripe", currentPeriodStart: now, currentPeriodEnd: new Date("2026-08-26T12:00:00Z") } });
  await prisma.billingCustomer.create({ data: { companyId: companyA, provider: "stripe", externalCustomerId: "cus-f4-a", email: "billing-a@example.invalid", legalName: "F4 Company A SL", taxId: "B12345678", addressLine: "Calle Test 1", postalCode: "28001", city: "Madrid", countryCode: "ES" } });

  const billing = new CountingBillingProvider();
  await prisma.billingPriceMapping.create({ data: { provider: billing.name, planKey: "PROFESSIONAL", interval: "month", currency: "EUR", externalPriceId: "price_f4_professional_month", active: true } });
  const ownerContext = { companyId: companyA, userId: ownerId, role: "OWNER" };
  const checkoutInput = { context: ownerContext, planKey: "PROFESSIONAL" as const, interval: "month" as const, currency: "EUR" as const, returnUrl: "https://app.example.invalid/plan-y-uso", idempotencyKey: "f4-checkout", provider: billing };
  const checkout = await createAuthenticatedCheckout(prisma, checkoutInput);
  const checkoutReplay = await createAuthenticatedCheckout(prisma, checkoutInput);
  assert.equal(checkout.replayed, false); assert.equal(checkoutReplay.replayed, true); assert.equal(billing.checkoutCalls, 1);
  assert.equal(await rejected(() => createAuthenticatedCheckout(prisma, { ...checkoutInput, returnUrl: "https://app.example.invalid/different" }), /IDEMPOTENCY/u), true);
  const portal = await createAuthenticatedCustomerPortal(prisma, { context: ownerContext, returnUrl: "https://app.example.invalid/plan-y-uso", idempotencyKey: "f4-portal", provider: billing });
  const portalReplay = await createAuthenticatedCustomerPortal(prisma, { context: ownerContext, returnUrl: "https://app.example.invalid/plan-y-uso", idempotencyKey: "f4-portal", provider: billing });
  assert.equal(portal.replayed, false); assert.equal(portalReplay.replayed, true); assert.equal(billing.portalCalls, 1);
  assert.equal(await rejected(() => createAuthenticatedCustomerPortal(prisma, { context: { companyId: companyA, userId: memberId, role: "MEMBER" }, returnUrl: "https://app.example.invalid", idempotencyKey: "member-portal", provider: billing }), /OWNER/u), true);

  const baseTimestamp = 1_785_064_000;
  const matrix: Array<[string, SubscriptionStatus]> = [["trialing", "TRIALING"], ["active", "ACTIVE"], ["past_due", "PAST_DUE"], ["paused", "PAUSED"], ["canceled", "CANCELED"], ["incomplete_expired", "EXPIRED"]];
  for (let index = 0; index < matrix.length; index += 1) {
    const [stripeStatus, localStatus] = matrix[index];
    await sendStripeEvent({ id: `evt-status-${index}`, type: "customer.subscription.updated", created: baseTimestamp + index, status: stripeStatus, cancelAtPeriodEnd: stripeStatus === "active" });
    assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, localStatus);
  }
  const activeEvent = await sendStripeEvent({ id: "evt-active-final", type: "customer.subscription.updated", created: baseTimestamp + 10, status: "active" });
  const replay = await sendStripeEvent({ id: "evt-active-final", type: "customer.subscription.updated", created: baseTimestamp + 10, status: "active" });
  assert.equal(activeEvent.replayed, false); assert.equal(replay.replayed, true);
  const stale = await sendStripeEvent({ id: "evt-stale", type: "customer.subscription.updated", created: baseTimestamp + 5, status: "canceled" });
  assert.equal(stale.billingEvent.status, "IGNORED_STALE"); assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, "ACTIVE");
  const failed = await sendStripeEvent({ id: "evt-payment-failed", type: "invoice.payment_failed", created: baseTimestamp + 20 });
  assert.equal(failed.replayed, false);
  const pastDue = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  assert.equal(pastDue.status, "PAST_DUE"); assert.ok(pastDue.graceEndsAt); assert.equal(pastDue.readOnlyAt?.getTime(), pastDue.graceEndsAt?.getTime());
  assert.equal(await prisma.emailOutbox.count({ where: { companyId: companyA, eventKey: "billing_payment_failed" } }), 1);
  assert.equal(await prisma.task.count({ where: { companyId: companyA, origin: "billing:evt-payment-failed" } }), 1);
  await sendStripeEvent({ id: "evt-payment-paid", type: "invoice.paid", created: baseTimestamp + 30 });
  const paid = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  assert.equal(paid.status, "ACTIVE"); assert.equal(paid.graceEndsAt, null);
  await sendStripeEvent({ id: "evt-cancel-reason", type: "customer.subscription.deleted", created: baseTimestamp + 40, status: "canceled", cancellationReason: "too_expensive" });
  assert.deepEqual(await cancellationMetrics(prisma, companyA), [{ planKey: "PROFESSIONAL", reason: "too_expensive", cohort: "scheduled" }]);
  const reconciliation = await reconcileBillingSubscription(prisma, { companyId: companyA, provider: "stripe", providerSnapshot: { status: "ACTIVE", currentPeriodStart: now.toISOString(), currentPeriodEnd: new Date("2026-08-26T12:00:00Z").toISOString(), cancelAtPeriodEnd: false, planKey: "PROFESSIONAL" } });
  assert.ok(reconciliation.divergenceCount > 0); assert.equal(reconciliation.correctionMode, "AUDIT_ONLY"); assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, "CANCELED");

  const periodStart = new Date("2026-07-01T00:00:00Z"); const periodEnd = new Date("2026-08-01T00:00:00Z");
  for (const metric of ["members", "documents", "ai_actions"]) {
    const recorded = await recordLimitedUsage(prisma, { companyId: companyA, metric, limit: 2, quantity: 1, idempotencyKey: `${metric}-1`, origin: "f4-test", periodStart, periodEnd });
    const usageReplay = await recordLimitedUsage(prisma, { companyId: companyA, metric, limit: 2, quantity: 1, idempotencyKey: `${metric}-1`, origin: "f4-test", periodStart, periodEnd });
    assert.equal(recorded.replayed, false); assert.equal(usageReplay.replayed, true);
    assert.equal(await rejected(() => recordLimitedUsage(prisma, { companyId: companyA, metric, limit: 2, quantity: 2, idempotencyKey: `${metric}-2`, origin: "f4-test", periodStart, periodEnd }), /NO_AUTOMATIC_CHARGE/u), true);
  }

  await prisma.$transaction(async (transaction) => { await queueEmailEvent(transaction, { companyId: companyA, eventKey: "support_update", recipient: "rollback@example.invalid", idempotencyKey: "rollback" }); throw new Error("ROLLBACK_EXPECTED"); }).catch(() => undefined);
  assert.equal(await prisma.emailOutbox.count({ where: { idempotencyKey: "rollback" } }), 0);
  for (let index = 0; index < 10; index += 1) await queueEmailEvent(prisma, { companyId: companyA, eventKey: "demo_requested", recipient: `worker-${index}@example.invalid`, idempotencyKey: `worker-${index}` });
  const [workerOne, workerTwo] = await Promise.all([claimEmailBatch(prisma, { batchSize: 6 }), claimEmailBatch(prisma, { batchSize: 6 })]);
  assert.equal(new Set([...workerOne, ...workerTwo].map((item) => item.id)).size, workerOne.length + workerTwo.length);
  assert.equal(workerOne.length + workerTwo.length >= 10, true);
  const workerProvider = new CountingEmailProvider();
  for (const item of [...workerOne, ...workerTwo]) await processClaimedEmail(prisma, item, workerProvider);

  const verification = await queueEmailEvent(prisma, { companyId: companyA, eventKey: "email_verification", recipient: "member-f4@example.invalid", payload: { userId: memberId }, idempotencyKey: "verification-worker" });
  const verificationClaim = (await claimEmailBatch(prisma, { batchSize: 20 })).find((item) => item.id === verification.id)!;
  await processClaimedEmail(prisma, verificationClaim, workerProvider);
  assert.equal(await prisma.emailVerificationToken.count({ where: { userId: memberId, usedAt: null } }), 1);
  const persistedEmailState = JSON.stringify({ outbox: await prisma.emailOutbox.findUniqueOrThrow({ where: { id: verification.id } }), attempts: await prisma.emailDeliveryAttempt.findMany({ where: { outboxId: verification.id } }), audit: await prisma.auditLog.findMany({ where: { targetId: verification.id } }) });
  assert.doesNotMatch(persistedEmailState, /\/verificar-email\?token=|actionUrl|htmlBody[^n]*http/u);

  const transient = await queueEmailEvent(prisma, { companyId: companyA, eventKey: "support_update", recipient: "transient@example.invalid", idempotencyKey: "transient" });
  const transientProvider = new CountingEmailProvider(1);
  await processClaimedEmail(prisma, (await claimEmailBatch(prisma, { batchSize: 20 })).find((item) => item.id === transient.id)!, transientProvider);
  await prisma.emailOutbox.update({ where: { id: transient.id }, data: { availableAt: new Date(0) } });
  await processClaimedEmail(prisma, (await claimEmailBatch(prisma, { batchSize: 20 })).find((item) => item.id === transient.id)!, transientProvider);
  assert.equal((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: transient.id } })).status, "SENT"); assert.equal(transientProvider.calls, 2);

  const permanent = await queueEmailEvent(prisma, { companyId: companyA, eventKey: "security_alert", recipient: "permanent@example.invalid", idempotencyKey: "permanent" });
  await processClaimedEmail(prisma, (await claimEmailBatch(prisma, { batchSize: 20 })).find((item) => item.id === permanent.id)!, new CountingEmailProvider(10), { maxAttempts: 1 });
  assert.ok((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: permanent.id } })).deadLetteredAt);
  await replayDeadLetter(prisma, { outboxId: permanent.id, companyId: companyA, adminUserId: ownerId });
  assert.equal((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: permanent.id } })).status, "RETRYING");

  const templateFailure = await queueEmailEvent(prisma, { companyId: companyA, eventKey: "alert", recipient: "template@example.invalid", idempotencyKey: "template-failure" });
  await prisma.emailTemplateVersion.update({ where: { templateKey_version: { templateKey: "alert", version: 1 } }, data: { textSource: "{{missing}}", htmlSource: "{{missing}}", allowedVariables: ["missing"] } });
  const noSend = new CountingEmailProvider();
  await processClaimedEmail(prisma, (await claimEmailBatch(prisma, { batchSize: 20 })).find((item) => item.id === templateFailure.id)!, noSend, { maxAttempts: 1 });
  assert.equal(noSend.calls, 0); assert.equal((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: templateFailure.id } })).status, "FAILED");

  const suppressedRecipient = "suppressed@example.invalid";
  await prisma.emailSuppression.create({ data: { companyId: companyA, emailHash: createHash("sha256").update(suppressedRecipient).digest("hex"), reason: "test", source: "f4" } });
  const suppressed = await queueEmailEvent(prisma, { companyId: companyA, eventKey: "support_update", recipient: suppressedRecipient, idempotencyKey: "suppressed" });
  const suppressionProvider = new CountingEmailProvider();
  await processClaimedEmail(prisma, (await claimEmailBatch(prisma, { batchSize: 20 })).find((item) => item.id === suppressed.id)!, suppressionProvider);
  assert.equal(suppressionProvider.calls, 0); assert.equal((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: suppressed.id } })).status, "CANCELLED");

  const sentForWebhook = await prisma.emailOutbox.findFirstOrThrow({ where: { status: "SENT", providerMessageId: { not: null } } });
  const webhookSecret = `whsec_${Buffer.from("f4-resend-webhook-secret-32-bytes!!").toString("base64")}`;
  const webhookId = "resend-event-f4"; const webhookTimestamp = new Date();
  const webhookBody = JSON.stringify({ type: "email.bounced", created_at: webhookTimestamp.toISOString(), data: { email_id: sentForWebhook.providerMessageId, to: [sentForWebhook.recipient] } });
  const signature = new Webhook(webhookSecret).sign(webhookId, webhookTimestamp, webhookBody);
  const resend = await ingestResendWebhook(prisma, { rawBody: webhookBody, id: webhookId, timestamp: Math.floor(webhookTimestamp.getTime() / 1000).toString(), signature, secret: webhookSecret });
  const resendReplay = await ingestResendWebhook(prisma, { rawBody: webhookBody, id: webhookId, timestamp: Math.floor(webhookTimestamp.getTime() / 1000).toString(), signature, secret: webhookSecret });
  assert.equal(resend.replayed, false); assert.equal(resendReplay.replayed, true);
  assert.equal(await prisma.emailSuppression.count({ where: { emailHash: createHash("sha256").update(sentForWebhook.recipient).digest("hex"), active: true } }) > 0, true);
  assert.equal(await rejected(() => ingestResendWebhook(prisma, { rawBody: webhookBody, id: "invalid", timestamp: Math.floor(webhookTimestamp.getTime() / 1000).toString(), signature: "v1,invalid", secret: webhookSecret }), /signature|No matching|Invalid/i), true);

  const mutable = new MutableStorageProvider();
  const storage = new PrivateStorageService(prisma, mutable, "f4-private", "s".repeat(32));
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
  const object = await storage.put({ companyId: companyA, bytes, originalName: "../../Logo <final>.png", mimeType: "image/png", classification: "COMPANY_BRAND", idempotencyKey: "storage-logo" });
  assert.equal(object.safeName, "Logo-final-.png"); assert.equal(object.sizeBytes, BigInt(bytes.byteLength)); assert.equal(object.sha256, createHash("sha256").update(bytes).digest("hex"));
  const authorizedUrl = await storage.authorizeDownload({ companyId: companyA, objectId: object.id, baseUrl: "https://app.example.invalid", expiresInSeconds: 60, now });
  const token = new URL(authorizedUrl).searchParams.get("grant")!;
  assert.equal(storage.verifySignedGrant(token, { expectedObjectId: object.id, now }).companyId, companyA);
  assert.equal(await rejected(() => storage.authorizeDownload({ companyId: companyB, objectId: object.id, baseUrl: "https://app.example.invalid", now }), /not found/i), true);
  assert.equal(await rejected(async () => storage.verifySignedGrant(token, { now: new Date(now.getTime() + 120_000) }), /EXPIRED/u), true);
  assert.deepEqual((await storage.readVerified({ companyId: companyA, objectId: object.id })).bytes, bytes);
  mutable.values.set(`${companyA}/${object.objectKey}`, new TextEncoder().encode("tampered"));
  assert.equal(await rejected(() => storage.readVerified({ companyId: companyA, objectId: object.id }), /INTEGRITY/u), true);

  process.stdout.write(`${JSON.stringify({ ok: true, migrations: migrations[0].count, checkoutProviderCalls: billing.checkoutCalls, portalProviderCalls: billing.portalCalls, stripeStatusMatrix: matrix.length, stripeReplay: replay.replayed, staleIgnored: true, dunningDeduplicated: true, usageNegativeMetrics: 3, emailWorkerDistinctClaims: workerOne.length + workerTwo.length, emailTokenPlaintextPersisted: false, resendReplay: resendReplay.replayed, privateStorageTenantIsolation: true, storageIntegrityTamperDetected: true, externalInput: ["EMAIL-010"] }, null, 2)}\n`);
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
