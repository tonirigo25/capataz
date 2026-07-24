ALTER TABLE "ChatMessage" ADD COLUMN "companyId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ChatConversation'
      AND column_name = 'companyId'
  ) THEN
    UPDATE "ChatMessage" AS message
    SET "companyId" = conversation."companyId"
    FROM "ChatConversation" AS conversation
    WHERE message."conversationId" = conversation."id";
  END IF;
END $$;

DROP INDEX IF EXISTS "ChatMessage_idempotencyKey_key";

CREATE UNIQUE INDEX "ChatMessage_companyId_idempotencyKey_key"
ON "ChatMessage"("companyId", "idempotencyKey");

CREATE INDEX "ChatMessage_companyId_idx" ON "ChatMessage"("companyId");

DO $$
BEGIN
  IF to_regclass('"Company"') IS NOT NULL THEN
    ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
