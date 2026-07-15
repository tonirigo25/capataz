import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { inspect } from "node:util";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const packageRoot = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!packageRoot) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(join(packageRoot, "node_modules", "embedded-postgres", "dist", "index.js")).href
);

const reportRoot = process.env.CAPATAZ_RUNNER_REPORT_DIR ?? join(process.env.TEMP ?? process.cwd(), `capataz-runner-${Date.now()}`);
mkdirSync(reportRoot, { recursive: true });
const childHandleReport = join(reportRoot, "child-active-handles.jsonl");
const runnerReport = join(reportRoot, "runner-report.jsonl");
const testTimeoutMs = Number(process.env.CAPATAZ_RUNNER_TEST_TIMEOUT_MS ?? 120_000);
const handleWatchdogMs = Number(process.env.CAPATAZ_ACTIVE_HANDLE_WATCHDOG_MS ?? 30_000);
const reporterPath = join(process.cwd(), "scripts", "active-handle-reporter.mjs");
const reporterUrl = pathToFileURL(reporterPath).href;
const npmCliPath = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const prismaCliPath = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const diagnosticsEnabled = process.env.CAPATAZ_RUNNER_DIAGNOSTICS === "true";

const password = randomBytes(24).toString("hex");
const port = Number(process.env.CAPATAZ_ALL_TESTS_POSTGRES_PORT ?? 55480);
const pg = new EmbeddedPostgres({
  databaseDir: join(packageRoot, `all-tests-${Date.now()}`),
  user: "postgres",
  password,
  port,
  persistent: true,
});
const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_all?schema=public`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  CAPATAZ_TEST_DATABASE_ISOLATED: "true",
  APP_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
  ...(diagnosticsEnabled ? {
    CAPATAZ_ACTIVE_HANDLE_REPORT_FILE: childHandleReport,
    CAPATAZ_ACTIVE_HANDLE_WATCHDOG_MS: String(handleWatchdogMs),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""}${process.env.NODE_OPTIONS ? " " : ""}--import=${reporterUrl}`
  } : {}),
};
assertIsolatedTestDatabase(env);

function summarizeHandle(handle) {
  const base = { type: handle?.constructor?.name ?? typeof handle };
  if (handle && typeof handle === "object") {
    if ("pid" in handle) base.pid = handle.pid;
    if ("spawnfile" in handle) base.spawnfile = handle.spawnfile;
    if ("spawnargs" in handle) base.spawnargs = handle.spawnargs;
    if ("fd" in handle) base.fd = handle.fd;
    if (typeof handle.address === "function") {
      try { base.address = handle.address(); } catch {}
    }
    if ("remoteAddress" in handle) base.remoteAddress = handle.remoteAddress;
    if ("remotePort" in handle) base.remotePort = handle.remotePort;
    if ("localAddress" in handle) base.localAddress = handle.localAddress;
    if ("localPort" in handle) base.localPort = handle.localPort;
  }
  return base;
}

function activeSnapshot(reason, extra = {}) {
  const payload = {
    at: new Date().toISOString(),
    reason,
    ...extra,
    handles: process._getActiveHandles().map(summarizeHandle),
    requests: process._getActiveRequests().map((request) => ({ type: request?.constructor?.name ?? typeof request, detail: inspect(request, { depth: 1, breakLength: 180 }) }))
  };
  appendFileSync(runnerReport, `${JSON.stringify(payload)}\n`);
  if (diagnosticsEnabled || reason === "test-timeout" || reason === "failed-test") {
    process.stdout.write(`[isolated-tests:handles] ${reason} handles=${payload.handles.length} requests=${payload.requests.length}\n`);
    for (const handle of payload.handles) process.stdout.write(`[isolated-tests:handle] ${JSON.stringify(handle)}\n`);
    for (const request of payload.requests) process.stdout.write(`[isolated-tests:request] ${JSON.stringify(request)}\n`);
  }
  return payload;
}

function runCommand(command, args, commandEnv = env) {
  execFileSync(command, args, { cwd: process.cwd(), env: commandEnv, stdio: "inherit" });
}

function runTest(name, index, total) {
  return new Promise((resolve) => {
    process.stdout.write(`[isolated-tests] ${index + 1}/${total} ${name}\n`);
    const startedAt = Date.now();
    const childEnv = { ...env, CAPATAZ_ACTIVE_HANDLE_LABEL: name };
    const child = spawn(process.execPath, [npmCliPath, "run", name], { cwd: process.cwd(), env: childEnv, shell: false });
    let timedOut = false;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { const text = chunk.toString(); stdout += text; process.stdout.write(text); });
    child.stderr.on("data", (chunk) => { const text = chunk.toString(); stderr += text; process.stderr.write(text); });
    const timeout = setTimeout(() => {
      timedOut = true;
      activeSnapshot("test-timeout", { name, childPid: child.pid, elapsedMs: Date.now() - startedAt });
      try {
        execFileSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore" });
      } catch {
        child.kill("SIGKILL");
      }
    }, testTimeoutMs);
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      const elapsedMs = Date.now() - startedAt;
      if (diagnosticsEnabled) activeSnapshot("after-test", { name, status, signal, elapsedMs, timedOut });
      resolve({ name, ok: status === 0 && !timedOut, status, signal, elapsedMs, timedOut, stdout, stderr });
    });
  });
}

const startedAt = Date.now();
const results = [];
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("capataz_test_all");
  runCommand(process.execPath, [prismaCliPath, "migrate", "deploy"]);
  runCommand("node", ["prisma/seed.js"]);

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const tests = Object.keys(packageJson.scripts).filter((name) => name.startsWith("test:"));
  for (const [index, name] of tests.entries()) {
    const result = await runTest(name, index, tests.length);
    results.push(result);
    if (!result.ok) {
      activeSnapshot("failed-test", { name, status: result.status, signal: result.signal, elapsedMs: result.elapsedMs, timedOut: result.timedOut });
      writeFileSync(join(reportRoot, "failed-test.json"), JSON.stringify({ result, reportRoot, childHandleReport, runnerReport }, null, 2));
      throw new Error(`ISOLATED_TEST_FAILED:${name}`);
    }
  }
  if (diagnosticsEnabled) activeSnapshot("before-pg-stop", { total: tests.length });
  console.log(JSON.stringify({ ok: true, isolated: true, total: tests.length, passed: results.filter((item) => item.ok).length, timeouts: results.filter((item) => item.timedOut).length, elapsedMs: Date.now() - startedAt, reportRoot }));
} finally {
  await pg.stop().catch((error) => {
    appendFileSync(runnerReport, `${JSON.stringify({ at: new Date().toISOString(), reason: "pg-stop-error", message: error?.message })}\n`);
  });
  if (diagnosticsEnabled) activeSnapshot("after-pg-stop", { elapsedMs: Date.now() - startedAt, results: results.length });
}
