import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const packageRoot = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!packageRoot) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(join(packageRoot, "node_modules", "embedded-postgres", "dist", "index.js")).href
);

const password = randomBytes(24).toString("hex");
const port = Number(process.env.CAPATAZ_ALL_TESTS_POSTGRES_PORT ?? 55480);
const pg = new EmbeddedPostgres({
  databaseDir: join(packageRoot, `all-tests-${Date.now()}`),
  user: "postgres",
  password,
  port,
  persistent: true,
});
const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_all?schema=public`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  CAPATAZ_TEST_DATABASE_ISOLATED: "true",
  APP_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
};
assertIsolatedTestDatabase(env);

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("capataz_test_all");
  execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(), env, stdio: "inherit", shell: true,
  });
  execFileSync("node", ["prisma/seed.js"], {
    cwd: process.cwd(), env, stdio: "inherit",
  });

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const tests = Object.keys(packageJson.scripts).filter((name) => name.startsWith("test:"));
  const results = [];
  for (const [index, name] of tests.entries()) {
    process.stdout.write(`[isolated-tests] ${index + 1}/${tests.length} ${name}\n`);
    const result = spawnSync("npm.cmd", ["run", name], {
      cwd: process.cwd(), env, encoding: "utf8", shell: true,
    });
    results.push({ name, ok: result.status === 0 });
    if (result.status !== 0) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      throw new Error(`ISOLATED_TEST_FAILED:${name}`);
    }
  }
  console.log(JSON.stringify({ ok: true, isolated: true, total: tests.length, passed: results.filter((item) => item.ok).length }));
} finally {
  await pg.stop().catch(() => {});
}
