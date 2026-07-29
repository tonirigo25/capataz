import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  APP_HOST,
  MARKETING_HOST,
  resolveHostRouting,
} from "../lib/host-routing";
import {
  LocalDocumentStorage,
  assertCompanyObjectKey,
  buildDocumentObjectKey,
  expirySeconds,
  getDocumentStorage,
} from "../lib/document-storage";
import {
  TestEmailProvider,
  applicationLink,
  createEmailProvider,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../lib/email";
import { STRIPE_WEBHOOK_EVENTS, isBillingEnabled, stripePriceForPlan, stripeTrialDays } from "../lib/billing/config";
import { paidAccessState } from "../lib/billing/service";
import { getStripeClient, requireStripeWebhookSecret } from "../lib/billing/stripe-client";
import { parseServerConfig } from "../lib/config/server";
import { validateBrowserRequest } from "../lib/security/browser-request";
import { NextRequest } from "next/server";

let cases = 0;
function equal<T>(actual: T, expected: T, label: string) {
  assert.deepEqual(actual, expected, label);
  cases += 1;
}
function throws(run: () => unknown, pattern: RegExp, label: string) {
  assert.throws(run, pattern, label);
  cases += 1;
}

async function validateHosts() {
  const sessionSource = readFileSync("lib/auth/session.ts", "utf8");
  const pwaSource = readFileSync("app/pwa-register.tsx", "utf8");
  const middlewareSource = readFileSync("middleware.ts", "utf8");
  const playwrightSource = readFileSync("playwright.config.ts", "utf8");
  equal(resolveHostRouting({ host: "www.orqenatech.com", pathname: "/precios", search: "?ref=1", nodeEnv: "production" }), {
    action: "redirect",
    location: "https://orqenatech.com/precios?ref=1",
    status: 301,
  }, "www canonical");
  equal(resolveHostRouting({ host: "orqena.es", pathname: "/contacto", search: "?ref=2", nodeEnv: "production" }), {
    action: "redirect",
    location: "https://orqenatech.com/contacto?ref=2",
    status: 301,
  }, "defensive domain preserves path and query");
  equal(resolveHostRouting({ host: MARKETING_HOST, pathname: "/api/private", nodeEnv: "production" }).action, "reject", "marketing blocks app API");
  equal(resolveHostRouting({ host: MARKETING_HOST, pathname: "/precios", nodeEnv: "production" }), {
    action: "rewrite",
    pathname: "/marketing-internal/precios",
    site: "marketing",
  }, "marketing is internally isolated");
  equal(resolveHostRouting({ host: APP_HOST, pathname: "/precios", nodeEnv: "production" }), {
    action: "redirect",
    location: "https://orqenatech.com/precios",
    status: 307,
  }, "app redirects public marketing route");
  equal(resolveHostRouting({ host: APP_HOST, pathname: "/capataz", nodeEnv: "production" }).action, "pass", "app keeps private Capataz");
  equal(resolveHostRouting({ host: "attacker.example", pathname: "/", nodeEnv: "production" }).action, "reject", "unknown production host fails closed");
  equal(resolveHostRouting({ host: "preview.up.railway.app", pathname: "/api/health", nodeEnv: "production" }).action, "pass", "Railway health remains reachable");
  equal(resolveHostRouting({ host: "orqena-review-web.railway.internal", pathname: "/api/health/live", nodeEnv: "production" }).action, "pass", "Railway internal liveness remains reachable");
  equal(resolveHostRouting({ host: "orqena-review-web.railway.internal", pathname: "/api/health/ready", nodeEnv: "production" }).action, "pass", "Railway internal readiness remains reachable");
  const previousAppEnvironment = process.env.NEXT_PUBLIC_APP_ENV;
  const previousAppBaseUrl = process.env.APP_BASE_URL;
  process.env.NEXT_PUBLIC_APP_ENV = "production";
  process.env.APP_BASE_URL = "https://app.orqenatech.com";
  try {
    equal(validateBrowserRequest(new NextRequest("https://orqena-review-web.railway.internal/api/health/ready", {
      headers: { host: "orqena-review-web.railway.internal" },
    })), { allowed: true }, "browser security permits Railway internal readiness");
    equal(validateBrowserRequest(new NextRequest("https://attacker.example/api/private", {
      headers: { host: "attacker.example" },
    })), { allowed: false, code: "HOST_NOT_ALLOWED" }, "browser security still rejects unknown production hosts");
  } finally {
    if (previousAppEnvironment === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
    else process.env.NEXT_PUBLIC_APP_ENV = previousAppEnvironment;
    if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previousAppBaseUrl;
  }
  equal(resolveHostRouting({ host: "orqena-review-web-review.up.railway.app", pathname: "/precios", nodeEnv: "production" }), {
    action: "rewrite",
    pathname: "/marketing-internal/precios",
    site: "marketing",
  }, "Railway validation host serves launch marketing routes");
  equal(resolveHostRouting({ host: "orqena-review-web-review.up.railway.app", pathname: "/capataz", nodeEnv: "production" }), {
    action: "rewrite",
    pathname: "/marketing-internal/capataz",
    site: "marketing",
  }, "Railway validation host serves the public Capataz page without a session");
  equal(resolveHostRouting({ host: "orqena-review-web-review.up.railway.app", pathname: "/capataz", nodeEnv: "production", hasSessionCookie: true }), {
    action: "pass",
    site: "app",
  }, "Railway validation host preserves authenticated Capataz");
  assert.doesNotMatch(sessionSource, /domain\s*:/i, "session cookies remain host-only");
  assert.match(sessionSource, /sameSite:\s*"lax"/, "session cookies keep SameSite protection");
  assert.match(pwaSource, /hostname === appHostname \|\| platformHostname/, "private service worker is host-gated");
  assert.match(middlewareSource, /!process\.env\.RAILWAY_ENVIRONMENT_ID/, "local production-build routing is forbidden on Railway");
  assert.match(middlewareSource, /nodeEnv:\s*isLocalProductionBuild\(\)\s*\?\s*"development"/, "local production build preserves platform routing");
  assert.match(playwrightSource, /url:\s*`\$\{baseURL\}\/api\/health`/, "Playwright waits on the host-agnostic health endpoint");
  cases += 5;
}

async function validateDocuments() {
  const bytes = Buffer.from("tenant-safe-document");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const input = {
    companyId: "company_A",
    category: "facturas",
    documentId: "document_A",
    filename: "../../Factura Julio.PDF",
    mimeType: "application/pdf",
    checksum,
  };
  equal(buildDocumentObjectKey(input), "companies/company_A/facturas/document_A/factura-julio.pdf", "R2 key is tenant scoped and normalized");
  throws(() => assertCompanyObjectKey("company_B", buildDocumentObjectKey(input)), /TENANT_FORBIDDEN/, "cross-tenant object access fails");
  equal(expirySeconds(5), 60, "presign lower bound");
  equal(expirySeconds(600), 600, "presign default");
  equal(expirySeconds(5_000), 900, "presign upper bound");
  throws(() => getDocumentStorage({ NODE_ENV: "production" }), /DOCUMENT_STORAGE_NOT_CONFIGURED/, "production storage fails closed");

  const root = await mkdtemp(join(tmpdir(), "orqena-launch-storage-"));
  try {
    const storage = new LocalDocumentStorage(root);
    const stored = await storage.put({ ...input, bytes });
    equal(await storage.get({ companyId: input.companyId, storageKey: stored.storageKey }), bytes, "local provider roundtrip");
    await assert.rejects(
      storage.put({ ...input, checksum: "0".repeat(64), bytes }),
      /DOCUMENT_CHECKSUM_MISMATCH/,
      "checksum mismatch fails closed",
    );
    cases += 1;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function validateEmail() {
  throws(
    () => createEmailProvider({ NODE_ENV: "production", NEXT_PUBLIC_APP_ENV: "production" }),
    /EMAIL_PROVIDER_NOT_CONFIGURED/,
    "production email fails closed",
  );
  equal(createEmailProvider({ NODE_ENV: "test" }).name, "local", "tests never send externally");
  equal(applicationLink("/login"), "https://app.orqenatech.com/login", "absolute application link");
  const provider = new TestEmailProvider();
  await sendVerificationEmail("owner@example.test", "verify-token", provider);
  await sendPasswordResetEmail("owner@example.test", "reset-token", provider);
  equal(provider.messages.length, 2, "transactional messages captured by fake");
  assert.match(provider.messages[0]?.text ?? "", /https:\/\/app\.orqenatech\.com\/verificar-email\?token=verify-token/);
  assert.match(provider.messages[1]?.html ?? "", /https:\/\/app\.orqenatech\.com\/restablecer-contrasena\?token=reset-token/);
  cases += 2;
}

async function validateBilling() {
  const previous = {
    enabled: process.env.BILLING_ENABLED,
    grace: process.env.BILLING_PAST_DUE_GRACE_DAYS,
  };
  try {
    process.env.BILLING_ENABLED = "false";
    equal(isBillingEnabled(), false, "billing defaults fail closed");
    equal(paidAccessState(null).reason, "billing_disabled", "disabled billing preserves basic access");
    process.env.BILLING_ENABLED = "true";
    process.env.BILLING_PAST_DUE_GRACE_DAYS = "7";
    const now = new Date("2026-07-28T00:00:00.000Z");
    equal(paidAccessState({ status: "ACTIVE", currentPeriodEnd: now }, now).paidAccess, true, "active subscription");
    equal(paidAccessState({ status: "PAST_DUE", currentPeriodEnd: new Date("2026-07-25T00:00:00.000Z") }, now).reason, "past_due_grace", "past due grace");
    equal(paidAccessState({ status: "PAST_DUE", currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z") }, now).reason, "past_due_expired", "past due expiry");
    equal(paidAccessState({ status: "CANCELED", currentPeriodEnd: now }, now).basicAccess, true, "inactive subscription never blocks basics");
    throws(() => stripePriceForPlan("PROFESSIONAL", { NODE_ENV: "test" }), /STRIPE_PRICE_PRO/, "missing price is explicit");
    throws(() => getStripeClient({ NODE_ENV: "test", STRIPE_SECRET_KEY: ["sk", "live", "forbidden"].join("_") }), /LIVE_KEY_FORBIDDEN/, "live Stripe keys are forbidden");
    throws(() => requireStripeWebhookSecret({ NODE_ENV: "test" }), /STRIPE_WEBHOOK_SECRET/, "missing webhook secret is explicit");
    equal(stripeTrialDays({ NODE_ENV: "test", STRIPE_TRIAL_DAYS: "14" }), 14, "optional Stripe trial is bounded");
    throws(() => stripeTrialDays({ NODE_ENV: "test", STRIPE_TRIAL_DAYS: "365" }), /BILLING_TRIAL_DAYS_INVALID/, "invalid trial is rejected");
    equal(STRIPE_WEBHOOK_EVENTS.length, 9, "documented Stripe event set");
  } finally {
    if (previous.enabled === undefined) delete process.env.BILLING_ENABLED; else process.env.BILLING_ENABLED = previous.enabled;
    if (previous.grace === undefined) delete process.env.BILLING_PAST_DUE_GRACE_DAYS; else process.env.BILLING_PAST_DUE_GRACE_DAYS = previous.grace;
  }
}

async function validateProductionStartupGates() {
  const productionEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_PUBLIC_APP_ENV: "production",
    APP_ENV: "production",
    APP_BASE_URL: "https://app.orqenatech.com",
    DATABASE_URL: "postgresql://runtime-check.invalid/orqena",
    STORAGE_PROVIDER: "s3",
    S3_REGION: "auto",
    S3_BUCKET: "orqena-private",
    S3_ACCESS_KEY_ID: "runtime-check-access",
    S3_SECRET_ACCESS_KEY: "runtime-check-secret",
    STORAGE_SIGNING_SECRET: "runtime-check-signing-secret-at-least-32-characters",
    APP_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 7).toString("base64")}`,
    APP_ACTIVE_KEY_VERSION: "v1",
    JOB_RUNNER_SECRET: "runtime-check-job-secret",
    AI_ENABLED: "false",
    AI_PROVIDER_MODE: "off",
    BILLING_ENABLED: "false",
    EMAIL_LIVE_ENABLED: "false",
    FISCAL_ENGINE_ENABLED: "false",
    PUBLIC_INDEXING_ENABLED: "false",
    ORQENA_PUBLIC_REGISTRATION_ENABLED: "false",
    DEPLOYMENT_ENVIRONMENT_ID: "production-runtime-check",
    DATABASE_RESOURCE_ID: "production-database-check",
    STORAGE_RESOURCE_ID: "production-storage-check",
    CREDENTIAL_SCOPE: "production",
  };
  delete productionEnvironment.LEGAL_ENTITY_NAME;
  delete productionEnvironment.LEGAL_TAX_ID;
  delete productionEnvironment.MALWARE_SCAN_ENDPOINT;
  delete productionEnvironment.MALWARE_SCAN_AUTHORIZATION;

  equal(parseServerConfig(productionEnvironment, "ready").environment, "production", "private runtime starts before legal activation");
  const runtimeResult = JSON.parse(execFileSync(process.execPath, ["scripts/readiness/validate-runtime-config.mjs", "ready"], {
    cwd: process.cwd(),
    env: productionEnvironment,
    encoding: "utf8",
  }));
  equal(runtimeResult.ok, true, "missing live malware provider remains fail-closed per operation");
}

async function main() {
  await validateHosts();
  await validateDocuments();
  await validateEmail();
  await validateBilling();
  await validateProductionStartupGates();
  console.log(`[launch-platform] OK ${cases} casos`);
}

main().catch((error) => {
  console.error("[launch-platform] FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
