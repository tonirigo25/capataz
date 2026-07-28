import { expect, test } from "@playwright/test";

const routes = [
  ["home", "/"],
  ["demo", "/demo"],
  ["contact", "/contacto"],
  ["margin", "/recursos/calculadora-margen-obra"],
] as const;
const approved = process.env.ORQENA_VISUAL_BASELINE_APPROVED === "true";

for (const [name, route] of routes) {
  test(`visual candidate ${name}`, async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto(route, { waitUntil: "networkidle" });
    if (approved) {
      await expect(page).toHaveScreenshot(`${name}-1440.png`, { fullPage: true, animations: "disabled" });
    } else {
      await page.screenshot({ path: testInfo.outputPath(`${name}-1440-candidate.png`), fullPage: true, animations: "disabled" });
    }
  });
}
