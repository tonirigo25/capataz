import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const checks = [];
function check(name, condition, detail = "") {
  assert.ok(condition, `${name}${detail ? `: ${detail}` : ""}`);
  checks.push(name);
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (/\.(?:ts|tsx|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const localEnvPath = path.join(root, ".env.local");
let localEnvStat;
try { localEnvStat = await lstat(localEnvPath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const tracked = execFileSync("git", ["ls-files", "--", ".env.local"], { cwd: root, encoding: "utf8" }).trim();
check("env-local-untracked", tracked === "");
let ignored = false;
try { execFileSync("git", ["check-ignore", "-q", ".env.local"], { cwd: root }); ignored = true; } catch { ignored = false; }
check("env-local-ignored", ignored);
check("env-local-not-symlink", !localEnvStat || !localEnvStat.isSymbolicLink());
check("env-local-not-written", !localEnvStat);
const relativeEnv = path.relative(root, localEnvPath);
check("env-local-inside-worktree", relativeEnv === ".env.local" && !relativeEnv.startsWith(".."));

const envExample = await readFile(path.join(root, ".env.example"), "utf8");
check("env-example-no-key", /^OPENAI_API_KEY=$/m.test(envExample));
check("global-ai-default-off", /^AI_ENABLED=false$/m.test(envExample));
check("provider-mode-default-off", /^AI_PROVIDER_MODE=off$/m.test(envExample));
check("store-default-false", /^OPENAI_STORE=false$/m.test(envExample));

const files = [...await sourceFiles(path.join(root, "app")), ...await sourceFiles(path.join(root, "lib"))];
const endpointOwners = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  if (source.includes("api.openai.com")) endpointOwners.push(path.relative(root, file).replaceAll("\\", "/"));
}
check("single-openai-endpoint-owner", endpointOwners.length === 1 && endpointOwners[0] === "lib/ai/openai-transport.ts", endpointOwners.join(","));

const middleware = await readFile(path.join(root, "middleware.ts"), "utf8");
check("browser-csp-does-not-allow-openai", !middleware.includes("api.openai.com"));
const transport = await readFile(path.join(root, "lib", "ai", "openai-transport.ts"), "utf8");
check("transport-forces-store-false", /store:\s*false/.test(transport) && /input\.store\s*!==\s*false/.test(transport));
check("transport-supports-endpoint", /OPENAI_BASE_URL/.test(await readFile(path.join(root, ".env.example"), "utf8")) && /baseUrl/.test(transport));
const gateway = await readFile(path.join(root, "lib", "ai", "governed-gateway.ts"), "utf8");
for (const [name, pattern] of [
  ["gateway-budget", /AI_COMPANY_BUDGET_EXCEEDED/],
  ["gateway-timeout", /AbortController/],
  ["gateway-retry", /RETRYABLE_STATUS/],
  ["gateway-backoff", /2 \*\* \(attempt - 1\)/],
  ["gateway-circuit", /AI_CIRCUIT_OPEN/],
  ["gateway-idempotency", /acquireOperation/],
  ["gateway-fallback", /continue-manually/],
  ["gateway-correlation", /correlation_ref/],
] ) check(name, pattern.test(gateway));

for (const relative of [
  "contracts/ai/v1/gateway.json",
  "contracts/ai/v1/model-registry.json",
  "contracts/ai/v1/synthetic-pricing.json",
  "contracts/ai/v1/eval-dataset.json",
  "lib/ai/schema-validation.ts",
  "lib/ai/redaction.ts",
  "lib/ai/prisma-store.ts",
  "app/(app)/configuracion/ia/page.tsx",
  "app/api/jobs/ai-retention/route.ts",
  "docs/runbooks/AI_GOVERNANCE_ACTIVATION.md",
  "docs/compliance/AI_PROVIDER_AND_TRANSFER_ASSESSMENT.md",
  "docs/readiness/EXTERNAL_RISK_REGISTER.md",
  "docs/readiness/external-gates.json",
]) {
  const content = await readFile(path.join(root, relative), "utf8");
  check(`artifact-${relative}`, content.trim().length > 0);
}

const gates = JSON.parse(await readFile(path.join(root, "docs", "readiness", "external-gates.json"), "utf8"));
check("six-live-gates", gates.gates.length === 6 && gates.gates.every((gate) => gate.status === "READY_FOR_EXTERNAL_INPUT"));
const risk = await readFile(path.join(root, "docs", "readiness", "EXTERNAL_RISK_REGISTER.md"), "utf8");
check("ui-blocker-no-sensitive-ids", /three attempts|three/i.test(risk) && !/org-[A-Za-z0-9]|proj_[A-Za-z0-9]/.test(risk));

console.log(JSON.stringify({ ok: true, checks: checks.length, names: checks }, null, 2));
