const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

const url = process.env.CAPATAZ_INTERNAL_URL?.trim();
const secret = process.env.PROACTIVE_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
const timeoutMs = parseTimeout(process.env.PROACTIVE_EVALUATION_TIMEOUT_MS);

if (!url) fail("CAPATAZ_INTERNAL_URL is required.");
if (!secret) fail("PROACTIVE_CRON_SECRET or CRON_SECRET is required.");

let endpoint;
try {
  endpoint = new URL("/api/internal/proactive-evaluate", url);
  if (!/^https?:$/.test(endpoint.protocol)) throw new Error("unsupported protocol");
} catch {
  fail("CAPATAZ_INTERNAL_URL must be a valid HTTP(S) origin.");
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
timer.unref?.();

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-capataz-cron-secret": secret
    },
    body: "{}",
    signal: controller.signal
  });
  const result = await readJson(response);

  if (response.status === 423 && result?.locked) {
    console.log("Proactive evaluation skipped: lock=active");
    process.exitCode = 0;
  } else if (!response.ok || !result?.ok) {
    throw new Error(`evaluation request failed with HTTP ${response.status}`);
  } else {
    const summary = sanitizeSummary(result.summary);
    console.log("Proactive evaluation completed:");
    for (const [key, value] of Object.entries(summary)) console.log(`${key}=${value}`);
    if (result.status === "partial" || summary.errors > 0) process.exitCode = 2;
  }
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") fail(`Proactive evaluation timed out after ${timeoutMs}ms.`);
  fail(error instanceof Error ? error.message : "Proactive evaluation failed.");
} finally {
  clearTimeout(timer);
}

function parseTimeout(raw) {
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 100 || value > DEFAULT_TIMEOUT_MS) fail("PROACTIVE_EVALUATION_TIMEOUT_MS is invalid.");
  return value;
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

function sanitizeSummary(summary = {}) {
  const integer = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {
    processedSignals: integer(summary.processedSignals),
    createdSignals: integer(summary.createdSignals),
    updatedSignals: integer(summary.updatedSignals),
    resolvedSignals: integer(summary.resolvedSignals),
    reactivatedSignals: integer(summary.reactivatedSignals),
    processedRecommendations: integer(summary.processedRecommendations),
    createdRecommendations: integer(summary.createdRecommendations),
    updatedRecommendations: integer(summary.updatedRecommendations),
    resolvedRecommendations: integer(summary.resolvedRecommendations),
    reactivatedRecommendations: integer(summary.reactivatedRecommendations),
    durationMs: integer(summary.durationMs),
    errors: integer(summary.errors)
  };
}

function fail(message) {
  console.error(`Proactive evaluation failed: ${message}`);
  process.exit(1);
}
