CREATE TYPE "BusinessPartnerKind" AS ENUM ('SUPPLIER', 'SUBCONTRACTOR');
CREATE TYPE "BusinessPartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "BusinessPartnerLegalType" AS ENUM ('SELF_EMPLOYED', 'COMPANY');
CREATE TYPE "PartnerDocumentStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED', 'INCOMPLETE', 'NOT_REQUIRED');
CREATE TYPE "PurchaseInvoiceKind" AS ENUM ('SUPPLIER', 'SUBCONTRACTOR');
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "FiscalDocumentType" AS ENUM ('FULL_INVOICE', 'SIMPLIFIED_INVOICE', 'CORRECTIVE_INVOICE');

ALTER TYPE "ExpenseCategory" ADD VALUE 'materiales';
ALTER TYPE "ExpenseCategory" ADD VALUE 'transportes';
ALTER TYPE "ExpenseCategory" ADD VALUE 'herramientas';
ALTER TYPE "ExpenseCategory" ADD VALUE 'combustible';
ALTER TYPE "ExpenseCategory" ADD VALUE 'restauracion';
ALTER TYPE "ExpenseCategory" ADD VALUE 'maquinaria';
ALTER TYPE "ExpenseCategory" ADD VALUE 'servicios';
ALTER TYPE "ExpenseCategory" ADD VALUE 'suministros';

ALTER TYPE "ExpenseDocumentStatus" ADD VALUE 'AWAITING_PARTNER';
ALTER TYPE "ExpenseDocumentStatus" ADD VALUE 'AWAITING_WORK';
ALTER TYPE "ExpenseDocumentStatus" ADD VALUE 'POSSIBLE_DUPLICATE';
ALTER TYPE "ExpenseDocumentStatus" ADD VALUE 'REGISTERED';
ALTER TYPE "ExpenseDocumentStatus" ADD VALUE 'ARCHIVED';

ALTER TYPE "ExpenseDocumentType" ADD VALUE 'TOOL_INVOICE';
ALTER TYPE "ExpenseDocumentType" ADD VALUE 'MACHINERY_INVOICE';
ALTER TYPE "ExpenseDocumentType" ADD VALUE 'TRANSPORT_INVOICE';
ALTER TYPE "ExpenseDocumentType" ADD VALUE 'SERVICE_INVOICE';
ALTER TYPE "ExpenseDocumentType" ADD VALUE 'SUPPLY_INVOICE';

CREATE TABLE "BusinessPartner" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" "BusinessPartnerKind" NOT NULL,
  "status" "BusinessPartnerStatus" NOT NULL DEFAULT 'ACTIVE',
  "commercialName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "taxId" TEXT,
  "address" TEXT,
  "city" TEXT,
  "province" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'España',
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "contactPerson" TEXT,
  "notes" TEXT,
  "internalNotes" TEXT,
  "paymentTerms" TEXT,
  "paymentDueDays" INTEGER NOT NULL DEFAULT 30,
  "preferredPaymentMethod" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tradeType" TEXT,
  "specialty" TEXT,
  "liabilityInsurance" TEXT,
  "documentExpiresAt" TIMESTAMP(3),
  "legalType" "BusinessPartnerLegalType",
  "internalRating" INTEGER,
  "documentStatus" "PartnerDocumentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "BusinessPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessPartnerHistory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "businessPartnerId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "metadata" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessPartnerHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessPartnerWork" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "businessPartnerId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessPartnerWork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "businessPartnerId" TEXT NOT NULL,
  "workId" TEXT,
  "kind" "PurchaseInvoiceKind" NOT NULL,
  "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "fiscalType" "FiscalDocumentType" NOT NULL DEFAULT 'FULL_INVOICE',
  "invoiceNumber" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "taxableBase" DOUBLE PRECISION NOT NULL,
  "vatRate" DOUBLE PRECISION,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "withholdingRate" DOUBLE PRECISION,
  "withholdingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingAmount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "paymentMethod" TEXT,
  "description" TEXT NOT NULL,
  "workDescription" TEXT,
  "certifications" JSONB,
  "notes" TEXT,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseInvoicePayment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "purchaseInvoiceId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseInvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseInvoiceHistory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "purchaseInvoiceId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "metadata" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseInvoiceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerLearning" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "businessPartnerId" TEXT NOT NULL,
  "preferredCategory" "ExpenseCategory",
  "preferredWorkId" TEXT,
  "preferredVatRate" DOUBLE PRECISION,
  "categoryConfirmations" INTEGER NOT NULL DEFAULT 0,
  "workConfirmations" INTEGER NOT NULL DEFAULT 0,
  "vatConfirmations" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerLearning_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "businessPartnerId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "purchaseInvoiceId" TEXT;
ALTER TABLE "Document" ADD COLUMN "businessPartnerId" TEXT;
ALTER TABLE "Document" ADD COLUMN "purchaseInvoiceId" TEXT;

CREATE UNIQUE INDEX "BusinessPartner_companyId_kind_taxId_key" ON "BusinessPartner"("companyId", "kind", "taxId");
CREATE INDEX "BusinessPartner_companyId_kind_status_idx" ON "BusinessPartner"("companyId", "kind", "status");
CREATE INDEX "BusinessPartner_companyId_commercialName_idx" ON "BusinessPartner"("companyId", "commercialName");
CREATE INDEX "BusinessPartner_companyId_legalName_idx" ON "BusinessPartner"("companyId", "legalName");
CREATE INDEX "BusinessPartner_companyId_archivedAt_idx" ON "BusinessPartner"("companyId", "archivedAt");
CREATE INDEX "BusinessPartnerHistory_companyId_businessPartnerId_createdAt_idx" ON "BusinessPartnerHistory"("companyId", "businessPartnerId", "createdAt");
CREATE UNIQUE INDEX "BusinessPartnerWork_businessPartnerId_workId_key" ON "BusinessPartnerWork"("businessPartnerId", "workId");
CREATE INDEX "BusinessPartnerWork_companyId_workId_idx" ON "BusinessPartnerWork"("companyId", "workId");
CREATE UNIQUE INDEX "PurchaseInvoice_companyId_businessPartnerId_invoiceNumber_key" ON "PurchaseInvoice"("companyId", "businessPartnerId", "invoiceNumber");
CREATE INDEX "PurchaseInvoice_companyId_kind_status_idx" ON "PurchaseInvoice"("companyId", "kind", "status");
CREATE INDEX "PurchaseInvoice_companyId_dueDate_idx" ON "PurchaseInvoice"("companyId", "dueDate");
CREATE INDEX "PurchaseInvoice_companyId_workId_idx" ON "PurchaseInvoice"("companyId", "workId");
CREATE INDEX "PurchaseInvoicePayment_companyId_purchaseInvoiceId_paidAt_idx" ON "PurchaseInvoicePayment"("companyId", "purchaseInvoiceId", "paidAt");
CREATE INDEX "PurchaseInvoiceHistory_companyId_purchaseInvoiceId_createdAt_idx" ON "PurchaseInvoiceHistory"("companyId", "purchaseInvoiceId", "createdAt");
CREATE UNIQUE INDEX "PartnerLearning_businessPartnerId_key" ON "PartnerLearning"("businessPartnerId");
CREATE INDEX "PartnerLearning_companyId_preferredCategory_idx" ON "PartnerLearning"("companyId", "preferredCategory");
CREATE INDEX "PartnerLearning_companyId_preferredWorkId_idx" ON "PartnerLearning"("companyId", "preferredWorkId");
CREATE UNIQUE INDEX "Expense_purchaseInvoiceId_key" ON "Expense"("purchaseInvoiceId");
CREATE INDEX "Expense_businessPartnerId_idx" ON "Expense"("businessPartnerId");
CREATE INDEX "Document_businessPartnerId_idx" ON "Document"("businessPartnerId");
CREATE INDEX "Document_purchaseInvoiceId_idx" ON "Document"("purchaseInvoiceId");

ALTER TABLE "BusinessPartner" ADD CONSTRAINT "BusinessPartner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessPartnerHistory" ADD CONSTRAINT "BusinessPartnerHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessPartnerHistory" ADD CONSTRAINT "BusinessPartnerHistory_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "BusinessPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessPartnerWork" ADD CONSTRAINT "BusinessPartnerWork_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessPartnerWork" ADD CONSTRAINT "BusinessPartnerWork_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "BusinessPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessPartnerWork" ADD CONSTRAINT "BusinessPartnerWork_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "BusinessPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoiceHistory" ADD CONSTRAINT "PurchaseInvoiceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseInvoiceHistory" ADD CONSTRAINT "PurchaseInvoiceHistory_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerLearning" ADD CONSTRAINT "PartnerLearning_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerLearning" ADD CONSTRAINT "PartnerLearning_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "BusinessPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerLearning" ADD CONSTRAINT "PartnerLearning_preferredWorkId_fkey" FOREIGN KEY ("preferredWorkId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "BusinessPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "BusinessPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
