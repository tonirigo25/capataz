import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { generate } from "otplib";
import { chromium, firefox, webkit } from "playwright";

const target = process.env.ORQENA_D10_AUTH_TARGET ?? "review";
const expectedOrigins = {
  review: "https://orqena-review-web-review.up.railway.app",
  staging: "https://orqena-web-staging.up.railway.app",
};
const EXPECTED_ORIGIN = expectedOrigins[target];
if (!EXPECTED_ORIGIN) throw new Error(`D10_AUTH_TARGET_INVALID:${target}`);
const origin = (process.env.ORQENA_REVIEW_BASE_URL ?? EXPECTED_ORIGIN).replace(/\/$/u, "");
const password = target === "staging"
  ? process.env.ORQENA_STAGING_TEST_PASSWORD
  : process.env.ORQENA_REVIEW_QA_PASSWORD;
let ownerMfaSecret = process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;
const deployedSha = process.env.ORQENA_REVIEW_SHA ?? process.env.ORQENA_STAGING_SHA ?? "";
const networkIdleTimeoutMs = Number(process.env.ORQENA_D10_NETWORK_IDLE_TIMEOUT_MS ?? 8_000);
if (!Number.isFinite(networkIdleTimeoutMs) || networkIdleTimeoutMs < 500 || networkIdleTimeoutMs > 30_000) {
  throw new Error("D10_NETWORK_IDLE_TIMEOUT_INVALID");
}
if (target === "review" && process.env.ORQENA_REVIEW_FOCUS_D10 !== "true") throw new Error("D10_AUTH_FOCUS_REQUIRED");
if (target === "staging" && process.env.ORQENA_D11_STAGING_APPROVED !== "true") throw new Error("D11_STAGING_APPROVAL_REQUIRED");
if (origin !== EXPECTED_ORIGIN) throw new Error(`D10_AUTH_${target.toUpperCase()}_ORIGIN_MISMATCH:${origin}`);
if (!password || password.length < (target === "staging" ? 16 : 24)) throw new Error("D10_AUTH_QA_PASSWORD_REQUIRED");
if (target === "review" && !ownerMfaSecret) throw new Error("D10_AUTH_OWNER_MFA_REQUIRED");
if (!/^[0-9a-f]{40}$/u.test(deployedSha)) throw new Error("D10_AUTH_SHA_REQUIRED");
delete process.env.ORQENA_REVIEW_OWNER_TOTP_SECRET;

const outputRoot = process.env.ORQENA_D10_AUTH_ENGINE_DIR
  ?? join(process.cwd(), "artifacts", `design-d10-auth-engines-${target}-${deployedSha.slice(0, 8)}`);
const screenshotRoot = join(outputRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });

const allViewports = [
  { key: "320", width: 320, height: 720 },
  { key: "390", width: 390, height: 844 },
  { key: "430", width: 430, height: 932 },
  { key: "768", width: 768, height: 1024 },
  { key: "1024", width: 1024, height: 768 },
  { key: "1280", width: 1280, height: 800 },
  { key: "1440", width: 1440, height: 900 },
  { key: "1920", width: 1920, height: 1080 },
];
const requestedViewportKeys = (process.env.ORQENA_D10_VIEWPORT_KEYS ?? "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);
const viewports = requestedViewportKeys.length
  ? allViewports.filter(({ key }) => requestedViewportKeys.includes(key))
  : allViewports;
if (!viewports.length || requestedViewportKeys.some((key) => !allViewports.some((viewport) => viewport.key === key))) {
  throw new Error(`D10_AUTH_VIEWPORT_SELECTION_INVALID:${requestedViewportKeys.join(",")}`);
}
const allProfiles = [
  { key: "owner", emailKey: "owner", route: "/hoy", readOnly: false },
  { key: "worker", emailKey: "worker", route: "/tareas", readOnly: false },
  { key: "external", emailKey: target === "staging" ? "external-collaborator" : "external", route: "/obras", readOnly: false },
  { key: "viewer", emailKey: target === "staging" ? "advisor-auditor" : "viewer", route: "/auditoria", readOnly: true },
];
const requestedProfileKeys = (process.env.ORQENA_D10_PROFILE_KEYS ?? "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);
const profiles = requestedProfileKeys.length
  ? allProfiles.filter(({ key }) => requestedProfileKeys.includes(key))
  : allProfiles;
if (!profiles.length || requestedProfileKeys.some((key) => !allProfiles.some((profile) => profile.key === key))) {
  throw new Error(`D10_AUTH_PROFILE_SELECTION_INVALID:${requestedProfileKeys.join(",")}`);
}
const fixturePrefix = target === "staging" ? "staging" : "review";
const allOwnerRoutes = [
  "/hoy",
  "/dashboard",
  "/clientes",
  `/clientes/${fixturePrefix}-client-1`,
  "/obras",
  `/obras/${fixturePrefix}-work-1`,
  "/presupuestos",
  `/presupuestos/${fixturePrefix}-budget-1`,
  "/dinero",
  `/dinero/${fixturePrefix}-invoice-1`,
  "/tesoreria",
  "/documentos",
  "/agenda",
  "/capataz",
  "/equipo",
  "/configuracion",
  ...(target === "review" ? ["/plataforma"] : []),
];
const requestedOwnerRoutes = (process.env.ORQENA_D10_OWNER_ROUTES ?? "")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const ownerRoutes = requestedOwnerRoutes.length
  ? allOwnerRoutes.filter((route) => requestedOwnerRoutes.includes(route))
  : allOwnerRoutes;
if (!ownerRoutes.length || requestedOwnerRoutes.some((route) => !allOwnerRoutes.includes(route))) {
  throw new Error(`D10_AUTH_OWNER_ROUTE_SELECTION_INVALID:${requestedOwnerRoutes.join(",")}`);
}
if (ownerRoutes.length && !profiles.some(({ key }) => key === "owner")) {
  throw new Error("D10_AUTH_OWNER_PROFILE_REQUIRED");
}
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
let loginAttempts = 0;

function sanitize(value) {
  return String(value)
    .replace(/([?&](?:token|code|secret|password)=)[^&\s]+/giu, "$1[REDACTED]")
    .replace(/[A-Za-z0-9_-]{48,}/gu, "[LONG_VALUE_REDACTED]")
    .slice(0, 800);
}

function attachDiagnostics(page) {
  const events = [];
  const externalHosts = new Set();
  const expectedServerActionAborts = [];
  page.on("console", (message) => {
    if (message.type() === "error") events.push(`console:${sanitize(message.text())}`);
  });
  page.on("pageerror", (error) => events.push(`page:${sanitize(error.message)}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
    const requestOrigin = new URL(request.url()).origin;
    const nextAction = request.headers()["next-action"];
    if (failure === "net::ERR_ABORTED" && request.method() === "POST" && requestOrigin === origin && nextAction) {
      expectedServerActionAborts.push(`POST:${sanitize(new URL(request.url()).pathname)}:NEXT_ACTION_STREAM_ABORTED`);
      return;
    }
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
  return { events, externalHosts, expectedServerActionAborts };
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
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
      .map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.length,
        targets: nodes.map((node) => node.target),
        failureSummaries: nodes.map((node) => sanitize(node.failureSummary ?? "")),
      })),
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
        expectedServerActionAborts: audited.diagnostics.expectedServerActionAborts,
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
  loginAttempts += 1;
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const startedAt = Date.now();
  const response = await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel("Correo").fill(`${profile.emailKey}@${target}.orqena.invalid`);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
  await settle(page);
  if (profile.key === "owner" && target === "review") {
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
        let profileScreenshot = null;
        if (engine.key === "chromium" && ["320", "390", "1440"].includes(viewport.key)) {
          profileScreenshot = join(screenshotRoot, `${engine.key}-${viewport.key}-profile-${profile.key}.png`);
          await audited.page.screenshot({ path: profileScreenshot, fullPage: true, animations: "disabled" });
          screenshots.push({
            kind: "profile",
            engine: engine.key,
            viewport: viewport.key,
            profile: profile.key,
            route: profile.route,
            path: relative(process.cwd(), profileScreenshot),
            bytes: statSync(profileScreenshot).size,
          });
        }
        profileCases.push({
          engine: engine.key,
          viewport: `${viewport.width}x${viewport.height}`,
          profile: profile.key,
          route: profile.route,
          status: audited.response?.status() ?? 0,
          finalPath: new URL(audited.page.url()).pathname,
          transientDiagnostics: audited.transientDiagnostics,
          diagnostics: audited.diagnostics.events,
          expectedServerActionAborts: audited.diagnostics.expectedServerActionAborts,
          externalHosts: [...audited.diagnostics.externalHosts],
          screenshot: profileScreenshot ? relative(process.cwd(), profileScreenshot) : null,
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
        if (engine.key === "chromium" && ["390", "1440"].includes(viewport.key) && ["/hoy", `/clientes/${fixturePrefix}-client-1`, `/obras/${fixturePrefix}-work-1`, "/capataz"].includes(route)) {
          const routeSlug = route.slice(1).replaceAll("/", "-").replaceAll("[", "").replaceAll("]", "");
          screenshot = join(screenshotRoot, `${engine.key}-${viewport.key}-${routeSlug}.png`);
          await audited.page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
          screenshots.push({
            kind: "owner-surface",
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
          expectedServerActionAborts: audited.diagnostics.expectedServerActionAborts,
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
  target,
  generatedAt: new Date().toISOString(),
  origin,
  deployedSha,
  syntheticOnly: true,
  credentialsPersisted: false,
  productionWrites: 0,
  stagingWrites: target === "staging" ? loginAttempts : 0,
  stagingWriteScope: target === "staging" ? "authorized synthetic authentication sessions only" : "none",
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
  expectedServerActionAborts: [
    ...loginCases,
    ...profileCases,
    ...ownerSurfaceCases,
  ].reduce((total, item) => total + (item.expectedServerActionAborts?.length ?? 0), 0),
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
