import type { ExpenseCategory } from "@prisma/client";
import type { BusinessPeriod } from "@/lib/business-periods";

export const BILLABLE_INVOICE_EXCLUDED_STATUSES = ["borrador", "pendiente_emitir"];
export const VALID_BUDGET_EXCLUDED_STATUSES = ["rechazado", "caducado"];
export const PENDING_BUDGET_STATUSES = ["pendiente_revision", "enviado", "visto", "pendiente_respuesta"];
export const DECIDED_BUDGET_STATUSES = ["aceptado", "rechazado", "caducado"];
export const ACCEPTED_BUDGET_STATUSES = ["aceptado"];

export type MetricDirection = "higher_better" | "lower_better" | "neutral";
export type TrendTone = "positive" | "negative" | "neutral";

export type MetricComparison = {
  current: number;
  previous: number | null;
  delta: number | null;
  percent: number | null;
  tone: TrendTone;
  label: string;
};

export type MetricDefinition = {
  id: string;
  name: string;
  includes: string[];
  excludes: string[];
  formula: string;
  source: string;
  direction: MetricDirection;
};

export type InvoiceMetricInput = {
  id?: string;
  total: number;
  estado: string;
  fechaEmision?: Date | string | null;
  fechaVencimiento?: Date | string | null;
  pagado?: number | null;
  pendiente?: number | null;
  payments?: Array<{ id?: string | null; importe: number; fecha?: Date | string | null }>;
};

export type BudgetMetricInput = {
  total: number;
  estado: string;
  fechaCreacion?: Date | string | null;
  fechaEnvio?: Date | string | null;
};

export type ExpenseMetricInput = {
  importe: number;
  categoria?: ExpenseCategory | string | null;
};

export type WorkProfitabilityInput = {
  id: string;
  titulo: string;
  estado: string;
  costePrevisto?: number | null;
  gastoReal?: number | null;
  presupuestoAprobado?: number | null;
  client?: { nombre: string } | null;
  invoices?: InvoiceMetricInput[];
  expenses?: ExpenseMetricInput[];
  budgets?: BudgetMetricInput[];
};

export const BUSINESS_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    id: "invoiced",
    name: "Facturación emitida",
    includes: ["Facturas válidas emitidas dentro del periodo"],
    excludes: ["Presupuestos", "pagos", "facturas borrador", "facturas pendientes de emitir"],
    formula: "Suma de total de facturas válidas por fecha de emisión",
    source: "Factura",
    direction: "higher_better"
  },
  {
    id: "collected",
    name: "Cobrado",
    includes: ["Pagos registrados dentro del periodo"],
    excludes: ["Facturas sin pago", "presupuestos", "saldo pendiente"],
    formula: "Suma de importes de Pago por fecha de pago",
    source: "Pago",
    direction: "higher_better"
  },
  {
    id: "outstanding",
    name: "Pendiente de cobro",
    includes: ["Saldo abierto de facturas válidas"],
    excludes: ["Sobrepagos como deuda negativa", "facturas borrador", "facturas pendientes de emitir"],
    formula: "Máximo(0, total factura - pagos asociados)",
    source: "Factura y Pago",
    direction: "lower_better"
  },
  {
    id: "overdue",
    name: "Vencido",
    includes: ["Saldo pendiente de facturas válidas cuya fecha de vencimiento ya pasó"],
    excludes: ["Facturas pagadas", "sobrepagos", "facturas no emitidas"],
    formula: "Pendiente de cobro con fechaVencimiento menor que hoy",
    source: "Factura y Pago",
    direction: "lower_better"
  },
  {
    id: "expenses",
    name: "Gastos",
    includes: ["Gastos reales registrados dentro del periodo"],
    excludes: ["Presupuestos de proveedor no registrados como gasto"],
    formula: "Suma de Expense.importe por fecha",
    source: "Gasto",
    direction: "lower_better"
  },
  {
    id: "profit_invoiced",
    name: "Beneficio sobre facturado",
    includes: ["Facturación emitida", "gastos reales"],
    excludes: ["Pagos como ingreso de devengo"],
    formula: "Facturado - gastos",
    source: "Factura y Gasto",
    direction: "higher_better"
  },
  {
    id: "profit_collected",
    name: "Beneficio sobre cobrado",
    includes: ["Cobros reales", "gastos reales"],
    excludes: ["Facturación no cobrada"],
    formula: "Cobrado - gastos",
    source: "Pago y Gasto",
    direction: "higher_better"
  },
  {
    id: "margin_invoiced",
    name: "Margen sobre facturado",
    includes: ["Beneficio sobre facturado", "facturación emitida"],
    excludes: ["División entre cero"],
    formula: "Beneficio sobre facturado / facturado x 100",
    source: "Factura y Gasto",
    direction: "higher_better"
  },
  {
    id: "quote_conversion",
    name: "Conversión de presupuestos",
    includes: ["Presupuestos aceptados", "presupuestos decididos"],
    excludes: ["Borradores y pendientes sin decisión"],
    formula: "Aceptados / decididos x 100",
    source: "Presupuesto",
    direction: "higher_better"
  }
];

export function isBillableInvoiceStatus(status: string | null | undefined) {
  return !BILLABLE_INVOICE_EXCLUDED_STATUSES.includes(normalizeStatus(status));
}

export function isValidBudgetStatus(status: string | null | undefined) {
  return !VALID_BUDGET_EXCLUDED_STATUSES.includes(normalizeStatus(status));
}

export function invoicePaidAmount(invoice: InvoiceMetricInput) {
  if (invoice.payments) return uniquePaymentTotal(invoice.payments);
  return safeNumber(invoice.pagado);
}

export function invoiceBalance(invoice: InvoiceMetricInput) {
  if (!isBillableInvoiceStatus(invoice.estado)) return { paid: 0, pending: 0, overpaid: 0 };
  const total = safeNumber(invoice.total);
  const paid = invoicePaidAmount(invoice);
  return {
    paid,
    pending: Math.max(0, total - paid),
    overpaid: Math.max(0, paid - total)
  };
}

export function calculateInvoiceMetrics(invoices: InvoiceMetricInput[], now: Date = new Date()) {
  const valid = invoices.filter((invoice) => isBillableInvoiceStatus(invoice.estado));
  const total = sum(valid.map((invoice) => invoice.total));
  const paid = sum(valid.map((invoice) => invoiceBalance(invoice).paid));
  const pending = sum(valid.map((invoice) => invoiceBalance(invoice).pending));
  const overdueInvoices = valid.filter((invoice) => {
    const due = toDate(invoice.fechaVencimiento);
    return invoiceBalance(invoice).pending > 0 && Boolean(due && startOfDay(due) < startOfDay(now));
  });
  const overdue = sum(overdueInvoices.map((invoice) => invoiceBalance(invoice).pending));
  return {
    count: valid.length,
    total,
    paid,
    pending,
    overdue,
    overdueCount: overdueInvoices.length,
    paidCount: valid.filter((invoice) => invoiceBalance(invoice).pending === 0).length,
    partialCount: valid.filter((invoice) => {
      const balance = invoiceBalance(invoice);
      return balance.paid > 0 && balance.pending > 0;
    }).length,
    overpaidCount: valid.filter((invoice) => invoiceBalance(invoice).overpaid > 0).length
  };
}

export function calculateExpenseMetrics(expenses: ExpenseMetricInput[]) {
  const total = sum(expenses.map((expense) => expense.importe));
  const byCategory = expenses.reduce<Record<string, number>>((groups, expense) => {
    const key = normalizeStatus(expense.categoria) || "otros";
    groups[key] = (groups[key] ?? 0) + safeNumber(expense.importe);
    return groups;
  }, {});
  return { total, count: expenses.length, byCategory };
}

export function calculateQuoteMetrics(budgets: BudgetMetricInput[]) {
  const statusCounts = budgets.reduce<Record<string, number>>((counts, budget) => {
    const key = normalizeStatus(budget.estado);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const valid = budgets.filter((budget) => isValidBudgetStatus(budget.estado));
  const accepted = budgets.filter((budget) => ACCEPTED_BUDGET_STATUSES.includes(normalizeStatus(budget.estado)));
  const decided = budgets.filter((budget) => DECIDED_BUDGET_STATUSES.includes(normalizeStatus(budget.estado)));
  const sent = budgets.filter((budget) => Boolean(budget.fechaEnvio) || ["enviado", "visto", "pendiente_respuesta", "aceptado", "rechazado", "caducado"].includes(normalizeStatus(budget.estado)));
  const validTotal = sum(valid.map((budget) => budget.total));
  return {
    count: budgets.length,
    validTotal,
    sentCount: sent.length,
    acceptedCount: accepted.length,
    rejectedCount: budgets.filter((budget) => normalizeStatus(budget.estado) === "rechazado").length,
    expiredCount: budgets.filter((budget) => normalizeStatus(budget.estado) === "caducado").length,
    pendingCount: budgets.filter((budget) => PENDING_BUDGET_STATUSES.includes(normalizeStatus(budget.estado))).length,
    averageAmount: valid.length ? validTotal / valid.length : 0,
    decidedCount: decided.length,
    conversionRate: decided.length ? accepted.length / decided.length * 100 : null,
    statusCounts
  };
}

export function calculateProfitMetrics({ invoiced, collected, expenses }: { invoiced: number; collected: number; expenses: number }) {
  const profitOnInvoiced = invoiced - expenses;
  const profitOnCollected = collected - expenses;
  return {
    profitOnInvoiced,
    profitOnCollected,
    marginOnInvoiced: percentOf(profitOnInvoiced, invoiced),
    marginOnCollected: percentOf(profitOnCollected, collected)
  };
}

export function calculateWorkProfitability(work: WorkProfitabilityInput) {
  const invoiceMetrics = calculateInvoiceMetrics(work.invoices ?? []);
  const expenseMetrics = calculateExpenseMetrics(work.expenses ?? []);
  const quoted = calculateQuoteMetrics(work.budgets ?? []).validTotal || safeNumber(work.presupuestoAprobado);
  const realCost = Math.max(expenseMetrics.total, safeNumber(work.gastoReal));
  const profitOnInvoiced = invoiceMetrics.total - realCost;
  const profitOnCollected = invoiceMetrics.paid - realCost;
  return {
    workId: work.id,
    title: work.titulo,
    clientName: work.client?.nombre ?? "Sin cliente",
    status: work.estado,
    quoted,
    forecastCost: safeNumber(work.costePrevisto),
    invoiced: invoiceMetrics.total,
    collected: invoiceMetrics.paid,
    pending: invoiceMetrics.pending,
    expenses: realCost,
    profitOnInvoiced,
    profitOnCollected,
    marginOnInvoiced: percentOf(profitOnInvoiced, invoiceMetrics.total),
    marginOnCollected: percentOf(profitOnCollected, invoiceMetrics.paid),
    deviation: realCost - safeNumber(work.costePrevisto),
    hasEnoughData: invoiceMetrics.total > 0 || invoiceMetrics.paid > 0 || realCost > 0 || quoted > 0
  };
}

export function averageCollectionDays(invoices: InvoiceMetricInput[]) {
  const completed = invoices
    .filter((invoice) => isBillableInvoiceStatus(invoice.estado))
    .map((invoice) => {
      const issuedAt = toDate(invoice.fechaEmision);
      const completedAt = fullPaymentDate(invoice);
      if (!issuedAt || !completedAt) return null;
      return Math.max(0, Math.round((startOfDay(completedAt).getTime() - startOfDay(issuedAt).getTime()) / 86_400_000));
    })
    .filter((value): value is number => typeof value === "number");
  return completed.length ? completed.reduce((total, days) => total + days, 0) / completed.length : null;
}

export function compareMetric(current: number, previous: number | null | undefined, direction: MetricDirection): MetricComparison {
  if (previous === null || previous === undefined) {
    return { current, previous: null, delta: null, percent: null, tone: "neutral", label: "Sin periodo comparable" };
  }
  const delta = current - previous;
  const percent = previous === 0 ? (current === 0 ? 0 : null) : delta / Math.abs(previous) * 100;
  const tone = direction === "neutral" || delta === 0 ? "neutral" : direction === "higher_better" ? (delta > 0 ? "positive" : "negative") : delta > 0 ? "negative" : "positive";
  return {
    current,
    previous,
    delta,
    percent,
    tone,
    label: percent === null ? "Sin base anterior" : `${delta >= 0 ? "+" : ""}${round(percent)}%`
  };
}

export function buildMetricExplanation(metricId: string, period?: BusinessPeriod) {
  const definition = BUSINESS_METRIC_DEFINITIONS.find((item) => item.id === metricId);
  if (!definition) return null;
  return {
    ...definition,
    period: period ? `${formatDate(period.start)} - ${formatDate(new Date(period.end.getTime() - 1))}` : "Periodo seleccionado",
    calculatedAt: new Date()
  };
}

export function trendToneClass(tone: TrendTone) {
  if (tone === "positive") return "text-emerald-700";
  if (tone === "negative") return "text-red-700";
  return "text-slate-500";
}

export function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .trim();
}

export function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function percentOf(value: number, total: number) {
  return total ? value / total * 100 : 0;
}

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function uniquePaymentTotal(payments: Array<{ id?: string | null; importe: number }>) {
  const seen = new Set<string>();
  return payments.reduce((total, payment, index) => {
    const key = payment.id ?? `index:${index}`;
    if (seen.has(key)) return total;
    seen.add(key);
    return total + safeNumber(payment.importe);
  }, 0);
}

function fullPaymentDate(invoice: InvoiceMetricInput) {
  const total = safeNumber(invoice.total);
  const payments = (invoice.payments ?? [])
    .map((payment, index) => ({ ...payment, key: payment.id ?? `index:${index}`, date: toDate(payment.fecha) }))
    .filter((payment): payment is { key: string; importe: number; date: Date } => Boolean(payment.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  let paid = 0;
  const seen = new Set<string>();
  for (const payment of payments) {
    if (seen.has(payment.key)) continue;
    seen.add(payment.key);
    paid += safeNumber(payment.importe);
    if (paid >= total) return payment.date;
  }
  return null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + safeNumber(value), 0);
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
