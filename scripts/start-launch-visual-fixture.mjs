import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  installCleanupSignalHandlers,
  startIsolatedPostgres,
  stopIsolatedPostgres,
  terminateOwnedProcess,
} from "./isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const root = process.cwd();
const pgRoot = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
const stopFile = process.env.ORQENA_VISUAL_STOP_FILE;
const port = Number(process.env.ORQENA_VISUAL_WEB_PORT ?? 3118);
if (!pgRoot) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
if (!stopFile) throw new Error("ORQENA_VISUAL_STOP_FILE is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(pgRoot, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const password = randomBytes(18).toString("hex");
let runtime;
let server;
const cleanup = async () => {
  terminateOwnedProcess(server);
  await stopIsolatedPostgres(runtime).catch(() => undefined);
};
const removeSignalHandlers = installCleanupSignalHandlers(cleanup);

try {
  runtime = await startIsolatedPostgres({
    EmbeddedPostgres,
    root: pgRoot,
    suite: "launch-visual-fixture",
    password,
    postgresFlags: ["-c", "io_method=sync"],
  });
  const databaseName = "capataz_test_launch_visual";
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/${databaseName}?schema=public`;
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CAPATAZ_TEST_DATABASE_ISOLATED: "true",
    CAPATAZ_VISUAL_QA: process.env.ORQENA_VISUAL_AUTO_AUTH === "false" ? "false" : "true",
    CAPATAZ_DEV_HOST_MODE: "app",
    APP_ENV: "test",
    NEXT_PUBLIC_APP_ENV: "test",
  };
  assertIsolatedTestDatabase(env);
  await runtime.pg.createDatabase(databaseName);
  execFileSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env, stdio: "inherit" });
  execFileSync(process.execPath, [join(root, "prisma/seed.js")], { cwd: root, env, stdio: "inherit" });
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = Date.now().toString(36);
  const company = await db.company.create({
    data: {
      slug: `launch-visual-${suffix}`,
      nombreComercial: "Orqena Visual QA",
      status: "active",
      isDemo: true,
      organizationType: "COMPANY",
      sectorKey: "general_services",
    },
  });
  const user = await db.user.create({
    data: {
      email: `launch-visual-${suffix}@orqena.local`,
      emailNormalized: `launch-visual-${suffix}@orqena.local`,
      passwordHash: "visual-fixture-not-a-login-secret",
      displayName: "Equipo Orqena",
      status: "active",
      emailVerifiedAt: new Date(),
      activeCompanyId: company.id,
    },
  });
  await db.companyMembership.create({
    data: { userId: user.id, companyId: company.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() },
  });
  await db.$disconnect();

  const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  server = spawn(process.execPath, [npmCli, "run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (chunk) => { log += chunk; });
  server.stderr.on("data", (chunk) => { log += chunk; });
  const deadline = Date.now() + 60_000;
  while (!log.includes("Ready") && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
  if (!log.includes("Ready")) throw new Error(`Visual fixture did not start: ${log.slice(-2_000)}`);
  console.log(JSON.stringify({ ok: true, url: `http://127.0.0.1:${port}`, isolated: true }));

  while (true) {
    try {
      await access(stopFile);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
} finally {
  removeSignalHandlers();
  await cleanup();
}
