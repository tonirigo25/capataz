import { expect, test } from "@playwright/test";

test.describe("pricing page v2", () => {
  test("renders the canonical catalog and technical detail", async ({ page }) => {
    await page.goto("/precios");

    await expect(page.getByRole("heading", { name: /controla hoy/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Professional", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: /comparación técnica/i })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Datos aislados por empresa" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Confirmación humana" })).toBeVisible();
  });

  test("updates all prices when annual billing is selected", async ({ page }) => {
    await page.goto("/precios");
    await page.getByRole("button", { name: /anual/i }).click();

    await expect(page.getByText("390 €", { exact: true })).toBeVisible();
    await expect(page.getByText("790 €", { exact: true })).toBeVisible();
    await expect(page.getByText("1.490 €", { exact: true })).toBeVisible();
    await expect(page.getByText("78 €", { exact: true })).toBeVisible();
    await expect(page.getByText("158 €", { exact: true })).toBeVisible();
    await expect(page.getByText("298 €", { exact: true })).toBeVisible();
  });

  test("recommender reacts without creating a transactional action", async ({ page }) => {
    await page.goto("/precios");
    const slider = page.getByRole("slider", { name: /personas/i });
    await slider.fill("12");

    await expect(page.getByText("Business", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/no se crea ninguna compra/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /comentar esta opción/i }).first()).toHaveAttribute("href", /plan=business/);
  });

  test("keeps access requests non-transactional and metadata canonical", async ({ page }) => {
    await page.goto("/precios");

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/precios$/);
    const accessLinks = page.getByRole("link", { name: /solicitar acceso/i });
    await expect(accessLinks.first()).toHaveAttribute("href", /\/contacto\?motivo=acceso/);
    await expect(page.locator('a[href*="checkout"], a[href*="stripe"]')).toHaveCount(0);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
  ]) {
    test(`has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/precios");
      await expect(page.getByRole("heading", { name: /controla hoy/i })).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow).toBe(false);
    });
  }
});
