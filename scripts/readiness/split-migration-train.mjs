import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "docs", "readiness", "evidence", "f1", "generated-schema-diff.sql");

const trains = [
  ["m01", "20260725100000_readiness_m01_platform_contracts"],
  ["m02", "20260725110000_readiness_m02_fiscal_ledger"],
  ["m03", "20260725120000_readiness_m03_electronic_invoicing"],
  ["m04", "20260725130000_readiness_m04_billing_webhooks"],
  ["m05", "20260725140000_readiness_m05_email_delivery"],
  ["m06", "20260725150000_readiness_m06_privacy_governance"],
  ["m07", "20260725160000_readiness_m07_ai_governance"],
  ["m08", "20260725170000_readiness_m08_product_analytics_support"],
  ["m09", "20260725180000_readiness_m09_storage_integrity"],
  ["m10", "20260725190000_readiness_m10_money_decimal_transition"],
];

const migrationByTable = new Map();
for (const table of ["FeatureFlag", "IdempotencyRecord", "WebhookEvent", "IntegrationConnection", "EncryptedCredential"])
  migrationByTable.set(table, "m01");
for (const table of ["FiscalDocument", "FiscalRecord", "FiscalTransmission", "FiscalEvent", "FiscalSoftwareDeclaration"])
  migrationByTable.set(table, "m02");
for (const table of ["ElectronicInvoiceArtifact", "ElectronicInvoiceDelivery", "ElectronicInvoiceStatusEvent"])
  migrationByTable.set(table, "m03");
for (const table of ["BillingCustomer", "BillingPriceMapping", "BillingEvent", "Subscription"])
  migrationByTable.set(table, "m04");
for (const table of ["EmailSuppression", "EmailWebhookEvent", "EmailOutbox", "EmailDeliveryAttempt"])
  migrationByTable.set(table, "m05");
for (const table of ["LegalDocumentVersion", "LegalAcceptance", "ProcessingActivity", "RetentionPolicy", "PrivacyRequest", "ConsentRecord", "DataBreachIncident"])
  migrationByTable.set(table, "m06");
for (const table of ["CompanyAiPolicy", "AiModelVersion", "AiPromptVersion", "AiUsageEvent", "AiEvaluationRun"])
  migrationByTable.set(table, "m07");
for (const table of ["ProductEvent", "CompanyDailyMetric", "PilotCohort", "PilotFeedback", "SupportTicket", "Incident"])
  migrationByTable.set(table, "m08");
for (const table of ["StoredObject", "UploadScan"])
  migrationByTable.set(table, "m09");
for (const table of ["Work", "Budget", "Invoice", "Payment", "Expense", "FinancialAccount", "CashMovement", "RecurringExpense", "ExpectedCashFlow", "TreasurySettings", "PurchaseInvoice", "PurchaseInvoicePayment"])
  migrationByTable.set(table, "m10");

function tableForStatement(statement) {
  const direct = statement.match(/(?:ALTER|CREATE) TABLE "([^"]+)"/);
  if (direct) return direct[1];
  const indexed = statement.match(/\bON "([^"]+)"/);
  if (indexed) return indexed[1];
  throw new Error(`Cannot determine table for statement: ${statement.slice(0, 120)}`);
}

function splitStatements(sql) {
  const blocks = sql.split(/;\s*(?:\r?\n|$)/).map((block) => block.trim()).filter(Boolean);
  const statements = [];
  for (const block of blocks) {
    const statement = `${block};`;
    if (!statement.includes('ALTER TABLE "Document" ADD COLUMN')) {
      statements.push(statement);
      continue;
    }
    statements.push('-- AlterTable\nALTER TABLE "Document" ADD COLUMN "storedObjectId" TEXT;');
    statements.push('-- AlterTable\nALTER TABLE "Document" ADD COLUMN "extractedTotalDecimal" DECIMAL(18,2);');
  }
  return statements;
}

const sql = await readFile(sourcePath, "utf8");
const grouped = new Map(trains.map(([key]) => [key, []]));
for (const statement of splitStatements(sql)) {
  const table = tableForStatement(statement);
  const key = table === "Document"
    ? statement.includes("extractedTotalDecimal") ? "m10" : "m09"
    : migrationByTable.get(table);
  if (!key) throw new Error(`No migration group for table ${table}`);
  grouped.get(key).push(statement);
}

for (const [key, directory] of trains) {
  const outputDirectory = path.join(root, "prisma", "migrations", directory);
  await mkdir(outputDirectory, { recursive: true });
  const header = [
    `-- Orqena readiness ${key.toUpperCase()}: additive migration.`,
    "-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.",
    "-- This migration does not delete or rewrite existing business data.",
    "SET lock_timeout = '5s';",
    "SET statement_timeout = '60s';",
    "",
  ].join("\n");
  await writeFile(path.join(outputDirectory, "migration.sql"), `${header}${grouped.get(key).join("\n\n")}\n`, "utf8");
}

console.log(JSON.stringify({
  ok: true,
  migrations: trains.map(([key, directory]) => ({ key, directory, statements: grouped.get(key).length })),
}));
