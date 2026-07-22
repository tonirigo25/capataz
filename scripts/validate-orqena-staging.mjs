import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.ORQENA_STAGING_URL?.replace(/\/$/, "");
const password = process.env.ORQENA_STAGING_TEST_PASSWORD;
if (!baseUrl?.startsWith("https://")) throw new Error("ORQENA_STAGING_URL_HTTPS_REQUIRED");
if (!password || password.length < 16) throw new Error("ORQENA_STAGING_TEST_PASSWORD_REQUIRED");

const output = process.env.ORQENA_STAGING_REPORT_DIR ?? join(process.env.TEMP ?? process.cwd(), `orqena-staging-audit-${Date.now()}`);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewports = [[390, 844], [768, 1024], [1024, 900], [1440, 1000]];
const authenticatedRoutes = [
  ["hoy", "/hoy"], ["onboarding", "/onboarding"], ["selector", "/seleccionar-empresa"],
  ["cliente", "/clientes/staging-client-1"], ["trabajo", "/obras/staging-work-1"],
  ["presupuesto", "/presupuestos/staging-budget-1"], ["factura", "/dinero/staging-invoice-1"],
  ["agenda", "/agenda"], ["tesoreria", "/tesoreria"], ["documentos", "/documentos"],
  ["orqena", "/capataz"], ["historial", "/actividad"], ["memoria", "/configuracion"],
  ["equipo", "/equipo"], ["invitaciones", "/equipo"], ["permisos", "/equipo"],
  ["equipos", "/equipos"], ["plan-uso", "/plan-y-uso"], ["auditoria", "/auditoria"],
  ["compras", "/proveedores"], ["gastos", "/gastos-materiales"], ["plataforma", "/plataforma"],
  ["soporte", "/plataforma"], ["sin-permiso", "/acceso-restringido?reason=permission"],
  ["sin-entitlement", "/acceso-restringido?reason=entitlement"], ["limite", "/plan-y-uso"],
  ["not-found", "/ruta-staging-inexistente"]
];

async function login(page, email) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForURL(url => !url.pathname.endsWith("/login"), { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar", exact: true }).click()
  ]);
}

function captureErrors(page, errors) {
  page.on("console", message => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
  page.on("pageerror", error => errors.push(`page:${error.message}`));
  page.on("requestfailed", request => {
    const detail = request.failure()?.errorText ?? "failed";
    if (!detail.includes("ERR_ABORTED")) errors.push(`network:${request.method()} ${request.url()} ${detail}`);
  });
}

mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--disable-extensions", "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding"] });
const results = [];
try {
  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const publicPage = await publicContext.newPage(); const publicErrors = []; captureErrors(publicPage, publicErrors);
  for (const route of ["/", "/login", "/registro", "/recuperar-contrasena", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"]) {
    const response = await publicPage.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    results.push({ kind: "public", route, status: response?.status(), finalUrl: publicPage.url(), title: await publicPage.title() });
  }
  if (publicErrors.length) throw new Error(JSON.stringify({ publicErrors }));
  await publicContext.close();

  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage(); const errors = []; captureErrors(page, errors);
    await login(page, "multi@staging.orqena.invalid");
    await page.goto(`${baseUrl}/seleccionar-empresa`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const businessButton = page.getByRole("button", { name: /Orqena Staging Multi/ });
    if (await businessButton.count() === 1) await businessButton.click();
    for (const [name, route] of authenticatedRoutes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      const file = join(output, `${name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true, caret: "initial" });
      if (statSync(file).size < 2500) throw new Error(`INVALID_SCREENSHOT:${file}`);
      if (overflow) throw new Error(`OVERFLOW:${route}:${width}`);
      if (errors.length) throw new Error(JSON.stringify({ route, width, errors: errors.splice(0) }));
      results.push({ kind: "authenticated", route, width, height, status: response?.status(), finalUrl: page.url(), overflow, screenshot: file });
    }
    await context.close();
  }

  const negativeContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const negative = await negativeContext.newPage(); const negativeErrors = []; captureErrors(negative, negativeErrors);
  await login(negative, "viewer@staging.orqena.invalid");
  const platformResponse = await negative.goto(`${baseUrl}/plataforma`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const platformDenied = !negative.url().endsWith("/plataforma") || (await negative.getByText("No tienes permiso").count()) > 0;
  const foreignResponse = await negative.goto(`${baseUrl}/clientes/staging-client-1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const foreignDenied = foreignResponse?.status() === 404 || !negative.url().includes("staging-client-1");
  if (!platformDenied || !foreignDenied || negativeErrors.length) throw new Error(JSON.stringify({ platformDenied, foreignDenied, negativeErrors }));
  results.push({ kind: "negative", platformDenied, foreignDenied });
  await negativeContext.close();

  const report = { ok: true, baseUrl, sha: process.env.ORQENA_STAGING_SHA, browser: "Google Chrome headless", viewports, screenshots: authenticatedRoutes.length * viewports.length, output, results };
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, screenshots: report.screenshots, checks: results.length, output }, null, 2));
} finally {
  await browser.close();
}
