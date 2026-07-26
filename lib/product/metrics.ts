import type { PrismaClient } from "@prisma/client";

export async function buildPlatformHealthSnapshot(prisma: PrismaClient, now = new Date()) {
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const retentionStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4, 1));
  const [companies, activeEvents, activationEvents, budgets, payments, ai, support, costs, reconciliations, pilots, feedback, experiments] = await Promise.all([
    prisma.company.findMany({ where: { archivedAt: null, isDemo: false }, select: { id: true, createdAt: true } }),
    prisma.productEvent.findMany({ where: { eventName: "user.active", occurredAt: { gte: retentionStart, lte: now } }, select: { companyId: true, actorHash: true, occurredAt: true } }),
    prisma.productEvent.findMany({ where: { eventName: { startsWith: "activation." }, occurredAt: { lte: now } }, select: { companyId: true, eventName: true, properties: true, occurredAt: true } }),
    prisma.budget.groupBy({ by: ["estado"], where: { companyId: { not: null } }, _count: { id: true } }),
    prisma.payment.findMany({ where: { companyId: { not: null } }, select: { facturaId: true, fecha: true, importe: true, invoice: { select: { fechaEmision: true, fechaVencimiento: true } } } }),
    prisma.aiUsageEvent.aggregate({ _count: { id: true }, _sum: { costAmount: true, inputTokens: true, outputTokens: true } }),
    prisma.supportTicket.aggregate({ _count: { id: true }, _sum: { supportMinutes: true }, where: { createdAt: { gte: quarterStart } } }),
    prisma.companyServiceCost.groupBy({ by: ["category"], where: { verified: true, periodEnd: { gte: quarterStart }, periodStart: { lte: now } }, _sum: { amount: true } }),
    prisma.billingReconciliationRun.findMany({ where: { provider: "stripe", status: "MATCHED", divergenceCount: 0, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, select: { companyId: true, providerSnapshot: true, completedAt: true } }),
    prisma.pilotCohort.groupBy({ by: ["status", "paid"], _count: { id: true } }),
    prisma.pilotFeedback.groupBy({ by: ["category"], where: { consentGranted: true }, _count: { id: true }, _avg: { score: true } }),
    prisma.productExperiment.groupBy({ by: ["status"], _count: { id: true } }),
  ]);
  const wauEvents = activeEvents.filter((event) => event.occurredAt >= weekStart);
  const wauUsers = new Set(wauEvents.flatMap((event) => event.actorHash ? [event.actorHash] : [])).size;
  const wauCompanies = new Set(wauEvents.flatMap((event) => event.companyId ? [event.companyId] : [])).size;
  const activatedCompanies = new Set(activationEvents.filter((event) => event.eventName === "activation.completed").flatMap((event) => event.companyId ? [event.companyId] : [])).size;
  const activationWithin7 = new Set(activationEvents.filter((event) => event.eventName === "activation.completed" && (event.properties as { withinSevenDays?: boolean } | null)?.withinSevenDays).flatMap((event) => event.companyId ? [event.companyId] : [])).size;
  const activeByCompany = new Map<string, Date[]>();
  for (const event of activeEvents) if (event.companyId) activeByCompany.set(event.companyId, [...(activeByCompany.get(event.companyId) ?? []), event.occurredAt]);
  const retention = [1, 2, 3].map((month) => {
    const eligible = companies.filter((company) => now.getTime() >= addMonths(company.createdAt, month).getTime());
    const retained = eligible.filter((company) => (activeByCompany.get(company.id) ?? []).some((date) => monthDifference(company.createdAt, date) === month)).length;
    return { month: `M${month}`, eligible: eligible.length, retained, rate: eligible.length ? retained / eligible.length : null };
  });
  const latestReconciliation = new Map<string, typeof reconciliations[number]>();
  for (const row of reconciliations) if (!latestReconciliation.has(row.companyId)) latestReconciliation.set(row.companyId, row);
  const reconciledMrr = [...latestReconciliation.values()].map((row) => Number((row.providerSnapshot as { mrrEur?: unknown }).mrrEur)).filter((value) => Number.isFinite(value) && value >= 0);
  const mrr = reconciledMrr.reduce((sum, value) => sum + value, 0);
  const verifiedCost = costs.reduce((sum, item) => sum + Number(item._sum.amount ?? 0), 0);
  const decided = budgets.filter((item) => ["aceptado", "rechazado", "caducado"].includes(item.estado)).reduce((sum, item) => sum + item._count.id, 0);
  const accepted = budgets.find((item) => item.estado === "aceptado")?._count.id ?? 0;
  const collectionDays = payments.map((payment) => Math.max(0, (payment.fecha.getTime() - payment.invoice.fechaEmision.getTime()) / 86_400_000));
  const recoveredDebt = payments.filter((payment) => payment.fecha > payment.invoice.fechaVencimiento).reduce((sum, payment) => sum + payment.importe, 0);
  const timeSavedEvents = await prisma.productEvent.findMany({ where: { eventName: { in: ["outcome.time_saved", "outcome.ai_action"] }, occurredAt: { gte: quarterStart } }, select: { properties: true } });
  const minutesSaved = timeSavedEvents.reduce((sum, event) => sum + Number((event.properties as { minutes?: number; minutesSaved?: number } | null)?.minutes ?? (event.properties as { minutesSaved?: number } | null)?.minutesSaved ?? 0), 0);
  return {
    calculatedAt: now,
    methodologyVersion: "f8-v1",
    population: { companies: companies.length },
    activation: { activatedCompanies, withinSevenDays: activationWithin7, rate: activatedCompanies ? activationWithin7 / activatedCompanies : null },
    wau: { users: wauUsers, companies: wauCompanies, windowDays: 7 },
    retention,
    commercial: { mrrEur: mrr, arpaEur: reconciledMrr.length ? mrr / reconciledMrr.length : null, reconciledCompanies: reconciledMrr.length, localSimulationIncluded: false },
    economics: { verifiedCostEur: verifiedCost, grossMarginEur: mrr - verifiedCost, grossMarginRate: mrr > 0 ? (mrr - verifiedCost) / mrr : null, costCategories: Object.fromEntries(costs.map((item) => [item.category, Number(item._sum.amount ?? 0)])) },
    value: { budgetConversionRate: decided ? accepted / decided : null, acceptedBudgets: accepted, averageCollectionDays: collectionDays.length ? collectionDays.reduce((sum, value) => sum + value, 0) / collectionDays.length : null, recoveredDebtEur: recoveredDebt, minutesSaved },
    ai: { calls: ai._count.id, inputTokens: ai._sum.inputTokens ?? 0, outputTokens: ai._sum.outputTokens ?? 0, costEur: Number(ai._sum.costAmount ?? 0) },
    support: { tickets: support._count.id, hours: Number(support._sum.supportMinutes ?? 0) / 60 },
    pilots, feedback, experiments,
  };
}

function addMonths(date: Date, months: number) { const value = new Date(date); value.setUTCMonth(value.getUTCMonth() + months); return value; }
function monthDifference(start: Date, end: Date) { return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth(); }
