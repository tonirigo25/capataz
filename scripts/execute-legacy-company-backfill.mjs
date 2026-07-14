import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const SOURCE_EMPRESA_ID = "empresa-demo";
const EXPECTED_TOTAL = 228;
const EXPECTED_MANIFEST_SHA256 = "63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c";
const APPROVAL = "AUTORIZO EXCLUSIVAMENTE LA CREACIÓN DE UNA ÚNICA COMPANY LEGACY VINCULADA A EMPRESA-DEMO Y EL BACKFILL TRANSACCIONAL DE LOS 228 REGISTROS DEL MANIFIESTO SHA-256 63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c. NO AUTORIZO NINGUNA OTRA MODIFICACIÓN.";
const EXCLUDED_TASK_ID = "cmrhm95u80004vd84gufttv29";
const BACKUP_PATH = resolve(process.cwd(), `.codex-backup/production-fixture-backups/legacy-company-228-${EXPECTED_MANIFEST_SHA256}.json`);
const REPORT_PATH = resolve(process.cwd(), ".codex-backup/legacy-company-backfill/execution-report.json");
const executeRequested = process.argv.includes("--execute");

const LEGACY_TABLES = [
  "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material",
  "InternalNote", "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "RecurringExpense",
  "ExpectedCashFlow", "ChatConversation", "BusinessSignalState", "BusinessRecommendation",
  "AutomationDefinition", "AutomationRun", "Task", "FollowUp",
];
const EXCLUDED_NULL_TABLES = ["Document", "CashMovement", "TreasurySettings", "SecurityAuditEvent"];
const PROTECTED_TABLES = [
  "User", "CompanyMembership", "Session", "EmailVerificationToken", "PasswordResetToken",
  "Document", "CashMovement", "SecurityAuditEvent", "TreasurySettings",
];
const FINGERPRINTS = ["4a33f773", "7a3b51a7", "7be8432e"];
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

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
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
  if (!/(?:railway|rlwy)/i.test(parsed.hostname)) throw new Error("BACKFILL_REQUIRES_RAILWAY_DATABASE");
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

async function allTableCounts(client, tables) {
  const result = {};
  for (const table of tables) result[table] = await count(client, table);
  return result;
}

async function controlledSnapshot(client) {
  const rows = [];
  for (const table of LEGACY_TABLES) {
    rows.push({
      table,
      total: await count(client, table),
      nulls: await count(client, table, '"companyId" IS NULL'),
    });
  }
  return rows;
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

async function candidateRows(client, columns) {
  const result = [];
  for (const table of LEGACY_TABLES) {
    const available = columns.get(table) ?? new Set();
    if (!available.has("id") || !available.has("companyId")) throw new Error(`LEGACY_TABLE_SCHEMA_MISMATCH:${table}`);
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
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? null,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ?? null,
      });
    }
  }
  return result.sort((a, b) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`));
}

function manifestHash(rows) {
  return sha256(rows.map((row) => `${row.table}:${row.id}`).sort().join("\n"));
}

function inventoryHash(rows) {
  return sha256(stableStringify(rows));
}

function companyDataFromEmpresa(empresa) {
  return {
    slug: "rigo-asociados",
    nombreComercial: empresa.nombreComercial,
    razonSocial: empresa.razonSocial,
    taxId: empresa.nifCif?.trim() || null,
    email: empresa.email,
    telefono: empresa.telefono,
    direccion: empresa.direccionFiscal,
    codigoPostal: empresa.codigoPostal,
    ciudad: empresa.ciudad ?? empresa.municipio,
    provincia: empresa.provincia,
    pais: empresa.pais?.trim() || "España",
    timezone: "Europe/Madrid",
    locale: "es-ES",
    status: "active",
    isDemo: false,
    legacyEmpresaId: SOURCE_EMPRESA_ID,
    web: empresa.web,
    contactPerson: empresa.personaContacto,
    iban: empresa.iban,
    defaultConditions: empresa.condicionesPorDefecto,
    legalText: empresa.textoLegal,
    logoUrl: empresa.logoUrl,
    sealUrl: empresa.selloUrl,
    brandColor: empresa.colorMarca,
    defaultVat: empresa.ivaDefecto,
    currency: empresa.moneda,
    budgetValidityDays: empresa.validezPresupuestoDias,
    defaultPaymentTerms: empresa.formaPagoDefecto,
    budgetSeries: empresa.seriePresupuestos,
    invoiceSeries: empresa.serieFacturas,
    workSeries: empresa.serieObras,
    budgetPrefix: empresa.prefijoPresupuesto,
    invoicePrefix: empresa.prefijoFactura,
    workPrefix: empresa.prefijoObra,
  };
}

function companyMatches(company, data) {
  return Object.entries(data).every(([field, value]) => company[field] === value);
}

function taskFingerprint(task) {
  if (!task) return null;
  return sha256(stableStringify({ ...task, companyId: null }));
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

async function relationIssues(client, columns) {
  const issues = [];
  for (const relation of await foreignKeys(client, columns)) {
    const rows = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM ${quoteIdentifier(relation.sourceTable)} source
       JOIN ${quoteIdentifier(relation.targetTable)} target
         ON source.${quoteIdentifier(relation.sourceColumn)} = target.${quoteIdentifier(relation.targetColumn)}
       WHERE source."companyId" IS DISTINCT FROM target."companyId"`,
    );
    const value = Number(rows[0]?.count ?? 0);
    if (value) issues.push({ ...relation, count: value });
  }
  return issues;
}

async function duplicateNumberGroups(client) {
  const duplicates = [];
  for (const [table, field] of NUMBER_FIELDS) {
    const rows = await client.$queryRawUnsafe(
      `SELECT ${quoteIdentifier(field)} AS value, COUNT(*)::bigint AS count
       FROM ${quoteIdentifier(table)}
       WHERE "companyId" IS NOT NULL AND ${quoteIdentifier(field)} IS NOT NULL
       GROUP BY ${quoteIdentifier(field)} HAVING COUNT(*) > 1`,
    );
    duplicates.push(...rows.map((row) => ({ table, field, value: row.value, count: Number(row.count) })));
  }
  return duplicates;
}

function sameCounts(before, after, expectedCompanyDelta) {
  for (const [table, value] of Object.entries(before)) {
    const expected = table === "Company" ? value + expectedCompanyDelta : value;
    if (after[table] !== expected) throw new Error(`UNAUTHORIZED_TABLE_COUNT_CHANGE:${table}:${value}:${after[table]}:${expected}`);
  }
}

async function assertTaskHash(client, expectedHash, expectedCompanyId) {
  const task = await client.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
  if (!task) throw new Error("EXCLUDED_TASK_MISSING");
  const actualHash = taskFingerprint(task);
  if (actualHash !== expectedHash) throw new Error("EXCLUDED_TASK_CHANGED");
  if (expectedCompanyId !== undefined && task.companyId !== expectedCompanyId) throw new Error("EXCLUDED_TASK_COMPANY_MISMATCH");
  return task;
}

async function createBackup({ empresa, companyData, candidates, inventorySha256, countsBefore, protectedBefore, taskHash }) {
  if (existsSync(BACKUP_PATH)) {
    const existingBytes = readFileSync(BACKUP_PATH);
    const existing = JSON.parse(existingBytes.toString("utf8"));
    if (existing.manifestSha256 !== EXPECTED_MANIFEST_SHA256 || existing.rows?.length !== EXPECTED_TOTAL) {
      throw new Error("LEGACY_BACKUP_EXISTING_MISMATCH");
    }
    return { path: BACKUP_PATH, sha256: sha256(existingBytes), reused: true };
  }
  const rows = [];
  for (const table of LEGACY_TABLES) {
    const tableRows = await prisma.$queryRawUnsafe(`SELECT * FROM ${quoteIdentifier(table)} WHERE "companyId" IS NULL ORDER BY "id"`);
    for (const row of tableRows) rows.push({ table, row: jsonSafe(row) });
  }
  if (rows.length !== EXPECTED_TOTAL) throw new Error(`BACKUP_ROW_COUNT_MISMATCH:${rows.length}`);
  const payload = {
    version: 1,
    purpose: "legacy-company-backfill-228",
    manifestSha256: EXPECTED_MANIFEST_SHA256,
    inventorySha256,
    createdAt: new Date().toISOString(),
    sourceEmpresa: jsonSafe(empresa),
    proposedCompany: jsonSafe(companyData),
    countsBefore,
    protectedBefore,
    taskId: EXCLUDED_TASK_ID,
    taskSha256: taskHash,
    selectors: candidates,
    rows,
  };
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
  mkdirSync(dirname(BACKUP_PATH), { recursive: true });
  writeFileSync(BACKUP_PATH, bytes, { flag: "wx" });
  return { path: BACKUP_PATH, sha256: sha256(bytes), reused: false };
}

async function preflight() {
  const columns = await tableColumns(prisma);
  const tables = await publicTables(prisma);
  const empresaCount = await prisma.empresa.count();
  const empresa = empresaCount === 1 ? await prisma.empresa.findUnique({ where: { id: SOURCE_EMPRESA_ID } }) : null;
  if (empresaCount !== 1 || !empresa) throw new Error(`EMPRESA_STATE_MISMATCH:${empresaCount}:${empresa?.id ?? "missing"}`);
  const companyCount = await prisma.company.count();
  const linkedCompanies = await prisma.company.findMany({ where: { legacyEmpresaId: SOURCE_EMPRESA_ID }, take: 2 });
  const controlledBefore = await controlledSnapshot(prisma);
  const totalNulls = controlledBefore.reduce((sum, row) => sum + row.nulls, 0);
  const proposal = companyDataFromEmpresa(empresa);
  const companySlugConflict = await prisma.company.count({ where: { slug: proposal.slug } });
  const companyTaxConflict = proposal.taxId ? await prisma.company.count({ where: { taxId: proposal.taxId } }) : 0;
  const excludedNullCounts = await excludedNulls(prisma, columns);
  if (Object.values(excludedNullCounts).some(Boolean)) throw new Error(`EXCLUDED_NULL_ROWS:${JSON.stringify(excludedNullCounts)}`);
  const protectedBefore = await protectedCounts(prisma);
  const task = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
  if (!task) throw new Error("EXCLUDED_TASK_MISSING");
  const taskHash = taskFingerprint(task);
  const fingerprints = await fingerprintHits(prisma, tables);
  if (Object.values(fingerprints).some((entry) => entry.total !== 0)) throw new Error(`QA_FINGERPRINTS_PRESENT:${JSON.stringify(fingerprints)}`);

  if (companyCount === 0 && totalNulls === EXPECTED_TOTAL) {
    if (linkedCompanies.length !== 0) throw new Error(`COMPANY_LINK_STATE_MISMATCH:${linkedCompanies.length}`);
    if (companySlugConflict !== 0) throw new Error(`COMPANY_SLUG_CONFLICT:${companySlugConflict}`);
    if (companyTaxConflict !== 0) throw new Error(`COMPANY_TAX_ID_CONFLICT:${companyTaxConflict}`);
    const candidates = await candidateRows(prisma, columns);
    const manifestSha256 = manifestHash(candidates);
    if (manifestSha256 !== EXPECTED_MANIFEST_SHA256 || candidates.length !== EXPECTED_TOTAL) {
      throw new Error(`BACKFILL_MANIFEST_MISMATCH:${candidates.length}:${manifestSha256}`);
    }
    return {
      state: "ready-to-write",
      columns,
      tables,
      empresa,
      companyData: proposal,
      candidates,
      manifestSha256,
      inventorySha256: inventoryHash(candidates),
      controlledBefore,
      protectedBefore,
      excludedNullCounts,
      fingerprints,
      taskHash,
      allCountsBefore: await allTableCounts(prisma, tables),
    };
  }

  if (companyCount === 1 && linkedCompanies.length === 1 && totalNulls === 0) {
    const company = linkedCompanies[0];
    if (!companyMatches(company, proposal)) throw new Error("LINKED_COMPANY_FIELDS_MISMATCH");
    if (!existsSync(BACKUP_PATH)) throw new Error("LEGACY_BACKUP_MISSING_FOR_NOOP");
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8"));
    if (backup.manifestSha256 !== EXPECTED_MANIFEST_SHA256 || backup.rows?.length !== EXPECTED_TOTAL) throw new Error("LEGACY_BACKUP_MANIFEST_MISMATCH");
    for (const selector of backup.selectors) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(selector.table)} WHERE "id" = $1 AND "companyId" = $2`,
        selector.id,
        company.id,
      );
      if (Number(rows[0]?.count ?? 0) !== 1) throw new Error(`NOOP_ROW_NOT_BACKFILLED:${selector.table}:${selector.id}`);
    }
    return {
      state: "already-backfilled",
      columns,
      tables,
      empresa,
      companyData: proposal,
      company,
      backup,
      controlledBefore,
      protectedBefore,
      excludedNullCounts,
      fingerprints,
      taskHash,
      allCountsBefore: await allTableCounts(prisma, tables),
    };
  }
  throw new Error(`UNEXPECTED_PRODUCTION_STATE:company=${companyCount}:linked=${linkedCompanies.length}:nulls=${totalNulls}`);
}

async function executeWrite(preflightResult, backup) {
  if (preflightResult.state !== "ready-to-write") throw new Error("WRITE_REQUIRES_READY_STATE");
  return prisma.$transaction(async (tx) => {
    const companies = await tx.company.findMany({ take: 2 });
    const empresaCount = await tx.empresa.count();
    if (empresaCount !== 1 || companies.length !== 0) throw new Error("CONCURRENT_COMPANY_STATE_CHANGE");
    const insideCandidates = await candidateRows(tx, preflightResult.columns);
    if (insideCandidates.length !== EXPECTED_TOTAL || manifestHash(insideCandidates) !== EXPECTED_MANIFEST_SHA256) throw new Error("CONCURRENT_MANIFEST_CHANGE");
    const insideTotalNulls = (await controlledSnapshot(tx)).reduce((sum, row) => sum + row.nulls, 0);
    if (insideTotalNulls !== EXPECTED_TOTAL) throw new Error(`CONCURRENT_NULL_COUNT_CHANGE:${insideTotalNulls}`);
    const insideProtected = await protectedCounts(tx);
    for (const [table, value] of Object.entries(preflightResult.protectedBefore)) if (insideProtected[table] !== value) throw new Error(`PROTECTED_COUNT_CHANGED_BEFORE_WRITE:${table}`);
    const created = await tx.company.create({ data: preflightResult.companyData });
    const byTable = {};
    for (const table of LEGACY_TABLES) {
      const ids = insideCandidates.filter((row) => row.table === table).map((row) => row.id);
      if (!ids.length) {
        byTable[table] = 0;
        continue;
      }
      const placeholders = ids.map((_, index) => `$${index + 2}`).join(",");
      const updated = await tx.$executeRawUnsafe(
        `UPDATE ${quoteIdentifier(table)} SET "companyId" = $1
         WHERE "companyId" IS NULL AND "id" IN (${placeholders})`,
        created.id,
        ...ids,
      );
      if (updated !== ids.length) throw new Error(`BACKFILL_UPDATE_COUNT_MISMATCH:${table}:${updated}:${ids.length}`);
      byTable[table] = updated;
    }
    const updatedTotal = Object.values(byTable).reduce((sum, value) => sum + value, 0);
    if (updatedTotal !== EXPECTED_TOTAL) throw new Error(`BACKFILL_TOTAL_MISMATCH:${updatedTotal}`);
    const afterControlled = await controlledSnapshot(tx);
    if (afterControlled.some((row) => row.total !== (preflightResult.controlledBefore.find((before) => before.table === row.table)?.total ?? -1) || row.nulls !== 0)) throw new Error("BACKFILL_CONTROLLED_RECONCILIATION_FAILED");
    const afterCounts = await allTableCounts(tx, preflightResult.tables);
    sameCounts(preflightResult.allCountsBefore, afterCounts, 1);
    const afterProtected = await protectedCounts(tx);
    for (const [table, value] of Object.entries(preflightResult.protectedBefore)) if (afterProtected[table] !== value) throw new Error(`PROTECTED_TABLE_CHANGED:${table}`);
    const afterTask = await assertTaskHash(tx, preflightResult.taskHash, created.id);
    if ((await relationIssues(tx, preflightResult.columns)).length) throw new Error("BACKFILL_RELATION_RECONCILIATION_FAILED");
    if ((await duplicateNumberGroups(tx)).length) throw new Error("BACKFILL_NUMBERING_DUPLICATES");
    const afterFingerprints = await fingerprintHits(tx, preflightResult.tables);
    if (Object.values(afterFingerprints).some((entry) => entry.total !== 0)) throw new Error("BACKFILL_FINGERPRINTS_REAPPEARED");
    const verified = await tx.company.findUnique({ where: { id: created.id } });
    if (!verified || !companyMatches(verified, preflightResult.companyData)) throw new Error("CREATED_COMPANY_FIELDS_MISMATCH");
    if (await tx.company.count() !== 1 || await tx.empresa.count() !== 1) throw new Error("POST_COMPANY_COUNT_MISMATCH");
    if (!afterTask || afterTask.id !== EXCLUDED_TASK_ID) throw new Error("EXCLUDED_TASK_NOT_PRESERVED");
    return { created, byTable, updatedTotal, backup, afterFingerprints };
  }, { isolationLevel: "Serializable", timeout: 300_000, maxWait: 20_000 });
}

async function reconcileAfter(expected, company, expectedCompanyDelta = 1) {
  const columns = await tableColumns(prisma);
  const tables = await publicTables(prisma);
  const companies = await prisma.company.findMany({ where: { legacyEmpresaId: SOURCE_EMPRESA_ID }, take: 2 });
  const nullSnapshot = await controlledSnapshot(prisma);
  const totalNulls = nullSnapshot.reduce((sum, row) => sum + row.nulls, 0);
  if (companies.length !== 1 || companies[0].id !== company.id) throw new Error("POST_LINK_RECONCILIATION_FAILED");
  if (totalNulls !== 0) throw new Error(`POST_NULL_RECONCILIATION_FAILED:${totalNulls}`);
  const allCounts = await allTableCounts(prisma, tables);
  sameCounts(expected.allCountsBefore, allCounts, expectedCompanyDelta);
  const protectedAfter = await protectedCounts(prisma);
  for (const [table, value] of Object.entries(expected.protectedBefore)) if (protectedAfter[table] !== value) throw new Error(`POST_PROTECTED_RECONCILIATION_FAILED:${table}`);
  await assertTaskHash(prisma, expected.taskHash, company.id);
  const relationProblems = await relationIssues(prisma, columns);
  if (relationProblems.length) throw new Error(`POST_RELATION_RECONCILIATION_FAILED:${JSON.stringify(relationProblems)}`);
  const duplicateProblems = await duplicateNumberGroups(prisma);
  if (duplicateProblems.length) throw new Error(`POST_NUMBERING_RECONCILIATION_FAILED:${JSON.stringify(duplicateProblems)}`);
  const fingerprints = await fingerprintHits(prisma, tables);
  if (Object.values(fingerprints).some((entry) => entry.total !== 0)) throw new Error("POST_FINGERPRINT_RECONCILIATION_FAILED");
  const candidateCompanyCounts = {};
  for (const selector of expected.candidates) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(selector.table)} WHERE "id" = $1 AND "companyId" = $2`,
      selector.id,
      company.id,
    );
    const value = Number(rows[0]?.count ?? 0);
    if (value !== 1) throw new Error(`POST_ROW_COMPANY_RECONCILIATION_FAILED:${selector.table}:${selector.id}`);
    candidateCompanyCounts[selector.table] = (candidateCompanyCounts[selector.table] ?? 0) + value;
  }
  return { companyId: company.id, companyCount: companies.length, totalNulls, nullSnapshot, allCounts, protectedAfter, fingerprints, candidateCompanyCounts };
}

async function main() {
  if (!executeRequested) throw new Error("EXECUTE_FLAG_REQUIRED");
  if (process.env.CAPATAZ_LEGACY_COMPANY_BACKFILL_AUTHORIZATION !== APPROVAL) throw new Error("EXPLICIT_AUTHORIZATION_MISSING_OR_MISMATCH");
  assertProductionTarget();
  const preflightResult = await preflight();
  if (preflightResult.state === "already-backfilled") {
    const beforeCounts = preflightResult.allCountsBefore;
    const beforeTaskHash = preflightResult.taskHash;
    const after = await reconcileAfter({ ...preflightResult, allCountsBefore: beforeCounts, candidates: preflightResult.backup.selectors, protectedBefore: preflightResult.protectedBefore }, preflightResult.company, 0);
    const afterCounts = await allTableCounts(prisma, preflightResult.tables);
    for (const [table, value] of Object.entries(beforeCounts)) if (afterCounts[table] !== value) throw new Error(`NOOP_TABLE_COUNT_CHANGED:${table}`);
    const afterTask = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
    if (!afterTask || taskFingerprint(afterTask) !== beforeTaskHash || afterTask.companyId !== preflightResult.company.id) throw new Error("NOOP_TASK_CHANGED");
    const report = {
      ok: true,
      mode: "controlled-backfill-no-op",
      alreadyBackfilled: true,
      performed: false,
      companyId: preflightResult.company.id,
      legacyEmpresaId: SOURCE_EMPRESA_ID,
      updated: 0,
      backup: { path: BACKUP_PATH, reused: true, sha256: sha256(readFileSync(BACKUP_PATH)) },
      reconciliation: after,
    };
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(jsonSafe(report), null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ok: true, mode: report.mode, alreadyBackfilled: true, performed: false, companyId: report.companyId, updated: 0, reportPath: REPORT_PATH }, null, 2));
    return;
  }

  const backup = await createBackup({
    empresa: preflightResult.empresa,
    companyData: preflightResult.companyData,
    candidates: preflightResult.candidates,
    inventorySha256: preflightResult.inventorySha256,
    countsBefore: preflightResult.allCountsBefore,
    protectedBefore: preflightResult.protectedBefore,
    taskHash: preflightResult.taskHash,
  });
  const execution = await executeWrite(preflightResult, backup);
  const reconciliation = await reconcileAfter(preflightResult, execution.created);
  const report = {
    ok: true,
    mode: "controlled-company-create-and-backfill",
    alreadyBackfilled: false,
    performed: true,
    companyId: execution.created.id,
    legacyEmpresaId: SOURCE_EMPRESA_ID,
    manifestSha256: EXPECTED_MANIFEST_SHA256,
    inventorySha256: preflightResult.inventorySha256,
    backup,
    updated: execution.updatedTotal,
    byTable: execution.byTable,
    reconciliation,
  };
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(jsonSafe(report), null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, mode: report.mode, performed: true, companyId: report.companyId, updated: report.updated, byTable: report.byTable, backup: report.backup, reportPath: REPORT_PATH }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "LEGACY_COMPANY_BACKFILL_EXECUTION_FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
