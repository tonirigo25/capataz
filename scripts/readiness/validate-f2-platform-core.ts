import { createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { decryptCredential, encryptCredential, type EncryptionKeyring } from "../../lib/platform/encryption";
import { verifyResendWebhook, verifyStripeWebhook } from "../../lib/platform/webhooks";
import { FakeAiProvider, FakeBillingProvider, FakeEmailProvider, FakeFiscalProvider, FakeObservabilityProvider, FakeStorageProvider } from "../../lib/platform/providers/fake";
import { log } from "../../lib/observability/logger";
import { validateBrowserRequest } from "../../lib/security/browser-request";

const checks: Array<{ name: string; pass: boolean }> = [];
function check(name: string, condition: unknown) {
  if (!condition) throw new Error(`F2_CHECK_FAILED:${name}`);
  checks.push({ name, pass: true });
}

async function main() {
const keyring: EncryptionKeyring = { activeVersion: "v1", keys: new Map([["v1", randomBytes(32)]]) };
const encrypted = encryptCredential("tenant-secret", "company-1:stripe", keyring);
check("aes-gcm-roundtrip", decryptCredential(encrypted, "company-1:stripe", keyring) === "tenant-secret");
let wrongAadRejected = false;
try { decryptCredential(encrypted, "company-2:stripe", keyring); } catch { wrongAadRejected = true; }
check("aes-gcm-tenant-aad", wrongAadRejected);

const rawBody = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
const timestamp = Math.floor(Date.now() / 1000);
const stripeSecret = "whsec_test";
const stripeSignature = createHmac("sha256", stripeSecret).update(`${timestamp}.${rawBody}`).digest("hex");
check("stripe-valid-signature", verifyStripeWebhook({ rawBody, signatureHeader: `t=${timestamp},v1=${stripeSignature}`, secret: stripeSecret }));
let stripeTamperRejected = false;
try { verifyStripeWebhook({ rawBody: `${rawBody}x`, signatureHeader: `t=${timestamp},v1=${stripeSignature}`, secret: stripeSecret }); } catch { stripeTamperRejected = true; }
check("stripe-tamper-rejected", stripeTamperRejected);

const resendId = "msg_f2_validation";
const resendKey = randomBytes(32);
const resendSecret = `whsec_${resendKey.toString("base64")}`;
const resendSignature = createHmac("sha256", resendKey).update(`${resendId}.${timestamp}.${rawBody}`).digest("base64");
const resendEvent = verifyResendWebhook({ rawBody, id: resendId, timestamp: String(timestamp), signature: `v1,${resendSignature}`, secret: resendSecret });
check("resend-standard-webhook", Boolean(resendEvent));

const billing = await new FakeBillingProvider().createCheckout({ companyId: "c1", priceKey: "starter", returnUrl: "https://example.invalid/return", idempotencyKey: "billing-1" });
const email = await new FakeEmailProvider().send({ recipient: "test@example.invalid", subject: "Test", text: "Body", idempotencyKey: "email-1" });
const storage = new FakeStorageProvider();
const stored = await storage.put({ companyId: "c1", objectKey: "object", bytes: new Uint8Array([1, 2, 3]), contentType: "application/octet-stream", idempotencyKey: "storage-1" });
check("provider-billing-contract", billing.mode === "fake" && billing.idempotencyKey === "billing-1");
check("provider-email-contract", email.mode === "fake" && email.idempotencyKey === "email-1");
check("provider-storage-contract", stored.sha256.length === 64 && (await storage.get({ companyId: "c1", objectKey: "object" })).length === 3);
check("provider-ai-contract", (await new FakeAiProvider().complete({ companyId: "c1", purpose: "test", promptVersion: "v1", input: "input", idempotencyKey: "ai-1", store: false })).mode === "fake");
check("provider-fiscal-contract", (await new FakeFiscalProvider().transmit({ companyId: "c1", fiscalDocumentId: "f1", artifactHash: "a".repeat(64), idempotencyKey: "fiscal-1" })).mode === "fake");
const observability = new FakeObservabilityProvider();
await observability.record({ event: "test", requestId: "request-1", fields: { count: 1 } });
check("provider-observability-contract", observability.events.length === 1);

const originalInfo = console.info;
let logLine = "";
console.info = (value?: unknown) => { logLine = String(value ?? ""); };
try { log("info", "pii_scan", { operation: "person@example.invalid", payload: "sk-forbidden" }); } finally { console.info = originalInfo; }
check("logger-pii-safe", !logLine.includes("person@example.invalid") && !logLine.includes("sk-forbidden") && logLine.includes("[redacted]"));

const envSnapshot = { NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV, APP_BASE_URL: process.env.APP_BASE_URL, TRUSTED_BROWSER_ORIGINS: process.env.TRUSTED_BROWSER_ORIGINS };
process.env.NEXT_PUBLIC_APP_ENV = "production";
process.env.APP_BASE_URL = "https://app.example.invalid";
delete process.env.TRUSTED_BROWSER_ORIGINS;
try {
  const sameSite = new NextRequest("https://app.example.invalid/api/demo", { method: "POST", headers: { origin: "https://app.example.invalid", host: "app.example.invalid", "sec-fetch-site": "same-origin" } });
  const crossSite = new NextRequest("https://app.example.invalid/api/demo", { method: "POST", headers: { origin: "https://evil.example", host: "app.example.invalid", "sec-fetch-site": "cross-site" } });
  check("browser-same-origin", validateBrowserRequest(sameSite).allowed);
  check("browser-cross-site-403", !validateBrowserRequest(crossSite).allowed);
} finally {
  restore("NEXT_PUBLIC_APP_ENV", envSnapshot.NEXT_PUBLIC_APP_ENV);
  restore("APP_BASE_URL", envSnapshot.APP_BASE_URL);
  restore("TRUSTED_BROWSER_ORIGINS", envSnapshot.TRUSTED_BROWSER_ORIGINS);
}

const files = await Promise.all([
  "middleware.ts", "next.config.ts", "railway.json", "instrumentation.ts", "instrumentation-client.ts",
  "lib/platform/idempotency.ts", "lib/platform/outbox.ts", "lib/commercial/platform-service.ts", "app/(app)/plataforma/actions.ts",
].map(async (path) => [path, await readFile(path, "utf8")] as const));
const content = new Map(files);
check("request-id-middleware", content.get("middleware.ts")?.includes("x-request-id"));
check("csp-report-only", content.get("next.config.ts")?.includes("Content-Security-Policy-Report-Only"));
check("railway-ready-path", content.get("railway.json")?.includes('"healthcheckPath": "/api/health/ready"'));
check("server-client-instrumentation", content.get("instrumentation.ts")?.includes("registerOpenTelemetry") && content.get("instrumentation-client.ts")?.includes("client_observability_started"));
check("transactional-outbox", content.get("lib/platform/outbox.ts")?.includes("FOR UPDATE SKIP LOCKED"));
check("reusable-idempotency", content.get("lib/platform/idempotency.ts")?.includes("pg_advisory_xact_lock"));
check("thin-platform-actions", !content.get("app/(app)/plataforma/actions.ts")?.includes("prisma.") && content.get("lib/commercial/platform-service.ts")?.includes("prisma.$transaction"));

console.log(JSON.stringify({ ok: true, checks: checks.length }, null, 2));
}

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
