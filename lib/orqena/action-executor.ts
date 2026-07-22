import type { PendingConfirmation } from "./types";
import { assertConfirmationOwner } from "./confirmation-service";
export async function executeConfirmedAction<T>(confirmation: PendingConfirmation, owner: { companyId: string; conversationId: string }, executor: (payload: Record<string, unknown>) => Promise<T>): Promise<T> { assertConfirmationOwner(confirmation, owner); return executor(confirmation.payload); }
