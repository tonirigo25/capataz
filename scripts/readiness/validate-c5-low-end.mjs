import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const baseUrl = process.env.C5_BASE_URL?.replace(/\/$/, "");
if (!baseUrl?.startsWith("http://127.0.0.1:")) throw new Error("C5_LOOPBACK_BASE_URL_REQUIRED");
const chromePath = process.env.ORQENA_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ ...(existsSync(chromePath) ? { executablePath: chromePath } : {}), headless: true });
const records = [];
try {
  for (const route of ["/", "/demo", "/contacto", "/recursos/calculadora-margen-obra"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: "cellular4g",
    });
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      globalThis.__orqenaPerf = { lcp: 0, cls: 0, longTaskMs: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        globalThis.__orqenaPerf.lcp = entries.at(-1)?.startTime ?? globalThis.__orqenaPerf.lcp;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__orqenaPerf.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__orqenaPerf.longTaskMs += entry.duration;
      }).observe({ type: "longtask", buffered: true });
    });
    let transferBytes = 0;
    page.on("response", async (response) => {
      const headers = await response.allHeaders().catch(() => ({}));
      transferBytes += Number(headers["content-length"] ?? 0);
    });
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
    assert.equal(response?.status(), 200, route);
    await page.waitForTimeout(2_000);
    const performance = await page.evaluate(() => ({
      ...globalThis.__orqenaPerf,
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
    }));
    assert.ok(performance.lcp > 0 && performance.lcp <= 5_000, `LOW_END_LCP:${route}:${performance.lcp}`);
    assert.ok(performance.cls <= 0.1, `LOW_END_CLS:${route}:${performance.cls}`);
    assert.ok(performance.longTaskMs <= 1_500, `LOW_END_LONG_TASKS:${route}:${performance.longTaskMs}`);
    assert.ok(transferBytes <= 3_000_000, `LOW_END_TRANSFER:${route}:${transferBytes}`);
    if (performance.heapBytes !== null) assert.ok(performance.heapBytes <= 120_000_000, `LOW_END_HEAP:${route}:${performance.heapBytes}`);
    records.push({ route, ...performance, transferBytes, cpuThrottle: 4, network: "bounded-4g" });
    await context.close();
  }
  process.stdout.write(`${JSON.stringify({ ok: true, control: "C5-low-end", synthetic: true, records })}\n`);
} finally {
  await browser.close();
}
