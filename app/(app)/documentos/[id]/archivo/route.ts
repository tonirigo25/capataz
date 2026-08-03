import { NextResponse } from "next/server";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { requireCapability, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { documentStorage } from "@/lib/document-storage";
import { sanitizeFilename } from "@/lib/expense-document";
import { prisma } from "@/lib/prisma";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return publicRequestContext("GET /documentos/[id]/archivo", request, async () => {
    const [{ id }, auth] = await Promise.all([
      params,
      requireCapability("documents.view"),
    ]);
    const [manifest, scopedDocumentIds] = await Promise.all([
      buildPortalManifest(auth),
      resolveScopedEntityIds(auth, "documents.view", "Document"),
    ]);
    if (scopedDocumentIds !== null && !scopedDocumentIds.includes(id)) {
      return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
    }

    const document = await prisma.document.findFirst({
      where: {
        id,
        companyId: auth.companyId,
        archivedAt: null,
        classification: { in: manifest.documentClasses },
      },
      select: {
        storageKey: true,
        mimeType: true,
        originalName: true,
        name: true,
      },
    });
    if (!document?.storageKey) {
      return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
    }

    try {
      const url = new URL(request.url);
      const download = url.searchParams.get("download") === "1";
      const mimeType = document.mimeType || "application/octet-stream";
      const filename = sanitizeFilename(document.originalName || document.name).replace(/["\\]/g, "-");
      if (!download && isInlineMime(mimeType)) {
        const signed = await documentStorage.presignGet({
          companyId: auth.companyId,
          storageKey: document.storageKey,
          filename,
          mimeType,
        });
        if (signed) {
          return NextResponse.redirect(signed.url, {
            status: 307,
            headers: privateHeaders(),
          });
        }
      }

      const bytes = await documentStorage.get({
        companyId: auth.companyId,
        storageKey: document.storageKey,
      });
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          ...privateHeaders(),
          "Content-Type": mimeType,
          "Content-Length": String(bytes.length),
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
          "Content-Security-Policy": "sandbox",
        },
      });
    } catch {
      return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
    }
  });
}

function isInlineMime(mimeType: string) {
  return mimeType === "application/pdf" || mimeType === "text/plain" || mimeType.startsWith("image/");
}

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}
