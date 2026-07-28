import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  installCleanupSignalHandlers,
  startIsolatedPostgres,
  stopIsolatedPostgres,
} from "../isolated-postgres-runtime.mjs";
import { assertIsolatedTestDatabase } from "../test-database-safety.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const password = randomBytes(24).toString("hex");
const databaseName = "capataz_test_readiness_f1";
const expectedMigrationCount = readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .length;
const expectedTargetTables = [
  "FeatureFlag", "IdempotencyRecord", "WebhookEvent", "IntegrationConnection", "EncryptedCredential",
  "FiscalDocument", "FiscalRecord", "FiscalTransmission", "FiscalEvent", "FiscalSoftwareDeclaration",
  "ElectronicInvoiceArtifact", "ElectronicInvoiceDelivery", "ElectronicInvoiceStatusEvent", "BillingCustomer", "BillingPriceMapping", "BillingEvent",
  "EmailSuppression", "EmailWebhookEvent", "LegalDocumentVersion", "LegalAcceptance", "ProcessingActivity", "RetentionPolicy", "PrivacyRequest", "ConsentRecord", "DataBreachIncident",
  "CompanyAiPolicy", "AiUsageEvent", "AiModelVersion", "AiPromptVersion", "AiEvaluationRun", "AiGatewayOperation", "AiReviewEvent", "AiCircuitState", "ProductEvent", "CompanyDailyMetric", "PilotCohort", "PilotFeedback", "SupportTicket", "Incident", "StoredObject", "UploadScan",
];
let runtime;
const removeSignalHandlers = installCleanupSignalHandlers(async () => {
  await stopIsolatedPostgres(runtime).catch(() => undefined);
});

function runNode(entry, args, env) {
  return execFileSync(process.execPath, [entry, ...args], {
    cwd: process.cwd(), env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
}

try {
  runtime = await startIsolatedPostgres({
    EmbeddedPostgres,
    root,
    suite: "readiness-f1-migrations",
    password,
    postgresFlags: ["-c", "io_method=sync"],
  });
  await runtime.pg.createDatabase(databaseName);
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${runtime.port}/${databaseName}?schema=public`,
    CAPATAZ_TEST_DATABASE_ISOLATED: "true",
    APP_ENV: "test",
    NEXT_PUBLIC_APP_ENV: "test",
  };
  assertIsolatedTestDatabase(env);
  const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const firstDeploy = runNode(prismaCli, ["migrate", "deploy"], env);
  const secondDeploy = runNode(prismaCli, ["migrate", "deploy"], env);

  const client = runtime.pg.getPgClient(databaseName);
  await client.connect();
  const migrationResult = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  const readinessMigrationResult = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE migration_name LIKE \'%_readiness_m%\' AND finished_at IS NOT NULL');
  const targetTables = await client.query("SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)", [expectedTargetTables]);
  const now = new Date();
  await client.query('INSERT INTO "Company" (id,slug,"nombreComercial","updatedAt") VALUES ($1,$2,$3,$4)', ["f1-company", "f1-company", "F1 isolated", now]);
  await client.query('INSERT INTO "Client" (id,"companyId",nombre,telefono,direccion,tipo,origen) VALUES ($1,$2,$3,$4,$5,$6,$7)', ["f1-client", "f1-company", "Client", "000", "Isolated", "company", "f1"]);
  await client.query('INSERT INTO "Work" (id,"companyId","clienteId",titulo,direccion,"tipoTrabajo","presupuestoAprobado","costePrevisto","gastoReal","margenEstimado") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', ["f1-work", "f1-company", "f1-client", "Work", "Isolated", "test", 121.35, 80.1, 40.05, 1.2]);
  await client.end();

  const dryRun = runNode(tsxCli, ["scripts/readiness/backfill-money-decimals.ts", "--dry-run", "--company-id", "f1-company", "--batch-size", "25"], env);
  const apply = runNode(tsxCli, ["scripts/readiness/backfill-money-decimals.ts", "--apply", "--company-id", "f1-company", "--batch-size", "25"], env);
  const reconciliation = runNode(tsxCli, ["scripts/readiness/reconcile-money-decimals.ts", "--company-id", "f1-company"], env);
  const reconcileReport = JSON.parse(reconciliation);
  if (!reconcileReport.reconciled) throw new Error("DECIMAL_RECONCILIATION_FAILED");
  if (migrationResult.rows[0].count !== expectedMigrationCount) {
    throw new Error(`EXPECTED_${expectedMigrationCount}_MIGRATIONS_FOUND_${migrationResult.rows[0].count}`);
  }
  if (readinessMigrationResult.rows[0].count !== 10) throw new Error(`EXPECTED_10_READINESS_MIGRATIONS_FOUND_${readinessMigrationResult.rows[0].count}`);
  if (targetTables.rows[0].count !== expectedTargetTables.length) {
    throw new Error(`EXPECTED_${expectedTargetTables.length}_TARGET_TABLES_FOUND_${targetTables.rows[0].count}`);
  }
  if (!/No pending migrations/i.test(secondDeploy)) throw new Error("SECOND_DEPLOY_NOT_IDEMPOTENT");

  console.log(JSON.stringify({
    ok: true,
    migrations: migrationResult.rows[0].count,
    readinessMigrations: readinessMigrationResult.rows[0].count,
    targetTables: targetTables.rows[0].count,
    secondDeployNoPending: /No pending migrations/i.test(secondDeploy),
    dryRunRows: JSON.parse(dryRun).report.reduce((sum, item) => sum + item.rows, 0),
    applyRows: JSON.parse(apply).report.reduce((sum, item) => sum + item.rows, 0),
    reconciliationPairs: reconcileReport.results.length,
    reconciliationDifference: reconcileReport.results.reduce((sum, item) => sum + Number(item.absoluteDifference), 0),
    deployObserved: /migrations found/i.test(firstDeploy),
  }, null, 2));
} finally {
  removeSignalHandlers();
  await stopIsolatedPostgres(runtime);
}
