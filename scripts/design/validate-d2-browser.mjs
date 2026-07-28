import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const baseUrl = process.env.D2_BASE_URL?.replace(/\/$/, "");
if (!baseUrl?.startsWith("http://127.0.0.1:")) {
  throw new Error("D2_LOOPBACK_BASE_URL_REQUIRED");
}

const chromePath =
  process.env.ORQENA_CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({
  ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
  headless: true,
  args: [
    "--disable-extensions",
    "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding",
  ],
});
const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const routes = ["/", "/demo"];
const records = [];

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const requestFailures = [];
      const externalRequests = [];

      await page.addInitScript(() => {
        window.__d2Vitals = { cls: 0, inp: null, lcp: null };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__d2Vitals.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          window.__d2Vitals.lcp =
            entries.at(-1)?.startTime ?? window.__d2Vitals.lcp;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__d2Vitals.inp = Math.max(
              window.__d2Vitals.inp ?? 0,
              entry.duration,
            );
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      });
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", (request) => {
        const error = request.failure()?.errorText ?? "failed";
        if (error === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
        requestFailures.push(`${request.method()} ${request.url()} ${error}`);
      });
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          !request.url().startsWith(baseUrl) &&
          !["data:", "blob:"].includes(url.protocol)
        ) {
          externalRequests.push(request.url());
        }
      });

      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      assert(response && response.status() === 200, `HTTP_${response?.status()}:${route}`);
      assert.equal(
        await page.locator('meta[name="robots"]').getAttribute("content").then((value) =>
          /noindex/i.test(value ?? ""),
        ),
        true,
        `NOINDEX_REQUIRED:${route}`,
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert(overflow <= 1, `HORIZONTAL_OVERFLOW:${route}:${viewport.width}:${overflow}`);

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const blocking = axe.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      );
      assert.deepEqual(
        blocking.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
        [],
        `AXE_BLOCKING:${route}:${viewport.width}`,
      );

      if (route === "/") {
        await validateHome(page, viewport.width);
      } else {
        await validateDemo(page);
      }
      await page.waitForTimeout(250);

      const reducedMotionMaxSeconds = await page.evaluate(() =>
        Math.max(
          0,
          ...Array.from(document.querySelectorAll("body *"))
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.height > 0;
            })
            .flatMap((element) => {
              const style = getComputedStyle(element);
              return `${style.animationDuration},${style.transitionDuration}`
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
                .map((value) =>
                  value.endsWith("ms")
                    ? Number.parseFloat(value) / 1000
                    : Number.parseFloat(value) || 0,
                );
            }),
        ),
      );
      assert(
        reducedMotionMaxSeconds <= 0.01,
        `REDUCED_MOTION_NOT_HONORED:${route}:${reducedMotionMaxSeconds}`,
      );

      const vitals = await page.evaluate(() => ({
        LCP: window.__d2Vitals?.lcp ?? null,
        CLS: window.__d2Vitals?.cls ?? null,
        INP: window.__d2Vitals?.inp ?? null,
        inpUpperBound: window.__d2Vitals?.inp === null ? 16 : null,
      }));
      assert(
        typeof vitals.CLS === "number" && vitals.CLS <= 0.1,
        `CLS_BUDGET:${route}:${vitals.CLS}`,
      );
      const inpGate = vitals.INP ?? vitals.inpUpperBound;
      assert(
        typeof inpGate === "number" && inpGate <= 200,
        `INP_BUDGET:${route}:${inpGate}`,
      );
      assert.deepEqual(consoleErrors, [], `CONSOLE_ERRORS:${route}:${viewport.width}`);
      assert.deepEqual(
        requestFailures,
        [],
        `REQUEST_FAILURES:${route}:${viewport.width}`,
      );
      assert.deepEqual(
        externalRequests,
        [],
        `EXTERNAL_REQUESTS:${route}:${viewport.width}`,
      );

      records.push({
        route,
        viewport: `${viewport.width}x${viewport.height}`,
        status: response.status(),
        axeBlocking: 0,
        horizontalOverflow: false,
        reducedMotionMaxSeconds,
        metrics: vitals,
        externalRequests: 0,
      });
      await context.close();
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "D2",
        records,
        measurement: "local-loopback-synthetic-browser",
        externalCalls: 0,
        productionWrites: 0,
        stagingWrites: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

async function validateHome(page, viewportWidth) {
  await page.getByRole("link", { name: "Ver cómo funciona", exact: true }).first().press("Enter");
  await page.getByRole("button", { name: /^05 Factura y cobro/ }).press("Enter");
  assert.match(
    (await page.locator('[aria-current="step"]').textContent()) ?? "",
    /Factura y cobro/,
  );

  if (viewportWidth === 390) {
    const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
    await menu.press("Enter");
    await page.getByRole("button", { name: "Cerrar menú", exact: true }).press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
  }
}

async function validateDemo(page) {
  const next = page.getByRole("button", { name: "Siguiente", exact: true });
  await next.press("Enter");
  await next.press("Enter");
  await next.press("Enter");
  const amount = page.getByRole("textbox", {
    name: "Importe orientativo",
    exact: true,
  });
  await amount.fill("19.200 €");
  await amount.press("Tab");
  await next.press("Enter");
  await page
    .getByRole("button", { name: "Confirmar simulación", exact: true })
    .press("Enter");
  await next.press("Enter");
  assert.equal(await page.locator("article h2").textContent(), "Resultado");
  assert.match((await page.locator("article").textContent()) ?? "", /19\.200 €/);
}
