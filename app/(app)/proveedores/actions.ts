"use server";

import type {
  BusinessPartnerKind,
  BusinessPartnerLegalType,
  BusinessPartnerStatus,
  FiscalDocumentType
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  expenseCategoryForPurchase,
  findPartnerDuplicates,
  parsePurchaseAmounts,
  purchaseInvoiceStatus,
  updatePartnerLearning,
  validateSpanishTaxId
} from "@/lib/procurement";

export async function saveBusinessPartner(formData: FormData) {
  const context = await requireCompanyContext();
  const kind = partnerKind(text(formData, "kind"));
  const base = partnerBase(kind);
  const id = optionalText(formData, "id");
  const commercialName = requiredText(formData, "commercialName", base);
  const legalName = requiredText(formData, "legalName", base);
  const taxValidation = validateSpanishTaxId(optionalText(formData, "taxId"));
  if (!taxValidation.valid) fail(base, "invalid_tax_id");
  const duplicates = await findPartnerDuplicates(context.companyId, { kind, taxId: taxValidation.normalized, commercialName, excludeId: id ?? undefined });
  if (taxValidation.normalized && duplicates.some((duplicate) => duplicate.taxId?.toUpperCase().replace(/[\s.\-]/g, "") === taxValidation.normalized)) fail(`${base}?nuevo=1&duplicate=${duplicates[0].id}`, "duplicate_tax_id", true);
  if (!id && duplicates.length && text(formData, "confirmDuplicate") !== "yes") fail(`${base}?nuevo=1&duplicate=${duplicates[0].id}`, "duplicate_confirmation_required", true);

  const status = partnerStatus(text(formData, "status"));
  const legalType = optionalEnum<BusinessPartnerLegalType>(text(formData, "legalType"), ["SELF_EMPLOYED", "COMPANY"]);
  const documentExpiresAt = optionalDate(text(formData, "documentExpiresAt"), base);
  const rating = optionalInteger(text(formData, "internalRating"), 1, 5, base);
  const paymentDueDays = optionalInteger(text(formData, "paymentDueDays"), 0, 365, base) ?? 30;
  const tags = text(formData, "tags").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  const data = {
    kind,
    status,
    commercialName,
    legalName,
    taxId: taxValidation.normalized,
    address: optionalText(formData, "address"),
    city: optionalText(formData, "city"),
    province: optionalText(formData, "province"),
    postalCode: optionalText(formData, "postalCode"),
    country: optionalText(formData, "country") || "España",
    phone: optionalText(formData, "phone"),
    email: optionalText(formData, "email"),
    website: optionalText(formData, "website"),
    contactPerson: optionalText(formData, "contactPerson"),
    notes: optionalText(formData, "notes"),
    internalNotes: optionalText(formData, "internalNotes"),
    paymentTerms: optionalText(formData, "paymentTerms"),
    paymentDueDays,
    preferredPaymentMethod: optionalText(formData, "preferredPaymentMethod"),
    tags,
    tradeType: kind === "SUBCONTRACTOR" ? optionalText(formData, "tradeType") : null,
    specialty: kind === "SUBCONTRACTOR" ? optionalText(formData, "specialty") : null,
    liabilityInsurance: kind === "SUBCONTRACTOR" ? optionalText(formData, "liabilityInsurance") : null,
    documentExpiresAt: kind === "SUBCONTRACTOR" ? documentExpiresAt : null,
    legalType: kind === "SUBCONTRACTOR" ? legalType : null,
    internalRating: kind === "SUBCONTRACTOR" ? rating : null,
    documentStatus: kind === "SUBCONTRACTOR" ? documentStatus(text(formData, "documentStatus")) : "NOT_REQUIRED" as const
  };

  const partner = await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.businessPartner.findFirst({ where: { id, companyId: context.companyId, kind, archivedAt: null }, select: { id: true } });
      if (!existing) fail(base, "not_found");
      const updated = await tx.businessPartner.update({ where: { id }, data });
      await tx.businessPartnerHistory.create({ data: { companyId: context.companyId, businessPartnerId: id, action: "UPDATED", detail: "Ficha actualizada", createdById: context.userId } });
      return updated;
    }
    const created = await tx.businessPartner.create({ data: { companyId: context.companyId, ...data } });
    await tx.businessPartnerHistory.create({ data: { companyId: context.companyId, businessPartnerId: created.id, action: "CREATED", detail: kind === "SUPPLIER" ? "Proveedor creado" : "Subcontrata creada", createdById: context.userId } });
    return created;
  });
  revalidateProcurement();
  redirect(`${base}/${partner.id}?saved=1`);
}

export async function createPurchaseInvoice(formData: FormData) {
  const context = await requireCompanyContext();
  const kind = partnerKind(text(formData, "kind"));
  const base = invoiceBase(kind);
  const businessPartnerId = requiredText(formData, "businessPartnerId", base);
  const partner = await prisma.businessPartner.findFirst({ where: { id: businessPartnerId, companyId: context.companyId, kind, archivedAt: null } });
  if (!partner || partner.status === "BLOCKED") fail(base, "invalid_partner");
  const workId = optionalText(formData, "workId");
  const work = workId ? await prisma.work.findFirst({ where: { id: workId, companyId: context.companyId, archivada: false }, select: { id: true, clienteId: true } }) : null;
  if (workId && !work) fail(base, "invalid_work");
  const issueDate = requiredDate(text(formData, "issueDate"), base);
  const dueDate = requiredDate(text(formData, "dueDate"), base);
  if (dueDate < issueDate) fail(base, "invalid_due_date");
  let amounts: ReturnType<typeof parsePurchaseAmounts>;
  try {
    amounts = parsePurchaseAmounts({
      taxableBase: text(formData, "taxableBase"),
      vatAmount: text(formData, "vatAmount"),
      withholdingAmount: text(formData, "withholdingAmount"),
      total: text(formData, "total")
    });
  } catch {
    fail(base, "invalid_totals");
  }
  const invoiceNumber = requiredText(formData, "invoiceNumber", base);
  const duplicate = await prisma.purchaseInvoice.findFirst({ where: { companyId: context.companyId, businessPartnerId, invoiceNumber: { equals: invoiceNumber, mode: "insensitive" } }, select: { id: true } });
  if (duplicate) fail(`${base}/${duplicate.id}`, "duplicate_invoice", true);
  const description = requiredText(formData, "description", base);
  const category = expenseCategoryForPurchase(kind, text(formData, "category"));
  const vatRate = optionalNumber(text(formData, "vatRate"), 0, 100, base);
  const withholdingRate = optionalNumber(text(formData, "withholdingRate"), 0, 100, base);
  const fiscalType = requiredEnum<FiscalDocumentType>(text(formData, "fiscalType"), ["FULL_INVOICE", "SIMPLIFIED_INVOICE", "CORRECTIVE_INVOICE"], base);

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseInvoice.create({
      data: {
        companyId: context.companyId,
        businessPartnerId,
        workId: work?.id ?? null,
        kind,
        fiscalType,
        invoiceNumber,
        issueDate,
        dueDate,
        taxableBase: amounts.taxableBase,
        vatRate,
        vatAmount: amounts.vatAmount,
        withholdingRate,
        withholdingAmount: amounts.withholdingAmount,
        total: amounts.total,
        pendingAmount: amounts.total,
        paymentMethod: optionalText(formData, "paymentMethod"),
        description,
        workDescription: kind === "SUBCONTRACTOR" ? optionalText(formData, "workDescription") : null,
        certifications: kind === "SUBCONTRACTOR" ? certifications(formData) : undefined,
        notes: optionalText(formData, "notes")
      }
    });
    const expense = await tx.expense.create({
      data: {
        companyId: context.companyId,
        obraId: work?.id ?? null,
        clienteId: work?.clienteId ?? null,
        businessPartnerId,
        purchaseInvoiceId: created.id,
        proveedor: partner.commercialName,
        concepto: description,
        categoria: category,
        importe: amounts.total,
        fecha: issueDate,
        paymentStatus: "pending",
        paymentDueDate: dueDate,
        costBehavior: work ? "variable" : "unknown",
        notas: optionalText(formData, "notes")
      }
    });
    await tx.purchaseInvoiceHistory.create({ data: { companyId: context.companyId, purchaseInvoiceId: created.id, action: "CREATED", detail: "Factura recibida registrada y gasto enlazado", createdById: context.userId } });
    await tx.businessPartnerHistory.create({ data: { companyId: context.companyId, businessPartnerId, action: "INVOICE_REGISTERED", detail: `Factura ${invoiceNumber} · ${amounts.total.toFixed(2)} EUR`, createdById: context.userId } });
    if (work) await tx.businessPartnerWork.upsert({ where: { businessPartnerId_workId: { businessPartnerId, workId: work.id } }, create: { companyId: context.companyId, businessPartnerId, workId: work.id }, update: {} });
    await updatePartnerLearning(tx, { companyId: context.companyId, businessPartnerId, category, workId: work?.id ?? null, vatRate });
    await tx.purchaseInvoice.update({ where: { id: created.id }, data: {} });
    return { ...created, expenseId: expense.id };
  });
  revalidateProcurement();
  redirect(`${base}/${invoice.id}?saved=1`);
}

export async function registerPurchaseInvoicePayment(formData: FormData) {
  const context = await requireCompanyContext();
  const kind = partnerKind(text(formData, "kind"));
  const base = invoiceBase(kind);
  const id = requiredText(formData, "purchaseInvoiceId", base);
  const invoice = await prisma.purchaseInvoice.findFirst({ where: { id, companyId: context.companyId, kind }, include: { expense: true } });
  if (!invoice || invoice.status === "VOID") fail(base, "not_found");
  const amount = requiredNumber(text(formData, "amount"), 0.01, invoice.pendingAmount, `${base}/${id}`);
  const paidAt = requiredDate(text(formData, "paidAt"), `${base}/${id}`);
  const method = requiredText(formData, "method", `${base}/${id}`);
  await prisma.$transaction(async (tx) => {
    await tx.purchaseInvoicePayment.create({ data: { companyId: context.companyId, purchaseInvoiceId: id, amount, paidAt, method, reference: optionalText(formData, "reference"), notes: optionalText(formData, "notes") } });
    const paidAmount = round(invoice.paidAmount + amount);
    const pendingAmount = Math.max(0, round(invoice.total - paidAmount));
    const status = purchaseInvoiceStatus({ total: invoice.total, paidAmount, dueDate: invoice.dueDate });
    await tx.purchaseInvoice.update({ where: { id }, data: { paidAmount, pendingAmount, status } });
    if (invoice.expense) await tx.expense.update({ where: { id: invoice.expense.id }, data: { paymentStatus: status === "PAID" ? "paid" : "pending", paidAt: status === "PAID" ? paidAt : null } });
    await tx.purchaseInvoiceHistory.create({ data: { companyId: context.companyId, purchaseInvoiceId: id, action: "PAYMENT_REGISTERED", detail: `Pago parcial de ${amount.toFixed(2)} EUR`, createdById: context.userId } });
  });
  revalidateProcurement();
  redirect(`${base}/${id}?payment=1`);
}

export async function voidPurchaseInvoice(formData: FormData) {
  const context = await requireCompanyContext();
  const kind = partnerKind(text(formData, "kind"));
  const base = invoiceBase(kind);
  const id = requiredText(formData, "purchaseInvoiceId", base);
  if (text(formData, "confirmed") !== "yes") fail(`${base}/${id}`, "confirmation_required");
  const invoice = await prisma.purchaseInvoice.findFirst({ where: { id, companyId: context.companyId, kind }, include: { expense: true } });
  if (!invoice || invoice.paidAmount > 0) fail(`${base}/${id}`, "cannot_void");
  await prisma.$transaction(async (tx) => {
    await tx.purchaseInvoice.update({ where: { id }, data: { status: "VOID", pendingAmount: 0, voidedAt: new Date() } });
    if (invoice.expense) await tx.expense.update({ where: { id: invoice.expense.id }, data: { paymentStatus: "cancelled" } });
    await tx.purchaseInvoiceHistory.create({ data: { companyId: context.companyId, purchaseInvoiceId: id, action: "VOIDED", detail: "Factura anulada por el usuario", createdById: context.userId } });
  });
  revalidateProcurement();
  redirect(`${base}/${id}?voided=1`);
}

function partnerKind(value: string): BusinessPartnerKind { return value === "SUBCONTRACTOR" ? "SUBCONTRACTOR" : "SUPPLIER"; }
function partnerStatus(value: string): BusinessPartnerStatus { return ["ACTIVE", "INACTIVE", "BLOCKED"].includes(value) ? value as BusinessPartnerStatus : "ACTIVE"; }
function documentStatus(value: string) { return ["VALID", "EXPIRING", "EXPIRED", "INCOMPLETE", "NOT_REQUIRED"].includes(value) ? value as "VALID" | "EXPIRING" | "EXPIRED" | "INCOMPLETE" | "NOT_REQUIRED" : "INCOMPLETE"; }
function partnerBase(kind: BusinessPartnerKind) { return kind === "SUBCONTRACTOR" ? "/subcontratas" : "/proveedores"; }
function invoiceBase(kind: BusinessPartnerKind) { return kind === "SUBCONTRACTOR" ? "/facturas-subcontratas" : "/facturas-proveedor"; }
function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function optionalText(formData: FormData, key: string) { return text(formData, key) || null; }
function requiredText(formData: FormData, key: string, base: string) { const value = text(formData, key); if (!value) fail(base, "required_fields"); return value.slice(0, 500); }
function requiredDate(value: string, base: string) { const date = new Date(`${value}T12:00:00.000Z`); if (!value || Number.isNaN(date.getTime())) fail(base, "invalid_date"); return date; }
function optionalDate(value: string, base: string) { return value ? requiredDate(value, base) : null; }
function requiredNumber(value: string, min: number, max: number, base: string) { const number = Number(value.replace(",", ".")); if (!Number.isFinite(number) || number < min || number > max) fail(base, "invalid_amount"); return round(number); }
function optionalNumber(value: string, min: number, max: number, base: string) { return value ? requiredNumber(value, min, max, base) : null; }
function optionalInteger(value: string, min: number, max: number, base: string) { if (!value) return null; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < min || parsed > max) fail(base, "invalid_number"); return parsed; }
function optionalEnum<T extends string>(value: string, allowed: readonly string[]) { return allowed.includes(value) ? value as T : null; }
function requiredEnum<T extends string>(value: string, allowed: readonly string[], base: string) { const parsed = optionalEnum<T>(value, allowed); if (!parsed) fail(base, "required_fields"); return parsed; }
function certifications(formData: FormData) { const textValue = text(formData, "certifications"); return textValue ? { summary: textValue.slice(0, 2000) } : undefined; }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function fail(base: string, code: string, hasQuery = false): never { redirect(`${base}${hasQuery ? "&" : "?"}error=${code}`); }
function revalidateProcurement() {
  for (const path of ["/proveedores", "/subcontratas", "/facturas-proveedor", "/facturas-subcontratas", "/gastos-materiales", "/tesoreria", "/obras", "/hoy"]) revalidatePath(path);
}
