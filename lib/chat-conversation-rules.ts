export const CHAT_INACTIVITY_MS = 5 * 60 * 1000;

export function isRecentConversation(lastActivityAt: Date | string | number, now: Date | number = Date.now()) {
  const last = typeof lastActivityAt === "string" || lastActivityAt instanceof Date
    ? new Date(lastActivityAt).getTime()
    : lastActivityAt;
  const current = now instanceof Date ? now.getTime() : now;
  return current - last <= CHAT_INACTIVITY_MS;
}

export function shouldCreateNewConversation(lastActivityAt: Date | string | number | null | undefined, now: Date | number = Date.now()) {
  if (!lastActivityAt) return true;
  return !isRecentConversation(lastActivityAt, now);
}

export function shouldShowConversationInHistory(messageCount: number, keepVisible = false) {
  return keepVisible || messageCount > 0;
}

export function canApplyConversationLoad(expectedConversationId: string, activeConversationId: string, requestId: number, latestRequestId: number) {
  return Boolean(expectedConversationId && expectedConversationId === activeConversationId && requestId === latestRequestId);
}
