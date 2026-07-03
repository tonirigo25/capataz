CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL DEFAULT 'default',
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'saved',
  "idempotencyKey" TEXT,
  "context" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessage_idempotencyKey_key" ON "ChatMessage"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_status_idx" ON "ChatMessage"("status");

CREATE TABLE IF NOT EXISTS "ChatActionLog" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "durationMs" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatActionLog_messageId_idx" ON "ChatActionLog"("messageId");
CREATE INDEX IF NOT EXISTS "ChatActionLog_stage_idx" ON "ChatActionLog"("stage");
CREATE INDEX IF NOT EXISTS "ChatActionLog_createdAt_idx" ON "ChatActionLog"("createdAt");
