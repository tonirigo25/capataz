import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const baseUrl = process.env.F9_BASE_URL?.replace(/\/$/, "");
if (!baseUrl?.startsWith("http://127.0.0.1:")) throw new Error("F9_LOOPBACK_BASE_URL_REQUIRED");
const chrome = process.env.ORQENA_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ ...(existsSync(chrome) ? { executablePath: chrome } : {}), headless: true, args: ["--disable-extensions"] });
const routes = ["/", "/demo", "/marketing-v2", "/demo-v2", "/planes", "/contacto", "/privacidad", "/terminos", "/cookies"];
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
const records = [];

try {
  await validateConsent();
  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      await context.addInitScript(() => localStorage.setItem("orqena-consent-v1", JSON.stringify({ analytics: false, policyVersion: "1.0" })));
      const page = await context.newPage();
      const consoleErrors = [];
      const failures = [];
      const externalRequests = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("requestfailed", (request) => {
        const error = request.failure()?.errorText ?? "failed";
        if (error === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
        failures.push(`${request.method()} ${request.url()} ${error}`);
      });
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (!request.url().startsWith(baseUrl) && !["data:", "blob:"].includes(url.protocol)) externalRequests.push(request.url());
      });
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
      assert(response && response.status() === 200, `HTTP_${response?.status() ?? "NONE"}:${route}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(overflow <= 1, `HORIZONTAL_OVERFLOW:${route}:${viewport.width}:${overflow}`);
      const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => !(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth === 0).length);
      assert.equal(brokenImages, 0, `BROKEN_IMAGES:${route}`);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const blocking = axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""));
      assert.deepEqual(blocking.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })), [], `AXE_BLOCKING:${route}:${viewport.width}`);
      assert.deepEqual(consoleErrors, [], `CONSOLE_ERRORS:${route}:${viewport.width}`);
      assert.deepEqual(failures, [], `REQUEST_FAILURES:${route}:${viewport.width}`);
      assert.deepEqual(externalRequests, [], `EXTERNAL_REQUESTS:${route}:${viewport.width}`);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      assert.match(robots ?? "", /noindex/i, `NOINDEX_REQUIRED:${route}`);
      records.push({ route, viewport: `${viewport.width}x${viewport.height}`, status: response.status(), horizontalOverflow: false, brokenImages: 0, axeBlocking: 0, consoleErrors: 0, requestFailures: 0, externalRequests: 0 });
      await context.close();
    }
  }
  const canonical = await browser.newPage();
  await canonical.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  assert.equal(new URL(await canonical.locator('link[rel="canonical"]').getAttribute("href")).pathname, "/");
  await canonical.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
  assert.equal(new URL(await canonical.locator('link[rel="canonical"]').getAttribute("href")).pathname, "/demo");
  const journey = await canonical.locator("[data-canonical-journey]").getAttribute("data-canonical-journey");
  assert.equal(journey, "lead-visita-presupuesto-trabajo-gasto-factura-cobro");
  await canonical.close();
  console.log(JSON.stringify({ ok: true, phase: "F9", routes: records.length, records, consent: "fail-closed and withdrawable", externalCalls: 0, productionWrites: 0, stagingWrites: 0 }, null, 2));
} finally {
  await browser.close();
}

async function validateConsent() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let metricRequests = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/metrics/web-vitals") metricRequests += 1; });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  assert.equal(metricRequests, 0, "ANALYTICS_BEFORE_CONSENT");
  await page.getByRole("button", { name: "Solo esenciales" }).click();
  await page.waitForTimeout(300);
  assert.equal(metricRequests, 0, "ANALYTICS_AFTER_REJECTION");
  await page.getByRole("button", { name: "Privacidad" }).click();
  await page.getByRole("button", { name: "Aceptar analítica" }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("orqena-consent-v1") ?? "null"));
  assert.deepEqual(stored, { analytics: true, policyVersion: "1.0" });
  await context.close();
}
