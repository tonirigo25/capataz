import { prisma } from "../lib/prisma";

async function main() {
  const [nullCompany, nullOwner, nullMessageCompany, empty, affected] = await Promise.all([
    prisma.chatConversation.count({ where: { companyId: null } }),
    prisma.chatConversation.count({ where: { ownerUserId: null } }),
    prisma.chatMessage.count({ where: { companyId: null } }),
    prisma.chatConversation.count({ where: { messages: { none: {} } } }),
    prisma.chatConversation.groupBy({ by: ["companyId"], where: { ownerUserId: null }, _count: { _all: true } })
  ]);
  const candidates = await prisma.businessMemory.groupBy({
    by: ["sourceConversationId", "userId"],
    where: { sourceConversationId: { not: null }, userId: { not: null } },
    _count: { _all: true }
  });
  const owners = new Map<string, Set<string>>();
  for (const item of candidates) {
    if (!item.sourceConversationId || !item.userId) continue;
    const set = owners.get(item.sourceConversationId) ?? new Set<string>();
    set.add(item.userId);
    owners.set(item.sourceConversationId, set);
  }
  const inferable = [...owners.values()].filter((set) => set.size === 1).length;
  const ambiguous = [...owners.values()].filter((set) => set.size > 1).length;
  process.stdout.write(`${JSON.stringify({ conversationsWithNullCompanyId: nullCompany, conversationsWithNullOwnerUserId: nullOwner, messagesWithNullCompanyId: nullMessageCompany, unequivocallyInferableConversations: inferable, ambiguousConversations: ambiguous, conversationsWithoutMessages: empty, affectedCompanies: affected.filter((item) => item.companyId !== null).length }, null, 2)}\n`);
}

main().finally(() => prisma.$disconnect());
