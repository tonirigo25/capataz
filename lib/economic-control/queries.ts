import { requireCompanyContext } from "@/lib/auth/session";
import { buildDueDateForecast, buildPayableDocuments, buildReceivableDocuments, summarizeEconomicDocuments } from "@/lib/economic-control/metrics";
import type { EconomicArea, EconomicConcentration, EconomicControlData, EconomicDocument, EconomicPeriod } from "@/lib/economic-control/types";
import { prisma } from "@/lib/prisma";
import { getTreasuryOverview } from "@/lib/treasury";
import { getOperationalIntelligence } from "@/lib/operational-intelligence/queries";

export type EconomicControlParams = {
  area?: string;
  period?: string;
  clientId?: string | null;
  workId?: string | null;
  status?: string | null;
  now?: Date;
};

export async function getEconomicControl(params: EconomicControlParams = {}): Promise<EconomicControlData> {
  const { companyId } = await requireCompanyContext();
  const area = validArea(params.area);
  const period = validPeriod(params.period);
  const now = params.now ?? new Date();
  const clientId = clean(params.clientId);
  const workId = clean(params.workId);
  const status = clean(params.status);
  const invoiceScope = { ...(clientId ? { clienteId: clientId } : {}), ...(workId ? { obraId: workId } : {}) };
  const purchaseScope = { ...(workId ? { workId } : {}), ...(!workId && clientId ? { work: { clienteId: clientId } } : {}) };

  const [treasury, invoices, purchaseInvoices, expenses, clients, works, intelligence] = await Promise.all([
    getTreasuryOverview({ companyId, horizon: period, scenario: "base", clientId, workId, now }),
    prisma.invoice.findMany({
      where: { companyId, ...invoiceScope },
      select: { id: true, numero: true, concepto: true, estado: true, total: true, pagado: true, fechaEmision: true, fechaVencimiento: true, client: { select: { id: true, nombre: true } }, work: { select: { id: true, titulo: true } }, payments: { select: { id: true, importe: true } } },
      orderBy: { fechaVencimiento: "asc" },
      take: 500
    }),
    prisma.purchaseInvoice.findMany({
      where: { companyId, ...purchaseScope },
      select: { id: true, invoiceNumber: true, description: true, status: true, total: true, paidAmount: true, issueDate: true, dueDate: true, voidedAt: true, kind: true, businessPartner: { select: { id: true, commercialName: true } }, work: { select: { id: true, titulo: true } }, payments: { select: { id: true, amount: true } } },
      orderBy: { dueDate: "asc" },
      take: 500
    }),
    prisma.expense.findMany({
      where: { companyId, purchaseInvoiceId: null, ...(workId ? { obraId: workId } : {}), ...(clientId ? { clienteId: clientId } : {}) },
      select: { id: true, proveedor: true, concepto: true, importe: true, fecha: true, paymentDueDate: true, paidAt: true, paymentStatus: true, purchaseInvoiceId: true, businessPartner: { select: { id: true, commercialName: true } }, work: { select: { id: true, titulo: true } } },
      orderBy: { paymentDueDate: "asc" },
      take: 500
    }),
    prisma.client.findMany({ where: { companyId, archivadoAt: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" }, take: 250 }),
    prisma.work.findMany({ where: { companyId, archivada: false }, select: { id: true, titulo: true, client: { select: { nombre: true } } }, orderBy: { titulo: "asc" }, take: 250 }),
    getOperationalIntelligence({ clientId: clientId ?? undefined, workId: workId ?? undefined, limit: 30, now })
  ]);

  const allReceivables = buildReceivableDocuments(invoices);
  const allPayables = buildPayableDocuments(purchaseInvoices, expenses);
  const receivables = filterStatus(allReceivables, status, now);
  const payables = filterStatus(allPayables, status, now);
  const forecast = buildDueDateForecast([...allReceivables, ...allPayables], period, treasury.registeredBalance, now);

  return {
    area,
    period,
    updatedAt: now,
    accounts: treasury.accounts.map((account) => ({ id: account.id, name: account.name, type: account.type, balance: account.balance, updatedAt: account.manualBalanceUpdatedAt ?? null, isActive: account.isActive })),
    registeredBalance: treasury.registeredBalance,
    recentMovements: treasury.movements.filter((movement) => movement.status === "confirmed" && !movement.isTransfer).slice(0, 12).map((movement) => ({ id: movement.id, date: movement.date, description: movement.description, amount: movement.amount, direction: movement.direction, accountName: movement.accountName, href: movement.href ?? null })),
    receivables,
    payables,
    receivableSummary: summarizeEconomicDocuments(allReceivables, now),
    payableSummary: summarizeEconomicDocuments(allPayables, now),
    forecast,
    profitability: treasury.workProfitability.map((row) => ({
      workId: row.workId,
      workTitle: row.title,
      clientName: row.clientName,
      status: row.status,
      budgeted: row.budgeted,
      invoiced: row.invoiced,
      collected: row.collected,
      pending: row.pending,
      materialCost: row.materialCost,
      subcontractorCost: row.subcontractorCost,
      generalCost: row.generalCost,
      realCost: row.realCost,
      profit: row.hasEnoughData && row.invoiced > 0 ? row.profitOnInvoiced : null,
      margin: row.hasEnoughData && row.invoiced > 0 ? row.marginOnInvoiced : null,
      forecastCost: row.forecastCost,
      deviation: row.hasEnoughData && row.forecastCost > 0 ? row.costDeviation : null,
      hasEnoughData: row.hasEnoughData && (row.invoiced > 0 || row.realCost > 0),
      href: `/obras/${row.workId}?vista=dinero`
    })),
    clientConcentration: concentration(allReceivables, (id) => `/tesoreria?vista=cobros&cliente=${id}`),
    supplierConcentration: concentration(allPayables.filter((item) => item.partyId), (id) => `/proveedores/${id}`),
    attentionSignals: intelligence.signals.filter((signal) => ["cobros", "compras_documentacion", "economia_obra"].includes(signal.category) && (!clientId || signal.entity.clientId === clientId) && (!workId || signal.entity.workId === workId)).slice(0, 8).map((signal) => ({ id: signal.id, level: signal.level, title: signal.title, explanation: signal.explanation, nextStep: signal.nextStep, amount: signal.amount ?? null, href: signal.entity.href })),
    filters: {
      clientId,
      workId,
      status,
      clients: clients.map((client) => ({ id: client.id, label: client.nombre })),
      works: works.map((work) => ({ id: work.id, label: `${work.titulo} · ${work.client.nombre}` }))
    }
  };
}

function concentration(documents: EconomicDocument[], href: (id: string) => string): EconomicConcentration[] {
  const groups = new Map<string, EconomicConcentration>();
  const today = startOfDay(new Date());
  for (const document of documents) {
    if (!document.partyId || document.pending <= 0) continue;
    const current = groups.get(document.partyId) ?? { id: document.partyId, label: document.partyName, pending: 0, overdue: 0, documentCount: 0, href: href(document.partyId) };
    current.pending += document.pending;
    current.documentCount += 1;
    if (document.dueDate && startOfDay(document.dueDate) < today) current.overdue += document.pending;
    groups.set(document.partyId, current);
  }
  return [...groups.values()].sort((a, b) => b.pending - a.pending || a.label.localeCompare(b.label)).slice(0, 8);
}

function filterStatus(documents: EconomicDocument[], status: string | null, now: Date) {
  if (!status || status === "todos") return documents;
  const today = startOfDay(now);
  if (status === "vencido") return documents.filter((document) => document.pending > 0 && document.dueDate && startOfDay(document.dueDate) < today);
  if (status === "pendiente") return documents.filter((document) => document.pending > 0);
  if (status === "parcial") return documents.filter((document) => document.paid > 0 && document.pending > 0);
  if (status === "liquidado") return documents.filter((document) => document.pending === 0);
  return documents;
}

function validArea(value: string | undefined): EconomicArea { return ["resumen", "cobros", "pagos", "prevision", "rentabilidad"].includes(value ?? "") ? value as EconomicArea : "resumen"; }
function validPeriod(value: string | undefined): EconomicPeriod { return ["7d", "30d", "90d"].includes(value ?? "") ? value as EconomicPeriod : "30d"; }
function clean(value: string | null | undefined) { return value && value !== "todos" && value !== "all" ? value : null; }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
