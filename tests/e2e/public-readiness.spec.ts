import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public surface is reachable, non-indexable and has no serious accessibility findings", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toContainText("Orqena");
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow:\s*\//u);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
});

test("security headers and rollback aliases stay coherent", async ({ page }) => {
  const response = await page.goto("/marketing-v2");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toBeTruthy();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
});
