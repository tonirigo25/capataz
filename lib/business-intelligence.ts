import type { BudgetStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BILLABLE_INVOICE_EXCLUDED_STATUSES,
  BUSINESS_METRIC_DEFINITIONS,
  PENDING_BUDGET_STATUSES,
  averageCollectionDays,
  buildMetricExplanation,
  calculateExpenseMetrics,
  calculateInvoiceMetrics,
  calculateProfitMetrics,
  calculateQuoteMetrics,
  calculateWorkProfitability,
  compareMetric,
  invoiceBalance,
  isBillableInvoiceStatus,
  normalizeStatus,
  round,
  safeNumber,
  type MetricDirection
} from "@/lib/business-metrics";
import {
  BUSINESS_PERIOD_OPTIONS,
  resolveBusinessPeriod,
  type BusinessPeriod,
  type BusinessPeriodId
} from "@/lib/business-periods";

export type BusinessIntelligenceParams = {
  period?: BusinessPeriodId | string;
  from?: string | null;
  to?: string | null;
  now?: Date;
  companyId?: string;
};

export type BusinessKpi = {
  id: string;
  label: string;
  value: number;
  formatted: string;
  definition: string;
  href: string;
  direction: MetricDirection;
  comparison: ReturnType<typeof compareMetric>;
};

export type BusinessAlert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "info" | "warning" | "danger";
};

export type BusinessDataQualityIssue = {
  id: string;
  title: string;
  count: number;
  description: string;
  href: string;
};

const invoiceSelect = {
  id: true,
  numero: true,
  concepto: true,
  total: true,
  pagado: true,
  pendiente: true,
  estado: true,
  fechaEmision: true,
  fechaVencimiento: true,
  clienteId: true,
  obraId: true,
  client: { select: { id: true, nombre: true, tipo: true, nifCif: true, direccionFiscal: true } },
  work: { select: { id: true, titulo: true } },
  payments: { select: { id: true, importe: true, fecha: true } }
} as const satisfies Prisma.InvoiceSelect;

const expenseSelect = {
  id: true,
  proveedor: true,
  concepto: true,
  categoria: true,
  importe: true,
  fecha: true,
  obraId: true,
  work: { select: { id: true, titulo: true, client: { select: { id: true, nombre: true } } } }
} as const satisfies Prisma.ExpenseSelect;

const budgetSelect = {
  id: true,
  numero: true,
  titulo: true,
  total: true,
  estado: true,
  fechaCreacion: true,
  fechaEnvio: true,
  fechaValidez: true,
  client: { select: { id: true, nombre: true } },
  work: { select: { id: true, titulo: true } }
} as const satisfies Prisma.BudgetSelect;

type BusinessInvoice = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;
type BusinessBudget = Prisma.BudgetGetPayload<{ select: typeof budgetSelect }>;

export async function getBusinessIntelligenceSummary(params: BusinessIntelligenceParams = {}) {
  const now = params.now ?? new Date();
  const tenant = params.companyId ? { companyId: params.companyId } : {};
  const period = resolveBusinessPeriod({ id: params.period, from: params.from, to: params.to, timezone: "Europe/Madrid", now });
  const previousPeriod = period.previousStart && period.previousEnd
    ? { ...period, start: period.previousStart, end: period.previousEnd, previousStart: null, previousEnd: null, label: `Anterior a ${period.label}` } satisfies BusinessPeriod
    : null;

  const [
    currentInvoices,
    previousInvoices,
    currentPayments,
    previousPayments,
    currentExpenses,
    previousExpenses,
    currentBudgets,
    previousBudgets,
    allInvoicesAsOfPeriod,
    allInvoicesAsOfPreviousPeriod,
    allWorks,
    allClients,
    upcomingBudgets,
    openReminders,
    documents
  ] = await Promise.all([
    prisma.invoice.findMany({ where: { ...tenant, ...invoicePeriodWhere(period) }, select: invoiceSelect, orderBy: { fechaEmision: "desc" } }),
    previousPeriod ? prisma.invoice.findMany({ where: { ...tenant, ...invoicePeriodWhere(previousPeriod) }, select: invoiceSelect }) : Promise.resolve([]),
    prisma.payment.findMany({ where: { ...tenant, ...dateWhere("fecha", period) }, select: { id: true, importe: true, fecha: true, invoice: { select: { id: true, numero: true } }, client: { select: { id: true, nombre: true } } } }),
    previousPeriod ? prisma.payment.findMany({ where: { ...tenant, ...dateWhere("fecha", previousPeriod) }, select: { id: true, importe: true, fecha: true } }) : Promise.resolve([]),
    prisma.expense.findMany({ where: { ...tenant, ...dateWhere("fecha", period) }, select: expenseSelect, orderBy: { fecha: "desc" } }),
    previousPeriod ? prisma.expense.findMany({ where: { ...tenant, ...dateWhere("fecha", previousPeriod) }, select: expenseSelect }) : Promise.resolve([]),
    prisma.budget.findMany({ where: { ...tenant, ...dateWhere("fechaCreacion", period) }, select: budgetSelect, orderBy: { fechaCreacion: "desc" } }),
    previousPeriod ? prisma.budget.findMany({ where: { ...tenant, ...dateWhere("fechaCreacion", previousPeriod) }, select: budgetSelect }) : Promise.resolve([]),
    prisma.invoice.findMany({
      where: { ...tenant, estado: { notIn: BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] }, fechaEmision: { lt: period.end } },
      select: { ...invoiceSelect, payments: { where: { fecha: { lt: period.end } }, select: { id: true, importe: true, fecha: true } } },
      orderBy: { fechaVencimiento: "asc" }
    }),
    previousPeriod ? prisma.invoice.findMany({
      where: { ...tenant, estado: { notIn: BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] }, fechaEmision: { lt: previousPeriod.end } },
      select: { ...invoiceSelect, payments: { where: { fecha: { lt: previousPeriod.end } }, select: { id: true, importe: true, fecha: true } } },
      orderBy: { fechaVencimiento: "asc" }
    }) : Promise.resolve([]),
    prisma.work.findMany({
      where: { ...tenant, archivada: false },
      select: {
        id: true,
        titulo: true,
        estado: true,
        costePrevisto: true,
        gastoReal: true,
        presupuestoAprobado: true,
        client: { select: { id: true, nombre: true } },
        invoices: { select: invoiceSelect },
        expenses: { select: { id: true, importe: true, categoria: true } },
        budgets: { select: { id: true, total: true, estado: true } }
      }
    }),
    prisma.client.findMany({
      where: { ...tenant, archivadoAt: null },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        nifCif: true,
        direccionFiscal: true,
        invoices: { select: invoiceSelect },
        payments: { select: { id: true, importe: true, fecha: true } },
        works: { select: { id: true } }
      }
    }),
    prisma.budget.findMany({
      where: { ...tenant, estado: { in: PENDING_BUDGET_STATUSES as BudgetStatus[] }, fechaValidez: { not: null, gte: now, lte: addDays(now, 7) } },
      select: budgetSelect,
      orderBy: { fechaValidez: "asc" },
      take: 10
    }),
    prisma.reminder.findMany({
      where: { ...tenant, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } },
      select: { id: true, mensaje: true, fechaProgramada: true, client: { select: { id: true, nombre: true } }, work: { select: { id: true, titulo: true } } },
      orderBy: { fechaProgramada: "asc" },
      take: 20
    }),
    prisma.document.findMany({
      where: { ...tenant, archivedAt: null, category: { in: ["factura", "ticket"] } },
      select: { id: true, name: true, category: true, metadata: true },
      take: 100
    })
  ]);

  const currentInvoiceMetrics = calculateInvoiceMetrics(currentInvoices, now);
  const previousInvoiceMetrics = calculateInvoiceMetrics(previousInvoices, now);
  const outstandingMetrics = calculateInvoiceMetrics(allInvoicesAsOfPeriod, now);
  const currentExpenseMetrics = calculateExpenseMetrics(currentExpenses);
  const previousExpenseMetrics = calculateExpenseMetrics(previousExpenses);
  const currentCollected = sum(currentPayments.map((payment) => payment.importe));
  const previousCollected = sum(previousPayments.map((payment) => payment.importe));
  const currentQuoteMetrics = calculateQuoteMetrics(currentBudgets);
  const previousQuoteMetrics = calculateQuoteMetrics(previousBudgets);
  const previousOutstandingMetrics = calculateInvoiceMetrics(allInvoicesAsOfPreviousPeriod, previousPeriod?.end ?? now);
  const currentProfit = calculateProfitMetrics({ invoiced: currentInvoiceMetrics.total, collected: currentCollected, expenses: currentExpenseMetrics.total });
  const previousProfit = calculateProfitMetrics({ invoiced: previousInvoiceMetrics.total, collected: previousCollected, expenses: previousExpenseMetrics.total });

  const workRankings = allWorks
    .map((work) => calculateWorkProfitability(work))
    .sort((a, b) => b.profitOnInvoiced - a.profitOnInvoiced);
  const clientRankings = buildClientRankings(allClients);
  const qualityIssues = buildDataQualityIssues({ invoices: allInvoicesAsOfPeriod, clients: allClients, works: workRankings, documents });
  const alerts = buildBusinessAlerts({
    invoices: allInvoicesAsOfPeriod,
    works: workRankings,
    clients: clientRankings,
    budgets: upcomingBudgets,
    reminders: openReminders,
    totalOutstanding: outstandingMetrics.pending,
    now
  });
  const health = buildBusinessHealth({
    invoiced: currentInvoiceMetrics.total,
    collected: currentCollected,
    expenses: currentExpenseMetrics.total,
    outstanding: outstandingMetrics.pending,
    overdue: outstandingMetrics.overdue,
    negativeMarginWorks: workRankings.filter((work) => work.marginOnInvoiced < 0 && work.hasEnoughData).length,
    expiredBudgets: currentQuoteMetrics.expiredCount,
    debtConcentration: clientRankings[0]?.debtShare ?? 0,
    dataIssueCount: qualityIssues.reduce((total, issue) => total + issue.count, 0),
    activityCount: currentInvoiceMetrics.count + currentPayments.length + currentExpenses.length + currentBudgets.length + allWorks.length
  });

  const kpis: BusinessKpi[] = [
    kpi("invoiced", "Facturado", currentInvoiceMetrics.total, previousInvoiceMetrics.total, "/dinero", "Facturas válidas emitidas en el periodo."),
    kpi("collected", "Cobrado", currentCollected, previousCollected, "/dinero", "Pagos reales registrados en el periodo."),
    kpi("outstanding", "Pendiente", outstandingMetrics.pending, previousOutstandingMetrics.pending, "/dinero?filtro=pendientes", "Saldo abierto de facturas válidas hasta el final del periodo."),
    kpi("overdue", "Vencido", outstandingMetrics.overdue, previousOutstandingMetrics.overdue, "/dinero?filtro=vencidas", "Saldo pendiente con vencimiento anterior a hoy."),
    kpi("expenses", "Gastos", currentExpenseMetrics.total, previousExpenseMetrics.total, "/gastos-materiales", "Gastos reales registrados en el periodo."),
    kpi("profit_invoiced", "Beneficio facturado", currentProfit.profitOnInvoiced, previousProfit.profitOnInvoiced, "/inteligencia#rentabilidad", "Facturado menos gastos reales."),
    kpi("profit_collected", "Beneficio cobrado", currentProfit.profitOnCollected, previousProfit.profitOnCollected, "/inteligencia#rentabilidad", "Cobrado menos gastos reales."),
    kpi("margin_invoiced", "Margen", currentProfit.marginOnInvoiced, previousProfit.marginOnInvoiced, "/inteligencia#rentabilidad", "Beneficio sobre facturado dividido entre facturado.", true),
    kpi("quote_conversion", "Conversión", currentQuoteMetrics.conversionRate ?? 0, previousQuoteMetrics.conversionRate ?? null, "/presupuestos", "Aceptados dividido entre presupuestos decididos.", true)
  ];

  return {
    period,
    periodOptions: BUSINESS_PERIOD_OPTIONS,
    updatedAt: new Date(),
    summaryText: buildSummaryText({ period, invoiced: currentInvoiceMetrics.total, collected: currentCollected, outstanding: outstandingMetrics.pending, overdue: outstandingMetrics.overdue, expenses: currentExpenseMetrics.total }),
    kpis,
    comparisons: {
      invoiced: compareMetric(currentInvoiceMetrics.total, previousInvoiceMetrics.total, "higher_better"),
      collected: compareMetric(currentCollected, previousCollected, "higher_better"),
      expenses: compareMetric(currentExpenseMetrics.total, previousExpenseMetrics.total, "lower_better"),
      profit: compareMetric(currentProfit.profitOnInvoiced, previousProfit.profitOnInvoiced, "higher_better")
    },
    money: {
      invoiced: currentInvoiceMetrics.total,
      collected: currentCollected,
      outstanding: outstandingMetrics.pending,
      overdue: outstandingMetrics.overdue,
      expenses: currentExpenseMetrics.total,
      profitOnInvoiced: currentProfit.profitOnInvoiced,
      profitOnCollected: currentProfit.profitOnCollected,
      marginOnInvoiced: currentProfit.marginOnInvoiced,
      marginOnCollected: currentProfit.marginOnCollected,
      expenseByCategory: currentExpenseMetrics.byCategory
    },
    quotes: currentQuoteMetrics,
    invoices: {
      ...currentInvoiceMetrics,
      averageCollectionDays: averageCollectionDays(allInvoicesAsOfPeriod),
      pendingInvoices: allInvoicesAsOfPeriod.filter((invoice) => invoiceBalance(invoice).pending > 0).slice(0, 10),
      overdueInvoices: allInvoicesAsOfPeriod.filter((invoice) => invoiceBalance(invoice).pending > 0 && invoice.fechaVencimiento < now).slice(0, 10)
    },
    works: {
      byProfit: workRankings.slice(0, 8),
      byLowestMargin: [...workRankings].filter((work) => work.hasEnoughData).sort((a, b) => a.marginOnInvoiced - b.marginOnInvoiced).slice(0, 8),
      byExpenses: [...workRankings].sort((a, b) => b.expenses - a.expenses).slice(0, 8),
      byPending: [...workRankings].sort((a, b) => b.pending - a.pending).slice(0, 8),
      byDeviation: [...workRankings].sort((a, b) => b.deviation - a.deviation).slice(0, 8)
    },
    clients: {
      byDebt: clientRankings.slice(0, 8),
      byRevenue: [...clientRankings].sort((a, b) => b.invoiced - a.invoiced).slice(0, 8),
      byCollected: [...clientRankings].sort((a, b) => b.collected - a.collected).slice(0, 8),
      bySlowestPayment: [...clientRankings].filter((client) => client.averageCollectionDays !== null).sort((a, b) => safeNumber(b.averageCollectionDays) - safeNumber(a.averageCollectionDays)).slice(0, 8)
    },
    alerts,
    qualityIssues,
    health,
    explanations: BUSINESS_METRIC_DEFINITIONS.map((definition) => buildMetricExplanation(definition.id, period)).filter(Boolean)
  };

  function kpi(id: string, label: string, value: number, previous: number | null, href: string, definition: string, percent = false): BusinessKpi {
    const direction = BUSINESS_METRIC_DEFINITIONS.find((definition) => definition.id === id)?.direction ?? "neutral";
    return {
      id,
      label,
      value,
      formatted: percent ? `${round(value)}%` : formatCurrency(value),
      definition,
      href,
      direction,
      comparison: compareMetric(value, previous, direction)
    };
  }
}

export async function buildBusinessCsvExport(kind: string, params: BusinessIntelligenceParams = {}) {
  const summary = await getBusinessIntelligenceSummary(params);
  if (kind === "works") {
    return toCsv(["obra", "cliente", "estado", "facturado", "cobrado", "pendiente", "gastos", "beneficio", "margen"], summary.works.byProfit.map((work) => [
      work.title,
      work.clientName,
      work.status,
      work.invoiced,
      work.collected,
      work.pending,
      work.expenses,
      work.profitOnInvoiced,
      round(work.marginOnInvoiced)
    ]));
  }
  if (kind === "pending-invoices") {
    return toCsv(["factura", "cliente", "concepto", "total", "pendiente", "vencimiento"], summary.invoices.pendingInvoices.map((invoice) => [
      invoice.numero,
      invoice.client.nombre,
      invoice.concepto,
      invoice.total,
      invoiceBalance(invoice).pending,
      invoice.fechaVencimiento.toISOString().slice(0, 10)
    ]));
  }
  if (kind === "expenses") {
    const data = await prisma.expense.findMany({ where: { ...(params.companyId ? { companyId: params.companyId } : {}), ...dateWhere("fecha", summary.period) }, select: expenseSelect, orderBy: { fecha: "desc" } });
    return toCsv(["fecha", "proveedor", "concepto", "categoria", "obra", "importe"], data.map((expense) => [
      expense.fecha.toISOString().slice(0, 10),
      expense.proveedor,
      expense.concepto,
      expense.categoria,
      expense.work?.titulo ?? "Gasto general",
      expense.importe
    ]));
  }
  return toCsv(["metrica", "valor", "definicion"], summary.kpis.map((item) => [item.label, item.formatted, item.definition]));
}

export function metricDefinitionText(metricId: string) {
  const definition = BUSINESS_METRIC_DEFINITIONS.find((item) => item.id === metricId);
  if (!definition) return "Métrica no definida.";
  return `${definition.name}: ${definition.formula}. Incluye ${definition.includes.join(", ")}. Excluye ${definition.excludes.join(", ")}.`;
}

function buildClientRankings(clients: Array<{
  id: string;
  nombre: string;
  invoices: BusinessInvoice[];
  payments: Array<{ importe: number; fecha: Date }>;
  works: Array<{ id: string }>;
}>) {
  const mapped = clients.map((client) => {
    const invoiceMetrics = calculateInvoiceMetrics(client.invoices);
    const averageDays = averageCollectionDays(client.invoices);
    return {
      clientId: client.id,
      name: client.nombre,
      invoiced: invoiceMetrics.total,
      collected: sum(client.payments.map((payment) => payment.importe)),
      debt: invoiceMetrics.pending,
      overdue: invoiceMetrics.overdue,
      averageCollectionDays: averageDays,
      workCount: client.works.length,
      href: `/clientes/${client.id}`,
      debtShare: 0
    };
  });
  const totalDebt = sum(mapped.map((client) => client.debt));
  return mapped
    .map((client) => ({ ...client, debtShare: totalDebt ? client.debt / totalDebt * 100 : 0 }))
    .sort((a, b) => b.debt - a.debt);
}

function buildDataQualityIssues({
  invoices,
  clients,
  works,
  documents
}: {
  invoices: BusinessInvoice[];
  clients: Array<{ id: string; nombre: string; tipo: string; nifCif: string | null; direccionFiscal: string | null; invoices: any[] }>;
  works: Array<ReturnType<typeof calculateWorkProfitability>>;
  documents: Array<{ id: string; metadata: unknown }>;
}): BusinessDataQualityIssue[] {
  const overpaid = invoices.filter((invoice) => invoiceBalance(invoice).overpaid > 0);
  const incoherentDates = invoices.filter((invoice) => invoice.fechaVencimiento < invoice.fechaEmision);
  const missingFiscalClient = clients.filter((client) => isFiscalClient(client.tipo) && (!client.nifCif || !client.direccionFiscal));
  const worksWithoutForecast = works.filter((work) => work.forecastCost <= 0);
  const negativeMargin = works.filter((work) => work.marginOnInvoiced < 0 && work.hasEnoughData);
  const documentsWithoutAmount = documents.filter((document) => !metadataHasAmount(document.metadata));

  return [
    { id: "invoice-dates", title: "Facturas con fechas incoherentes", count: incoherentDates.length, description: "Vencimiento anterior a emisión.", href: "/dinero" },
    { id: "overpaid", title: "Facturas con sobrepago", count: overpaid.length, description: "Pagos superiores al total de la factura.", href: "/dinero" },
    { id: "fiscal-client", title: "Clientes fiscales incompletos", count: missingFiscalClient.length, description: "Empresas, autónomos o comunidades sin NIF/CIF o dirección fiscal.", href: "/clientes?filtros=datos_incompletos" },
    { id: "work-forecast", title: "Obras sin coste previsto", count: worksWithoutForecast.length, description: "Obras activas o abiertas sin coste previsto informado.", href: "/obras" },
    { id: "negative-margin", title: "Obras con margen negativo", count: negativeMargin.length, description: "Rentabilidad calculada por facturación menos gasto real.", href: "/inteligencia#obras" },
    { id: "document-amount", title: "Documentos sin importe detectable", count: documentsWithoutAmount.length, description: "Tickets o facturas del repositorio sin importe estructurado.", href: "/documentos" },
    { id: "payment-without-invoice", title: "Pagos sin factura", count: 0, description: "El modelo actual exige factura asociada.", href: "/dinero" },
    { id: "expense-without-work", title: "Gastos sin obra", count: 0, description: "El modelo actual exige obra asociada.", href: "/gastos-materiales" }
  ];
}

function buildBusinessAlerts({
  invoices,
  works,
  clients,
  budgets,
  reminders,
  totalOutstanding,
  now
}: {
  invoices: BusinessInvoice[];
  works: Array<ReturnType<typeof calculateWorkProfitability>>;
  clients: ReturnType<typeof buildClientRankings>;
  budgets: BusinessBudget[];
  reminders: Array<{ id: string; mensaje: string; fechaProgramada: Date; client: { nombre: string } | null; work: { titulo: string } | null }>;
  totalOutstanding: number;
  now: Date;
}): BusinessAlert[] {
  const overdue = invoices.filter((invoice) => invoiceBalance(invoice).pending > 0 && invoice.fechaVencimiento < startOfDay(now));
  const negativeMargin = works.filter((work) => work.marginOnInvoiced < 0 && work.hasEnoughData);
  const overBudget = works.filter((work) => work.forecastCost > 0 && work.expenses > work.forecastCost);
  const concentration = clients[0] && totalOutstanding > 0 && clients[0].debt / totalOutstanding > 0.4 ? clients[0] : null;
  const unpaidAfter30 = invoices.filter((invoice) => invoiceBalance(invoice).paid === 0 && invoiceBalance(invoice).pending > 0 && invoice.fechaEmision < addDays(now, -30));
  const lateReminders = reminders.filter((reminder) => reminder.fechaProgramada < now);

  return [
    ...overdue.slice(0, 3).map((invoice) => ({ id: `overdue-${invoice.id}`, title: `Factura vencida ${invoice.numero}`, detail: `${invoice.client.nombre} · ${formatCurrency(invoiceBalance(invoice).pending)} pendientes.`, href: `/dinero/${invoice.id}`, severity: "danger" as const })),
    ...negativeMargin.slice(0, 3).map((work) => ({ id: `margin-${work.workId}`, title: "Obra con margen negativo", detail: `${work.title} · margen ${round(work.marginOnInvoiced)}%.`, href: `/obras/${work.workId}`, severity: "danger" as const })),
    ...overBudget.slice(0, 3).map((work) => ({ id: `budget-${work.workId}`, title: "Gasto real superior al previsto", detail: `${work.title} · desviación ${formatCurrency(work.deviation)}.`, href: `/obras/${work.workId}`, severity: "warning" as const })),
    ...(concentration ? [{ id: `concentration-${concentration.clientId}`, title: "Deuda concentrada", detail: `${concentration.name} concentra ${round(concentration.debtShare)}% del pendiente.`, href: concentration.href, severity: "warning" as const }] : []),
    ...budgets.slice(0, 3).map((budget) => ({ id: `budget-expiry-${budget.id}`, title: `Presupuesto próximo a caducar ${budget.numero}`, detail: `${budget.client.nombre} · vence ${budget.fechaValidez ? formatDate(budget.fechaValidez) : "sin fecha"}.`, href: `/presupuestos/${budget.id}`, severity: "info" as const })),
    ...unpaidAfter30.slice(0, 3).map((invoice) => ({ id: `unpaid-${invoice.id}`, title: "Factura sin pagos tras 30 días", detail: `${invoice.numero} · ${invoice.client.nombre}.`, href: `/dinero/${invoice.id}`, severity: "warning" as const })),
    ...lateReminders.slice(0, 3).map((reminder) => ({ id: `reminder-${reminder.id}`, title: "Recordatorio atrasado", detail: `${reminder.client?.nombre ?? reminder.work?.titulo ?? "Interno"} · ${reminder.mensaje}`, href: `/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=/recordatorios`, severity: "warning" as const }))
  ].slice(0, 12);
}

export function buildBusinessHealth(input: {
  invoiced: number;
  collected: number;
  expenses: number;
  outstanding: number;
  overdue: number;
  negativeMarginWorks: number;
  expiredBudgets: number;
  debtConcentration: number;
  dataIssueCount: number;
  activityCount: number;
}) {
  if (input.activityCount === 0) {
    return { canCalculate: false, score: null, status: "sin_datos" as const, label: "Sin datos suficientes", factors: ["No hay actividad suficiente para calcular la salud del negocio."] };
  }

  const factors: string[] = [];
  let score = 100;
  const overdueRatio = input.outstanding ? input.overdue / input.outstanding : 0;
  if (overdueRatio > 0.5) {
    score -= 25;
    factors.push("Más del 50% del pendiente está vencido.");
  } else if (overdueRatio > 0.2) {
    score -= 15;
    factors.push("Más del 20% del pendiente está vencido.");
  } else if (input.overdue > 0) {
    score -= 8;
    factors.push("Hay facturas vencidas.");
  }
  if (input.negativeMarginWorks > 0) {
    score -= Math.min(25, input.negativeMarginWorks * 10);
    factors.push(`${input.negativeMarginWorks} obras tienen margen negativo.`);
  }
  const expenseRatio = input.invoiced ? input.expenses / input.invoiced : 0;
  if (expenseRatio > 0.9) {
    score -= 20;
    factors.push("Los gastos superan el 90% de la facturación del periodo.");
  } else if (expenseRatio > 0.7) {
    score -= 10;
    factors.push("Los gastos superan el 70% de la facturación del periodo.");
  }
  if (input.debtConcentration > 50) {
    score -= 15;
    factors.push("Un cliente concentra más de la mitad del pendiente.");
  } else if (input.debtConcentration > 35) {
    score -= 8;
    factors.push("La deuda está concentrada en un cliente.");
  }
  if (input.expiredBudgets > 0) {
    score -= Math.min(10, input.expiredBudgets * 3);
    factors.push("Hay presupuestos caducados en el periodo.");
  }
  if (input.dataIssueCount > 5) {
    score -= 10;
    factors.push("Hay varias incidencias de calidad de datos.");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    canCalculate: true,
    score: finalScore,
    status: finalScore >= 75 ? "saludable" as const : finalScore >= 50 ? "atencion" as const : "riesgo" as const,
    label: finalScore >= 75 ? "Saludable" : finalScore >= 50 ? "Atención" : "Riesgo",
    factors: factors.length ? factors : ["No se detectan riesgos deterministas relevantes con los datos actuales."]
  };
}

function buildSummaryText({ period, invoiced, collected, outstanding, overdue, expenses }: { period: BusinessPeriod; invoiced: number; collected: number; outstanding: number; overdue: number; expenses: number }) {
  return `${period.label}: has facturado ${formatCurrency(invoiced)}, cobrado ${formatCurrency(collected)} y registrado ${formatCurrency(expenses)} en gastos. Tienes ${formatCurrency(outstanding)} pendientes, de los cuales ${formatCurrency(overdue)} están vencidos.`;
}

function invoicePeriodWhere(period: Pick<BusinessPeriod, "start" | "end">) {
  return {
    estado: { notIn: BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] },
    fechaEmision: { gte: period.start, lt: period.end }
  };
}

function dateWhere(field: "fecha" | "fechaCreacion", period: Pick<BusinessPeriod, "start" | "end">) {
  return { [field]: { gte: period.start, lt: period.end } };
}

function toCsv(headers: string[], rows: Array<Array<string | number | null>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number | null) {
  const text = neutralizeCsvFormula(String(value ?? ""));
  return `"${text.replaceAll('"', '""')}"`;
}

function neutralizeCsvFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function metadataHasAmount(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => ["importe", "amount", "total"].includes(key.toLowerCase()));
}

function isFiscalClient(type: string | null | undefined) {
  const normalized = normalizeStatus(type);
  return ["empresa", "autonomo", "comunidad", "pyme", "sociedad"].some((item) => normalized.includes(item));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + safeNumber(value), 0);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}
