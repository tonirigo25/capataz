import { invoiceBalance, isBillableInvoiceStatus, safeNumber } from "@/lib/business-metrics";
import type { EconomicDocument, EconomicDocumentSummary, EconomicDueGroup, EconomicForecast, EconomicPeriod } from "@/lib/economic-control/types";

export const ECONOMIC_PERIOD_DAYS: Record<EconomicPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };

type ReceivableInput = {
  id: string; numero: string; concepto: string; estado: string; total: number; pagado?: number | null; fechaEmision: Date; fechaVencimiento: Date | null;
  client: { id: string; nombre: string }; work: { id: string; titulo: string } | null; payments: Array<{ id: string; importe: number }>;
};

type PayableInput = {
  id: string; invoiceNumber: string; description: string; status: string; total: number; paidAmount?: number | null; issueDate: Date; dueDate: Date | null; voidedAt?: Date | null;
  businessPartner: { id: string; commercialName: string }; work: { id: string; titulo: string } | null; payments: Array<{ id: string; amount: number }>;
};

type ExpenseInput = {
  id: string; proveedor: string; concepto: string; importe: number; fecha: Date; paymentDueDate: Date | null; paidAt: Date | null; paymentStatus: string | null;
  purchaseInvoiceId: string | null; businessPartner: { id: string; commercialName: string } | null; work: { id: string; titulo: string } | null;
};

export function buildReceivableDocuments(invoices: ReceivableInput[]): EconomicDocument[] {
  return invoices.filter((invoice) => isBillableInvoiceStatus(invoice.estado)).map((invoice) => {
    const balance = invoiceBalance(invoice);
    return {
      id: `receivable:${invoice.id}`,
      kind: "factura_emitida" as const,
      direction: "entrada" as const,
      number: invoice.numero,
      description: invoice.concepto,
      partyId: invoice.client.id,
      partyName: invoice.client.nombre,
      workId: invoice.work?.id ?? null,
      workTitle: invoice.work?.titulo ?? null,
      issueDate: invoice.fechaEmision,
      dueDate: invoice.fechaVencimiento,
      total: safeNumber(invoice.total),
      paid: balance.paid,
      pending: balance.pending,
      status: invoice.estado,
      href: `/dinero/${invoice.id}`
    };
  });
}

export function buildPayableDocuments(purchaseInvoices: PayableInput[], expenses: ExpenseInput[] = []): EconomicDocument[] {
  const invoiceRows = purchaseInvoices.filter((invoice) => !invoice.voidedAt && invoice.status !== "VOID").map((invoice) => {
    const paid = Math.max(safeNumber(invoice.paidAmount), uniqueTotal(invoice.payments, (payment) => payment.id, (payment) => payment.amount));
    const pending = Math.max(0, safeNumber(invoice.total) - paid);
    const base = invoice.work ? `/obras/${invoice.work.id}?vista=dinero` : `/facturas-proveedor/${invoice.id}`;
    return {
      id: `payable:${invoice.id}`,
      kind: "factura_recibida" as const,
      direction: "salida" as const,
      number: invoice.invoiceNumber,
      description: invoice.description,
      partyId: invoice.businessPartner.id,
      partyName: invoice.businessPartner.commercialName,
      workId: invoice.work?.id ?? null,
      workTitle: invoice.work?.titulo ?? null,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: safeNumber(invoice.total),
      paid,
      pending,
      status: invoice.status,
      href: base
    };
  });
  const standaloneExpenses = expenses.filter((expense) => !expense.purchaseInvoiceId && expense.paymentStatus !== "cancelled").map((expense) => {
    const paid = expense.paymentStatus === "paid" ? safeNumber(expense.importe) : 0;
    return {
      id: `expense:${expense.id}`,
      kind: "gasto" as const,
      direction: "salida" as const,
      number: "Gasto",
      description: expense.concepto,
      partyId: expense.businessPartner?.id ?? null,
      partyName: expense.businessPartner?.commercialName ?? expense.proveedor,
      workId: expense.work?.id ?? null,
      workTitle: expense.work?.titulo ?? null,
      issueDate: expense.fecha,
      dueDate: expense.paymentDueDate,
      total: safeNumber(expense.importe),
      paid,
      pending: Math.max(0, safeNumber(expense.importe) - paid),
      status: expense.paymentStatus ?? "unknown",
      href: "/gastos-materiales"
    };
  });
  return [...invoiceRows, ...standaloneExpenses];
}

export function summarizeEconomicDocuments(documents: EconomicDocument[], now = new Date()): EconomicDocumentSummary {
  const open = documents.filter((document) => document.pending > 0);
  const overdue = open.filter((document) => isBeforeDay(document.dueDate, now));
  const dueSoon = open.filter((document) => isWithinDays(document.dueDate, now, 7));
  return {
    documented: sum(documents.map((document) => document.total)),
    settled: sum(documents.map((document) => document.paid)),
    pending: sum(open.map((document) => document.pending)),
    overdue: sum(overdue.map((document) => document.pending)),
    dueSoon: sum(dueSoon.map((document) => document.pending)),
    openCount: open.length,
    overdueCount: overdue.length,
    partialCount: open.filter((document) => document.paid > 0).length
  };
}

export function buildDueDateForecast(documents: EconomicDocument[], period: EconomicPeriod, openingBalance: number | null, now = new Date()): EconomicForecast {
  const start = startOfDay(now);
  const end = addDays(start, ECONOMIC_PERIOD_DAYS[period]);
  const pending = documents.filter((document) => document.pending > 0);
  const overdue = pending.filter((document) => isBeforeDay(document.dueDate, start));
  const unscheduled = pending.filter((document) => !validDate(document.dueDate));
  const future = pending.filter((document) => {
    const due = validDate(document.dueDate);
    return Boolean(due && due >= start && due <= end);
  }).sort(byDueDate);
  const groups: Record<EconomicDueGroup, EconomicDocument[]> = { vencido: [], hoy: [], proximos_7_dias: [], proximos_30_dias: [], posterior: [], sin_vencimiento: [] };
  for (const document of pending) groups[dueGroup(document.dueDate, start)].push(document);
  const byDate = new Map<number, EconomicDocument[]>();
  for (const document of future) {
    const key = startOfDay(document.dueDate as Date).getTime();
    byDate.set(key, [...(byDate.get(key) ?? []), document]);
  }
  let balance = openingBalance;
  const points = [...byDate.entries()].sort(([a], [b]) => a - b).map(([time, rows]) => {
    const inflows = sum(rows.filter((row) => row.direction === "entrada").map((row) => row.pending));
    const outflows = sum(rows.filter((row) => row.direction === "salida").map((row) => row.pending));
    const net = inflows - outflows;
    if (balance !== null) balance += net;
    return { date: new Date(time), inflows, outflows, net, balance, documents: rows };
  });
  const inflows = sum(future.filter((row) => row.direction === "entrada").map((row) => row.pending));
  const outflows = sum(future.filter((row) => row.direction === "salida").map((row) => row.pending));
  return { period, start, end, openingBalance, inflows, outflows, net: inflows - outflows, closingBalance: openingBalance === null ? null : openingBalance + inflows - outflows, overdue, future, unscheduled, points, groups };
}

function dueGroup(value: Date | null, now: Date): EconomicDueGroup {
  const due = validDate(value); if (!due) return "sin_vencimiento";
  const days = daysBetween(now, due);
  if (days < 0) return "vencido";
  if (days === 0) return "hoy";
  if (days <= 7) return "proximos_7_dias";
  if (days <= 30) return "proximos_30_dias";
  return "posterior";
}

function uniqueTotal<T>(items: T[], key: (item: T) => string, value: (item: T) => number) { return sum([...new Map(items.map((item) => [key(item), value(item)])).values()]); }
function validDate(value: Date | null) { return value instanceof Date && !Number.isNaN(value.getTime()) ? startOfDay(value) : null; }
function isBeforeDay(value: Date | null, now: Date) { const date = validDate(value); return Boolean(date && date < startOfDay(now)); }
function isWithinDays(value: Date | null, now: Date, days: number) { const date = validDate(value); if (!date) return false; const delta = daysBetween(startOfDay(now), date); return delta >= 0 && delta <= days; }
function byDueDate(a: EconomicDocument, b: EconomicDocument) { return (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id); }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function addDays(value: Date, days: number) { const copy = new Date(value); copy.setDate(copy.getDate() + days); return copy; }
function daysBetween(from: Date, to: Date) { return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000); }
function sum(values: number[]) { return values.reduce((total, value) => total + safeNumber(value), 0); }
