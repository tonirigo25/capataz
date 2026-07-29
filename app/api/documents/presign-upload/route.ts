import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/commercial/authorization";
import { documentStorage } from "@/lib/document-storage";
import {
  EXPENSE_DOCUMENT_MIME_EXTENSIONS,
  MAX_EXPENSE_DOCUMENT_BYTES,
  extensionOf,
  sanitizeFilename,
} from "@/lib/expense-document";
import { prisma } from "@/lib/prisma";
import { publicRequestContext } from "@/lib/platform/request-boundary";
import { assertDocumentCreationAllowed } from "@/lib/commercial/usage";

const CATEGORIES = new Set(["documentos", "facturas", "tickets"]);

export async function POST(request: Request) {
  return publicRequestContext("POST /api/documents/presign-upload", request, async () => {
    const context = await requireCapability("documents.upload");
    let input: Record<string, unknown>;
    try {
      input = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const filename = sanitizeFilename(String(input.filename ?? ""));
    const mimeType = String(input.mimeType ?? "").trim().toLowerCase();
    const sizeBytes = Number(input.sizeBytes);
    const checksum = String(input.checksum ?? "").trim().toLowerCase();
    const category = String(input.category ?? "documentos").trim().toLowerCase();
    const extension = extensionOf(filename);
    const allowed = EXPENSE_DOCUMENT_MIME_EXTENSIONS[mimeType as keyof typeof EXPENSE_DOCUMENT_MIME_EXTENSIONS] as readonly string[] | undefined;
    if (
      !allowed?.includes(extension)
      || !Number.isInteger(sizeBytes)
      || sizeBytes <= 0
      || sizeBytes > MAX_EXPENSE_DOCUMENT_BYTES
      || !/^[a-f0-9]{64}$/.test(checksum)
      || !CATEGORIES.has(category)
    ) {
      return NextResponse.json({ error: "INVALID_DOCUMENT" }, { status: 400 });
    }

    const document = await prisma.$transaction(
      async (transaction) => {
        await assertDocumentCreationAllowed(transaction, {
          companyId: context.companyId,
          sizeBytes,
          actorId: context.userId,
          origin: "presigned_upload",
          targetId: checksum.slice(0, 16),
        });
        return transaction.document.create({
          data: {
            companyId: context.companyId,
            uploadedById: context.userId,
            name: filename,
            originalName: filename,
            mimeType,
            size: sizeBytes,
            sha256: checksum,
            category: mimeType === "application/pdf" ? "factura" : "otro",
            status: "UPLOADED",
            extractionStatus: "PENDING",
            metadata: { source: "presigned_upload", uploadPending: true },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    try {
      const signed = await documentStorage.presignPut({
        companyId: context.companyId,
        category,
        documentId: document.id,
        filename,
        mimeType,
        sizeBytes,
        checksum,
      });
      await prisma.document.update({ where: { id: document.id }, data: { storageKey: signed.storageKey } });
      return NextResponse.json({
        documentId: document.id,
        uploadUrl: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
        requiredHeaders: { "content-type": mimeType, "x-amz-checksum-sha256": Buffer.from(checksum, "hex").toString("base64") },
      });
    } catch {
      await prisma.document.deleteMany({ where: { id: document.id, companyId: context.companyId } });
      return NextResponse.json({ error: "DOCUMENT_STORAGE_UNAVAILABLE" }, { status: 503 });
    }
  });
}
