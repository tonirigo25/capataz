"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { saveBusinessPartner as saveBusinessPartnerUseCase, createPurchaseInvoice as createPurchaseInvoiceUseCase, registerPurchaseInvoicePayment as registerPurchaseInvoicePaymentUseCase, voidPurchaseInvoice as voidPurchaseInvoiceUseCase } from "@/lib/application/finance/procurement-use-cases";

export async function saveBusinessPartner(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/proveedores/actions.ts#saveBusinessPartner" }, () => saveBusinessPartnerUseCase(formData));
}

export async function createPurchaseInvoice(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/proveedores/actions.ts#createPurchaseInvoice" }, () => createPurchaseInvoiceUseCase(formData));
}

export async function registerPurchaseInvoicePayment(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/proveedores/actions.ts#registerPurchaseInvoicePayment" }, () => registerPurchaseInvoicePaymentUseCase(formData));
}

export async function voidPurchaseInvoice(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/proveedores/actions.ts#voidPurchaseInvoice" }, () => voidPurchaseInvoiceUseCase(formData));
}
