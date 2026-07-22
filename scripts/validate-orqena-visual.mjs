import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright-core";

const root = process.cwd();
const pgRoot = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!pgRoot) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(pgRoot, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const port = Number(process.env.ORQENA_VISUAL_PG_PORT ?? 56540);
const webPort = Number(process.env.ORQENA_VISUAL_WEB_PORT ?? 3060);
const password = randomBytes(18).toString("hex");
const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/orqena_visual_qa?schema=public`;
const output = process.env.ORQENA_VISUAL_REPORT_DIR ?? join(process.env.TEMP ?? root, `orqena-visual-${Date.now()}`);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const pg = new EmbeddedPostgres({ databaseDir: join(pgRoot, `visual-${Date.now()}`), user: "postgres", password, port, persistent: true, postgresFlags: ["-c", "io_method=sync"] });
const env = { ...process.env, DATABASE_URL: databaseUrl, CAPATAZ_TEST_DATABASE_ISOLATED: "true", CAPATAZ_VISUAL_QA: "true", APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test" };
const routes = ["", "login", "registro", "hoy", "clientes", "obras", "capataz", "onboarding", "crear-empresa", "seleccionar-empresa", "equipo", "equipos", "plan-y-uso", "auditoria", "plataforma", "aceptar-invitacion", "configuracion"];
const viewports = [[390, 844], [768, 1024], [1024, 900], [1440, 1000]];
let server; let browser;
try {
  mkdirSync(output, { recursive: true });
  await pg.initialise(); await pg.start(); await pg.createDatabase("orqena_visual_qa");
  execFileSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env, stdio: "inherit" });
  execFileSync(process.execPath, [join(root, "prisma/seed.js")], { cwd: root, env, stdio: "inherit" });
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const company = await db.company.create({ data: { slug: "orqena-visual-qa", nombreComercial: "Orqena Visual QA", status: "active", isDemo: true, organizationType: "COMPANY", sectorKey: "general_services" } });
  const user = await db.user.create({ data: { email: "visual@orqena.local", emailNormalized: "visual@orqena.local", passwordHash: "visual-qa-not-a-login-secret", displayName: "Equipo Orqena", status: "active", emailVerifiedAt: new Date() } });
  await db.companyMembership.create({ data: { userId: user.id, companyId: company.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() } });
  await db.user.update({ where: { id: user.id }, data: { activeCompanyId: company.id } });
  await db.platformAccount.create({ data: { userId: user.id, role: "PLATFORM_OWNER" } });
  await db.$disconnect();
  const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  server = spawn(process.execPath, [npmCli, "run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(webPort)], { cwd: root, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; server.stdout.on("data", chunk => { log += chunk; }); server.stderr.on("data", chunk => { log += chunk; });
  const deadline = Date.now() + 60_000;
  while (!log.includes("Ready") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250));
  if (!log.includes("Ready")) throw new Error(`Visual server did not start: ${log.slice(-2000)}`);
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--disable-extensions", "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding"] });
  const results = [];
  for (const [width, height] of viewports) for (const route of routes) {
    const slug = route ? route.replaceAll("/", "-") : "landing"; const file = join(output, `${slug}-${width}.png`);
    const page = await browser.newPage({ viewport: { width, height } }); const errors = [];
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); }); page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(`http://127.0.0.1:${webPort}/${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 }); await page.waitForTimeout(700); await page.waitForLoadState("domcontentloaded");
    await page.screenshot({ path: file, fullPage: true, caret: "initial" });
    let overflow; try { overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); } catch { await page.waitForLoadState("domcontentloaded"); overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); }
    const title = await page.title(); const finalUrl = page.url(); await page.close();
    const bytes = statSync(file).size; if (bytes < 3_000) throw new Error(`Invalid screenshot ${file}`);
    if ((route !== "login" && finalUrl.includes("/login")) || overflow || errors.length) throw new Error(JSON.stringify({ route, width, status: response?.status(), finalUrl, overflow, errors }));
    results.push({ route: `/${route}`, width, height, bytes, title, overflow, consoleErrors: 0 });
  }
  const interaction = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await interaction.goto(`http://127.0.0.1:${webPort}/clientes`, { waitUntil: "domcontentloaded" }); await interaction.waitForTimeout(1200);
  const trigger = interaction.getByRole("button", { name: /^Filtros/ }); await trigger.click();
  const dialog = interaction.getByRole("dialog", { name: "Filtros" }); if (!await dialog.isVisible()) throw new Error("Mobile filter sheet did not open");
  await interaction.screenshot({ path: join(output, "clientes-filtros-abiertos-390.png"), fullPage: false });
  await interaction.keyboard.press("Escape"); if (await dialog.isVisible()) throw new Error("Mobile filter sheet did not close with Escape");
  if (!await trigger.evaluate((element) => element === document.activeElement)) throw new Error("Mobile filter trigger did not recover focus");
  await interaction.goto(`http://127.0.0.1:${webPort}/capataz`, { waitUntil: "domcontentloaded" }); await interaction.waitForTimeout(1200);
  const composer = interaction.getByLabel("Mensaje para Orqena"); const box = await composer.boundingBox();
  if (!box || box.y < 0 || box.y + box.height > 780) throw new Error(`Chat composer is not visible above mobile navigation: ${JSON.stringify(box)}`);
  await interaction.close();
  const report = { ok: true, isolated: true, browser: "Google Chrome headless", screenshots: results.length + 1, routes: routes.length, viewports, interactions: ["mobile-filter-sheet", "escape", "focus-return", "chat-composer-visible"], output, results };
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server?.pid) { try { execFileSync("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore", windowsHide: true }); } catch {} }
  await pg.stop().catch(() => {});
}
