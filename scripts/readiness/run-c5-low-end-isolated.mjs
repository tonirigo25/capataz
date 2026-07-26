import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { availableLoopbackPort } from "../isolated-postgres-runtime.mjs";

const standalone = join(process.cwd(), ".next", "standalone");
const serverFile = join(standalone, "server.js");
if (!existsSync(serverFile)) throw new Error("C5_BUILD_REQUIRED");
const port = await availableLoopbackPort();
const baseUrl = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", APP_BASE_URL: baseUrl, NEXT_PUBLIC_WEB_BASE_URL: baseUrl, APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test", NEXT_PUBLIC_APP_MODE: "test", PUBLIC_INDEXING_ENABLED: "false", PUBLIC_PRICING_ENABLED: "false", ORQENA_PUBLIC_REGISTRATION_ENABLED: "false", AI_ENABLED: "false", AI_PROVIDER_MODE: "off", BILLING_ENABLED: "false", EMAIL_LIVE_ENABLED: "false", FISCAL_ENGINE_ENABLED: "false", ANALYTICS_ENABLED: "false" };
const logs = [];
const child = spawn(process.execPath, [serverFile], { cwd: standalone, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
child.stdout.on("data", (chunk) => logs.push(String(chunk)));
child.stderr.on("data", (chunk) => logs.push(String(chunk)));
try {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`C5_SERVER_EXITED:${logs.join("").slice(-1_000)}`);
    try { if ((await fetch(baseUrl)).status < 500) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const result = spawnSync(process.execPath, [join(process.cwd(), "scripts", "readiness", "validate-c5-low-end.mjs")], { cwd: process.cwd(), env: { ...env, C5_BASE_URL: baseUrl }, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`C5_LOW_END_FAILED:${result.status}`);
} finally {
  if (child.exitCode === null && child.pid) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGTERM");
  }
}
