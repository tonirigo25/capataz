import type {
  BusinessPartnerKind,
  ExpenseCategory,
  FiscalDocumentType,
  Prisma,
  PurchaseInvoiceStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PARTNER_STATUS_OPTIONS = [
  ["ACTIVE", "Activo"],
  ["INACTIVE", "Inactivo"],
  ["BLOCKED", "Bloqueado"]
] as const;

export const PURCHASE_CATEGORY_OPTIONS: Array<[ExpenseCategory, string]> = [
  ["materiales", "Materiales"],
  ["combustible", "Combustible"],
  ["restauracion", "Restauración"],
  ["herramientas", "Herramientas"],
  ["maquinaria", "Maquinaria"],
  ["transportes", "Transportes"],
  ["subcontrata", "Subcontratas"],
  ["servicios", "Servicios"],
  ["suministros", "Suministros"],
  ["otros", "Otros"]
];

export const FISCAL_DOCUMENT_OPTIONS: Array<[FiscalDocumentType, string]> = [
  ["FULL_INVOICE", "Factura completa"],
  ["SIMPLIFIED_INVOICE", "Factura simplificada"],
  ["CORRECTIVE_INVOICE", "Factura rectificativa"]
];

export type PartnerListQuery = {
  search?: string;
  status?: string;
  tag?: string;
  duplicate?: boolean;
};

export async function getPartnerList(companyId: string, kind: BusinessPartnerKind, query: PartnerListQuery = {}) {
  const search = clean(query.search, 120);
  const partners = await prisma.businessPartner.findMany({
    where: {
      companyId,
      kind,
      archivedAt: null,
      ...(query.status && ["ACTIVE", "INACTIVE", "BLOCKED"].includes(query.status) ? { status: query.status as never } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(search ? {
        OR: [
          { commercialName: { contains: search, mode: "insensitive" } },
          { legalName: { contains: search, mode: "insensitive" } },
          { taxId: { contains: normalizeTaxId(search), mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
          { specialty: { contains: search, mode: "insensitive" } }
        ]
      } : {})
    },
    include: {
      invoices: { select: { total: true, pendingAmount: true, status: true, dueDate: true } },
      workLinks: { select: { workId: true } },
      documents: { where: { archivedAt: null }, select: { id: true } },
      _count: { select: { expenses: true, history: true } }
    },
    orderBy: [{ status: "asc" }, { commercialName: "asc" }]
  });
  const taxCounts = countBy(partners.map((partner) => normalizeTaxId(partner.taxId)).filter(Boolean) as string[]);
  const nameCounts = countBy(partners.map((partner) => normalizeName(partner.commercialName)));
  const items = partners.map((partner) => ({
    ...partner,
    invoiced: sum(partner.invoices.map((invoice) => invoice.total)),
    pending: sum(partner.invoices.filter((invoice) => invoice.status !== "VOID").map((invoice) => invoice.pendingAmount)),
    overdue: sum(partner.invoices.filter((invoice) => invoice.status !== "VOID" && invoice.pendingAmount > 0 && invoice.dueDate < new Date()).map((invoice) => invoice.pendingAmount)),
    duplicate: (partner.taxId && (taxCounts.get(normalizeTaxId(partner.taxId)) ?? 0) > 1) || (nameCounts.get(normalizeName(partner.commercialName)) ?? 0) > 1
  })).filter((partner) => !query.duplicate || partner.duplicate);
  return {
    items,
    total: items.length,
    active: items.filter((partner) => partner.status === "ACTIVE").length,
    blocked: items.filter((partner) => partner.status === "BLOCKED").length,
    pending: sum(items.map((partner) => partner.pending)),
    tags: [...new Set(partners.flatMap((partner) => partner.tags))].sort()
  };
}

export async function getPartnerDetail(companyId: string, id: string, kind: BusinessPartnerKind) {
  return prisma.businessPartner.findFirst({
    where: { id, companyId, kind, archivedAt: null },
    include: {
      documents: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      expenses: { orderBy: { fecha: "desc" }, take: 30, include: { work: { select: { id: true, titulo: true } } } },
      invoices: { orderBy: { issueDate: "desc" }, include: { work: { select: { id: true, titulo: true } }, payments: true } },
      workLinks: { include: { work: { select: { id: true, titulo: true, estado: true } } } },
      history: { orderBy: { createdAt: "desc" }, take: 40 },
      learning: { include: { preferredWork: { select: { id: true, titulo: true } } } }
    }
  });
}

export async function getPurchaseInvoiceList(companyId: string, kind: BusinessPartnerKind, query: { search?: string; status?: string } = {}) {
  await markOverduePurchaseInvoices(companyId);
  const search = clean(query.search, 120);
  return prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      kind,
      ...(query.status && ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].includes(query.status) ? { status: query.status as never } : {}),
      ...(search ? { OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { businessPartner: { is: { OR: [
          { commercialName: { contains: search, mode: "insensitive" } },
          { taxId: { contains: normalizeTaxId(search), mode: "insensitive" } }
        ] } } }
      ] } : {})
    },
    include: {
      businessPartner: { select: { id: true, commercialName: true, taxId: true, status: true } },
      work: { select: { id: true, titulo: true } },
      payments: { orderBy: { paidAt: "desc" } },
      documents: { where: { archivedAt: null }, select: { id: true, name: true } },
      expense: { select: { id: true } }
    },
    orderBy: [{ dueDate: "asc" }, { issueDate: "desc" }]
  });
}

export async function getPurchaseInvoiceDetail(companyId: string, id: string, kind: BusinessPartnerKind) {
  await markOverduePurchaseInvoices(companyId);
  return prisma.purchaseInvoice.findFirst({
    where: { id, companyId, kind },
    include: {
      businessPartner: true,
      work: { select: { id: true, titulo: true } },
      payments: { orderBy: { paidAt: "desc" } },
      documents: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      expense: true,
      history: { orderBy: { createdAt: "desc" } }
    }
  });
}

export async function findPartnerDuplicates(companyId: string, input: { kind: BusinessPartnerKind; taxId?: string | null; commercialName?: string | null; excludeId?: string }) {
  const taxId = normalizeTaxId(input.taxId);
  const name = clean(input.commercialName, 180);
  if (!taxId && !name) return [];
  return prisma.businessPartner.findMany({
    where: {
      companyId,
      kind: input.kind,
      archivedAt: null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(taxId ? [{ taxId: { equals: taxId, mode: "insensitive" as const } }] : []),
        ...(name ? [{ commercialName: { equals: name, mode: "insensitive" as const } }] : [])
      ]
    },
    select: { id: true, commercialName: true, legalName: true, taxId: true, status: true },
    take: 10
  });
}

export async function getPartnerSuggestion(companyId: string, input: { issuerTaxId?: string | null; issuerName?: string | null }) {
  const taxId = normalizeTaxId(input.issuerTaxId);
  const issuerName = clean(input.issuerName, 180);
  if (!taxId && !issuerName) return null;
  return prisma.businessPartner.findFirst({
    where: {
      companyId,
      archivedAt: null,
      OR: [
        ...(taxId ? [{ taxId: { equals: taxId, mode: "insensitive" as const } }] : []),
        ...(issuerName ? [
          { commercialName: { equals: issuerName, mode: "insensitive" as const } },
          { legalName: { equals: issuerName, mode: "insensitive" as const } }
        ] : [])
      ]
    },
    include: { learning: true },
    orderBy: { updatedAt: "desc" }
  });
}

export function validateSpanishTaxId(value: string | null | undefined) {
  const taxId = normalizeTaxId(value);
  if (!taxId) return { valid: true, normalized: null };
  return { valid: /^[A-Z0-9][A-Z0-9]{7,8}$/.test(taxId), normalized: taxId };
}

export function purchaseInvoiceStatus(input: { total: number; paidAmount: number; dueDate: Date; voided?: boolean }, now = new Date()): PurchaseInvoiceStatus {
  if (input.voided) return "VOID";
  if (input.paidAmount >= input.total - 0.005) return "PAID";
  if (input.dueDate < startOfDay(now)) return "OVERDUE";
  if (input.paidAmount > 0) return "PARTIALLY_PAID";
  return "PENDING";
}

export function parsePurchaseAmounts(input: {
  taxableBase: unknown;
  vatAmount: unknown;
  withholdingAmount: unknown;
  total: unknown;
}) {
  const taxableBase = money(input.taxableBase);
  const vatAmount = money(input.vatAmount) ?? 0;
  const withholdingAmount = money(input.withholdingAmount) ?? 0;
  const total = money(input.total);
  if (taxableBase == null || taxableBase < 0 || total == null || total < 0 || vatAmount < 0 || withholdingAmount < 0) {
    throw new Error("Revisa base, impuestos y total.");
  }
  const calculated = round(taxableBase + vatAmount - withholdingAmount);
  if (Math.abs(total - calculated) > Math.max(0.05, total * 0.015)) throw new Error("La base, el IVA, el IRPF y el total no cuadran.");
  return { taxableBase, vatAmount, withholdingAmount, total };
}

export function expenseCategoryForPurchase(kind: BusinessPartnerKind, value: string | null | undefined): ExpenseCategory {
  const allowed = new Set(PURCHASE_CATEGORY_OPTIONS.map(([id]) => id));
  return allowed.has(value as ExpenseCategory) ? value as ExpenseCategory : kind === "SUBCONTRACTOR" ? "subcontrata" : "otros";
}

export async function updatePartnerLearning(tx: Prisma.TransactionClient, input: {
  companyId: string;
  businessPartnerId: string;
  category: ExpenseCategory;
  workId: string | null;
  vatRate: number | null;
}) {
  const current = await tx.partnerLearning.findUnique({ where: { businessPartnerId: input.businessPartnerId } });
  const categoryConfirmations = current?.preferredCategory === input.category ? current.categoryConfirmations + 1 : 1;
  const workConfirmations = input.workId && current?.preferredWorkId === input.workId ? current.workConfirmations + 1 : input.workId ? 1 : current?.workConfirmations ?? 0;
  const vatConfirmations = input.vatRate != null && current?.preferredVatRate === input.vatRate ? current.vatConfirmations + 1 : input.vatRate != null ? 1 : current?.vatConfirmations ?? 0;
  await tx.partnerLearning.upsert({
    where: { businessPartnerId: input.businessPartnerId },
    create: {
      companyId: input.companyId,
      businessPartnerId: input.businessPartnerId,
      preferredCategory: input.category,
      preferredWorkId: input.workId,
      preferredVatRate: input.vatRate,
      categoryConfirmations,
      workConfirmations,
      vatConfirmations
    },
    update: {
      preferredCategory: input.category,
      preferredWorkId: input.workId ?? current?.preferredWorkId,
      preferredVatRate: input.vatRate ?? current?.preferredVatRate,
      categoryConfirmations,
      workConfirmations,
      vatConfirmations
    }
  });
}

async function markOverduePurchaseInvoices(companyId: string) {
  await prisma.purchaseInvoice.updateMany({
    where: { companyId, status: { in: ["PENDING", "PARTIALLY_PAID"] }, pendingAmount: { gt: 0 }, dueDate: { lt: startOfDay(new Date()) } },
    data: { status: "OVERDUE" }
  });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : null;
}
function normalizeTaxId(value: unknown) { return clean(value, 32)?.toUpperCase().replace(/[\s.\-]/g, "") ?? ""; }
function normalizeName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function countBy(values: string[]) { const result = new Map<string, number>(); for (const value of values) result.set(value, (result.get(value) ?? 0) + 1); return result; }
function money(value: unknown) { const number = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(number) ? round(number) : null; }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function sum(values: number[]) { return round(values.reduce((total, value) => total + value, 0)); }
function startOfDay(value: Date) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
