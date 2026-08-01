"use server";

import type { DocumentCategory, DocumentClassification } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { requireCapability } from "@/lib/commercial/authorization";
import { assertDocumentCreationAllowed } from "@/lib/commercial/usage";
import { documentStorage } from "@/lib/document-storage";
import {
  repositoryDocumentCategories,
  validateRepositoryDocumentFile,
} from "@/lib/document-upload";
import { prisma } from "@/lib/prisma";

const allowedCategories = new Set(repositoryDocumentCategories.map((item) => item.value));

export async function uploadRepositoryDocument(formData: FormData) {
  const context = await requireCapability("documents.upload");
  const manifest = await buildPortalManifest(context);
  const file = formData.get("document");
  if (!(file instanceof File)) redirectWithError("missing_file");

  const category = String(formData.get("category") ?? "otro") as DocumentCategory;
  const classification = String(formData.get("classification") ?? "") as DocumentClassification;
  if (!allowedCategories.has(category) || !manifest.documentClasses.includes(classification)) {
    redirectWithError("invalid_classification");
  }

  let bytes: Buffer;
  let validated: ReturnType<typeof validateRepositoryDocumentFile>;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
    validated = validateRepositoryDocumentFile({
      filename: file.name,
      browserMime: file.type,
      bytes,
    });
  } catch (error) {
    redirectWithError(uploadErrorCode(error));
  }

  let documentId: string | null = null;
  let storageKey: string | null = null;
  try {
    const document = await prisma.$transaction(async (transaction) => {
      await assertDocumentCreationAllowed(transaction, {
        companyId: context.companyId,
        sizeBytes: bytes.byteLength,
        actorId: context.userId,
        origin: "document_repository",
        targetId: validated.sha256.slice(0, 16),
      });
      return transaction.document.create({
        data: {
          companyId: context.companyId,
          uploadedById: context.userId,
          name: validated.filename,
          originalName: validated.filename,
          mimeType: validated.mimeType,
          size: bytes.byteLength,
          sha256: validated.sha256,
          category,
          classification,
          status: "READY",
          extractionStatus: "NOT_CONFIGURED",
          metadata: {
            source: "document_repository",
            uploadedAt: new Date().toISOString(),
          },
        },
      });
    }, { isolationLevel: "Serializable" });
    documentId = document.id;

    const stored = await documentStorage.put({
      companyId: context.companyId,
      category: "documentos",
      documentId: document.id,
      filename: validated.filename,
      mimeType: validated.mimeType,
      checksum: validated.sha256,
      bytes,
    });
    storageKey = stored.storageKey;
    await prisma.document.updateMany({
      where: { id: document.id, companyId: context.companyId },
      data: { storageKey: stored.storageKey, size: stored.sizeBytes, sha256: stored.checksum },
    });
  } catch {
    if (storageKey) {
      await documentStorage.delete({ companyId: context.companyId, storageKey }).catch(() => undefined);
    }
    if (documentId) {
      await prisma.document.deleteMany({ where: { id: documentId, companyId: context.companyId } }).catch(() => undefined);
    }
    redirectWithError("storage_failed");
  }

  revalidatePath("/documentos");
  redirect(`/documentos?documento=${encodeURIComponent(documentId)}`);
}

function uploadErrorCode(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if ([
    "EMPTY_DOCUMENT",
    "DOCUMENT_TOO_LARGE",
    "DOCUMENT_FORMAT_UNSUPPORTED",
    "DOCUMENT_EXTENSION_MISMATCH",
    "DOCUMENT_MIME_MISMATCH",
  ].includes(code)) return code.toLowerCase();
  return "invalid_file";
}

function redirectWithError(code: string): never {
  redirect(`/documentos/subir?error=${encodeURIComponent(code)}`);
}
