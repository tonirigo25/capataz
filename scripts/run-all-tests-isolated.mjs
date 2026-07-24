import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { inspect } from "node:util";
import {
  availableLoopbackPort,
  installCleanupSignalHandlers,
  startIsolatedPostgres,
  stopIsolatedPostgres,
  terminateOwnedProcess,
} from "./isolated-postgres-runtime.mjs";
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
const testTimeoutOverridesMs = new Map([
  ["test:automation-postgres-isolated", 300_000],
  ["test:numbering-contract", 600_000],
]);
const handleWatchdogMs = Number(process.env.CAPATAZ_ACTIVE_HANDLE_WATCHDOG_MS ?? 30_000);
const reporterPath = join(process.cwd(), "scripts", "active-handle-reporter.mjs");
const reporterUrl = pathToFileURL(reporterPath).href;
const npmCliPath = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const prismaCliPath = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const diagnosticsEnabled = process.env.CAPATAZ_RUNNER_DIAGNOSTICS === "true";

const password = randomBytes(24).toString("hex");
const usedChildPorts = new Set();
let runtime;
let env;
let activeChild;
const removeSignalHandlers = installCleanupSignalHandlers(async () => {
  terminateOwnedProcess(activeChild);
  await stopIsolatedPostgres(runtime).catch(() => undefined);
});

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

function unexpectedActiveHandles() {
  return process._getActiveHandles().filter((handle) => {
    if (handle === process.stdin || handle === process.stdout || handle === process.stderr) return false;
    return !("fd" in handle && [0, 1, 2].includes(handle.fd));
  });
}

function activeSnapshot(reason, extra = {}) {
  const payload = {
    at: new Date().toISOString(),
    reason,
    ...extra,
    handles: unexpectedActiveHandles().map(summarizeHandle),
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

async function waitForHandleCleanup(timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (unexpectedActiveHandles().length === 0 && process._getActiveRequests().length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function runCommand(command, args, commandEnv = env) {
  execFileSync(command, args, { cwd: process.cwd(), env: commandEnv, stdio: "inherit" });
}

async function runTest(name, index, total) {
  process.stdout.write(`[isolated-tests] ${index + 1}/${total} ${name}\n`);
  const startedAt = Date.now();
  const timeoutMs = testTimeoutOverridesMs.get(name) ?? testTimeoutMs;
  const childPort = await availableLoopbackPort({ exclude: usedChildPorts });
  usedChildPorts.add(childPort);
  const childEnv = {
    ...env,
    CAPATAZ_ACTIVE_HANDLE_LABEL: name,
    CAPATAZ_AUTH_POSTGRES_PORT: String(childPort),
    CAPATAZ_CSV_STANDALONE_POSTGRES_PORT: String(childPort),
    CAPATAZ_NUMBERING_POSTGRES_PORT: String(childPort),
    CAPATAZ_QA_POSTGRES_PORT: String(childPort),
    CAPATAZ_TENANT_POSTGRES_PORT: String(childPort),
  };
  const childResult = await runOwnedChild(process.execPath, [npmCliPath, "run", name], {
    env: childEnv,
    timeoutMs,
  });
  const elapsedMs = Date.now() - startedAt;
  const timedOut = childResult.timedOut;
  if (timedOut) activeSnapshot("test-timeout", { name, elapsedMs });
  if (diagnosticsEnabled) activeSnapshot("after-test", { name, status: childResult.status, signal: childResult.signal, elapsedMs, timedOut, childPort });
  if (childResult.status !== 0 || timedOut) {
    writeFileSync(join(reportRoot, `${String(index + 1).padStart(3, "0")}-${safeName(name)}.stdout.log`), childResult.stdout, "utf8");
    writeFileSync(join(reportRoot, `${String(index + 1).padStart(3, "0")}-${safeName(name)}.stderr.log`), childResult.stderr, "utf8");
  }
  return {
    name,
    ok: childResult.status === 0 && !timedOut,
    status: childResult.status,
    signal: childResult.signal,
    elapsedMs,
    timedOut,
    childPort,
    stdout: childResult.stdout,
    stderr: childResult.stderr,
  };
}

function runOwnedChild(command, args, { env: childEnv, timeoutMs }) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let spawnError;
    let settled = false;
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: childEnv,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    activeChild = child;
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      stdout = appendTail(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stderr = appendTail(stderr, chunk);
    });
    child.once("error", (error) => {
      spawnError = error;
      stderr = appendTail(stderr, error?.stack ?? error);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      terminateOwnedProcess(child);
    }, timeoutMs);
    const finish = (status, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (activeChild === child) activeChild = undefined;
      resolve({
        status: status ?? (spawnError || timedOut ? 1 : null),
        signal,
        timedOut,
        stdout,
        stderr,
      });
    };
    child.once("close", finish);
  });
}

function appendTail(current, chunk, limit = 5_000_000) {
  const next = current + String(chunk);
  return next.length <= limit ? next : next.slice(-limit);
}

function safeName(name) {
  return name.replace(/[^a-z0-9_-]+/gi, "-");
}

const startedAt = Date.now();
const results = [];
try {
  runtime = await startIsolatedPostgres({
    EmbeddedPostgres,
    root: packageRoot,
    suite: "all-tests",
    password,
    preferredPort: process.env.CAPATAZ_ALL_TESTS_POSTGRES_PORT,
    postgresFlags: ["-c", "io_method=sync"],
  });
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/capataz_test_all?schema=public`;
  env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CAPATAZ_TEST_DATABASE_ISOLATED: "true",
    APP_ENV: "test",
    NEXT_PUBLIC_APP_ENV: "test",
    ...(diagnosticsEnabled ? {
      CAPATAZ_ACTIVE_HANDLE_REPORT_FILE: childHandleReport,
      CAPATAZ_ACTIVE_HANDLE_WATCHDOG_MS: String(handleWatchdogMs),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""}${process.env.NODE_OPTIONS ? " " : ""}--import=${reporterUrl}`,
    } : {}),
  };
  assertIsolatedTestDatabase(env);
  await runtime.pg.createDatabase("capataz_test_all");
  runCommand(process.execPath, [prismaCliPath, "migrate", "deploy"]);
  runCommand("node", ["prisma/seed.js"]);

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const allTests = Object.keys(packageJson.scripts).filter((name) => name.startsWith("test:"));
  const maxTests = process.env.CAPATAZ_RUNNER_MAX_TESTS ? Number(process.env.CAPATAZ_RUNNER_MAX_TESTS) : allTests.length;
  if (!Number.isInteger(maxTests) || maxTests < 1 || maxTests > allTests.length) {
    throw new Error(`CAPATAZ_RUNNER_MAX_TESTS_INVALID:${process.env.CAPATAZ_RUNNER_MAX_TESTS}`);
  }
  const tests = allTests.slice(0, maxTests);
  const resultsByCommand = new Map();
  for (const [index, name] of tests.entries()) {
    const command = packageJson.scripts[name];
    const previous = resultsByCommand.get(command);
    const result = previous
      ? { ...previous, name, elapsedMs: 0, reusedFrom: previous.name }
      : await runTest(name, index, tests.length);
    if (previous) process.stdout.write(`[isolated-tests] ${index + 1}/${tests.length} ${name} reused=${previous.name}\n`);
    else resultsByCommand.set(command, result);
    results.push(result);
    appendFileSync(runnerReport, `${JSON.stringify({
      at: new Date().toISOString(),
      reason: "test-result",
      index: index + 1,
      total: tests.length,
      name,
      ok: result.ok,
      status: result.status,
      signal: result.signal,
      elapsedMs: result.elapsedMs,
      timedOut: result.timedOut,
      childPort: result.childPort,
      reusedFrom: result.reusedFrom,
    })}\n`);
    if (!result.ok) {
      activeSnapshot("failed-test", { name, status: result.status, signal: result.signal, elapsedMs: result.elapsedMs, timedOut: result.timedOut });
      writeFileSync(join(reportRoot, "failed-test.json"), JSON.stringify({ result, reportRoot, childHandleReport, runnerReport }, null, 2));
      throw new Error(`ISOLATED_TEST_FAILED:${name}`);
    }
  }
  if (diagnosticsEnabled) activeSnapshot("before-pg-stop", { total: tests.length });
  const summary = { ok: true, isolated: true, total: tests.length, passed: results.filter((item) => item.ok).length, timeouts: results.filter((item) => item.timedOut).length, postgresPort: runtime.port, childPorts: usedChildPorts.size, elapsedMs: Date.now() - startedAt, reportRoot };
  appendFileSync(runnerReport, `${JSON.stringify({ at: new Date().toISOString(), reason: "runner-complete", ...summary })}\n`);
  console.log(JSON.stringify(summary));
} finally {
  removeSignalHandlers();
  terminateOwnedProcess(activeChild);
  let stopError;
  await stopIsolatedPostgres(runtime).catch((error) => {
    stopError = error;
    appendFileSync(runnerReport, `${JSON.stringify({ at: new Date().toISOString(), reason: "pg-stop-error", message: error?.message })}\n`);
  });
  await waitForHandleCleanup();
  const cleanup = activeSnapshot("runner-cleanup", { elapsedMs: Date.now() - startedAt, results: results.length, postgresStopped: !stopError });
  if (diagnosticsEnabled) activeSnapshot("after-pg-stop", { elapsedMs: Date.now() - startedAt, results: results.length });
  if (cleanup.handles.length || cleanup.requests.length) {
    throw new Error(`RUNNER_CLEANUP_INCOMPLETE handles=${cleanup.handles.length} requests=${cleanup.requests.length}`);
  }
  if (stopError) throw stopError;
}
