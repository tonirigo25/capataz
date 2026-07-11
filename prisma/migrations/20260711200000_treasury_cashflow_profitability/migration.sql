DO $$ BEGIN
  CREATE TYPE "ExpenseCashStatus" AS ENUM ('unknown', 'pending', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CostBehavior" AS ENUM ('unknown', 'fixed', 'variable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialAccountType" AS ENUM ('bank', 'cash', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashMovementType" AS ENUM ('inflow', 'outflow', 'transfer_in', 'transfer_out', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashMovementStatus" AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashMovementSource" AS ENUM ('manual', 'generated', 'adjustment', 'bank_import');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecurringExpenseFrequency" AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpectedCashFlowType" AS ENUM ('expected_inflow', 'expected_outflow');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpectedCashFlowStatus" AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpectedCashFlowSource" AS ENUM ('manual', 'invoice', 'expense', 'recurring', 'budget', 'scenario');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentStatus" "ExpenseCashStatus";
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentDueDate" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "costBehavior" "CostBehavior" NOT NULL DEFAULT 'unknown';

CREATE TABLE IF NOT EXISTS "FinancialAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FinancialAccountType" NOT NULL DEFAULT 'bank',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentManualBalance" DOUBLE PRECISION,
  "manualBalanceUpdatedAt" TIMESTAMP(3),
  "minimumBalance" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CashMovement" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "invoiceId" TEXT,
  "paymentId" TEXT,
  "expenseId" TEXT,
  "workId" TEXT,
  "clientId" TEXT,
  "category" TEXT,
  "provider" TEXT,
  "status" "CashMovementStatus" NOT NULL DEFAULT 'confirmed',
  "source" "CashMovementSource" NOT NULL DEFAULT 'manual',
  "transferGroupId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecurringExpense" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "frequency" "RecurringExpenseFrequency" NOT NULL,
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT,
  "workId" TEXT,
  "provider" TEXT,
  "fixedCost" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpectedCashFlow" (
  "id" TEXT NOT NULL,
  "type" "ExpectedCashFlowType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "probability" DOUBLE PRECISION,
  "confidenceSource" TEXT,
  "invoiceId" TEXT,
  "expenseId" TEXT,
  "recurringExpenseId" TEXT,
  "workId" TEXT,
  "clientId" TEXT,
  "status" "ExpectedCashFlowStatus" NOT NULL DEFAULT 'pending',
  "source" "ExpectedCashFlowSource" NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ExpectedCashFlow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TreasurySettings" (
  "id" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "minimumCashBalance" DOUBLE PRECISION,
  "safetyBuffer" DOUBLE PRECISION,
  "targetCoverageDays" INTEGER,
  "includeEstimatedInflows" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasurySettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinancialAccount_isActive_idx" ON "FinancialAccount"("isActive");
CREATE INDEX IF NOT EXISTS "FinancialAccount_archivedAt_idx" ON "FinancialAccount"("archivedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_paymentId_key" ON "CashMovement"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_expenseId_key" ON "CashMovement"("expenseId");
CREATE INDEX IF NOT EXISTS "CashMovement_accountId_date_idx" ON "CashMovement"("accountId", "date");
CREATE INDEX IF NOT EXISTS "CashMovement_type_idx" ON "CashMovement"("type");
CREATE INDEX IF NOT EXISTS "CashMovement_status_idx" ON "CashMovement"("status");
CREATE INDEX IF NOT EXISTS "CashMovement_source_idx" ON "CashMovement"("source");
CREATE INDEX IF NOT EXISTS "CashMovement_invoiceId_idx" ON "CashMovement"("invoiceId");
CREATE INDEX IF NOT EXISTS "CashMovement_workId_idx" ON "CashMovement"("workId");
CREATE INDEX IF NOT EXISTS "CashMovement_clientId_idx" ON "CashMovement"("clientId");
CREATE INDEX IF NOT EXISTS "CashMovement_transferGroupId_idx" ON "CashMovement"("transferGroupId");
CREATE INDEX IF NOT EXISTS "CashMovement_archivedAt_idx" ON "CashMovement"("archivedAt");

CREATE INDEX IF NOT EXISTS "RecurringExpense_isActive_nextDueDate_idx" ON "RecurringExpense"("isActive", "nextDueDate");
CREATE INDEX IF NOT EXISTS "RecurringExpense_workId_idx" ON "RecurringExpense"("workId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_archivedAt_idx" ON "RecurringExpense"("archivedAt");

CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_expectedDate_idx" ON "ExpectedCashFlow"("expectedDate");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_type_status_idx" ON "ExpectedCashFlow"("type", "status");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_source_idx" ON "ExpectedCashFlow"("source");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_invoiceId_idx" ON "ExpectedCashFlow"("invoiceId");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_expenseId_idx" ON "ExpectedCashFlow"("expenseId");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_workId_idx" ON "ExpectedCashFlow"("workId");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_clientId_idx" ON "ExpectedCashFlow"("clientId");
CREATE INDEX IF NOT EXISTS "ExpectedCashFlow_archivedAt_idx" ON "ExpectedCashFlow"("archivedAt");

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpectedCashFlow" ADD CONSTRAINT "ExpectedCashFlow_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpectedCashFlow" ADD CONSTRAINT "ExpectedCashFlow_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpectedCashFlow" ADD CONSTRAINT "ExpectedCashFlow_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpectedCashFlow" ADD CONSTRAINT "ExpectedCashFlow_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpectedCashFlow" ADD CONSTRAINT "ExpectedCashFlow_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
