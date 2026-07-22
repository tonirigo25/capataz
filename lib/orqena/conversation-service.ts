import { prisma } from "@/lib/prisma";
import type { ConversationState } from "./types";
export async function saveConversationState(companyId: string, conversationId: string, state: ConversationState) { const result = await prisma.chatConversation.updateMany({ where: { id: conversationId, companyId }, data: { structuredContext: state as never, lastActivityAt: new Date() } }); if (result.count !== 1) throw new Error("Conversación no disponible."); }
export function nextConversationState(current: Partial<ConversationState>, patch: Partial<ConversationState>): ConversationState { return { ...current, ...patch, contextUpdatedAt: new Date().toISOString() }; }
