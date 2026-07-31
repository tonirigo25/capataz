import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.ORQENA_REVIEW_URL;
const email = process.env.ORQENA_REVIEW_EMAIL;
const password = process.env.ORQENA_REVIEW_PASSWORD;
const route = process.env.ORQENA_CAPTURE_ROUTE || "/hoy";
const width = Number(process.env.ORQENA_CAPTURE_WIDTH || 1586);
const height = Number(process.env.ORQENA_CAPTURE_HEIGHT || 992);
const output = process.env.ORQENA_CAPTURE_OUTPUT;

if (!baseUrl || !email || !password || !output) {
  throw new Error(
    "ORQENA_REVIEW_URL, ORQENA_REVIEW_EMAIL, ORQENA_REVIEW_PASSWORD and ORQENA_CAPTURE_OUTPUT are required",
  );
}

await mkdir(path.dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  locale: "es-ES",
  timezoneId: "Europe/Madrid",
  colorScheme: "light",
  reducedMotion: "reduce",
  serviceWorkers: "block",
});
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("requestfailed", (request) => {
  failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || "unknown",
  });
});

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
await page.locator('input[name="email"]').fill(email);
await page.locator('input[name="password"]').fill(password);
await Promise.all([
  page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 30_000,
  }),
  page.getByRole("button", { name: "Entrar en Orqena", exact: true }).click(),
]);

await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await document.fonts.ready;
  window.scrollTo(0, 0);
});
await page.waitForTimeout(800);

const state = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  bodyText: document.body.innerText,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  },
  document: {
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  },
}));

await page.screenshot({ path: output, fullPage: false });
await writeFile(
  `${output}.json`,
  `${JSON.stringify({ state, consoleErrors, failedRequests }, null, 2)}\n`,
  "utf8",
);

await browser.close();

console.log(
  JSON.stringify({
    output,
    url: state.url,
    viewport: state.viewport,
    document: state.document,
    consoleErrors: consoleErrors.length,
    failedRequests: failedRequests.length,
  }),
);
