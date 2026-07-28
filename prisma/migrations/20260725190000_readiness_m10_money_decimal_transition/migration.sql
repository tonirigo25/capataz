-- Orqena readiness M10: additive migration.
-- Preflight and rollback procedure: docs/architecture/MIGRATION_STRATEGY.md.
-- This migration does not delete or rewrite existing business data.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "costePrevistoDecimal" DECIMAL(18,2),
ADD COLUMN     "gastoRealDecimal" DECIMAL(18,2),
ADD COLUMN     "margenEstimadoDecimal" DECIMAL(18,2),
ADD COLUMN     "presupuestoAprobadoDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "descuentoDecimal" DECIMAL(18,2),
ADD COLUMN     "ivaDecimal" DECIMAL(18,2),
ADD COLUMN     "margenEstimadoDecimal" DECIMAL(18,2),
ADD COLUMN     "subtotalDecimal" DECIMAL(18,2),
ADD COLUMN     "totalDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "importeBaseDecimal" DECIMAL(18,2),
ADD COLUMN     "ivaDecimal" DECIMAL(18,2),
ADD COLUMN     "pagadoDecimal" DECIMAL(18,2),
ADD COLUMN     "pendienteDecimal" DECIMAL(18,2),
ADD COLUMN     "totalDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "importeDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "importeDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "currentManualBalanceDecimal" DECIMAL(18,2),
ADD COLUMN     "minimumBalanceDecimal" DECIMAL(18,2),
ADD COLUMN     "openingBalanceDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "amountDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "amountDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "ExpectedCashFlow" ADD COLUMN     "amountDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "TreasurySettings" ADD COLUMN     "minimumCashBalanceDecimal" DECIMAL(18,2),
ADD COLUMN     "safetyBufferDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "extractedTotalDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "paidAmountDecimal" DECIMAL(18,2),
ADD COLUMN     "pendingAmountDecimal" DECIMAL(18,2),
ADD COLUMN     "taxableBaseDecimal" DECIMAL(18,2),
ADD COLUMN     "totalDecimal" DECIMAL(18,2),
ADD COLUMN     "vatAmountDecimal" DECIMAL(18,2),
ADD COLUMN     "withholdingAmountDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PurchaseInvoicePayment" ADD COLUMN     "amountDecimal" DECIMAL(18,2);
