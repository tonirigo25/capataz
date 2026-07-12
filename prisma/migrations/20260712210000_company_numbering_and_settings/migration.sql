-- This migration intentionally replaces global document-number uniqueness with
-- tenant uniqueness. It aborts before any DROP if ownership/backfill or existing
-- data would make the change unsafe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Work" WHERE "companyId" IS NULL AND ("codigo" IS NOT NULL OR "numeroInterno" IS NOT NULL))
     OR EXISTS (SELECT 1 FROM "Budget" WHERE "companyId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Invoice" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'company numbering migration requires completed companyId backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM "Budget" GROUP BY "companyId", "numero" HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "Invoice" GROUP BY "companyId", "numero" HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "Work" WHERE "codigo" IS NOT NULL GROUP BY "companyId", "codigo" HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "Work" WHERE "numeroInterno" IS NOT NULL GROUP BY "companyId", "numeroInterno" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate document numbers exist inside a company';
  END IF;
END $$;

DROP INDEX "Work_numeroInterno_key";
DROP INDEX "Work_codigo_key";
DROP INDEX "Budget_numero_key";
DROP INDEX "Invoice_numero_key";
CREATE UNIQUE INDEX "Work_companyId_numeroInterno_key" ON "Work"("companyId", "numeroInterno");
CREATE UNIQUE INDEX "Work_companyId_codigo_key" ON "Work"("companyId", "codigo");
CREATE UNIQUE INDEX "Budget_companyId_numero_key" ON "Budget"("companyId", "numero");
CREATE UNIQUE INDEX "Invoice_companyId_numero_key" ON "Invoice"("companyId", "numero");
