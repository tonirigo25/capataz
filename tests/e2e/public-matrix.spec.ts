import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const coreRoutes = ["/", "/demo", "/contacto", "/login"];
const detailedRoutes = ["/producto", "/soluciones", "/sectores", "/planes", "/precios", "/recursos", "/empresa", "/seguridad", "/estado", "/soporte", "/privacidad", "/terminos", "/cookies", "/recursos/calculadora-margen-obra", "/recursos/checklist-factura-recibida", "/route-that-does-not-exist"];
const viewportPairs = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
const chromiumWidths = [320, 390, 768, 1024, 1440, 1920];

async function blockingAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const blocking: typeof results.violations = [];
  for (const violation of results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")) {
    if (violation.id !== "target-size") {
      blocking.push(violation);
      continue;
    }
    const unresolved: typeof violation.nodes = [];
    for (const node of violation.nodes) {
      const selector = Array.isArray(node.target) && typeof node.target[0] === "string" ? node.target[0] : null;
      if (!selector) {
        unresolved.push(node);
        continue;
      }
      const locator = page.locator(selector).first();
      if (await locator.count() !== 1) {
        unresolved.push(node);
        continue;
      }
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      const replay = await new AxeBuilder({ page }).withRules(["target-size"]).analyze();
      const targetKey = JSON.stringify(node.target);
      const repeated = replay.violations
        .flatMap((item) => item.nodes)
        .some((item) => JSON.stringify(item.target) === targetKey);
      if (repeated) unresolved.push(node);
    }
    if (unresolved.length) blocking.push({ ...violation, nodes: unresolved });
  }
  return blocking;
}

for (const route of coreRoutes) {
  test(`C1 multi-browser public core ${route} has no blocking accessibility or layout failure`, async ({ page, browserName }) => {
    test.setTimeout(60_000);
    for (const viewport of viewportPairs) {
      await page.setViewportSize(viewport);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${browserName}:${route}`).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${browserName}:${route}:${viewport.width}`).toBeLessThanOrEqual(1);
      expect(await blockingAccessibilityViolations(page), `${browserName}:${route}:${viewport.width}`).toEqual([]);
    }
  });
}

for (const route of detailedRoutes) {
  test(`Chromium detailed responsive matrix keeps ${route} noindex and media intact`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium");
    for (const width of chromiumWidths) {
      await page.setViewportSize({ width, height: width <= 768 ? 844 : 900 });
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route}:${width}`).toBe(route.includes("does-not-exist") ? 404 : 200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route}:${width}`).toBeLessThanOrEqual(1);
      expect(await page.locator("img").evaluateAll((images) => images.filter((image) => !(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth === 0).length), `${route}:${width}`).toBe(0);
      const robotDirectives = await page.locator('meta[name="robots"]').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("content") ?? ""),
      );
      expect(robotDirectives.length, `${route}:${width}:robots`).toBeGreaterThan(0);
      expect(robotDirectives.every((content) => /noindex/u.test(content)), `${route}:${width}:robots`).toBe(true);
    }
  });
}

test("reduced motion keeps the compact guided demo usable without scroll control", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Prueba una decisión completa." })).toBeVisible();
  await expect(page.locator('button[aria-pressed]')).toHaveCount(3);
  await expect(page.getByRole("navigation", { name: "Pasos de la demostración" }).getByRole("button")).toHaveCount(6);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).not.toContain("mandatory");
});
