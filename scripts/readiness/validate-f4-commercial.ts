import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { commercialAccessPolicy, overusePolicy } from "../../lib/commercial/access-policy";
import { validateEmailDomainConfiguration } from "../../lib/email/outbox";
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
  });

  process.stdout.write(`${JSON.stringify({ ok: true, passed, externalInput: ["EMAIL-010"], hiddenCharges: false, publicAssetUrlsAccepted: false }, null, 2)}\n`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
