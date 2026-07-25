import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
}

const schemaPath = path.join(root, "prisma", "schema.prisma");
const schema = await readFile(schemaPath, "utf8");
const requiredModels = [
  "FeatureFlag", "IdempotencyRecord", "WebhookEvent", "IntegrationConnection", "EncryptedCredential",
  "FiscalDocument", "FiscalRecord", "FiscalTransmission", "FiscalEvent", "FiscalSoftwareDeclaration",
  "ElectronicInvoiceArtifact", "ElectronicInvoiceDelivery", "ElectronicInvoiceStatusEvent",
  "BillingCustomer", "BillingPriceMapping", "BillingEvent", "EmailSuppression", "EmailWebhookEvent",
  "LegalDocumentVersion", "LegalAcceptance", "ProcessingActivity", "RetentionPolicy", "PrivacyRequest", "ConsentRecord", "DataBreachIncident",
  "CompanyAiPolicy", "AiUsageEvent", "AiModelVersion", "AiPromptVersion", "AiEvaluationRun",
  "ProductEvent", "CompanyDailyMetric", "PilotCohort", "PilotFeedback", "SupportTicket", "Incident", "StoredObject", "UploadScan",
];
const missingModels = requiredModels.filter((model) => !schema.includes(`model ${model} {`));
check("target-models", missingModels.length === 0, `missing: ${missingModels.join(", ") || "none"}`);

const decimalMirrors = [...schema.matchAll(/^\s+\w+Decimal\s+Decimal\?/gm)].length;
check("decimal-mirrors", decimalMirrors >= 25, `found ${decimalMirrors}, expected at least 25`);
check("legacy-floats-preserved", /presupuestoAprobado\s+Float/.test(schema) && /taxableBase\s+Float/.test(schema), "critical Float sources must remain during additive transition");

const migrationsRoot = path.join(root, "prisma", "migrations");
const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.includes("_readiness_m"))
  .map((entry) => entry.name)
  .sort();
check("migration-train", migrationDirectories.length === 10, `found ${migrationDirectories.length} readiness migrations`);
for (const directory of migrationDirectories) {
  const sql = await readFile(path.join(migrationsRoot, directory, "migration.sql"), "utf8");
  const destructive = /\b(DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN[^;]+TYPE)\b/i.test(sql);
  check(`additive-${directory}`, !destructive, "destructive SQL is prohibited");
  check(`timeouts-${directory}`, sql.includes("SET lock_timeout") && sql.includes("SET statement_timeout"), "bounded lock and statement timeouts required");
}

const manifest = JSON.parse(await readFile(path.join(root, "docs", "architecture", "generated", "schema-manifest.json"), "utf8"));
const schemaHash = createHash("sha256").update(schema).digest("hex");
check("generated-schema-docs", manifest.schemaSha256 === schemaHash, `manifest ${manifest.schemaSha256}, schema ${schemaHash}`);

for (const relativePath of [
  "docs/architecture/DOMAIN_MAP.md", "docs/architecture/OWNERSHIP.md", "docs/architecture/ERD.md",
  "docs/architecture/MIGRATION_STRATEGY.md", "docs/architecture/CONFIGURATION.md", ".github/CODEOWNERS",
  "docs/adr/0001-modular-monolith.md", "docs/adr/0002-decimal-money.md", "docs/adr/0003-transactional-outbox.md",
  "docs/adr/0004-immutable-fiscal-ledger.md", "docs/adr/0005-private-object-storage.md",
  "contracts/events/v1/envelope.schema.json", "contracts/prompts/v1/contract.json",
  "contracts/templates/v1/contract.json", "contracts/artifacts/v1/contract.json",
]) {
  const content = await readFile(path.join(root, relativePath), "utf8");
  check(`artifact-${relativePath}`, content.trim().length > 0, "file is empty");
}

const envExample = await readFile(path.join(root, ".env.example"), "utf8");
for (const flag of ["FISCAL_ENGINE_ENABLED", "BILLING_ENABLED", "EMAIL_LIVE_ENABLED", "AI_ENABLED", "ANALYTICS_ENABLED", "PUBLIC_INDEXING_ENABLED"]) {
  check(`default-off-${flag}`, new RegExp(`^${flag}=false$`, "m").test(envExample), "flag must default to false");
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
for (const dependency of ["zod", "stripe", "resend", "@aws-sdk/client-s3", "@opentelemetry/api", "@sentry/nextjs", "qrcode", "fast-xml-parser", "otplib"]) {
  check(`dependency-${dependency}`, Boolean(packageJson.dependencies?.[dependency]), "dependency missing from one-pass package contract");
}

const identityLeaks = [];
for (const directory of ["app", "components", "lib"]) {
  const entries = await readdir(path.join(root, directory), { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) continue;
    const fullPath = path.join(entry.parentPath, entry.name);
    const relativePath = path.relative(root, fullPath).replaceAll("\\", "/");
    if (relativePath.startsWith("lib/config/") || relativePath === "lib/brand.ts") continue;
    const content = await readFile(fullPath, "utf8");
    if (/soporte@capataz|https:\/\/(?:staging\.)?capataz\.app/i.test(content) || /["']Orqena["']|Capataz IA/.test(content)) identityLeaks.push(relativePath);
  }
}
check("centralized-commercial-identity", identityLeaks.length === 0, `leaks: ${identityLeaks.join(", ") || "none"}`);

console.log(JSON.stringify({ ok: true, checks: checks.length, decimalMirrors, migrations: migrationDirectories }, null, 2));
