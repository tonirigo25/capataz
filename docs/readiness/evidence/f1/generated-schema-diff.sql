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
ALTER TABLE "Document" ADD COLUMN     "extractedTotalDecimal" DECIMAL(18,2),
ADD COLUMN     "storedObjectId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "paidAmountDecimal" DECIMAL(18,2),
ADD COLUMN     "pendingAmountDecimal" DECIMAL(18,2),
ADD COLUMN     "taxableBaseDecimal" DECIMAL(18,2),
ADD COLUMN     "totalDecimal" DECIMAL(18,2),
ADD COLUMN     "vatAmountDecimal" DECIMAL(18,2),
ADD COLUMN     "withholdingAmountDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PurchaseInvoicePayment" ADD COLUMN     "amountDecimal" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "providerCheckoutId" TEXT,
ADD COLUMN     "providerPriceId" TEXT,
ADD COLUMN     "providerProductId" TEXT,
ADD COLUMN     "providerVersion" TEXT;

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "EmailDeliveryAttempt" ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "retryAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "namespace" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "lockedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "externalAccountId" TEXT,
    "config" JSONB,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptedCredential" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "integrationConnectionId" TEXT,
    "purpose" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "initializationVector" TEXT NOT NULL,
    "authenticationTag" TEXT NOT NULL,
    "fingerprint" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncryptedCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "documentType" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "taxableBase" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "previousHash" TEXT,
    "recordHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalTransmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "providerReference" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transmittedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalTransmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalSoftwareDeclaration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "softwareName" TEXT NOT NULL,
    "softwareVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "declarationHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalSoftwareDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoiceArtifact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicInvoiceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoiceDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectronicInvoiceDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoiceStatusEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicInvoiceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "externalCustomerId" TEXT NOT NULL,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPriceMapping" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "planKey" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "externalPriceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPriceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "emailHash" TEXT NOT NULL,
    "emailEncrypted" TEXT,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailWebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "outboxId" TEXT,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "version" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalDocumentVersionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "lawfulBasis" TEXT NOT NULL,
    "dataCategories" JSONB NOT NULL,
    "subjectTypes" JSONB NOT NULL,
    "recipients" JSONB,
    "transferDetails" JSONB,
    "retentionKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "legalHoldDays" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "subjectReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "assignedTo" TEXT,
    "identityVerifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidence" JSONB,
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBreachIncident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "containedAt" TIMESTAMP(3),
    "authorityNotifiedAt" TIMESTAMP(3),
    "subjectsNotifiedAt" TIMESTAMP(3),
    "assessment" JSONB NOT NULL,
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataBreachIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAiPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedPurposes" JSONB NOT NULL,
    "prohibitedData" JSONB NOT NULL,
    "approvedModels" JSONB NOT NULL,
    "dataProfile" TEXT NOT NULL,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAiPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelVersion" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptVersion" (
    "id" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "requestHash" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costAmount" DECIMAL(18,6),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "storeRequested" BOOLEAN NOT NULL DEFAULT false,
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvaluationRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "suiteKey" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metrics" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "actorHash" TEXT,
    "eventName" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDailyMetric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "dimensions" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotCohort" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "goals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotFeedback" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cohortId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT,
    "sentiment" TEXT,
    "content" TEXT NOT NULL,
    "reporterHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalReference" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "incidentKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "mitigatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "postmortemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredObject" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "versionId" TEXT,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "encryption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SCAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadScan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "storedObjectId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineVersion" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureFlag_key_enabled_idx" ON "FeatureFlag"("key", "enabled");

-- CreateIndex
CREATE INDEX "FeatureFlag_companyId_enabled_idx" ON "FeatureFlag"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_companyId_key_key" ON "FeatureFlag"("companyId", "key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_companyId_namespace_idempotencyKey_key" ON "IdempotencyRecord"("companyId", "namespace", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_status_availableAt_idx" ON "WebhookEvent"("provider", "status", "availableAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_companyId_receivedAt_idx" ON "WebhookEvent"("companyId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_companyId_status_idx" ON "IntegrationConnection"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_companyId_provider_key" ON "IntegrationConnection"("companyId", "provider");

-- CreateIndex
CREATE INDEX "EncryptedCredential_integrationConnectionId_idx" ON "EncryptedCredential"("integrationConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedCredential_companyId_purpose_keyVersion_key" ON "EncryptedCredential"("companyId", "purpose", "keyVersion");

-- CreateIndex
CREATE INDEX "FiscalDocument_companyId_status_issueDate_idx" ON "FiscalDocument"("companyId", "status", "issueDate");

-- CreateIndex
CREATE INDEX "FiscalDocument_invoiceId_idx" ON "FiscalDocument"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_companyId_series_number_key" ON "FiscalDocument"("companyId", "series", "number");

-- CreateIndex
CREATE INDEX "FiscalRecord_companyId_occurredAt_idx" ON "FiscalRecord"("companyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalRecord_companyId_sequence_key" ON "FiscalRecord"("companyId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalRecord_fiscalDocumentId_recordHash_key" ON "FiscalRecord"("fiscalDocumentId", "recordHash");

-- CreateIndex
CREATE INDEX "FiscalTransmission_provider_status_availableAt_idx" ON "FiscalTransmission"("provider", "status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalTransmission_companyId_provider_idempotencyKey_key" ON "FiscalTransmission"("companyId", "provider", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FiscalEvent_companyId_eventType_occurredAt_idx" ON "FiscalEvent"("companyId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "FiscalEvent_fiscalDocumentId_occurredAt_idx" ON "FiscalEvent"("fiscalDocumentId", "occurredAt");

-- CreateIndex
CREATE INDEX "FiscalSoftwareDeclaration_companyId_validFrom_validUntil_idx" ON "FiscalSoftwareDeclaration"("companyId", "validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalSoftwareDeclaration_companyId_softwareVersion_declara_key" ON "FiscalSoftwareDeclaration"("companyId", "softwareVersion", "declarationHash");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceArtifact_companyId_status_generatedAt_idx" ON "ElectronicInvoiceArtifact"("companyId", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicInvoiceArtifact_fiscalDocumentId_format_schemaVer_key" ON "ElectronicInvoiceArtifact"("fiscalDocumentId", "format", "schemaVersion");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceDelivery_companyId_status_availableAt_idx" ON "ElectronicInvoiceDelivery"("companyId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceDelivery_artifactId_createdAt_idx" ON "ElectronicInvoiceDelivery"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceStatusEvent_companyId_eventType_occurredAt_idx" ON "ElectronicInvoiceStatusEvent"("companyId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceStatusEvent_artifactId_occurredAt_idx" ON "ElectronicInvoiceStatusEvent"("artifactId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_companyId_key" ON "BillingCustomer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_provider_externalCustomerId_key" ON "BillingCustomer"("provider", "externalCustomerId");

-- CreateIndex
CREATE INDEX "BillingPriceMapping_planKey_active_idx" ON "BillingPriceMapping"("planKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPriceMapping_provider_externalPriceId_key" ON "BillingPriceMapping"("provider", "externalPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPriceMapping_provider_planKey_interval_currency_key" ON "BillingPriceMapping"("provider", "planKey", "interval", "currency");

-- CreateIndex
CREATE INDEX "BillingEvent_companyId_status_createdAt_idx" ON "BillingEvent"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_provider_externalEventId_key" ON "BillingEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "EmailSuppression_emailHash_active_idx" ON "EmailSuppression"("emailHash", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_companyId_emailHash_key" ON "EmailSuppression"("companyId", "emailHash");

-- CreateIndex
CREATE INDEX "EmailWebhookEvent_providerMessageId_occurredAt_idx" ON "EmailWebhookEvent"("providerMessageId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailWebhookEvent_companyId_occurredAt_idx" ON "EmailWebhookEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailWebhookEvent_provider_externalEventId_key" ON "EmailWebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_documentKey_effectiveAt_idx" ON "LegalDocumentVersion"("documentKey", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_documentKey_locale_version_key" ON "LegalDocumentVersion"("documentKey", "locale", "version");

-- CreateIndex
CREATE INDEX "LegalAcceptance_companyId_acceptedAt_idx" ON "LegalAcceptance"("companyId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_userId_legalDocumentVersionId_purpose_key" ON "LegalAcceptance"("userId", "legalDocumentVersionId", "purpose");

-- CreateIndex
CREATE INDEX "ProcessingActivity_companyId_active_idx" ON "ProcessingActivity"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingActivity_companyId_key_key" ON "ProcessingActivity"("companyId", "key");

-- CreateIndex
CREATE INDEX "RetentionPolicy_companyId_enabled_idx" ON "RetentionPolicy"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_companyId_key_key" ON "RetentionPolicy"("companyId", "key");

-- CreateIndex
CREATE INDEX "PrivacyRequest_companyId_status_dueAt_idx" ON "PrivacyRequest"("companyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_companyId_subjectId_purpose_createdAt_idx" ON "ConsentRecord"("companyId", "subjectId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "DataBreachIncident_companyId_status_detectedAt_idx" ON "DataBreachIncident"("companyId", "status", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAiPolicy_companyId_key" ON "CompanyAiPolicy"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AiModelVersion_provider_model_version_key" ON "AiModelVersion"("provider", "model", "version");

-- CreateIndex
CREATE INDEX "AiPromptVersion_promptKey_active_idx" ON "AiPromptVersion"("promptKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptVersion_promptKey_version_key" ON "AiPromptVersion"("promptKey", "version");

-- CreateIndex
CREATE INDEX "AiUsageEvent_companyId_purpose_createdAt_idx" ON "AiUsageEvent"("companyId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AiEvaluationRun_companyId_suiteKey_createdAt_idx" ON "AiEvaluationRun"("companyId", "suiteKey", "createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_companyId_eventName_occurredAt_idx" ON "ProductEvent"("companyId", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "CompanyDailyMetric_metricKey_metricDate_idx" ON "CompanyDailyMetric"("metricKey", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDailyMetric_companyId_metricDate_metricKey_key" ON "CompanyDailyMetric"("companyId", "metricDate", "metricKey");

-- CreateIndex
CREATE INDEX "PilotCohort_status_startsAt_idx" ON "PilotCohort"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotCohort_companyId_cohortKey_key" ON "PilotCohort"("companyId", "cohortKey");

-- CreateIndex
CREATE INDEX "PilotFeedback_companyId_status_createdAt_idx" ON "PilotFeedback"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_companyId_status_priority_createdAt_idx" ON "SupportTicket"("companyId", "status", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_incidentKey_key" ON "Incident"("incidentKey");

-- CreateIndex
CREATE INDEX "Incident_status_severity_startedAt_idx" ON "Incident"("status", "severity", "startedAt");

-- CreateIndex
CREATE INDEX "StoredObject_companyId_status_createdAt_idx" ON "StoredObject"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StoredObject_companyId_sha256_idx" ON "StoredObject"("companyId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "StoredObject_provider_bucket_objectKey_versionId_key" ON "StoredObject"("provider", "bucket", "objectKey", "versionId");

-- CreateIndex
CREATE INDEX "UploadScan_companyId_status_createdAt_idx" ON "UploadScan"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadScan_storedObjectId_engine_key" ON "UploadScan"("storedObjectId", "engine");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storedObjectId_key" ON "Document"("storedObjectId");

-- CreateIndex
CREATE INDEX "EmailDeliveryAttempt_provider_providerMessageId_idx" ON "EmailDeliveryAttempt"("provider", "providerMessageId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedCredential" ADD CONSTRAINT "EncryptedCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedCredential" ADD CONSTRAINT "EncryptedCredential_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRecord" ADD CONSTRAINT "FiscalRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRecord" ADD CONSTRAINT "FiscalRecord_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransmission" ADD CONSTRAINT "FiscalTransmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransmission" ADD CONSTRAINT "FiscalTransmission_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalEvent" ADD CONSTRAINT "FiscalEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalEvent" ADD CONSTRAINT "FiscalEvent_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalSoftwareDeclaration" ADD CONSTRAINT "FiscalSoftwareDeclaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceArtifact" ADD CONSTRAINT "ElectronicInvoiceArtifact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceArtifact" ADD CONSTRAINT "ElectronicInvoiceArtifact_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceDelivery" ADD CONSTRAINT "ElectronicInvoiceDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceDelivery" ADD CONSTRAINT "ElectronicInvoiceDelivery_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ElectronicInvoiceArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceStatusEvent" ADD CONSTRAINT "ElectronicInvoiceStatusEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceStatusEvent" ADD CONSTRAINT "ElectronicInvoiceStatusEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ElectronicInvoiceArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailWebhookEvent" ADD CONSTRAINT "EmailWebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailWebhookEvent" ADD CONSTRAINT "EmailWebhookEvent_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "EmailOutbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_legalDocumentVersionId_fkey" FOREIGN KEY ("legalDocumentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingActivity" ADD CONSTRAINT "ProcessingActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataBreachIncident" ADD CONSTRAINT "DataBreachIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAiPolicy" ADD CONSTRAINT "CompanyAiPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "AiModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AiPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "AiModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AiPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDailyMetric" ADD CONSTRAINT "CompanyDailyMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "PilotCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredObject" ADD CONSTRAINT "StoredObject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadScan" ADD CONSTRAINT "UploadScan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadScan" ADD CONSTRAINT "UploadScan_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
