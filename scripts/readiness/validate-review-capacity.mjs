import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const origin = process.env.ORQENA_REVIEW_URL?.replace(/\/$/, "");
const deployedSha = process.env.ORQENA_REVIEW_SHA ?? "";
if (process.env.ORQENA_REVIEW_CAPACITY_APPROVED !== "true") throw new Error("REVIEW_CAPACITY_APPROVAL_REQUIRED");
if (origin !== "https://orqena-review-web-review.up.railway.app") throw new Error("CONTINUOUS_REVIEW_URL_REQUIRED");
if (!/^[a-f0-9]{40}$/u.test(deployedSha)) throw new Error("REVIEW_CAPACITY_SHA_REQUIRED");
const paths = ["/api/health/live", "/", "/demo", "/login"];
const requestsPerPath = 30;
const concurrency = 10;
const results = [];
const startedAt = new Date().toISOString();

for (const path of paths) {
  const durations = [];
  const bytes = [];
  let failures = 0;
  let rateLimited = 0;
  const queue = Array.from({ length: requestsPerPath }, (_, index) => index);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      queue.pop();
      const started = performance.now();
      try {
        const response = await fetch(`${origin}${path}`, { redirect: "manual", headers: { "user-agent": "orqena-review-capacity-v1" } });
        if (response.status >= 500) failures += 1;
        if (response.status === 429) rateLimited += 1;
        bytes.push((await response.arrayBuffer()).byteLength);
      } catch {
        failures += 1;
        bytes.push(0);
      }
      durations.push(performance.now() - started);
    }
  }));
  durations.sort((a, b) => a - b);
  const percentile = (value) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)];
  const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)];
  assert.equal(failures, 0, `${path}:failures`);
  assert.ok(p95 <= 3_000, `${path}:p95:${p95}`);
  const recoveryStarted = performance.now();
  const recovery = await fetch(`${origin}/api/health/ready`, { headers: { "user-agent": "orqena-review-capacity-v1-recovery" } });
  const recoveryMs = performance.now() - recoveryStarted;
  assert.equal(recovery.status, 200, `${path}:recovery-status`);
  assert.ok(recoveryMs <= 3_000, `${path}:recovery:${recoveryMs}`);
  results.push({
    path,
    requests: durations.length,
    concurrency,
    failures,
    rateLimited,
    p50Ms: Math.round(percentile(0.5)),
    p95Ms: Math.round(p95),
    p99Ms: Math.round(percentile(0.99)),
    maxMs: Math.round(durations.at(-1)),
    responseBytes: bytes.reduce((total, value) => total + value, 0),
    recoveryReadyStatus: recovery.status,
    recoveryMs: Math.round(recoveryMs),
  });
}

const report = {
  schemaVersion: "orqena-review-capacity-v1",
  ok: true,
  control: "C3",
  target: "continuous-review-only",
  deployedSha,
  startedAt,
  completedAt: new Date().toISOString(),
  availabilityClaim: false,
  productionCapacityClaim: false,
  thresholds: { requestsPerPath, concurrency, maxP95Ms: 3_000, maxRecoveryMs: 3_000 },
  results,
};
const outputRoot = join(process.cwd(), "artifacts", "review-capacity");
const outputPath = join(outputRoot, "public-burst.json");
mkdirSync(outputRoot, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...report, output: relative(process.cwd(), outputPath) })}\n`);
