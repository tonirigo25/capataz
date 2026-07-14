import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const SOURCE_EMPRESA_ID = "empresa-demo";
const EXPECTED_TOTAL = 228;
const EXCLUDED_TASK_ID = "cmrhm95u80004vd84gufttv29";
const OUTPUT_ARG = process.argv.find((arg) => arg.startsWith("--output="));
const OUTPUT_PATH = resolve(process.cwd(), OUTPUT_ARG?.slice("--output=".length) ?? ".codex-backup/legacy-company-backfill/dry-run.json");

// This is the only set that may be backfilled in the later, separately authorised phase.
// It deliberately excludes documents, cash, security audit, users and membership tables.
const LEGACY_TABLES = [
  "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material",
  "InternalNote", "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "RecurringExpense",
  "ExpectedCashFlow", "ChatConversation", "BusinessSignalState", "BusinessRecommendation",
  "AutomationDefinition", "AutomationRun", "Task", "FollowUp",
];
const EXCLUDED_NULL_TABLES = ["Document", "CashMovement", "TreasurySettings", "SecurityAuditEvent"];
const PROTECTED_TABLES = [
  "User", "Company", "CompanyMembership", "Session", "EmailVerificationToken", "PasswordResetToken",
  "Document", "CashMovement", "SecurityAuditEvent", "TreasurySettings",
];
const FINGERPRINTS = ["4a33f773", "7a3b51a7", "7be843e2"];
const NUMBER_FIELDS = [
  ["Budget", "numero"],
  ["Invoice", "numero"],
  ["Work", "numeroInterno"],
  ["Work", "codigo"],
];

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({
  log: [],
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function canonical(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(canonical(value));
}

function safeDate(value) {
  return value instanceof Date ? value.toISOString() : value == null ? null : String(value);
}

function assertProductionTarget() {
  const expected = {
    RAILWAY_PROJECT_ID: "ca7ec244-e961-42dc-8573-23835e6db5f5",
    RAILWAY_ENVIRONMENT_ID: "42c14ac1-e933-485b-9b44-01272af389e0",
    RAILWAY_SERVICE_ID: "0f485ee7-0ab3-430d-9abd-791b8e3e2907",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_SERVICE_NAME: "Postgres",
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] !== value) throw new Error(`PRODUCTION_TARGET_MISMATCH:${name}`);
  }
  if (!databaseUrl) throw new Error("DATABASE_URL_MISSING");
  const parsed = new URL(databaseUrl);
  if (!/(?:railway|rlwy)/i.test(parsed.hostname)) throw new Error("BACKFILL_AUDIT_REQUIRES_RAILWAY_DATABASE");
}

async function publicTables(client) {
  const rows = await client.$queryRawUnsafe(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `);
  return rows.map((row) => row.name);
}

async function tableColumns(client) {
  const rows = await client.$queryRawUnsafe(`
    SELECT table_name AS "table", column_name AS "column"
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.table)) result.set(row.table, new Set());
    result.get(row.table).add(row.column);
  }
  return result;
}

async function count(client, table, where = "") {
  const rows = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)}${where ? ` WHERE ${where}` : ""}`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function snapshot(client) {
  const rows = [];
  for (const table of LEGACY_TABLES) {
    const total = await count(client, table);
    const nulls = await count(client, table, '"companyId" IS NULL');
    rows.push({ table, total, nulls });
  }
  return rows;
}

async function candidateRows(client, columns) {
  const result = [];
  for (const table of LEGACY_TABLES) {
    const available = columns.get(table) ?? new Set();
    if (!available.has("id") || !available.has("companyId")) {
      throw new Error(`LEGACY_TABLE_SCHEMA_MISMATCH:${table}`);
    }
    const created = available.has("createdAt") ? `, ${quoteIdentifier("createdAt")}` : ", NULL";
    const updated = available.has("updatedAt") ? `, ${quoteIdentifier("updatedAt")}` : ", NULL";
    const rows = await client.$queryRawUnsafe(
      `SELECT ${quoteIdentifier("id")}, ${quoteIdentifier("companyId")}${created} AS "createdAt"${updated} AS "updatedAt"
       FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier("companyId")} IS NULL ORDER BY ${quoteIdentifier("id")}`,
    );
    for (const row of rows) {
      result.push({
        table,
        id: String(row.id),
        companyId: row.companyId ?? null,
        createdAt: safeDate(row.createdAt),
        updatedAt: safeDate(row.updatedAt),
      });
    }
  }
  return result.sort((a, b) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`));
}

async function protectedCounts(client) {
  const result = {};
  for (const table of PROTECTED_TABLES) result[table] = await count(client, table);
  return result;
}

async function excludedNulls(client, columns) {
  const result = {};
  for (const table of EXCLUDED_NULL_TABLES) {
    result[table] = columns.get(table)?.has("companyId") ? await count(client, table, '"companyId" IS NULL') : 0;
  }
  return result;
}

async function fingerprintHits(client, tables) {
  const hits = {};
  for (const marker of FINGERPRINTS) {
    let total = 0;
    const byTable = {};
    for (const table of tables) {
      const rows = await client.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)} candidate
         WHERE row_to_json(candidate)::text ILIKE $1`,
        `%${marker}%`,
      );
      const value = Number(rows[0]?.count ?? 0);
      if (value) byTable[table] = value;
      total += value;
    }
    hits[marker] = { total, byTable };
  }
  return hits;
}

async function foreignKeys(client, columns) {
  const rows = await client.$queryRawUnsafe(`
    SELECT tc.table_name AS "sourceTable", kcu.column_name AS "sourceColumn",
           ccu.table_name AS "targetTable", ccu.column_name AS "targetColumn"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, kcu.column_name, ccu.table_name
  `);
  return rows.filter((row) =>
    LEGACY_TABLES.includes(row.sourceTable) &&
    LEGACY_TABLES.includes(row.targetTable) &&
    columns.get(row.sourceTable)?.has("companyId") &&
    columns.get(row.targetTable)?.has("companyId"),
  );
}

async function relationReport(client, columns) {
  const relations = [];
  const issues = [];
  for (const relation of await foreignKeys(client, columns)) {
    const source = quoteIdentifier(relation.sourceTable);
    const target = quoteIdentifier(relation.targetTable);
    const sourceColumn = quoteIdentifier(relation.sourceColumn);
    const targetColumn = quoteIdentifier(relation.targetColumn);
    const linkedRows = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${source} s JOIN ${target} t ON s.${sourceColumn} = t.${targetColumn}
       WHERE s."companyId" IS NULL AND t."companyId" IS NULL`,
    );
    const mismatchRows = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${source} s JOIN ${target} t ON s.${sourceColumn} = t.${targetColumn}
       WHERE s."companyId" IS DISTINCT FROM t."companyId"`,
    );
    const linked = Number(linkedRows[0]?.count ?? 0);
    const mismatch = Number(mismatchRows[0]?.count ?? 0);
    const item = { ...relation, linkedNullCompanyRows: linked, companyIdMismatchRows: mismatch };
    relations.push(item);
    if (mismatch) issues.push(item);
  }
  return { relations, issues };
}

async function numberingReport(client) {
  const result = [];
  const duplicateGroups = [];
  for (const [table, field] of NUMBER_FIELDS) {
    const rows = await client.$queryRawUnsafe(
      `SELECT ${quoteIdentifier(field)} AS value, COUNT(*)::bigint AS count
       FROM ${quoteIdentifier(table)}
       WHERE "companyId" IS NULL AND ${quoteIdentifier(field)} IS NOT NULL
       GROUP BY ${quoteIdentifier(field)} ORDER BY ${quoteIdentifier(field)}`,
    );
    const values = rows.map((row) => ({ value: row.value, count: Number(row.count) }));
    const duplicates = values.filter((row) => row.count > 1);
    result.push({ table, field, values, duplicateGroups: duplicates.length });
    duplicateGroups.push(...duplicates.map((row) => ({ table, field, ...row })));
  }
  return { fields: result, duplicateGroups };
}

function companyProposal(empresa) {
  const mappings = {
    nombreComercial: "nombreComercial",
    razonSocial: "razonSocial",
    taxId: "nifCif",
    email: "email",
    telefono: "telefono",
    direccion: "direccionFiscal",
    codigoPostal: "codigoPostal",
    ciudad: "ciudad",
    provincia: "provincia",
    pais: "pais",
    web: "web",
    contactPerson: "personaContacto",
    iban: "iban",
    defaultConditions: "condicionesPorDefecto",
    legalText: "textoLegal",
    logoUrl: "logoUrl",
    sealUrl: "selloUrl",
    brandColor: "colorMarca",
    defaultVat: "ivaDefecto",
    currency: "moneda",
    budgetValidityDays: "validezPresupuestoDias",
    defaultPaymentTerms: "formaPagoDefecto",
    budgetSeries: "seriePresupuestos",
    invoiceSeries: "serieFacturas",
    workSeries: "serieObras",
    budgetPrefix: "prefijoPresupuesto",
    invoicePrefix: "prefijoFactura",
    workPrefix: "prefijoObra",
  };
  const copiedFields = [];
  const nullFields = [];
  for (const [companyField, empresaField] of Object.entries(mappings)) {
    const value = empresa[empresaField];
    if (value == null || (typeof value === "string" && value.trim() === "")) nullFields.push(companyField);
    else copiedFields.push(companyField);
  }
  return {
    slug: "rigo-asociados",
    legacyEmpresaId: SOURCE_EMPRESA_ID,
    timezone: "Europe/Madrid",
    locale: "es-ES",
    status: "active",
    isDemo: false,
    copiedFields,
    nullFields,
    sourceFieldPresence: Object.fromEntries(Object.entries(mappings).map(([companyField, empresaField]) => [companyField, empresa[empresaField] != null && !(typeof empresa[empresaField] === "string" && empresa[empresaField].trim() === "")])),
  };
}

async function main() {
  assertProductionTarget();
  const columns = await tableColumns(prisma);
  const tables = await publicTables(prisma);
  const blockers = [];

  const empresaCount = await prisma.empresa.count();
  const empresa = empresaCount === 1 ? await prisma.empresa.findUnique({ where: { id: SOURCE_EMPRESA_ID } }) : null;
  const companyCount = await prisma.company.count();
  const companyWithLegacyId = await prisma.company.count({ where: { legacyEmpresaId: SOURCE_EMPRESA_ID } });
  const slugConflict = await prisma.company.count({ where: { slug: "rigo-asociados" } });
  const taxId = empresa?.nifCif?.trim() || null;
  const taxIdConflict = taxId ? await prisma.company.count({ where: { taxId } }) : 0;
  if (empresaCount !== 1) blockers.push(`EMPRESA_COUNT_MISMATCH:${empresaCount}`);
  if (!empresa) blockers.push(`EMPRESA_ID_MISMATCH:${SOURCE_EMPRESA_ID}`);
  if (companyCount !== 0) blockers.push(`COMPANY_COUNT_MISMATCH:${companyCount}`);
  if (companyWithLegacyId !== 0) blockers.push(`COMPANY_LEGACY_LINK_ALREADY_EXISTS:${companyWithLegacyId}`);
  if (slugConflict !== 0) blockers.push(`COMPANY_SLUG_CONFLICT:${slugConflict}`);
  if (taxIdConflict !== 0) blockers.push(`COMPANY_TAX_ID_CONFLICT:${taxIdConflict}`);

  const before = await snapshot(prisma);
  const nullsByTable = Object.fromEntries(before.map((entry) => [entry.table, entry.nulls]));
  const totalNulls = before.reduce((sum, entry) => sum + entry.nulls, 0);
  if (totalNulls !== EXPECTED_TOTAL) blockers.push(`OPERATIONAL_NULL_COUNT_MISMATCH:${totalNulls}`);
  const missingCompanyColumn = LEGACY_TABLES.filter((table) => !columns.get(table)?.has("companyId"));
  if (missingCompanyColumn.length) blockers.push(`LEGACY_TABLE_COMPANY_COLUMN_MISSING:${missingCompanyColumn.join(",")}`);

  const excludedNullCounts = await excludedNulls(prisma, columns);
  for (const [table, value] of Object.entries(excludedNullCounts)) if (value !== 0) blockers.push(`EXCLUDED_NULL_ROWS:${table}:${value}`);
  const candidates = await candidateRows(prisma, columns);
  if (candidates.length !== EXPECTED_TOTAL) blockers.push(`CANDIDATE_MANIFEST_COUNT_MISMATCH:${candidates.length}`);
  if (candidates.some((row) => row.companyId !== null)) blockers.push("CANDIDATE_WITH_NON_NULL_COMPANY");

  const manifestLines = candidates.map((row) => `${row.table}:${row.id}`).sort();
  const manifestSha256 = sha256(manifestLines.join("\n"));
  const inventorySha256 = sha256(stableStringify(candidates));
  const numbering = await numberingReport(prisma);
  if (numbering.duplicateGroups.length) blockers.push(`DUPLICATE_LEGACY_NUMBERS:${numbering.duplicateGroups.length}`);
  const relation = await relationReport(prisma, columns);
  if (relation.issues.length) blockers.push(`RELATION_COMPANY_ID_MISMATCH:${relation.issues.length}`);
  const fingerprints = await fingerprintHits(prisma, tables);
  const fingerprintTotal = Object.values(fingerprints).reduce((sum, entry) => sum + entry.total, 0);
  if (fingerprintTotal !== 0) blockers.push(`QA_FINGERPRINTS_PRESENT:${fingerprintTotal}`);
  const task = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
  if (!task) blockers.push("EXCLUDED_TASK_MISSING");

  const protectedTableCounts = await protectedCounts(prisma);
  const report = {
    ok: blockers.length === 0,
    mode: "dry-run-read-only",
    productionTarget: {
      railwayProjectId: process.env.RAILWAY_PROJECT_ID,
      railwayEnvironmentId: process.env.RAILWAY_ENVIRONMENT_ID,
      railwayServiceId: process.env.RAILWAY_SERVICE_ID,
      railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME,
      railwayServiceName: process.env.RAILWAY_SERVICE_NAME,
      databaseHostChecked: true,
      databaseValuePrinted: false,
    },
    source: {
      empresaCount,
      empresaId: empresa?.id ?? null,
      expectedEmpresaId: SOURCE_EMPRESA_ID,
      nombreComercial: empresa?.nombreComercial ?? null,
    },
    companyBefore: { total: companyCount, linkedToLegacyEmpresa: companyWithLegacyId },
    companyProposal: empresa ? companyProposal(empresa) : null,
    conflicts: { slug: slugConflict, taxId: taxIdConflict },
    operationalNulls: { expected: EXPECTED_TOTAL, total: totalNulls, byTable: nullsByTable },
    excludedNullCounts,
    protectedTableCounts,
    candidateManifest: {
      total: candidates.length,
      sha256: manifestSha256,
      inventorySha256,
      selection: "exact companyId IS NULL rows in the controlled LEGACY_TABLES set; no date predicate",
      identification: {
        confidence: blockers.length === 0 ? "HIGH" : "BLOCKED",
        basis: [
          "exact Railway production target",
          "Empresa count exactly 1 and id empresa-demo",
          "Company count exactly 0 and no legacy link",
          "QA closure and all known fingerprints are zero",
          "excluded protected tables have zero companyId-null rows",
          "all controlled parent/child companyId relations are coherent",
        ],
      },
      lines: manifestLines,
      rows: candidates,
    },
    numbering,
    relations: relation,
    qaClosure: {
      fingerprints,
      fingerprintTotal,
      transitivelyClosed: fingerprintTotal === 0,
    },
    protectedTask: {
      id: EXCLUDED_TASK_ID,
      present: Boolean(task),
      companyId: task?.companyId ?? null,
      rowSha256: task ? sha256(stableStringify(task)) : null,
    },
    execution: { requested: false, performed: false, companyCreated: 0, rowsUpdated: 0 },
    blockers,
    nextAuthorization: blockers.length === 0
      ? `AUTORIZO EXCLUSIVAMENTE LA CREACIÓN DE UNA ÚNICA COMPANY LEGACY VINCULADA A EMPRESA-DEMO Y EL BACKFILL TRANSACCIONAL DE LOS 228 REGISTROS DEL MANIFIESTO SHA-256 ${manifestSha256}. NO AUTORIZO NINGUNA OTRA MODIFICACIÓN.`
      : null,
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: report.ok,
    mode: report.mode,
    reportPath: OUTPUT_PATH,
    empresaCount,
    empresaId: empresa?.id ?? null,
    companyCount,
    totalNulls,
    candidateCount: candidates.length,
    manifestSha256,
    inventorySha256,
    excludedNullCounts,
    duplicateNumberGroups: numbering.duplicateGroups.length,
    relationIssues: relation.issues.length,
    fingerprintTotal,
    taskPresent: Boolean(task),
    blockers,
    execution: report.execution,
  }, null, 2));
  if (blockers.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "LEGACY_BACKFILL_AUDIT_FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
