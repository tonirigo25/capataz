-- Reserve document numbers transactionally per company and configured prefix/series.
-- This is additive: existing documents and their unique indexes are not rewritten.
CREATE TABLE "CompanyDocumentSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDocumentSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyDocumentSequence_companyId_type_scope_key"
ON "CompanyDocumentSequence"("companyId", "type", "scope");

CREATE INDEX "CompanyDocumentSequence_companyId_idx"
ON "CompanyDocumentSequence"("companyId");

ALTER TABLE "CompanyDocumentSequence"
ADD CONSTRAINT "CompanyDocumentSequence_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
