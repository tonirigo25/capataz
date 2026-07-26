"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { registerPayment as registerPaymentUseCase, prepareCollectionReminder as prepareCollectionReminderUseCase, markInvoicePaid as markInvoicePaidUseCase } from "@/lib/application/finance/receivables-use-cases";

export async function registerPayment(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/dinero/actions.ts#registerPayment" }, () => registerPaymentUseCase(formData));
}

export async function prepareCollectionReminder(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/dinero/actions.ts#prepareCollectionReminder" }, () => prepareCollectionReminderUseCase(formData));
}

export async function markInvoicePaid(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/dinero/actions.ts#markInvoicePaid" }, () => markInvoicePaidUseCase(formData));
}
