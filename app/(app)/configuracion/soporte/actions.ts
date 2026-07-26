"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createSupportTicketUseCase } from "@/lib/application/support/ticket-use-case";

export async function createSupportTicket(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/soporte/actions.ts#createSupportTicket" }, () => createSupportTicketUseCase(formData));
}
