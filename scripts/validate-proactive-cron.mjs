import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./run-proactive-evaluation.mjs", import.meta.url));
const secret = "test-secret-that-must-never-appear";

function run(env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [runner], {
      env: { ...process.env, CAPATAZ_INTERNAL_URL: "", PROACTIVE_CRON_SECRET: "", CRON_SECRET: "", ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => stdout += chunk);
    child.stderr.on("data", (chunk) => stderr += chunk);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function withServer(handler, test) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await test(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

const missingUrl = await run({ PROACTIVE_CRON_SECRET: secret });
assert.equal(missingUrl.code, 1);
assert.match(missingUrl.stderr, /CAPATAZ_INTERNAL_URL/);

const missingSecret = await run({ CAPATAZ_INTERNAL_URL: "http://127.0.0.1:1" });
assert.equal(missingSecret.code, 1);
assert.match(missingSecret.stderr, /PROACTIVE_CRON_SECRET/);

await withServer((request, response) => json(response, 401, { ok: false }), async (url) => {
  const result = await run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /HTTP 401/);
});

await withServer((request, response) => json(response, 200, {
  ok: true,
  status: "completed",
  summary: { processedSignals: 21, createdSignals: 1, durationMs: 842, errors: 0, privateClient: "never-log" }
}), async (url) => {
  const result = await run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /processedSignals=21/);
  assert.doesNotMatch(result.stdout + result.stderr, /never-log|test-secret/);
});

await withServer((request, response) => json(response, 500, { ok: false, error: secret }), async (url) => {
  const result = await run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret });
  assert.equal(result.code, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /test-secret/);
});

await withServer((request, response) => json(response, 423, { ok: false, locked: true }), async (url) => {
  const [first, second] = await Promise.all([
    run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret }),
    run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret })
  ]);
  assert.equal(first.code, 0);
  assert.equal(second.code, 0);
  assert.match(first.stdout, /lock=active/);
});

await withServer((request, response) => json(response, 200, {
  ok: true, status: "partial", summary: { errors: 1, durationMs: 10 }
}), async (url) => {
  const result = await run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret });
  assert.equal(result.code, 2);
  assert.match(result.stdout, /errors=1/);
});

await withServer(() => {}, async (url) => {
  const result = await run({ CAPATAZ_INTERNAL_URL: url, PROACTIVE_CRON_SECRET: secret, PROACTIVE_EVALUATION_TIMEOUT_MS: "100" });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /timed out/);
});

console.log("[proactive-cron] runner validation passed");
