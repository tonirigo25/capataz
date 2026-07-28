import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { availableLoopbackPort, installCleanupSignalHandlers, startIsolatedPostgres, stopIsolatedPostgres } from "../isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "../test-database-safety.mjs";

const standalone = join(process.cwd(), ".next", "standalone");
const serverFile = join(standalone, "server.js");
if (!existsSync(serverFile)) throw new Error("F8_BUILD_REQUIRED");
const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const databasePassword = randomBytes(24).toString("hex");
const browserEmail = `f8-browser-${Date.now()}@example.invalid`;
const browserPassword = `F8-${randomBytes(18).toString("base64url")}!`;
const port = await availableLoopbackPort();
const baseUrl = `http://127.0.0.1:${port}`;
let runtime;
let child;
const output = [];
const removeSignalHandlers = installCleanupSignalHandlers(async () => stopIsolatedPostgres(runtime).catch(() => undefined));
try {
  runtime = await startIsolatedPostgres({ EmbeddedPostgres, root, suite: "readiness-f8-browser", password: databasePassword, postgresFlags: ["-c", "io_method=sync"] });
  await runtime.pg.createDatabase("capataz_test_readiness_f8_browser");
  const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${databasePassword}@127.0.0.1:${runtime.port}/capataz_test_readiness_f8_browser?schema=public`, CAPATAZ_TEST_DATABASE_ISOLATED: "true", F8_BROWSER_EMAIL: browserEmail, F8_BROWSER_PASSWORD: browserPassword, PORT: String(port), HOSTNAME: "127.0.0.1", APP_BASE_URL: baseUrl, NEXT_PUBLIC_WEB_BASE_URL: baseUrl, APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test", ANALYTICS_ENABLED: "false", AI_ENABLED: "false", AI_PROVIDER_MODE: "off", BILLING_ENABLED: "false", EMAIL_LIVE_ENABLED: "false", FISCAL_ENGINE_ENABLED: "false", PUBLIC_INDEXING_ENABLED: "false", ORQENA_PUBLIC_REGISTRATION_ENABLED: "false" };
  assertIsolatedTestDatabase(env);
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "ignore" });
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "scripts/readiness/seed-f8-browser.ts"], { cwd: process.cwd(), env, stdio: "inherit" });
  child = spawn(process.execPath, [serverFile], { cwd: standalone, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  await waitForServer(baseUrl, child, output);
  const result = spawnSync(process.execPath, [join(process.cwd(), "scripts", "readiness", "validate-f8-browser.mjs")], { cwd: process.cwd(), env: { ...env, F8_BASE_URL: baseUrl }, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`F8_BROWSER_VALIDATOR_FAILED:${result.status}`);
} finally {
  if (child?.exitCode === null && child.pid) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGTERM");
  }
  removeSignalHandlers();
  await stopIsolatedPostgres(runtime);
}

async function waitForServer(baseUrl, processHandle, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`F8_SERVER_EXITED:${processHandle.exitCode}:${output.join("").slice(-2000)}`);
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`F8_SERVER_TIMEOUT:${output.join("").slice(-2000)}`);
}
