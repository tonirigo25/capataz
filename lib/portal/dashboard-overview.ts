import type { BudgetStatus, InvoiceStatus, WorkStatus } from "@prisma/client";
import { getBusinessIntelligenceSummary } from "@/lib/business-intelligence";
import {
  BILLABLE_INVOICE_EXCLUDED_STATUSES,
  invoiceBalance,
  round,
} from "@/lib/business-metrics";
import { resolveBusinessPeriod } from "@/lib/business-periods";
import { prisma } from "@/lib/prisma";
import { getTreasuryOverview } from "@/lib/treasury";

export type DashboardPeriod = "this_month" | "previous_month" | "this_quarter" | "this_year";

export type DashboardKpi = {
  id: "income" | "expenses" | "profit" | "margin" | "receivable" | "cash-forecast";
  label: string;
  value: string;
  comparison: string;
  tone: "positive" | "negative" | "neutral";
  href: string;
};

export type DashboardProfitabilityRow = {
  workId: string;
  title: string;
  progress: number;
  income: number;
  cost: number;
  margin: number;
  risk: "Bajo" | "Medio" | "Alto";
  href: string;
};

export type DashboardOverview = {
  period: DashboardPeriod;
  periodLabel: string;
  kpis: DashboardKpi[];
  weeklyTrend: Array<{ label: string; income: number; expenses: number }>;
  marginWorks: Array<{ workId: string; label: string; value: number; href: string }>;
  cashForecast: Array<{ label: string; value: number }>;
  pipeline: Array<{ id: string; label: string; value: number; color: string; href: string }>;
  profitability: DashboardProfitabilityRow[];
  totals: { progress: number; income: number; cost: number; margin: number };
  alerts: Array<{ id: string; title: string; detail: string; tone: "risk" | "attention" | "info"; href: string }>;
};

const supportedPeriods = new Set<DashboardPeriod>([
  "this_month",
  "previous_month",
  "this_quarter",
  "this_year",
]);

export function dashboardPeriod(value: string | null | undefined): DashboardPeriod {
  return supportedPeriods.has(value as DashboardPeriod) ? (value as DashboardPeriod) : "this_month";
}

export async function getDashboardOverview({
  companyId,
  period,
  now = new Date(),
}: {
  companyId: string;
  period: DashboardPeriod;
  now?: Date;
}): Promise<DashboardOverview> {
  const periodWindow = resolveBusinessPeriod({ id: period, timezone: "Europe/Madrid", now });
  const effectiveEnd = periodWindow.end > now ? addDays(startOfDay(now), 1) : periodWindow.end;
  const trendEnd = effectiveEnd;
  const trendStart = addDays(trendEnd, -56);
  const [summary, treasury, trendInvoices, trendExpenses, budgets, works, tasks, overdueInvoices] = await Promise.all([
    getBusinessIntelligenceSummary({ companyId, period, now }),
    getTreasuryOverview({ companyId, horizon: "60d", scenario: "base", now }),
    prisma.invoice.findMany({
      where: {
        companyId,
        estado: { notIn: BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] },
        fechaEmision: { gte: trendStart, lt: trendEnd },
      },
      select: { total: true, fechaEmision: true },
    }),
    prisma.expense.findMany({
      where: { companyId, fecha: { gte: trendStart, lt: trendEnd } },
      select: { importe: true, fecha: true },
    }),
    prisma.budget.findMany({
      where: { companyId, estado: { notIn: ["rechazado", "caducado"] as BudgetStatus[] } },
      select: { id: true, total: true, estado: true, work: { select: { id: true, estado: true } } },
    }),
    prisma.work.findMany({
      where: { companyId, archivada: false },
      select: { id: true, estado: true, presupuestoAprobado: true },
    }),
    prisma.task.findMany({
      where: { companyId, workId: { not: null }, archivedAt: null, cancelledAt: null },
      select: { workId: true, status: true },
    }),
    prisma.invoice.findMany({
      where: {
        companyId,
        estado: { notIn: BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] },
        fechaVencimiento: { lt: addDays(startOfDay(now), -30) },
      },
      select: { total: true, pagado: true, estado: true },
    }),
  ]);

  const kpiMap = new Map(summary.kpis.map((item) => [item.id, item]));
  const cashToday = treasury.registeredBalance;
  const cashForecast = cashToday === null ? [] : buildCashForecast(treasury.forecast.daily, cashToday, now);
  const forecastClosing = cashForecast.at(-1)?.value ?? cashToday;
  const profitability = treasury.workProfitability
    .filter((item) => item.hasEnoughData && item.invoiced > 0)
    .map((item) => ({
      workId: item.workId,
      title: item.title,
      progress: workProgress(item.workId, tasks),
      income: item.invoiced,
      cost: item.realCost,
      margin: round(item.marginOnInvoiced),
      risk: riskFromMargin(item.marginOnInvoiced),
      href: `/obras/${item.workId}?vista=dinero`,
    }))
    .sort((a, b) => b.margin - a.margin || b.income - a.income)
    .slice(0, 5);
  const totals = buildProfitabilityTotals(profitability);
  const pipeline = buildPipeline(budgets, works);
  const overdueOlderThan30 = overdueInvoices.filter((invoice) => invoiceBalance(invoice).pending > 0);
  const overdueOlderThan30Total = overdueOlderThan30.reduce(
    (total, invoice) => total + invoiceBalance(invoice).pending,
    0,
  );
  const weekEnd = addDays(startOfDay(now), 7);
  const supplierPayments = treasury.payables
    .filter((item) => item.effectiveDate && item.effectiveDate >= startOfDay(now) && item.effectiveDate < weekEnd)
    .reduce((total, item) => total + item.amount, 0);
  const expectedCollections = treasury.receivables
    .filter((item) => item.effectiveDate && item.effectiveDate >= startOfDay(now) && item.effectiveDate < weekEnd)
    .reduce((total, item) => total + item.amount, 0);
  const lowMarginCount = treasury.workProfitability.filter(
    (item) => item.hasEnoughData && item.invoiced > 0 && item.marginOnInvoiced < 30,
  ).length;

  const kpis: DashboardKpi[] = [
    moneyKpi("income", "Ingresos", summary.money.invoiced, kpiMap.get("invoiced")?.comparison, "/dinero"),
    moneyKpi("expenses", "Gastos", summary.money.expenses, kpiMap.get("expenses")?.comparison, "/gastos-materiales"),
    moneyKpi("profit", "Beneficio", summary.money.profitOnInvoiced, kpiMap.get("profit_invoiced")?.comparison, "/inteligencia?vista=rentabilidad"),
    percentKpi("margin", "Margen", summary.money.marginOnInvoiced, kpiMap.get("margin_invoiced")?.comparison, "/inteligencia?vista=rentabilidad"),
    { id: "receivable", label: "Pendiente de cobro", value: formatCurrency(treasury.invoices.pending), comparison: "Estado actual", tone: "neutral", href: "/tesoreria?vista=cobros&periodo=30d&estado=pendiente" },
    {
      id: "cash-forecast",
      label: "Caja prevista (8 sem.)",
      value: forecastClosing === null ? "Sin saldo registrado" : formatCurrency(forecastClosing),
      comparison: forecastClosing !== null && cashToday !== null && cashToday !== 0 ? `${signedPercent((forecastClosing - cashToday) / Math.abs(cashToday) * 100)} vs. hoy` : "Sin saldo inicial comparable",
      tone: forecastClosing !== null && cashToday !== null && forecastClosing > cashToday ? "positive" : forecastClosing !== null && cashToday !== null && forecastClosing < cashToday ? "negative" : "neutral",
      href: "/tesoreria?vista=prevision&periodo=90d",
    },
  ];

  return {
    period,
    periodLabel: `${formatShortDate(summary.period.start)} – ${formatShortDate(new Date(summary.period.end.getTime() - 1), true)}`,
    kpis,
    weeklyTrend: buildWeeklyTrend(trendInvoices, trendExpenses, trendStart),
    marginWorks: profitability.map((item) => ({ workId: item.workId, label: item.title, value: item.margin, href: item.href })),
    cashForecast,
    pipeline,
    profitability,
    totals,
    alerts: [
      {
        id: "overdue-invoices",
        title: `${overdueOlderThan30.length} facturas vencidas`,
        detail: `${formatCurrency(overdueOlderThan30Total)} con más de 30 días`,
        tone: "risk",
        href: "/tesoreria?vista=cobros&estado=vencido",
      },
      {
        id: "low-margin",
        title: "Margen por debajo del objetivo",
        detail: `${lowMarginCount} ${lowMarginCount === 1 ? "obra" : "obras"} < 30% de margen`,
        tone: "attention",
        href: "/inteligencia?vista=rentabilidad",
      },
      {
        id: "supplier-payments",
        title: "Pago a proveedores esta semana",
        detail: `${formatCurrency(supplierPayments)} programados`,
        tone: "info",
        href: "/tesoreria?vista=pagos&periodo=7d",
      },
      {
        id: "expected-collections",
        title: "Cobros previstos esta semana",
        detail: formatCurrency(expectedCollections),
        tone: "info",
        href: "/tesoreria?vista=cobros&periodo=7d",
      },
    ],
  };

  function moneyKpi(
    id: DashboardKpi["id"],
    label: string,
    value: number,
    comparison: { label: string; tone: "positive" | "negative" | "neutral" } | undefined,
    href: string,
  ): DashboardKpi {
    return {
      id,
      label,
      value: formatCurrency(value),
      comparison: comparison ? withPeriodContext(comparison.label) : "Sin periodo comparable",
      tone: comparison?.tone ?? "neutral",
      href,
    };
  }

  function percentKpi(
    id: DashboardKpi["id"],
    label: string,
    value: number,
    comparison: { label: string; tone: "positive" | "negative" | "neutral"; delta?: number | null } | undefined,
    href: string,
  ): DashboardKpi {
    const comparisonLabel = comparison?.delta == null
      ? comparison?.label ?? "Sin periodo comparable"
      : `${comparison.delta >= 0 ? "+" : ""}${formatNumber(comparison.delta, 1)} pp vs. periodo anterior`;
    return { id, label, value: `${formatNumber(value, 1)}%`, comparison: comparisonLabel, tone: comparison?.tone ?? "neutral", href };
  }
}

function withPeriodContext(label: string) {
  return /^[+-]/u.test(label) ? `${label} vs. periodo anterior` : label;
}

function buildWeeklyTrend(
  invoices: Array<{ total: number; fechaEmision: Date }>,
  expenses: Array<{ importe: number; fecha: Date }>,
  start: Date,
) {
  return Array.from({ length: 8 }, (_, index) => {
    const bucketStart = addDays(start, index * 7);
    const bucketEnd = addDays(bucketStart, 7);
    return {
      label: formatDayMonth(bucketStart),
      income: sum(invoices.filter((item) => item.fechaEmision >= bucketStart && item.fechaEmision < bucketEnd).map((item) => item.total)),
      expenses: sum(expenses.filter((item) => item.fecha >= bucketStart && item.fecha < bucketEnd).map((item) => item.importe)),
    };
  });
}

function buildCashForecast(
  points: Array<{ date: Date; balance: number | null; net: number }>,
  openingBalance: number,
  now: Date,
) {
  let running = openingBalance;
  return Array.from({ length: 8 }, (_, index) => {
    const start = addDays(startOfDay(now), index * 7);
    const end = addDays(start, 7);
    const weekly = points.filter((point) => point.date >= start && point.date < end);
    if (weekly.length) {
      const last = weekly.at(-1);
      running = last?.balance ?? running + sum(weekly.map((point) => point.net));
    }
    return { label: index === 0 ? "Sem. actual" : `+${index} sem.`, value: running };
  });
}

function buildPipeline(
  budgets: Array<{ id: string; total: number; estado: BudgetStatus; work: { id: string; estado: WorkStatus } | null }>,
  works: Array<{ id: string; estado: WorkStatus; presupuestoAprobado: number }>,
) {
  const stages = [
    { id: "prospecting", label: "Prospección", color: "#4f86e8", href: "/presupuestos?estado=borrador", value: 0 },
    { id: "budget-sent", label: "Presupuesto enviado", color: "#85b6ec", href: "/presupuestos?estado=enviado", value: 0 },
    { id: "negotiation", label: "Negociación", color: "#f4c32f", href: "/presupuestos?estado=pendiente_respuesta", value: 0 },
    { id: "awarded", label: "Adjudicado", color: "#f1616d", href: "/presupuestos?estado=aceptado", value: 0 },
    { id: "in-progress", label: "En ejecución", color: "#64bd6f", href: "/obras?estado=en_curso", value: 0 },
  ];
  const executionStates = new Set<WorkStatus>(["en_curso", "parcialmente_terminada", "pendiente_material", "pendiente_cliente", "pendiente_remates", "facturada_parcialmente"]);
  const budgetWorkIds = new Set<string>();
  for (const budget of budgets) {
    if (budget.work && executionStates.has(budget.work.estado)) {
      stages[4].value += budget.total;
      budgetWorkIds.add(budget.work.id);
    } else if (["borrador", "pendiente_revision"].includes(budget.estado)) stages[0].value += budget.total;
    else if (budget.estado === "enviado") stages[1].value += budget.total;
    else if (["visto", "pendiente_respuesta"].includes(budget.estado)) stages[2].value += budget.total;
    else if (budget.estado === "aceptado") stages[3].value += budget.total;
  }
  for (const work of works) {
    if (executionStates.has(work.estado) && !budgetWorkIds.has(work.id)) stages[4].value += work.presupuestoAprobado;
  }
  return stages;
}

function buildProfitabilityTotals(rows: DashboardProfitabilityRow[]) {
  const income = sum(rows.map((item) => item.income));
  const cost = sum(rows.map((item) => item.cost));
  return {
    progress: rows.length ? Math.round(sum(rows.map((item) => item.progress)) / rows.length) : 0,
    income,
    cost,
    margin: income ? round((income - cost) / income * 100) : 0,
  };
}

function workProgress(workId: string, tasks: Array<{ workId: string | null; status: string }>) {
  const workTasks = tasks.filter((task) => task.workId === workId && task.status !== "cancelled");
  if (!workTasks.length) return 0;
  const completed = workTasks.filter((task) => task.status === "completed").length;
  return Math.round(completed / workTasks.length * 100);
}

function riskFromMargin(margin: number): DashboardProfitabilityRow["risk"] {
  if (margin < 30) return "Alto";
  if (margin < 36) return "Medio";
  return "Bajo";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatShortDate(value: Date, includeYear = false) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", ...(includeYear ? { year: "numeric" as const } : {}) }).format(value).replace(".", "");
}

function formatDayMonth(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(value).replace(".", "");
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}
