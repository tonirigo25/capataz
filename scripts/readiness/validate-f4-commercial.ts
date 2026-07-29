import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { commercialAccessPolicy, overusePolicy } from "../../lib/commercial/access-policy";
import { controlledLiveEmailEventKeys, validateEmailDomainConfiguration } from "../../lib/email/outbox";
import { getEmailProviderStatus } from "../../lib/email";
import { FakeBillingProvider, FakeEmailProvider, FakeStorageProvider } from "../../lib/platform/providers/fake";
import { runProviderContractSuite } from "../../lib/platform/providers/contract-suite";
import { FakeAiProvider, FakeFiscalProvider, FakeObservabilityProvider } from "../../lib/platform/providers/fake";
import { PrivateStorageService, sanitizeFilename } from "../../lib/private-storage";

async function main() {
  let passed = 0;
  async function check(name: string, operation: () => unknown | Promise<unknown>) {
    await operation();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  }

  await check("subscription status and payment grace matrix", () => {
    const now = new Date("2026-07-26T12:00:00Z");
    assert.equal(commercialAccessPolicy({ status: "ACTIVE", graceEndsAt: null, now }).access, "FULL");
    assert.equal(commercialAccessPolicy({ status: "TRIALING", graceEndsAt: null, now }).access, "FULL");
    assert.equal(commercialAccessPolicy({ status: "PAST_DUE", graceEndsAt: new Date("2026-07-27T00:00:00Z"), now }).access, "FULL");
    assert.equal(commercialAccessPolicy({ status: "PAST_DUE", graceEndsAt: new Date("2026-07-25T00:00:00Z"), now }).access, "READ_ONLY");
    for (const status of ["PAUSED", "CANCELED", "EXPIRED"] as const) assert.equal(commercialAccessPolicy({ status, graceEndsAt: null, now }).access, "READ_ONLY");
  });
  await check("overuse is explicit and never a hidden charge", () => {
    assert.equal(overusePolicy.defaultDecision, "BLOCK");
    assert.equal(overusePolicy.hiddenChargesAllowed, false);
  });
  await check("local email configuration remains non-delivering", () => {
    assert.deepEqual(validateEmailDomainConfiguration({ EMAIL_PROVIDER: "local" }), { ready: true, mode: "local" });
  });
  await check("live email configuration fails closed without domain controls", () => {
    assert.throws(() => validateEmailDomainConfiguration({ EMAIL_PROVIDER: "resend" }), /EMAIL_DOMAIN_CONFIGURATION_INCOMPLETE/u);
  });
  await check("live email configuration requires tracking disabled", () => {
    assert.throws(() => validateEmailDomainConfiguration({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "mail@example.invalid", EMAIL_REPLY_TO: "reply@example.invalid", EMAIL_SENDING_DOMAIN: "mail.example.invalid", RESEND_API_KEY: "test", RESEND_WEBHOOK_SECRET: "test", EMAIL_DKIM_STATUS: "verified", EMAIL_SPF_STATUS: "verified", EMAIL_DMARC_POLICY: "reject", EMAIL_TRACKING_ENABLED: "true" }), /TRACKING/u);
  });
  await check("transactional email accepts monitored DMARC without overstating enforcement", () => {
    assert.deepEqual(validateEmailDomainConfiguration({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "Capataz <mail@updates.example.invalid>", EMAIL_REPLY_TO: "reply@example.invalid", EMAIL_SENDING_DOMAIN: "updates.example.invalid", RESEND_API_KEY: "test", RESEND_WEBHOOK_SECRET: "test", EMAIL_DKIM_STATUS: "verified", EMAIL_SPF_STATUS: "verified", EMAIL_DMARC_POLICY: "none", EMAIL_TRACKING_ENABLED: "false" }), { ready: true, mode: "resend" });
  });
  await check("EMAIL_LIVE_ENABLED is the real outbound kill switch", () => {
    const credentials = { NODE_ENV: "production", NEXT_PUBLIC_APP_ENV: "production", EMAIL_FROM: "sender@example.invalid", RESEND_API_KEY: "synthetic" } as NodeJS.ProcessEnv;
    assert.equal(getEmailProviderStatus({ ...credentials, EMAIL_LIVE_ENABLED: "false" }), "missing");
    assert.equal(getEmailProviderStatus({ ...credentials, EMAIL_LIVE_ENABLED: "true" }), "resend");
  });
  await check("safe filename removes traversal and markup", () => {
    assert.equal(sanitizeFilename("../../Mi <logo> final.png"), "Mi-logo-final.png");
  });
  await check("signed storage grant rejects tamper, wrong object and expiry", () => {
    const service = new PrivateStorageService({} as never, new FakeStorageProvider(), "test-private", "a".repeat(32));
    const now = new Date("2026-07-26T12:00:00Z");
    const token = service.createSignedGrant({ companyId: "company-a", objectId: "object-a", expiresInSeconds: 60, now });
    assert.equal(service.verifySignedGrant(token, { expectedObjectId: "object-a", now }).companyId, "company-a");
    assert.throws(() => service.verifySignedGrant(`${token}x`, { now }), /INVALID/u);
    assert.throws(() => service.verifySignedGrant(token, { expectedObjectId: "object-b", now }), /MISMATCH/u);
    assert.throws(() => service.verifySignedGrant(token, { now: new Date("2026-07-26T12:02:00Z") }), /EXPIRED/u);
  });
  await check("fake billing, email and storage providers satisfy shared contracts", async () => {
    await runProviderContractSuite({ billing: new FakeBillingProvider(), email: new FakeEmailProvider(), storage: new FakeStorageProvider(), ai: new FakeAiProvider(), fiscal: new FakeFiscalProvider(), observability: new FakeObservabilityProvider() });
  });
  await check("settings no longer accepts arbitrary logo or seal URLs", async () => {
    const [settings, page, chat, invoicePdf, budgetPdf] = await Promise.all([
      readFile("lib/application/company/settings-use-cases.ts", "utf8"), readFile("app/(app)/configuracion/page.tsx", "utf8"),
      readFile("components/capataz-chat.tsx", "utf8"),
      readFile("app/(app)/dinero/[id]/pdf/route.ts", "utf8"), readFile("app/(app)/presupuestos/[id]/pdf/route.ts", "utf8"),
    ]);
    assert.doesNotMatch(settings, /formData,\s*["'](?:logoUrl|selloUrl)/u);
    assert.doesNotMatch(page, /name=["'](?:logoUrl|selloUrl)/u);
    assert.doesNotMatch(chat, /name=["'](?:logoUrl|selloUrl)/u);
    assert.doesNotMatch(`${invoicePdf}${budgetPdf}`, /logoUrl|sealUrl/u);
  });
  await check("auth actions enqueue tokens instead of sending directly", async () => {
    const auth = await readFile("lib/application/auth/auth-use-cases.ts", "utf8");
    assert.match(auth, /eventKey:\s*["']email_verification/u);
    assert.match(auth, /eventKey:\s*["']password_reset/u);
    assert.doesNotMatch(auth, /sendVerificationEmail|sendPasswordResetEmail|rawToken/u);
  });
  await check("worker uses database locking and stores no rendered action body", async () => {
    const outbox = await readFile("lib/email/outbox.ts", "utf8");
    assert.match(outbox, /FOR UPDATE SKIP LOCKED/u);
    assert.match(outbox, /htmlBody:\s*null/u);
    assert.match(outbox, /textBody:\s*null/u);
    assert.match(outbox, /deriveActionToken/u);
    assert.match(outbox, /status" = 'PROCESSING'[\s\S]*availableAt/u);
    assert.match(outbox, /EMAIL_IDEMPOTENCY_KEY_REQUIRED/u);
  });
  await check("contact email is queued and delivery is webhook-confirmed", async () => {
    const [contact, outbox, provider, worker] = await Promise.all([
      readFile("app/api/marketing/contact/route.ts", "utf8"),
      readFile("lib/email/outbox.ts", "utf8"),
      readFile("lib/platform/providers/production.ts", "utf8"),
      readFile("app/api/jobs/email-outbox/route.ts", "utf8"),
    ]);
    assert.match(contact, /eventKey:\s*["']contact_requested/u);
    assert.match(contact, /delivery:\s*["']queued/u);
    assert.doesNotMatch(contact, /sendContactNotification|marketing\.contact\.delivered/u);
    assert.match(outbox, /eventType === ["']email\.delivered["'][\s\S]*marketing\.contact\.delivered/u);
    assert.match(provider, /replyTo/u);
    assert.doesNotMatch(provider, /reply_to/u);
    assert.match(worker, /EMAIL_LIVE_ENABLED[\s\S]*const provider = getEmailDeliveryProvider\(\)[\s\S]*claimEmailBatch\(prisma, \{ batchSize: 50, eventKeys: controlledLiveEmailEventKeys \}\)/u);
  });
  await check("controlled live worker only admits recovery, invitation and contact events", async () => {
    assert.deepEqual([...controlledLiveEmailEventKeys], [
      "employee_invited", "employee_accepted", "owner_approval_requested", "employee_approved", "employee_rejected", "invitation_revoked", "invitation_expiring",
      "email_verification", "password_reset", "password_changed", "contact_requested",
    ]);
    for (const eventKey of ["billing_payment_failed", "support_update", "security_alert", "alert", "demo_requested", "profile_changed", "permissions_changed", "membership_suspended", "membership_reactivated"]) {
      assert.equal((controlledLiveEmailEventKeys as readonly string[]).includes(eventKey), false);
    }
    const smoke = await readFile("scripts/readiness/validate-email-live-smoke.ts", "utf8");
    assert.match(smoke, /eventKey:\s*["']password_changed["']/u);
    assert.match(smoke, /claimEmailItem\([\s\S]*eventKeys:\s*controlledLiveEmailEventKeys/u);
    assert.doesNotMatch(smoke, /eventKey:\s*["']support_update["']/u);
    const outbox = await readFile("lib/email/outbox.ts", "utf8");
    assert.match(outbox, /provider\.mode === ["']live["'] \? controlledLiveEmailEventKeys : undefined/u);
  });
  await check("membership notification keys include tenant mutation and access version", async () => {
    const membership = await readFile("lib/application/company/membership-use-cases.ts", "utf8");
    assert.match(membership, /membership-email:\$\{input\.companyId\}:\$\{input\.membershipId\}:\$\{input\.mutation\}:\$\{input\.eventKey\}:v\$\{input\.accessVersion\}/u);
    for (const mutation of ["profile", "package", "scope", "state"]) assert.match(membership, new RegExp(`mutation: ["']${mutation}["'][\\s\\S]{0,160}accessVersion: mutation\\.accessVersion`, "u"));
  });
  await check("password changes enqueue an idempotent security notice", async () => {
    const [auth, outbox] = await Promise.all([
      readFile("lib/application/auth/auth-use-cases.ts", "utf8"),
      readFile("lib/email/outbox.ts", "utf8"),
    ]);
    assert.match(auth, /eventKey:\s*["']password_changed/u);
    assert.match(auth, /idempotencyKey:\s*`password-changed:/u);
    assert.match(outbox, /password_changed:\s*staticTemplate/u);
  });

  process.stdout.write(`${JSON.stringify({ ok: true, passed, externalInput: ["EMAIL-010"], hiddenCharges: false, publicAssetUrlsAccepted: false }, null, 2)}\n`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
