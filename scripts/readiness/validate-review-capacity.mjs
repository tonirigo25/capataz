import assert from "node:assert/strict";

const origin = process.env.ORQENA_REVIEW_URL?.replace(/\/$/, "");
if (process.env.ORQENA_REVIEW_CAPACITY_APPROVED !== "true") throw new Error("REVIEW_CAPACITY_APPROVAL_REQUIRED");
if (origin !== "https://orqena-review-web-review.up.railway.app") throw new Error("CONTINUOUS_REVIEW_URL_REQUIRED");
const paths = ["/api/health/live", "/", "/demo", "/login"];
const requestsPerPath = 30;
const concurrency = 10;
const results = [];

for (const path of paths) {
  const durations = [];
  let failures = 0;
  const queue = Array.from({ length: requestsPerPath }, (_, index) => index);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      queue.pop();
      const started = performance.now();
      try {
        const response = await fetch(`${origin}${path}`, { redirect: "manual", headers: { "user-agent": "orqena-review-capacity-v1" } });
        if (response.status >= 500) failures += 1;
        await response.arrayBuffer();
      } catch {
        failures += 1;
      }
      durations.push(performance.now() - started);
    }
  }));
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)];
  assert.equal(failures, 0, `${path}:failures`);
  assert.ok(p95 <= 3_000, `${path}:p95:${p95}`);
  results.push({ path, requests: durations.length, concurrency, failures, p95Ms: Math.round(p95) });
}

process.stdout.write(`${JSON.stringify({ ok: true, control: "C3", target: "continuous-review-only", availabilityClaim: false, results })}\n`);
