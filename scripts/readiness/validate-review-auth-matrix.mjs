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
const focusD4 = process.env.ORQENA_REVIEW_FOCUS_D4 === "true";
const focusD5 = process.env.ORQENA_REVIEW_FOCUS_D5 === "true";
const focusD6 = process.env.ORQENA_REVIEW_FOCUS_D6 === "true";
const focusD7 = process.env.ORQENA_REVIEW_FOCUS_D7 === "true";

if (baseUrl !== EXPECTED_ORIGIN) throw new Error(`REVIEW_ORIGIN_MISMATCH:${baseUrl}`);
if (!password || password.length < 24) throw new Error("ORQENA_REVIEW_QA_PASSWORD_REQUIRED");
if (!ownerMfaSecret) throw new Error("ORQENA_REVIEW_OWNER_TOTP_SECRET_REQUIRED");
delete process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;

mkdirSync(screenshotRoot, { recursive: true });

const allProfiles = [
  { key: "owner", profile: "OWNER", allowed: "/plataforma", d3: { route: "/dashboard", expectation: "allowed" }, d4: { route: "/clientes/review-client-1", expectation: "allowed" }, d5: [{ route: "/obras/review-work-1", expectation: "allowed" }, { route: "/presupuestos/review-budget-1", expectation: "allowed" }, { route: "/dinero/review-invoice-1", expectation: "allowed" }, { route: "/tesoreria", expectation: "allowed" }], d6: [{ route: "/documentos", expectation: "allowed" }, { route: "/proveedores", expectation: "allowed" }, { route: "/facturas-proveedor", expectation: "allowed" }, { route: "/facturas-proveedor/review-purchase-invoice-1", expectation: "allowed" }], d7: [{ route: "/agenda", expectation: "allowed" }, { route: "/tareas", expectation: "allowed" }, { route: "/seguimientos", expectation: "allowed" }, { route: "/recordatorios", expectation: "allowed" }, { route: "/alertas", expectation: "allowed" }, { route: "/recomendaciones", expectation: "allowed" }, { route: "/automatizaciones", expectation: "allowed" }] },
  { key: "general-manager", profile: "GENERAL_MANAGER", allowed: "/obras", denied: "/tesoreria", d5: [{ route: "/obras/review-work-1", expectation: "allowed" }] },
  { key: "admin", profile: "ADMINISTRATIVE", allowed: "/clientes", denied: "/dinero", d4: { route: "/clientes/review-client-1", expectation: "allowed" } },
  { key: "sales", profile: "SALES", allowed: "/presupuestos", denied: "/tesoreria", d3: { route: "/dashboard", expectation: "denied" }, d4: { route: "/clientes/review-client-1", expectation: "allowed" }, d5: [{ route: "/presupuestos/review-budget-1", expectation: "allowed" }, { route: "/dinero/review-invoice-1", expectation: "denied" }], d7: [{ route: "/agenda", expectation: "allowed" }, { route: "/tareas", expectation: "allowed" }, { route: "/seguimientos", expectation: "allowed" }, { route: "/alertas", expectation: "allowed" }, { route: "/recomendaciones", expectation: "allowed" }, { route: "/automatizaciones", expectation: "denied" }] },
  { key: "finance", profile: "FINANCE", allowed: "/tesoreria", denied: "/clientes", d3: { route: "/dashboard", expectation: "denied" }, d5: [{ route: "/dinero/review-invoice-1", expectation: "allowed" }, { route: "/tesoreria", expectation: "allowed" }] },
  { key: "procurement", profile: "PROCUREMENT_MANAGER", allowed: "/proveedores", denied: "/clientes", d3: { route: "/dashboard", expectation: "denied" }, d6: [{ route: "/proveedores", expectation: "allowed" }, { route: "/facturas-proveedor", expectation: "allowed" }, { route: "/facturas-proveedor/review-purchase-invoice-1", expectation: "allowed" }] },
  { key: "project-manager", profile: "PROJECT_MANAGER", allowed: "/obras", denied: "/clientes", d5: [{ route: "/obras/review-work-1", expectation: "allowed" }], d7: [{ route: "/agenda", expectation: "allowed" }, { route: "/tareas", expectation: "allowed" }, { route: "/seguimientos", expectation: "denied" }, { route: "/alertas", expectation: "allowed" }, { route: "/automatizaciones", expectation: "denied" }] },
  { key: "supervisor", profile: "TEAM_SUPERVISOR", allowed: "/obras", denied: "/clientes" },
  { key: "worker", profile: "WORKER", allowed: "/tareas", denied: "/clientes", d3: { route: "/dashboard", expectation: "denied" }, d7: [{ route: "/agenda", expectation: "allowed" }, { route: "/tareas", expectation: "allowed" }, { route: "/seguimientos", expectation: "denied" }, { route: "/alertas", expectation: "denied" }, { route: "/automatizaciones", expectation: "denied" }] },
  { key: "external", profile: "EXTERNAL_COLLABORATOR", allowed: "/obras", restrictedInline: "/capataz" },
  { key: "viewer", profile: "ADVISOR_AUDITOR", allowed: "/auditoria", denied: "/clientes", readOnly: true, d5: [{ route: "/presupuestos/review-budget-1", expectation: "denied" }, { route: "/dinero/review-invoice-1", expectation: "denied" }] },
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
  { family: "document-review", route: "/gastos-materiales/lector/review-expense-document-1" },
  { family: "suppliers", route: "/proveedores" },
  { family: "supplier-detail", route: "/proveedores/review-partner-1" },
  { family: "subcontractors", route: "/subcontratas" },
  { family: "subcontractor-detail", route: "/subcontratas/review-subcontractor-1" },
  { family: "supplier-invoices", route: "/facturas-proveedor" },
  { family: "supplier-invoice-detail", route: "/facturas-proveedor/review-purchase-invoice-1" },
  { family: "subcontractor-invoices", route: "/facturas-subcontratas" },
  { family: "agenda", route: "/agenda" },
  { family: "activity", route: "/actividad" },
  { family: "tasks", route: "/tareas" },
  { family: "task-detail", route: "/tareas/review-task-1" },
  { family: "followups", route: "/seguimientos" },
  { family: "followup-detail", route: "/seguimientos/review-followup-1" },
  { family: "reminders", route: "/recordatorios" },
  { family: "alerts", route: "/alertas" },
  { family: "documents", route: "/documentos" },
  { family: "automations", route: "/automatizaciones" },
  { family: "automation-detail", route: "/automatizaciones/review-automation-1" },
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
  { family: "dashboard-mobile", route: "/dashboard", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "clients-mobile", route: "/clientes?vista=activos", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "client-360-mobile", route: "/clientes/review-client-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "work-360-mobile", route: "/obras/review-work-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "budget-detail-mobile", route: "/presupuestos/review-budget-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "invoice-detail-mobile", route: "/dinero/review-invoice-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "treasury-mobile", route: "/tesoreria", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "documents-mobile", route: "/documentos", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "document-review-mobile", route: "/gastos-materiales/lector/review-expense-document-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "suppliers-mobile", route: "/proveedores", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "supplier-detail-mobile", route: "/proveedores/review-partner-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "subcontractor-detail-mobile", route: "/subcontratas/review-subcontractor-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "supplier-invoices-mobile", route: "/facturas-proveedor", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "supplier-invoice-detail-mobile", route: "/facturas-proveedor/review-purchase-invoice-1", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "agenda-mobile", route: "/agenda", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "tasks-mobile", route: "/tareas", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "followups-mobile", route: "/seguimientos", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "reminders-mobile", route: "/recordatorios", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "alerts-mobile", route: "/alertas", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "recommendations-mobile", route: "/recomendaciones", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
  { family: "automations-mobile", route: "/automatizaciones", viewport: { key: "390", width: 390, height: 844 }, focusedOnly: true },
];
const availableOwnerSurfaceFamilies = allOwnerSurfaceFamilies.filter(({ focusedOnly }) => !focusedOnly || focusD3 || focusD4 || focusD5 || focusD6 || focusD7);
const ownerSurfaceFamilies = selectConfigured(availableOwnerSurfaceFamilies, "ORQENA_REVIEW_SURFACE_FAMILIES", "family");
if (!profiles.some(({ key }) => key === "owner")) throw new Error("ORQENA_REVIEW_OWNER_PROFILE_REQUIRED");

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  origin: baseUrl,
  deployedSha,
  syntheticOnly: true,
  credentialsPersisted: false,
  focus: focusD7 ? "D7" : focusD6 ? "D6" : focusD5 ? "D5" : focusD4 ? "D4" : focusD3 ? "D3" : "FULL",
  viewports,
  profiles: [],
  ownerSurfaces: [],
  d4Interactions: null,
  d5Interactions: null,
  d6Interactions: null,
  d7Interactions: null,
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
    if (response.status() >= 400) events.push(`http:${response.status()}:${sanitize(response.url())}`);
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
      const closedDetails = element.closest("details:not([open])");
      const visibleInsideClosedDetails = !closedDetails || closedDetails.querySelector("summary")?.contains(element);
      return visibleInsideClosedDetails && style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const visibleText = document.body.innerText.toLocaleLowerCase("es");
    const availableText = (document.body.textContent ?? "").toLocaleLowerCase("es");
    const containsAll = (source, labels) => labels.every((label) => source.includes(label.toLocaleLowerCase("es")));
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
      clientSmartViewCount: Number(document.querySelector("[data-client-smart-views]")?.getAttribute("data-client-smart-views") ?? 0),
      clientListSplitVisible: Boolean([...document.querySelectorAll("[data-client-list-split]")].find(visible)),
      clientMobileCardsVisible: Boolean([...document.querySelectorAll("[data-client-mobile-cards]")].find(visible)),
      clientDetailAreaCount: Number(document.querySelector("[data-client-detail-areas]")?.getAttribute("data-client-detail-areas") ?? 0),
      clientContextDrawerTriggerVisible: Boolean([...document.querySelectorAll("[data-context-drawer-trigger]")].find(visible)),
      d5WorkContract: ["Estado real", "Evidencia", "Coste previsto", "Coste real", "Margen autorizado", "Próxima acción"].every((label) => document.body.innerText.includes(label))
        && document.body.innerText.includes("Sin porcentaje físico inventado"),
      d5BudgetContract: ["Guardar borrador", "Revisar y enviar", "Partidas"].every((label) => document.body.innerText.includes(label))
        && Boolean(document.querySelector('[aria-label="Vista previa viva del presupuesto"]')),
      d5InvoiceContract: ["Estado de cobro", "Historial y compromisos", "Siguiente acción", "Documento y estado fiscal"].every((label) => document.body.innerText.includes(label))
        && Boolean(document.querySelector('[role="progressbar"][aria-label="Porcentaje cobrado"]')),
      d5TreasuryContract: ["Caja registrada", "Por cobrar", "Por pagar", "Flujo previsto", "Previsión"].every((label) => document.body.innerText.includes(label))
        && Boolean(document.querySelector('a[href="#treasury-registration"]')),
      d6DocumentsContract: ["Bandeja documental", "Documento original", "Datos extraídos", "Comprobaciones"].every((label) => document.body.innerText.includes(label)),
      d6SupplierContract: document.body.innerText.includes("Proveedores y subcontratas")
        && Boolean([...document.querySelectorAll("[data-d6-supplier-directory]")].find(visible))
        && [...document.querySelectorAll("[data-d6-supplier-directory]")].filter(visible).every((element) => element.getAttribute("data-d6-supplier-fields") === "specialty documentation works balance next-action"),
      d6ReceivedInvoicesContract: ["Facturas recibidas", "Pendiente revisar", "Pendiente pagar", "Vencido", "Imputado a trabajos"].every((label) => document.body.innerText.includes(label)),
      d6ReceivedInvoiceDetailContract: ["Datos fiscales y económicos", "Base imponible", "IVA", "IRPF", "Pagos parciales", "Gasto enlazado", "Historial"].every((label) => document.body.innerText.includes(label))
        && document.body.innerText.includes("No se registra una segunda salida"),
      d7AgendaContract: containsAll(visibleText, ["Semana", "Mes", "Lista", "Vencimientos", "Nueva visita"])
        && Boolean(document.querySelector("[data-agenda-week]")),
      d7TasksContract: containsAll(visibleText, ["Mías", "Equipo", "Bloqueadas", "Completadas", "Nueva tarea"])
        && Boolean(document.querySelector("[data-task-view]")),
      d7FollowUpsContract: containsAll(visibleText, ["Fecha", "Promesa", "Último intento", "Canal", "Resultado", "Siguiente acción"])
        && Boolean(document.querySelector("[data-follow-up-queue-item]")),
      d7RemindersContract: containsAll(visibleText, ["Preparado", "Programado", "Enviado"])
        && Boolean(document.querySelector("[data-reminder-state]")),
      d7AlertsContract: containsAll(availableText, ["Alertas y recomendaciones", "Nivel", "Origen", "Regla"])
        && !/(?:prioridad|puntuación)\s*:?\s*\d+(?:\s*\/\s*100)?/iu.test(availableText),
      d7RecommendationsContract: containsAll(availableText, ["Centro de recomendaciones", "Siguiente mejor acción", "Regla", "evidencia"])
        && !/(?:prioridad|puntuación)\s*:?\s*\d+(?:\s*\/\s*100)?/iu.test(availableText),
      d7AutomationsContract: containsAll(visibleText, ["Automatizaciones", "Trigger:", "Próxima:", "fallos", "retries"])
        && Boolean(document.querySelector("[data-automation-state]")),
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
  if (focusD4 && result.route.startsWith("/clientes") && !result.route.includes("review-client-1") && expectation === "allowed") {
    if (result.clientSmartViewCount !== 3) findings.push(`${context}:D4_SMART_VIEWS_${result.clientSmartViewCount}`);
    if (viewport === "390" && !result.clientMobileCardsVisible) findings.push(`${context}:D4_MOBILE_CARDS_MISSING`);
    if (viewport === "1440" && !result.route.includes("__orqena_review_empty_state__") && !result.clientListSplitVisible) {
      findings.push(`${context}:D4_DESKTOP_SPLIT_MISSING`);
    }
  }
  if (focusD4 && profile === "owner" && result.route.includes("/clientes/review-client-1") && expectation === "allowed") {
    if (result.clientDetailAreaCount !== 4) findings.push(`${context}:D4_DETAIL_AREAS_${result.clientDetailAreaCount}`);
    if (!result.clientContextDrawerTriggerVisible) findings.push(`${context}:D4_CONTEXT_DRAWER_MISSING`);
  }
  if (focusD5 && expectation === "allowed" && profile === "owner") {
    if (result.route.startsWith("/obras/review-work-1") && !result.d5WorkContract) findings.push(`${context}:D5_WORK_CONTRACT_MISSING`);
    if (result.route.startsWith("/presupuestos/review-budget-1") && !result.d5BudgetContract) findings.push(`${context}:D5_BUDGET_CONTRACT_MISSING`);
    if (result.route.startsWith("/dinero/review-invoice-1") && !result.d5InvoiceContract) findings.push(`${context}:D5_INVOICE_CONTRACT_MISSING`);
    if (result.route === "/tesoreria" && !result.d5TreasuryContract) findings.push(`${context}:D5_TREASURY_CONTRACT_MISSING`);
  }
  if (focusD6 && expectation === "allowed") {
    if (result.route === "/documentos" && profile === "owner" && !result.d6DocumentsContract) findings.push(`${context}:D6_DOCUMENTS_CONTRACT_MISSING`);
    if (result.route === "/proveedores" && !result.d6SupplierContract) findings.push(`${context}:D6_SUPPLIER_CONTRACT_MISSING`);
    if (result.route === "/facturas-proveedor" && !result.d6ReceivedInvoicesContract) findings.push(`${context}:D6_RECEIVED_INVOICES_CONTRACT_MISSING`);
    if (result.route.startsWith("/facturas-proveedor/review-purchase-invoice-1") && !result.d6ReceivedInvoiceDetailContract) findings.push(`${context}:D6_RECEIVED_INVOICE_DETAIL_CONTRACT_MISSING`);
  }
  if (focusD7 && expectation === "allowed") {
    if (result.route === "/agenda" && !result.d7AgendaContract) findings.push(`${context}:D7_AGENDA_CONTRACT_MISSING`);
    if (result.route === "/tareas" && !result.d7TasksContract) findings.push(`${context}:D7_TASKS_CONTRACT_MISSING`);
    if (result.route === "/seguimientos" && !result.d7FollowUpsContract) findings.push(`${context}:D7_FOLLOWUPS_CONTRACT_MISSING`);
    if (result.route === "/recordatorios" && !result.d7RemindersContract) findings.push(`${context}:D7_REMINDERS_CONTRACT_MISSING`);
    if (result.route === "/alertas" && !result.d7AlertsContract) findings.push(`${context}:D7_ALERTS_CONTRACT_MISSING`);
    if (result.route === "/recomendaciones" && !result.d7RecommendationsContract) findings.push(`${context}:D7_RECOMMENDATIONS_CONTRACT_MISSING`);
    if (result.route === "/automatizaciones" && !result.d7AutomationsContract) findings.push(`${context}:D7_AUTOMATIONS_CONTRACT_MISSING`);
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

async function openPermissionRoute(browser, storageState, route) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = await navigateAndAudit(page, route, { axe: true });
  return { context, diagnostics, result };
}

async function auditPermissionRoute(browser, profile, storageState, route, expectation) {
  let attempt = await openPermissionRoute(browser, storageState, route);
  let transientDiagnostics = [];
  const hydrationOnly = attempt.diagnostics.events.length > 0
    && attempt.diagnostics.events.every((event) => event.includes("Minified React error #418"));
  if (hydrationOnly) {
    transientDiagnostics = [...attempt.diagnostics.events];
    await attempt.context.close();
    attempt = await openPermissionRoute(browser, storageState, route);
    report.productObservations.push({
      severity: attempt.diagnostics.events.length ? "BLOCKER" : "REVIEW",
      context: `${profile.key}:1440:${route}`,
      code: "HYDRATION_REPLAY",
      firstAttempt: transientDiagnostics,
      replayDiagnostics: attempt.diagnostics.events,
    });
  }
  const { context, diagnostics, result } = attempt;
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
    transientDiagnostics,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
    findings,
  };
}

async function openOwnerSurface(browser, storageState, surface) {
  const viewport = surface.viewport ?? { key: "1440", width: 1440, height: 1000 };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    storageState,
    serviceWorkers: "block",
    reducedMotion: viewport.key === "390" ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = await navigateAndAudit(page, surface.route, { axe: true });
  return { context, page, diagnostics, result, viewport };
}

async function auditOwnerSurface(browser, storageState, surface) {
  let attempt = await openOwnerSurface(browser, storageState, surface);
  let transientDiagnostics = [];
  const hydrationOnly = attempt.diagnostics.events.length > 0
    && attempt.diagnostics.events.every((event) => event.includes("Minified React error #418"));
  if (hydrationOnly) {
    transientDiagnostics = [...attempt.diagnostics.events];
    await attempt.context.close();
    attempt = await openOwnerSurface(browser, storageState, surface);
    report.productObservations.push({
      severity: attempt.diagnostics.events.length ? "BLOCKER" : "REVIEW",
      context: `owner:${attempt.viewport.key}:${surface.route}`,
      code: "HYDRATION_REPLAY",
      firstAttempt: transientDiagnostics,
      replayDiagnostics: attempt.diagnostics.events,
    });
  }

  const { context, page, diagnostics, result, viewport } = attempt;
  const screenshot = join(screenshotRoot, `owner-${surface.family}-${viewport.key}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const expectation = "allowed";
  const findings = caseFindings({
    result,
    diagnostics,
    profile: "owner",
    viewport: viewport.key,
    expectation,
  });
  if (result.primaryActionCount > 1) {
    report.productObservations.push({
      severity: "REVIEW",
      context: `owner:${viewport.key}:${surface.route}`,
      code: "MULTIPLE_PRIMARY_ACTIONS",
      count: result.primaryActionCount,
      labels: result.primaryActions,
    });
  }
  await context.close();
  return {
    family: surface.family,
    ...result,
    viewport: viewport.key,
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
    const emptyVisible = await page.getByText(/No hay clientes (?:para estos filtros|para esta vista)/u).count() === 1;
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

async function auditD4Interactions(browser, storageState) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const findings = [];
  const filterRoutes = [
    "/clientes?vista=accion",
    "/clientes?vista=activos",
    "/clientes?vista=todos",
    "/clientes?vista=activos&estado=nuevo",
    "/clientes?vista=activos&tipo=Empresa",
    "/clientes?vista=activos&archivo=archivados",
    "/clientes?vista=activos&ordenar=nombre_desc",
    "/clientes?vista=activos&filtros=obras_activas",
    "/clientes?vista=activos&filtros=facturas_pendientes",
    "/clientes?vista=activos&filtros=facturas_vencidas",
    "/clientes?vista=activos&filtros=presupuestos_pendientes",
    "/clientes?vista=activos&filtros=datos_incompletos",
    "/clientes?vista=activos&filtros=seguimiento_pendiente",
    "/clientes?vista=activos&filtros=sin_actividad_reciente",
  ];
  const filterCases = [];
  for (const route of filterRoutes) {
    const result = await navigateAndAudit(page, route);
    const ok = result.status === 200
      && result.finalPath === "/clientes"
      && result.clientSmartViewCount === 3;
    if (!ok) findings.push(`D4_FILTER_ROUTE:${route}:FAILED`);
    filterCases.push({ route, status: result.status, ok });
  }

  await page.goto(`${baseUrl}/clientes?vista=activos`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForSettled(page, "/clientes:vista-activos:filter-drawer");
  const filterTrigger = page.getByRole("button", { name: /Filtros/u }).first();
  await filterTrigger.click();
  const filterDialog = page.getByRole("dialog", { name: "Filtros de clientes" });
  const filterDrawerOpened = await filterDialog.isVisible();
  await page.keyboard.press("Escape");
  const filterDrawerClosed = await filterDialog.isHidden();
  const filterFocusRestored = await filterTrigger.evaluate((element) => element === document.activeElement);
  if (!filterDrawerOpened || !filterDrawerClosed || !filterFocusRestored) {
    findings.push("D4_FILTER_DRAWER_INTERACTION_FAILED");
  }

  const detailAreas = [
    ["resumen", "Resumen"],
    ["trabajos", "Trabajo/Obras"],
    ["dinero", "Dinero"],
    ["archivos", "Archivos"],
  ];
  const deepLinkCases = [];
  for (const [view, label] of detailAreas) {
    const route = `/clientes/review-client-1?vista=${view}`;
    const result = await navigateAndAudit(page, route);
    const active = page.getByRole("link", { name: label, exact: true });
    const ok = result.status === 200
      && result.finalPath === "/clientes/review-client-1"
      && await active.getAttribute("aria-current") === "page";
    if (!ok) findings.push(`D4_DEEP_LINK:${view}:FAILED`);
    deepLinkCases.push({ view, route, status: result.status, active: ok });
  }

  await page.goto(`${baseUrl}/clientes/review-client-1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForSettled(page, "/clientes/review-client-1:context-drawer");
  const contextTrigger = page.getByRole("button", { name: "Ver contexto", exact: true });
  await contextTrigger.click();
  const contextDialog = page.getByRole("dialog", { name: /Contexto de Cliente Sintético Review/u });
  const contextDrawerOpened = await contextDialog.isVisible();
  const preservedSections = await Promise.all(
    ["Contactos", "Datos fiscales", "Notas internas"].map(async (label) =>
      contextDialog.getByRole("heading", { name: label, exact: true }).count(),
    ),
  );
  await page.keyboard.press("Escape");
  const contextDrawerClosed = await contextDialog.isHidden();
  const contextFocusRestored = await contextTrigger.evaluate((element) => element === document.activeElement);
  if (
    !contextDrawerOpened
    || !contextDrawerClosed
    || !contextFocusRestored
    || preservedSections.some((count) => count !== 1)
  ) {
    findings.push("D4_CONTEXT_DRAWER_INTERACTION_FAILED");
  }

  if (diagnostics.events.length) findings.push(`D4_INTERACTIONS_DIAGNOSTICS_${diagnostics.events.length}`);
  if (diagnostics.externalHosts.size) findings.push(`D4_INTERACTIONS_EXTERNAL_NETWORK_${[...diagnostics.externalHosts].join(",")}`);
  await context.close();
  return {
    filterCases,
    deepLinkCases,
    filterDrawerOpened,
    filterDrawerClosed,
    filterFocusRestored,
    contextDrawerOpened,
    contextDrawerClosed,
    contextFocusRestored,
    preservedContextSections: preservedSections.reduce((total, count) => total + count, 0),
    findings,
  };
}

async function auditD5Interactions(browser, storageState) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const cases = [];
  const findings = [];
  try {
    const budgetResult = await navigateAndAudit(page, "/presupuestos/review-budget-1");
    const preview = page.locator('[aria-label="Vista previa viva del presupuesto"]');
    const unitPrice = page.locator('#budget-line-editor [name="precioUnitario"]').first();
    const before = await preview.getAttribute("data-preview-subtotal");
    const originalValue = await unitPrice.inputValue();
    await unitPrice.fill(String(Number(originalValue) + 1));
    await page.waitForFunction(
      ({ value }) => document.querySelector('[data-preview-subtotal]')?.getAttribute("data-preview-subtotal") !== value,
      { value: before },
      { timeout: 5_000 },
    ).catch(() => undefined);
    const after = await preview.getAttribute("data-preview-subtotal");
    const livePreview = before !== after;
    cases.push({ key: "budget-live-preview", ok: budgetResult.d5BudgetContract && livePreview, before, after });
    if (!budgetResult.d5BudgetContract || !livePreview) findings.push("D5_BUDGET_LIVE_PREVIEW_FAILED");

    const budgetPdf = await context.request.get(`${baseUrl}/presupuestos/review-budget-1/pdf?preview=1`, { timeout: 60_000 });
    const budgetPdfOk = budgetPdf.status() === 200 && /application\/pdf/iu.test(budgetPdf.headers()["content-type"] ?? "");
    cases.push({ key: "budget-pdf", ok: budgetPdfOk, status: budgetPdf.status(), contentType: budgetPdf.headers()["content-type"] ?? null });
    if (!budgetPdfOk) findings.push(`D5_BUDGET_PDF_${budgetPdf.status()}`);

    const workResult = await navigateAndAudit(page, "/obras/review-work-1?vista=economia");
    const workLinks = {
      budget: await page.locator('a[href="/presupuestos/review-budget-1"]').count(),
      invoice: await page.locator('a[href="/dinero/review-invoice-1"]').count(),
    };
    const workOk = workResult.finalPath === "/obras/review-work-1" && workLinks.budget > 0 && workLinks.invoice > 0;
    cases.push({ key: "work-to-quote-and-invoice", ok: workOk, links: workLinks });
    if (!workOk) findings.push("D5_WORK_QUOTE_CASH_LINKS_FAILED");

    const invoiceResult = await navigateAndAudit(page, "/dinero/review-invoice-1");
    const invoiceText = await page.locator("main").innerText();
    const invoiceOk = invoiceResult.d5InvoiceContract && /2000\s*€/u.test(invoiceText) && /4050\s*€/u.test(invoiceText);
    cases.push({ key: "invoice-partial-balance", ok: invoiceOk });
    if (!invoiceOk) findings.push("D5_INVOICE_PARTIAL_BALANCE_FAILED");

    const invoicePdf = await context.request.get(`${baseUrl}/dinero/review-invoice-1/pdf?preview=1`, { timeout: 60_000 });
    const invoicePdfOk = invoicePdf.status() === 200 && /application\/pdf/iu.test(invoicePdf.headers()["content-type"] ?? "");
    cases.push({ key: "invoice-pdf", ok: invoicePdfOk, status: invoicePdf.status(), contentType: invoicePdf.headers()["content-type"] ?? null });
    if (!invoicePdfOk) findings.push(`D5_INVOICE_PDF_${invoicePdf.status()}`);

    const treasuryResult = await navigateAndAudit(page, "/tesoreria?vista=prevision&periodo=30d");
    const treasuryText = await page.locator("main").innerText();
    const treasuryOk = treasuryResult.finalPath === "/tesoreria"
      && treasuryText.includes("Calendario de caja")
      && treasuryText.includes("F-REV-1")
      && treasuryText.includes("Sólo vencimientos documentados");
    cases.push({ key: "treasury-documented-forecast", ok: treasuryOk });
    if (!treasuryOk) findings.push("D5_TREASURY_FORECAST_FAILED");
  } finally {
    await context.close();
  }
  if (diagnostics.events.length) findings.push(`D5_INTERACTIONS_DIAGNOSTICS_${diagnostics.events.length}`);
  if (diagnostics.externalHosts.size) findings.push(`D5_INTERACTIONS_EXTERNAL_NETWORK_${[...diagnostics.externalHosts].join(",")}`);
  return {
    cases,
    findings,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
  };
}

async function auditD6Interactions(browser, storageState) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const cases = [];
  const findings = [];
  try {
    const documentsResult = await navigateAndAudit(page, "/documentos");
    const documentsText = await page.locator("main").innerText();
    const documentStates = {
      registered: documentsText.includes("Registrado"),
      duplicate: documentsText.includes("Posible duplicado"),
      sha256: documentsText.includes("Huella SHA-256"),
    };
    const documentsOk = documentsResult.d6DocumentsContract && Object.values(documentStates).every(Boolean);
    cases.push({ key: "document-inbox-review", ok: documentsOk, states: documentStates });
    if (!documentsOk) findings.push("D6_DOCUMENT_INBOX_REVIEW_FAILED");

    const suppliersResult = await navigateAndAudit(page, "/proveedores");
    const contextTrigger = page.locator("[data-d6-supplier-context-trigger]").first();
    const triggerCount = await contextTrigger.count();
    if (triggerCount) await contextTrigger.click();
    const contextVisible = triggerCount > 0
      && await page.locator("details[data-d6-supplier-context][open] [data-d6-supplier-context-panel]").first().isVisible();
    const suppliersOk = suppliersResult.d6SupplierContract && contextVisible;
    cases.push({ key: "supplier-context-preview", ok: suppliersOk, triggerCount, contextVisible });
    if (!suppliersOk) findings.push("D6_SUPPLIER_CONTEXT_PREVIEW_FAILED");

    const invoicesResult = await navigateAndAudit(page, "/facturas-proveedor");
    const detailLinks = await page.locator('a[href="/facturas-proveedor/review-purchase-invoice-1"]').count();
    const invoicesOk = invoicesResult.d6ReceivedInvoicesContract && detailLinks > 0;
    cases.push({ key: "received-invoice-directory", ok: invoicesOk, detailLinks });
    if (!invoicesOk) findings.push("D6_RECEIVED_INVOICE_DIRECTORY_FAILED");

    const detailResult = await navigateAndAudit(page, "/facturas-proveedor/review-purchase-invoice-1");
    const detailText = (await page.locator("main").innerText()).replace(/\s+/gu, " ");
    const partialPayment = /400(?:[,.]00)?\s*€/u.test(detailText) && /864[,.]45\s*€/u.test(detailText);
    const expenseLinks = await page.locator('a[href="/gastos-materiales"]').count();
    const detailOk = detailResult.d6ReceivedInvoiceDetailContract && partialPayment && expenseLinks > 0;
    cases.push({ key: "received-invoice-expense-link", ok: detailOk, partialPayment, expenseLinks });
    if (!detailOk) findings.push("D6_RECEIVED_INVOICE_EXPENSE_LINK_FAILED");

    const treasuryResult = await navigateAndAudit(page, "/tesoreria?vista=prevision&periodo=30d");
    const purchaseLinks = await page.locator('a[href="/facturas-proveedor/review-purchase-invoice-1"]').count();
    const treasuryOk = treasuryResult.finalPath === "/tesoreria" && purchaseLinks === 1;
    cases.push({ key: "treasury-single-purchase-outflow", ok: treasuryOk, purchaseLinks });
    if (!treasuryOk) findings.push(`D6_TREASURY_PURCHASE_OUTFLOW_COUNT_${purchaseLinks}`);
  } finally {
    await context.close();
  }
  if (diagnostics.events.length) findings.push(`D6_INTERACTIONS_DIAGNOSTICS_${diagnostics.events.length}`);
  if (diagnostics.externalHosts.size) findings.push(`D6_INTERACTIONS_EXTERNAL_NETWORK_${[...diagnostics.externalHosts].join(",")}`);
  return {
    cases,
    findings,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
  };
}

async function auditD7Interactions(browser, storageState) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const cases = [];
  const findings = [];
  try {
    const agendaResult = await navigateAndAudit(page, "/agenda");
    await page.getByRole("button", { name: /Filtros/iu }).first().click();
    await page.getByRole("dialog", { name: "Filtros" }).waitFor({ state: "visible" });
    const filterDrawer = page.locator("details[data-agenda-filters]");
    if (await filterDrawer.count() && !(await filterDrawer.evaluate((element) => element.open))) await filterDrawer.locator("summary").click();
    const agendaDays = await page.locator("[data-agenda-day]").count();
    const agendaFilterVisible = await page.locator('details[data-agenda-filters][open] input[name="buscar"]').isVisible();
    const agendaOk = agendaResult.d7AgendaContract && agendaDays >= 5 && agendaFilterVisible;
    cases.push({ key: "agenda-week-and-filter-drawer", ok: agendaOk, agendaDays, agendaFilterVisible });
    if (!agendaOk) findings.push("D7_AGENDA_WEEK_FILTER_FAILED");

    const tasksResult = await navigateAndAudit(page, "/tareas");
    const taskColumns = await page.locator('[data-task-view="board"] section').count();
    const newTaskLinks = await page.locator('a[href*="/tareas?"][href*="nuevo=1"]').count();
    const tasksOk = tasksResult.d7TasksContract && taskColumns >= 3 && newTaskLinks === 1;
    cases.push({ key: "tasks-volume-board", ok: tasksOk, taskColumns, newTaskLinks });
    if (!tasksOk) findings.push("D7_TASKS_BOARD_FAILED");

    const followUpsResult = await navigateAndAudit(page, "/seguimientos");
    const queueItems = await page.locator("[data-follow-up-queue-item]").count();
    const followUpDetailLinks = await page.locator('a[href^="/seguimientos/review-followup-"]').count();
    const followUpsOk = followUpsResult.d7FollowUpsContract && queueItems >= 3 && followUpDetailLinks >= 1;
    cases.push({ key: "followups-work-queue", ok: followUpsOk, queueItems, followUpDetailLinks });
    if (!followUpsOk) findings.push("D7_FOLLOWUPS_QUEUE_FAILED");

    const remindersResult = await navigateAndAudit(page, "/recordatorios");
    const reminderStates = await page.locator("[data-reminder-state]").evaluateAll((items) => [...new Set(items.map((item) => item.getAttribute("data-reminder-state")).filter(Boolean))]);
    const remindersOk = remindersResult.d7RemindersContract
      && ["pendiente_confirmacion", "programado", "enviado"].every((state) => reminderStates.includes(state));
    cases.push({ key: "reminder-delivery-states", ok: remindersOk, reminderStates });
    if (!remindersOk) findings.push("D7_REMINDER_STATES_FAILED");

    const alertsResult = await navigateAndAudit(page, "/alertas");
    const alertDetails = page.locator("main details").first();
    if (await alertDetails.count()) await alertDetails.locator("summary").click();
    const alertsText = await page.locator("main").innerText();
    const alertsOk = alertsResult.d7AlertsContract
      && ["Mañana", "Esta semana no", "Resolver", "Descartar"].every((label) => alertsText.includes(label));
    cases.push({ key: "alert-transparent-lifecycle", ok: alertsOk });
    if (!alertsOk) findings.push("D7_ALERT_LIFECYCLE_FAILED");

    const recommendationsResult = await navigateAndAudit(page, "/recomendaciones");
    const recommendationDetails = page.locator("main details").first();
    if (await recommendationDetails.count()) await recommendationDetails.locator("summary").click();
    const recommendationPrimaryCount = recommendationsResult.primaryActionCount;
    const recommendationsText = await page.locator("main").innerText();
    const recommendationsOk = recommendationsResult.d7RecommendationsContract
      && recommendationPrimaryCount <= 1
      && ["Mañana", "Esta semana no", "Descartar"].every((label) => recommendationsText.includes(label));
    cases.push({ key: "recommendation-decision-hierarchy", ok: recommendationsOk, recommendationPrimaryCount });
    if (!recommendationsOk) findings.push("D7_RECOMMENDATION_HIERARCHY_FAILED");

    const automationsResult = await navigateAndAudit(page, "/automatizaciones");
    const automationsText = await page.locator("main").innerText();
    const automationsOk = automationsResult.d7AutomationsContract
      && automationsText.includes("Recordatorio interno de revisión")
      && automationsText.includes("REVIEW_SYNTHETIC_FAILURE") === false;
    cases.push({ key: "automation-lifecycle-observability", ok: automationsOk });
    if (!automationsOk) findings.push("D7_AUTOMATION_OBSERVABILITY_FAILED");
  } finally {
    await context.close();
  }
  if (diagnostics.events.length) findings.push(`D7_INTERACTIONS_DIAGNOSTICS_${diagnostics.events.length}`);
  if (diagnostics.externalHosts.size) findings.push(`D7_INTERACTIONS_EXTERNAL_NETWORK_${[...diagnostics.externalHosts].join(",")}`);
  return {
    cases,
    findings,
    diagnostics: diagnostics.events,
    externalHosts: [...diagnostics.externalHosts],
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const storageStates = new Map();
  for (const profile of profiles) {
    process.stdout.write(`AUDIT_LOGIN_START=${profile.key}\n`);
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
    if (focusD4 && profile.d4) {
      profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, profile.d4.route, profile.d4.expectation));
    }
    if (focusD5 && profile.d5) {
      for (const d5Case of profile.d5) {
        profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, d5Case.route, d5Case.expectation));
      }
    }
    if (focusD6 && profile.d6) {
      for (const d6Case of profile.d6) {
        profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, d6Case.route, d6Case.expectation));
      }
    }
    if (focusD7 && profile.d7) {
      for (const d7Case of profile.d7) {
        profileResult.permissionCases.push(await auditPermissionRoute(browser, profile, storageState, d7Case.route, d7Case.expectation));
      }
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

  if (focusD4) {
    report.d4Interactions = await auditD4Interactions(browser, ownerStorageState);
    report.blockingFindings.push(...report.d4Interactions.findings);
    process.stdout.write(
      `AUDIT_D4_INTERACTIONS=FILTERS_${report.d4Interactions.filterCases.length};DEEP_LINKS_${report.d4Interactions.deepLinkCases.length};OK=${report.d4Interactions.findings.length === 0}\n`,
    );
  }
  if (focusD5) {
    report.d5Interactions = await auditD5Interactions(browser, ownerStorageState);
    report.blockingFindings.push(...report.d5Interactions.findings);
    process.stdout.write(
      `AUDIT_D5_INTERACTIONS=CASES_${report.d5Interactions.cases.length};OK=${report.d5Interactions.findings.length === 0}\n`,
    );
  }
  if (focusD6) {
    report.d6Interactions = await auditD6Interactions(browser, ownerStorageState);
    report.blockingFindings.push(...report.d6Interactions.findings);
    process.stdout.write(
      `AUDIT_D6_INTERACTIONS=CASES_${report.d6Interactions.cases.length};OK=${report.d6Interactions.findings.length === 0}\n`,
    );
  }
  if (focusD7) {
    report.d7Interactions = await auditD7Interactions(browser, ownerStorageState);
    report.blockingFindings.push(...report.d7Interactions.findings);
    process.stdout.write(
      `AUDIT_D7_INTERACTIONS=CASES_${report.d7Interactions.cases.length};OK=${report.d7Interactions.findings.length === 0}\n`,
    );
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
  d4InteractionCases: (report.d4Interactions?.filterCases.length ?? 0)
    + (report.d4Interactions?.deepLinkCases.length ?? 0)
    + (report.d4Interactions ? 2 : 0),
  d5InteractionCases: report.d5Interactions?.cases.length ?? 0,
  d6InteractionCases: report.d6Interactions?.cases.length ?? 0,
  d7InteractionCases: report.d7Interactions?.cases.length ?? 0,
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
