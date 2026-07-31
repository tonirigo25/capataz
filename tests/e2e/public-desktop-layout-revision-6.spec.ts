import { expect, test } from "@playwright/test";

const routes = [
  "/", "/producto", "/producto/clientes", "/producto/trabajo", "/producto/ventas", "/producto/compras",
  "/producto/finanzas", "/producto/agenda", "/producto/documentos", "/producto/equipo", "/producto/orqena",
  "/producto/movil", "/soluciones", "/soluciones/clientes-y-presupuestos", "/soluciones/obras-y-trabajo",
  "/soluciones/control-costes-y-margen", "/soluciones/facturacion-y-cobros", "/soluciones/proveedores-y-subcontratas",
  "/soluciones/documentos-y-ocr", "/soluciones/equipo-y-agenda", "/soluciones/ia-operativa", "/sectores",
  "/sectores/construccion", "/sectores/instalaciones-mantenimiento", "/precios", "/recursos", "/empresa", "/demo",
  "/contacto", "/seguridad", "/estado", "/privacidad", "/terminos", "/cookies", "/soporte",
  "/recursos/calculadora-margen-obra", "/recursos/checklist-factura-recibida", "/funcionalidades", "/para-autonomos",
  "/para-empresas", "/legal/aviso-legal", "/legal/privacidad", "/legal/cookies", "/legal/terminos", "/politicas", "/planes",
] as const;
const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 1000 },
  { name: "desktop-1920", width: 1920, height: 1080 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport });
    for (const route of routes) {
      test(`${route} conserva jerarquía y no desborda`, async ({ page }) => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1").first()).toBeVisible();
        const geometry = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          hero: document.querySelector("[data-public-layout='hero'], [data-hero-shell], #quick-demo")?.getBoundingClientRect().toJSON(),
        }));
        expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport + 1);
        if (geometry.hero && viewport.width >= 1440) {
          expect(geometry.hero.width).toBeGreaterThan(viewport.width * .55);
          expect(geometry.hero.width).toBeLessThanOrEqual(viewport.width + 1);
        }
      });
    }
  });
}

test("la marca superior enlaza siempre a Inicio", async ({ page }) => {
  await page.goto("/producto");
  await expect(page.locator("header a").filter({ hasText: /Orqena Tech/i }).first()).toHaveAttribute("href", "/");
});
