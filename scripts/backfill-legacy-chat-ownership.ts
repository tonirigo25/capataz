import { prisma } from "../lib/prisma";

async function main() {
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") throw new Error("Legacy chat ownership backfill is prohibited in production.");
  if (process.env.ORQENA_CHAT_OWNERSHIP_BACKFILL_APPROVED !== "true") throw new Error("Set ORQENA_CHAT_OWNERSHIP_BACKFILL_APPROVED=true for an explicitly approved non-production database.");
  const candidates = await prisma.businessMemory.groupBy({ by: ["sourceConversationId", "userId"], where: { sourceConversationId: { not: null }, userId: { not: null } }, _count: { _all: true } });
  const owners = new Map<string, Set<string>>();
  for (const item of candidates) {
    if (!item.sourceConversationId || !item.userId) continue;
    const set = owners.get(item.sourceConversationId) ?? new Set<string>();
    set.add(item.userId);
    owners.set(item.sourceConversationId, set);
  }
  let updated = 0;
  for (const [conversationId, users] of owners) {
    if (users.size !== 1) continue;
    const ownerUserId = [...users][0];
    const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, ownerUserId: null, company: { memberships: { some: { userId: ownerUserId, status: "active" } } } }, select: { id: true, companyId: true } });
    if (!conversation?.companyId) continue;
    const result = await prisma.chatConversation.updateMany({ where: { id: conversation.id, ownerUserId: null }, data: { ownerUserId } });
    if (result.count === 1) {
      await prisma.chatMessage.updateMany({ where: { conversationId: conversation.id, companyId: null }, data: { companyId: conversation.companyId } });
      updated += 1;
    }
  }
  process.stdout.write(`${JSON.stringify({ updatedConversations: updated })}\n`);
}

main().finally(() => prisma.$disconnect());
