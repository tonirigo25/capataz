-- Additive, nullable correlation fields for request/action/job/webhook tracing.
ALTER TABLE "BusinessEvent"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "jobId" TEXT,
  ADD COLUMN "operation" TEXT,
  ADD COLUMN "release" TEXT,
  ADD COLUMN "environment" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "causationId" TEXT,
  ADD COLUMN "membershipId" TEXT,
  ADD COLUMN "actorType" TEXT,
  ADD COLUMN "jobId" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "operation" TEXT,
  ADD COLUMN "release" TEXT,
  ADD COLUMN "environment" TEXT;

ALTER TABLE "SecurityAuditEvent"
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "causationId" TEXT,
  ADD COLUMN "membershipId" TEXT,
  ADD COLUMN "actorType" TEXT,
  ADD COLUMN "jobId" TEXT,
  ADD COLUMN "operation" TEXT,
  ADD COLUMN "release" TEXT,
  ADD COLUMN "environment" TEXT;

ALTER TABLE "WebhookEvent"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "causationId" TEXT,
  ADD COLUMN "operation" TEXT,
  ADD COLUMN "release" TEXT,
  ADD COLUMN "environment" TEXT;

CREATE INDEX "BusinessEvent_requestId_idx" ON "BusinessEvent"("requestId");
CREATE INDEX "BusinessEvent_jobId_idx" ON "BusinessEvent"("jobId");
CREATE INDEX "AuditLog_correlationId_createdAt_idx" ON "AuditLog"("correlationId", "createdAt");
CREATE INDEX "AuditLog_requestId_createdAt_idx" ON "AuditLog"("requestId", "createdAt");
CREATE INDEX "AuditLog_jobId_createdAt_idx" ON "AuditLog"("jobId", "createdAt");
CREATE INDEX "SecurityAuditEvent_correlationId_createdAt_idx" ON "SecurityAuditEvent"("correlationId", "createdAt");
CREATE INDEX "SecurityAuditEvent_jobId_createdAt_idx" ON "SecurityAuditEvent"("jobId", "createdAt");
CREATE INDEX "WebhookEvent_correlationId_receivedAt_idx" ON "WebhookEvent"("correlationId", "receivedAt");
