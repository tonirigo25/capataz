import { spawn, execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import {
  installCleanupSignalHandlers,
  startIsolatedPostgres,
  stopIsolatedPostgres,
  terminateOwnedProcess,
} from "./isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";
const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(
    join(root, "node_modules", "embedded-postgres", "dist", "index.js"),
  ).href
);
const password = randomBytes(24).toString("hex");
let child;
let runtime;
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  terminateOwnedProcess(child);
  await stopIsolatedPostgres(runtime).catch(() => {});
  process.exit(0);
}
const removeSignalHandlers = installCleanupSignalHandlers(shutdown);
runtime = await startIsolatedPostgres({
  EmbeddedPostgres,
  root,
  suite: "isolated-ui",
  password,
  preferredPort: process.env.CAPATAZ_UI_POSTGRES_PORT,
});
await runtime.pg.createDatabase("capataz_test_ui");
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/capataz_test_ui?schema=public`,
  CAPATAZ_TEST_DATABASE_ISOLATED: "true",
  APP_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
};
assertIsolatedTestDatabase(env);
execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env,
  stdio: "pipe",
  shell: true,
});
execFileSync("npm.cmd", ["run", "db:seed"], {
  cwd: process.cwd(),
  env,
  stdio: "pipe",
  shell: true,
});
execFileSync(
  "npx.cmd",
  ["tsx", "scripts/validate-automation-transaction.mjs"],
  { cwd: process.cwd(), env, stdio: "pipe", shell: true },
);
if (env.CAPATAZ_VISUAL_EMAIL && env.CAPATAZ_VISUAL_PASSWORD) {
  execFileSync(
    "npx.cmd",
    ["tsx", "scripts/seed-visual-validation.ts"],
    { cwd: process.cwd(), env, stdio: "pipe", shell: true },
  );
}
child = spawn("npm.cmd", ["run", "dev", "--", "-p", "3000"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", () => {
  removeSignalHandlers();
  shutdown();
});
