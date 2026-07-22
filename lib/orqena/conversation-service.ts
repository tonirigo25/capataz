import { prisma } from "@/lib/prisma";
import type { ConversationState } from "@/lib/orqena/types";
import { queryIntent } from "@/lib/orqena/query-router";
import { present } from "@/lib/orqena/response-presenter";
export async function saveConversationState(companyId: string, conversationId: string, state: ConversationState) { const result = await prisma.chatConversation.updateMany({ where: { id: conversationId, companyId }, data: { structuredContext: state as never, lastActivityAt: new Date() } }); if (result.count !== 1) throw new Error("Conversación no disponible."); }
export function nextConversationState(current: Partial<ConversationState>, patch: Partial<ConversationState>): ConversationState { return { ...current, ...patch, contextUpdatedAt: new Date().toISOString() }; }

export async function runConversationTurn<TContext, TResult>(input: {
  text: string;
  context: TContext;
  persist: () => Promise<{ duplicate: boolean; completed?: TResult; context: TContext }>;
  execute: (context: TContext, intent: ReturnType<typeof queryIntent>) => Promise<TResult>;
  complete: (result: TResult) => Promise<void>;
  fail: (error: unknown) => Promise<void>;
  duplicateResult: (context: TContext) => TResult;
}) {
  const persisted = await input.persist();
  if (persisted.completed) return persisted.completed;
  if (persisted.duplicate) return input.duplicateResult(persisted.context);
  try {
    const result = await input.execute(persisted.context, queryIntent(input.text));
    present({ text: "", data: result });
    await input.complete(result);
    return result;
  } catch (error) {
    await input.fail(error);
    throw error;
  }
}
