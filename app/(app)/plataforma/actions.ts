"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createSupportGrant as createSupportGrantUseCase, closeSupportGrant as closeSupportGrantUseCase, toggleCompanySuspension as toggleCompanySuspensionUseCase } from "@/lib/application/platform/platform-admin-use-cases";

export async function createSupportGrant(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#createSupportGrant" }, () => createSupportGrantUseCase(formData));
}

export async function closeSupportGrant(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#closeSupportGrant" }, () => closeSupportGrantUseCase(formData));
}

export async function toggleCompanySuspension(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#toggleCompanySuspension" }, () => toggleCompanySuspensionUseCase(formData));
}
