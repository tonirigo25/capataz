import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BILLABLE_INVOICE_EXCLUDED_STATUSES,
  averageCollectionDays,
  calculateInvoiceMetrics,
  invoiceBalance,
  isBillableInvoiceStatus,
  percentOf,
  round,
  safeNumber
} from "@/lib/business-metrics";

export type TreasuryHorizonId = "7d" | "14d" | "30d" | "60d" | "90d" | "month_end" | "next_quarter" | "custom";
export type TreasuryScenarioId = "conservative" | "base" | "optimistic" | "custom";
export type ForecastCertainty = "confirmed" | "expected" | "uncertain";
export type ForecastDirection = "inflow" | "outflow";

export type TreasuryParams = {
  horizon?: TreasuryHorizonId | string;
  scenario?: TreasuryScenarioId | string;
  from?: string | Date | null;
  to?: string | Date | null;
  accountId?: string | null;
  workId?: string | null;
  clientId?: string | null;
  category?: string | null;
  status?: string | null;
  now?: Date;
  companyId?: string;
};

export type TreasuryForecastItem = {
  id: string;
  direction: ForecastDirection;
  amount: number;
  signedAmount: number;
  date: Date | null;
  effectiveDate: Date | null;
  title: string;
  description: string;
  status: string;
  certainty: ForecastCertainty;
  source: "invoice" | "expense" | "recurring" | "manual_expected" | "movement";
  sourceLabel: string;
  accountId?: string | null;
  accountName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  workId?: string | null;
  workTitle?: string | null;
  invoiceId?: string | null;
  expenseId?: string | null;
  href?: string;
  isTransfer?: boolean;
  assumptions: string[];
};

export type TreasuryAlert = {
  id: string;
  type: string;
  level: "info" | "warning" | "danger";
  date: Date | null;
  title: string;
  detail: string;
  amount: number | null;
  href?: string;
  action?: string;
};

export type TreasuryDataQualityIssue = {
  id: string;
  title: string;
  count: number;
  description: string;
  href: string;
};

export const TREASURY_HORIZON_OPTIONS: Array<{ id: TreasuryHorizonId; label: string }> = [
  { id: "7d", label: "7 días" },
  { id: "14d", label: "14 días" },
  { id: "30d", label: "30 días" },
  { id: "60d", label: "60 días" },
  { id: "90d", label: "90 días" },
  { id: "month_end", label: "Fin de mes" },
  { id: "next_quarter", label: "Próximo trimestre" }
];

export const TREASURY_SCENARIOS: Array<{ id: TreasuryScenarioId; label: string; description: string }> = [
  { id: "conservative", label: "Conservador", description: "Solo entradas confirmadas o manualmente marcadas como confirmadas; incluye todas las salidas conocidas." },
  { id: "base", label: "Base", description: "Incluye facturas pendientes por vencimiento, pagos previstos conocidos, recurrentes y previsiones manuales no inciertas." },
  { id: "optimistic", label: "Optimista", description: "Incluye también entradas inciertas registradas; nunca excluye pagos conocidos." },
  { id: "custom", label: "Personalizado", description: "Parte del escenario base y deja el sitio preparado para retrasos, exclusiones o hipótesis sin mutar datos reales." }
];

export const TREASURY_DEFINITIONS = [
  {
    id: "registered_cash_balance",
    name: "Saldo de tesorería registrado",
    formula: "Suma de saldos de cuentas activas: saldo manual vigente o saldo inicial más movimientos confirmados.",
    limitation: "Si no hay cuentas o cajas configuradas, Capataz no muestra saldo bancario."
  },
  {
    id: "cash_flow",
    name: "Flujo de caja",
    formula: "Cobros menos pagos en el periodo. Las transferencias entre cuentas se excluyen del flujo de negocio.",
    limitation: "No equivale a beneficio ni a facturación."
  },
  {
    id: "forecast",
    name: "Tesorería prevista",
    formula: "Saldo inicial registrado + cobros previstos - pagos previstos.",
    limitation: "Es determinista y depende de vencimientos, previsiones manuales y gastos recurrentes registrados."
  },
  {
    id: "profit",
    name: "Beneficio",
    formula: "Facturación o cobros menos costes reales, según la métrica mostrada.",
    limitation: "No equivale a caja disponible."
  },
  {
    id: "break_even",
    name: "Punto de equilibrio",
    formula: "Costes fijos / porcentaje de margen de contribución.",
    limitation: "Solo se calcula con gastos clasificados como fijos o variables y facturación suficiente."
  }
];

const invoiceSelect = {
  id: true,
  numero: true,
  concepto: true,
  total: true,
  importeBase: true,
  iva: true,
  pagado: true,
  pendiente: true,
  estado: true,
  fechaEmision: true,
  fechaVencimiento: true,
  clienteId: true,
  obraId: true,
  client: { select: { id: true, nombre: true } },
  work: { select: { id: true, titulo: true } },
  payments: { select: { id: true, importe: true, fecha: true } }
} as const satisfies Prisma.InvoiceSelect;

type TreasuryInvoice = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;

export async function getTreasuryOverview(params: TreasuryParams = {}) {
  const companyId = params.companyId;
  const now = params.now ?? new Date();
  const horizon = resolveTreasuryHorizon(params, now);
  const scenario = validScenario(params.scenario);
  const filters = {
    accountId: cleanFilter(params.accountId),
    workId: cleanFilter(params.workId),
    clientId: cleanFilter(params.clientId),
    category: cleanFilter(params.category),
    status: cleanFilter(params.status)
  };

  const [
    settings,
    accounts,
    movements,
    invoices,
    expenses,
    recurringExpenses,
    expectedCashFlows,
    works,
    clients
  ] = await Promise.all([
    prisma.treasurySettings.findFirst({ where: { companyId }, orderBy: { updatedAt: "desc" } }),
    prisma.financialAccount.findMany({
      where: { companyId, archivedAt: null },
      include: {
        movements: {
          where: { archivedAt: null, status: "confirmed" },
          select: { id: true, type: true, amount: true, date: true, status: true, archivedAt: true }
        }
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.cashMovement.findMany({
      where: {
        companyId,
        archivedAt: null,
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.workId ? { workId: filters.workId } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        date: { lte: horizon.end }
      },
      include: {
        account: { select: { id: true, name: true, currency: true } },
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } },
        invoice: { select: { id: true, numero: true } },
        payment: { select: { id: true, importe: true } },
        expense: { select: { id: true, concepto: true } }
      },
      orderBy: { date: "desc" },
      take: 250
    }),
    prisma.invoice.findMany({
      where: {
        companyId,
        estado: { notIn: BILLABLE_INVOICE_EXCLUDED_STATUSES as any },
        ...(filters.workId ? { obraId: filters.workId } : {}),
        ...(filters.clientId ? { clienteId: filters.clientId } : {})
      },
      select: invoiceSelect,
      orderBy: { fechaVencimiento: "asc" }
    }),
    prisma.expense.findMany({
      where: {
        companyId,
        ...(filters.workId ? { obraId: filters.workId } : {}),
        ...(filters.clientId ? { clienteId: filters.clientId } : {}),
        ...(filters.category ? { categoria: filters.category as any } : {})
      },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true, client: { select: { id: true, nombre: true } } } },
        purchaseInvoice: { select: { id: true, kind: true, invoiceNumber: true, pendingAmount: true } },
        cashMovements: { where: { archivedAt: null }, select: { id: true, status: true, type: true, amount: true } }
      },
      orderBy: { fecha: "desc" }
    }),
    prisma.recurringExpense.findMany({
      where: {
        companyId,
        archivedAt: null,
        isActive: true,
        nextDueDate: { lte: horizon.end },
        ...(filters.workId ? { workId: filters.workId } : {}),
        ...(filters.category ? { category: filters.category } : {})
      },
      include: { work: { select: { id: true, titulo: true, client: { select: { id: true, nombre: true } } } } },
      orderBy: { nextDueDate: "asc" }
    }),
    prisma.expectedCashFlow.findMany({
      where: {
        companyId,
        archivedAt: null,
        status: { not: "cancelled" },
        expectedDate: { lte: horizon.end },
        ...(filters.workId ? { workId: filters.workId } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {})
      },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } },
        invoice: { select: { id: true, numero: true } },
        expense: { select: { id: true, concepto: true } },
        recurringExpense: { select: { id: true, name: true } }
      },
      orderBy: { expectedDate: "asc" }
    }),
    prisma.work.findMany({
      where: { companyId, ...(filters.workId ? { id: filters.workId } : { archivada: false }) },
      include: {
        client: { select: { id: true, nombre: true } },
        budgets: { select: { id: true, total: true, estado: true } },
        invoices: { select: invoiceSelect },
        payments: { select: { id: true, importe: true, fecha: true } },
        expenses: {
          include: {
            cashMovements: { where: { archivedAt: null }, select: { id: true, status: true, type: true, amount: true } }
          }
        },
        cashMovements: { where: { archivedAt: null }, select: { id: true, type: true, amount: true, status: true } }
      }
    }),
    prisma.client.findMany({
      where: { companyId, ...(filters.clientId ? { id: filters.clientId } : { archivadoAt: null }) },
      include: {
        invoices: { select: invoiceSelect },
        payments: { select: { id: true, importe: true, fecha: true } },
        expenses: { select: { id: true, importe: true, categoria: true, costBehavior: true } },
        works: {
          select: {
            id: true,
            expenses: { select: { id: true, importe: true, categoria: true, costBehavior: true } }
          }
        }
      }
    })
  ]);

  const accountSummaries = buildAccountSummaries(accounts, now);
  const registeredBalance = accountSummaries.length ? sum(accountSummaries.filter((account) => account.isActive).map((account) => account.balance)) : null;
  const accountMinimum = sum(accountSummaries.map((account) => safeNumber(account.minimumBalance)));
  const effectiveMinimumBalance = safeNumber(settings?.minimumCashBalance) || accountMinimum || null;
  const collectionDelays = buildCollectionDelayByClient(invoices);

  const receivables = buildReceivableForecastItems(invoices, collectionDelays, horizon, now);
  const payables = [
    ...buildExpenseForecastItems(expenses, horizon, now),
    ...buildRecurringForecastItems(recurringExpenses, horizon),
    ...buildExpectedCashFlowItems(expectedCashFlows, horizon),
    ...buildMovementForecastItems(movements, horizon)
  ];

  const allForecastItems = [...receivables, ...payables]
    .filter((item) => matchesForecastFilters(item, filters))
    .sort((a, b) => timeValue(a.effectiveDate ?? a.date) - timeValue(b.effectiveDate ?? b.date));
  const selectedForecast = buildForecast({
    items: allForecastItems,
    scenario,
    registeredBalance,
    horizon,
    minimumBalance: effectiveMinimumBalance
  });
  const scenarioComparison = (["conservative", "base", "optimistic"] as TreasuryScenarioId[]).map((id) => ({
    scenario: id,
    label: scenarioLabel(id),
    ...buildForecast({
      items: allForecastItems,
      scenario: id,
      registeredBalance,
      horizon,
      minimumBalance: effectiveMinimumBalance
    }).summary
  }));

  const invoiceMetrics = calculateInvoiceMetrics(invoices, now);
  const movementSummary = summarizeMovements(movements, horizon);
  const workProfitability = buildAdvancedWorkProfitability(works);
  const clientProfitability = buildClientProfitability(clients);
  const breakEven = calculateBreakEven(expenses, recurringExpenses, invoices, now);
  const coverage = calculateCoverage({
    registeredBalance,
    settings,
    expenses,
    forecast: selectedForecast,
    horizon
  });
  const qualityIssues = buildFinancialDataQualityIssues({
    accounts: accountSummaries,
    movements,
    invoices,
    expenses,
    recurringExpenses
  });
  const alerts = buildTreasuryAlerts({
    registeredBalance,
    minimumBalance: effectiveMinimumBalance,
    forecast: selectedForecast,
    invoices,
    movements,
    workProfitability,
    clientProfitability,
    accountSummaries,
    now
  });

  return {
    updatedAt: new Date(),
    params: { horizon: horizon.id, scenario, filters },
    horizon,
    horizonOptions: TREASURY_HORIZON_OPTIONS,
    scenario,
    scenarioOptions: TREASURY_SCENARIOS,
    settings,
    accounts: accountSummaries,
    hasAccounts: accountSummaries.length > 0,
    registeredBalance,
    effectiveMinimumBalance,
    movements: movements.map(toMovementRow),
    movementSummary,
    receivables: receivables.sort((a, b) => timeValue(a.effectiveDate ?? a.date) - timeValue(b.effectiveDate ?? b.date)),
    payables: payables.sort((a, b) => timeValue(a.effectiveDate ?? a.date) - timeValue(b.effectiveDate ?? b.date)),
    forecast: selectedForecast,
    scenarioComparison,
    invoices: {
      pending: invoiceMetrics.pending,
      overdue: invoiceMetrics.overdue,
      pendingCount: invoiceMetrics.count - invoiceMetrics.paidCount,
      overdueCount: invoiceMetrics.overdueCount,
      partialCount: invoiceMetrics.partialCount,
      overpaidCount: invoiceMetrics.overpaidCount
    },
    payablesSummary: summarizePayables(payables),
    workProfitability,
    clientProfitability,
    concentration: buildConcentration(clientProfitability, workProfitability),
    breakEven,
    coverage,
    qualityIssues,
    alerts,
    definitions: TREASURY_DEFINITIONS,
    assumptions: forecastAssumptions(scenario, registeredBalance, horizon)
  };
}

export async function buildTreasuryCsvExport(kind: string, params: TreasuryParams = {}) {
  const overview = await getTreasuryOverview(params);
  const generatedAt = new Date().toISOString();
  const common = [
    ["generado_en", generatedAt],
    ["periodo", `${isoDate(overview.horizon.start)}..${isoDate(overview.horizon.end)}`],
    ["escenario", scenarioLabel(overview.scenario)]
  ];

  if (kind === "movements") {
    return toCsv(
      ["fecha", "cuenta", "tipo", "descripcion", "entrada", "salida", "estado", "origen", "obra", "cliente", "generado_en"],
      overview.movements.map((movement) => [
        isoDate(movement.date),
        movement.accountName,
        movement.type,
        movement.description,
        movement.direction === "inflow" ? movement.amount : "",
        movement.direction === "outflow" ? movement.amount : "",
        movement.status,
        movement.source,
        movement.workTitle ?? "",
        movement.clientName ?? "",
        generatedAt
      ])
    );
  }

  if (kind === "forecast") {
    return toCsv(
      ["fecha", "tipo", "importe", "certeza", "fuente", "concepto", "obra", "cliente", "supuestos", "generado_en"],
      overview.forecast.items.map((item) => [
        item.effectiveDate ? isoDate(item.effectiveDate) : "sin fecha",
        item.direction,
        item.amount,
        item.certainty,
        item.sourceLabel,
        item.title,
        item.workTitle ?? "",
        item.clientName ?? "",
        item.assumptions.join(" | "),
        generatedAt
      ])
    );
  }

  if (kind === "receivables") {
    return toCsv(
      ["fecha_prevista", "cliente", "factura", "obra", "importe_pendiente", "estado", "certeza", "supuestos", "generado_en"],
      overview.receivables.map((item) => [
        item.effectiveDate ? isoDate(item.effectiveDate) : "sin fecha",
        item.clientName ?? "",
        item.title,
        item.workTitle ?? "",
        item.amount,
        item.status,
        item.certainty,
        item.assumptions.join(" | "),
        generatedAt
      ])
    );
  }

  if (kind === "payables") {
    return toCsv(
      ["fecha_prevista", "proveedor_concepto", "obra", "categoria", "importe", "estado", "certeza", "supuestos", "generado_en"],
      overview.payables.map((item) => [
        item.effectiveDate ? isoDate(item.effectiveDate) : "sin fecha",
        item.title,
        item.workTitle ?? "",
        item.sourceLabel,
        item.amount,
        item.status,
        item.certainty,
        item.assumptions.join(" | "),
        generatedAt
      ])
    );
  }

  if (kind === "work-profitability") {
    return toCsv(
      ["obra", "cliente", "presupuestado", "facturado", "cobrado", "pendiente", "coste_previsto", "coste_real", "coste_pagado", "beneficio", "margen", "desviacion", "flujo_caja", "generado_en"],
      overview.workProfitability.map((work) => [
        work.title,
        work.clientName,
        work.budgeted,
        work.invoiced,
        work.collected,
        work.pending,
        work.forecastCost,
        work.realCost,
        work.paidCost,
        work.profitOnInvoiced,
        round(work.marginOnInvoiced),
        work.costDeviation,
        work.cashFlow,
        generatedAt
      ])
    );
  }

  if (kind === "client-profitability") {
    return toCsv(
      ["cliente", "facturado", "cobrado", "pendiente", "vencido", "gastos", "beneficio", "margen", "plazo_medio_cobro", "obras", "concentracion_deuda", "generado_en"],
      overview.clientProfitability.map((client) => [
        client.name,
        client.invoiced,
        client.collected,
        client.pending,
        client.overdue,
        client.expenses,
        client.profit,
        round(client.margin),
        client.averageCollectionDays ?? "",
        client.workCount,
        round(client.debtShare),
        generatedAt
      ])
    );
  }

  if (kind === "deviations") {
    return toCsv(
      ["obra", "cliente", "coste_previsto", "coste_real", "desviacion", "margen_real", "necesidad_caja", "generado_en"],
      overview.workProfitability
        .filter((work) => work.costDeviation !== 0 || work.cashNeed > 0)
        .map((work) => [
          work.title,
          work.clientName,
          work.forecastCost,
          work.realCost,
          work.costDeviation,
          round(work.marginOnInvoiced),
          work.cashNeed,
          generatedAt
        ])
    );
  }

  return toCsv(["clave", "valor"], common);
}

export async function getTodayTreasurySignals(companyId?: string) {
  const overview = await getTreasuryOverview({ companyId, horizon: "30d", scenario: "base" });
  return overview.alerts.slice(0, 5);
}

function resolveTreasuryHorizon(params: TreasuryParams, now: Date) {
  const id = validHorizon(params.horizon);
  const start = startOfDay(now);
  if (id === "custom") {
    const customStart = startOfDay(parseDate(params.from) ?? start);
    const inclusiveEnd = startOfDay(parseDate(params.to) ?? customStart);
    return { id, label: `${formatShortDate(customStart)} - ${formatShortDate(inclusiveEnd)}`, start: customStart, end: endOfDay(inclusiveEnd), days: daysBetween(customStart, endOfDay(inclusiveEnd)) + 1 };
  }
  if (id === "month_end") {
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { id, label: "Fin de mes", start, end, days: daysBetween(start, end) + 1 };
  }
  if (id === "next_quarter") {
    const month = Math.floor(now.getMonth() / 3) * 3 + 3;
    const quarterStart = new Date(now.getFullYear(), month, 1);
    const end = endOfDay(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0));
    return { id, label: "Próximo trimestre", start, end, days: daysBetween(start, end) + 1 };
  }
  const days = Number(id.replace("d", ""));
  return { id, label: `${days} días`, start, end: endOfDay(addDays(start, days - 1)), days };
}

function validHorizon(value: string | undefined): TreasuryHorizonId {
  return ["7d", "14d", "30d", "60d", "90d", "month_end", "next_quarter", "custom"].includes(value ?? "") ? value as TreasuryHorizonId : "30d";
}

function validScenario(value: string | undefined): TreasuryScenarioId {
  return ["conservative", "base", "optimistic", "custom"].includes(value ?? "") ? value as TreasuryScenarioId : "base";
}

function buildAccountSummaries(accounts: Array<Prisma.FinancialAccountGetPayload<{ include: { movements: { select: { id: true; type: true; amount: true; date: true; status: true; archivedAt: true } } } }>>, now: Date) {
  return accounts.map((account) => {
    const movementBalance = sum(account.movements.filter((movement) => movement.date <= now).map((movement) => signedMovementAmount(movement.type, movement.amount)));
    const calculatedBalance = safeNumber(account.openingBalance) + movementBalance;
    const manual = account.currentManualBalance !== null && account.currentManualBalance !== undefined;
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      openingBalance: account.openingBalance,
      calculatedBalance,
      currentManualBalance: account.currentManualBalance,
      balance: manual ? safeNumber(account.currentManualBalance) : calculatedBalance,
      balanceMode: manual ? "manual" as const : "calculated" as const,
      manualBalanceUpdatedAt: account.manualBalanceUpdatedAt,
      minimumBalance: account.minimumBalance,
      isActive: account.isActive,
      archivedAt: account.archivedAt,
      movementCount: account.movements.length
    };
  });
}

function buildReceivableForecastItems(invoices: TreasuryInvoice[], collectionDelays: Map<string, { count: number; averageDelay: number }>, horizon: ReturnType<typeof resolveTreasuryHorizon>, now: Date): TreasuryForecastItem[] {
  return invoices.flatMap((invoice) => {
    const balance = invoiceBalance(invoice);
    if (balance.pending <= 0 || !isBillableInvoiceStatus(invoice.estado)) return [];
    const due = startOfDay(invoice.fechaVencimiento);
    if (due > horizon.end) return [];
    const overdue = due < startOfDay(now);
    const historicalDelay = collectionDelays.get(invoice.clienteId);
    const assumptions = [
      "Factura válida pendiente; se usa la fecha de vencimiento contractual como base.",
      "No se asume cobro bancario si no existe movimiento de tesorería asociado."
    ];
    if (historicalDelay && historicalDelay.count >= 3) {
      assumptions.push(`Histórico del cliente: ${historicalDelay.count} facturas completas, retraso medio ${round(historicalDelay.averageDelay)} días.`);
    }
    return [{
      id: `invoice:${invoice.id}`,
      direction: "inflow" as const,
      amount: balance.pending,
      signedAmount: balance.pending,
      date: due,
      effectiveDate: overdue ? horizon.start : due,
      title: `Factura ${invoice.numero}`,
      description: invoice.concepto,
      status: overdue ? "vencido" : "previsto",
      certainty: "expected" as const,
      source: "invoice" as const,
      sourceLabel: "Factura pendiente",
      clientId: invoice.clienteId,
      clientName: invoice.client.nombre,
      workId: invoice.obraId,
      workTitle: invoice.work?.titulo ?? null,
      invoiceId: invoice.id,
      href: `/dinero/${invoice.id}`,
      assumptions
    }];
  });
}

function buildExpenseForecastItems(expenses: Array<Prisma.ExpenseGetPayload<{ include: { client: { select: { id: true; nombre: true } }; work: { select: { id: true; titulo: true; client: { select: { id: true; nombre: true } } } }; purchaseInvoice: { select: { id: true; kind: true; invoiceNumber: true; pendingAmount: true } }; cashMovements: { select: { id: true; status: true; type: true; amount: true } } } }>>, horizon: ReturnType<typeof resolveTreasuryHorizon>, now: Date): TreasuryForecastItem[] {
  return expenses.flatMap((expense) => {
    if (expense.paymentStatus !== "pending") return [];
    if (expense.cashMovements.some((movement) => movement.status !== "cancelled")) return [];
    const payableAmount = expense.purchaseInvoice?.pendingAmount ?? expense.importe;
    if (!expense.paymentDueDate) {
      const item: TreasuryForecastItem = {
        id: `expense-unscheduled:${expense.id}`,
        direction: "outflow" as const,
        amount: payableAmount,
        signedAmount: -payableAmount,
        date: null,
        effectiveDate: null,
        title: expense.proveedor,
        description: expense.concepto,
        status: "sin_fecha_prevista",
        certainty: "confirmed" as const,
        source: "expense" as const,
        sourceLabel: String(expense.categoria),
        clientId: expense.clienteId ?? expense.work?.client.id ?? null,
        clientName: expense.client?.nombre ?? expense.work?.client.nombre ?? null,
        workId: expense.obraId,
        workTitle: expense.work?.titulo ?? null,
        expenseId: expense.id,
        href: expense.purchaseInvoice ? `/${expense.purchaseInvoice.kind === "SUBCONTRACTOR" ? "facturas-subcontratas" : "facturas-proveedor"}/${expense.purchaseInvoice.id}` : "/gastos-materiales",
        assumptions: ["Gasto marcado como pendiente, pero sin fecha de pago: no se coloca artificialmente en el calendario."]
      };
      return [item];
    }
    const due = startOfDay(expense.paymentDueDate);
    if (due > horizon.end) return [];
    const item: TreasuryForecastItem = {
      id: `expense:${expense.id}`,
      direction: "outflow" as const,
      amount: payableAmount,
      signedAmount: -payableAmount,
      date: due,
      effectiveDate: due < horizon.start ? horizon.start : due,
      title: expense.proveedor,
      description: expense.concepto,
      status: due < startOfDay(now) ? "vencido" : "pendiente",
      certainty: "confirmed" as const,
      source: "expense" as const,
      sourceLabel: String(expense.categoria),
      clientId: expense.clienteId ?? expense.work?.client.id ?? null,
      clientName: expense.client?.nombre ?? expense.work?.client.nombre ?? null,
      workId: expense.obraId,
      workTitle: expense.work?.titulo ?? null,
      expenseId: expense.id,
      href: expense.purchaseInvoice ? `/${expense.purchaseInvoice.kind === "SUBCONTRACTOR" ? "facturas-subcontratas" : "facturas-proveedor"}/${expense.purchaseInvoice.id}` : "/gastos-materiales",
      assumptions: ["Gasto registrado como pendiente con fecha de pago explícita."]
    };
    return [item];
  });
}

function buildRecurringForecastItems(recurringExpenses: Array<Prisma.RecurringExpenseGetPayload<{ include: { work: { select: { id: true; titulo: true; client: { select: { id: true; nombre: true } } } } } }>>, horizon: ReturnType<typeof resolveTreasuryHorizon>): TreasuryForecastItem[] {
  const items: TreasuryForecastItem[] = [];
  for (const recurring of recurringExpenses) {
    let date = startOfDay(recurring.nextDueDate);
    let guard = 0;
    while (date <= horizon.end && guard < 40) {
      if (date >= horizon.start || recurring.nextDueDate < horizon.start) {
        items.push({
          id: `recurring:${recurring.id}:${isoDate(date)}`,
          direction: "outflow",
          amount: recurring.amount,
          signedAmount: -recurring.amount,
          date,
          effectiveDate: date < horizon.start ? horizon.start : date,
          title: recurring.provider ? `${recurring.provider} · ${recurring.name}` : recurring.name,
          description: `Gasto recurrente ${frequencyLabel(recurring.frequency)}`,
          status: "previsto",
          certainty: "expected",
          source: "recurring",
          sourceLabel: recurring.category ?? "recurrente",
          workId: recurring.workId,
          workTitle: recurring.work?.titulo ?? null,
          clientId: recurring.work?.client.id ?? null,
          clientName: recurring.work?.client.nombre ?? null,
          href: "/tesoreria",
          assumptions: ["El gasto recurrente genera previsiones dentro del horizonte; no crea gastos reales automáticamente."]
        });
      }
      date = nextRecurringDate(date, recurring.frequency);
      guard += 1;
    }
  }
  return items;
}

function buildExpectedCashFlowItems(expectedCashFlows: Array<Prisma.ExpectedCashFlowGetPayload<{ include: { client: { select: { id: true; nombre: true } }; work: { select: { id: true; titulo: true } }; invoice: { select: { id: true; numero: true } }; expense: { select: { id: true; concepto: true } }; recurringExpense: { select: { id: true; name: true } } } }>>, horizon: ReturnType<typeof resolveTreasuryHorizon>): TreasuryForecastItem[] {
  return expectedCashFlows
    .filter((flow) => !(flow.source === "recurring" && flow.recurringExpenseId))
    .map((flow) => {
      const direction: ForecastDirection = flow.type === "expected_inflow" ? "inflow" : "outflow";
      const amount = safeNumber(flow.amount);
      const date = startOfDay(flow.expectedDate);
      const certainty: ForecastCertainty = flow.status === "confirmed" ? "confirmed" : safeNumber(flow.probability) > 0 && safeNumber(flow.probability) < 0.5 ? "uncertain" : "expected";
      return {
        id: `expected:${flow.id}`,
        direction,
        amount,
        signedAmount: direction === "inflow" ? amount : -amount,
        date,
        effectiveDate: date < horizon.start ? horizon.start : date,
        title: flow.description,
        description: flow.confidenceSource ?? "Previsión manual",
        status: flow.status,
        certainty,
        source: "manual_expected" as const,
        sourceLabel: flow.source,
        clientId: flow.clientId,
        clientName: flow.client?.nombre ?? null,
        workId: flow.workId,
        workTitle: flow.work?.titulo ?? null,
        invoiceId: flow.invoiceId,
        expenseId: flow.expenseId,
        href: flow.invoiceId ? `/dinero/${flow.invoiceId}` : flow.workId ? `/obras/${flow.workId}` : "/tesoreria",
        assumptions: [
          "Previsión registrada manualmente; no modifica facturas, pagos ni gastos reales.",
          flow.probability ? `Probabilidad registrada: ${round(flow.probability * 100)}%.` : "Sin probabilidad numérica registrada."
        ]
      };
    });
}

function buildMovementForecastItems(movements: Array<Prisma.CashMovementGetPayload<{ include: { account: { select: { id: true; name: true; currency: true } }; client: { select: { id: true; nombre: true } }; work: { select: { id: true; titulo: true } }; invoice: { select: { id: true; numero: true } }; payment: { select: { id: true; importe: true } }; expense: { select: { id: true; concepto: true } } } }>>, horizon: ReturnType<typeof resolveTreasuryHorizon>): TreasuryForecastItem[] {
  return movements
    .filter((movement) => movement.status !== "cancelled" && movement.date >= horizon.start && movement.date <= horizon.end)
    .map((movement) => {
      const signedAmount = signedMovementAmount(movement.type, movement.amount);
      const direction: ForecastDirection = signedAmount >= 0 ? "inflow" : "outflow";
      const isTransfer = movement.type === "transfer_in" || movement.type === "transfer_out";
      return {
        id: `movement:${movement.id}`,
        direction,
        amount: Math.abs(signedAmount),
        signedAmount,
        date: startOfDay(movement.date),
        effectiveDate: startOfDay(movement.date),
        title: movement.description,
        description: movement.notes ?? movement.category ?? "Movimiento de tesorería",
        status: movement.status,
        certainty: movement.status === "confirmed" ? "confirmed" as const : "expected" as const,
        source: "movement" as const,
        sourceLabel: movement.source,
        accountId: movement.accountId,
        accountName: movement.account.name,
        clientId: movement.clientId,
        clientName: movement.client?.nombre ?? null,
        workId: movement.workId,
        workTitle: movement.work?.titulo ?? null,
        invoiceId: movement.invoiceId,
        expenseId: movement.expenseId,
        href: movement.invoiceId ? `/dinero/${movement.invoiceId}` : movement.workId ? `/obras/${movement.workId}` : "/tesoreria",
        isTransfer,
        assumptions: [isTransfer ? "Transferencia entre cuentas: afecta a saldos de cuenta, pero se excluye del flujo de negocio." : "Movimiento de tesorería registrado explícitamente."]
      };
    });
}

function buildForecast({
  items,
  scenario,
  registeredBalance,
  horizon,
  minimumBalance
}: {
  items: TreasuryForecastItem[];
  scenario: TreasuryScenarioId;
  registeredBalance: number | null;
  horizon: ReturnType<typeof resolveTreasuryHorizon>;
  minimumBalance: number | null;
}) {
  const included = items.filter((item) => item.effectiveDate && includesItemInScenario(item, scenario));
  const businessItems = included.filter((item) => !item.isTransfer);
  const confirmedInflows = sum(businessItems.filter((item) => item.direction === "inflow" && item.certainty === "confirmed").map((item) => item.amount));
  const expectedInflows = sum(businessItems.filter((item) => item.direction === "inflow" && item.certainty !== "confirmed").map((item) => item.amount));
  const confirmedOutflows = sum(businessItems.filter((item) => item.direction === "outflow" && item.certainty === "confirmed").map((item) => item.amount));
  const expectedOutflows = sum(businessItems.filter((item) => item.direction === "outflow" && item.certainty !== "confirmed").map((item) => item.amount));
  const net = sum(businessItems.map((item) => item.signedAmount));

  const daily = buildDailyForecast(included, registeredBalance, horizon);
  const minPoint = daily.reduce((current, point) => {
    if (point.balance === null) return current;
    if (!current || point.balance < current.balance) return { date: point.date, balance: point.balance };
    return current;
  }, null as null | { date: Date; balance: number });
  const deficitPoint = daily.find((point) => point.balance !== null && point.balance < 0) ?? null;
  const minimumBreach = minimumBalance !== null ? daily.find((point) => point.balance !== null && point.balance < minimumBalance) ?? null : null;
  const finalBalance = daily.length ? daily[daily.length - 1].balance : registeredBalance;

  return {
    items: included,
    daily,
    summary: {
      initialBalance: registeredBalance,
      confirmedInflows,
      expectedInflows,
      inflows: confirmedInflows + expectedInflows,
      confirmedOutflows,
      expectedOutflows,
      outflows: confirmedOutflows + expectedOutflows,
      net,
      finalBalance,
      minBalance: minPoint?.balance ?? null,
      minBalanceDate: minPoint?.date ?? null,
      deficitDate: deficitPoint?.date ?? null,
      minimumBreachDate: minimumBreach?.date ?? null,
      cashNeed: minPoint && minPoint.balance < 0 ? Math.abs(minPoint.balance) : 0,
      minimumCashNeed: minimumBreach && minimumBalance !== null ? minimumBalance - safeNumber(minimumBreach.balance) : 0
    }
  };
}

function buildDailyForecast(items: TreasuryForecastItem[], registeredBalance: number | null, horizon: ReturnType<typeof resolveTreasuryHorizon>) {
  const days = Math.min(120, horizon.days);
  let balance = registeredBalance;
  const daily: Array<{ date: Date; inflows: number; outflows: number; net: number; balance: number | null; items: number }> = [];
  for (let index = 0; index < days; index += 1) {
    const date = addDays(horizon.start, index);
    const dayItems = items.filter((item) => item.effectiveDate && sameDay(item.effectiveDate, date));
    const inflows = sum(dayItems.filter((item) => item.signedAmount > 0).map((item) => item.signedAmount));
    const outflows = Math.abs(sum(dayItems.filter((item) => item.signedAmount < 0).map((item) => item.signedAmount)));
    const net = inflows - outflows;
    if (balance !== null) balance += net;
    daily.push({ date, inflows, outflows, net, balance, items: dayItems.length });
  }
  return daily;
}

function includesItemInScenario(item: TreasuryForecastItem, scenario: TreasuryScenarioId) {
  if (item.direction === "outflow") return true;
  if (scenario === "conservative") return item.certainty === "confirmed";
  if (scenario === "optimistic") return true;
  return item.certainty !== "uncertain";
}

function summarizeMovements(movements: Array<{ type: string; amount: number; date: Date; status: string }>, horizon: ReturnType<typeof resolveTreasuryHorizon>) {
  const confirmed = movements.filter((movement) => movement.status === "confirmed" && movement.date >= horizon.start && movement.date <= horizon.end);
  const business = confirmed.filter((movement) => movement.type !== "transfer_in" && movement.type !== "transfer_out");
  const inflows = sum(business.filter((movement) => signedMovementAmount(movement.type, movement.amount) > 0).map((movement) => signedMovementAmount(movement.type, movement.amount)));
  const outflows = Math.abs(sum(business.filter((movement) => signedMovementAmount(movement.type, movement.amount) < 0).map((movement) => signedMovementAmount(movement.type, movement.amount))));
  return { inflows, outflows, net: inflows - outflows, count: business.length };
}

function summarizePayables(payables: TreasuryForecastItem[]) {
  const scheduled = payables.filter((item) => item.direction === "outflow" && item.effectiveDate);
  const unscheduled = payables.filter((item) => item.direction === "outflow" && !item.effectiveDate);
  return {
    scheduledTotal: sum(scheduled.map((item) => item.amount)),
    unscheduledTotal: sum(unscheduled.map((item) => item.amount)),
    scheduledCount: scheduled.length,
    unscheduledCount: unscheduled.length
  };
}

function buildAdvancedWorkProfitability(works: Array<Prisma.WorkGetPayload<{ include: { client: { select: { id: true; nombre: true } }; budgets: { select: { id: true; total: true; estado: true } }; invoices: { select: typeof invoiceSelect }; payments: { select: { id: true; importe: true; fecha: true } }; expenses: { include: { cashMovements: { select: { id: true; status: true; type: true; amount: true } } } }; cashMovements: { select: { id: true; type: true; amount: true; status: true } } } }>>) {
  return works.map((work) => {
    const invoiceMetrics = calculateInvoiceMetrics(work.invoices);
    const acceptedBudget = sum(work.budgets.filter((budget) => budget.estado === "aceptado").map((budget) => budget.total));
    const validBudget = sum(work.budgets.filter((budget) => !["rechazado", "caducado"].includes(String(budget.estado))).map((budget) => budget.total));
    const budgeted = safeNumber(work.presupuestoAprobado) || acceptedBudget || validBudget;
    const realExpenseCost = sum(work.expenses.map((expense) => expense.importe));
    const realCost = Math.max(realExpenseCost, safeNumber(work.gastoReal));
    const pendingExpenseCost = sum(work.expenses.filter((expense) => expense.paymentStatus === "pending").map((expense) => expense.importe));
    const paidExpenseCost = sum(work.expenses.filter((expense) => expense.paymentStatus === "paid").map((expense) => expense.importe));
    const linkedOutflows = Math.abs(sum(work.cashMovements.filter((movement) => movement.status !== "cancelled" && signedMovementAmount(movement.type, movement.amount) < 0).map((movement) => signedMovementAmount(movement.type, movement.amount))));
    const paidCost = Math.max(paidExpenseCost, linkedOutflows);
    const forecastCost = safeNumber(work.costePrevisto);
    const cashFlow = invoiceMetrics.paid - paidCost;
    const profitOnInvoiced = invoiceMetrics.total - realCost;
    const profitOnCollected = invoiceMetrics.paid - realCost;
    const costDeviation = forecastCost > 0 ? realCost - forecastCost : 0;
    return {
      workId: work.id,
      title: work.titulo,
      clientId: work.clienteId,
      clientName: work.client.nombre,
      status: work.estado,
      budgeted,
      invoiced: invoiceMetrics.total,
      collected: invoiceMetrics.paid,
      pending: invoiceMetrics.pending,
      forecastCost,
      committedCost: pendingExpenseCost,
      realCost,
      paidCost,
      profitForecast: budgeted - forecastCost,
      profitOnInvoiced,
      profitOnCollected,
      marginForecast: percentOf(budgeted - forecastCost, budgeted),
      marginOnInvoiced: percentOf(profitOnInvoiced, invoiceMetrics.total),
      marginOnCollected: percentOf(profitOnCollected, invoiceMetrics.paid),
      costDeviation,
      cashFlow,
      workBalance: cashFlow,
      cashNeed: cashFlow < 0 ? Math.abs(cashFlow) : 0,
      hasEnoughData: budgeted > 0 || invoiceMetrics.total > 0 || realCost > 0 || invoiceMetrics.paid > 0
    };
  }).sort((a, b) => b.profitOnInvoiced - a.profitOnInvoiced);
}

function buildClientProfitability(clients: Array<Prisma.ClientGetPayload<{ include: { invoices: { select: typeof invoiceSelect }; payments: { select: { id: true; importe: true; fecha: true } }; expenses: { select: { id: true; importe: true; categoria: true; costBehavior: true } }; works: { select: { id: true; expenses: { select: { id: true; importe: true; categoria: true; costBehavior: true } } } } } }>>) {
  const mapped = clients.map((client) => {
    const invoiceMetrics = calculateInvoiceMetrics(client.invoices);
    const expenses = uniqueExpenses([...client.expenses, ...client.works.flatMap((work) => work.expenses)]);
    const expenseTotal = sum(expenses.map((expense) => expense.importe));
    const collected = sum(client.payments.map((payment) => payment.importe));
    const profit = invoiceMetrics.total - expenseTotal;
    return {
      clientId: client.id,
      name: client.nombre,
      budgeted: 0,
      invoiced: invoiceMetrics.total,
      collected,
      pending: invoiceMetrics.pending,
      overdue: invoiceMetrics.overdue,
      expenses: expenseTotal,
      profit,
      margin: percentOf(profit, invoiceMetrics.total),
      averageCollectionDays: averageCollectionDays(client.invoices),
      overdueInvoices: invoiceMetrics.overdueCount,
      workCount: client.works.length,
      revenueShare: 0,
      debtShare: 0,
      href: `/clientes/${client.id}`
    };
  });
  const totalRevenue = sum(mapped.map((client) => client.invoiced));
  const totalDebt = sum(mapped.map((client) => client.pending));
  return mapped
    .map((client) => ({
      ...client,
      revenueShare: totalRevenue ? client.invoiced / totalRevenue * 100 : 0,
      debtShare: totalDebt ? client.pending / totalDebt * 100 : 0
    }))
    .sort((a, b) => b.pending - a.pending || b.invoiced - a.invoiced);
}

function calculateBreakEven(
  expenses: Array<{ importe: number; fecha: Date; costBehavior: string | null }>,
  recurringExpenses: Array<{ amount: number; fixedCost: boolean; nextDueDate: Date }>,
  invoices: TreasuryInvoice[],
  now: Date
) {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const periodExpenses = expenses.filter((expense) => expense.fecha >= periodStart && expense.fecha < periodEnd);
  const fixedCosts = sum(periodExpenses.filter((expense) => expense.costBehavior === "fixed").map((expense) => expense.importe))
    + sum(recurringExpenses.filter((expense) => expense.fixedCost && expense.nextDueDate >= periodStart && expense.nextDueDate < periodEnd).map((expense) => expense.amount));
  const variableCosts = sum(periodExpenses.filter((expense) => expense.costBehavior === "variable").map((expense) => expense.importe));
  const unclassified = periodExpenses.filter((expense) => !["fixed", "variable"].includes(String(expense.costBehavior))).length;
  const invoiced = sum(invoices.filter((invoice) => invoice.fechaEmision >= periodStart && invoice.fechaEmision < periodEnd && isBillableInvoiceStatus(invoice.estado)).map((invoice) => invoice.total));
  if (fixedCosts <= 0 || invoiced <= 0 || unclassified > periodExpenses.length / 2) {
    return {
      canCalculate: false,
      fixedCosts,
      variableCosts,
      contributionMarginPercent: null,
      breakEvenRevenue: null,
      collectionsNeeded: null,
      explanation: "No hay suficientes gastos clasificados como fijos/variables y facturación del mes para calcular el punto de equilibrio."
    };
  }
  const contributionMargin = (invoiced - variableCosts) / invoiced;
  if (contributionMargin <= 0) {
    return {
      canCalculate: false,
      fixedCosts,
      variableCosts,
      contributionMarginPercent: contributionMargin * 100,
      breakEvenRevenue: null,
      collectionsNeeded: null,
      explanation: "El margen de contribución no es positivo; no se puede dividir por cero o por un margen negativo."
    };
  }
  const breakEvenRevenue = fixedCosts / contributionMargin;
  return {
    canCalculate: true,
    fixedCosts,
    variableCosts,
    contributionMarginPercent: contributionMargin * 100,
    breakEvenRevenue,
    collectionsNeeded: breakEvenRevenue,
    explanation: "Punto de equilibrio = costes fijos del mes / margen de contribución observado en facturas emitidas del mes."
  };
}

function calculateCoverage({
  registeredBalance,
  settings,
  expenses,
  forecast,
  horizon
}: {
  registeredBalance: number | null;
  settings: { targetCoverageDays: number | null } | null;
  expenses: Array<{ importe: number; fecha: Date }>;
  forecast: ReturnType<typeof buildForecast>;
  horizon: ReturnType<typeof resolveTreasuryHorizon>;
}) {
  const baselineStart = addDays(horizon.start, -90);
  const recentExpenses = expenses.filter((expense) => expense.fecha >= baselineStart && expense.fecha < horizon.start);
  const monthlyAverage = sum(recentExpenses.map((expense) => expense.importe)) / 3;
  const dailyAverage = monthlyAverage / 30;
  const confirmedInflows = forecast.summary.confirmedInflows;
  if (registeredBalance === null || dailyAverage <= 0) {
    return {
      canCalculate: false,
      monthlyExpenseAverage: monthlyAverage,
      daysWithBalance: null,
      daysWithConfirmedInflows: null,
      targetCoverageDays: settings?.targetCoverageDays ?? null,
      explanation: "Para calcular cobertura hacen falta una cuenta con saldo registrado y gastos históricos suficientes."
    };
  }
  return {
    canCalculate: true,
    monthlyExpenseAverage: monthlyAverage,
    daysWithBalance: registeredBalance / dailyAverage,
    daysWithConfirmedInflows: (registeredBalance + confirmedInflows) / dailyAverage,
    targetCoverageDays: settings?.targetCoverageDays ?? null,
    explanation: "Cobertura calculada con gasto medio de los últimos 90 días. La versión principal no incluye cobros inciertos."
  };
}

function buildConcentration(clientProfitability: ReturnType<typeof buildClientProfitability>, workProfitability: ReturnType<typeof buildAdvancedWorkProfitability>) {
  const topDebtClient = clientProfitability[0] ?? null;
  const byRevenue = [...clientProfitability].sort((a, b) => b.invoiced - a.invoiced)[0] ?? null;
  const totalWorkRevenue = sum(workProfitability.map((work) => work.invoiced));
  const topWork = [...workProfitability].sort((a, b) => b.invoiced - a.invoiced)[0] ?? null;
  return {
    topDebtClient,
    topRevenueClient: byRevenue,
    topRevenueWork: topWork ? { ...topWork, revenueShare: totalWorkRevenue ? topWork.invoiced / totalWorkRevenue * 100 : 0 } : null
  };
}

function buildFinancialDataQualityIssues({
  accounts,
  movements,
  invoices,
  expenses,
  recurringExpenses
}: {
  accounts: ReturnType<typeof buildAccountSummaries>;
  movements: Array<{ id: string; type: string; amount: number; date: Date; accountId: string; description: string; transferGroupId: string | null; invoiceId: string | null; paymentId: string | null; expenseId: string | null }>;
  invoices: TreasuryInvoice[];
  expenses: Array<{ id: string; fecha: Date; paymentStatus: string | null; paymentDueDate: Date | null; obraId: string | null; importe: number; costBehavior: string | null }>;
  recurringExpenses: Array<{ id: string; nextDueDate: Date | null }>;
}): TreasuryDataQualityIssue[] {
  const overpaid = invoices.filter((invoice) => invoiceBalance(invoice).overpaid > 0);
  const inconsistentTotals = invoices.filter((invoice) => Math.abs(safeNumber(invoice.total) - (safeNumber(invoice.importeBase) + safeNumber(invoice.iva))) > 0.02);
  const expensesWithoutPaymentStatus = expenses.filter((expense) => !expense.paymentStatus);
  const pendingExpensesWithoutDueDate = expenses.filter((expense) => expense.paymentStatus === "pending" && !expense.paymentDueDate);
  const unclassifiedCosts = expenses.filter((expense) => !["fixed", "variable"].includes(String(expense.costBehavior)));
  const accountsWithoutInitial = accounts.filter((account) => account.openingBalance === 0 && account.currentManualBalance === null && account.movementCount === 0);
  const mixedCurrencies = new Set(accounts.map((account) => account.currency)).size > 1 ? accounts.length : 0;
  const duplicateMovements = duplicateMovementCount(movements);
  const unpairedTransfers = movements.filter((movement) => ["transfer_in", "transfer_out"].includes(movement.type) && !movement.transferGroupId);
  const invalidAmounts = movements.filter((movement) => movement.amount <= 0 && movement.type !== "adjustment");

  return [
    { id: "no-accounts", title: "Cuentas no configuradas", count: accounts.length ? 0 : 1, description: "Sin cuenta o caja no se muestra saldo disponible.", href: "/tesoreria" },
    { id: "account-opening", title: "Cuentas sin saldo inicial trazable", count: accountsWithoutInitial.length, description: "Cuentas activas sin saldo manual, inicial ni movimientos.", href: "/tesoreria" },
    { id: "mixed-currency", title: "Monedas mezcladas", count: mixedCurrencies, description: "Hay cuentas con distinta moneda; los totales agregados pueden no ser comparables.", href: "/tesoreria" },
    { id: "expense-payment-status", title: "Gastos sin estado de pago", count: expensesWithoutPaymentStatus.length, description: "No se puede saber si son pagos pendientes o ya pagados.", href: "/gastos-materiales" },
    { id: "expense-due-date", title: "Gastos pendientes sin fecha de pago", count: pendingExpensesWithoutDueDate.length, description: "No se colocan en el calendario hasta registrar una fecha prevista.", href: "/gastos-materiales" },
    { id: "cost-behavior", title: "Costes sin clasificar fijo/variable", count: unclassifiedCosts.length, description: "Impide calcular con fiabilidad el punto de equilibrio.", href: "/gastos-materiales" },
    { id: "invoice-overpaid", title: "Facturas con sobrepago", count: overpaid.length, description: "Pagos registrados superiores al total de factura.", href: "/dinero" },
    { id: "invoice-total", title: "Facturas con total incoherente", count: inconsistentTotals.length, description: "Base más IVA no coincide con total.", href: "/dinero" },
    { id: "movement-duplicates", title: "Movimientos potencialmente duplicados", count: duplicateMovements, description: "Misma cuenta, fecha, importe, tipo y descripción.", href: "/tesoreria" },
    { id: "transfer-pairing", title: "Transferencias sin grupo", count: unpairedTransfers.length, description: "Una transferencia debe poder emparejar entrada y salida.", href: "/tesoreria" },
    { id: "movement-negative", title: "Importes negativos no justificados", count: invalidAmounts.length, description: "Los movimientos de entrada/salida deben ser positivos; los ajustes explican correcciones.", href: "/tesoreria" },
    { id: "recurring-date", title: "Gastos recurrentes sin próxima fecha", count: recurringExpenses.filter((expense) => !expense.nextDueDate).length, description: "No pueden generar previsiones sin próxima fecha.", href: "/tesoreria" }
  ];
}

function buildTreasuryAlerts({
  registeredBalance,
  minimumBalance,
  forecast,
  invoices,
  movements,
  workProfitability,
  clientProfitability,
  accountSummaries,
  now
}: {
  registeredBalance: number | null;
  minimumBalance: number | null;
  forecast: ReturnType<typeof buildForecast>;
  invoices: TreasuryInvoice[];
  movements: Array<{ id: string; type: string; amount: number; date: Date; description: string; transferGroupId: string | null }>;
  workProfitability: ReturnType<typeof buildAdvancedWorkProfitability>;
  clientProfitability: ReturnType<typeof buildClientProfitability>;
  accountSummaries: ReturnType<typeof buildAccountSummaries>;
  now: Date;
}): TreasuryAlert[] {
  const alerts: TreasuryAlert[] = [];
  if (!accountSummaries.length) {
    alerts.push({
      id: "no-account",
      type: "no_account",
      level: "info",
      date: null,
      title: "Tesorería sin cuenta configurada",
      detail: "Configura una cuenta o caja para controlar saldo disponible. No se inventa saldo bancario.",
      amount: null,
      href: "/tesoreria",
      action: "Crear cuenta"
    });
  }
  if (forecast.summary.deficitDate) {
    alerts.push({
      id: "forecast-negative",
      type: "negative_forecast",
      level: "danger",
      date: forecast.summary.deficitDate,
      title: "Saldo previsto negativo",
      detail: `El escenario seleccionado cae por debajo de cero el ${formatShortDate(forecast.summary.deficitDate)}.`,
      amount: forecast.summary.cashNeed,
      href: "/tesoreria",
      action: "Revisar previsión"
    });
  }
  if (forecast.summary.minimumBreachDate && minimumBalance !== null) {
    alerts.push({
      id: "minimum-breach",
      type: "minimum_balance",
      level: "warning",
      date: forecast.summary.minimumBreachDate,
      title: "Saldo por debajo del mínimo",
      detail: `Con los datos registrados, el saldo previsto baja de ${formatCurrency(minimumBalance)} el ${formatShortDate(forecast.summary.minimumBreachDate)}.`,
      amount: forecast.summary.minimumCashNeed,
      href: "/tesoreria",
      action: "Revisar colchón"
    });
  }
  const overdue = invoices.filter((invoice) => invoiceBalance(invoice).pending > 0 && invoice.fechaVencimiento < startOfDay(now));
  for (const invoice of overdue.slice(0, 3)) {
    alerts.push({
      id: `overdue-${invoice.id}`,
      type: "overdue_invoice",
      level: "warning",
      date: invoice.fechaVencimiento,
      title: `Factura vencida ${invoice.numero}`,
      detail: `${invoice.client.nombre} tiene ${formatCurrency(invoiceBalance(invoice).pending)} pendientes.`,
      amount: invoiceBalance(invoice).pending,
      href: `/dinero/${invoice.id}`,
      action: "Revisar factura"
    });
  }
  const weekItems = forecast.items.filter((item) => item.effectiveDate && item.effectiveDate <= addDays(startOfDay(now), 7) && !item.isTransfer);
  const weekNet = sum(weekItems.map((item) => item.signedAmount));
  if (weekNet < 0) {
    alerts.push({
      id: "week-negative",
      type: "weekly_pressure",
      level: "warning",
      date: addDays(startOfDay(now), 7),
      title: "Semana con más pagos que cobros",
      detail: `El flujo previsto de los próximos 7 días es ${formatCurrency(weekNet)}.`,
      amount: Math.abs(weekNet),
      href: "/tesoreria",
      action: "Ver calendario"
    });
  }
  const topDebtClient = clientProfitability[0];
  if (topDebtClient && topDebtClient.pending > 0 && topDebtClient.debtShare > 50) {
    alerts.push({
      id: `debt-concentration-${topDebtClient.clientId}`,
      type: "debt_concentration",
      level: "warning",
      date: null,
      title: "Pendiente concentrado en un cliente",
      detail: `${round(topDebtClient.debtShare)}% del saldo pendiente corresponde a ${topDebtClient.name}.`,
      amount: topDebtClient.pending,
      href: topDebtClient.href,
      action: "Abrir cliente"
    });
  }
  const largeOutflow = forecast.items.filter((item) => item.direction === "outflow" && !item.isTransfer).sort((a, b) => b.amount - a.amount)[0];
  if (largeOutflow && largeOutflow.amount > Math.max(1000, forecast.summary.outflows * 0.35)) {
    alerts.push({
      id: `large-outflow-${largeOutflow.id}`,
      type: "large_payment",
      level: "info",
      date: largeOutflow.effectiveDate,
      title: "Pago elevado próximo",
      detail: `${largeOutflow.title}: ${formatCurrency(largeOutflow.amount)}.`,
      amount: largeOutflow.amount,
      href: largeOutflow.href,
      action: "Ver pago"
    });
  }
  const negativeWork = workProfitability.find((work) => work.cashFlow < 0);
  if (negativeWork) {
    alerts.push({
      id: `work-cash-${negativeWork.workId}`,
      type: "work_cash_negative",
      level: "warning",
      date: null,
      title: "Obra consumiendo caja",
      detail: `${negativeWork.title} tiene flujo de caja de obra ${formatCurrency(negativeWork.cashFlow)}.`,
      amount: Math.abs(negativeWork.cashFlow),
      href: `/obras/${negativeWork.workId}`,
      action: "Abrir obra"
    });
  }
  const unpairedTransfer = movements.find((movement) => ["transfer_in", "transfer_out"].includes(movement.type) && !movement.transferGroupId);
  if (unpairedTransfer) {
    alerts.push({
      id: `transfer-${unpairedTransfer.id}`,
      type: "unpaired_transfer",
      level: "warning",
      date: unpairedTransfer.date,
      title: "Transferencia sin pareja trazable",
      detail: "Las transferencias deben estar agrupadas para no confundirse con ingresos o gastos.",
      amount: unpairedTransfer.amount,
      href: "/tesoreria",
      action: "Revisar movimiento"
    });
  }
  if (registeredBalance !== null && minimumBalance !== null && registeredBalance < minimumBalance) {
    alerts.push({
      id: "current-below-minimum",
      type: "current_minimum",
      level: "danger",
      date: startOfDay(now),
      title: "Saldo actual bajo mínimo",
      detail: `Saldo registrado ${formatCurrency(registeredBalance)} frente a mínimo ${formatCurrency(minimumBalance)}.`,
      amount: minimumBalance - registeredBalance,
      href: "/tesoreria",
      action: "Revisar cuentas"
    });
  }
  return alerts.slice(0, 12);
}

function buildCollectionDelayByClient(invoices: TreasuryInvoice[]) {
  const values = new Map<string, number[]>();
  for (const invoice of invoices) {
    const paidDate = fullPaymentDate(invoice);
    if (!paidDate) continue;
    const delay = daysBetween(startOfDay(invoice.fechaVencimiento), startOfDay(paidDate));
    const current = values.get(invoice.clienteId) ?? [];
    current.push(delay);
    values.set(invoice.clienteId, current);
  }
  return new Map([...values.entries()].map(([clientId, delays]) => [clientId, { count: delays.length, averageDelay: sum(delays) / delays.length }]));
}

function fullPaymentDate(invoice: TreasuryInvoice) {
  const payments = [...invoice.payments].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  let paid = 0;
  for (const payment of payments) {
    paid += safeNumber(payment.importe);
    if (paid >= safeNumber(invoice.total)) return payment.fecha;
  }
  return null;
}

function toMovementRow(movement: Prisma.CashMovementGetPayload<{ include: { account: { select: { id: true; name: true; currency: true } }; client: { select: { id: true; nombre: true } }; work: { select: { id: true; titulo: true } }; invoice: { select: { id: true; numero: true } }; payment: { select: { id: true; importe: true } }; expense: { select: { id: true; concepto: true } } } }>) {
  const signed = signedMovementAmount(movement.type, movement.amount);
  return {
    id: movement.id,
    accountId: movement.accountId,
    accountName: movement.account.name,
    type: movement.type,
    direction: signed >= 0 ? "inflow" as const : "outflow" as const,
    amount: Math.abs(signed),
    signedAmount: signed,
    date: movement.date,
    description: movement.description,
    category: movement.category,
    provider: movement.provider,
    status: movement.status,
    source: movement.source,
    transferGroupId: movement.transferGroupId,
    workId: movement.workId,
    workTitle: movement.work?.titulo ?? null,
    clientId: movement.clientId,
    clientName: movement.client?.nombre ?? null,
    invoiceId: movement.invoiceId,
    expenseId: movement.expenseId,
    href: movement.invoiceId ? `/dinero/${movement.invoiceId}` : movement.workId ? `/obras/${movement.workId}` : "/tesoreria",
    isTransfer: movement.type === "transfer_in" || movement.type === "transfer_out"
  };
}

function matchesForecastFilters(item: TreasuryForecastItem, filters: { accountId: string | null; workId: string | null; clientId: string | null; category: string | null; status: string | null }) {
  if (filters.accountId && item.accountId !== filters.accountId) return false;
  if (filters.workId && item.workId !== filters.workId) return false;
  if (filters.clientId && item.clientId !== filters.clientId) return false;
  if (filters.category && item.sourceLabel !== filters.category) return false;
  if (filters.status && item.status !== filters.status) return false;
  return true;
}

function forecastAssumptions(scenario: TreasuryScenarioId, registeredBalance: number | null, horizon: ReturnType<typeof resolveTreasuryHorizon>) {
  return [
    registeredBalance === null ? "Sin cuentas configuradas: no se calcula saldo final previsto." : "Saldo inicial = saldo registrado de cuentas activas.",
    `${scenarioLabel(scenario)}: ${TREASURY_SCENARIOS.find((item) => item.id === scenario)?.description ?? "Escenario base"}`,
    `Horizonte: ${formatShortDate(horizon.start)} a ${formatShortDate(horizon.end)}.`,
    "Las facturas pendientes se tratan como cobros previstos, no como dinero disponible.",
    "Los gastos sin fecha de pago no se ubican arbitrariamente en el calendario.",
    "No incluye movimientos bancarios externos no registrados en Capataz."
  ];
}

function uniqueExpenses<T extends { id: string }>(expenses: T[]) {
  const seen = new Set<string>();
  return expenses.filter((expense) => {
    if (seen.has(expense.id)) return false;
    seen.add(expense.id);
    return true;
  });
}

function duplicateMovementCount(movements: Array<{ accountId: string; type: string; amount: number; date: Date; description: string }>) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const movement of movements) {
    const key = `${movement.accountId}:${movement.type}:${round(movement.amount, 2)}:${isoDate(movement.date)}:${movement.description.toLowerCase().trim()}`;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function signedMovementAmount(type: string, amount: number) {
  const value = safeNumber(amount);
  if (type === "outflow" || type === "transfer_out") return -Math.abs(value);
  if (type === "adjustment") return value;
  return Math.abs(value);
}

function nextRecurringDate(date: Date, frequency: string) {
  if (frequency === "weekly") return addDays(date, 7);
  if (frequency === "quarterly") return addMonths(date, 3);
  if (frequency === "yearly") return addMonths(date, 12);
  return addMonths(date, 1);
}

function frequencyLabel(frequency: string) {
  const labels: Record<string, string> = {
    weekly: "semanal",
    monthly: "mensual",
    quarterly: "trimestral",
    yearly: "anual",
    custom: "personalizado"
  };
  return labels[frequency] ?? frequency;
}

function scenarioLabel(scenario: TreasuryScenarioId) {
  return TREASURY_SCENARIOS.find((item) => item.id === scenario)?.label ?? "Base";
}

function cleanFilter(value: string | null | undefined) {
  return value && value !== "all" ? value : null;
}

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  const copy = startOfDay(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function timeValue(value: Date | null | undefined) {
  return value ? value.getTime() : Number.MAX_SAFE_INTEGER;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + safeNumber(value), 0);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
}

function toCsv(headers: string[], rows: Array<Array<string | number | null>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
