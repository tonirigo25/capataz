import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { availableLoopbackPort } from "../isolated-postgres-runtime.mjs";

const cli = join(process.cwd(), "node_modules", "@lhci", "cli", "src", "cli.js");
const chromePath = process.env.ORQENA_CHROME_PATH ?? chromium.executablePath();
if (!existsSync(chromePath)) throw new Error("LIGHTHOUSE_CHROME_NOT_FOUND");
const chromePort = await availableLoopbackPort();
const profile = join(process.cwd(), ".lighthouseci", `chrome-${chromePort}`);
mkdirSync(profile, { recursive: true });
const env = {
  ...process.env,
  LIGHTHOUSE_CHROME_PORT: String(chromePort),
  PORT: "3210",
  HOSTNAME: "127.0.0.1",
  APP_BASE_URL: "http://127.0.0.1:3210",
  NEXT_PUBLIC_WEB_BASE_URL: "http://127.0.0.1:3210",
  APP_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
  NEXT_PUBLIC_APP_MODE: "test",
  PUBLIC_INDEXING_ENABLED: "false",
  PUBLIC_PRICING_ENABLED: "false",
  ORQENA_PUBLIC_REGISTRATION_ENABLED: "false",
  AI_ENABLED: "false",
  AI_PROVIDER_MODE: "off",
  BILLING_ENABLED: "false",
  EMAIL_LIVE_ENABLED: "false",
  FISCAL_ENGINE_ENABLED: "false",
  ANALYTICS_ENABLED: "false",
};
const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--no-sandbox",
], { stdio: "ignore", windowsHide: true });

try {
  await waitForChrome(chromePort, chrome);
  const result = spawnSync(process.execPath, [cli, "autorun", "--config=lighthouserc.cjs"], { cwd: process.cwd(), env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  if (chrome.exitCode === null && chrome.pid) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(chrome.pid), "/f", "/t"], { stdio: "ignore", windowsHide: true });
    else chrome.kill("SIGTERM");
  }
}

async function waitForChrome(port, processHandle) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`LIGHTHOUSE_CHROME_EXITED:${processHandle.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("LIGHTHOUSE_CHROME_TIMEOUT");
}
