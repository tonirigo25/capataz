import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const options = parseArguments(process.argv.slice(2));
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const output = resolve(options.output);
const width = Number(options.width);
const height = Number(options.height);

if (!Number.isInteger(width) || width < 320) throw new Error(`INVALID_WIDTH:${options.width}`);
if (!Number.isInteger(height) || height < 480) throw new Error(`INVALID_HEIGHT:${options.height}`);

await mkdir(dirname(output), { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--disable-extensions",
    "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding",
    "--force-color-profile=srgb",
    "--hide-scrollbars",
  ],
});

try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isExpectedDevelopmentCspError(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => {
    if (!isExpectedDevelopmentCspError(error.message)) errors.push(error.message);
  });

  const response = await page.goto(options.url, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  await page.screenshot({ path: output, fullPage: false, animations: "disabled", caret: "hide" });

  const geometry = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  if (response && !response.ok()) throw new Error(`HTTP_${response.status()}:${options.url}`);
  if (geometry.scrollWidth > geometry.innerWidth + 1) {
    throw new Error(`HORIZONTAL_OVERFLOW:${JSON.stringify(geometry)}`);
  }
  if (errors.length) throw new Error(`BROWSER_ERRORS:${JSON.stringify(errors)}`);

  console.log(JSON.stringify({ ok: true, url: page.url(), output, width, height, geometry }, null, 2));
  await context.close();
} finally {
  await browser.close();
}

function parseArguments(argumentsList) {
  const values = new Map();
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected positional argument: ${argument}`);
    const separator = argument.indexOf("=");
    const key = argument.slice(2, separator === -1 ? undefined : separator);
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1);
    const value = inlineValue ?? argumentsList[index + 1];
    if (!value || (inlineValue === undefined && value.startsWith("--"))) throw new Error(`Missing value for --${key}`);
    if (values.has(key)) throw new Error(`Duplicate argument: --${key}`);
    values.set(key, value);
    if (inlineValue === undefined) index += 1;
  }

  for (const key of ["url", "output", "width", "height"]) {
    if (!values.get(key)?.trim()) throw new Error(`Required argument missing: --${key}`);
  }
  return Object.fromEntries(values);
}

function isExpectedDevelopmentCspError(message) {
  return message.includes("Evaluating a string as JavaScript violates")
    && message.includes("Content Security Policy");
}
