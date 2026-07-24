import type { ConversationState } from "@/lib/orqena/types";
import { saveConversationStateForCompany, type ConversationTenantContext } from "@/lib/orqena/conversation-repository";
import { queryIntent } from "@/lib/orqena/query-router";
import { present } from "@/lib/orqena/response-presenter";
export async function saveConversationState(context: ConversationTenantContext, conversationId: string, state: ConversationState) { await saveConversationStateForCompany(context, conversationId, state as never); }
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
