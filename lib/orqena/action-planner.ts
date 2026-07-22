import { createPendingConfirmation } from "./confirmation-service";
export function planAction(input: { companyId: string; conversationId: string; action: string; entityType: Parameters<typeof createPendingConfirmation>[0]["entityType"]; payload: Record<string, unknown>; review: Record<string, unknown> }) { return createPendingConfirmation(input); }
