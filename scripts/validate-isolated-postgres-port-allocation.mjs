import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  isLoopbackPortAvailable,
  startIsolatedPostgres,
  stopIsolatedPostgres,
} from "./isolated-postgres-runtime.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href,
);

const blocker = createServer();
await new Promise((resolve, reject) => {
  blocker.once("error", reject);
  blocker.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
});
const address = blocker.address();
if (!address || typeof address === "string") throw new Error("PORT_REGRESSION_BLOCKER_FAILED");
const occupiedPort = address.port;
let runtime;

try {
  runtime = await startIsolatedPostgres({
    EmbeddedPostgres,
    root,
    suite: "isolated-postgres-port-regression",
    password: randomBytes(24).toString("hex"),
    preferredPort: occupiedPort,
    maxAttempts: 3,
  });
  assert.notEqual(runtime.port, occupiedPort, "occupied port must not be reused");
  await runtime.pg.createDatabase("capataz_test_port_regression");
  const selectedPort = runtime.port;
  await stopIsolatedPostgres(runtime);
  runtime = undefined;
  assert.equal(await isLoopbackPortAvailable(selectedPort), true, "selected port must be released after cleanup");

  const failed = await runProbe({
    ...process.env,
    CAPATAZ_PROBE_POSTGRES_PORT: String(occupiedPort),
    CAPATAZ_PROBE_ALLOW_FALLBACK: "false",
  });
  assert.notEqual(failed.code, 0, "probe must return nonzero when no alternative is allowed");
  assert.match(failed.stderr, /ISOLATED_POSTGRES_START_FAILED/);
  assert.match(failed.stderr, /suite=isolated-postgres-startup-probe/);
  assert.match(failed.stderr, new RegExp(`port=${occupiedPort}`));
  assert.match(failed.stderr, /dataDir=/);
  assert.equal(await isLoopbackPortAvailable(occupiedPort), false, "blocker must remain the only owner of the occupied port");

  process.stdout.write(JSON.stringify({
    ok: true,
    occupiedPort,
    fallbackPort: selectedPort,
    falsePositivePrevented: true,
    failureStatus: failed.code,
    cleanup: true,
  }) + "\n");
} finally {
  await stopIsolatedPostgres(runtime).catch(() => undefined);
  await new Promise((resolve) => blocker.close(resolve));
}
function runProbe(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/fixtures/isolated-postgres-startup-probe.mjs"], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
