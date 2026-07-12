-- Additive compatibility layer: Company becomes the source for fiscal identity,
-- branding and number-series settings before legacy reads are removed.
ALTER TABLE "Company"
  ADD COLUMN "web" TEXT,
  ADD COLUMN "contactPerson" TEXT,
  ADD COLUMN "iban" TEXT,
  ADD COLUMN "defaultConditions" TEXT,
  ADD COLUMN "legalText" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "sealUrl" TEXT,
  ADD COLUMN "brandColor" TEXT NOT NULL DEFAULT '#f6c945',
  ADD COLUMN "defaultVat" DOUBLE PRECISION NOT NULL DEFAULT 21,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN "budgetValidityDays" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "defaultPaymentTerms" TEXT,
  ADD COLUMN "budgetSeries" TEXT NOT NULL DEFAULT '2026',
  ADD COLUMN "invoiceSeries" TEXT NOT NULL DEFAULT '2026',
  ADD COLUMN "workSeries" TEXT NOT NULL DEFAULT '2026',
  ADD COLUMN "budgetPrefix" TEXT NOT NULL DEFAULT 'P',
  ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'F',
  ADD COLUMN "workPrefix" TEXT NOT NULL DEFAULT 'OB';

ALTER TABLE "TreasurySettings" ADD COLUMN "companyId" TEXT;
ALTER TABLE "TreasurySettings" ADD CONSTRAINT "TreasurySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TreasurySettings_companyId_idx" ON "TreasurySettings"("companyId");

UPDATE "Company" c SET
  "web" = e."web", "contactPerson" = e."personaContacto", "iban" = e."iban",
  "defaultConditions" = e."condicionesPorDefecto", "legalText" = e."textoLegal",
  "logoUrl" = e."logoUrl", "sealUrl" = e."selloUrl",
  "brandColor" = COALESCE(e."colorMarca", c."brandColor"), "defaultVat" = COALESCE(e."ivaDefecto", c."defaultVat"),
  "currency" = COALESCE(e."moneda", c."currency"), "budgetValidityDays" = COALESCE(e."validezPresupuestoDias", c."budgetValidityDays"),
  "defaultPaymentTerms" = e."formaPagoDefecto", "budgetSeries" = COALESCE(e."seriePresupuestos", c."budgetSeries"),
  "invoiceSeries" = COALESCE(e."serieFacturas", c."invoiceSeries"), "workSeries" = COALESCE(e."serieObras", c."workSeries"),
  "budgetPrefix" = COALESCE(e."prefijoPresupuesto", c."budgetPrefix"), "invoicePrefix" = COALESCE(e."prefijoFactura", c."invoicePrefix"),
  "workPrefix" = COALESCE(e."prefijoObra", c."workPrefix")
FROM "Empresa" e WHERE c."legacyEmpresaId" = e."id";
