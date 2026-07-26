import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { installCleanupSignalHandlers, startIsolatedPostgres, stopIsolatedPostgres } from "../isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "../test-database-safety.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const password = randomBytes(24).toString("hex");
const databaseName = "capataz_test_readiness_f2";
let runtime;
const removeSignalHandlers = installCleanupSignalHandlers(async () => stopIsolatedPostgres(runtime).catch(() => undefined));

try {
  runtime = await startIsolatedPostgres({ EmbeddedPostgres, root, suite: "readiness-f2-platform", password, postgresFlags: ["-c", "io_method=sync"] });
  await runtime.pg.createDatabase(databaseName);
  const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/${databaseName}?schema=public`, CAPATAZ_TEST_DATABASE_ISOLATED: "true", APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test" };
  assertIsolatedTestDatabase(env);
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "inherit" });
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "scripts/readiness/validate-f2-postgres.ts"], { cwd: process.cwd(), env, stdio: "inherit" });
} finally {
  removeSignalHandlers();
  await stopIsolatedPostgres(runtime);
}
