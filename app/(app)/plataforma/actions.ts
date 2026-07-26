"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { createSupportGrant as createSupportGrantUseCase, closeSupportGrant as closeSupportGrantUseCase, toggleCompanySuspension as toggleCompanySuspensionUseCase } from "@/lib/application/platform/platform-admin-use-cases";
import { savePilotCohortUseCase, saveProductExperimentUseCase, saveServiceCostUseCase, updateSupportTicketUseCase } from "@/lib/application/platform/platform-metrics-use-cases";

export async function createSupportGrant(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#createSupportGrant" }, () => createSupportGrantUseCase(formData));
}

export async function closeSupportGrant(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#closeSupportGrant" }, () => closeSupportGrantUseCase(formData));
}

export async function toggleCompanySuspension(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#toggleCompanySuspension" }, () => toggleCompanySuspensionUseCase(formData));
}

export async function savePilotCohort(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#savePilotCohort" }, () => savePilotCohortUseCase(formData));
}

export async function saveServiceCost(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#saveServiceCost" }, () => saveServiceCostUseCase(formData));
}

export async function saveProductExperiment(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#saveProductExperiment" }, () => saveProductExperimentUseCase(formData));
}

export async function updateSupportTicket(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/plataforma/actions.ts#updateSupportTicket" }, () => updateSupportTicketUseCase(formData));
}
