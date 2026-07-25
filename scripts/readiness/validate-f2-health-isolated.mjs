import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { availableLoopbackPort, installCleanupSignalHandlers, startIsolatedPostgres, stopIsolatedPostgres, terminateOwnedProcess } from "../isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "../test-database-safety.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const password = randomBytes(24).toString("hex");
const internalSecret = randomBytes(32).toString("hex");
const databaseName = "capataz_test_readiness_f2_health";
const appPort = await availableLoopbackPort();
let runtime;
let child;
const removeSignalHandlers = installCleanupSignalHandlers(async () => {
  terminateOwnedProcess(child);
  await stopIsolatedPostgres(runtime).catch(() => undefined);
});

try {
  runtime = await startIsolatedPostgres({ EmbeddedPostgres, root, suite: "readiness-f2-health", password, postgresFlags: ["-c", "io_method=sync"] });
  await runtime.pg.createDatabase(databaseName);
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/${databaseName}?schema=public`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, CAPATAZ_TEST_DATABASE_ISOLATED: "true", APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test", NEXT_PUBLIC_APP_MODE: "platform", NEXT_PUBLIC_WEB_BASE_URL: `http://127.0.0.1:${appPort}`, APP_BASE_URL: `http://127.0.0.1:${appPort}`, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(appPort), JOB_RUNNER_SECRET: internalSecret, GIT_COMMIT_SHA: "f2-local-validation", RAILWAY_DEPLOYMENT_ID: "f2-local" };
  assertIsolatedTestDatabase(env);
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "pipe" });
  child = spawn(process.execPath, ["scripts/start-standalone.mjs"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${appPort}`;
  await waitForReady(baseUrl, () => output);

  const live = await request(`${baseUrl}/api/health/live`);
  const ready = await request(`${baseUrl}/api/health/ready`);
  const legacy = await request(`${baseUrl}/api/status`);
  expect(live.status === 200 && live.json?.ok === true && Object.keys(live.json).length === 1, "LIVE_NOT_MINIMAL");
  expect(ready.status === 200 && ready.json?.ok === true && Object.keys(ready.json).length === 1, "READY_NOT_MINIMAL");
  expect(legacy.status === 200 && legacy.json?.ok === true && Object.keys(legacy.json).length === 1, "LEGACY_STATUS_NOT_MINIMAL");
  expect(Boolean(ready.headers["x-request-id"]), "REQUEST_ID_MISSING");
  expect(String(ready.headers["content-security-policy-report-only"] ?? "").includes("report-uri /api/security/csp-report"), "CSP_REPORT_ONLY_MISSING");
  expect(ready.headers["x-content-type-options"] === "nosniff" && ready.headers["x-frame-options"] === "DENY", "SECURITY_HEADERS_MISSING");

  const hidden = await request(`${baseUrl}/api/internal/status`);
  expect(hidden.status === 404 && !hidden.text.includes("migration"), "INTERNAL_STATUS_EXPOSED");
  const internal = await request(`${baseUrl}/api/internal/status`, { headers: { authorization: `Bearer ${internalSecret}` } });
  expect(internal.status === 200 && internal.json?.release?.migrationHead === "20260725200000_readiness_f2_transactional_outbox" && internal.json?.release?.releaseSha === "f2-local-validation", "INTERNAL_STATUS_INCOMPLETE");
  expect(!internal.text.includes(internalSecret) && !internal.text.includes(databaseUrl), "INTERNAL_STATUS_SECRET_LEAK");

  const before = await demoCount(databaseUrl);
  const crossSite = await request(`${baseUrl}/api/demo-requests`, { method: "POST", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", "content-type": "application/json" }, body: JSON.stringify({ email: "cross@example.invalid", displayName: "Cross", companyName: "Cross", consent: true }) });
  const after = await demoCount(databaseUrl);
  expect(crossSite.status === 403 && before === after, "CROSS_SITE_MUTATION_NOT_BLOCKED");

  console.log(JSON.stringify({ ok: true, health: ["live", "ready", "legacy-minimal"], internalProtected: true, releaseSha: internal.json.release.releaseSha, migrationHead: internal.json.release.migrationHead, requestId: true, securityHeaders: true, crossSiteStatus: crossSite.status, crossSiteWrites: after - before }, null, 2));
} finally {
  removeSignalHandlers();
  terminateOwnedProcess(child);
  await stopIsolatedPostgres(runtime);
}

async function waitForReady(baseUrl, output) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try { if ((await request(`${baseUrl}/api/health/ready`)).status === 200) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`SERVER_NOT_READY\n${output().slice(-3000)}`);
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = options.body ? Buffer.from(options.body) : undefined;
    const req = http.request({ hostname: target.hostname, port: target.port, path: `${target.pathname}${target.search}`, method: options.method ?? "GET", headers: { ...options.headers, ...(body ? { "content-length": body.length } : {}) }, timeout: 5_000 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json;
        try { json = JSON.parse(text); } catch { /* non-json */ }
        resolve({ status: response.statusCode, headers: response.headers, text, json });
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function demoCount(databaseUrl) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try { return await prisma.demoRequest.count(); } finally { await prisma.$disconnect(); }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
