"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { uploadRepositoryDocument as uploadRepositoryDocumentUseCase } from "@/lib/application/documents/repository-document-use-cases";

export async function uploadRepositoryDocument(formData: FormData) {
  return executeNextAction(
    { operation: "app/(app)/documentos/actions.ts#uploadRepositoryDocument" },
    () => uploadRepositoryDocumentUseCase(formData),
  );
}
