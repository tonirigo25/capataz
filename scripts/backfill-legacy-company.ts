import { PrismaClient } from "@prisma/client";

const EXPECTED_TOTAL = 240;
const APPROVAL = "BACKFILL-240-LEGACY-COMPANY";
const EXCLUDED_TASK_ID = "cmrhm95u80004vd84gufttv29";
const executeRequested = process.argv.includes("--execute");
const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ log: [], datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined });

const expectedNulls = {
  Client: 9,
  Contact: 0,
  Work: 17,
  Budget: 16,
  Invoice: 5,
  Payment: 3,
  Expense: 0,
  Material: 0,
  Document: 0,
  InternalNote: 0,
  Reminder: 1,
  EventoAgenda: 5,
  Notification: 9,
  FinancialAccount: 0,
  CashMovement: 0,
  RecurringExpense: 0,
  ExpectedCashFlow: 0,
  ChatConversation: 82,
  BusinessSignalState: 25,
  BusinessRecommendation: 22,
  AutomationDefinition: 5,
  AutomationRun: 4,
  Task: 33,
  FollowUp: 4,
} as const;
const tables = Object.keys(expectedNulls) as Array<keyof typeof expectedNulls>;
const protectedTables = [
  "User", "Company", "CompanyMembership", "Session", "EmailVerificationToken", "PasswordResetToken",
  "Document", "Payment", "CashMovement", "SecurityAuditEvent",
] as const;

type CountRow = { count: bigint | number };
type ForeignKeyRow = { sourceTable: string; sourceColumn: string; targetTable: string; targetColumn: string };

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
  const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!raw || !/(?:railway|rlwy)/i.test(new URL(raw).hostname)) throw new Error("BACKFILL_REQUIRES_RAILWAY_DATABASE");
}

async function count(client: any, table: string, onlyNull = false) {
  const rows = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS count FROM "${table}"${onlyNull ? ' WHERE "companyId" IS NULL' : ""}`,
  ) as CountRow[];
  return Number(rows[0]?.count ?? 0);
}

async function snapshot(client: any) {
  return Promise.all(tables.map(async (table) => ({
    table,
    rows: await count(client, table),
    nulls: await count(client, table, true),
  })));
}

async function protectedCounts(client: any) {
  return Object.fromEntries(await Promise.all(protectedTables.map(async (table) => [table, await count(client, table)])));
}

async function foreignKeys(client: any) {
  const tableList = tables.map((table) => `'${table}'`).join(",");
  return client.$queryRawUnsafe(`
    SELECT source.relname AS "sourceTable", source_column.attname AS "sourceColumn",
           target.relname AS "targetTable", target_column.attname AS "targetColumn"
    FROM pg_constraint constraint_row
    JOIN pg_class source ON source.oid = constraint_row.conrelid
    JOIN pg_class target ON target.oid = constraint_row.confrelid
    JOIN pg_attribute source_column ON source_column.attrelid = source.oid AND source_column.attnum = constraint_row.conkey[1]
    JOIN pg_attribute target_column ON target_column.attrelid = target.oid AND target_column.attnum = constraint_row.confkey[1]
    WHERE constraint_row.contype = 'f'
      AND source.relname IN (${tableList})
      AND target.relname IN (${tableList})
  `) as Promise<ForeignKeyRow[]>;
}

async function relationIssues(client: any, companyId: string, after = false) {
  const issues = [];
  for (const relation of await foreignKeys(client)) {
    const predicate = after
      ? 'source."companyId" IS DISTINCT FROM target."companyId"'
      : `(
          (source."companyId" IS NULL AND target."companyId" IS NOT NULL AND target."companyId" <> $1)
          OR (source."companyId" IS NOT NULL AND target."companyId" IS NULL AND source."companyId" <> $1)
          OR (source."companyId" IS NOT NULL AND target."companyId" IS NOT NULL AND source."companyId" <> target."companyId")
        )`;
    const rows = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM "${relation.sourceTable}" source
       JOIN "${relation.targetTable}" target
         ON source."${relation.sourceColumn}" = target."${relation.targetColumn}"
       WHERE ${predicate}`,
      ...(after ? [] : [companyId]),
    ) as CountRow[];
    const count = Number(rows[0]?.count ?? 0);
    if (count) issues.push({ ...relation, count });
  }
  return issues;
}

async function duplicateGroups(client: any, companyId: string) {
  const checks = [
    ["Budget", "numero"], ["Invoice", "numero"], ["Work", "codigo"], ["Work", "numeroInterno"],
  ] as const;
  const result: Record<string, number> = {};
  for (const [table, column] of checks) {
    const rows = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM (
         SELECT COALESCE("companyId", $1), "${column}"
         FROM "${table}"
         WHERE "${column}" IS NOT NULL
         GROUP BY COALESCE("companyId", $1), "${column}"
         HAVING COUNT(*) > 1
       ) duplicates`,
      companyId,
    ) as CountRow[];
    result[`${table}.${column}`] = Number(rows[0]?.count ?? 0);
  }
  return result;
}

function sameCounts(left: Record<string, number>, right: Record<string, number>) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

async function main() {
  assertProductionTarget();
  const legacyCompanies = await prisma.empresa.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (legacyCompanies.length !== 1) throw new Error(`LEGACY_EMPRESA_COUNT_MISMATCH:${legacyCompanies.length}`);
  const legacy = legacyCompanies[0];
  const companies = await prisma.company.findMany({ where: { legacyEmpresaId: { not: null } }, take: 2 });
  if (companies.length !== 1) throw new Error(`LEGACY_COMPANY_COUNT_MISMATCH:${companies.length}`);
  const company = companies[0];
  if (company.legacyEmpresaId !== legacy.id) throw new Error("LEGACY_EMPRESA_LINK_MISMATCH");
  if (company.archivedAt || company.status !== "active") throw new Error("LEGACY_COMPANY_NOT_ACTIVE");

  const before = await snapshot(prisma);
  const nullsBefore = Object.fromEntries(before.map((row) => [row.table, row.nulls]));
  const totalNulls = before.reduce((sum, row) => sum + row.nulls, 0);
  const alreadyBackfilled = totalNulls === 0;
  const expectedCountsMatch = alreadyBackfilled
    ? before.every((row) => row.nulls === 0)
    : before.every((row) => row.nulls === expectedNulls[row.table]);
  if (!expectedCountsMatch || (!alreadyBackfilled && totalNulls !== EXPECTED_TOTAL)) {
    throw new Error(`BACKFILL_MANIFEST_MISMATCH:${totalNulls}`);
  }
  const treasurySettingsNulls = await count(prisma, "TreasurySettings", true);
  if (treasurySettingsNulls !== 0) throw new Error(`UNAUTHORIZED_TREASURY_SETTINGS_NULLS:${treasurySettingsNulls}`);
  const relationsBefore = await relationIssues(prisma, company.id);
  if (relationsBefore.length) throw new Error(`BACKFILL_RELATION_ISSUES:${JSON.stringify(relationsBefore)}`);
  const duplicatesBefore = await duplicateGroups(prisma, company.id);
  if (Object.values(duplicatesBefore).some(Boolean)) throw new Error(`BACKFILL_DUPLICATES:${JSON.stringify(duplicatesBefore)}`);
  const protectedBefore = await protectedCounts(prisma);
  const excludedTaskBefore = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID }, select: { id: true, companyId: true } });
  if (!excludedTaskBefore) throw new Error("EXCLUDED_TASK_MISSING");

  let execution = { requested: executeRequested, performed: false, updated: 0, byTable: {} as Record<string, number> };
  let after = before;
  if (executeRequested) {
    if (process.env.CAPATAZ_LEGACY_BACKFILL_APPROVAL !== APPROVAL) throw new Error("EXPLICIT_BACKFILL_APPROVAL_MISSING");
    execution = await prisma.$transaction(async (tx) => {
      const insideBefore = await snapshot(tx);
      if (insideBefore.reduce((sum, row) => sum + row.nulls, 0) !== totalNulls) throw new Error("BACKFILL_CONCURRENT_COUNT_CHANGE");
      const byTable: Record<string, number> = {};
      for (const table of tables) {
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "${table}" SET "companyId" = $1 WHERE "companyId" IS NULL`,
          company.id,
        );
        const expected = alreadyBackfilled ? 0 : expectedNulls[table];
        if (updated !== expected) throw new Error(`BACKFILL_UPDATE_COUNT_MISMATCH:${table}:${updated}:${expected}`);
        byTable[table] = updated;
      }
      const updated = Object.values(byTable).reduce((sum, count) => sum + count, 0);
      if (updated !== (alreadyBackfilled ? 0 : EXPECTED_TOTAL)) throw new Error(`BACKFILL_TOTAL_MISMATCH:${updated}`);
      const insideAfter = await snapshot(tx);
      if (insideAfter.some((row, index) => row.rows !== insideBefore[index].rows || row.nulls !== 0)) {
        throw new Error("BACKFILL_RECONCILIATION_FAILED");
      }
      const relationProblems = await relationIssues(tx, company.id, true);
      if (relationProblems.length) throw new Error(`BACKFILL_POST_RELATION_ISSUES:${JSON.stringify(relationProblems)}`);
      const duplicateProblems = await duplicateGroups(tx, company.id);
      if (Object.values(duplicateProblems).some(Boolean)) throw new Error(`BACKFILL_POST_DUPLICATES:${JSON.stringify(duplicateProblems)}`);
      return { requested: true, performed: true, updated, byTable };
    }, { isolationLevel: "Serializable", timeout: 120_000 });
    after = await snapshot(prisma);
  }

  const protectedAfter = await protectedCounts(prisma);
  if (!sameCounts(protectedBefore, protectedAfter)) throw new Error("PROTECTED_TABLE_COUNTS_CHANGED");
  const excludedTaskAfter = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID }, select: { id: true, companyId: true } });
  if (!excludedTaskAfter || excludedTaskAfter.id !== excludedTaskBefore.id) throw new Error("EXCLUDED_TASK_NOT_PRESERVED");
  const report = before.map((entry, index) => ({
    table: entry.table,
    rowsBefore: entry.rows,
    rowsAfter: after[index].rows,
    nullsBefore: entry.nulls,
    nullsAfter: after[index].nulls,
    updated: execution.byTable[entry.table] ?? 0,
  }));

  console.log(JSON.stringify({
    ok: true,
    mode: executeRequested ? "controlled-backfill" : "dry-run",
    companyId: company.id,
    legacyEmpresaId: legacy.id,
    alreadyBackfilled,
    expectedCountsMatch,
    totalNullsBefore: totalNulls,
    expectedTotal: EXPECTED_TOTAL,
    nullsBefore,
    treasurySettingsNulls,
    relationsBefore,
    duplicatesBefore,
    protectedCounts: protectedAfter,
    excludedTask: excludedTaskAfter,
    report,
    execution,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "LEGACY_BACKFILL_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
