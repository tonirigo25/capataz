"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createSupportTicketUseCase, setTestimonialConsentUseCase, submitSupportFeedbackUseCase } from "@/lib/application/support/ticket-use-case";

export async function createSupportTicket(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/soporte/actions.ts#createSupportTicket" }, () => createSupportTicketUseCase(formData));
}

export async function submitSupportFeedback(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/soporte/actions.ts#submitSupportFeedback" }, () => submitSupportFeedbackUseCase(formData));
}

export async function updateTestimonialConsent(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/soporte/actions.ts#updateTestimonialConsent" }, () => setTestimonialConsentUseCase(formData));
}
