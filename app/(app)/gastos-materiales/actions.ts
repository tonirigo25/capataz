"use server";

import type { ExpenseCategory, ExpenseDocumentType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { documentStorage } from "@/lib/document-storage";
import { EXPENSE_DOCUMENT_TYPES, normalizeExpenseExtraction, parseDate, parseMoney, validateExpenseDocumentFile } from "@/lib/expense-document";
import { DocumentExtractionNotConfiguredError, resolveDocumentExtractionProvider } from "@/lib/document-extraction";

export async function updateMaterialStatus(formData: FormData) {
  const id = text(formData, "id");
  const estado = text(formData, "estado");
  if (!id || !estado) return;
  const { companyId } = await requireCompanyContext();
  await prisma.material.updateMany({ where: { id, companyId }, data: { estado: estado as never } });
  revalidateExpensePaths();
}

export async function uploadExpenseDocument(formData: FormData) {
  const context = await requireCompanyContext();
  const file = formData.get("document");
  if (!(file instanceof File)) redirectWithError("Selecciona un archivo para continuar.");
  let validated: ReturnType<typeof validateExpenseDocumentFile>;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
    validated = validateExpenseDocumentFile({ filename: file.name, browserMime: file.type, bytes });
  } catch (error) {
    redirectWithError(safeUploadError(error));
  }

  let stored: Awaited<ReturnType<typeof documentStorage.put>> | null = null;
  let createdDocumentId: string | null = null;
  try {
    stored = await documentStorage.put({ companyId: context.companyId, bytes: bytes!, extension: validated!.extension });
    const document = await prisma.document.create({
      data: {
        companyId: context.companyId,
        uploadedById: context.userId,
        name: validated!.filename,
        originalName: validated!.filename,
        mimeType: validated!.mimeType,
        size: stored.sizeBytes,
        storageKey: stored.storageKey,
        sha256: validated!.sha256,
        category: validated!.mimeType === "application/pdf" ? "factura" : "ticket",
        status: "UPLOADED",
        extractionStatus: "PENDING",
        metadata: { source: "expense_document_reader", uploadedAt: new Date().toISOString() }
      }
    });
    createdDocumentId = document.id;
    await processDocument(document.id, context.companyId);
    redirect(`/gastos-materiales/lector/${document.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (stored) await documentStorage.delete(stored.storageKey).catch(() => undefined);
    if (createdDocumentId) await prisma.document.deleteMany({ where: { id: createdDocumentId, companyId: context.companyId } }).catch(() => undefined);
    redirectWithError("No se pudo guardar el documento. Inténtalo de nuevo.");
  }
}

export async function retryExpenseDocumentExtraction(formData: FormData) {
  const { companyId } = await requireCompanyContext();
  const id = text(formData, "id");
  if (!id) return;
  await processDocument(id, companyId);
  revalidatePath(`/gastos-materiales/lector/${id}`);
}

export async function saveExpenseFromDocument(formData: FormData) {
  const context = await requireCompanyContext();
  const documentId = text(formData, "documentId");
  if (text(formData, "confirmed") !== "yes") redirect(`/gastos-materiales/lector/${documentId}?error=confirmation_required`);
  const document = await prisma.document.findFirst({ where: { id: documentId, companyId: context.companyId, archivedAt: null } });
  if (!document) redirect("/gastos-materiales/lector?error=not_found");
  if (document.expenseId || document.status === "SAVED") redirect(`/gastos-materiales/lector/${document.id}?error=already_saved`);

  const obraId = optionalText(formData, "obraId");
  const clienteId = optionalText(formData, "clienteId");
  const work = obraId ? await prisma.work.findFirst({ where: { id: obraId, companyId: context.companyId, archivada: false }, select: { id: true, clienteId: true } }) : null;
  if (obraId && !work) redirect(`/gastos-materiales/lector/${document.id}?error=invalid_relation`);
  const finalClientId = clienteId || work?.clienteId || null;
  if (finalClientId) {
    const client = await prisma.client.findFirst({ where: { id: finalClientId, companyId: context.companyId, archivadoAt: null }, select: { id: true } });
    if (!client || (work && work.clienteId !== finalClientId)) redirect(`/gastos-materiales/lector/${document.id}?error=invalid_relation`);
  }

  const issueDate = parseDate(text(formData, "issueDate"));
  const total = parseMoney(text(formData, "total"));
  if (!issueDate || total == null || total < 0) redirect(`/gastos-materiales/lector/${document.id}?error=required_fields`);
  const duplicateIds = await findDuplicateExpenseDocumentIds({
    companyId: context.companyId, excludeDocumentId: document.id, sha256: document.sha256,
    invoiceNumber: optionalText(formData, "invoiceNumber"), issuerName: optionalText(formData, "issuerName"),
    issuerTaxId: optionalText(formData, "issuerTaxId"), issueDate, total
  });
  if (duplicateIds.length && text(formData, "confirmDuplicate") !== "yes") redirect(`/gastos-materiales/lector/${document.id}?error=duplicate_confirmation_required`);

  const proposed = normalizeExpenseExtraction(document.extractedData);
  const requestedDocumentType = text(formData, "documentType");
  const requestedCategory = text(formData, "category");
  if (!EXPENSE_DOCUMENT_TYPES.includes(requestedDocumentType as (typeof EXPENSE_DOCUMENT_TYPES)[number]) || !["material", "mano_obra", "transporte", "herramienta", "gasolina", "subcontrata", "otros"].includes(requestedCategory)) {
    redirect(`/gastos-materiales/lector/${document.id}?error=required_fields`);
  }
  const reviewed = {
    documentType: requestedDocumentType, issuerName: optionalText(formData, "issuerName"), issuerTaxId: optionalText(formData, "issuerTaxId"),
    invoiceNumber: optionalText(formData, "invoiceNumber"), issueDate, taxableBase: parseMoney(optionalText(formData, "taxableBase")),
    vatAmount: parseMoney(optionalText(formData, "vatAmount")), withholdingAmount: parseMoney(optionalText(formData, "withholdingAmount")),
    total, category: requestedCategory, description: text(formData, "description"), paymentMethod: optionalText(formData, "paymentMethod")
  };
  const lineDescriptions = optionalText(formData, "linesReview")?.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 100);
  const reviewedLines = lineDescriptions?.map((description, index) => ({
    description,
    quantity: proposed.lines[index]?.quantity ?? null,
    unitPrice: proposed.lines[index]?.unitPrice ?? null,
    total: proposed.lines[index]?.total ?? null
  })) ?? proposed.lines;
  const reviewedExtraction = {
    ...proposed,
    documentType: reviewed.documentType,
    issuerName: reviewed.issuerName,
    issuerTaxId: reviewed.issuerTaxId,
    invoiceNumber: reviewed.invoiceNumber,
    issueDate: reviewed.issueDate,
    taxableBase: reviewed.taxableBase,
    vatAmount: reviewed.vatAmount,
    withholdingAmount: reviewed.withholdingAmount,
    total: reviewed.total,
    paymentMethod: reviewed.paymentMethod,
    description: reviewed.description,
    suggestedCategory: reviewed.category,
    lines: reviewedLines
  };
  const changedFields = Object.keys(reviewed).filter((key) => String(reviewed[key as keyof typeof reviewed] ?? "") !== String(proposed[key as keyof typeof proposed] ?? ""));
  if (JSON.stringify(reviewedLines) !== JSON.stringify(proposed.lines)) changedFields.push("lines");

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({ data: {
      companyId: context.companyId, obraId: work?.id ?? null, clienteId: finalClientId,
      proveedor: reviewed.issuerName || "Proveedor pendiente de identificar",
      concepto: reviewed.description || `Documento ${reviewed.invoiceNumber || document.name}`,
      categoria: reviewed.category as ExpenseCategory,
      importe: total, fecha: new Date(`${issueDate}T12:00:00.000Z`),
      paymentStatus: "unknown", notas: optionalText(formData, "notes")
    } });
    await tx.document.update({ where: { id: document.id }, data: {
      expenseId: created.id, workId: work?.id ?? null, clientId: finalClientId,
      status: "SAVED", documentType: reviewed.documentType as ExpenseDocumentType,
      extractedData: reviewedExtraction as unknown as Prisma.InputJsonValue,
      extractedIssuer: reviewed.issuerName, extractedIssuerTaxId: reviewed.issuerTaxId,
      extractedInvoiceNo: reviewed.invoiceNumber, extractedIssueDate: new Date(`${issueDate}T12:00:00.000Z`), extractedTotal: total,
      metadata: mergeMetadata(document.metadata, { review: { confirmedAt: new Date().toISOString(), confirmedByUserId: context.userId, changedFields, duplicateOverride: duplicateIds.length > 0 } })
    } });
    return created;
  });
  revalidateExpensePaths();
  redirect(`/gastos-materiales/lector/${document.id}?saved=${expense.id}`);
}

export async function deleteExpenseDocument(formData: FormData) {
  const { companyId } = await requireCompanyContext();
  const id = text(formData, "id");
  const document = await prisma.document.findFirst({ where: { id, companyId }, select: { id: true, storageKey: true, expenseId: true } });
  if (!document) redirect("/gastos-materiales/lector?error=not_found");
  if (document.expenseId && text(formData, "confirmLinked") !== "yes") redirect(`/gastos-materiales/lector/${id}?error=linked_confirmation_required`);
  await prisma.document.update({ where: { id: document.id }, data: { status: "CANCELLED" } });
  if (document.storageKey) await documentStorage.delete(document.storageKey);
  await prisma.document.delete({ where: { id: document.id } });
  revalidateExpensePaths();
  redirect("/gastos-materiales/lector?deleted=1");
}

async function processDocument(id: string, companyId: string) {
  const document = await prisma.document.findFirst({ where: { id, companyId, archivedAt: null } });
  if (!document || !document.storageKey || !document.sha256 || !document.mimeType) return;
  const provider = resolveDocumentExtractionProvider();
  if (!provider.configured) {
    await prisma.document.update({ where: { id }, data: { status: "REVIEW_REQUIRED", extractionStatus: "NOT_CONFIGURED", extractionError: "El análisis automático no está configurado. Puedes introducir los datos manualmente.", processedAt: new Date() } });
    return;
  }
  await prisma.document.update({ where: { id }, data: { status: "PROCESSING", extractionStatus: "PROCESSING", extractionError: null } });
  try {
    const bytes = await documentStorage.get(document.storageKey);
    const result = await provider.extract({ bytes, filename: document.originalName || document.name, mimeType: document.mimeType, sha256: document.sha256 });
    await prisma.document.update({ where: { id }, data: {
      status: "REVIEW_REQUIRED", extractionStatus: "COMPLETED", extractionConfidence: result.confidence,
      documentType: result.documentType, extractedData: result as unknown as Prisma.InputJsonValue,
      extractedIssuer: result.issuerName, extractedIssuerTaxId: result.issuerTaxId, extractedInvoiceNo: result.invoiceNumber,
      extractedIssueDate: result.issueDate ? new Date(`${result.issueDate}T12:00:00.000Z`) : null, extractedTotal: result.total,
      extractionError: null, processedAt: new Date(), metadata: mergeMetadata(document.metadata, { extractionProvider: provider.name })
    } });
  } catch (error) {
    const notConfigured = error instanceof DocumentExtractionNotConfiguredError;
    await prisma.document.update({ where: { id }, data: {
      status: "REVIEW_REQUIRED", extractionStatus: notConfigured ? "NOT_CONFIGURED" : "FAILED",
      extractionError: notConfigured ? error.message : "No se pudo analizar el documento. Puedes introducir los datos manualmente o reintentar.", processedAt: new Date()
    } });
  }
}

export async function findDuplicateExpenseDocumentIds(input: { companyId: string; excludeDocumentId?: string; sha256?: string | null; invoiceNumber?: string | null; issuerName?: string | null; issuerTaxId?: string | null; issueDate?: string | null; total?: number | null }) {
  const or: Prisma.DocumentWhereInput[] = [];
  if (input.sha256) or.push({ sha256: input.sha256 });
  if (input.invoiceNumber && input.issuerTaxId) or.push({ extractedInvoiceNo: { equals: input.invoiceNumber, mode: "insensitive" }, extractedIssuerTaxId: { equals: input.issuerTaxId, mode: "insensitive" } });
  if (input.invoiceNumber && input.issuerName) or.push({ extractedInvoiceNo: { equals: input.invoiceNumber, mode: "insensitive" }, extractedIssuer: { equals: input.issuerName, mode: "insensitive" } });
  if (input.issueDate && input.total != null && input.issuerName) {
    const date = new Date(`${input.issueDate}T12:00:00.000Z`);
    or.push({ extractedIssueDate: { gte: new Date(date.getTime() - 86_400_000), lte: new Date(date.getTime() + 86_400_000) }, extractedTotal: { gte: input.total - 0.01, lte: input.total + 0.01 }, extractedIssuer: { equals: input.issuerName, mode: "insensitive" } });
  }
  if (!or.length) return [];
  const rows = await prisma.document.findMany({ where: { companyId: input.companyId, id: input.excludeDocumentId ? { not: input.excludeDocumentId } : undefined, OR: or, archivedAt: null }, select: { id: true }, take: 10 });
  return rows.map((row) => row.id);
}

function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function optionalText(formData: FormData, key: string) { return text(formData, key) || null; }
function safeUploadError(error: unknown) { const message = error instanceof Error ? error.message : ""; return /archivo|formato|extensión|tipo declarado/i.test(message) ? message : "No se pudo leer el archivo."; }
function redirectWithError(message: string): never { redirect(`/gastos-materiales/lector?error=${encodeURIComponent(message)}`); }
function isNextRedirect(error: unknown) { return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")); }
function mergeMetadata(current: Prisma.JsonValue | null, next: Record<string, unknown>) { return { ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}), ...next } as Prisma.InputJsonValue; }
function revalidateExpensePaths() { revalidatePath("/gastos-materiales"); revalidatePath("/gastos-materiales/lector"); revalidatePath("/obras"); revalidatePath("/hoy"); }
