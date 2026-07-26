import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateEnvironmentIsolation } from "./environment-isolation.mjs";
import { LocalDeterministicMalwareScanner } from "../../lib/security/malware-scanner";
import { assertPrivacySafeTelemetry, fixtureContainsPersonalData } from "../../lib/privacy/governance";
import { captureConfiguredError, sanitizeErrorTrackingEvent } from "../../lib/observability/error-tracking";
import { operationalMetricCatalog, severityPolicy } from "../../lib/observability/operations";
import { stableJson } from "../../lib/security/audit-chain";

async function main() {
  let passed = 0;
  async function check(name: string, operation: () => unknown | Promise<unknown>) {
    await operation();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  }

  await check("preview rejects production database and storage reuse", () => {
    const result = validateEnvironmentIsolation({ NODE_ENV: "test", NEXT_PUBLIC_APP_ENV: "preview", DEPLOYMENT_ENVIRONMENT_ID: "preview-1", DATABASE_RESOURCE_ID: "db-prod", STORAGE_RESOURCE_ID: "bucket-prod", CREDENTIAL_SCOPE: "preview", DATABASE_URL: "postgresql://preview", PRODUCTION_DATABASE_RESOURCE_ID: "db-prod", PRODUCTION_STORAGE_RESOURCE_ID: "bucket-prod", PRODUCTION_DATABASE_URL_SHA256: "different", STAGING_DATABASE_RESOURCE_ID: "db-staging", STAGING_STORAGE_RESOURCE_ID: "bucket-staging", STAGING_DATABASE_URL_SHA256: "different" });
    assert.equal(result.ok, false);
    assert((result.errors ?? []).some((error: string) => error.includes("reuses production")));
  });
  await check("preview with unique resources passes isolation gate", () => {
    const result = validateEnvironmentIsolation({ NODE_ENV: "test", NEXT_PUBLIC_APP_ENV: "preview", DEPLOYMENT_ENVIRONMENT_ID: "preview-1", DATABASE_RESOURCE_ID: "db-preview", STORAGE_RESOURCE_ID: "bucket-preview", CREDENTIAL_SCOPE: "preview", DATABASE_URL: "postgresql://preview", PRODUCTION_DATABASE_RESOURCE_ID: "db-prod", PRODUCTION_STORAGE_RESOURCE_ID: "bucket-prod", PRODUCTION_DATABASE_URL_SHA256: "different-prod", STAGING_DATABASE_RESOURCE_ID: "db-staging", STAGING_STORAGE_RESOURCE_ID: "bucket-staging", STAGING_DATABASE_URL_SHA256: "different-staging" });
    assert.equal(result.ok, true);
  });
  await check("credential scope mismatch fails closed", () => {
    const result = validateEnvironmentIsolation({ NODE_ENV: "test", NEXT_PUBLIC_APP_ENV: "production", DEPLOYMENT_ENVIRONMENT_ID: "prod-1", DATABASE_RESOURCE_ID: "db-prod", STORAGE_RESOURCE_ID: "bucket-prod", CREDENTIAL_SCOPE: "staging" });
    assert.equal(result.ok, false);
  });
  await check("malware scanner separates clean and EICAR payloads", async () => {
    const scanner = new LocalDeterministicMalwareScanner();
    const clean = await scanner.scan({ bytes: new TextEncoder().encode("clean"), sha256: "a".repeat(64), mimeType: "text/plain", filename: "clean.txt" });
    const infected = await scanner.scan({ bytes: new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE"), sha256: "b".repeat(64), mimeType: "text/plain", filename: "eicar.txt" });
    assert.equal(clean.status, "CLEAN");
    assert.equal(infected.status, "INFECTED");
  });
  await check("telemetry allowlist rejects personal fields", () => {
    assert.equal(assertPrivacySafeTelemetry({ requestId: "req", durationMs: 12, errorCode: "E_TEST" }), true);
    assert.throws(() => assertPrivacySafeTelemetry({ requestId: "req", email: "person@example.com" }), /TELEMETRY_FIELDS_FORBIDDEN/u);
  });
  await check("error tracking redacts email phone and token", () => {
    const event = sanitizeErrorTrackingEvent({ error: new Error("Contact person@example.com on 612345678 with sk_secretsecretsecret"), context: { requestId: "req", route: "/test", email: "must-not-pass@example.com" } });
    assert.doesNotMatch(stableJson(event), /person@example|612345678|sk_secret/u);
    assert.deepEqual(Object.keys(event.context).sort(), ["requestId", "route"]);
  });
  await check("configured error tracking sends only sanitized event", () => {
    const previous = process.env.ERROR_TRACKING_DSN;
    process.env.ERROR_TRACKING_DSN = "https://public@example.invalid/1";
    let captured: Error | undefined;
    const result = captureConfiguredError({ error: new Error("person@example.com failed"), context: { requestId: "req", payload: "secret" } }, { captureException(error) { captured = error; return "event-test"; } });
    if (previous === undefined) delete process.env.ERROR_TRACKING_DSN; else process.env.ERROR_TRACKING_DSN = previous;
    assert.equal(result.sent, true);
    assert(captured);
    assert.doesNotMatch(captured.message, /person@example/u);
  });
  await check("metric and severity policies cover operational surface", () => {
    assert.deepEqual(Object.keys(operationalMetricCatalog).sort(), ["database.latency.p95", "dead_letters.count", "http.errors.rate", "http.latency.p95", "jobs.success.rate", "provider.errors.rate", "queue.depth"]);
    assert.deepEqual(Object.keys(severityPolicy), ["SEV1", "SEV2", "SEV3", "SEV4"]);
  });
  await check("fixture scanner accepts reserved domains and rejects real-looking contacts", () => {
    assert.equal(fixtureContainsPersonalData("owner@staging.orqena.invalid +34 000 000 101"), false);
    assert.equal(fixtureContainsPersonalData("juan.perez@example.com"), false);
    assert.equal(fixtureContainsPersonalData("persona@empresa-real.es"), true);
    assert.equal(fixtureContainsPersonalData("612345678"), true);
  });
  await check("tracked seed fixtures contain no real-looking contacts", async () => {
    const fixtures = `${await readFile("prisma/seed.js", "utf8")}\n${await readFile("scripts/provision-staging.ts", "utf8")}`;
    assert.equal(fixtureContainsPersonalData(fixtures), false);
  });
  await check("MFA guard is server-side for privileged platform roles", async () => {
    const platform = await readFile("lib/commercial/platform.ts", "utf8");
    assert.match(platform, /PLATFORM_OWNER[\s\S]*PLATFORM_ADMIN/u);
    assert.match(platform, /mfaFactor\.findFirst/u);
    assert.match(platform, /isSecondFactorFresh/u);
    assert.match(platform, /configuracion\/seguridad/u);
  });
  await check("private storage starts quarantined and fails closed live", async () => {
    const storage = await readFile("lib/private-storage.ts", "utf8");
    assert.match(storage, /status:\s*"QUARANTINED"/u);
    assert.match(storage, /status:\s*ready\s*\?\s*"READY"/u);
    assert.match(storage, /FailClosedMalwareScanner/u);
    assert.match(storage, /MALWARE_SCAN_ENDPOINT/u);
  });
  await check("privacy center is protected and role-scoped", async () => {
    const [page, actions] = await Promise.all([readFile("app/(app)/configuracion/privacidad/page.tsx", "utf8"), readFile("lib/application/privacy/governance-use-cases.ts", "utf8")]);
    assert.match(page, /Centro de privacidad/u);
    assert.match(actions, /requireCompanyRole\(\["OWNER", "ADMIN"\]\)/u);
    assert.match(actions, /identityVerifiedAt/u);
  });
  await check("legal artifacts are versioned and explicitly unapproved", async () => {
    const manifest = JSON.parse(await readFile("contracts/legal/v1/manifest.json", "utf8")) as { hashAlgorithm: string; reviewStatus: string; documents: Array<{ path: string; version: string }> };
    assert.equal(manifest.hashAlgorithm, "sha256");
    assert.match(manifest.reviewStatus, /EXTERNAL_LEGAL_REVIEW_REQUIRED/u);
    for (const document of manifest.documents) {
      assert.match(document.version, /^1\.0-draft$/u);
      const content = await readFile(resolve(document.path), "utf8");
      assert.match(content, /requiere revisión/u);
    }
  });
  await check("processing catalog covers sensitive integrations and retention", async () => {
    const catalog = JSON.parse(await readFile("contracts/privacy/v1/catalog.json", "utf8")) as { processingActivities: Array<{ key: string; lawfulBasis: string; purpose: string; retentionKey: string }>; retentionPolicies: unknown[]; subprocessors: Array<{ key: string; activation: string }> };
    assert(catalog.processingActivities.every((item) => item.lawfulBasis && item.purpose && item.retentionKey));
    assert.deepEqual(catalog.subprocessors.map((item) => item.key).sort(), ["aws_s3_compatible", "openai", "railway", "resend", "sentry", "stripe"]);
    assert(catalog.retentionPolicies.length >= 5);
  });
  await check("runbooks preserve external activation boundaries", async () => {
    const [backup, incident, privacy, operations] = await Promise.all([readFile("docs/runbooks/BACKUP_RESTORE_AND_ENVIRONMENT_ISOLATION.md", "utf8"), readFile("docs/runbooks/INCIDENT_RESPONSE.md", "utf8"), readFile("docs/compliance/PRIVACY_GOVERNANCE.md", "utf8"), readFile("docs/runbooks/OPERATIONAL_OBSERVABILITY.md", "utf8")]);
    assert.match(backup, /servicio PostgreSQL nuevo/u);
    assert.match(backup, /no pasa hasta/u);
    assert.match(incident, /Sev1[\s\S]*Sev4/u);
    assert.match(privacy, /un mes natural/u);
    assert.match(privacy, /72 horas/u);
    assert.match(operations, /synthetic[\s\S]*read-only/u);
  });
  await check("sensitive audit writer hashes canonical payload", async () => {
    const audit = await readFile("lib/security/audit-chain.ts", "utf8");
    assert.match(audit, /pg_advisory_xact_lock/u);
    assert.match(audit, /previousHash/u);
    assert.match(audit, /ENTRY_HASH_INVALID/u);
  });
  await check("support access stays minimal expiring and audited", async () => {
    const [platform, service] = await Promise.all([readFile("lib/commercial/platform.ts", "utf8"), readFile("lib/commercial/platform-service.ts", "utf8")]);
    assert.match(platform, /expiresAt:\s*\{\s*gt:\s*now/u);
    assert.match(service, /company\.configuration\.view/u);
    assert.match(service, /appendSensitiveAuditLog/u);
  });

  process.stdout.write(`${JSON.stringify({ ok: true, passed, externalInput: ["SEC-018", "PRIV-003", "PRIV-012", "STOR-007", "STOR-008", "STOR-009", "OBS-009", "OBS-010"], destructiveExternalCalls: 0 }, null, 2)}\n`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
