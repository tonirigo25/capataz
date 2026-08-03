import type { BusinessPartnerStatus, DocumentCategory, PurchaseInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SupplierRiskBand = "low" | "medium" | "high";
export type SupplierQualityBand = "high" | "good" | "acceptable" | "unrated";

export type SupplierWorkspaceQuery = {
  search?: string;
  status?: string;
  category?: string;
  risk?: string;
  quality?: string;
  overdueOnly?: boolean;
  pendingOnly?: boolean;
  missingContractOnly?: boolean;
  order?: string;
};

export type SupplierWorkspaceItem = Awaited<ReturnType<typeof getSupplierWorkspace>>["filtered"][number];

export async function getSupplierWorkspace(companyId: string, query: SupplierWorkspaceQuery = {}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const search = query.search?.trim().slice(0, 120).toLocaleLowerCase("es-ES") ?? "";
  const partners = await prisma.businessPartner.findMany({
    where: { companyId, kind: "SUPPLIER", archivedAt: null },
    include: {
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          pendingAmount: true,
          status: true,
          dueDate: true,
          issueDate: true,
          updatedAt: true,
        },
      },
      documents: {
        where: { archivedAt: null },
        select: { id: true, name: true, category: true, createdAt: true },
      },
      history: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, action: true, detail: true, createdAt: true },
      },
      _count: { select: { workLinks: true, expenses: true } },
    },
    orderBy: [{ status: "asc" }, { commercialName: "asc" }],
  });

  const items = partners.map((partner) => {
    const validInvoices = partner.invoices.filter((invoice) => invoice.status !== "VOID");
    const pendingInvoices = validInvoices.filter((invoice) => invoice.pendingAmount > 0.005);
    const overdueInvoices = pendingInvoices.filter((invoice) => invoice.dueDate < startOfDay(now));
    const totalSpend = sum(validInvoices.map((invoice) => invoice.total));
    const pendingAmount = sum(pendingInvoices.map((invoice) => invoice.pendingAmount));
    const overdueAmount = sum(overdueInvoices.map((invoice) => invoice.pendingAmount));
    const overdueDays = overdueInvoices.length
      ? Math.max(...overdueInvoices.map((invoice) => daysBetween(invoice.dueDate, now)))
      : 0;
    const category = supplierCategory(partner.specialty, partner.tags);
    const riskScore = supplierRiskScore({
      status: partner.status,
      pendingAmount,
      overdueAmount,
      overdueDays,
      hasTaxId: Boolean(partner.taxId),
      hasContact: Boolean(partner.contactPerson || partner.email || partner.phone),
      documentStatus: partner.documentStatus,
    });
    const risk = supplierRiskBand(riskScore);
    const qualityScore = partner.internalRating == null ? null : clamp(partner.internalRating * 20, 0, 100);
    const quality = supplierQualityBand(qualityScore);
    const contract = partner.documents.find((document) => document.category === "contrato") ?? null;
    const lastInvoice = [...partner.invoices].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null;
    const lastHistory = partner.history[0] ?? null;
    const lastActivityAt = newestDate([partner.updatedAt, lastInvoice?.updatedAt, lastHistory?.createdAt]);
    return {
      id: partner.id,
      commercialName: partner.commercialName,
      legalName: partner.legalName,
      taxId: partner.taxId,
      status: partner.status,
      category,
      tags: partner.tags,
      riskScore,
      risk,
      qualityScore,
      quality,
      contactPerson: partner.contactPerson,
      email: partner.email,
      phone: partner.phone,
      invoiceCount: validInvoices.length,
      pendingInvoiceCount: pendingInvoices.length,
      overdueInvoiceCount: overdueInvoices.length,
      totalSpend,
      pendingAmount,
      overdueAmount,
      overdueDays,
      contract: contract ? { id: contract.id, name: contract.name, createdAt: contract.createdAt } : null,
      workCount: partner._count.workLinks,
      expenseCount: partner._count.expenses,
      lastActivityAt,
      lastActivity: lastHistory?.detail ?? (lastInvoice ? `Factura ${lastInvoice.invoiceNumber} actualizada` : "Ficha de proveedor actualizada"),
    };
  });

  const filtered = items.filter((item) => {
    if (query.status && query.status !== "all" && item.status !== query.status) return false;
    if (query.category && query.category !== "all" && item.category !== query.category) return false;
    if (query.risk && query.risk !== "all" && item.risk !== query.risk) return false;
    if (query.quality && query.quality !== "all" && item.quality !== query.quality) return false;
    if (query.overdueOnly && item.overdueInvoiceCount === 0) return false;
    if (query.pendingOnly && item.pendingInvoiceCount === 0) return false;
    if (query.missingContractOnly && item.contract) return false;
    if (search && ![item.commercialName, item.legalName, item.taxId, item.contactPerson, item.email, item.phone, item.category, ...item.tags]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("es-ES")
      .includes(search)) return false;
    return true;
  }).sort((left, right) => query.order === "spend"
    ? right.totalSpend - left.totalSpend
    : query.order === "risk"
      ? left.riskScore - right.riskScore
      : left.commercialName.localeCompare(right.commercialName, "es"));

  const allInvoices = partners.flatMap((partner) => partner.invoices.filter((invoice) => invoice.status !== "VOID"));
  const categories = categoryDistribution(items);
  const rated = items.filter((item) => item.qualityScore != null);
  const highRisk = items.filter((item) => item.risk === "high").sort((left, right) => left.riskScore - right.riskScore);
  const attention = items.filter((item) => item.risk !== "low").sort((left, right) => left.riskScore - right.riskScore);
  const riskAverage = items.length ? Math.round(sum(items.map((item) => item.riskScore)) / items.length) : null;
  const qualityAverage = rated.length ? Math.round(sum(rated.map((item) => item.qualityScore ?? 0)) / rated.length) : null;
  const recentActivity = items
    .map((item) => ({ id: item.id, supplier: item.commercialName, detail: item.lastActivity, date: item.lastActivityAt, href: `/proveedores/${item.id}` }))
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 5);

  return {
    items,
    filtered,
    categories,
    recentActivity,
    attention: (highRisk.length ? highRisk : attention).slice(0, 3),
    metrics: {
      active: items.filter((item) => item.status === "ACTIVE").length,
      mtdSpend: sum(allInvoices.filter((invoice) => invoice.issueDate >= monthStart).map((invoice) => invoice.total)),
      pendingInvoices: allInvoices.filter((invoice) => invoice.pendingAmount > 0.005).length,
      pendingAmount: sum(allInvoices.filter((invoice) => invoice.pendingAmount > 0.005).map((invoice) => invoice.pendingAmount)),
      riskAverage,
      qualityAverage,
      overdueExposure: sum(items.map((item) => item.overdueAmount)),
      overdueInvoices: sum(items.map((item) => item.overdueInvoiceCount)),
    },
    series: {
      active: monthlySeries(partners.map((partner) => ({ date: partner.createdAt, value: 1 })), true),
      spend: monthlySeries(allInvoices.map((invoice) => ({ date: invoice.issueDate, value: invoice.total }))),
      pending: monthlySeries(allInvoices.filter((invoice) => invoice.pendingAmount > 0.005).map((invoice) => ({ date: invoice.dueDate, value: 1 }))),
      risk: normalizedSeries(items.map((item) => item.riskScore)),
      quality: normalizedSeries(rated.map((item) => item.qualityScore ?? 0)),
    },
  };
}

function supplierCategory(specialty: string | null, tags: string[]) {
  return specialty?.trim() || tags.find((tag) => tag.trim())?.trim() || "Sin categoría";
}

function supplierRiskScore(input: {
  status: BusinessPartnerStatus;
  pendingAmount: number;
  overdueAmount: number;
  overdueDays: number;
  hasTaxId: boolean;
  hasContact: boolean;
  documentStatus: string;
}) {
  let score = 100;
  if (input.status === "BLOCKED") score -= 70;
  else if (input.status === "INACTIVE") score -= 30;
  if (input.pendingAmount > 0 && input.overdueAmount > 0) score -= Math.round(Math.min(35, (input.overdueAmount / input.pendingAmount) * 35));
  if (input.overdueDays > 60) score -= 25;
  else if (input.overdueDays > 30) score -= 16;
  else if (input.overdueDays > 0) score -= 8;
  if (!input.hasTaxId) score -= 5;
  if (!input.hasContact) score -= 5;
  if (input.documentStatus === "EXPIRED") score -= 15;
  else if (input.documentStatus === "EXPIRING" || input.documentStatus === "INCOMPLETE") score -= 8;
  return clamp(score, 0, 100);
}

function supplierRiskBand(score: number): SupplierRiskBand {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

function supplierQualityBand(score: number | null): SupplierQualityBand {
  if (score == null) return "unrated";
  if (score >= 85) return "high";
  if (score >= 65) return "good";
  return "acceptable";
}

function categoryDistribution(items: Array<{ category: string; totalSpend: number }>) {
  const grouped = new Map<string, { count: number; spend: number }>();
  for (const item of items) {
    const current = grouped.get(item.category) ?? { count: 0, spend: 0 };
    grouped.set(item.category, { count: current.count + 1, spend: current.spend + item.totalSpend });
  }
  return [...grouped.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.count - left.count);
}

function monthlySeries(entries: Array<{ date: Date; value: number }>, cumulative = false) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { year: date.getFullYear(), month: date.getMonth(), value: 0 };
  });
  for (const entry of entries) {
    const bucket = buckets.find((candidate) => candidate.year === entry.date.getFullYear() && candidate.month === entry.date.getMonth());
    if (bucket) bucket.value += entry.value;
  }
  if (cumulative) {
    let running = Math.max(0, entries.length - sum(buckets.map((bucket) => bucket.value)));
    for (const bucket of buckets) { running += bucket.value; bucket.value = running; }
  }
  return normalizedSeries(buckets.map((bucket) => bucket.value));
}

function normalizedSeries(values: number[]) {
  if (!values.length) return [0, 0, 0, 0, 0, 0];
  if (values.length >= 6) return values.slice(-6);
  return [...Array.from({ length: 6 - values.length }, () => values[0] ?? 0), ...values];
}

function newestDate(values: Array<Date | null | undefined>) {
  return new Date(Math.max(...values.filter((value): value is Date => value instanceof Date).map((value) => value.getTime())));
}

function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function daysBetween(from: Date, to: Date) { return Math.max(0, Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000)); }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, Math.round(value))); }

export function supplierStatusLabel(status: BusinessPartnerStatus) {
  return status === "ACTIVE" ? "Activo" : status === "BLOCKED" ? "Bloqueado" : "Inactivo";
}

export function supplierRiskLabel(risk: SupplierRiskBand) { return risk === "low" ? "Bajo" : risk === "medium" ? "Medio" : "Alto"; }
export function supplierQualityLabel(quality: SupplierQualityBand) { return quality === "high" ? "Alta" : quality === "good" ? "Buena" : quality === "acceptable" ? "Aceptable" : "Sin valorar"; }
export function invoiceStatusIsPending(status: PurchaseInvoiceStatus) { return status !== "PAID" && status !== "VOID"; }
export function isContractCategory(category: DocumentCategory) { return category === "contrato"; }
