"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { runChatCommand as runChatCommandUseCase, loadChatConversations as loadChatConversationsUseCase, getOrCreateInitialConversation as getOrCreateInitialConversationUseCase, createChatConversation as createChatConversationUseCase, renameChatConversation as renameChatConversationUseCase, archiveChatConversation as archiveChatConversationUseCase, deleteChatConversation as deleteChatConversationUseCase, preparePendingProposal as preparePendingProposalUseCase, cancelPendingProposal as cancelPendingProposalUseCase, executePendingProposal as executePendingProposalUseCase } from "@/lib/orqena/application/capataz-use-cases";
import type { ChatCommandContext, ChatCommandOptions, PendingProposalOperation } from "@/lib/orqena/application/capataz-use-cases";
export type { ChatCommandContext, ChatCommandResult, ChatCommandOptions, ChatActionButton, ChatActionResult, ChatHistoryMessage, ChatHistoryConversation, PendingProposalOperation, AiDisclosure } from "@/lib/orqena/application/capataz-use-cases";

export async function runChatCommand(text: string, context?: ChatCommandContext | null, options: ChatCommandOptions = {}) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#runChatCommand" }, () => runChatCommandUseCase(text, context, options));
}

export async function loadChatConversations(includeArchived = false) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#loadChatConversations" }, () => loadChatConversationsUseCase(includeArchived));
}

export async function getOrCreateInitialConversation(preferredConversationId?: string | null) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#getOrCreateInitialConversation" }, () => getOrCreateInitialConversationUseCase(preferredConversationId));
}

export async function createChatConversation(title = "Nueva conversación") {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#createChatConversation" }, () => createChatConversationUseCase(title));
}

export async function renameChatConversation(conversationId: string, title: string) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#renameChatConversation" }, () => renameChatConversationUseCase(conversationId, title));
}

export async function archiveChatConversation(conversationId: string) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#archiveChatConversation" }, () => archiveChatConversationUseCase(conversationId));
}

export async function deleteChatConversation(conversationId: string) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#deleteChatConversation" }, () => deleteChatConversationUseCase(conversationId));
}

export async function preparePendingProposal(conversationId: string, proposal: { type: string; payload: Record<string, unknown>; review: Record<string, unknown> }) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#preparePendingProposal" }, () => preparePendingProposalUseCase(conversationId, proposal));
}

export async function cancelPendingProposal(conversationId: string, confirmationId: string) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#cancelPendingProposal" }, () => cancelPendingProposalUseCase(conversationId, confirmationId));
}

export async function executePendingProposal(conversationId: string, confirmationId: string, operation: PendingProposalOperation, formData: FormData) {
  return executeNextAction({ operation: "app/(app)/capataz/actions.ts#executePendingProposal" }, () => executePendingProposalUseCase(conversationId, confirmationId, operation, formData));
}
