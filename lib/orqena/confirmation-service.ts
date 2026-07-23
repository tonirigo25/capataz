import { randomUUID } from "node:crypto";
import type { OrqenaEntityType, PendingConfirmation } from "./types";
export function createPendingConfirmation(input: Omit<PendingConfirmation, "id" | "createdAt" | "expiresAt">, ttlMinutes = 15): PendingConfirmation {
  const now = new Date(); return { ...input, id: randomUUID(), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString() };
}
export function assertConfirmationOwner(value: PendingConfirmation, expected: { companyId: string; conversationId: string }) {
  if (value.companyId !== expected.companyId || value.conversationId !== expected.conversationId) throw new Error("La confirmación no pertenece a esta conversación.");
  if (new Date(value.expiresAt).getTime() <= Date.now()) throw new Error("La propuesta ha caducado. Prepárala de nuevo.");
}
export const mutationRequiresConfirmation = (action: string, entityType: OrqenaEntityType) => {
  void action;
  void entityType;
  return true;
};
