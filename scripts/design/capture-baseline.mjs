import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const EXPECTED_ORIGIN = "https://orqena-review-web-review.up.railway.app";
const origin = (process.env.ORQENA_DESIGN_BASE_URL ?? EXPECTED_ORIGIN).replace(/\/$/u, "");
const sha = process.env.ORQENA_DESIGN_SHA;
if (process.env.ORQENA_DESIGN_ALLOW_REMOTE_CAPTURE !== "true") throw new Error("DESIGN_REMOTE_CAPTURE_APPROVAL_REQUIRED");
if (origin !== EXPECTED_ORIGIN) throw new Error(`DESIGN_REVIEW_ORIGIN_MISMATCH:${origin}`);
if (!/^[0-9a-f]{40}$/u.test(sha ?? "")) throw new Error("DESIGN_SHA_REQUIRED");

const output = process.env.ORQENA_DESIGN_CAPTURE_DIR
  ?? join(process.cwd(), "artifacts", "design", `baseline-${sha.slice(0, 8)}`);
const routes = ["/", "/demo", "/login"];
const viewports = [
  { key: "390", width: 390, height: 844 },
  { key: "768", width: 768, height: 1024 },
  { key: "1024", width: 1024, height: 768 },
  { key: "1440", width: 1440, height: 900 },
];
mkdirSync(output, { recursive: true });

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  origin,
  sha,
  syntheticOnly: true,
  mutatesState: false,
  routes,
  viewports,
  cases: [],
  findings: [],
};

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-extensions", "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding"],
});
try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: viewport.key === "390" ? "reduce" : "no-preference",
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const diagnostics = [];
      const externalHosts = new Set();
      page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(`console:${message.text().slice(0, 400)}`);
      });
      page.on("pageerror", (error) => diagnostics.push(`page:${error.message.slice(0, 400)}`));
      page.on("response", (response) => {
        if (response.status() >= 500) diagnostics.push(`http:${response.status()}:${response.url()}`);
      });
      page.on("request", (request) => {
        const url = request.url();
        if (/^(?:data|blob|about):/u.test(url)) return;
        const parsed = new URL(url);
        if (parsed.origin !== origin) externalHosts.add(parsed.host);
      });

      const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      const state = await page.evaluate(() => ({
        title: document.title,
        h1Count: document.querySelectorAll("h1").length,
        mainCount: document.querySelectorAll("main").length,
        overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
      }));
      const axe = await new AxeBuilder({ page }).analyze();
      const axeBlocking = axe.violations
        .filter(({ impact }) => impact === "critical" || impact === "serious")
        .map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
      const slug = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
      const screenshot = join(output, `${slug}-${viewport.key}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      const headers = response?.headers() ?? {};
      const result = {
        route,
        viewport: viewport.key,
        status: response?.status() ?? 0,
        xRobotsTag: headers["x-robots-tag"] ?? null,
        reducedMotion: viewport.key === "390",
        externalHosts: [...externalHosts],
        diagnostics,
        axeBlocking,
        bytes: statSync(screenshot).size,
        ...state,
      };
      const findingPrefix = `${route}:${viewport.key}`;
      if (result.status !== 200) report.findings.push(`${findingPrefix}:HTTP_${result.status}`);
      if (result.h1Count !== 1) report.findings.push(`${findingPrefix}:H1_COUNT_${result.h1Count}`);
      if (result.mainCount !== 1) report.findings.push(`${findingPrefix}:MAIN_COUNT_${result.mainCount}`);
      if (result.overflowPx > 1) report.findings.push(`${findingPrefix}:OVERFLOW_${result.overflowPx}`);
      if (result.brokenImages) report.findings.push(`${findingPrefix}:BROKEN_IMAGES_${result.brokenImages}`);
      if (result.externalHosts.length) report.findings.push(`${findingPrefix}:EXTERNAL_${result.externalHosts.join(",")}`);
      if (result.diagnostics.length) report.findings.push(`${findingPrefix}:DIAGNOSTICS_${result.diagnostics.length}`);
      if (result.axeBlocking.length) report.findings.push(`${findingPrefix}:AXE_BLOCKING_${result.axeBlocking.map(({ id }) => id).join(",")}`);
      if (!result.xRobotsTag?.includes("noindex")) report.findings.push(`${findingPrefix}:NOINDEX_MISSING`);
      report.cases.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

report.ok = report.findings.length === 0;
writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: report.ok, sha, cases: report.cases.length, findings: report.findings, output }, null, 2));
if (!report.ok) process.exit(1);
