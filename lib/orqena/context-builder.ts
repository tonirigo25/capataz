import { prisma } from "@/lib/prisma";
import { relevantMemories } from "./memory-service";
import { validateEntityContext } from "@/lib/entity-context/validation";
import type { ConversationState, SourceLink } from "./types";
export const CONTEXT_LIMITS = { messages: 12, memories: 12, documents: 5, entities: 10 } as const;
export async function buildOrqenaContext(input: { companyId: string; userId: string; conversationId: string; route?: string; clientId?: string; workId?: string }) {
  const entities = await validateEntityContext(input.companyId, { clientId: input.clientId, workId: input.workId });
  const [conversation, memories] = await Promise.all([
    prisma.chatConversation.findFirst({ where: { id: input.conversationId, companyId: input.companyId }, include: { messages: { orderBy: { createdAt: "desc" }, take: CONTEXT_LIMITS.messages } } }),
    relevantMemories({ companyId: input.companyId, userId: input.userId, entityType: input.workId ? "work" : input.clientId ? "client" : undefined, entityId: input.workId ?? input.clientId, take: CONTEXT_LIMITS.memories }),
  ]);
  if (!conversation) throw new Error("Conversación no disponible.");
  return { companyId: input.companyId, route: input.route, entities, state: (conversation.structuredContext ?? {}) as ConversationState, messages: conversation.messages.reverse(), memories, limits: CONTEXT_LIMITS };
}
export function sourceFor(entityType: SourceLink["entityType"], entityId: string, label: string, href: string): SourceLink { return { entityType, entityId, label, href, observedAt: new Date().toISOString(), reliability: "record" }; }
