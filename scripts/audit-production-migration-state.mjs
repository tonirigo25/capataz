import { PrismaClient } from "@prisma/client";

const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL_MISSING");
const parsed = new URL(raw);
if (!/railway|rlwy/i.test(parsed.hostname)) throw new Error("AUDIT_REQUIRES_RAILWAY_DATABASE");

const prisma = new PrismaClient({ log: [], datasources: { db: { url: raw } } });
const tables = [
  "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material", "Document",
  "InternalNote", "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "CashMovement",
  "RecurringExpense", "ExpectedCashFlow", "ChatConversation", "BusinessSignalState", "BusinessRecommendation",
  "AutomationDefinition", "AutomationRun", "Task", "FollowUp",
];

try {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name,
           started_at,
           finished_at,
           rolled_back_at,
           applied_steps_count,
           CASE WHEN logs IS NULL THEN false ELSE true END AS has_logs
    FROM "_prisma_migrations"
    WHERE migration_name IN (
      '20260712180000_company_ownership_nullable',
      '20260712210000_company_numbering_and_settings'
    )
    ORDER BY started_at
  `);
  const nullCounts = {};
  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}" WHERE "companyId" IS NULL`);
    nullCounts[table] = rows[0]?.count ?? 0;
  }
  console.log(JSON.stringify({
    mode: "read-only-audit",
    migrations,
    nullCompanyIds: nullCounts,
    totalNullCompanyIds: Object.values(nullCounts).reduce((sum, count) => sum + count, 0),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
