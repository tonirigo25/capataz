"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { completePrivacyRequestUseCase, createPrivacyRequestUseCase, exportPrivacyRequestUseCase, preparePrivacyCatalogUseCase, verifyPrivacyRequestUseCase } from "@/lib/application/privacy/governance-use-cases";

export async function preparePrivacyCatalog() {
  return executeNextAction({ operation: "app/(app)/configuracion/privacidad/actions.ts#preparePrivacyCatalog" }, () => preparePrivacyCatalogUseCase());
}

export async function createPrivacyRequest(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/privacidad/actions.ts#createPrivacyRequest" }, () => createPrivacyRequestUseCase(formData));
}
export async function verifyPrivacyRequest(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/privacidad/actions.ts#verifyPrivacyRequest" }, () => verifyPrivacyRequestUseCase(formData));
}
export async function exportPrivacyRequest(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/privacidad/actions.ts#exportPrivacyRequest" }, () => exportPrivacyRequestUseCase(formData));
}
export async function completePrivacyRequest(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/privacidad/actions.ts#completePrivacyRequest" }, () => completePrivacyRequestUseCase(formData));
}
