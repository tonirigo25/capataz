import type { BusinessPartnerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SubcontractorQuery = {
  search?: string;
  status?: string;
  specialty?: string;
  compliance?: string;
  works?: string;
  view?: string;
};

export type SubcontractorItem = Awaited<ReturnType<typeof getSubcontractorWorkspace>>["filtered"][number];

export async function getSubcontractorWorkspace(companyId: string, query: SubcontractorQuery = {}) {
  const now = new Date();
  const search = query.search?.trim().slice(0, 120).toLocaleLowerCase("es-ES") ?? "";
  const partners = await prisma.businessPartner.findMany({
    where: { companyId, kind: "SUBCONTRACTOR", archivedAt: null },
    include: {
      workLinks: { include: { work: { select: { id: true, titulo: true, estado: true, archivada: true } } } },
      invoices: { select: { id: true, invoiceNumber: true, total: true, pendingAmount: true, status: true, dueDate: true, issueDate: true, payments: { select: { paidAt: true } } } },
      documents: { where: { archivedAt: null }, select: { id: true, name: true, category: true, createdAt: true } },
      history: { orderBy: { createdAt: "desc" }, take: 1, select: { detail: true, createdAt: true } },
    },
    orderBy: [{ status: "asc" }, { commercialName: "asc" }],
  });

  const items = partners.map((partner) => {
    const invoices = partner.invoices.filter((invoice) => invoice.status !== "VOID");
    const pending = invoices.filter((invoice) => invoice.pendingAmount > 0.005);
    const overdue = pending.filter((invoice) => invoice.dueDate < startOfDay(now));
    const paid = invoices.filter((invoice) => invoice.status === "PAID");
    const paidOnTime = paid.filter((invoice) => {
      const lastPayment = invoice.payments.map((payment) => payment.paidAt).sort((a, b) => b.getTime() - a.getTime())[0];
      return lastPayment != null && lastPayment <= endOfDay(invoice.dueDate);
    });
    const activeWorks = partner.workLinks.filter((link) => !link.work.archivada && activeWorkStatus(link.work.estado));
    const complianceScore = documentCompliance(partner.documentStatus);
    const rating = partner.internalRating == null ? null : Math.min(5, Math.max(1, partner.internalRating));
    const total = sum(invoices.map((invoice) => invoice.total));
    const pendingAmount = sum(pending.map((invoice) => invoice.pendingAmount));
    const overdueAmount = sum(overdue.map((invoice) => invoice.pendingAmount));
    const paymentRate = paid.length ? Math.round((paidOnTime.length / paid.length) * 100) : null;
    const latest = partner.history[0];
    return {
      id: partner.id,
      commercialName: partner.commercialName,
      legalName: partner.legalName,
      taxId: partner.taxId,
      status: partner.status,
      specialty: partner.specialty?.trim() || partner.tradeType?.trim() || "Sin especialidad",
      tradeType: partner.tradeType,
      contactPerson: partner.contactPerson,
      phone: partner.phone,
      email: partner.email,
      liabilityInsurance: partner.liabilityInsurance,
      documentStatus: partner.documentStatus,
      documentExpiresAt: partner.documentExpiresAt,
      documentCount: partner.documents.length,
      complianceScore,
      rating,
      workCount: partner.workLinks.length,
      activeWorkCount: activeWorks.length,
      activeWorks: activeWorks.slice(0, 3).map((link) => ({ id: link.work.id, title: link.work.titulo })),
      invoiceCount: invoices.length,
      total,
      pendingAmount,
      overdueAmount,
      overdueCount: overdue.length,
      paymentRate,
      lastActivity: latest?.detail ?? "Ficha de subcontrata actualizada",
      lastActivityAt: latest?.createdAt ?? partner.updatedAt,
      createdAt: partner.createdAt,
    };
  });

  const specialties = [...new Set(items.map((item) => item.specialty))].sort((a, b) => a.localeCompare(b, "es"));
  const filtered = items.filter((item) => {
    if (query.status && query.status !== "all" && item.status !== query.status) return false;
    if (query.specialty && query.specialty !== "all" && item.specialty !== query.specialty) return false;
    if (query.compliance === "excellent" && (item.complianceScore == null || item.complianceScore < 90)) return false;
    if (query.compliance === "attention" && (item.complianceScore == null || item.complianceScore >= 90)) return false;
    if (query.compliance === "unrated" && item.complianceScore != null) return false;
    if (query.works === "active" && item.activeWorkCount === 0) return false;
    if (query.works === "none" && item.activeWorkCount > 0) return false;
    if (query.view === "pagos" && item.pendingAmount <= 0) return false;
    if (query.view === "evaluaciones" && item.rating != null) return false;
    if (search && ![item.commercialName, item.legalName, item.taxId, item.specialty, item.tradeType, item.contactPerson, item.email]
      .filter(Boolean).join(" ").toLocaleLowerCase("es-ES").includes(search)) return false;
    return true;
  }).sort((left, right) => query.view === "cumplimiento"
    ? (left.complianceScore ?? -1) - (right.complianceScore ?? -1)
    : left.commercialName.localeCompare(right.commercialName, "es"));

  const complianceValues = items.map((item) => item.complianceScore).filter((value): value is number => value != null);
  const paidRates = items.map((item) => item.paymentRate).filter((value): value is number => value != null);
  const rated = items.filter((item) => item.rating != null);
  const expiring = items.filter((item) => item.documentStatus === "EXPIRING" || item.documentStatus === "EXPIRED" || item.documentStatus === "INCOMPLETE");
  const pendingEvaluations = items.filter((item) => item.rating == null);
  const distribution = [
    { key: "excellent", label: "Excelente (90–100%)", count: items.filter((item) => (item.complianceScore ?? -1) >= 90).length },
    { key: "good", label: "Bueno (70–89%)", count: items.filter((item) => item.complianceScore != null && item.complianceScore >= 70 && item.complianceScore < 90).length },
    { key: "acceptable", label: "Aceptable (50–69%)", count: items.filter((item) => item.complianceScore != null && item.complianceScore >= 50 && item.complianceScore < 70).length },
    { key: "critical", label: "Crítico (<50%)", count: items.filter((item) => item.complianceScore != null && item.complianceScore < 50).length },
  ];

  return {
    items,
    filtered,
    specialties,
    distribution,
    attention: [...items].filter((item) => item.overdueCount > 0 || item.documentStatus === "EXPIRED" || item.documentStatus === "EXPIRING").sort((a, b) => b.overdueAmount - a.overdueAmount),
    metrics: {
      active: items.filter((item) => item.status === "ACTIVE").length,
      worksWithSubcontractors: new Set(items.flatMap((item) => item.activeWorks.map((work) => work.id))).size,
      complianceAverage: average(complianceValues),
      paymentRate: average(paidRates),
      expiringDocuments: expiring.length,
      pendingEvaluations: pendingEvaluations.length,
      pendingAmount: sum(items.map((item) => item.pendingAmount)),
      overdueAmount: sum(items.map((item) => item.overdueAmount)),
      activeWorks: sum(items.map((item) => item.activeWorkCount)),
      ratedAverage: rated.length ? Math.round((sum(rated.map((item) => item.rating ?? 0)) / rated.length) * 10) / 10 : null,
    },
  };
}

export function subcontractorStatusLabel(status: BusinessPartnerStatus) {
  return status === "ACTIVE" ? "Activa" : status === "BLOCKED" ? "Bloqueada" : "Inactiva";
}

export function documentStatusLabel(status: string) {
  return ({ VALID: "Vigente", EXPIRING: "Próxima a caducar", EXPIRED: "Caducada", INCOMPLETE: "Incompleta", NOT_REQUIRED: "No requerida" } as Record<string, string>)[status] ?? status;
}

function documentCompliance(status: string) {
  if (status === "VALID") return 100;
  if (status === "EXPIRING") return 75;
  if (status === "INCOMPLETE") return 50;
  if (status === "EXPIRED") return 0;
  return null;
}
function activeWorkStatus(status: string) { return !["finalizada", "facturada", "pendiente_cobro", "cobrada", "cerrada", "archivada"].includes(status); }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function endOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999); }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function average(values: number[]) { return values.length ? Math.round(sum(values) / values.length) : null; }
