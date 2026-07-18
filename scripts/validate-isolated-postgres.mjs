import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const packageRoot = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!packageRoot) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(
    join(packageRoot, "node_modules", "embedded-postgres", "dist", "index.js"),
  ).href
);
const password = randomBytes(24).toString("hex");
const port = Number(process.env.CAPATAZ_QA_POSTGRES_PORT ?? 55432);
const pg = new EmbeddedPostgres({
  databaseDir: join(packageRoot, `data-${Date.now()}`),
  user: "postgres",
  password,
  port,
  persistent: true,
  // PostgreSQL 18 can leave a reparented io_worker holding inherited pipes on
  // Windows while taskkill closes the postmaster. This isolated validation is
  // latency-insensitive, so synchronous I/O makes teardown deterministic.
  postgresFlags: ["-c", "io_method=sync"],
});

async function stopIsolatedPostgres() {
  const child = pg.process;
  if (platform() !== "win32" || !child?.pid) {
    await pg.stop();
    return;
  }

  // embedded-postgres launches taskkill asynchronously on Windows. If the
  // postmaster exits before stop() installs its listener, cleanup can wait
  // forever while a fork child keeps the inherited socket open. A synchronous
  // tree termination is scoped to this cluster's recorded PID and closes all
  // descendants before the validation process returns.
  spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
    stdio: "ignore",
    windowsHide: true,
  });
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.removeAllListeners();
  pg.process = undefined;
}

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("capataz_test_fresh");
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_fresh?schema=public`;
  const env = { ...process.env, DATABASE_URL: url, CAPATAZ_TEST_DATABASE_ISOLATED: "true" };
  assertIsolatedTestDatabase(env);
  execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
    shell: true,
  });
  execFileSync("npx.cmd", ["prisma", "generate"], {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
    shell: true,
  });
  const transactionOutput = execFileSync(
    "npx.cmd",
    ["tsx", "scripts/validate-automation-transaction.mjs"],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"], shell: true },
  )
    .toString()
    .trim();
  const chatContractOutput = execFileSync(
    "npx.cmd",
    ["tsx", "scripts/validate-automation-chat-contract.mjs"],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"], shell: true },
  )
    .toString()
    .trim();
  const client = pg.getPgClient("capataz_test_fresh");
  await client.connect();
  const migrations = await client.query(
    'SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  );
  const tables = await client.query(
    "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'",
  );
  const indexes = await client.query(
    "SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname = 'public'",
  );
  const dangerous = await client.query(
    "SELECT COUNT(*)::int AS count FROM information_schema.referential_constraints WHERE constraint_schema='public' AND delete_rule='CASCADE' AND constraint_name IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name LIKE 'Automation%' OR table_name LIKE 'Task%' OR table_name LIKE 'FollowUp%')",
  );
  await client.end();
  await pg.createDatabase("capataz_test_upgrade");
  const upgradeUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_upgrade?schema=public`,
    upgradeEnv = { ...process.env, DATABASE_URL: upgradeUrl, CAPATAZ_TEST_DATABASE_ISOLATED: "true" };
  assertIsolatedTestDatabase(upgradeEnv);
  const tempRoot = mkdtempSync(join(tmpdir(), "capataz-migrations-"));
  cpSync(join(process.cwd(), "prisma"), join(tempRoot, "prisma"), {
    recursive: true,
  });
  const incrementalMigrations = [
    "20260712143000_automation_core_tasks_followups",
    "20260712170000_identity_sessions",
    "20260712180000_company_ownership_nullable",
    "20260712190000_company_settings_and_treasury_ownership",
    "20260712210000_company_numbering_and_settings",
    "20260713193000_company_document_sequences",
  ];
  const postIdentityMigrations = ["20260717120000_procurement_management"];
  for (const migration of [...incrementalMigrations, ...postIdentityMigrations]) rmSync(join(tempRoot, "prisma", "migrations", migration), { recursive: true, force: true });
  execFileSync(
    "npx.cmd",
    [
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      join(tempRoot, "prisma", "schema.prisma"),
    ],
    { cwd: process.cwd(), env: upgradeEnv, stdio: "pipe", shell: true },
  );
  const upgrade = pg.getPgClient("capataz_test_upgrade");
  await upgrade.connect();
  const timestamp = new Date();
  await upgrade.query(
    'INSERT INTO "Empresa" (id,"nombreComercial","updatedAt") VALUES ($1,$2,$3)',
    ["qa-legacy-company", "Empresa legacy QA", timestamp],
  );
  await upgrade.query(
    'INSERT INTO "Client" (id,nombre,telefono,direccion,tipo,origen) VALUES ($1,$2,$3,$4,$5,$6)',
    ["qa-client", "Cliente anterior", "000", "QA", "particular", "qa"],
  );
  await upgrade.query(
    'INSERT INTO "Work" (id,"clienteId",titulo,direccion,"tipoTrabajo","presupuestoAprobado") VALUES ($1,$2,$3,$4,$5,$6)',
    ["qa-work", "qa-client", "Obra anterior", "QA", "test", 100],
  );
  await upgrade.query(
    'INSERT INTO "Budget" (id,"clienteId","obraId",numero,titulo,partidas,subtotal,iva,total,"margenEstimado") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [
      "qa-budget",
      "qa-client",
      "qa-work",
      "QA-P",
      "Presupuesto anterior",
      "[]",
      100,
      21,
      121,
      10,
    ],
  );
  await upgrade.query(
    'INSERT INTO "Invoice" (id,"clienteId","obraId",numero,concepto,"importeBase",iva,total,pendiente,"fechaEmision","fechaVencimiento") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [
      "qa-invoice",
      "qa-client",
      "qa-work",
      "QA-F",
      "Factura anterior",
      100,
      21,
      121,
      121,
      timestamp,
      timestamp,
    ],
  );
  await upgrade.query(
    'INSERT INTO "Reminder" (id,"clienteId",tipo,mensaje,"fechaProgramada") VALUES ($1,$2,$3,$4,$5)',
    ["qa-reminder", "qa-client", "recordatorio_interno", "Anterior", timestamp],
  );
  await upgrade.query(
    'INSERT INTO "EventoAgenda" (id,titulo,tipo,"fechaInicio","clienteId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6)',
    [
      "qa-event",
      "Evento anterior",
      "recordatorio_interno",
      timestamp,
      "qa-client",
      timestamp,
    ],
  );
  await upgrade.query(
    'INSERT INTO "ChatConversation" (id,title) VALUES ($1,$2)',
    ["qa-chat", "Conversación anterior"],
  );
  const before = await upgrade.query(
    'SELECT (SELECT COUNT(*) FROM "Client")::int clients,(SELECT COUNT(*) FROM "Work")::int works,(SELECT COUNT(*) FROM "Budget")::int budgets,(SELECT COUNT(*) FROM "Invoice")::int invoices,(SELECT COUNT(*) FROM "EventoAgenda")::int events,(SELECT COUNT(*) FROM "Reminder")::int reminders,(SELECT COUNT(*) FROM "ChatConversation")::int conversations',
  );
  await upgrade.end();
  for (const migration of incrementalMigrations.slice(0, -2)) cpSync(join(process.cwd(), "prisma", "migrations", migration), join(tempRoot, "prisma", "migrations", migration), { recursive: true });
  execFileSync(
    "npx.cmd",
    [
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      join(tempRoot, "prisma", "schema.prisma"),
    ],
    { cwd: process.cwd(), env: upgradeEnv, stdio: "pipe", shell: true },
  );
  const numberingMigration = incrementalMigrations.at(-2);
  cpSync(join(process.cwd(), "prisma", "migrations", numberingMigration), join(tempRoot, "prisma", "migrations", numberingMigration), { recursive: true });
  const expectedFailure = spawnSync(
    "npx.cmd",
    ["prisma", "migrate", "deploy", "--schema", join(tempRoot, "prisma", "schema.prisma")],
    { cwd: process.cwd(), env: upgradeEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true },
  );
  if (expectedFailure.status === 0 || !`${expectedFailure.stdout}\n${expectedFailure.stderr}`.includes("P3018")) {
    throw new Error("EXPECTED_NUMBERING_PREFLIGHT_FAILURE_NOT_OBSERVED");
  }
  const recovery = spawnSync("node", ["scripts/deploy-database.mjs"], {
    cwd: process.cwd(),
    env: upgradeEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (recovery.status !== 0) {
    throw new Error(`DEPLOY_RECOVERY_FAILED\n${recovery.stdout}\n${recovery.stderr}`);
  }
  const postRecoveryMigrations = [incrementalMigrations.at(-1), ...postIdentityMigrations];
  for (const migration of postRecoveryMigrations) cpSync(join(process.cwd(), "prisma", "migrations", migration), join(tempRoot, "prisma", "migrations", migration), { recursive: true });
  execFileSync(
    "npx.cmd",
    ["prisma", "migrate", "deploy", "--schema", join(tempRoot, "prisma", "schema.prisma")],
    { cwd: process.cwd(), env: upgradeEnv, stdio: "pipe", shell: true },
  );
  const upgraded = pg.getPgClient("capataz_test_upgrade");
  await upgraded.connect();
  const after = await upgraded.query(
    'SELECT (SELECT COUNT(*) FROM "Client")::int clients,(SELECT COUNT(*) FROM "Work")::int works,(SELECT COUNT(*) FROM "Budget")::int budgets,(SELECT COUNT(*) FROM "Invoice")::int invoices,(SELECT COUNT(*) FROM "EventoAgenda")::int events,(SELECT COUNT(*) FROM "Reminder")::int reminders,(SELECT COUNT(*) FROM "ChatConversation")::int conversations',
  );
  const newColumns = await upgraded.query(
    "SELECT COUNT(*)::int count FROM information_schema.columns WHERE table_name='EventoAgenda' AND column_name IN ('taskId','followUpId')",
  );
  await upgraded.query(
    'INSERT INTO "Task" (id,title,status,priority,origin,"clientId","workId","budgetId","invoiceId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [
      "qa-upgrade-task",
      "Tarea tras actualización",
      "planned",
      "medium",
      "qa",
      "qa-client",
      "qa-work",
      "qa-budget",
      "qa-invoice",
      timestamp,
    ],
  );
  const related = await upgraded.query(
    'SELECT COUNT(*)::int count FROM "Task" WHERE id=$1',
    ["qa-upgrade-task"],
  );
  await upgraded.end();
  rmSync(tempRoot, { recursive: true, force: true });
  if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0]))
    throw new Error("INCREMENTAL_ROW_COUNTS_CHANGED");
  console.log(
    JSON.stringify({
      ok: true,
      migrations: migrations.rows[0].count,
      tables: tables.rows[0].count,
      indexes: indexes.rows[0].count,
      newDangerousCascades: dangerous.rows[0].count,
      transaction: JSON.parse(transactionOutput.split(/\r?\n/).at(-1)),
      chatContract: JSON.parse(chatContractOutput.split(/\r?\n/).at(-1)),
      incremental: {
        before: before.rows[0],
        after: after.rows[0],
        newColumns: newColumns.rows[0].count,
        relatedTasks: related.rows[0].count,
        backfill: { ok: true, recoveredFromP3009: true },
      },
    }),
  );
} finally {
  await stopIsolatedPostgres();
}
