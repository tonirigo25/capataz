import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.ORQENA_V41_BASE_URL?.replace(/\/$/, "");
const password = process.env.ORQENA_STAGING_TEST_PASSWORD;
const publicOnly = process.env.ORQENA_V41_PUBLIC_ONLY === "true";
const sha = process.env.ORQENA_V41_SHA ?? "local-unpublished";
const output = process.env.ORQENA_V41_AUDIT_DIR
  ?? join(process.env.USERPROFILE ?? process.cwd(), "Desktop", "orqena-experience-v4-1-audit");
const screenshotsDir = join(output, "screenshots");
const videosDir = join(output, "videos");
const chromePath = process.env.ORQENA_CHROME_PATH
  ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

if (!baseUrl?.startsWith("http")) throw new Error("ORQENA_V41_BASE_URL_REQUIRED");
if (!publicOnly && (!password || password.length < 16)) throw new Error("ORQENA_STAGING_TEST_PASSWORD_REQUIRED");

mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(videosDir, { recursive: true });

const viewports = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1024, height: 900 },
  wide: { width: 1440, height: 1000 },
};
const emails = {
  owner: "owner@staging.orqena.invalid",
  sales: "sales@staging.orqena.invalid",
  finance: "finance@staging.orqena.invalid",
  worker: "worker@staging.orqena.invalid",
};
const axeSourceResponse = await fetch("https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js");
if (!axeSourceResponse.ok) throw new Error(`AXE_DOWNLOAD_FAILED:${axeSourceResponse.status}`);
const axeSource = await axeSourceResponse.text();
const hashFile = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const fileName = (path) => path.split(/[\\/]/).at(-1);

function captureErrors(page, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page:${error.message}`));
  page.on("requestfailed", (request) => {
    const detail = request.failure()?.errorText ?? "failed";
    if (!detail.includes("ERR_ABORTED")) errors.push(`network:${request.method()} ${request.url()} ${detail}`);
  });
}

async function goto(page, path, expectedStatus = 200) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const loading = document.querySelectorAll("[aria-busy='true'], [data-skeleton], .animate-pulse");
    return loading.length === 0 && !/Cargando(?:\s+[^.\n…]{1,80})?(?:…|\.\.\.)/i.test(document.body.innerText);
  }, undefined, { timeout: 15_000 }).catch(() => {
    throw new Error(`SKELETON_OR_LOADING_STATE:${path}`);
  });
  if ((response?.status() ?? 0) !== expectedStatus) {
    throw new Error(`UNEXPECTED_STATUS:${path}:${response?.status()}:${expectedStatus}`);
  }
  return response;
}

async function setTheme(page, theme) {
  const label = theme === "dark" ? "Oscuro" : "Claro";
  const button = page.locator(".theme-switcher:visible").getByRole("button", { name: label, exact: true });
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(120);
  }
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  if (applied !== theme) throw new Error(`THEME_NOT_APPLIED:${theme}:${applied}`);
}

async function assertUsable(page, route, errors) {
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    unnamedButtons: [...document.querySelectorAll("button")]
      .filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim())).length,
    headings: document.querySelectorAll("h1").length,
    main: document.querySelectorAll("main").length,
  }));
  if (state.overflow) throw new Error(`OVERFLOW:${route}`);
  if (state.unnamedButtons) throw new Error(`UNNAMED_BUTTONS:${route}:${state.unnamedButtons}`);
  if (state.headings !== 1) throw new Error(`H1_COUNT:${route}:${state.headings}`);
  if (state.main !== 1) throw new Error(`MAIN_COUNT:${route}:${state.main}`);
  if (errors.length) throw new Error(JSON.stringify({ route, errors }));
  return state;
}

async function login(page, role) {
  await goto(page, "/login");
  await page.getByLabel("Correo").fill(emails[role]);
  await page.getByLabel("Contraseña").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(400);
}

async function getStorageState(browser, role) {
  const context = await browser.newContext({ viewport: viewports.desktop });
  const page = await context.newPage();
  await login(page, role);
  const storage = await context.storageState();
  await context.close();
  return storage;
}

async function runAxe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    const report = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
      resultTypes: ["violations"],
    });
    return report.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 8).map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    }));
  });
  const blocking = result.filter(({ impact }) => impact === "critical" || impact === "serious");
  if (blocking.length) throw new Error(`AXE_BLOCKING:${name}:${JSON.stringify(blocking)}`);
  return { name, violations: result, blocking: 0 };
}

async function auditPage(browser, {
  name,
  route,
  viewport = "desktop",
  theme = "light",
  role,
  storageState,
  status = 200,
}) {
  const context = await browser.newContext({
    viewport: viewports[viewport],
    storageState: role ? storageState : undefined,
  });
  const page = await context.newPage();
  const errors = [];
  captureErrors(page, errors);
  await goto(page, route, status);
  if (route !== "/brand/favicon.svg" && route !== "/no-existe-v41-audit") await setTheme(page, theme);
  const usable = await assertUsable(page, route, errors);
  const axe = await runAxe(page, name);
  await context.close();
  return { ...axe, route, viewport, theme, role: role ?? "PUBLIC", usable };
}

async function measurePerformance(browser) {
  const context = await browser.newContext({ viewport: viewports.wide });
  await context.addInitScript(() => {
    window.__orqenaV41Performance = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__orqenaV41Performance.lcp = entries.at(-1)?.startTime ?? 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__orqenaV41Performance.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      window.__orqenaV41Performance.longTasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })));
    }).observe({ type: "longtask", buffered: true });
  });
  const page = await context.newPage();
  await goto(page, "/");
  await page.waitForTimeout(1200);
  const next = page.locator(".v41-hero").getByRole("button", { name: "Etapa siguiente" });
  const interactionWindowStart = await page.evaluate(() => performance.now());
  const interactionStarted = performance.now();
  await next.click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const interactionMs = performance.now() - interactionStarted;
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const scripts = resources.filter((entry) => entry.initiatorType === "script");
    const images = resources.filter((entry) => entry.initiatorType === "img");
    return {
      lcpMs: Math.round(window.__orqenaV41Performance.lcp),
      cls: Number(window.__orqenaV41Performance.cls.toFixed(4)),
      initialJsBytes: Math.round(scripts.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
      imageBytes: Math.round(images.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
      longTasks: window.__orqenaV41Performance.longTasks,
    };
  });
  metrics.interactionMs = Math.round(interactionMs);
  metrics.animationLongTasks = metrics.longTasks.filter(
    ({ startTime, duration }) => startTime >= interactionWindowStart && duration > 200,
  );
  metrics.targets = { lcpMs: 2500, cls: 0.1, interactionMs: 200 };
  metrics.passes = {
    lcp: metrics.lcpMs > 0 && metrics.lcpMs <= 2500,
    cls: metrics.cls <= 0.1,
    interaction: metrics.interactionMs <= 200,
    longTasks: metrics.animationLongTasks.length === 0,
  };
  await context.close();
  if (!Object.values(metrics.passes).every(Boolean)) throw new Error(`PERFORMANCE_TARGET_FAILED:${JSON.stringify(metrics)}`);
  return metrics;
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-extensions", "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding"],
});

try {
  const storage = publicOnly
    ? {}
    : {
        owner: await getStorageState(browser, "owner"),
        sales: await getStorageState(browser, "sales"),
        finance: await getStorageState(browser, "finance"),
        worker: await getStorageState(browser, "worker"),
      };

  const a11yCases = [
    { name: "home-light", route: "/", viewport: "wide", theme: "light" },
    { name: "home-dark", route: "/", viewport: "wide", theme: "dark" },
    { name: "producto", route: "/producto", viewport: "wide", theme: "light" },
    { name: "sector", route: "/sectores/construccion", viewport: "desktop", theme: "light" },
    { name: "planes", route: "/planes", viewport: "desktop", theme: "light" },
    { name: "demo", route: "/demo", viewport: "desktop", theme: "light" },
    { name: "login", route: "/login", viewport: "desktop", theme: "light" },
    { name: "navegacion-mobile", route: "/", viewport: "mobile", theme: "light" },
  ];
  if (!publicOnly) {
    a11yCases.push(
      { name: "cliente-360", route: "/clientes/staging-client-1", viewport: "desktop", theme: "light", role: "owner", storageState: storage.owner },
      { name: "trabajo-360", route: "/obras/staging-work-1", viewport: "desktop", theme: "light", role: "owner", storageState: storage.owner },
    );
  }
  const accessibility = [];
  for (const item of a11yCases) accessibility.push(await auditPage(browser, item));

  const performanceMetrics = await measurePerformance(browser);
  writeFileSync(join(output, "accessibility.json"), `${JSON.stringify({ ok: true, blocking: 0, cases: accessibility }, null, 2)}\n`, "utf8");
  writeFileSync(join(output, "performance.json"), `${JSON.stringify({ ok: true, sha, baseUrl, ...performanceMetrics }, null, 2)}\n`, "utf8");

  if (publicOnly) {
    console.log(JSON.stringify({
      ok: true,
      mode: "public-only",
      accessibilityCases: accessibility.length,
      criticalOrSerious: 0,
      performance: performanceMetrics,
      output,
    }, null, 2));
    process.exit(0);
  }

  const captures = [
    { name: "home-claro-1440", route: "/", viewport: "wide", theme: "light" },
    { name: "home-oscuro-1440", route: "/", viewport: "wide", theme: "dark" },
    { name: "home-movil", route: "/", viewport: "mobile", theme: "light" },
    { name: "hero-etapas", route: "/", viewport: "wide", theme: "light", selector: ".v41-hero", action: async (page) => page.locator(".v41-hero [role='tab']").nth(4).click() },
    { name: "workflow", route: "/", viewport: "wide", theme: "light", selector: ".business-workflow", action: async (page) => page.locator(".business-workflow [role='tab']").nth(3).click() },
    { name: "producto", route: "/producto", viewport: "wide", theme: "light" },
    { name: "modulo-agenda", route: "/producto/agenda", viewport: "desktop", theme: "light" },
    { name: "sectores", route: "/sectores", viewport: "wide", theme: "light" },
    { name: "sector-construccion", route: "/sectores/construccion", viewport: "desktop", theme: "light" },
    { name: "planes", route: "/planes", viewport: "wide", theme: "light" },
    { name: "seguridad", route: "/seguridad", viewport: "desktop", theme: "light" },
    { name: "demo", route: "/demo", viewport: "desktop", theme: "light" },
    { name: "cliente-360-claro", route: "/clientes/staging-client-1", viewport: "wide", theme: "light", role: "owner" },
    { name: "cliente-360-oscuro", route: "/clientes/staging-client-1", viewport: "wide", theme: "dark", role: "owner" },
    { name: "cliente-360-movil", route: "/clientes/staging-client-1", viewport: "mobile", theme: "light", role: "owner" },
    { name: "trabajo-360-claro", route: "/obras/staging-work-1", viewport: "wide", theme: "light", role: "owner" },
    { name: "trabajo-360-oscuro", route: "/obras/staging-work-1", viewport: "wide", theme: "dark", role: "owner" },
    { name: "trabajo-360-movil", route: "/obras/staging-work-1", viewport: "mobile", theme: "light", role: "owner" },
    { name: "sales-hoy", route: "/hoy", viewport: "desktop", theme: "light", role: "sales" },
    { name: "finance-hoy", route: "/hoy", viewport: "desktop", theme: "light", role: "finance" },
    { name: "worker-hoy", route: "/hoy", viewport: "mobile", theme: "light", role: "worker" },
    { name: "login-beta", route: "/login", viewport: "desktop", theme: "light" },
    { name: "favicon", route: "/brand/favicon.svg", viewport: "desktop", theme: "light" },
    { name: "404", route: "/no-existe-v41-audit", viewport: "desktop", theme: "light", status: 404 },
  ];
  if (captures.length !== 24) throw new Error(`SCREENSHOT_BUDGET_INVALID:${captures.length}`);

  const screenshotRecords = [];
  for (const [index, capture] of captures.entries()) {
    const context = await browser.newContext({
      viewport: viewports[capture.viewport],
      storageState: capture.role ? storage[capture.role] : undefined,
    });
    const page = await context.newPage();
    const errors = [];
    captureErrors(page, errors);
    await goto(page, capture.route, capture.status ?? 200);
    if (!capture.route.startsWith("/brand/") && capture.status !== 404) await setTheme(page, capture.theme);
    if (capture.action) {
      await capture.action(page);
      await page.waitForTimeout(180);
    }
    if (capture.name === "login-beta") {
      if (await page.getByText("Crear cuenta", { exact: true }).count()) throw new Error("PUBLIC_REGISTRATION_VISIBLE");
      if (await page.getByText("Solicitar acceso", { exact: true }).count() !== 1) throw new Error("ACCESS_REQUEST_MISSING");
    }
    if (capture.name === "favicon") {
      const contentType = await page.evaluate(() => document.contentType);
      if (contentType !== "image/svg+xml") throw new Error(`FAVICON_CONTENT_TYPE:${contentType}`);
      if (errors.length) throw new Error(JSON.stringify({ route: capture.route, errors }));
    } else {
      await assertUsable(page, capture.route, errors);
    }
    const file = join(screenshotsDir, `${String(index + 1).padStart(2, "0")}-${capture.name}.png`);
    const target = capture.selector ? page.locator(capture.selector) : page;
    if (capture.selector) await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: file, fullPage: !capture.selector, caret: "initial" });
    if (!existsSync(file) || statSync(file).size < 3_000) throw new Error(`INVALID_SCREENSHOT:${file}`);
    screenshotRecords.push({
      name: capture.name,
      route: capture.route,
      role: capture.role ?? "PUBLIC",
      viewport: viewports[capture.viewport],
      theme: capture.theme,
      file: join("screenshots", fileName(file)),
      bytes: statSync(file).size,
      sha256: hashFile(file),
    });
    await context.close();
  }
  if (new Set(screenshotRecords.map(({ sha256 }) => sha256)).size !== 24) throw new Error("DUPLICATE_SCREENSHOT_HASH");

  async function recordVideo(name, {
    route,
    viewport = "wide",
    role,
    action,
  }) {
    const context = await browser.newContext({
      viewport: viewports[viewport],
      storageState: role ? storage[role] : undefined,
      recordVideo: { dir: videosDir, size: viewports[viewport] },
    });
    const page = await context.newPage();
    await goto(page, route);
    const video = page.video();
    await action(page);
    await context.close();
    const generated = await video.path();
    const target = join(videosDir, `${name}.webm`);
    renameSync(generated, target);
    if (statSync(target).size < 20_000) throw new Error(`INVALID_VIDEO:${target}`);
    return {
      name,
      route,
      role: role ?? "PUBLIC",
      file: join("videos", fileName(target)),
      bytes: statSync(target).size,
      sha256: hashFile(target),
    };
  }

  const videoRecords = [];
  videoRecords.push(await recordVideo("01-hero", {
    route: "/",
    action: async (page) => {
      await page.locator(".v41-hero").scrollIntoViewIfNeeded();
      await page.waitForTimeout(7_000);
    },
  }));
  videoRecords.push(await recordVideo("02-workflow", {
    route: "/",
    action: async (page) => {
      const workflow = page.locator(".business-workflow");
      await workflow.scrollIntoViewIfNeeded();
      await workflow.getByRole("button", { name: "Reproducir" }).click();
      await page.waitForTimeout(7_000);
    },
  }));
  videoRecords.push(await recordVideo("03-cliente-360", {
    route: "/clientes/staging-client-1",
    role: "owner",
    action: async (page) => {
      for (const tab of ["Actividad", "Trabajos", "Documentos", "Resumen"]) {
        const button = page.getByRole("tab", { name: tab, exact: true });
        if (await button.count()) await button.click();
        await page.waitForTimeout(1_200);
      }
    },
  }));
  videoRecords.push(await recordVideo("04-demo-movil", {
    route: "/demo",
    viewport: "mobile",
    action: async (page) => {
      const play = page.getByRole("button", { name: /Reproducir|Empezar/i }).first();
      if (await play.count()) await play.click();
      await page.waitForTimeout(7_000);
    },
  }));
  if (videoRecords.length !== 4) throw new Error(`VIDEO_BUDGET_INVALID:${videoRecords.length}`);

  const manifest = {
    ok: true,
    sha,
    baseUrl,
    capturedAt: new Date().toISOString(),
    browser: "Google Chrome headless",
    screenshots: screenshotRecords.length,
    videos: videoRecords.length,
    accessibility: { cases: accessibility.length, criticalOrSerious: 0 },
    performance: performanceMetrics,
    screenshotRecords,
    videoRecords,
  };
  writeFileSync(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(
    join(output, "summary.txt"),
    `OK | SHA ${sha} | 24 capturas | 4 vídeos | axe Critical/Serious 0 | LCP ${performanceMetrics.lcpMs} ms | CLS ${performanceMetrics.cls} | interacción ${performanceMetrics.interactionMs} ms\n`,
    "utf8",
  );
  console.log(JSON.stringify({
    ok: true,
    screenshots: screenshotRecords.length,
    videos: videoRecords.length,
    accessibilityCriticalOrSerious: 0,
    performance: performanceMetrics,
    output,
  }, null, 2));
} finally {
  await browser.close();
}
