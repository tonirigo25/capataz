-- CreateEnum
CREATE TYPE "AutomationDefinitionStatus" AS ENUM ('draft', 'active', 'paused', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "AutomationVersionStatus" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('queued', 'running', 'waiting_confirmation', 'completed', 'partial', 'failed', 'skipped', 'cancelled', 'duplicate');

-- CreateEnum
CREATE TYPE "AutomationStepStatus" AS ENUM ('pending', 'running', 'waiting_confirmation', 'completed', 'failed', 'skipped', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('inbox', 'planned', 'in_progress', 'blocked', 'waiting', 'completed', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('planned', 'due', 'in_progress', 'waiting_response', 'promised', 'completed', 'unsuccessful', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "FollowUpPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- AlterTable
ALTER TABLE "EventoAgenda" ADD COLUMN     "followUpId" TEXT,
ADD COLUMN     "taskId" TEXT;

-- CreateTable
CREATE TABLE "AutomationDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" "AutomationDefinitionStatus" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "responsibleId" TEXT,
    "companyId" TEXT,
    "currentVersionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationVersion" (
    "id" TEXT NOT NULL,
    "automationDefinitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AutomationVersionStatus" NOT NULL DEFAULT 'draft',
    "triggerMode" TEXT NOT NULL DEFAULT 'manual',
    "cooldownSeconds" INTEGER,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 60,
    "retryPolicy" JSONB NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmationMode" TEXT NOT NULL DEFAULT 'per_action',
    "deduplicationStrategy" TEXT NOT NULL DEFAULT 'occurrence',
    "definitionHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTrigger" (
    "id" TEXT NOT NULL,
    "automationVersionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventType" TEXT,
    "scheduleId" TEXT,
    "entityType" TEXT,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationCondition" (
    "id" TEXT NOT NULL,
    "automationVersionId" TEXT NOT NULL,
    "group" INTEGER NOT NULL DEFAULT 0,
    "operator" TEXT NOT NULL DEFAULT 'and',
    "field" TEXT NOT NULL,
    "comparator" TEXT NOT NULL,
    "value" JSONB,
    "valueType" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "automationVersionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmationMode" TEXT NOT NULL DEFAULT 'per_action',
    "onFailure" TEXT NOT NULL DEFAULT 'stop',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationSchedule" (
    "id" TEXT NOT NULL,
    "automationDefinitionId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "rrule" TEXT,
    "cronExpression" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "lockUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "automationDefinitionId" TEXT NOT NULL,
    "automationVersionId" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'queued',
    "triggerType" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggerEntityType" TEXT,
    "triggerEntityId" TEXT,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "deduplicationKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "inputSnapshot" JSONB,
    "outputSummary" JSONB,
    "errorCode" TEXT,
    "errorSummary" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "lockUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationStepRun" (
    "id" TEXT NOT NULL,
    "automationRunId" TEXT NOT NULL,
    "automationActionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "AutomationStepStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "inputSummary" JSONB,
    "outputSummary" JSONB,
    "errorCode" TEXT,
    "errorSummary" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "companyId" TEXT,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relatedEntities" JSONB,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "payloadSanitized" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BusinessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'inbox',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "assigneeId" TEXT,
    "companyId" TEXT,
    "clientId" TEXT,
    "workId" TEXT,
    "budgetId" TEXT,
    "invoiceId" TEXT,
    "documentId" TEXT,
    "recommendationId" TEXT,
    "signalId" TEXT,
    "automationRunId" TEXT,
    "startsAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "blockedReason" TEXT,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'responsible',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'finish_to_start',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStatusHistory" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "previousStatus" "TaskStatus",
    "newStatus" "TaskStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEntityLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'related',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEntityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRecurrence" (
    "id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "rrule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "nextOccurrenceAt" TIMESTAMP(3),
    "generationWindowDays" INTEGER NOT NULL DEFAULT 45,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'planned',
    "priority" "FollowUpPriority" NOT NULL DEFAULT 'medium',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "companyId" TEXT,
    "createdById" TEXT,
    "responsibleId" TEXT,
    "clientId" TEXT,
    "contactId" TEXT,
    "workId" TEXT,
    "budgetId" TEXT,
    "invoiceId" TEXT,
    "recommendationId" TEXT,
    "signalId" TEXT,
    "automationRunId" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "expectedOutcome" TEXT,
    "resultSummary" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpAttempt" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "responsibleId" TEXT,
    "summary" TEXT,
    "response" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpOutcome" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "FollowUpOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationDefinition_currentVersionId_key" ON "AutomationDefinition"("currentVersionId");

-- CreateIndex
CREATE INDEX "AutomationDefinition_status_active_idx" ON "AutomationDefinition"("status", "active");

-- CreateIndex
CREATE INDEX "AutomationVersion_status_idx" ON "AutomationVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationVersion_automationDefinitionId_version_key" ON "AutomationVersion"("automationDefinitionId", "version");

-- CreateIndex
CREATE INDEX "AutomationTrigger_automationVersionId_type_idx" ON "AutomationTrigger"("automationVersionId", "type");

-- CreateIndex
CREATE INDEX "AutomationTrigger_eventType_idx" ON "AutomationTrigger"("eventType");

-- CreateIndex
CREATE INDEX "AutomationCondition_automationVersionId_group_order_idx" ON "AutomationCondition"("automationVersionId", "group", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAction_automationVersionId_order_key" ON "AutomationAction"("automationVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSchedule_automationDefinitionId_key" ON "AutomationSchedule"("automationDefinitionId");

-- CreateIndex
CREATE INDEX "AutomationSchedule_active_nextRunAt_idx" ON "AutomationSchedule"("active", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_idempotencyKey_key" ON "AutomationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationRun_status_startedAt_idx" ON "AutomationRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationRun_automationDefinitionId_startedAt_idx" ON "AutomationRun"("automationDefinitionId", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationRun_deduplicationKey_idx" ON "AutomationRun"("deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationStepRun_idempotencyKey_key" ON "AutomationStepRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationStepRun_automationRunId_order_idx" ON "AutomationStepRun"("automationRunId", "order");

-- CreateIndex
CREATE INDEX "BusinessEvent_type_occurredAt_idx" ON "BusinessEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "BusinessEvent_entityType_entityId_idx" ON "BusinessEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BusinessEvent_correlationId_idx" ON "BusinessEvent"("correlationId");

-- CreateIndex
CREATE INDEX "Task_status_dueAt_idx" ON "Task"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_dueAt_idx" ON "Task"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_clientId_status_idx" ON "Task"("clientId", "status");

-- CreateIndex
CREATE INDEX "Task_workId_status_idx" ON "Task"("workId", "status");

-- CreateIndex
CREATE INDEX "Task_recurrenceId_idx" ON "Task"("recurrenceId");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_removedAt_idx" ON "TaskAssignment"("taskId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "TaskDependency"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_taskId_createdAt_idx" ON "TaskStatusHistory"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEntityLink_taskId_entityType_entityId_relation_key" ON "TaskEntityLink"("taskId", "entityType", "entityId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "TaskChecklistItem_taskId_order_key" ON "TaskChecklistItem"("taskId", "order");

-- CreateIndex
CREATE INDEX "TaskRecurrence_active_nextOccurrenceAt_idx" ON "TaskRecurrence"("active", "nextOccurrenceAt");

-- CreateIndex
CREATE INDEX "FollowUp_status_nextActionAt_idx" ON "FollowUp"("status", "nextActionAt");

-- CreateIndex
CREATE INDEX "FollowUp_clientId_status_idx" ON "FollowUp"("clientId", "status");

-- CreateIndex
CREATE INDEX "FollowUp_invoiceId_status_idx" ON "FollowUp"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "FollowUp_budgetId_status_idx" ON "FollowUp"("budgetId", "status");

-- CreateIndex
CREATE INDEX "FollowUpAttempt_followUpId_attemptedAt_idx" ON "FollowUpAttempt"("followUpId", "attemptedAt");

-- CreateIndex
CREATE INDEX "FollowUpOutcome_followUpId_recordedAt_idx" ON "FollowUpOutcome"("followUpId", "recordedAt");

-- CreateIndex
CREATE INDEX "EventoAgenda_taskId_idx" ON "EventoAgenda"("taskId");

-- CreateIndex
CREATE INDEX "EventoAgenda_followUpId_idx" ON "EventoAgenda"("followUpId");

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationDefinition" ADD CONSTRAINT "AutomationDefinition_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AutomationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationVersion" ADD CONSTRAINT "AutomationVersion_automationDefinitionId_fkey" FOREIGN KEY ("automationDefinitionId") REFERENCES "AutomationDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTrigger" ADD CONSTRAINT "AutomationTrigger_automationVersionId_fkey" FOREIGN KEY ("automationVersionId") REFERENCES "AutomationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationCondition" ADD CONSTRAINT "AutomationCondition_automationVersionId_fkey" FOREIGN KEY ("automationVersionId") REFERENCES "AutomationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_automationVersionId_fkey" FOREIGN KEY ("automationVersionId") REFERENCES "AutomationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSchedule" ADD CONSTRAINT "AutomationSchedule_automationDefinitionId_fkey" FOREIGN KEY ("automationDefinitionId") REFERENCES "AutomationDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationDefinitionId_fkey" FOREIGN KEY ("automationDefinitionId") REFERENCES "AutomationDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationVersionId_fkey" FOREIGN KEY ("automationVersionId") REFERENCES "AutomationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationStepRun" ADD CONSTRAINT "AutomationStepRun_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationStepRun" ADD CONSTRAINT "AutomationStepRun_automationActionId_fkey" FOREIGN KEY ("automationActionId") REFERENCES "AutomationAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "TaskRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusHistory" ADD CONSTRAINT "TaskStatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEntityLink" ADD CONSTRAINT "TaskEntityLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAttempt" ADD CONSTRAINT "FollowUpAttempt_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpOutcome" ADD CONSTRAINT "FollowUpOutcome_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Retry, confirmation, chain and recurrence hardening added before first deployment.
ALTER TABLE "AutomationRun" ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastErrorCode" TEXT,
ADD COLUMN "lastErrorSummary" TEXT,
ADD COLUMN "chainDepth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sourceAutomationId" TEXT;

ALTER TABLE "Task" ADD COLUMN "occurrenceKey" TEXT,
ADD COLUMN "parentTaskId" TEXT;

ALTER TABLE "TaskRecurrence" ADD COLUMN "exdates" JSONB;

CREATE TABLE "AutomationConfirmation" (
  "id" TEXT NOT NULL,
  "automationRunId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "origin" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entityType" TEXT,
  "entityId" TEXT,
  "payloadSanitized" JSONB,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "AutomationConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationConfirmation_idempotencyKey_key" ON "AutomationConfirmation"("idempotencyKey");
CREATE INDEX "AutomationConfirmation_automationRunId_confirmedAt_idx" ON "AutomationConfirmation"("automationRunId", "confirmedAt");
CREATE INDEX "AutomationConfirmation_actorType_confirmedAt_idx" ON "AutomationConfirmation"("actorType", "confirmedAt");
CREATE INDEX "AutomationRun_status_nextRetryAt_idx" ON "AutomationRun"("status", "nextRetryAt");
CREATE INDEX "AutomationRun_correlationId_chainDepth_idx" ON "AutomationRun"("correlationId", "chainDepth");
CREATE UNIQUE INDEX "Task_recurrenceId_occurrenceKey_key" ON "Task"("recurrenceId", "occurrenceKey");
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
ALTER TABLE "AutomationConfirmation" ADD CONSTRAINT "AutomationConfirmation_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
