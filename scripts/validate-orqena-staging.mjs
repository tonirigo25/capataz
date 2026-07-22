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

async function navigate(page, url) {
  try {
    return await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (error) {
    if (!String(error).includes("ERR_ABORTED")) throw error;
    await page.waitForLoadState("domcontentloaded");
    return undefined;
  }
}

async function login(page, email) {
  await navigate(page, `${baseUrl}/login`);
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
    const response = await navigate(publicPage, `${baseUrl}${route}`);
    results.push({ kind: "public", route, status: response?.status(), finalUrl: publicPage.url(), title: await publicPage.title() });
  }
  if (publicErrors.length) throw new Error(JSON.stringify({ publicErrors }));
  await publicContext.close();

  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage(); const errors = []; captureErrors(page, errors);
    await login(page, "multi@staging.orqena.invalid");
    await navigate(page, `${baseUrl}/seleccionar-empresa`);
    const businessButton = page.getByRole("button", { name: /Orqena Staging Multi/ });
    if (await businessButton.count() === 1) await businessButton.click();
    for (const [name, route] of authenticatedRoutes) {
      const response = await navigate(page, `${baseUrl}${route}`);
      await page.waitForTimeout(250);
      let overflow;
      try {
        overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      } catch {
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(200);
        overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      }
      const file = join(output, `${name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true, caret: "initial" });
      if (statSync(file).size < 2500) throw new Error(`INVALID_SCREENSHOT:${file}`);
      if (overflow) throw new Error(`OVERFLOW:${route}:${width}`);
      const routeErrors = errors.splice(0);
      const unexpectedErrors = name === "not-found" ? routeErrors.filter(error => !error.includes("status of 404")) : routeErrors;
      if (unexpectedErrors.length) throw new Error(JSON.stringify({ route, width, errors: unexpectedErrors }));
      results.push({ kind: "authenticated", route, width, height, status: response?.status(), finalUrl: page.url(), overflow, screenshot: file });
    }
    await context.close();

    const platformContext = await browser.newContext({ viewport: { width, height } });
    const platformPage = await platformContext.newPage(); const platformErrors = []; captureErrors(platformPage, platformErrors);
    await login(platformPage, "owner@staging.orqena.invalid");
    const platformOwnerResponse = await navigate(platformPage, `${baseUrl}/plataforma`);
    const platformFile = join(output, `plataforma-owner-${width}.png`);
    await platformPage.screenshot({ path: platformFile, fullPage: true, caret: "initial" });
    if (platformOwnerResponse?.status() !== 200 || platformErrors.length) throw new Error(JSON.stringify({ platformOwnerResponse: platformOwnerResponse?.status(), platformErrors }));
    results.push({ kind: "platform-owner", route: "/plataforma", width, height, status: platformOwnerResponse.status(), screenshot: platformFile });
    await platformContext.close();
  }

  const negativeContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const negative = await negativeContext.newPage(); const negativeErrors = []; captureErrors(negative, negativeErrors);
  await login(negative, "viewer@staging.orqena.invalid");
  const platformResponse = await navigate(negative, `${baseUrl}/plataforma`);
  await negative.waitForURL(url => !url.pathname.endsWith("/plataforma"), { timeout: 10_000 }).catch(() => {});
  const platformDenied = (platformResponse?.status() ?? 200) >= 400 || !negative.url().endsWith("/plataforma") || (await negative.getByText("Acceso restringido").count()) > 0;
  if (!platformDenied || negativeErrors.length) throw new Error(JSON.stringify({ platformDenied, status: platformResponse?.status(), url: negative.url(), headings: await negative.locator("h1").allTextContents(), negativeErrors }));
  results.push({ kind: "negative", platformDenied, status: platformResponse?.status() });
  await negativeContext.close();

  const foreignContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const foreign = await foreignContext.newPage(); const foreignErrors = []; captureErrors(foreign, foreignErrors);
  await login(foreign, "owner@staging.orqena.invalid");
  const foreignResponse = await navigate(foreign, `${baseUrl}/clientes/staging-client-1`);
  await foreign.waitForTimeout(800);
  const foreignDenied = (foreignResponse?.status() ?? 200) >= 400 || !foreign.url().includes("staging-client-1") || (await foreign.getByText("No encontramos esta página", { exact: true }).count()) === 1;
  if (!foreignDenied || foreignErrors.length) throw new Error(JSON.stringify({ foreignDenied, status: foreignResponse?.status(), foreignErrors }));
  results.push({ kind: "cross-company", foreignDenied, status: foreignResponse?.status() });
  await foreignContext.close();

  const report = { ok: true, baseUrl, sha: process.env.ORQENA_STAGING_SHA, browser: "Google Chrome headless", viewports, screenshots: (authenticatedRoutes.length + 1) * viewports.length, output, results };
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, screenshots: report.screenshots, checks: results.length, output }, null, 2));
} finally {
  await browser.close();
}
