import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { startIsolatedPostgres, stopIsolatedPostgres } from "../isolated-postgres-runtime.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const port = Number(process.env.CAPATAZ_PROBE_POSTGRES_PORT);
const allowDynamicFallback = process.env.CAPATAZ_PROBE_ALLOW_FALLBACK !== "false";
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href,
);
let runtime;

try {
  runtime = await startIsolatedPostgres({
    EmbeddedPostgres,
    root,
    suite: "isolated-postgres-startup-probe",
    password: randomBytes(24).toString("hex"),
    preferredPort: port,
    allowDynamicFallback,
    maxAttempts: 2,
  });
  await runtime.pg.createDatabase("capataz_test_port_probe");
  process.stdout.write(JSON.stringify({ ok: true, port: runtime.port, dataDir: runtime.dataDir }) + "\n");
} finally {
  await stopIsolatedPostgres(runtime).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
