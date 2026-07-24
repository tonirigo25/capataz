import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  installCleanupSignalHandlers,
  startIsolatedPostgres,
  stopIsolatedPostgres,
} from "./isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const password = randomBytes(24).toString("hex");
let runtime;
const removeSignalHandlers = installCleanupSignalHandlers(async () => {
  await stopIsolatedPostgres(runtime).catch(() => undefined);
});

try {
  runtime = await startIsolatedPostgres({
    EmbeddedPostgres,
    root,
    suite: "orqena-final-product-closure",
    password,
    preferredPort: process.env.ORQENA_FINAL_POSTGRES_PORT,
  });
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/capataz_test_orqena_final?schema=public`,
    CAPATAZ_TEST_DATABASE_ISOLATED: "true",
    APP_ENV: "test",
    NEXT_PUBLIC_APP_ENV: "test",
    EMAIL_PROVIDER: "local",
  };
  assertIsolatedTestDatabase(env);
  await runtime.pg.createDatabase("capataz_test_orqena_final");
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "inherit" });
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "scripts/validate-orqena-final-product-closure.ts"], { cwd: process.cwd(), env, stdio: "inherit" });
} finally {
  removeSignalHandlers();
  await stopIsolatedPostgres(runtime);
}
