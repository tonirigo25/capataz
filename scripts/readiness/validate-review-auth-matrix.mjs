import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { generate } from "otplib";
import { chromium, request as playwrightRequest } from "playwright";

const EXPECTED_ORIGIN = "https://orqena-review-web-review.up.railway.app";
const baseUrl = (process.env.ORQENA_REVIEW_BASE_URL ?? EXPECTED_ORIGIN).replace(/\/$/u, "");
const password = process.env.ORQENA_REVIEW_QA_PASSWORD;
let ownerMfaSecret = process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;
const deployedSha = process.env.ORQENA_REVIEW_SHA ?? "unknown";
const outputRoot = process.env.ORQENA_REVIEW_AUDIT_DIR ?? join(process.cwd(), "artifacts", "review-auth");
const screenshotRoot = join(outputRoot, "screenshots");
const reportPath = join(outputRoot, "authenticated-matrix.json");
const focusD3 = process.env.ORQENA_REVIEW_FOCUS_D3 === "true";

if (baseUrl !== EXPECTED_ORIGIN) throw new Error(`REVIEW_ORIGIN_MISMATCH:${baseUrl}`);
if (!password || password.length < 24) throw new Error("ORQENA_REVIEW_QA_PASSWORD_REQUIRED");
if (!ownerMfaSecret) throw new Error("ORQENA_REVIEW_OWNER_TOTP_SECRET_REQUIRED");
delete process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;

mkdirSync(screenshotRoot, { recursive: true });

const allProfiles = [
  { key: "owner", profile: "OWNER", allowed: "/plataforma", d3: { route: "/dashboard", expectation: "allowed" } },
  { key: "general-manager", profile: "GENERAL_MANAGER", allowed: "/obras", denied: "/tesoreria" },
  { key: "admin", profile: "ADMINISTRATIVE", allowed: "/clientes", denied: "/dinero" },
  { key: "sales", profile: "SALES", allowed: "/presupuestos", denied: "/tesoreria", d3: { route: "/dashboard", expectation: "denied" } },
  { key: "finance", profile: "FINANCE", allowed: "/tesoreria", denied: "/clientes", d3: { route: "/dashboard", expectation: "denied" } },
  { key: "procurement", profile: "PROCUREMENT_MANAGER", allowed: "/proveedores", denied: "/clientes", d3: { route: "/dashboard", expectation: "denied" } },
  { key: "project-manager", profile: "PROJECT_MANAGER", allowed: "/obras", denied: "/clientes" },
  { key: "supervisor", profile: "TEAM_SUPERVISOR", allowed: "/obras", denied: "/clientes" },
  { key: "worker", profile: "WORKER", allowed: "/tareas", denied: "/clientes", d3: { route: "/dashboard", expectation: "denied" } },
  { key: "external", profile: "EXTERNAL_COLLABORATOR", allowed: "/obras", restrictedInline: "/capataz" },
  { key: "viewer", profile: "ADVISOR_AUDITOR", allowed: "/auditoria", denied: "/clientes", readOnly: true },
];
const profiles = selectConfigured(allProfiles, "ORQENA_REVIEW_PROFILE_KEYS", "key");

const allViewports = [
  { key: "320", width: 320, height: 720 },
  { key: "390", width: 390, height: 844 },
  { key: "768", width: 768, height: 1024 },
  { key: "1024", width: 1024, height: 900 },
  { key: "1440", width: 1440, height: 1000 },
  { key: "1920", width: 1920, height: 1080 },
];
const viewports = selectConfigured(allViewports, "ORQENA_REVIEW_VIEWPORT_KEYS", "key");

const allOwnerSurfaceFamilies = [
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
const ownerSurfaceFamilies = selectConfigured(allOwnerSurfaceFamilies, "ORQENA_REVIEW_SURFACE_FAMILIES", "family");
if (!profiles.some(({ key }) => key === "owner")) throw new Error("ORQENA_REVIEW_OWNER_PROFILE_REQUIRED");

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  origin: baseUrl,
  deployedSha,
  syntheticOnly: true,
  credentialsPersisted: false,
  focus: focusD3 ? "D3" : "FULL",
  viewports,
  profiles: [],
  ownerSurfaces: [],
  loginCases: [],
  stateCases: [],
  authenticatedCapacity: null,
  stateCoverage: {
    populated: "AUTOMATED",
    responsive: "AUTOMATED",
    readOnly: "AUTOMATED",
    restricted: "AUTOMATED",
    privilegedMfa: "AUTOMATED",
    empty: "PENDING_REMOTE_BATCH",
    loading: "PENDING_REMOTE_BATCH",
    error: "PENDING_REMOTE_BATCH",
    offline: "PENDING_REMOTE_BATCH",
    keyboard: "PENDING_REMOTE_BATCH",
    screenReader: "READY_FOR_EXTERNAL_INPUT",
    zoom: "PENDING_REMOTE_REFLOW_EQUIVALENT_AND_MANUAL_REAL_ZOOM",
  },
  blockingFindings: [],
  productObservations: [],
};

function selectConfigured(items, environmentKey, itemKey) {
  const requested = process.env[environmentKey]?.split(",").map((value) => value.trim()).filter(Boolean);
  if (!requested?.length) return items;
  const available = new Map(items.map((item) => [item[itemKey], item]));
  const unknown = requested.filter((key) => !available.has(key));
  if (unknown.length) throw new Error(`${environmentKey}_UNKNOWN:${unknown.join(",")}`);
  return requested.map((key) => available.get(key));
}

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
  const startedAt = Date.now();
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
    const totpStepMs = 30_000;
    const remainingInStepMs = totpStepMs - (Date.now() % totpStepMs);
    if (remainingInStepMs < 5_000) await page.waitForTimeout(remainingInStepMs + 250);
    const currentOwnerMfaToken = await generate({ secret: ownerMfaSecret, epoch: Math.floor(Date.now() / 1_000) });
    ownerMfaSecret = undefined;
    await code.fill(currentOwnerMfaToken);
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await page.getByText("Segundo factor verificado durante las últimas 12 horas.").waitFor({ state: "visible", timeout: 30_000 });
  }
  const hydrationDiagnostics = diagnostics.events.filter((event) => event.includes("Minified React error #418"));
  const unexpectedDiagnostics = diagnostics.events.filter((event) => !event.includes("Minified React error #418"));
  if (hydrationDiagnostics.length) {
    report.blockingFindings.push(`LOGIN_HYDRATION:${profile.key}:REACT_418`);
  }
  if (unexpectedDiagnostics.length) throw new Error(`LOGIN_DIAGNOSTICS:${profile.key}:${JSON.stringify(unexpectedDiagnostics)}`);
  if (diagnostics.externalHosts.size) throw new Error(`LOGIN_EXTERNAL_NETWORK:${profile.key}:${[...diagnostics.externalHosts].join(",")}`);
  const storageState = await context.storageState();
  await context.close();
  return { storageState, durationMs: Date.now() - startedAt, hydrationDiagnostics: hydrationDiagnostics.length };
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
      priorityCount: Number(document.querySelector("[data-priority-count]")?.getAttribute("data-priority-count") ?? 0),
      priorityContract: /Prioridades de hoy/iu.test(document.body.innerText)
        && (/Origen:/iu.test(document.body.innerText) && /Impacto:/iu.test(document.body.innerText)
          || /No hay prioridades disponibles en tu alcance/iu.test(document.body.innerText)),
      dashboardPrimaryKpiCount: Number(document.querySelector("[data-dashboard-primary-kpis]")?.getAttribute("data-dashboard-primary-kpis") ?? 0),
      dashboardContract: ["Evolución del periodo", "Excepciones", "Posición económica"].every((label) => document.body.innerText.includes(label)),
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

async function navigateWithTransportRetry(page, route) {
  const url = `${baseUrl}${route}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    } catch (error) {
      lastError = error;
      const message = String(error);
      const retryable = /Timeout|net::ERR_|Target page, context or browser has been closed/u.test(message);
      if (!retryable || attempt === 3) throw error;
      process.stdout.write(`AUDIT_NAVIGATION_RETRY=${route};ATTEMPT=${attempt};REASON=transport\n`);
      await page.waitForTimeout(attempt * 750);
    }
  }
  throw lastError;
}

async function navigateAndAudit(page, route, options = {}) {
  const startedAt = Date.now();
  const response = await navigateWithTransportRetry(page, route);
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
  if (focusD3 && result.route === "/hoy" && (result.priorityCount > 3 || !result.priorityContract)) {
    findings.push(`${context}:D3_TODAY_CONTRACT_${result.priorityCount}`);
  }
  if (focusD3 && result.route === "/dashboard" && expectation === "allowed" && (result.dashboardPrimaryKpiCount !== 4 || !result.dashboardContract)) {
    findings.push(`${context}:D3_DASHBOARD_CONTRACT_${result.dashboardPrimaryKpiCount}`);
  }
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

async function openProfileHome(browser, storageState, viewport) {
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
  return { context, page, diagnostics, result };
}

async function auditProfileHome(browser, profile, storageState, viewport) {
  let attempt = await openProfileHome(browser, storageState, viewport);
  let transientDiagnostics = [];
  const hydrationOnly = attempt.diagnostics.events.length > 0
    && attempt.diagnostics.events.every((event) => event.includes("Minified React error #418"));
  if (hydrationOnly) {
    transientDiagnostics = [...attempt.diagnostics.events];
    await attempt.context.close();
    attempt = await openProfileHome(browser, storageState, viewport);
    report.productObservations.push({
      severity: attempt.diagnostics.events.length ? "BLOCKER" : "REVIEW",
      context: `${profile.key}:${viewport.key}:/hoy`,
      code: "HYDRATION_REPLAY",
      firstAttempt: transientDiagnostics,
      replayDiagnostics: attempt.diagnostics.events,
    });
  }

  const { context, page, diagnostics, result } = attempt;
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
    transientDiagnostics,
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

async function openOwnerSurface(browser, storageState, route) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = await navigateAndAudit(page, route, { axe: true });
  return { context, page, diagnostics, result };
}

async function auditOwnerSurface(browser, storageState, surface) {
  let attempt = await openOwnerSurface(browser, storageState, surface.route);
  let transientDiagnostics = [];
  const hydrationOnly = attempt.diagnostics.events.length > 0
    && attempt.diagnostics.events.every((event) => event.includes("Minified React error #418"));
  if (hydrationOnly) {
    transientDiagnostics = [...attempt.diagnostics.events];
    await attempt.context.close();
    attempt = await openOwnerSurface(browser, storageState, surface.route);
    report.productObservations.push({
      severity: attempt.diagnostics.events.length ? "BLOCKER" : "REVIEW",
      context: `owner:1440:${surface.route}`,
      code: "HYDRATION_REPLAY",
      firstAttempt: transientDiagnostics,
      replayDiagnostics: attempt.diagnostics.events,
    });
  }

  const { context, page, diagnostics, result } = attempt;
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
    transientDiagnostics,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
    findings,
  };
}

function percentile(values, value) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * value) - 1)];
}

async function auditAuthenticatedCapacity(storageState) {
  const paths = ["/hoy", "/dashboard", "/clientes"];
  const requestsPerPath = 15;
  const concurrency = 5;
  const api = await playwrightRequest.newContext({
    baseURL: baseUrl,
    storageState,
    extraHTTPHeaders: { "user-agent": "orqena-review-auth-capacity-v1" },
  });
  const results = [];
  try {
    for (const path of paths) {
      const queue = Array.from({ length: requestsPerPath }, (_, index) => index);
      const durations = [];
      const bytes = [];
      let failures = 0;
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (queue.length) {
          queue.pop();
          const startedAt = performance.now();
          try {
            const response = await api.get(path, { failOnStatusCode: false });
            if (response.status() !== 200) failures += 1;
            bytes.push((await response.body()).byteLength);
          } catch {
            failures += 1;
            bytes.push(0);
          }
          durations.push(performance.now() - startedAt);
        }
      }));
      const p95Ms = Math.round(percentile(durations, 0.95));
      const p99Ms = Math.round(percentile(durations, 0.99));
      const caseResult = {
        path,
        requests: durations.length,
        concurrency,
        failures,
        p95Ms,
        p99Ms,
        responseBytes: bytes.reduce((total, value) => total + value, 0),
      };
      if (failures) report.blockingFindings.push(`AUTH_CAPACITY:${path}:FAILURES_${failures}`);
      if (p95Ms > 5_000) report.blockingFindings.push(`AUTH_CAPACITY:${path}:P95_${p95Ms}`);
      results.push(caseResult);
    }
  } finally {
    await api.dispose();
  }
  return {
    syntheticOnly: true,
    productionCapacityClaim: false,
    thresholds: { requestsPerPath, concurrency, maxP95Ms: 5_000 },
    results,
  };
}

async function auditRepresentativeStates(browser, storageState) {
  const cases = [];

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState, serviceWorkers: "block" });
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);
    const route = "/clientes?buscar=__orqena_review_empty_state__";
    const result = await navigateAndAudit(page, route, { axe: true });
    const emptyVisible = await page.getByText("No hay clientes para estos filtros", { exact: true }).count() === 1;
    const screenshot = join(screenshotRoot, "owner-state-empty-1440.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    const findings = caseFindings({ result, diagnostics, profile: "owner-state", viewport: "1440", expectation: "allowed" });
    if (!emptyVisible) findings.push("owner-state:empty:EMPTY_STATE_MISSING");
    cases.push({
      state: "empty",
      ok: findings.length === 0,
      route,
      screenshot: relative(process.cwd(), screenshot),
      emptyVisible,
      diagnostics: diagnostics.events,
      findings,
    });
    report.blockingFindings.push(...findings);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState, serviceWorkers: "block" });
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);
    const route = "/hoy?__orqena_review_state=loading";
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "commit", timeout: 60_000 });
    const loading = page.getByRole("status", { name: /Cargando prioridades|Cargando los datos/u }).first();
    const loadingVisible = await loading.waitFor({ state: "visible", timeout: 2_500 }).then(() => true).catch(() => false);
    const screenshot = join(screenshotRoot, "owner-state-loading-1440.png");
    if (loadingVisible) await page.screenshot({ path: screenshot, fullPage: true });
    await waitForSettled(page, route);
    const settled = await auditCurrentPage(page, route, { axe: true });
    const findings = caseFindings({
      result: { status: response?.status() ?? 0, finalPath: new URL(page.url()).pathname, ...settled },
      diagnostics,
      profile: "owner-state",
      viewport: "1440",
      expectation: "allowed",
    });
    if (!loadingVisible) findings.push("owner-state:loading:LOADING_STATE_NOT_OBSERVED");
    cases.push({
      state: "loading",
      ok: findings.length === 0,
      route,
      screenshot: loadingVisible ? relative(process.cwd(), screenshot) : null,
      loadingVisible,
      diagnostics: diagnostics.events,
      findings,
    });
    report.blockingFindings.push(...findings);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState, serviceWorkers: "block" });
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);
    const route = "/hoy?__orqena_review_state=error";
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const errorHeading = page.getByRole("heading", { level: 1, name: "No se pudo preparar tu día", exact: true });
    const errorVisible = await errorHeading.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    const retryVisible = await page.getByRole("button", { name: "Reintentar", exact: true }).count() === 1;
    const mainCount = await page.locator("main").count();
    const screenshot = join(screenshotRoot, "owner-state-error-1440.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    const expectedDiagnostics = diagnostics.events.filter((event) =>
      event.includes("CONTINUOUS_REVIEW_SYNTHETIC_RENDER_ERROR")
      || event.includes("No se pudo preparar tu día")
      || event.includes("Error controlado")
      || event === "console:Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error."
    );
    const unexpectedDiagnostics = diagnostics.events.filter((event) => !expectedDiagnostics.includes(event));
    const findings = [];
    if (!errorVisible) findings.push("owner-state:error:ERROR_STATE_NOT_OBSERVED");
    if (!retryVisible) findings.push("owner-state:error:RETRY_ACTION_MISSING");
    if (mainCount !== 1) findings.push(`owner-state:error:MAIN_COUNT_${mainCount}`);
    if (unexpectedDiagnostics.length) findings.push(`owner-state:error:UNEXPECTED_DIAGNOSTICS_${unexpectedDiagnostics.length}`);
    await page.goto(`${baseUrl}/hoy`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForSettled(page, "/hoy:error-recovery");
    const recovered = await page.locator("main h1").count() === 1;
    if (!recovered) findings.push("owner-state:error:RECOVERY_FAILED");
    cases.push({
      state: "error",
      ok: findings.length === 0,
      route,
      status: response?.status() ?? 0,
      screenshot: relative(process.cwd(), screenshot),
      errorVisible,
      retryVisible,
      recovered,
      expectedDiagnostics,
      unexpectedDiagnostics,
      findings,
    });
    report.blockingFindings.push(...findings);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, storageState, serviceWorkers: "allow" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/hoy`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForSettled(page, "/hoy:offline-prime");
    const registered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      return Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 10_000)),
      ]);
    }).catch(() => false);
    if (registered && !await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
      await waitForSettled(page, "/hoy:offline-control");
    }
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)).catch(() => false);
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const offlineVisible = await page.getByText("Sin conexión", { exact: true }).count() > 0;
    const screenshot = join(screenshotRoot, "owner-state-offline-1024.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await context.setOffline(false);
    await page.goto(`${baseUrl}/hoy`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForSettled(page, "/hoy:offline-recovery");
    const recovered = await page.locator("main h1").count() === 1;
    const findings = [];
    if (!registered) findings.push("owner-state:offline:SERVICE_WORKER_NOT_REGISTERED");
    if (!controlled) findings.push("owner-state:offline:SERVICE_WORKER_NOT_CONTROLLING");
    if (!offlineVisible) findings.push("owner-state:offline:OFFLINE_STATE_NOT_OBSERVED");
    if (!recovered) findings.push("owner-state:offline:RECOVERY_FAILED");
    cases.push({
      state: "offline",
      ok: findings.length === 0,
      route: "/hoy",
      screenshot: relative(process.cwd(), screenshot),
      registered,
      controlled,
      offlineVisible,
      recovered,
      findings,
    });
    report.blockingFindings.push(...findings);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/hoy`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForSettled(page, "/hoy:keyboard");
    const stops = [];
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      stops.push(await page.evaluate(() => {
        const element = document.activeElement;
        const rect = element?.getBoundingClientRect();
        const style = element ? getComputedStyle(element) : null;
        return {
          tag: element?.tagName ?? null,
          text: element?.getAttribute("aria-label") ?? element?.textContent?.trim().slice(0, 80) ?? null,
          visible: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight),
          focusStyled: Boolean(style && (style.outlineStyle !== "none" || style.boxShadow !== "none")),
        };
      }));
    }
    const findings = [];
    if (stops.filter(({ visible }) => visible).length < 8) findings.push("owner-state:keyboard:VISIBLE_FOCUS_STOPS_LOW");
    if (!stops.some(({ focusStyled }) => focusStyled)) findings.push("owner-state:keyboard:FOCUS_STYLE_MISSING");
    if (stops.some(({ tag }) => !tag || tag === "BODY")) findings.push("owner-state:keyboard:FOCUS_LOST");
    cases.push({ state: "keyboard", ok: findings.length === 0, route: "/hoy", stops, findings });
    report.blockingFindings.push(...findings);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 320, height: 720 }, storageState, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/hoy`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForSettled(page, "/hoy:reflow-400-equivalent");
    const state = await page.evaluate(() => ({
      overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      mainCount: document.querySelectorAll("main").length,
      h1Count: document.querySelectorAll("main h1").length,
    }));
    const findings = [];
    if (state.overflowPx > 1) findings.push(`owner-state:reflow:OVERFLOW_${state.overflowPx}`);
    if (state.mainCount !== 1) findings.push(`owner-state:reflow:MAIN_COUNT_${state.mainCount}`);
    if (state.h1Count !== 1) findings.push(`owner-state:reflow:H1_COUNT_${state.h1Count}`);
    cases.push({
      state: "zoom-reflow-equivalent",
      ok: findings.length === 0,
      route: "/hoy",
      cssViewportWidth: 320,
      equivalence: "400% zoom at 1280 CSS px",
      manualRealZoom: "READY_FOR_EXTERNAL_INPUT",
      ...state,
      findings,
    });
    report.blockingFindings.push(...findings);
    await context.close();
  }

  return cases;
}

const browser = await chromium.launch({ headless: true });
try {
  const storageStates = new Map();
  for (const profile of profiles) {
    const loginResult = await login(browser, profile);
    storageStates.set(profile.key, loginResult.storageState);
    report.loginCases.push({
      profile: profile.key,
      durationMs: loginResult.durationMs,
      mfa: profile.key === "owner",
      hydrationDiagnostics: loginResult.hydrationDiagnostics,
    });
  }

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
    if (focusD3 && profile.d3) {
      profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, profile.d3.route, profile.d3.expectation));
    }
    for (const permissionCase of profileResult.permissionCases) report.blockingFindings.push(...permissionCase.findings);
    const desktopHome = profileResult.homes.find(({ viewport }) => viewport === "1440") ?? profileResult.homes.at(-1);
    profileResult.portalSignature = desktopHome.navigation.map(({ href }) => href).sort().join("|");
    profileResult.navigationCount = desktopHome.navigation.length;
    profileResult.canCreate = desktopHome.canCreate;
    if (profile.readOnly && profileResult.canCreate) report.blockingFindings.push(`${profile.key}:READ_ONLY_CREATE_VISIBLE`);
    report.profiles.push(profileResult);
    process.stdout.write(`AUDIT_PROFILE=${profile.key};HOMES=${profileResult.homes.length};PERMISSIONS=${profileResult.permissionCases.length}\n`);
  }

  const signatures = new Set(report.profiles.map(({ portalSignature }) => portalSignature));
  const minimumSignatureDiversity = Math.min(6, profiles.length);
  if (signatures.size < minimumSignatureDiversity) report.blockingFindings.push(`PORTAL_SIGNATURE_DIVERSITY_LOW:${signatures.size}`);
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

  report.stateCases = await auditRepresentativeStates(browser, ownerStorageState);
  report.authenticatedCapacity = await auditAuthenticatedCapacity(ownerStorageState);
  for (const stateCase of report.stateCases) process.stdout.write(`AUDIT_STATE=${stateCase.state};OK=${stateCase.ok}\n`);
  report.stateCoverage.empty = report.stateCases.find(({ state }) => state === "empty")?.ok ? "AUTOMATED_REMOTE_FILTERED_EMPTY" : "FAILED";
  report.stateCoverage.loading = report.stateCases.find(({ state }) => state === "loading")?.ok ? "AUTOMATED_REMOTE_PREVIEW_PROBE" : "FAILED";
  report.stateCoverage.error = report.stateCases.find(({ state }) => state === "error")?.ok ? "AUTOMATED_REMOTE_PREVIEW_PROBE_WITH_RECOVERY" : "FAILED";
  report.stateCoverage.offline = report.stateCases.find(({ state }) => state === "offline")?.ok ? "AUTOMATED_REMOTE_SERVICE_WORKER_WITH_RECOVERY" : "FAILED";
  report.stateCoverage.keyboard = report.stateCases.find(({ state }) => state === "keyboard")?.ok ? "AUTOMATED_REMOTE_REPRESENTATIVE" : "FAILED";
  report.stateCoverage.zoom = report.stateCases.find(({ state }) => state === "zoom-reflow-equivalent")?.ok
    ? "AUTOMATED_320PX_REFLOW_EQUIVALENT;REAL_200_400_PERCENT_READY_FOR_EXTERNAL_INPUT"
    : "FAILED";
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
  stateCases: report.stateCases.length,
  stateCasesPassed: report.stateCases.filter(({ ok }) => ok).length,
  loginP95Ms: Math.round(percentile(report.loginCases.map(({ durationMs }) => durationMs), 0.95)),
  authenticatedCapacityCases: report.authenticatedCapacity?.results.length ?? 0,
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
