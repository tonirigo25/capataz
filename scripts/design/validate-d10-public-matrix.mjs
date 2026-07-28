import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import sharp from "sharp";

const target = process.env.ORQENA_D10_TARGET ?? "review";
const expectedOrigins = {
  review: "https://orqena-review-web-review.up.railway.app",
  staging: "https://orqena-web-staging.up.railway.app",
};
const EXPECTED_ORIGIN = expectedOrigins[target];
if (!EXPECTED_ORIGIN) throw new Error(`D10_TARGET_INVALID:${target}`);
const origin = (process.env.ORQENA_D10_BASE_URL ?? EXPECTED_ORIGIN).replace(/\/$/u, "");
const deployedSha = process.env.ORQENA_D10_SHA ?? "";
if (target === "review" && process.env.ORQENA_D10_REMOTE_APPROVED !== "true") {
  throw new Error("D10_REMOTE_APPROVAL_REQUIRED");
}
if (target === "staging" && process.env.ORQENA_D11_STAGING_APPROVED !== "true") {
  throw new Error("D11_STAGING_APPROVAL_REQUIRED");
}
if (origin !== EXPECTED_ORIGIN) throw new Error(`D10_${target.toUpperCase()}_ORIGIN_MISMATCH:${origin}`);
if (!/^[0-9a-f]{40}$/u.test(deployedSha)) throw new Error("D10_SHA_REQUIRED");

const outputRoot = process.env.ORQENA_D10_OUTPUT_DIR
  ?? join(process.cwd(), "artifacts", `design-d10-public-${deployedSha.slice(0, 8)}`);
const screenshotRoot = join(outputRoot, "screenshots");
const diffRoot = join(outputRoot, "diffs");
mkdirSync(screenshotRoot, { recursive: true });
mkdirSync(diffRoot, { recursive: true });

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
  throw new Error(`D10_VIEWPORT_SELECTION_INVALID:${requestedViewportKeys.join(",")}`);
}
const routes = [
  "/",
  "/demo",
  "/demo-v2",
  "/contacto",
  "/producto",
  "/soluciones",
  "/sectores",
  "/planes",
  "/seguridad",
  "/estado",
  "/soporte",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/politicas",
  "/recursos/calculadora-margen-obra",
  "/recursos/checklist-factura-recibida",
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
  "/verificar-email",
  "/aceptar-invitacion",
  "/marketing-v2",
];
const engines = [
  { key: "chromium", launcher: chromium },
  { key: "firefox", launcher: firefox },
  { key: "webkit", launcher: webkit },
];
const screenshotRoutes = new Set(["/", "/demo", "/login"]);
const findings = [];
const cases = [];
const screenshotCases = [];
const performanceCases = [];
const mediaCases = [];
const diffCases = [];
const observations = [];
let performanceSummary = null;

function slug(route) {
  return route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
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
}

async function pageState(page) {
  return page.evaluate(() => ({
    h1Count: [...document.querySelectorAll("h1")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }).length,
    mainCount: document.querySelectorAll("main").length,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
    noindex: [...document.querySelectorAll('meta[name="robots"]')].some((element) => /noindex/iu.test(element.getAttribute("content") ?? "")),
    realLookingEmails: (document.body.innerText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [])
      .filter((email) => {
        const normalizedEmail = email.toLowerCase();
        return !normalizedEmail.endsWith(".invalid") && normalizedEmail !== "hola@orqenatech.com";
      }),
    secretMarkers: (document.body.innerText.match(/(?:sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|password\s*=\s*\S+)/giu) ?? []),
  }));
}

function installVitalsObservers() {
  window.__d10Vitals = { cls: 0, lcp: null, inp: null };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__d10Vitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__d10Vitals.lcp = entries.at(-1)?.startTime ?? window.__d10Vitals.lcp;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__d10Vitals.inp = Math.max(window.__d10Vitals.inp ?? 0, entry.duration);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {}
}

function serializeAxeViolation(violation, nodes = violation.nodes) {
  return {
    id: violation.id,
    impact: violation.impact,
    nodes: nodes.length,
    targets: nodes.map((node) => node.target),
    failureSummaries: nodes.map((node) => sanitize(node.failureSummary ?? "")),
  };
}

async function verifyTargetSizeViolation(page, violation, caseKey) {
  const unresolved = [];
  for (const node of violation.nodes) {
    const selector = Array.isArray(node.target) && typeof node.target[0] === "string" ? node.target[0] : null;
    if (!selector) {
      unresolved.push(node);
      continue;
    }
    try {
      const locator = page.locator(selector).first();
      if (await locator.count() !== 1) {
        unresolved.push(node);
        continue;
      }
      const before = await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { height: rect.height, top: rect.top, width: rect.width };
      });
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      const replay = await new AxeBuilder({ page }).withRules(["target-size"]).analyze();
      const targetKey = JSON.stringify(node.target);
      const repeated = replay.violations
        .flatMap((item) => item.nodes)
        .some((item) => JSON.stringify(item.target) === targetKey);
      if (repeated) {
        unresolved.push(node);
      } else {
        observations.push({
          code: "AXE_TARGET_SIZE_OFFSCREEN_REPLAY_PASSED",
          case: caseKey,
          target: node.target,
          initialRect: before,
        });
      }
    } catch (error) {
      unresolved.push(node);
      observations.push({
        code: "AXE_TARGET_SIZE_REPLAY_ERROR",
        case: caseKey,
        target: node.target,
        detail: sanitize(error instanceof Error ? error.message : error),
      });
    }
  }
  return unresolved;
}

async function replayHydrationDiagnostic(browser, viewport, route) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    serviceWorkers: "block",
    colorScheme: "light",
  });
  try {
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);
    const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settle(page);
    return {
      status: response?.status() ?? 0,
      diagnostics: diagnostics.events,
      externalHosts: [...diagnostics.externalHosts],
    };
  } finally {
    await context.close();
  }
}

for (const engine of engines) {
  const browser = await engine.launcher.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      process.stdout.write(`D10 public ${engine.key} ${viewport.width}x${viewport.height}\n`);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: "block",
        colorScheme: "light",
      });
      for (const route of routes) {
        const page = await context.newPage();
        const diagnostics = attachDiagnostics(page);
        const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await settle(page);
        const state = await pageState(page);
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        const caseKey = `${engine.key}:${viewport.key}:${route}`;
        const axeBlocking = [];
        for (const violation of axe.violations.filter(({ impact }) => impact === "critical" || impact === "serious")) {
          if (violation.id === "target-size") {
            const unresolved = await verifyTargetSizeViolation(page, violation, caseKey);
            if (unresolved.length) axeBlocking.push(serializeAxeViolation(violation, unresolved));
          } else {
            axeBlocking.push(serializeAxeViolation(violation));
          }
        }
        let blockingDiagnostics = diagnostics.events;
        let diagnosticReplay = null;
        const hydrationOnly = diagnostics.events.length > 0
          && diagnostics.events.every((event) => /(?:React error #418|hydration)/iu.test(event));
        if (hydrationOnly) {
          diagnosticReplay = await replayHydrationDiagnostic(browser, viewport, route);
          if (diagnosticReplay.status === 200 && diagnosticReplay.diagnostics.length === 0 && diagnosticReplay.externalHosts.length === 0) {
            blockingDiagnostics = [];
            observations.push({
              code: "ISOLATED_HYDRATION_REPLAY_PASSED",
              case: caseKey,
              initialDiagnostics: diagnostics.events,
            });
          }
        }
        if (response?.status() !== 200) findings.push(`${caseKey}:HTTP_${response?.status() ?? 0}`);
        if (state.h1Count !== 1) findings.push(`${caseKey}:H1_COUNT_${state.h1Count}`);
        if (state.mainCount !== 1) findings.push(`${caseKey}:MAIN_COUNT_${state.mainCount}`);
        if (state.overflowPx > 1) findings.push(`${caseKey}:OVERFLOW_${state.overflowPx}`);
        if (state.brokenImages) findings.push(`${caseKey}:BROKEN_IMAGES_${state.brokenImages}`);
        if (!state.noindex) findings.push(`${caseKey}:NOINDEX_MISSING`);
        if (state.realLookingEmails.length) findings.push(`${caseKey}:PII_EMAIL_${state.realLookingEmails.length}`);
        if (state.secretMarkers.length) findings.push(`${caseKey}:SECRET_MARKER_${state.secretMarkers.length}`);
        if (axeBlocking.length) findings.push(`${caseKey}:AXE_${axeBlocking.map(({ id }) => id).join(",")}`);
        if (blockingDiagnostics.length) findings.push(`${caseKey}:DIAGNOSTICS_${blockingDiagnostics.length}`);
        if (diagnostics.externalHosts.size) findings.push(`${caseKey}:EXTERNAL_${[...diagnostics.externalHosts].join(",")}`);

        let screenshot = null;
        if (engine.key === "chromium" && screenshotRoutes.has(route)) {
          screenshot = join(screenshotRoot, `${slug(route)}-${viewport.key}.png`);
          await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
          screenshotCases.push({
            route,
            viewport: viewport.key,
            engine: engine.key,
            path: relative(process.cwd(), screenshot),
            bytes: statSync(screenshot).size,
          });
        }
        cases.push({
          engine: engine.key,
          viewport: `${viewport.width}x${viewport.height}`,
          route,
          status: response?.status() ?? 0,
          axeBlocking,
          diagnostics: diagnostics.events,
          blockingDiagnostics,
          diagnosticReplay,
          externalHosts: [...diagnostics.externalHosts],
          screenshot: screenshot ? relative(process.cwd(), screenshot) : null,
          ...state,
        });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

for (const engine of engines) {
  const browser = await engine.launcher.launch({ headless: true });
  try {
    for (const forcedColors of ["none", "active"]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion: "reduce",
        forcedColors,
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const diagnostics = attachDiagnostics(page);
      await page.addInitScript(installVitalsObservers);
      const response = await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const state = await pageState(page);
      const media = await page.evaluate(() => ({
        forcedColors: matchMedia("(forced-colors: active)").matches,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        maxMotionSeconds: Math.max(0, ...[...document.querySelectorAll("body *")].flatMap((element) => {
          const style = getComputedStyle(element);
          return `${style.animationDuration},${style.transitionDuration}`
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value) || 0);
        })),
        focusVisible: document.activeElement !== document.body && document.activeElement !== document.documentElement,
        vitals: {
          LCP: window.__d10Vitals?.lcp ?? null,
          CLS: window.__d10Vitals?.cls ?? null,
          INP: window.__d10Vitals?.inp ?? null,
          INPUpperBound: window.__d10Vitals?.inp === null ? 16 : null,
        },
      }));
      const caseKey = `${engine.key}:media:${forcedColors}`;
      if (response?.status() !== 200) findings.push(`${caseKey}:HTTP_${response?.status() ?? 0}`);
      if (state.overflowPx > 1) findings.push(`${caseKey}:OVERFLOW_${state.overflowPx}`);
      if (!media.reducedMotion || media.maxMotionSeconds > 0.01) findings.push(`${caseKey}:REDUCED_MOTION_${media.maxMotionSeconds}`);
      if (forcedColors === "active" && !media.forcedColors) findings.push(`${caseKey}:FORCED_COLORS_INACTIVE`);
      if (!media.focusVisible) findings.push(`${caseKey}:FOCUS_MISSING`);
      if (diagnostics.events.length) findings.push(`${caseKey}:DIAGNOSTICS_${diagnostics.events.length}`);
      if (diagnostics.externalHosts.size) findings.push(`${caseKey}:EXTERNAL_${[...diagnostics.externalHosts].join(",")}`);
      mediaCases.push({
        engine: engine.key,
        forcedColors,
        route: "/",
        ...media,
        overflowPx: state.overflowPx,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

{
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      serviceWorkers: "block",
      colorScheme: "light",
    });
    for (let run = 1; run <= 3; run += 1) {
      const page = await context.newPage();
      const diagnostics = attachDiagnostics(page);
      await page.addInitScript(installVitalsObservers);
      const startedAt = Date.now();
      const response = await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
      await page.waitForTimeout(1_500);
      const safeInteraction = page.locator("summary:visible").first();
      if (await safeInteraction.count()) {
        await safeInteraction.click();
        await page.waitForTimeout(250);
      }
      const vitals = await page.evaluate(() => ({
        LCP: window.__d10Vitals?.lcp ?? null,
        CLS: window.__d10Vitals?.cls ?? null,
        INP: window.__d10Vitals?.inp ?? null,
        INPUpperBound: window.__d10Vitals?.inp === null ? 16 : null,
      }));
      const caseKey = `chromium:performance:run-${run}`;
      if (response?.status() !== 200) findings.push(`${caseKey}:HTTP_${response?.status() ?? 0}`);
      if (diagnostics.events.length) findings.push(`${caseKey}:DIAGNOSTICS_${diagnostics.events.length}`);
      if (diagnostics.externalHosts.size) findings.push(`${caseKey}:EXTERNAL_${[...diagnostics.externalHosts].join(",")}`);
      performanceCases.push({
        run,
        route: "/",
        engine: "chromium",
        viewport: "1280x800",
        elapsedMs: Date.now() - startedAt,
        ...vitals,
        effectiveINP: vitals.INP ?? vitals.INPUpperBound,
        diagnostics: diagnostics.events,
        externalHosts: [...diagnostics.externalHosts],
      });
      await page.close();
    }
    await context.close();

    const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
    const lcpValues = performanceCases.flatMap((item) => item.LCP === null ? [] : [item.LCP]);
    const clsValues = performanceCases.map((item) => item.CLS);
    const inpValues = performanceCases.map((item) => item.effectiveINP);
    performanceSummary = {
      method: "median-of-three-same-context",
      thresholds: { LCP: 2_500, CLS: 0.1, INP: 200 },
      samples: performanceCases.length,
      median: {
        LCP: lcpValues.length === 3 ? median(lcpValues) : null,
        CLS: median(clsValues),
        INP: median(inpValues),
      },
    };
    if (performanceSummary.median.LCP === null) findings.push("chromium:performance:LCP_UNAVAILABLE");
    else if (performanceSummary.median.LCP > performanceSummary.thresholds.LCP) findings.push(`chromium:performance:LCP_MEDIAN_${performanceSummary.median.LCP}`);
    if (performanceSummary.median.CLS > performanceSummary.thresholds.CLS) findings.push(`chromium:performance:CLS_MEDIAN_${performanceSummary.median.CLS}`);
    if (performanceSummary.median.INP > performanceSummary.thresholds.INP) findings.push(`chromium:performance:INP_MEDIAN_${performanceSummary.median.INP}`);
  } finally {
    await browser.close();
  }
}

{
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 640, height: 400 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settle(page);
    const state = await pageState(page);
    if (state.overflowPx > 1) findings.push(`chromium:zoom-200-equivalent:OVERFLOW_${state.overflowPx}`);
    mediaCases.push({
      engine: "chromium",
      route: "/",
      zoom: "200%-reflow-equivalent",
      cssViewport: "640x400",
      physicalReference: "1280x800",
      realBrowserZoom: "READY_FOR_EXTERNAL_INPUT",
      overflowPx: state.overflowPx,
    });
    await context.close();
  } finally {
    await browser.close();
  }
}

const baselineRoot = join(process.cwd(), "artifacts", "design", "baseline-4e397406");
const diffViewportKeys = ["390", "768", "1024", "1440"]
  .filter((key) => viewports.some((viewport) => viewport.key === key));
for (const viewport of diffViewportKeys) {
  for (const route of ["/", "/demo", "/login"]) {
    const name = `${slug(route)}-${viewport}.png`;
    const baselinePath = join(baselineRoot, name);
    const currentPath = join(screenshotRoot, name);
    const baseline = sharp(baselinePath).ensureAlpha();
    const current = sharp(currentPath).ensureAlpha();
    const [baselineMeta, currentMeta] = await Promise.all([baseline.metadata(), current.metadata()]);
    const caseKey = `${route}:${viewport}`;
    if (baselineMeta.width !== currentMeta.width || baselineMeta.height !== currentMeta.height) {
      findings.push(`visual-diff:${caseKey}:DIMENSIONS`);
      diffCases.push({
        route,
        viewport,
        status: "DIMENSIONS_CHANGED",
        baseline: `${baselineMeta.width}x${baselineMeta.height}`,
        current: `${currentMeta.width}x${currentMeta.height}`,
      });
      continue;
    }
    const [baselinePixels, currentPixels] = await Promise.all([
      baseline.raw().toBuffer(),
      current.raw().toBuffer(),
    ]);
    const difference = Buffer.alloc(baselinePixels.length);
    let changedPixels = 0;
    for (let index = 0; index < difference.length; index += 4) {
      difference[index] = Math.abs(baselinePixels[index] - currentPixels[index]);
      difference[index + 1] = Math.abs(baselinePixels[index + 1] - currentPixels[index + 1]);
      difference[index + 2] = Math.abs(baselinePixels[index + 2] - currentPixels[index + 2]);
      difference[index + 3] = 255;
      if (difference[index] > 24 || difference[index + 1] > 24 || difference[index + 2] > 24) changedPixels += 1;
    }
    const ratio = changedPixels / (baselineMeta.width * baselineMeta.height);
    const diffPath = join(diffRoot, name);
    await sharp(difference, {
      raw: {
        width: baselineMeta.width,
        height: baselineMeta.height,
        channels: 4,
      },
    }).png().toFile(diffPath);
    const status = ratio <= 0.02 ? "PASS_TECHNICAL_TOLERANCE" : "DIFFERENCE_REQUIRES_REVIEW";
    if (ratio > 0.02) findings.push(`visual-diff:${caseKey}:RATIO_${ratio.toFixed(6)}`);
    diffCases.push({
      route,
      viewport,
      baselineSha: "4e3974061d6d283104ffb485952b3b1636fd997a",
      currentSha: deployedSha,
      thresholdPerChannel: 24,
      changedPixelRatio: ratio,
      diff: relative(process.cwd(), diffPath),
      status,
      officialApproval: "READY_FOR_EXTERNAL_INPUT",
    });
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
  productionWrites: 0,
  stagingWrites: 0,
  routes,
  viewports,
  engines: engines.map(({ key }) => key),
  cases,
  screenshotCases,
  diffCases,
  mediaCases,
  performanceCases,
  performanceSummary,
  observations,
  externalInput: [
    "Safari real",
    "Chrome Android real",
    "NVDA",
    "VoiceOver",
    "Zoom humano 200 por ciento",
    "Aprobación humana de baseline visual",
  ],
  findings: [...new Set(findings)],
};
report.summary = {
  ok: report.findings.length === 0,
  publicMatrixCases: cases.length,
  axeCases: cases.length,
  screenshotCases: screenshotCases.length,
  visualDiffCases: diffCases.length,
  mediaCases: mediaCases.length,
  performanceCases: performanceCases.length,
  observations: observations.length,
  blockingFindings: report.findings.length,
};
writeFileSync(join(outputRoot, "public-matrix.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...report.summary,
  output: relative(process.cwd(), join(outputRoot, "public-matrix.json")),
}, null, 2));
if (!report.summary.ok) process.exitCode = 1;
