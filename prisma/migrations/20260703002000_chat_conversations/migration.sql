CREATE TABLE IF NOT EXISTS "ChatConversation" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ChatConversation" ("id", "title", "status", "createdAt", "updatedAt")
VALUES ('default', 'Conversación principal', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ChatConversation" ("id", "title", "status", "createdAt", "updatedAt")
SELECT DISTINCT "conversationId", 'Conversación anterior', 'active', MIN("createdAt"), MAX("updatedAt")
FROM "ChatMessage"
WHERE "conversationId" IS NOT NULL
GROUP BY "conversationId"
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "ChatConversation_status_updatedAt_idx" ON "ChatConversation"("status", "updatedAt");

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
