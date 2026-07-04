ALTER TABLE "ChatConversation"
ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "activeTask" JSONB,
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

UPDATE "ChatConversation"
SET "lastActivityAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "lastActivityAt" IS NULL;

UPDATE "ChatConversation"
SET "title" = 'Conversación anterior'
WHERE "id" = 'default' AND "title" = 'Conversación principal';

CREATE INDEX IF NOT EXISTS "ChatConversation_status_lastActivityAt_idx" ON "ChatConversation"("status", "lastActivityAt");

ALTER TABLE "ChatMessage" ALTER COLUMN "conversationId" DROP DEFAULT;

ALTER TABLE "ChatActionLog"
ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
ADD COLUMN IF NOT EXISTS "actionType" TEXT,
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "summary" TEXT,
ADD COLUMN IF NOT EXISTS "payload" JSONB,
ADD COLUMN IF NOT EXISTS "result" JSONB,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "ChatActionLog_conversationId_idx" ON "ChatActionLog"("conversationId");
CREATE INDEX IF NOT EXISTS "ChatActionLog_idempotencyKey_idx" ON "ChatActionLog"("idempotencyKey");
