import { PrismaClient } from "@prisma/client";

type MoneyPair = { source: string; mirror: string };
type MoneyTarget = { table: string; companyColumn: string; pairs: MoneyPair[] };

const TARGETS: MoneyTarget[] = [
  { table: "Work", companyColumn: "companyId", pairs: [
    { source: "presupuestoAprobado", mirror: "presupuestoAprobadoDecimal" },
    { source: "costePrevisto", mirror: "costePrevistoDecimal" },
    { source: "gastoReal", mirror: "gastoRealDecimal" },
    { source: "margenEstimado", mirror: "margenEstimadoDecimal" },
  ] },
  { table: "Budget", companyColumn: "companyId", pairs: [
    { source: "subtotal", mirror: "subtotalDecimal" }, { source: "iva", mirror: "ivaDecimal" },
    { source: "descuento", mirror: "descuentoDecimal" }, { source: "total", mirror: "totalDecimal" },
    { source: "margenEstimado", mirror: "margenEstimadoDecimal" },
  ] },
  { table: "Invoice", companyColumn: "companyId", pairs: [
    { source: "importeBase", mirror: "importeBaseDecimal" }, { source: "iva", mirror: "ivaDecimal" },
    { source: "total", mirror: "totalDecimal" }, { source: "pagado", mirror: "pagadoDecimal" },
    { source: "pendiente", mirror: "pendienteDecimal" },
  ] },
  { table: "Payment", companyColumn: "companyId", pairs: [{ source: "importe", mirror: "importeDecimal" }] },
  { table: "Expense", companyColumn: "companyId", pairs: [{ source: "importe", mirror: "importeDecimal" }] },
  { table: "FinancialAccount", companyColumn: "companyId", pairs: [
    { source: "openingBalance", mirror: "openingBalanceDecimal" },
    { source: "currentManualBalance", mirror: "currentManualBalanceDecimal" },
    { source: "minimumBalance", mirror: "minimumBalanceDecimal" },
  ] },
  { table: "CashMovement", companyColumn: "companyId", pairs: [{ source: "amount", mirror: "amountDecimal" }] },
  { table: "RecurringExpense", companyColumn: "companyId", pairs: [{ source: "amount", mirror: "amountDecimal" }] },
  { table: "ExpectedCashFlow", companyColumn: "companyId", pairs: [{ source: "amount", mirror: "amountDecimal" }] },
  { table: "TreasurySettings", companyColumn: "companyId", pairs: [
    { source: "minimumCashBalance", mirror: "minimumCashBalanceDecimal" },
    { source: "safetyBuffer", mirror: "safetyBufferDecimal" },
  ] },
  { table: "Document", companyColumn: "companyId", pairs: [{ source: "extractedTotal", mirror: "extractedTotalDecimal" }] },
  { table: "PurchaseInvoice", companyColumn: "companyId", pairs: [
    { source: "taxableBase", mirror: "taxableBaseDecimal" }, { source: "vatAmount", mirror: "vatAmountDecimal" },
    { source: "withholdingAmount", mirror: "withholdingAmountDecimal" }, { source: "total", mirror: "totalDecimal" },
    { source: "paidAmount", mirror: "paidAmountDecimal" }, { source: "pendingAmount", mirror: "pendingAmountDecimal" },
  ] },
  { table: "PurchaseInvoicePayment", companyColumn: "companyId", pairs: [{ source: "amount", mirror: "amountDecimal" }] },
];

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function quote(identifier: string) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(identifier)) throw new Error("Unsafe SQL identifier");
  return `"${identifier}"`;
}

function assertDatabaseGuard(apply: boolean) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1);
  const isolatedLocal = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
    && databaseName.startsWith("capataz_test")
    && process.env.CAPATAZ_TEST_DATABASE_ISOLATED === "true";
  const explicitlyApproved = process.env.ORQENA_MONEY_BACKFILL_APPROVED === "true"
    && Boolean(argument("--authorization-ref"));
  if (apply && !isolatedLocal && !explicitlyApproved) {
    throw new Error("Apply refused: use an isolated capataz_test database or a separately authorized approval reference");
  }
}

const companyId = argument("--company-id");
if (!companyId) throw new Error("--company-id is required");
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;
if (apply && process.argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --apply");
const batchSize = Number(argument("--batch-size") ?? "100");
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error("--batch-size must be 1..1000");
let resumeFrom = argument("--resume-from") ?? "";
assertDatabaseGuard(apply);

async function main() {
  const prisma = new PrismaClient();
  const report: Array<Record<string, unknown>> = [];
  try {
  for (const target of TARGETS) {
    let tableUpdated = 0;
    for (;;) {
      const nullPredicate = target.pairs.map(({ source, mirror }) => `(${quote(source)} IS NOT NULL AND ${quote(mirror)} IS NULL)`).join(" OR ");
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM ${quote(target.table)} WHERE ${quote(target.companyColumn)} = $1 AND "id" > $2 AND (${nullPredicate}) ORDER BY "id" LIMIT $3`,
        companyId,
        resumeFrom,
        batchSize,
      );
      if (rows.length === 0) break;
      resumeFrom = rows.at(-1)!.id;
      if (dryRun) {
        tableUpdated += rows.length;
      } else {
        const assignments = target.pairs.map(({ source, mirror }) => `${quote(mirror)} = CASE WHEN ${quote(source)} IS NULL THEN NULL ELSE ROUND(${quote(source)}::numeric, 2) END`).join(", ");
        await prisma.$transaction(async (transaction) => {
          for (const row of rows) {
            await transaction.$executeRawUnsafe(
              `UPDATE ${quote(target.table)} SET ${assignments} WHERE "id" = $1 AND ${quote(target.companyColumn)} = $2`,
              row.id,
              companyId,
            );
          }
        });
        tableUpdated += rows.length;
      }
      if (rows.length < batchSize) break;
    }
    report.push({ table: target.table, mode: dryRun ? "dry-run" : "apply", rows: tableUpdated, resumeFrom });
    resumeFrom = "";
  }
    console.log(JSON.stringify({ ok: true, companyId, batchSize, report }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
