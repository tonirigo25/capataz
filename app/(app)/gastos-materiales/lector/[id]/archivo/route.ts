import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/commercial/authorization";
import { documentStorage } from "@/lib/document-storage";
import { sanitizeFilename } from "@/lib/expense-document";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { companyId }] = await Promise.all([params, requireCapability("purchases.received_invoices.view")]);
  const document = await prisma.document.findFirst({ where: { id, companyId, archivedAt: null }, select: { storageKey: true, mimeType: true, originalName: true, name: true } });
  if (!document?.storageKey) return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  try {
    const bytes = await documentStorage.get({ companyId, storageKey: document.storageKey });
    const filename = sanitizeFilename(document.originalName || document.name).replace(/["\\]/g, "-");
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": document.mimeType || "application/octet-stream", "Content-Length": String(bytes.length), "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  }
}
