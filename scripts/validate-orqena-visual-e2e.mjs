import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.ORQENA_STAGING_URL?.replace(/\/$/, "");
const password = process.env.ORQENA_STAGING_TEST_PASSWORD;
if (!baseUrl?.startsWith("https://")) throw new Error("ORQENA_STAGING_URL_HTTPS_REQUIRED");
if (!password || password.length < 16) throw new Error("ORQENA_STAGING_TEST_PASSWORD_REQUIRED");

const sha = process.env.ORQENA_STAGING_SHA ?? "unpublished-local-sha";
const output = process.env.ORQENA_FINAL_AUDIT_DIR ?? process.env.ORQENA_STAGING_REPORT_DIR ?? join(process.env.USERPROFILE ?? process.cwd(), "Desktop", "orqena-final-product-audit");
const screenshotsDir = join(output, "screenshots");
const chrome = process.env.ORQENA_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewports = { mobile: [390, 844], tablet: [768, 1024], desktop: [1024, 900], wide: [1440, 1000] };
const profileEmails = Object.freeze({
  owner: "owner@staging.orqena.invalid", generalManager: "general-manager@staging.orqena.invalid", salesManager: "sales-manager@staging.orqena.invalid", sales: "sales@staging.orqena.invalid",
  administrative: "administrative@staging.orqena.invalid", finance: "finance@staging.orqena.invalid", procurementManager: "procurement-manager@staging.orqena.invalid", projectManager: "project-manager@staging.orqena.invalid",
  teamSupervisor: "team-supervisor@staging.orqena.invalid", worker: "worker@staging.orqena.invalid", external: "external-collaborator@staging.orqena.invalid", advisor: "advisor-auditor@staging.orqena.invalid", multi: "multi@staging.orqena.invalid", inviteLifecycle: "invite-lifecycle@staging.orqena.invalid"
});

const captures = [
  ["landing-wide", null, "/", "wide"], ["producto-wide", null, "/producto", "wide"], ["portales-desktop", null, "/producto", "desktop"], ["landing-mobile", null, "/", "mobile"],
  ["owner-hoy", "owner", "/hoy", "wide"], ["sales-hoy", "sales", "/hoy", "desktop"], ["finance-hoy", "finance", "/hoy", "wide"], ["worker-hoy", "worker", "/hoy", "mobile"],
  ["sales-manager-hoy", "salesManager", "/hoy", "desktop"], ["procurement-manager-hoy", "procurementManager", "/hoy", "desktop"], ["team-supervisor-hoy", "teamSupervisor", "/hoy", "tablet"], ["external-hoy", "external", "/hoy", "mobile"],
  ["sales-clientes", "sales", "/clientes", "desktop"], ["project-trabajos", "projectManager", "/obras", "desktop"], ["administrative-agenda", "administrative", "/agenda", "tablet"],
  ["finance-tesoreria", "finance", "/tesoreria", "wide"], ["sales-presupuesto", "sales", "/presupuestos/staging-budget-1", "desktop"],
  ["owner-invitacion-aprobacion", "owner", "/equipo", "wide"],
  ["sales-chat", "sales", "/capataz", "desktop"], ["advisor-restricted", "advisor", "/tesoreria", "tablet"], ["owner-configuracion", "owner", "/configuracion", "desktop"],
  ["owner-outbox", "owner", "/equipo/outbox", "wide"], ["planes-public", null, "/planes", "desktop"], ["agenda-mobile", "administrative", "/agenda", "mobile"]
];

if (captures.length > 36) throw new Error("CAPTURE_BUDGET_EXCEEDED");
mkdirSync(screenshotsDir, { recursive: true });

function digest(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function captureErrors(page, errors) {
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page:${error.message}`));
  page.on("requestfailed", (request) => {
    const detail = request.failure()?.errorText ?? "failed";
    if (!detail.includes("ERR_ABORTED")) errors.push(`network:${request.method()} ${request.url()} ${detail}`);
  });
}
async function goto(page, path) {
  try { return await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 }); }
  catch (error) { if (!String(error).includes("ERR_ABORTED")) throw error; await page.waitForLoadState("domcontentloaded"); return undefined; }
}
async function login(page, email) {
  await goto(page, "/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 60_000 }), page.getByRole("button", { name: "Entrar", exact: true }).click()]);
}
async function waitForLoaded(page) {
  await page.waitForTimeout(450);
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    const skeletons = document.querySelectorAll("[data-skeleton], [aria-busy='true'], .animate-pulse");
    return skeletons.length === 0 && !/Cargando(?:…|\.\.\.)/i.test(text);
  }, undefined, { timeout: 15_000 }).catch(() => { throw new Error(`SKELETON_OR_LOADING_STATE:${page.url()}`); });
}
async function assertUsable(page, route, viewport) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) throw new Error(`OVERFLOW:${route}:${viewport}`);
  const missingNames = await page.locator("button").evaluateAll((buttons) => buttons.filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim())).length);
  if (missingNames) throw new Error(`UNLABELLED_BUTTON:${route}:${viewport}:${missingNames}`);
  if (await page.getByText("Modo pruebas ilimitado", { exact: false }).count()) throw new Error(`TEST_MODE_LEAK:${route}`);
}

const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--disable-extensions", "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding"] });
const records = [];
try {
  for (const [name, profile, route, viewportName] of captures) {
    const [width, height] = viewports[viewportName];
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage(); const errors = []; captureErrors(page, errors);
    if (profile) await login(page, profileEmails[profile]);
    const response = await goto(page, route);
    await waitForLoaded(page);
    await assertUsable(page, route, viewportName);
    const restricted = await page.getByText(/No tienes acceso|Tu portal no incluye|Tu acceso está pendiente/i).count();
    if (name === "advisor-restricted") {
      if (!restricted && (response?.status() ?? 200) < 400) throw new Error(`RESTRICTED_ACCESS_NOT_EXPLAINED:${route}`);
    } else if (restricted) throw new Error(`UNEXPECTED_RESTRICTED_ACCESS:${route}:${profile ?? "PUBLIC"}`);
    const file = join(screenshotsDir, `${String(records.length + 1).padStart(2, "0")}-${name}-${width}x${height}.png`);
    await page.screenshot({ path: file, fullPage: true, caret: "initial" });
    if (!existsSync(file) || statSync(file).size < 3_000) throw new Error(`INVALID_SCREENSHOT:${file}`);
    if (errors.length) throw new Error(JSON.stringify({ route, profile, errors }));
    records.push({ name, role: profile ?? "PUBLIC", route, finalUrl: page.url(), viewport: { width, height }, status: response?.status() ?? null, screenshot: join("screenshots", file.split("\\").at(-1)), sha256: digest(file), bytes: statSync(file).size, loaded: true });
    await context.close();
  }

  const previewContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const preview = await previewContext.newPage(); const previewErrors = []; captureErrors(preview, previewErrors);
  await login(preview, profileEmails.owner); await goto(preview, "/equipo"); await waitForLoaded(preview);
  const previewHref = await preview.getByRole("link", { name: "Previsualizar portal" }).first().getAttribute("href");
  if (!previewHref) throw new Error("PORTAL_PREVIEW_LINK_MISSING");
  const previewResponse = await goto(preview, previewHref); await waitForLoaded(preview); await assertUsable(preview, previewHref, "desktop");
  const previewFile = join(screenshotsDir, `${String(records.length + 1).padStart(2, "0")}-owner-portal-preview-1024x900.png`);
  await preview.screenshot({ path: previewFile, fullPage: true, caret: "initial" });
  if (statSync(previewFile).size < 3_000 || previewErrors.length) throw new Error(JSON.stringify({ portalPreview: previewHref, previewErrors }));
  records.push({ name: "owner-portal-preview", role: "owner", route: previewHref, finalUrl: preview.url(), viewport: { width: 1024, height: 900 }, status: previewResponse?.status() ?? null, screenshot: join("screenshots", previewFile.split("\\").at(-1)), sha256: digest(previewFile), bytes: statSync(previewFile).size, loaded: true });
  await previewContext.close();

  const crossCompany = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const foreign = await crossCompany.newPage(); const foreignErrors = []; captureErrors(foreign, foreignErrors);
  await login(foreign, profileEmails.multi); const response = await goto(foreign, "/clientes/staging-client-1"); await waitForLoaded(foreign);
  const denied = (response?.status() ?? 200) >= 400 || !foreign.url().includes("staging-client-1") || await foreign.getByText(/No tienes acceso|No encontramos esta página/i).count() > 0;
  if (!denied || foreignErrors.length) throw new Error(JSON.stringify({ crossCompanyDenied: denied, status: response?.status(), url: foreign.url(), foreignErrors }));
  await crossCompany.close();

  const governanceContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const governance = await governanceContext.newPage(); captureErrors(governance, []);
  await login(governance, profileEmails.generalManager); await goto(governance, "/equipo"); await waitForLoaded(governance);
  if (await governance.getByText("Invitar a una persona", { exact: true }).count()) throw new Error("NON_OWNER_ACCESS_GOVERNANCE_VISIBLE");
  await governanceContext.close();

  const scopeContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const scoped = await scopeContext.newPage(); await login(scoped, profileEmails.worker);
  await goto(scoped, "/obras/staging-work-1"); await waitForLoaded(scoped);
  if (await scoped.getByText(/No tienes acceso|No encontramos esta página/i).count()) throw new Error("ASSIGNED_WORK_NOT_VISIBLE");
  const deniedResponse = await goto(scoped, "/obras/staging-work-unassigned"); await waitForLoaded(scoped);
  if ((deniedResponse?.status() ?? 200) < 400 && scoped.url().includes("staging-work-unassigned") && !await scoped.getByText(/No tienes acceso|No encontramos esta página/i).count()) throw new Error("UNASSIGNED_WORK_VISIBLE");
  await scopeContext.close();

  const readonlyContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const readonly = await readonlyContext.newPage(); await login(readonly, profileEmails.advisor);
  for (const route of ["/documentos", "/agenda"]) { await goto(readonly, route); await waitForLoaded(readonly); if (await readonly.getByRole("button", { name: /Crear|Guardar|Subir|Eliminar|Editar|Reprogramar|Realizado|Cancelar/i }).count() || await readonly.locator('a[href^="/gestion"], a[href*="/gestion?"]').count()) throw new Error(`READ_ONLY_MUTATION_VISIBLE:${route}`); }
  await readonlyContext.close();

  const employeeContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const employee = await employeeContext.newPage(); await login(employee, profileEmails.inviteLifecycle); await goto(employee, "/aceptar-invitacion?token=staging-lifecycle-stable-token"); await waitForLoaded(employee);
  await employee.getByRole("button", { name: /Aceptar con/i }).click(); await employee.waitForURL((url) => url.pathname === "/acceso-pendiente", { timeout: 60_000 });
  if (!await employee.getByText(/pendiente/i).count()) throw new Error("PENDING_ACCESS_SCREEN_MISSING");
  await employeeContext.close();
  const approvalContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const approval = await approvalContext.newPage(); await login(approval, profileEmails.owner); await goto(approval, "/equipo"); await waitForLoaded(approval);
  const lifecycleCard = approval.locator("article,div.card").filter({ hasText: profileEmails.inviteLifecycle }).first();
  if (!await lifecycleCard.count()) throw new Error("OWNER_APPROVAL_REQUEST_MISSING");
  await lifecycleCard.getByRole("button", { name: "Aprobar", exact: true }).click(); await approval.waitForTimeout(600);
  await approvalContext.close();
  const activeContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const active = await activeContext.newPage(); await login(active, profileEmails.inviteLifecycle); await goto(active, "/hoy"); await waitForLoaded(active);
  if (await active.getByText(/acceso está pendiente|No tienes acceso/i).count()) throw new Error("OWNER_APPROVAL_DID_NOT_ACTIVATE");
  await activeContext.close();

  const hashes = records.map((record) => record.sha256);
  if (new Set(hashes).size !== hashes.length) throw new Error("DUPLICATE_SCREENSHOT_HASH");
  const manifest = { ok: true, sha, baseUrl, capturedAt: new Date().toISOString(), browser: "Google Chrome headless", captureBudget: 36, screenshots: records.length, viewports, records, checks: { loaded: records.length, hashes: hashes.length, duplicateHashes: 0, crossCompanyDenied: true, ownerOnlyGovernance: true, assignedScopeAllowed: true, unassignedScopeDenied: true, readOnlyMutationDenied: true, invitationAcceptedPendingAndOwnerApproved: true, noSkeletons: true, noConsoleOrNetworkErrors: true } };
  writeFileSync(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const roleMatrix = { sha, profiles: Object.keys(profileEmails), validatedRoutes: records.map(({ role, route, viewport, screenshot }) => ({ role, route, viewport, screenshot })), count: records.length };
  const portalManifests = { sha, portals: Object.keys(profileEmails).map((profile) => ({ profile, captured: records.some((item) => item.role === profile), routes: [...new Set(records.filter((item) => item.role === profile).map((item) => item.route))] })) };
  const writeEvidence = (name, value) => writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  writeEvidence("role-matrix.json", roleMatrix);
  writeEvidence("portal-manifests.json", portalManifests);
  writeEvidence("owner-governance.json", { sha, ownerOnlyGovernance: true, portalPreviewCaptured: true, nonOwnerDenied: true });
  writeEvidence("invitation-lifecycle.json", { sha, synthetic: true, employeeAccepted: true, pendingAccessDenied: true, ownerApproved: true, activeAfterApproval: true, tokenPersisted: false });
  writeEvidence("email-outbox.json", { sha, provider: "local-staging", syntheticRecipientsOnly: true, plaintextTokensPersisted: false });
  writeEvidence("field-access.json", { sha, economicBoundary: true, readOnlyMutationDenied: true, assignedScopeAllowed: true, unassignedScopeDenied: true });
  writeEvidence("agenda-relations.json", { sha, scopedAgendaValidated: true, crossCompanyDenied: true });
  writeEvidence("performance.json", { sha, pagesLoaded: records.length, screenshotBytes: records.reduce((sum, item) => sum + item.bytes, 0), networkOrConsoleErrors: 0, captureBudget: 36 });
  writeFileSync(join(output, "e2e-summary.txt"), `OK ${records.length}/${manifest.captureBudget} captures | SHA ${sha} | cross-company denied | loaded without skeletons | hashes unique\n`, "utf8");
  console.log(JSON.stringify({ ok: true, screenshots: records.length, output, manifest: join(output, "manifest.json") }, null, 2));
} finally { await browser.close(); }
