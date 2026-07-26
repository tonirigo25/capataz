-- Orqena readiness F3: additive fiscal and electronic-invoice engine controls.
-- Rollback is logical: disable FISCAL_ENGINE_ENABLED and public delivery flags;
-- immutable evidence remains readable. No business row is deleted or rewritten.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "FiscalDocument"
  ADD COLUMN "issuanceKey" TEXT,
  ADD COLUMN "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "withholdingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN "snapshotHash" TEXT,
  ADD COLUMN "qrPayload" TEXT,
  ADD COLUMN "qrVersion" TEXT,
  ADD COLUMN "correctionKind" TEXT,
  ADD COLUMN "correctionReason" TEXT,
  ADD COLUMN "originalFiscalDocumentId" TEXT,
  ADD COLUMN "softwareVersion" TEXT,
  ADD COLUMN "releaseSha" TEXT,
  ADD COLUMN "configurationHash" TEXT,
  ADD COLUMN "legacySource" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retentionUntil" TIMESTAMP(3);

ALTER TABLE "FiscalRecord"
  ADD COLUMN "chainScope" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "canonicalInput" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "algorithm" TEXT NOT NULL DEFAULT 'SHA-256',
  ADD COLUMN "softwareVersion" TEXT,
  ADD COLUMN "releaseSha" TEXT,
  ADD COLUMN "configurationHash" TEXT;

ALTER TABLE "FiscalTransmission"
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "responseHash" TEXT,
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3);

ALTER TABLE "FiscalEvent"
  ADD COLUMN "sequence" BIGINT,
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "eventHash" TEXT,
  ADD COLUMN "releaseSha" TEXT;

ALTER TABLE "FiscalSoftwareDeclaration"
  ADD COLUMN "releaseSha" TEXT,
  ADD COLUMN "configurationHash" TEXT,
  ADD COLUMN "capabilities" JSONB,
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "approvalReference" TEXT,
  ADD COLUMN "signedAt" TIMESTAMP(3);

ALTER TABLE "ElectronicInvoiceArtifact"
  ADD COLUMN "semanticVersion" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "validatorVersion" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "semanticHash" TEXT,
  ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/xml',
  ADD COLUMN "signatureProfile" TEXT,
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "retentionUntil" TIMESTAMP(3);

ALTER TABLE "ElectronicInvoiceDelivery"
  ADD COLUMN "recipientHash" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "providerReference" TEXT,
  ADD COLUMN "responseHash" TEXT;

ALTER TABLE "ElectronicInvoiceStatusEvent"
  ADD COLUMN "sequence" INTEGER,
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "eventHash" TEXT;

CREATE UNIQUE INDEX "FiscalDocument_companyId_issuanceKey_key"
  ON "FiscalDocument"("companyId", "issuanceKey");
CREATE INDEX "FiscalDocument_companyId_documentType_series_issueDate_idx"
  ON "FiscalDocument"("companyId", "documentType", "series", "issueDate");
CREATE INDEX "FiscalDocument_originalFiscalDocumentId_idx"
  ON "FiscalDocument"("originalFiscalDocumentId");
CREATE INDEX "FiscalRecord_companyId_chainScope_sequence_idx"
  ON "FiscalRecord"("companyId", "chainScope", "sequence");
CREATE UNIQUE INDEX "FiscalEvent_companyId_sequence_key"
  ON "FiscalEvent"("companyId", "sequence");
CREATE UNIQUE INDEX "ElectronicInvoiceDelivery_companyId_channel_idempotencyKey_key"
  ON "ElectronicInvoiceDelivery"("companyId", "channel", "idempotencyKey");
CREATE UNIQUE INDEX "ElectronicInvoiceStatusEvent_artifactId_sequence_key"
  ON "ElectronicInvoiceStatusEvent"("artifactId", "sequence");

ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_originalFiscalDocumentId_fkey"
  FOREIGN KEY ("originalFiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION reject_fiscal_append_only_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'FISCAL_APPEND_ONLY_VIOLATION:%', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FiscalRecord_append_only"
  BEFORE UPDATE OR DELETE ON "FiscalRecord"
  FOR EACH ROW EXECUTE FUNCTION reject_fiscal_append_only_change();
CREATE TRIGGER "FiscalEvent_append_only"
  BEFORE UPDATE OR DELETE ON "FiscalEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_fiscal_append_only_change();
CREATE TRIGGER "FiscalSoftwareDeclaration_append_only"
  BEFORE UPDATE OR DELETE ON "FiscalSoftwareDeclaration"
  FOR EACH ROW EXECUTE FUNCTION reject_fiscal_append_only_change();
CREATE TRIGGER "ElectronicInvoiceStatusEvent_append_only"
  BEFORE UPDATE OR DELETE ON "ElectronicInvoiceStatusEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_fiscal_append_only_change();

CREATE FUNCTION protect_fiscal_document_identity() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'FISCAL_DOCUMENT_DELETE_FORBIDDEN' USING ERRCODE = '55000';
  END IF;
  IF OLD."companyId" IS DISTINCT FROM NEW."companyId"
    OR OLD."invoiceId" IS DISTINCT FROM NEW."invoiceId"
    OR OLD."issuanceKey" IS DISTINCT FROM NEW."issuanceKey"
    OR OLD."documentType" IS DISTINCT FROM NEW."documentType"
    OR OLD."series" IS DISTINCT FROM NEW."series"
    OR OLD."number" IS DISTINCT FROM NEW."number"
    OR OLD."issueDate" IS DISTINCT FROM NEW."issueDate"
    OR OLD."currency" IS DISTINCT FROM NEW."currency"
    OR OLD."taxableBase" IS DISTINCT FROM NEW."taxableBase"
    OR OLD."discountAmount" IS DISTINCT FROM NEW."discountAmount"
    OR OLD."taxAmount" IS DISTINCT FROM NEW."taxAmount"
    OR OLD."withholdingAmount" IS DISTINCT FROM NEW."withholdingAmount"
    OR OLD."total" IS DISTINCT FROM NEW."total"
    OR OLD."mode" IS DISTINCT FROM NEW."mode"
    OR OLD."schemaVersion" IS DISTINCT FROM NEW."schemaVersion"
    OR OLD."sourceSnapshot" IS DISTINCT FROM NEW."sourceSnapshot"
    OR OLD."snapshotHash" IS DISTINCT FROM NEW."snapshotHash"
    OR OLD."qrPayload" IS DISTINCT FROM NEW."qrPayload"
    OR OLD."qrVersion" IS DISTINCT FROM NEW."qrVersion"
    OR OLD."correctionKind" IS DISTINCT FROM NEW."correctionKind"
    OR OLD."correctionReason" IS DISTINCT FROM NEW."correctionReason"
    OR OLD."originalFiscalDocumentId" IS DISTINCT FROM NEW."originalFiscalDocumentId"
    OR OLD."softwareVersion" IS DISTINCT FROM NEW."softwareVersion"
    OR OLD."releaseSha" IS DISTINCT FROM NEW."releaseSha"
    OR OLD."configurationHash" IS DISTINCT FROM NEW."configurationHash"
    OR OLD."legacySource" IS DISTINCT FROM NEW."legacySource"
    OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt" THEN
    RAISE EXCEPTION 'FISCAL_DOCUMENT_IMMUTABLE_FIELDS' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FiscalDocument_immutable_identity"
  BEFORE UPDATE OR DELETE ON "FiscalDocument"
  FOR EACH ROW EXECUTE FUNCTION protect_fiscal_document_identity();

CREATE FUNCTION protect_einvoice_artifact_identity() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'EINVOICE_ARTIFACT_DELETE_FORBIDDEN' USING ERRCODE = '55000';
  END IF;
  IF OLD."companyId" IS DISTINCT FROM NEW."companyId"
    OR OLD."fiscalDocumentId" IS DISTINCT FROM NEW."fiscalDocumentId"
    OR OLD."format" IS DISTINCT FROM NEW."format"
    OR OLD."schemaVersion" IS DISTINCT FROM NEW."schemaVersion"
    OR OLD."semanticVersion" IS DISTINCT FROM NEW."semanticVersion"
    OR OLD."validatorVersion" IS DISTINCT FROM NEW."validatorVersion"
    OR OLD."contentHash" IS DISTINCT FROM NEW."contentHash"
    OR OLD."semanticHash" IS DISTINCT FROM NEW."semanticHash"
    OR OLD."storageKey" IS DISTINCT FROM NEW."storageKey"
    OR OLD."mimeType" IS DISTINCT FROM NEW."mimeType"
    OR OLD."signatureProfile" IS DISTINCT FROM NEW."signatureProfile"
    OR OLD."signedAt" IS DISTINCT FROM NEW."signedAt" THEN
    RAISE EXCEPTION 'EINVOICE_ARTIFACT_IMMUTABLE_FIELDS' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ElectronicInvoiceArtifact_immutable_identity"
  BEFORE UPDATE OR DELETE ON "ElectronicInvoiceArtifact"
  FOR EACH ROW EXECUTE FUNCTION protect_einvoice_artifact_identity();
