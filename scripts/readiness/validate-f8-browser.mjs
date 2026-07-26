import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";

const baseUrl = process.env.F8_BASE_URL?.replace(/\/$/, "");
if (!baseUrl?.startsWith("http://127.0.0.1:")) throw new Error("F8_LOOPBACK_BASE_URL_REQUIRED");
const contract = JSON.parse(readFileSync("contracts/observability/v1/web-performance-budget.json", "utf8"));
const chrome = process.env.ORQENA_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launchOptions = existsSync(chrome) ? { executablePath: chrome } : {};
const browser = await chromium.launch({ ...launchOptions, headless: true, args: ["--disable-extensions", "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding"] });
const routes = [
  { route: "/", authenticated: false },
  { route: "/login", authenticated: false },
  { route: "/producto", authenticated: false },
  { route: "/planes", authenticated: false },
  { route: "/hoy", authenticated: true },
  { route: "/configuracion/soporte", authenticated: true },
];
const records = [];

try {
  for (const target of routes) {
    const { route, authenticated } = target;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__f8Vitals = { cls: 0, lcp: null, inp: null };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__f8Vitals.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.__f8Vitals.lcp = entries.at(-1)?.startTime ?? window.__f8Vitals.lcp;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__f8Vitals.inp = Math.max(window.__f8Vitals.inp ?? 0, entry.duration);
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });
    if (authenticated) await login(page);
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
    assert(response && response.status() < 400, `HTTP_${response?.status() ?? "NONE"}:${route}`);
    await page.waitForTimeout(250);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const blocking = axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));
    assert.deepEqual(blocking.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })), [], `AXE_BLOCKING:${route}`);

    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return { visible: false, styled: false, tag: "none" };
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { visible: box.width > 0 && box.height > 0, styled: style.outlineStyle !== "none" || style.boxShadow !== "none", tag: element.tagName.toLowerCase() };
    });
    assert(focus.visible && focus.styled, `VISIBLE_KEYBOARD_FOCUS_REQUIRED:${route}`);
    const maxMotionSeconds = await page.evaluate(() => Math.max(0, ...Array.from(document.querySelectorAll("body *")).filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }).flatMap((element) => {
      const style = getComputedStyle(element);
      const values = `${style.animationDuration},${style.transitionDuration}`.split(",").map((value) => value.trim()).filter(Boolean);
      return values.map((value) => value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value) || 0);
    })));
    assert(maxMotionSeconds <= 0.01, `REDUCED_MOTION_NOT_HONORED:${route}:${maxMotionSeconds}`);
    const vitals = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paint = performance.getEntriesByName("first-contentful-paint")[0];
      return {
        TTFB: navigation ? navigation.responseStart - navigation.requestStart : null,
        FCP: paint?.startTime ?? null,
        LCP: window.__f8Vitals?.lcp ?? null,
        CLS: window.__f8Vitals?.cls ?? null,
        INP: window.__f8Vitals?.inp ?? null,
        inpUpperBound: window.__f8Vitals?.inp === null ? 16 : null,
      };
    });
    for (const metric of ["TTFB", "FCP", "LCP", "CLS"]) {
      assert(typeof vitals[metric] === "number" && Number.isFinite(vitals[metric]), `METRIC_MISSING:${metric}:${route}`);
      assert(vitals[metric] <= contract.budgets[metric].maximum, `PERFORMANCE_BUDGET:${metric}:${route}:${vitals[metric]}`);
    }
    const inpGate = vitals.INP ?? vitals.inpUpperBound;
    assert(typeof inpGate === "number" && inpGate <= contract.budgets.INP.maximum, `PERFORMANCE_BUDGET:INP:${route}:${inpGate}`);
    records.push({ route, authenticated, status: response.status(), axeBlocking: 0, keyboardFocus: focus, reducedMotionMaxSeconds: maxMotionSeconds, metrics: vitals, measurement: "local-loopback-synthetic-browser" });
    await context.close();
  }
  console.log(JSON.stringify({ ok: true, routes: records.length, records, externalCalls: 0, productionWrites: 0 }, null, 2));
} finally {
  await browser.close();
}

async function login(page) {
  const email = process.env.F8_BROWSER_EMAIL;
  const password = process.env.F8_BROWSER_PASSWORD;
  if (!email || !password) throw new Error("F8_BROWSER_AUTH_FIXTURE_REQUIRED");
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
}
