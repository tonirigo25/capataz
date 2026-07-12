import { prisma } from "../lib/prisma";

const tables = [
  "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material", "Document", "InternalNote",
  "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "CashMovement", "RecurringExpense", "ExpectedCashFlow",
  "ChatConversation", "BusinessSignalState", "BusinessRecommendation", "AutomationDefinition", "AutomationRun", "Task", "FollowUp"
] as const;

type CountRow = { count: bigint };
async function count(table: string, onlyNull = false) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*)::bigint AS count FROM "${table}"${onlyNull ? ' WHERE "companyId" IS NULL' : ""}`);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const legacy = await prisma.empresa.findFirst({ orderBy: { createdAt: "asc" } });
  const totalOperational = (await Promise.all(tables.map((table) => count(table)))).reduce((sum, value) => sum + value, 0);
  if (!legacy && totalOperational > 0) throw new Error("LEGACY_COMPANY_REQUIRED_FOR_EXISTING_DATA");
  if (!legacy) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "no_legacy_or_operational_data", tables: [] }));
    return;
  }

  const company = await prisma.company.upsert({
    where: { legacyEmpresaId: legacy.id },
    update: {},
    create: {
      slug: `legacy-${legacy.id.toLowerCase()}`,
      nombreComercial: legacy.nombreComercial,
      razonSocial: legacy.razonSocial,
      taxId: legacy.nifCif,
      email: legacy.email,
      telefono: legacy.telefono,
      direccion: legacy.direccionFiscal,
      codigoPostal: legacy.codigoPostal,
      ciudad: legacy.ciudad ?? legacy.municipio,
      provincia: legacy.provincia,
      pais: legacy.pais,
      legacyEmpresaId: legacy.id
    }
  });

  const before = await Promise.all(tables.map(async (table) => ({ table, rows: await count(table), nulls: await count(table, true) })));
  await prisma.$transaction(async (tx) => {
    for (const table of tables) await tx.$executeRawUnsafe(`UPDATE "${table}" SET "companyId" = $1 WHERE "companyId" IS NULL`, company.id);
  }, { timeout: 120_000 });
  const after = await Promise.all(tables.map(async (table) => ({ table, rows: await count(table), nulls: await count(table, true) })));
  const report = before.map((entry, index) => ({
    table: entry.table,
    rowsBefore: entry.rows,
    rowsAfter: after[index].rows,
    nullsBefore: entry.nulls,
    nullsAfter: after[index].nulls,
    updated: entry.nulls - after[index].nulls,
    difference: after[index].rows - entry.rows
  }));
  if (report.some((row) => row.difference !== 0 || row.nullsAfter !== 0)) throw new Error("LEGACY_BACKFILL_RECONCILIATION_FAILED");
  console.log(JSON.stringify({ ok: true, companyId: company.id, legacyEmpresaId: legacy.id, report }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "LEGACY_BACKFILL_FAILED"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
