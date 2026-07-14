import { spawn, execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";
const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(
    join(root, "node_modules", "embedded-postgres", "dist", "index.js"),
  ).href
);
const password = randomBytes(24).toString("hex"),
  port = 55433,
  pg = new EmbeddedPostgres({
    databaseDir: join(root, `ui-${Date.now()}`),
    user: "postgres",
    password,
    port,
    persistent: true,
  });
let child;
async function shutdown() {
  child?.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await pg.initialise();
await pg.start();
await pg.createDatabase("capataz_test_ui");
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_ui?schema=public`,
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
execFileSync(
  "npx.cmd",
  ["tsx", "scripts/validate-automation-transaction.mjs"],
  { cwd: process.cwd(), env, stdio: "pipe", shell: true },
);
child = spawn("npm.cmd", ["run", "dev", "--", "-p", "3000"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", shutdown);
