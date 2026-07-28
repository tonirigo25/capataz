import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { availableLoopbackPort } from "../isolated-postgres-runtime.mjs";

const standalone = join(process.cwd(), ".next", "standalone");
const serverFile = join(standalone, "server.js");
if (!existsSync(serverFile)) throw new Error("D2_BUILD_REQUIRED");

const port = await availableLoopbackPort();
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  HOSTNAME: "127.0.0.1",
  APP_BASE_URL: baseUrl,
  NEXT_PUBLIC_WEB_BASE_URL: baseUrl,
  APP_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
  NEXT_PUBLIC_APP_MODE: "test",
  ANALYTICS_ENABLED: "false",
  AI_ENABLED: "false",
  AI_PROVIDER_MODE: "off",
  BILLING_ENABLED: "false",
  EMAIL_LIVE_ENABLED: "false",
  FISCAL_ENGINE_ENABLED: "false",
  PUBLIC_INDEXING_ENABLED: "false",
  PUBLIC_PRICING_ENABLED: "false",
  ORQENA_PUBLIC_REGISTRATION_ENABLED: "false",
};
const output = [];
const child = spawn(process.execPath, [serverFile], {
  cwd: standalone,
  env,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.on("data", (chunk) => output.push(String(chunk)));
child.stderr.on("data", (chunk) => output.push(String(chunk)));

try {
  await waitForServer(baseUrl, child, output);
  const validator = join(process.cwd(), "scripts", "design", "validate-d2-browser.mjs");
  const result = spawnSync(process.execPath, [validator], {
    cwd: process.cwd(),
    env: { ...env, D2_BASE_URL: baseUrl },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`D2_BROWSER_VALIDATOR_FAILED:${result.status}`);
} finally {
  if (child.exitCode === null && child.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  }
}

async function waitForServer(url, processHandle, outputBuffer) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(
        `D2_SERVER_EXITED:${processHandle.exitCode}:${outputBuffer.join("").slice(-2000)}`,
      );
    }
    try {
      const response = await fetch(`${url}/`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`D2_SERVER_TIMEOUT:${outputBuffer.join("").slice(-2000)}`);
}
