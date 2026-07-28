"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { applyImportUseCase, previewImportUseCase, rollbackImportUseCase } from "@/lib/application/company/import-use-cases";

export async function previewImport(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/importar/actions.ts#previewImport" }, () => previewImportUseCase(formData));
}

export async function applyImport(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/importar/actions.ts#applyImport" }, () => applyImportUseCase(formData));
}

export async function rollbackImport(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/importar/actions.ts#rollbackImport" }, () => rollbackImportUseCase(formData));
}
