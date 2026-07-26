"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { updateMaterialStatus as updateMaterialStatusUseCase, uploadExpenseDocument as uploadExpenseDocumentUseCase, retryExpenseDocumentExtraction as retryExpenseDocumentExtractionUseCase, saveExpenseFromDocument as saveExpenseFromDocumentUseCase, deleteExpenseDocument as deleteExpenseDocumentUseCase, findDuplicateExpenseDocumentIds as findDuplicateExpenseDocumentIdsUseCase } from "@/lib/application/finance/expense-use-cases";

export async function updateMaterialStatus(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/gastos-materiales/actions.ts#updateMaterialStatus" }, () => updateMaterialStatusUseCase(formData));
}

export async function uploadExpenseDocument(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/gastos-materiales/actions.ts#uploadExpenseDocument" }, () => uploadExpenseDocumentUseCase(formData));
}

export async function retryExpenseDocumentExtraction(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/gastos-materiales/actions.ts#retryExpenseDocumentExtraction" }, () => retryExpenseDocumentExtractionUseCase(formData));
}

export async function saveExpenseFromDocument(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/gastos-materiales/actions.ts#saveExpenseFromDocument" }, () => saveExpenseFromDocumentUseCase(formData));
}

export async function deleteExpenseDocument(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/gastos-materiales/actions.ts#deleteExpenseDocument" }, () => deleteExpenseDocumentUseCase(formData));
}

export async function findDuplicateExpenseDocumentIds(input: { excludeDocumentId?: string; sha256?: string | null; invoiceNumber?: string | null; issuerName?: string | null; issuerTaxId?: string | null; issueDate?: string | null; total?: number | null }) {
  return executeNextAction({ operation: "app/(app)/gastos-materiales/actions.ts#findDuplicateExpenseDocumentIds" }, () => findDuplicateExpenseDocumentIdsUseCase(input));
}
