import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "playwright";

const EXPECTED_ORIGIN = "https://orqena-review-web-review.up.railway.app";
const baseUrl = (process.env.ORQENA_REVIEW_BASE_URL ?? EXPECTED_ORIGIN).replace(/\/$/u, "");
const password = process.env.ORQENA_REVIEW_QA_PASSWORD;
const ownerMfaToken = process.env.ORQENA_REVIEW_OWNER_TOTP;
const deployedSha = process.env.ORQENA_REVIEW_SHA ?? "unknown";
const outputRoot = process.env.ORQENA_REVIEW_AUDIT_DIR ?? join(process.cwd(), "artifacts", "review-auth");
const screenshotRoot = join(outputRoot, "screenshots");
const reportPath = join(outputRoot, "authenticated-matrix.json");

if (baseUrl !== EXPECTED_ORIGIN) throw new Error(`REVIEW_ORIGIN_MISMATCH:${baseUrl}`);
if (!password || password.length < 24) throw new Error("ORQENA_REVIEW_QA_PASSWORD_REQUIRED");
if (!ownerMfaToken || !/^\d{6}$/u.test(ownerMfaToken)) throw new Error("ORQENA_REVIEW_OWNER_TOTP_REQUIRED");

mkdirSync(screenshotRoot, { recursive: true });

const profiles = [
  { key: "owner", profile: "OWNER", allowed: "/plataforma" },
  { key: "general-manager", profile: "GENERAL_MANAGER", allowed: "/obras", denied: "/tesoreria" },
  { key: "admin", profile: "ADMINISTRATIVE", allowed: "/clientes", denied: "/dinero" },
  { key: "sales", profile: "SALES", allowed: "/presupuestos", denied: "/tesoreria" },
  { key: "finance", profile: "FINANCE", allowed: "/tesoreria", denied: "/clientes" },
  { key: "procurement", profile: "PROCUREMENT_MANAGER", allowed: "/proveedores", denied: "/clientes" },
  { key: "project-manager", profile: "PROJECT_MANAGER", allowed: "/obras", denied: "/clientes" },
  { key: "supervisor", profile: "TEAM_SUPERVISOR", allowed: "/obras", denied: "/clientes" },
  { key: "worker", profile: "WORKER", allowed: "/tareas", denied: "/clientes" },
  { key: "external", profile: "EXTERNAL_COLLABORATOR", allowed: "/obras", restrictedInline: "/capataz" },
  { key: "viewer", profile: "ADVISOR_AUDITOR", allowed: "/auditoria", denied: "/clientes", readOnly: true },
];

const viewports = [
  { key: "320", width: 320, height: 720 },
  { key: "390", width: 390, height: 844 },
  { key: "768", width: 768, height: 1024 },
  { key: "1024", width: 1024, height: 900 },
  { key: "1440", width: 1440, height: 1000 },
  { key: "1920", width: 1920, height: 1080 },
];

const ownerSurfaceFamilies = [
  { family: "onboarding", route: "/onboarding" },
  { family: "company-create", route: "/crear-empresa" },
  { family: "company-select", route: "/seleccionar-empresa" },
  { family: "today", route: "/hoy" },
  { family: "dashboard", route: "/dashboard" },
  { family: "clients", route: "/clientes" },
  { family: "client-360", route: "/clientes/review-client-1" },
  { family: "works", route: "/obras" },
  { family: "work-360", route: "/obras/review-work-1" },
  { family: "budgets", route: "/presupuestos" },
  { family: "budget-detail", route: "/presupuestos/review-budget-1" },
  { family: "budget-templates", route: "/presupuestos/plantillas" },
  { family: "invoices", route: "/dinero" },
  { family: "invoice-detail", route: "/dinero/review-invoice-1" },
  { family: "treasury", route: "/tesoreria" },
  { family: "expenses-materials", route: "/gastos-materiales" },
  { family: "document-reader", route: "/gastos-materiales/lector" },
  { family: "suppliers", route: "/proveedores" },
  { family: "subcontractors", route: "/subcontratas" },
  { family: "supplier-invoices", route: "/facturas-proveedor" },
  { family: "subcontractor-invoices", route: "/facturas-subcontratas" },
  { family: "agenda", route: "/agenda" },
  { family: "activity", route: "/actividad" },
  { family: "tasks", route: "/tareas" },
  { family: "task-detail", route: "/tareas/review-task-1" },
  { family: "followups", route: "/seguimientos" },
  { family: "reminders", route: "/recordatorios" },
  { family: "alerts", route: "/alertas" },
  { family: "documents", route: "/documentos" },
  { family: "automations", route: "/automatizaciones" },
  { family: "recommendations", route: "/recomendaciones" },
  { family: "recommendation-control", route: "/recomendaciones/control" },
  { family: "orqena", route: "/capataz" },
  { family: "team-access", route: "/equipo" },
  { family: "teams-scopes", route: "/equipos" },
  { family: "settings", route: "/configuracion" },
  { family: "plan-usage", route: "/plan-y-uso" },
  { family: "privacy", route: "/configuracion/privacidad" },
  { family: "support", route: "/configuracion/soporte" },
  { family: "audit", route: "/auditoria" },
  { family: "intelligence", route: "/inteligencia" },
  { family: "notifications", route: "/notificaciones" },
  { family: "search", route: "/buscar" },
  { family: "platform", route: "/plataforma" },
  { family: "platform-observability", route: "/plataforma/observabilidad" },
  { family: "platform-health", route: "/plataforma/salud" },
];

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  origin: baseUrl,
  deployedSha,
  syntheticOnly: true,
  credentialsPersisted: false,
  viewports,
  profiles: [],
  ownerSurfaces: [],
  stateCoverage: {
    populated: "AUTOMATED",
    responsive: "AUTOMATED",
    readOnly: "AUTOMATED",
    restricted: "AUTOMATED",
    privilegedMfa: "AUTOMATED",
    empty: "PENDING_BATCH",
    loading: "PENDING_BATCH",
    error: "PENDING_BATCH",
    offline: "PENDING_BATCH",
    keyboard: "PENDING_MANUAL_AND_AUTOMATED",
    screenReader: "READY_FOR_EXTERNAL_INPUT",
    zoom: "PENDING_BATCH",
  },
  blockingFindings: [],
  productObservations: [],
};

function sanitize(value) {
  return String(value)
    .replace(/([?&](?:token|code|secret|password)=)[^&\s]+/giu, "$1[REDACTED]")
    .replace(/[A-Za-z0-9_-]{48,}/gu, "[LONG_VALUE_REDACTED]")
    .slice(0, 800);
}

function attachDiagnostics(page) {
  const events = [];
  const externalHosts = new Set();
  const expected = new URL(baseUrl);
  page.on("console", (message) => {
    if (message.type() === "error") events.push(`console:${sanitize(message.text())}`);
  });
  page.on("pageerror", (error) => events.push(`page:${sanitize(error.message)}`));
  page.on("request", (request) => {
    const url = request.url();
    if (/^(?:data|blob|about):/u.test(url)) return;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== expected.origin) externalHosts.add(parsed.host);
    } catch {
      events.push(`network:invalid-url:${sanitize(url)}`);
    }
  });
  page.on("requestfailed", (request) => {
    const detail = request.failure()?.errorText ?? "failed";
    if (!detail.includes("ERR_ABORTED")) events.push(`network:${request.method()}:${sanitize(request.url())}:${sanitize(detail)}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) events.push(`http:${response.status()}:${sanitize(response.url())}`);
  });
  return { events, externalHosts };
}

async function waitForSettled(page, route) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
  await page.waitForTimeout(350);
  await page.waitForFunction(() => {
    const loading = document.querySelectorAll("[aria-busy='true'], [data-skeleton], .animate-pulse");
    return loading.length === 0 && !/Cargando(?:\s+[^.\n…]{1,80})?(?:…|\.\.\.)/iu.test(document.body.innerText);
  }, undefined, { timeout: 20_000 }).catch(() => {
    throw new Error(`LOADING_NOT_SETTLED:${route}`);
  });
}

async function login(browser, profile) {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const response = await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (response?.status() !== 200) throw new Error(`LOGIN_PAGE_STATUS:${profile.key}:${response?.status() ?? 0}`);
  await page.getByLabel("Correo").fill(`${profile.key}@review.orqena.invalid`);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
  await waitForSettled(page, `/login:${profile.key}`);
  const pathname = new URL(page.url()).pathname;
  if (!["/hoy", "/onboarding"].includes(pathname)) throw new Error(`LOGIN_DESTINATION:${profile.key}:${pathname}`);
  if (profile.key === "owner") {
    await page.goto(`${baseUrl}/configuracion/seguridad?required=platform`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForSettled(page, "/configuracion/seguridad:owner");
    const code = page.getByLabel("Código de seis cifras");
    if (await code.count() !== 1) throw new Error("OWNER_MFA_CHALLENGE_MISSING");
    await code.fill(ownerMfaToken);
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await page.getByText("Segundo factor verificado durante las últimas 12 horas.").waitFor({ state: "visible", timeout: 30_000 });
  }
  if (diagnostics.events.length) throw new Error(`LOGIN_DIAGNOSTICS:${profile.key}:${JSON.stringify(diagnostics.events)}`);
  if (diagnostics.externalHosts.size) throw new Error(`LOGIN_EXTERNAL_NETWORK:${profile.key}:${[...diagnostics.externalHosts].join(",")}`);
  const storageState = await context.storageState();
  await context.close();
  return storageState;
}

async function auditCurrentPage(page, route, { axe = false } = {}) {
  const state = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const headings = [...document.querySelectorAll("h1")].filter(visible);
    const primaryActions = [...document.querySelectorAll("a.primary-button, button.primary-button")].filter(visible);
    const brokenImages = [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src);
    return {
      title: document.title,
      h1Count: headings.length,
      h1: headings[0]?.textContent?.trim() ?? null,
      mainCount: [...document.querySelectorAll("main")].filter(visible).length,
      overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      brokenImages,
      primaryActionCount: primaryActions.length,
      primaryActions: primaryActions.slice(0, 8).map((element) => element.textContent?.trim()).filter(Boolean),
      objectiveAboveFold: headings.length === 1 && headings[0].getBoundingClientRect().top < window.innerHeight,
      readOnlyText: /solo lectura|modo lectura|lectura/i.test(document.body.innerText),
      restrictedText: /no tienes acceso|acceso restringido|tu portal no incluye/i.test(document.body.innerText),
    };
  });
  let accessibility = { criticalOrSerious: 0, violations: [] };
  if (axe) {
    let result;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        break;
      } catch (error) {
        if (attempt === 2 || !String(error).includes("Execution context was destroyed")) throw error;
        await waitForSettled(page, `${route}:axe-retry`);
      }
    }
    const blocking = result.violations.filter(({ impact }) => impact === "critical" || impact === "serious");
    accessibility = {
      criticalOrSerious: blocking.length,
      violations: blocking.map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.length,
        targets: nodes.slice(0, 8).map((node) => ({
          target: node.target.map(String),
          failureSummary: sanitize(node.failureSummary ?? ""),
        })),
      })),
    };
  }
  return { route, ...state, accessibility };
}

async function navigateAndAudit(page, route, options = {}) {
  const startedAt = Date.now();
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForSettled(page, route);
  return {
    status: response?.status() ?? 0,
    finalPath: new URL(page.url()).pathname,
    durationMs: Date.now() - startedAt,
    ...(await auditCurrentPage(page, route, options)),
  };
}

function caseFindings({ result, diagnostics, profile, viewport, expectation }) {
  const context = `${profile}:${viewport}:${result.route}`;
  const findings = [];
  if (result.status >= 500 || result.status === 0) findings.push(`${context}:HTTP_${result.status}`);
  if (result.h1Count !== 1) findings.push(`${context}:H1_COUNT_${result.h1Count}`);
  if (result.mainCount !== 1) findings.push(`${context}:MAIN_COUNT_${result.mainCount}`);
  if (!result.objectiveAboveFold) findings.push(`${context}:OBJECTIVE_NOT_ABOVE_FOLD`);
  if (result.overflowPx > 1) findings.push(`${context}:OVERFLOW_${result.overflowPx}`);
  if (result.brokenImages.length) findings.push(`${context}:BROKEN_IMAGES_${result.brokenImages.length}`);
  if (result.accessibility.criticalOrSerious) findings.push(`${context}:AXE_${result.accessibility.criticalOrSerious}`);
  if (diagnostics.events.length) findings.push(`${context}:DIAGNOSTICS_${diagnostics.events.length}`);
  if (diagnostics.externalHosts.size) findings.push(`${context}:EXTERNAL_NETWORK_${[...diagnostics.externalHosts].join(",")}`);
  if (expectation === "allowed" && ["/login", "/acceso-restringido"].includes(result.finalPath)) findings.push(`${context}:UNEXPECTED_DENIAL_${result.finalPath}`);
  if (expectation === "denied" && result.finalPath !== "/acceso-restringido") findings.push(`${context}:DENIAL_BYPASS_${result.finalPath}`);
  if (expectation === "restricted-inline" && (!result.restrictedText || result.finalPath !== result.route)) findings.push(`${context}:INLINE_RESTRICTION_MISSING_${result.finalPath}`);
  return findings;
}

async function collectDesktopNavigation(page) {
  const primary = await page.locator("nav[aria-label='Navegación principal'] a[href]").evaluateAll((links) =>
    links.map((link) => ({ href: link.getAttribute("href"), label: link.textContent?.trim() })).filter(({ href }) => href)
  );
  const more = page.getByRole("button", { name: "Más", exact: true });
  if (await more.count()) {
    await more.first().click();
    await page.locator("#desktop-more-navigation").waitFor({ state: "visible" });
  }
  const secondary = await page.locator("#desktop-more-navigation a[href]").evaluateAll((links) =>
    links.map((link) => ({ href: link.getAttribute("href"), label: link.textContent?.trim() })).filter(({ href }) => href)
  );
  return [...primary, ...secondary];
}

async function auditProfileHome(browser, profile, storageState, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    storageState,
    serviceWorkers: "block",
    colorScheme: "light",
    reducedMotion: viewport.key === "390" ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = await navigateAndAudit(page, "/hoy", { axe: ["390", "1440"].includes(viewport.key) });
  const screenshot = join(screenshotRoot, `${profile.key}-hoy-${viewport.key}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const navigation = viewport.key === "1440" ? await collectDesktopNavigation(page) : [];
  const canCreate = await page.getByRole("button", { name: "Crear", exact: true }).count() > 0;
  const findings = caseFindings({
    result,
    diagnostics,
    profile: profile.key,
    viewport: viewport.key,
    expectation: "allowed",
  });
  await context.close();
  return {
    ...result,
    viewport: viewport.key,
    reducedMotion: viewport.key === "390",
    screenshot: relative(process.cwd(), screenshot),
    navigation,
    canCreate,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
    findings,
  };
}

async function auditPermissionRoute(browser, profile, storageState, route, expectation) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = await navigateAndAudit(page, route, { axe: true });
  const findings = caseFindings({
    result,
    diagnostics,
    profile: profile.key,
    viewport: "1440",
    expectation,
  });
  await context.close();
  return {
    ...result,
    expectation,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
    findings,
  };
}

async function auditOwnerSurface(browser, storageState, surface) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = await navigateAndAudit(page, surface.route, { axe: true });
  const screenshot = join(screenshotRoot, `owner-${surface.family}-1440.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const expectation = "allowed";
  const findings = caseFindings({
    result,
    diagnostics,
    profile: "owner",
    viewport: "1440",
    expectation,
  });
  if (result.primaryActionCount > 1) {
    report.productObservations.push({
      severity: "REVIEW",
      context: `owner:1440:${surface.route}`,
      code: "MULTIPLE_PRIMARY_ACTIONS",
      count: result.primaryActionCount,
      labels: result.primaryActions,
    });
  }
  await context.close();
  return {
    family: surface.family,
    ...result,
    expectation,
    screenshot: relative(process.cwd(), screenshot),
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
    findings,
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const storageStates = new Map();
  for (const profile of profiles) storageStates.set(profile.key, await login(browser, profile));

  for (const profile of profiles) {
    const storageState = storageStates.get(profile.key);
    const profileResult = {
      key: profile.key,
      profile: profile.profile,
      readOnlyExpected: Boolean(profile.readOnly),
      homes: [],
      permissionCases: [],
    };
    for (const viewport of viewports) {
      const result = await auditProfileHome(browser, profile, storageState, viewport);
      profileResult.homes.push(result);
      report.blockingFindings.push(...result.findings);
    }
    profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, profile.allowed, "allowed"));
    if (profile.restrictedInline) profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, profile.restrictedInline, "restricted-inline"));
    if (profile.denied) profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, profile.denied, "denied"));
    for (const permissionCase of profileResult.permissionCases) report.blockingFindings.push(...permissionCase.findings);
    const desktopHome = profileResult.homes.find(({ viewport }) => viewport === "1440");
    profileResult.portalSignature = desktopHome.navigation.map(({ href }) => href).sort().join("|");
    profileResult.navigationCount = desktopHome.navigation.length;
    profileResult.canCreate = desktopHome.canCreate;
    if (profile.readOnly && profileResult.canCreate) report.blockingFindings.push(`${profile.key}:READ_ONLY_CREATE_VISIBLE`);
    report.profiles.push(profileResult);
    process.stdout.write(`AUDIT_PROFILE=${profile.key};HOMES=${profileResult.homes.length};PERMISSIONS=${profileResult.permissionCases.length}\n`);
  }

  const signatures = new Set(report.profiles.map(({ portalSignature }) => portalSignature));
  if (signatures.size < 6) report.blockingFindings.push(`PORTAL_SIGNATURE_DIVERSITY_LOW:${signatures.size}`);
  const ownerSignature = report.profiles.find(({ key }) => key === "owner")?.portalSignature;
  const workerSignature = report.profiles.find(({ key }) => key === "worker")?.portalSignature;
  if (ownerSignature === workerSignature) report.blockingFindings.push("PORTAL_SIGNATURE_OWNER_EQUALS_WORKER");

  const ownerStorageState = storageStates.get("owner");
  for (const surface of ownerSurfaceFamilies) {
    const result = await auditOwnerSurface(browser, ownerStorageState, surface);
    report.ownerSurfaces.push(result);
    report.blockingFindings.push(...result.findings);
    process.stdout.write(`AUDIT_SURFACE=${surface.family};ROUTE=${surface.route};FINAL=${result.finalPath}\n`);
  }
} finally {
  await browser.close();
}

report.blockingFindings = [...new Set(report.blockingFindings)];
report.summary = {
  ok: report.blockingFindings.length === 0,
  profileCount: report.profiles.length,
  profileViewportCases: report.profiles.reduce((total, profile) => total + profile.homes.length, 0),
  permissionCases: report.profiles.reduce((total, profile) => total + profile.permissionCases.length, 0),
  distinctPortalSignatures: new Set(report.profiles.map(({ portalSignature }) => portalSignature)).size,
  ownerSurfaceFamilies: report.ownerSurfaces.length,
  axeCases:
    report.profiles.reduce((total, profile) => total + profile.homes.filter(({ viewport }) => ["390", "1440"].includes(viewport)).length, 0)
    + report.profiles.reduce((total, profile) => total + profile.permissionCases.length, 0)
    + report.ownerSurfaces.length,
  productObservations: report.productObservations.length,
  blockingFindings: report.blockingFindings.length,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  ...report.summary,
  deployedSha,
  output: relative(process.cwd(), reportPath),
})}\n`);
if (!report.summary.ok) process.exitCode = 1;
