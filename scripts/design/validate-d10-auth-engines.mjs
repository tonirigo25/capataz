import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { generate } from "otplib";
import { chromium, firefox, webkit } from "playwright";

const EXPECTED_ORIGIN = "https://orqena-review-web-review.up.railway.app";
const origin = (process.env.ORQENA_REVIEW_BASE_URL ?? EXPECTED_ORIGIN).replace(/\/$/u, "");
const password = process.env.ORQENA_REVIEW_QA_PASSWORD;
let ownerMfaSecret = process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;
const deployedSha = process.env.ORQENA_REVIEW_SHA ?? "";
if (process.env.ORQENA_REVIEW_FOCUS_D10 !== "true") throw new Error("D10_AUTH_FOCUS_REQUIRED");
if (origin !== EXPECTED_ORIGIN) throw new Error(`D10_AUTH_ORIGIN_MISMATCH:${origin}`);
if (!password || password.length < 24) throw new Error("D10_AUTH_QA_PASSWORD_REQUIRED");
if (!ownerMfaSecret) throw new Error("D10_AUTH_OWNER_MFA_REQUIRED");
if (!/^[0-9a-f]{40}$/u.test(deployedSha)) throw new Error("D10_AUTH_SHA_REQUIRED");
delete process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;

const outputRoot = process.env.ORQENA_D10_AUTH_ENGINE_DIR
  ?? join(process.cwd(), "artifacts", `design-d10-auth-engines-${deployedSha.slice(0, 8)}`);
const screenshotRoot = join(outputRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });

const viewports = [
  { key: "390", width: 390, height: 844 },
  { key: "430", width: 430, height: 932 },
  { key: "768", width: 768, height: 1024 },
  { key: "1024", width: 1024, height: 768 },
  { key: "1280", width: 1280, height: 800 },
  { key: "1440", width: 1440, height: 900 },
  { key: "1920", width: 1920, height: 1080 },
];
const profiles = [
  { key: "owner", route: "/hoy", readOnly: false },
  { key: "worker", route: "/tareas", readOnly: false },
  { key: "external", route: "/obras", readOnly: false },
  { key: "viewer", route: "/auditoria", readOnly: true },
];
const ownerRoutes = [
  "/hoy",
  "/dashboard",
  "/clientes/review-client-1",
  "/obras/review-work-1",
  "/presupuestos/review-budget-1",
  "/dinero/review-invoice-1",
  "/documentos",
  "/agenda",
  "/capataz",
  "/equipo",
  "/configuracion",
  "/plataforma",
];
const engines = [
  { key: "chromium", launcher: chromium },
  { key: "firefox", launcher: firefox },
  { key: "webkit", launcher: webkit },
];
const findings = [];
const profileCases = [];
const ownerSurfaceCases = [];
const loginCases = [];
const screenshots = [];
const observations = [];

function sanitize(value) {
  return String(value)
    .replace(/([?&](?:token|code|secret|password)=)[^&\s]+/giu, "$1[REDACTED]")
    .replace(/[A-Za-z0-9_-]{48,}/gu, "[LONG_VALUE_REDACTED]")
    .slice(0, 800);
}

function attachDiagnostics(page) {
  const events = [];
  const externalHosts = new Set();
  page.on("console", (message) => {
    if (message.type() === "error") events.push(`console:${sanitize(message.text())}`);
  });
  page.on("pageerror", (error) => events.push(`page:${sanitize(error.message)}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
    events.push(`request:${sanitize(request.method())}:${sanitize(request.url())}:${sanitize(failure)}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) events.push(`http:${response.status()}:${sanitize(response.url())}`);
  });
  page.on("request", (request) => {
    if (/^(?:data|blob|about):/u.test(request.url())) return;
    const url = new URL(request.url());
    if (url.origin !== origin) externalHosts.add(url.host);
  });
  return { events, externalHosts };
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(120);
  await page.waitForFunction(() => {
    const loading = document.querySelectorAll("[aria-busy='true'], [data-skeleton], .animate-pulse");
    return loading.length === 0 && !/Cargando(?:\s+[^.\n…]{1,80})?(?:…|\.\.\.)/iu.test(document.body.innerText);
  }, undefined, { timeout: 20_000 });
}

async function stateOf(page) {
  const state = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    return {
      h1Count: [...document.querySelectorAll("h1")].filter(visible).length,
      mainCount: [...document.querySelectorAll("main")].filter(visible).length,
      overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
      primaryActions: [...document.querySelectorAll("a.primary-button, button.primary-button")].filter(visible).length,
      createActions: [...document.querySelectorAll('a[href^="/gestion"]')].filter(visible).length,
      readOnlyText: /solo lectura|modo lectura|lectura/i.test(document.body.innerText),
      realLookingEmails: (document.body.innerText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [])
        .filter((email) => !email.toLowerCase().endsWith(".invalid")),
      secretMarkers: (document.body.innerText.match(/(?:sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|password\s*=\s*\S+)/giu) ?? []),
    };
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return {
    ...state,
    axeBlocking: axe.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })),
  };
}

async function loginProfiles() {
  const browser = await chromium.launch({ headless: true });
  const states = new Map();
  try {
    for (const profile of profiles) {
      const firstAttempt = await loginProfile(browser, profile);
      const replayed = hydrationOnly(firstAttempt.diagnostics)
        ? await loginProfile(browser, profile)
        : null;
      const audited = replayed ?? firstAttempt;
      if (replayed) {
        observations.push({
          severity: replayed.diagnostics.events.length ? "BLOCKER" : "REVIEW",
          context: `login:${profile.key}`,
          code: "HYDRATION_REPLAY",
          firstAttempt: firstAttempt.diagnostics.events,
          replayDiagnostics: replayed.diagnostics.events,
        });
      }
      if (audited.response?.status() !== 200) findings.push(`login:${profile.key}:HTTP_${audited.response?.status() ?? 0}`);
      if (audited.diagnostics.events.length) findings.push(`login:${profile.key}:DIAGNOSTICS_${audited.diagnostics.events.length}`);
      if (audited.diagnostics.externalHosts.size) findings.push(`login:${profile.key}:EXTERNAL_${[...audited.diagnostics.externalHosts].join(",")}`);
      states.set(profile.key, await audited.context.storageState());
      loginCases.push({
        profile: profile.key,
        engine: "chromium",
        durationMs: audited.durationMs,
        mfa: profile.key === "owner",
        transientDiagnostics: replayed ? firstAttempt.diagnostics.events : [],
        diagnostics: audited.diagnostics.events,
        externalHosts: [...audited.diagnostics.externalHosts],
      });
      await firstAttempt.context.close();
      await replayed?.context.close();
    }
  } finally {
    ownerMfaSecret = undefined;
    await browser.close();
  }
  return states;
}

async function loginProfile(browser, profile) {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const startedAt = Date.now();
  const response = await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel("Correo").fill(`${profile.key}@review.orqena.invalid`);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
  await settle(page);
  if (profile.key === "owner") {
    await page.goto(`${origin}/configuracion/seguridad?required=platform`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settle(page);
    const code = page.getByLabel("Código de seis cifras");
    const remainingInStepMs = 30_000 - (Date.now() % 30_000);
    if (remainingInStepMs < 5_000) await page.waitForTimeout(remainingInStepMs + 250);
    const token = await generate({ secret: ownerMfaSecret, epoch: Math.floor(Date.now() / 1_000) });
    await code.fill(token);
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await page.getByText("Segundo factor verificado durante las últimas 12 horas.").waitFor({ state: "visible", timeout: 30_000 });
  }
  return { context, response, diagnostics, durationMs: Date.now() - startedAt };
}

function collectFindings(prefix, state, diagnostics, profile = null) {
  if (state.h1Count !== 1) findings.push(`${prefix}:H1_COUNT_${state.h1Count}`);
  if (state.mainCount !== 1) findings.push(`${prefix}:MAIN_COUNT_${state.mainCount}`);
  if (state.overflowPx > 1) findings.push(`${prefix}:OVERFLOW_${state.overflowPx}`);
  if (state.brokenImages) findings.push(`${prefix}:BROKEN_IMAGES_${state.brokenImages}`);
  if (state.axeBlocking.length) findings.push(`${prefix}:AXE_${state.axeBlocking.map(({ id }) => id).join(",")}`);
  if (state.realLookingEmails.length) findings.push(`${prefix}:PII_EMAIL_${state.realLookingEmails.length}`);
  if (state.secretMarkers.length) findings.push(`${prefix}:SECRET_MARKER_${state.secretMarkers.length}`);
  if (diagnostics.events.length) findings.push(`${prefix}:DIAGNOSTICS_${diagnostics.events.length}`);
  if (diagnostics.externalHosts.size) findings.push(`${prefix}:EXTERNAL_${[...diagnostics.externalHosts].join(",")}`);
  if (profile?.readOnly && (state.createActions > 0 || !state.readOnlyText)) {
    findings.push(`${prefix}:READ_ONLY_CONTRACT`);
  }
}

function hydrationOnly(diagnostics) {
  return diagnostics.events.length > 0
    && diagnostics.externalHosts.size === 0
    && diagnostics.events.every((event) => event.includes("Minified React error #418"));
}

async function replayAuthenticatedRoute(browser, { viewport, storageState, route }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await settle(page);
  const state = await stateOf(page);
  return { context, page, diagnostics, response, state };
}

async function replayIfHydrationOnly(browser, input, firstAttempt, prefix) {
  if (!hydrationOnly(firstAttempt.diagnostics)) {
    return { ...firstAttempt, transientDiagnostics: [], replayContext: null };
  }
  const replay = await replayAuthenticatedRoute(browser, input);
  observations.push({
    severity: replay.diagnostics.events.length ? "BLOCKER" : "REVIEW",
    context: prefix,
    code: "HYDRATION_REPLAY",
    firstAttempt: firstAttempt.diagnostics.events,
    replayDiagnostics: replay.diagnostics.events,
  });
  return {
    ...replay,
    transientDiagnostics: firstAttempt.diagnostics.events,
    replayContext: replay.context,
  };
}

const storageStates = await loginProfiles();
for (const engine of engines) {
  const browser = await engine.launcher.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      process.stdout.write(`D10 authenticated ${engine.key} ${viewport.width}x${viewport.height}\n`);
      for (const profile of profiles) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          storageState: storageStates.get(profile.key),
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        const diagnostics = attachDiagnostics(page);
        const response = await page.goto(`${origin}${profile.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await settle(page);
        const state = await stateOf(page);
        const prefix = `${engine.key}:${viewport.key}:${profile.key}:${profile.route}`;
        const audited = await replayIfHydrationOnly(browser, {
          viewport,
          storageState: storageStates.get(profile.key),
          route: profile.route,
        }, { page, diagnostics, response, state }, prefix);
        if (audited.response?.status() !== 200) findings.push(`${prefix}:HTTP_${audited.response?.status() ?? 0}`);
        if (new URL(audited.page.url()).pathname !== profile.route) findings.push(`${prefix}:FINAL_${new URL(audited.page.url()).pathname}`);
        collectFindings(prefix, audited.state, audited.diagnostics, profile);
        profileCases.push({
          engine: engine.key,
          viewport: `${viewport.width}x${viewport.height}`,
          profile: profile.key,
          route: profile.route,
          status: audited.response?.status() ?? 0,
          finalPath: new URL(audited.page.url()).pathname,
          transientDiagnostics: audited.transientDiagnostics,
          diagnostics: audited.diagnostics.events,
          externalHosts: [...audited.diagnostics.externalHosts],
          ...audited.state,
        });
        await audited.replayContext?.close();
        await context.close();
      }

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState: storageStates.get("owner"),
        serviceWorkers: "block",
      });
      for (const route of ownerRoutes) {
        const page = await context.newPage();
        const diagnostics = attachDiagnostics(page);
        const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await settle(page);
        const state = await stateOf(page);
        const prefix = `${engine.key}:${viewport.key}:owner:${route}`;
        const audited = await replayIfHydrationOnly(browser, {
          viewport,
          storageState: storageStates.get("owner"),
          route,
        }, { page, diagnostics, response, state }, prefix);
        if (audited.response?.status() !== 200) findings.push(`${prefix}:HTTP_${audited.response?.status() ?? 0}`);
        if (new URL(audited.page.url()).pathname !== route) findings.push(`${prefix}:FINAL_${new URL(audited.page.url()).pathname}`);
        collectFindings(prefix, audited.state, audited.diagnostics);
        let screenshot = null;
        if (["390", "1440"].includes(viewport.key) && ["/hoy", "/clientes/review-client-1", "/obras/review-work-1", "/capataz"].includes(route)) {
          const routeSlug = route.slice(1).replaceAll("/", "-").replaceAll("[", "").replaceAll("]", "");
          screenshot = join(screenshotRoot, `${engine.key}-${viewport.key}-${routeSlug}.png`);
          await audited.page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
          screenshots.push({
            engine: engine.key,
            viewport: viewport.key,
            route,
            path: relative(process.cwd(), screenshot),
            bytes: statSync(screenshot).size,
          });
        }
        ownerSurfaceCases.push({
          engine: engine.key,
          viewport: `${viewport.width}x${viewport.height}`,
          route,
          status: audited.response?.status() ?? 0,
          finalPath: new URL(audited.page.url()).pathname,
          transientDiagnostics: audited.transientDiagnostics,
          diagnostics: audited.diagnostics.events,
          externalHosts: [...audited.diagnostics.externalHosts],
          screenshot: screenshot ? relative(process.cwd(), screenshot) : null,
          ...audited.state,
        });
        await audited.replayContext?.close();
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

const report = {
  schemaVersion: 1,
  phase: "D10",
  generatedAt: new Date().toISOString(),
  origin,
  deployedSha,
  syntheticOnly: true,
  credentialsPersisted: false,
  productionWrites: 0,
  stagingWrites: 0,
  viewports,
  engines: engines.map(({ key }) => key),
  profiles: profiles.map(({ key }) => key),
  ownerRoutes,
  loginCases,
  profileCases,
  ownerSurfaceCases,
  screenshots,
  observations,
  findings: [...new Set(findings)],
};
report.summary = {
  ok: report.findings.length === 0,
  loginCases: loginCases.length,
  profileCases: profileCases.length,
  ownerSurfaceCases: ownerSurfaceCases.length,
  axeCases: profileCases.length + ownerSurfaceCases.length,
  screenshotCases: screenshots.length,
  observations: observations.length,
  blockingFindings: report.findings.length,
};
const reportPath = join(outputRoot, "authenticated-engine-matrix.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...report.summary,
  output: relative(process.cwd(), reportPath),
}, null, 2));
if (!report.summary.ok) process.exitCode = 1;
