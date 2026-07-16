-- Additive foundation for protected expense-document ingestion and review.
CREATE TYPE "ExpenseDocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'REVIEW_REQUIRED', 'READY', 'SAVED', 'FAILED', 'CANCELLED');
CREATE TYPE "DocumentExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'NOT_CONFIGURED', 'FAILED');
CREATE TYPE "ExpenseDocumentType" AS ENUM ('MATERIAL_INVOICE', 'FUEL_RECEIPT', 'MEAL_RECEIPT', 'SUBCONTRACTOR_INVOICE', 'GENERAL_EXPENSE', 'UNKNOWN');

ALTER TABLE "Expense" ALTER COLUMN "obraId" DROP NOT NULL;
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_obraId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "status" "ExpenseDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "documentType" "ExpenseDocumentType",
  ADD COLUMN "extractionStatus" "DocumentExtractionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "extractionConfidence" DOUBLE PRECISION,
  ADD COLUMN "extractedData" JSONB,
  ADD COLUMN "extractionError" TEXT,
  ADD COLUMN "extractedIssuer" TEXT,
  ADD COLUMN "extractedIssuerTaxId" TEXT,
  ADD COLUMN "extractedInvoiceNo" TEXT,
  ADD COLUMN "extractedIssueDate" TIMESTAMP(3),
  ADD COLUMN "extractedTotal" DOUBLE PRECISION,
  ADD COLUMN "processedAt" TIMESTAMP(3);

ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_expenseId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DO $$
BEGIN
  IF to_regclass('"User"') IS NOT NULL THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Document' AND column_name = 'companyId') THEN
    CREATE INDEX "Document_companyId_status_idx" ON "Document"("companyId", "status");
    CREATE INDEX "Document_companyId_sha256_idx" ON "Document"("companyId", "sha256");
    CREATE INDEX "Document_companyId_extractedInvoiceNo_extractedIssuerTaxId_idx" ON "Document"("companyId", "extractedInvoiceNo", "extractedIssuerTaxId");
  END IF;
END $$;
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");
