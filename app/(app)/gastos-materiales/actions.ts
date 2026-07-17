"use server";

import type { ExpenseCategory, ExpenseDocumentType, FiscalDocumentType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { documentStorage } from "@/lib/document-storage";
import { EXPENSE_DOCUMENT_TYPES, normalizeExpenseExtraction, parseDate, parseMoney, validateExpenseDocumentFile } from "@/lib/expense-document";
import { DocumentExtractionNotConfiguredError, resolveDocumentExtractionProvider } from "@/lib/document-extraction";
import { getPartnerSuggestion, updatePartnerLearning } from "@/lib/procurement";

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
    if (stored) await documentStorage.delete({ companyId: context.companyId, storageKey: stored.storageKey }).catch(() => undefined);
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
  const businessPartnerId = optionalText(formData, "businessPartnerId");
  const work = obraId ? await prisma.work.findFirst({ where: { id: obraId, companyId: context.companyId, archivada: false }, select: { id: true, clienteId: true } }) : null;
  if (obraId && !work) redirect(`/gastos-materiales/lector/${document.id}?error=invalid_relation`);
  const finalClientId = clienteId || work?.clienteId || null;
  if (finalClientId) {
    const client = await prisma.client.findFirst({ where: { id: finalClientId, companyId: context.companyId, archivadoAt: null }, select: { id: true } });
    if (!client || (work && work.clienteId !== finalClientId)) redirect(`/gastos-materiales/lector/${document.id}?error=invalid_relation`);
  }
  const partner = businessPartnerId ? await prisma.businessPartner.findFirst({ where: { id: businessPartnerId, companyId: context.companyId, archivedAt: null, status: { not: "BLOCKED" } } }) : null;
  if (businessPartnerId && !partner) redirect(`/gastos-materiales/lector/${document.id}?error=invalid_partner`);

  const issueDate = parseDate(text(formData, "issueDate"));
  const total = parseMoney(text(formData, "total"));
  if (!issueDate || total == null || total < 0) redirect(`/gastos-materiales/lector/${document.id}?error=required_fields`);
  const duplicateIds = await findDuplicateExpenseDocumentIds({
    excludeDocumentId: document.id, sha256: document.sha256,
    invoiceNumber: optionalText(formData, "invoiceNumber"), issuerName: optionalText(formData, "issuerName"),
    issuerTaxId: optionalText(formData, "issuerTaxId"), issueDate, total
  });
  if (duplicateIds.length && text(formData, "confirmDuplicate") !== "yes") redirect(`/gastos-materiales/lector/${document.id}?error=duplicate_confirmation_required`);

  const proposed = normalizeExpenseExtraction(document.extractedData);
  const requestedDocumentType = text(formData, "documentType");
  const requestedCategory = text(formData, "category");
  if (!EXPENSE_DOCUMENT_TYPES.includes(requestedDocumentType as (typeof EXPENSE_DOCUMENT_TYPES)[number]) || !["materiales", "combustible", "restauracion", "herramientas", "maquinaria", "transportes", "subcontrata", "servicios", "suministros", "otros"].includes(requestedCategory)) {
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

  const dueDate = parseDate(optionalText(formData, "dueDate"));
  const vatRate = parseMoney(optionalText(formData, "vatRate"));
  const fiscalType = (["FULL_INVOICE", "SIMPLIFIED_INVOICE", "CORRECTIVE_INVOICE"].includes(text(formData, "fiscalType")) ? text(formData, "fiscalType") : "FULL_INVOICE") as FiscalDocumentType;
  const result = await prisma.$transaction(async (tx) => {
    let purchaseInvoiceId: string | null = null;
    if (partner && reviewed.invoiceNumber) {
      const existingInvoice = await tx.purchaseInvoice.findFirst({ where: { companyId: context.companyId, businessPartnerId: partner.id, invoiceNumber: { equals: reviewed.invoiceNumber, mode: "insensitive" } }, select: { id: true } });
      if (existingInvoice) redirect(`/gastos-materiales/lector/${document.id}?error=purchase_invoice_duplicate`);
      const purchaseInvoice = await tx.purchaseInvoice.create({ data: {
        companyId: context.companyId, businessPartnerId: partner.id, workId: work?.id ?? null,
        kind: partner.kind, fiscalType, invoiceNumber: reviewed.invoiceNumber,
        issueDate: new Date(`${issueDate}T12:00:00.000Z`),
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00.000Z`) : new Date(`${issueDate}T12:00:00.000Z`),
        taxableBase: reviewed.taxableBase ?? Math.max(0, total - (reviewed.vatAmount ?? 0) + (reviewed.withholdingAmount ?? 0)),
        vatRate, vatAmount: reviewed.vatAmount ?? 0, withholdingAmount: reviewed.withholdingAmount ?? 0,
        total, pendingAmount: total, paymentMethod: reviewed.paymentMethod,
        description: reviewed.description || `Documento ${reviewed.invoiceNumber}`,
        workDescription: partner.kind === "SUBCONTRACTOR" ? reviewed.description : null,
        notes: optionalText(formData, "notes")
      } });
      purchaseInvoiceId = purchaseInvoice.id;
      await tx.purchaseInvoiceHistory.create({ data: { companyId: context.companyId, purchaseInvoiceId, action: "CREATED_FROM_DOCUMENT", detail: "Factura registrada tras revisión humana del documento", createdById: context.userId } });
    }
    const created = await tx.expense.create({ data: {
      companyId: context.companyId, obraId: work?.id ?? null, clienteId: finalClientId,
      businessPartnerId: partner?.id ?? null, purchaseInvoiceId,
      proveedor: partner?.commercialName || reviewed.issuerName || "Proveedor pendiente de identificar",
      concepto: reviewed.description || `Documento ${reviewed.invoiceNumber || document.name}`,
      categoria: reviewed.category as ExpenseCategory,
      importe: total, fecha: new Date(`${issueDate}T12:00:00.000Z`),
      paymentStatus: purchaseInvoiceId ? "pending" : "unknown",
      paymentDueDate: dueDate ? new Date(`${dueDate}T12:00:00.000Z`) : null,
      notas: optionalText(formData, "notes")
    } });
    await tx.document.update({ where: { id: document.id }, data: {
      expenseId: created.id, purchaseInvoiceId, businessPartnerId: partner?.id ?? null, workId: work?.id ?? null, clientId: finalClientId,
      status: "REGISTERED", documentType: reviewed.documentType as ExpenseDocumentType,
      extractedData: reviewedExtraction as unknown as Prisma.InputJsonValue,
      extractedIssuer: reviewed.issuerName, extractedIssuerTaxId: reviewed.issuerTaxId,
      extractedInvoiceNo: reviewed.invoiceNumber, extractedIssueDate: new Date(`${issueDate}T12:00:00.000Z`), extractedTotal: total,
      metadata: mergeMetadata(document.metadata, { review: { confirmedAt: new Date().toISOString(), confirmedByUserId: context.userId, changedFields, duplicateOverride: duplicateIds.length > 0 } })
    } });
    if (partner) {
      await tx.businessPartnerHistory.create({ data: { companyId: context.companyId, businessPartnerId: partner.id, action: "DOCUMENT_REVIEWED", detail: `Documento ${document.name} confirmado`, createdById: context.userId } });
      if (work) await tx.businessPartnerWork.upsert({ where: { businessPartnerId_workId: { businessPartnerId: partner.id, workId: work.id } }, create: { companyId: context.companyId, businessPartnerId: partner.id, workId: work.id }, update: {} });
      await updatePartnerLearning(tx, { companyId: context.companyId, businessPartnerId: partner.id, category: reviewed.category as ExpenseCategory, workId: work?.id ?? null, vatRate });
    }
    return { expense: created, purchaseInvoiceId };
  });
  revalidateExpensePaths();
  redirect(`/gastos-materiales/lector/${document.id}?saved=${result.expense.id}${result.purchaseInvoiceId ? `&invoice=${result.purchaseInvoiceId}` : ""}`);
}

export async function deleteExpenseDocument(formData: FormData) {
  const { companyId } = await requireCompanyContext();
  const id = text(formData, "id");
  const document = await prisma.document.findFirst({ where: { id, companyId }, select: { id: true, storageKey: true, expenseId: true } });
  if (!document) redirect("/gastos-materiales/lector?error=not_found");
  if (document.expenseId && text(formData, "confirmLinked") !== "yes") redirect(`/gastos-materiales/lector/${id}?error=linked_confirmation_required`);
  await prisma.document.update({ where: { id: document.id }, data: { status: "CANCELLED" } });
  if (document.storageKey) await documentStorage.delete({ companyId, storageKey: document.storageKey });
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
    const bytes = await documentStorage.get({ companyId, storageKey: document.storageKey });
    const result = await provider.extract({ bytes, filename: document.originalName || document.name, mimeType: document.mimeType, sha256: document.sha256 });
    const partner = await getPartnerSuggestion(companyId, { issuerTaxId: result.issuerTaxId, issuerName: result.issuerName });
    const learned = partner?.learning;
    const duplicate = await prisma.document.findFirst({
      where: {
        companyId,
        id: { not: document.id },
        archivedAt: null,
        OR: [
          { sha256: document.sha256 },
          ...(result.invoiceNumber && result.issuerTaxId ? [{ extractedInvoiceNo: { equals: result.invoiceNumber, mode: "insensitive" as const }, extractedIssuerTaxId: { equals: result.issuerTaxId, mode: "insensitive" as const } }] : [])
        ]
      },
      select: { id: true }
    });
    const inboxStatus = duplicate ? "POSSIBLE_DUPLICATE" : !partner ? "AWAITING_PARTNER" : partner.kind === "SUBCONTRACTOR" && !learned?.preferredWorkId ? "AWAITING_WORK" : "REVIEW_REQUIRED";
    const learnedResult = {
      ...result,
      suggestedCategory: learned?.preferredCategory || result.suggestedCategory,
      vatRate: learned?.preferredVatRate ?? result.vatRate,
      warnings: [
        ...result.warnings,
        ...(learned ? ["Se han aplicado preferencias confirmadas previamente para este proveedor dentro de tu empresa."] : [])
      ]
    };
    await prisma.document.update({ where: { id }, data: {
      status: inboxStatus, extractionStatus: "COMPLETED", extractionConfidence: result.confidence,
      documentType: result.documentType, extractedData: learnedResult as unknown as Prisma.InputJsonValue,
      businessPartnerId: partner?.id ?? null, workId: learned?.preferredWorkId ?? null,
      extractedIssuer: result.issuerName, extractedIssuerTaxId: result.issuerTaxId, extractedInvoiceNo: result.invoiceNumber,
      extractedIssueDate: result.issueDate ? new Date(`${result.issueDate}T12:00:00.000Z`) : null, extractedTotal: result.total,
      extractionError: null, processedAt: new Date(), metadata: mergeMetadata(document.metadata, { extractionProvider: provider.name, learningApplied: Boolean(learned) })
    } });
  } catch (error) {
    const notConfigured = error instanceof DocumentExtractionNotConfiguredError;
    await prisma.document.update({ where: { id }, data: {
      status: "REVIEW_REQUIRED", extractionStatus: notConfigured ? "NOT_CONFIGURED" : "FAILED",
      extractionError: notConfigured ? error.message : "No se pudo analizar el documento. Puedes introducir los datos manualmente o reintentar.", processedAt: new Date()
    } });
  }
}

export async function findDuplicateExpenseDocumentIds(input: { excludeDocumentId?: string; sha256?: string | null; invoiceNumber?: string | null; issuerName?: string | null; issuerTaxId?: string | null; issueDate?: string | null; total?: number | null }) {
  const { companyId } = await requireCompanyContext();
  const or: Prisma.DocumentWhereInput[] = [];
  if (input.sha256) or.push({ sha256: input.sha256 });
  if (input.invoiceNumber && input.issuerTaxId) or.push({ extractedInvoiceNo: { equals: input.invoiceNumber, mode: "insensitive" }, extractedIssuerTaxId: { equals: input.issuerTaxId, mode: "insensitive" } });
  if (input.invoiceNumber && input.issuerName) or.push({ extractedInvoiceNo: { equals: input.invoiceNumber, mode: "insensitive" }, extractedIssuer: { equals: input.issuerName, mode: "insensitive" } });
  if (input.issueDate && input.total != null && input.issuerName) {
    const date = new Date(`${input.issueDate}T12:00:00.000Z`);
    or.push({ extractedIssueDate: { gte: new Date(date.getTime() - 86_400_000), lte: new Date(date.getTime() + 86_400_000) }, extractedTotal: { gte: input.total - 0.01, lte: input.total + 0.01 }, extractedIssuer: { equals: input.issuerName, mode: "insensitive" } });
  }
  if (!or.length) return [];
  const rows = await prisma.document.findMany({ where: { companyId, id: input.excludeDocumentId ? { not: input.excludeDocumentId } : undefined, OR: or, archivedAt: null }, select: { id: true }, take: 10 });
  return rows.map((row) => row.id);
}

function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function optionalText(formData: FormData, key: string) { return text(formData, key) || null; }
function safeUploadError(error: unknown) { const message = error instanceof Error ? error.message : ""; return /archivo|formato|extensión|tipo declarado/i.test(message) ? message : "No se pudo leer el archivo."; }
function redirectWithError(message: string): never { redirect(`/gastos-materiales/lector?error=${encodeURIComponent(message)}`); }
function isNextRedirect(error: unknown) { return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")); }
function mergeMetadata(current: Prisma.JsonValue | null, next: Record<string, unknown>) { return { ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}), ...next } as Prisma.InputJsonValue; }
function revalidateExpensePaths() { revalidatePath("/gastos-materiales"); revalidatePath("/gastos-materiales/lector"); revalidatePath("/proveedores"); revalidatePath("/subcontratas"); revalidatePath("/facturas-proveedor"); revalidatePath("/facturas-subcontratas"); revalidatePath("/tesoreria"); revalidatePath("/obras"); revalidatePath("/hoy"); }
