import { PrismaClient } from "@prisma/client";

const targets = [
  ["Work", "presupuestoAprobado", "presupuestoAprobadoDecimal"],
  ["Work", "costePrevisto", "costePrevistoDecimal"],
  ["Work", "gastoReal", "gastoRealDecimal"],
  ["Work", "margenEstimado", "margenEstimadoDecimal"],
  ["Budget", "subtotal", "subtotalDecimal"], ["Budget", "iva", "ivaDecimal"],
  ["Budget", "descuento", "descuentoDecimal"], ["Budget", "total", "totalDecimal"],
  ["Budget", "margenEstimado", "margenEstimadoDecimal"],
  ["Invoice", "importeBase", "importeBaseDecimal"], ["Invoice", "iva", "ivaDecimal"],
  ["Invoice", "total", "totalDecimal"], ["Invoice", "pagado", "pagadoDecimal"],
  ["Invoice", "pendiente", "pendienteDecimal"], ["Payment", "importe", "importeDecimal"],
  ["Expense", "importe", "importeDecimal"], ["FinancialAccount", "openingBalance", "openingBalanceDecimal"],
  ["FinancialAccount", "currentManualBalance", "currentManualBalanceDecimal"],
  ["FinancialAccount", "minimumBalance", "minimumBalanceDecimal"],
  ["CashMovement", "amount", "amountDecimal"], ["RecurringExpense", "amount", "amountDecimal"],
  ["ExpectedCashFlow", "amount", "amountDecimal"],
  ["TreasurySettings", "minimumCashBalance", "minimumCashBalanceDecimal"],
  ["TreasurySettings", "safetyBuffer", "safetyBufferDecimal"],
  ["Document", "extractedTotal", "extractedTotalDecimal"],
  ["PurchaseInvoice", "taxableBase", "taxableBaseDecimal"], ["PurchaseInvoice", "vatAmount", "vatAmountDecimal"],
  ["PurchaseInvoice", "withholdingAmount", "withholdingAmountDecimal"], ["PurchaseInvoice", "total", "totalDecimal"],
  ["PurchaseInvoice", "paidAmount", "paidAmountDecimal"], ["PurchaseInvoice", "pendingAmount", "pendingAmountDecimal"],
  ["PurchaseInvoicePayment", "amount", "amountDecimal"],
] as const;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const companyId = argument("--company-id");
if (!companyId) throw new Error("--company-id is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
async function main() {
  const prisma = new PrismaClient();
  const results = [];
  let reconciled = true;
  try {
  for (const [table, source, mirror] of targets) {
    const [row] = await prisma.$queryRawUnsafe<Array<Record<string, bigint | string | null>>>(
      `SELECT COUNT(*) FILTER (WHERE "${source}" IS NOT NULL)::bigint AS "sourceRows", COUNT("${mirror}")::bigint AS "mirrorRows", COALESCE(SUM(ROUND("${source}"::numeric, 2)), 0)::text AS "sourceTotal", COALESCE(SUM("${mirror}"), 0)::text AS "mirrorTotal", COALESCE(SUM(ABS(ROUND("${source}"::numeric, 2) - "${mirror}")) FILTER (WHERE "${mirror}" IS NOT NULL), 0)::text AS "absoluteDifference" FROM "${table}" WHERE "companyId" = $1`,
      companyId,
    );
    const item = {
      table,
      source,
      mirror,
      sourceRows: Number(row.sourceRows),
      mirrorRows: Number(row.mirrorRows),
      sourceTotal: String(row.sourceTotal),
      mirrorTotal: String(row.mirrorTotal),
      absoluteDifference: String(row.absoluteDifference),
    };
    if (item.sourceRows !== item.mirrorRows || Number(item.absoluteDifference) !== 0) reconciled = false;
    results.push(item);
  }
    console.log(JSON.stringify({ ok: true, reconciled, companyId, results }, null, 2));
    if (!reconciled) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
