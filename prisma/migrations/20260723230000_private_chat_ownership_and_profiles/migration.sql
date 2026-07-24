ALTER TABLE "ChatConversation" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "ChatActionLog" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ChatActionLog" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE IF EXISTS "CompanyMembership" ADD COLUMN "functionalProfileKey" TEXT;
ALTER TABLE IF EXISTS "TaskRecurrence" ADD COLUMN "companyId" TEXT;

DO $$ BEGIN
  IF to_regclass('"TaskRecurrence"') IS NOT NULL AND to_regclass('"Task"') IS NOT NULL THEN
    UPDATE "TaskRecurrence" AS recurrence
    SET "companyId" = inferred."companyId"
    FROM (
      SELECT "recurrenceId", MIN("companyId") AS "companyId"
      FROM "Task"
      WHERE "recurrenceId" IS NOT NULL AND "companyId" IS NOT NULL
      GROUP BY "recurrenceId"
      HAVING COUNT(DISTINCT "companyId") = 1
    ) AS inferred
    WHERE recurrence."id" = inferred."recurrenceId" AND recurrence."companyId" IS NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "ChatMessage_companyId_idempotencyKey_key";
CREATE UNIQUE INDEX "ChatMessage_companyId_conversationId_idempotencyKey_key" ON "ChatMessage"("companyId", "conversationId", "idempotencyKey");
CREATE INDEX "ChatConversation_companyId_ownerUserId_idx" ON "ChatConversation"("companyId", "ownerUserId");
CREATE INDEX "ChatActionLog_companyId_actorUserId_conversationId_idx" ON "ChatActionLog"("companyId", "actorUserId", "conversationId");
DO $$ BEGIN
  IF to_regclass('"TaskRecurrence"') IS NOT NULL THEN
    CREATE INDEX "TaskRecurrence_companyId_active_nextOccurrenceAt_idx" ON "TaskRecurrence"("companyId", "active", "nextOccurrenceAt");
  END IF;
END $$;

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatActionLog" ADD CONSTRAINT "ChatActionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatActionLog" ADD CONSTRAINT "ChatActionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DO $$ BEGIN
  IF to_regclass('"TaskRecurrence"') IS NOT NULL THEN
    ALTER TABLE "TaskRecurrence" ADD CONSTRAINT "TaskRecurrence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
