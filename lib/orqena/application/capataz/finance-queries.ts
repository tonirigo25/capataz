import { type ChatIntentClassification } from "@/lib/capataz-chat-query";
import { metricDefinitionText } from "@/lib/business-intelligence";
import { prisma } from "@/lib/prisma";
import { getTreasuryOverview } from "@/lib/treasury";
import { requireCompanyContext } from "@/lib/auth/session";
import { businessPanelHref, businessSummary, roundForChat } from "@/lib/orqena/application/capataz/intelligence-queries";
import { ChatCommandContext, ChatCommandResult } from "@/lib/orqena/application/capataz/orchestration";
import { budgetPeriodWhere, budgetQueryCard, clientForQuery, compactListResult, findOpenInvoiceBalances, formatDateShort, invoicePeriodWhere, invoiceQueryCard, noClientResult } from "@/lib/orqena/application/capataz/record-queries";
import { formatEuros, latestDocumentContext } from "@/lib/orqena/application/capataz/shared-helpers";
import { withLastQuery } from "@/lib/orqena/application/capataz/workflow-queries";

export async function queryBudgetByExactAmount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (typeof intent.amount !== "number" || !Number.isFinite(intent.amount)) {
    return { handled: true, diagnostics: { resultCount: 0 }, text: "Dime el importe del presupuesto que quieres consultar. No he creado ni modificado nada." };
  }
  const budgets = await prisma.budget.findMany({
    where: { companyId, ...budgetPeriodWhere(intent.period), total: { gte: intent.amount - 0.01, lte: intent.amount + 0.01 } },
    orderBy: { fechaCreacion: "desc" },
    take: 5,
    include: { client: true, work: true }
  });
  if (!budgets.length) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      text: `No encuentro ningún presupuesto por ${formatEuros(intent.amount)}. No he creado ni modificado ningún presupuesto.`
    };
  }
  if (budgets.length === 1) {
    const budget = budgets[0];
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
      result: budgetQueryCard("Presupuesto encontrado", budget),
      text: `He encontrado el presupuesto ${budget.numero}, por ${formatEuros(budget.total)}, para ${budget.client.nombre}.`
    };
  }
  return compactListResult(budgets, `presupuestos por ${formatEuros(intent.amount)}`, (budget) => `${budget.numero} · ${budget.client.nombre} · ${budget.estado} · /presupuestos/${budget.id}`, {
    resultCount: budgets.length
  });
}

export async function queryLatestBudget(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const budget = await prisma.budget.findFirst({
    where: { companyId, ...budgetPeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true }
  });
  if (!budget) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay presupuestos registrados todavía." };
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    result: budgetQueryCard("Último presupuesto", budget),
    text: `El último presupuesto es el ${budget.numero}, de ${formatEuros(budget.total)}, para ${budget.client.nombre}.`
  };
}

export async function queryInvoiceByAmount(direction: "asc" | "desc", intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const invoice = await prisma.invoice.findFirst({
    where: { companyId, ...invoicePeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { total: direction },
    include: { client: true, work: true }
  });
  if (!invoice) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay facturas registradas todavía." };
  const label = direction === "desc" ? "más grande" : "más baja";
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    result: invoiceQueryCard(`Factura ${label}`, invoice),
    text: `La factura ${label} es la ${invoice.numero}, por ${formatEuros(invoice.total)}, para ${invoice.client.nombre}.`
  };
}

async function queryOutstandingInvoices(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const balances = (await findOpenInvoiceBalances({ ...invoicePeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) }))
    .sort((a, b) => b.pending - a.pending);
  const total = balances.reduce((sum, item) => sum + item.pending, 0);
  if (!balances.length) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay facturas pendientes de cobro." };
  const top = balances.slice(0, 5);
  return {
    handled: true,
    diagnostics: { resultCount: balances.length },
    text: `Tienes ${balances.length} facturas pendientes de cobro por ${formatEuros(total)} en total.\n\nLas 5 mayores son:\n${top.map(({ invoice, pending }, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(pending)} · /dinero/${invoice.id}`).join("\n")}`
  };
}

export async function queryPendingInvoicesCount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const count = (await findOpenInvoiceBalances(invoicePeriodWhere(intent.period))).length;
  return { handled: true, diagnostics: { resultCount: count }, text: count ? `Tienes ${count} facturas pendientes de cobro.` : "No hay facturas pendientes de cobro." };
}

export async function queryPendingBudgetsCount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const count = await prisma.budget.count({ where: { companyId, estado: { in: ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] }, ...budgetPeriodWhere(intent.period) } });
  return { handled: true, diagnostics: { resultCount: count }, text: count ? `Tienes ${count} presupuestos pendientes.` : "No hay presupuestos pendientes." };
}

async function queryClientHighestDebt(context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const balances = await findOpenInvoiceBalances();
  const totals = new Map<string, { name: string; total: number; clientId: string }>();
  for (const { invoice, pending } of balances) {
    const current = totals.get(invoice.clienteId) ?? { name: invoice.client.nombre, total: 0, clientId: invoice.clienteId };
    current.total += pending;
    totals.set(invoice.clienteId, current);
  }
  const top = [...totals.values()].sort((a, b) => b.total - a.total)[0];
  if (!top) return { handled: true, context, diagnostics: { resultCount: 0 }, text: "No hay clientes con deuda pendiente." };
  return {
    handled: true,
    context: withLastQuery(context, {
      type: "client_highest_debt",
      filters: {},
      resultIds: [top.clientId],
      handler: "queryClientHighestDebt",
      timestamp: new Date().toISOString()
    }),
    diagnostics: { resultCount: totals.size },
    result: {
      type: "found",
      entityType: "client",
      entityId: top.clientId,
      title: "Cliente con más pendiente",
      summary: { cliente: top.name, pendiente: top.total },
      actions: [{ label: "Ver cliente", href: `/clientes/${top.clientId}`, style: "primary" }, { label: "Ver facturas", href: "/dinero?filtro=pendientes" }]
    },
    text: `El cliente que más debe ahora mismo es ${top.name}, con ${formatEuros(top.total)} pendiente.`
  };
}

// Retained for deterministic query compatibility.
void queryOutstandingInvoices;
void queryClientHighestDebt;

export async function queryTreasuryStatus(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: "Estado de tesorería",
    text: `${treasuryIntro(summary)}

- Saldo registrado: ${summary.registeredBalance === null ? "sin cuentas configuradas" : formatEuros(summary.registeredBalance)}
- Cobros previstos: ${formatEuros(forecast.inflows)} (${formatEuros(forecast.confirmedInflows)} confirmados)
- Pagos previstos: ${formatEuros(forecast.outflows)}
- Flujo neto previsto: ${formatEuros(forecast.net)}
- Saldo final previsto: ${forecast.finalBalance === null ? "sin saldo calculable" : formatEuros(forecast.finalBalance)}
- Punto mínimo: ${forecast.minBalance === null ? "sin saldo calculable" : `${formatEuros(forecast.minBalance)}${forecast.minBalanceDate ? ` el ${formatDateShort(forecast.minBalanceDate)}` : ""}`}

No incluye movimientos bancarios no registrados.`,
    summary: { saldo: summary.registeredBalance, cobros_previstos: forecast.inflows, pagos_previstos: forecast.outflows, saldo_final: forecast.finalBalance },
    resultCount: summary.forecast.items.length
  });
}

export async function queryTreasuryAvailableCash(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  if (!summary.hasAccounts) {
    return treasuryResult({
      title: "Saldo no disponible",
      text: "No hay cuentas o cajas configuradas. Añade tu saldo actual para completar la previsión de tesorería.",
      summary: { cuentas: 0 },
      resultCount: 0
    });
  }
  return treasuryResult({
    title: "Dinero disponible registrado",
    text: `Saldo de tesorería registrado: ${formatEuros(summary.registeredBalance ?? 0)}.

Este saldo sale de ${summary.accounts.length} cuentas/cajas activas. Si una cuenta tiene saldo manual, se usa ese saldo; si no, se usa saldo inicial más movimientos confirmados.

La previsión utiliza únicamente los saldos y movimientos que has registrado.`,
    summary: { saldo_registrado: summary.registeredBalance, cuentas: summary.accounts.length },
    resultCount: summary.accounts.length
  });
}

export async function queryTreasuryCollections(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, intent.period === "this_month" ? "month_end" : "7d");
  const collections = summary.receivables.filter((item) => item.effectiveDate).slice(0, 6);
  const total = summary.forecast.items.filter((item) => item.direction === "inflow" && !item.isTransfer).reduce((sum, item) => sum + item.amount, 0);
  return treasuryResult({
    title: "Cobros previstos",
    text: `${treasuryIntro(summary)}

Cobros previstos en el horizonte: ${formatEuros(total)}.

${collections.length ? collections.map((item, index) => `${index + 1}. ${formatDateShort(item.effectiveDate ?? item.date ?? new Date())} · ${item.clientName ?? "Cliente"} · ${item.title} · ${formatEuros(item.amount)}`).join("\n") : "No hay cobros previstos con fecha dentro del horizonte."}

Las facturas pendientes son previsiones de cobro, no dinero disponible.`,
    summary: { cobros_previstos: total },
    resultCount: collections.length
  });
}

export async function queryTreasuryPayments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, intent.period === "this_week" ? "7d" : "month_end");
  const payments = summary.payables.filter((item) => item.effectiveDate).slice(0, 6);
  const total = summary.forecast.items.filter((item) => item.direction === "outflow" && !item.isTransfer).reduce((sum, item) => sum + item.amount, 0);
  return treasuryResult({
    title: "Pagos previstos",
    text: `${treasuryIntro(summary)}

Pagos previstos en el horizonte: ${formatEuros(total)}.

${payments.length ? payments.map((item, index) => `${index + 1}. ${formatDateShort(item.effectiveDate ?? item.date ?? new Date())} · ${item.title} · ${formatEuros(item.amount)}`).join("\n") : "No hay pagos previstos con fecha dentro del horizonte."}

Los gastos pendientes sin fecha se muestran como sin fecha prevista y no se colocan artificialmente en el calendario.`,
    summary: { pagos_previstos: total, sin_fecha: summary.payablesSummary.unscheduledTotal },
    resultCount: payments.length
  });
}

export async function queryTreasuryForecast(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "30d");
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: "Forecast a 30 días",
    text: `${treasuryIntro(summary)}

- Saldo inicial: ${forecast.initialBalance === null ? "sin cuentas configuradas" : formatEuros(forecast.initialBalance)}
- Cobros previstos: ${formatEuros(forecast.inflows)}
- Pagos previstos: ${formatEuros(forecast.outflows)}
- Saldo final previsto: ${forecast.finalBalance === null ? "sin saldo calculable" : formatEuros(forecast.finalBalance)}
- Punto mínimo: ${forecast.minBalance === null ? "sin saldo calculable" : `${formatEuros(forecast.minBalance)}${forecast.minBalanceDate ? ` el ${formatDateShort(forecast.minBalanceDate)}` : ""}`}

Supuestos: facturas pendientes por vencimiento, gastos pendientes con fecha, recurrentes activos y previsiones manuales. No incluye bancos no conectados ni movimientos externos no registrados.`,
    summary: { saldo_final: forecast.finalBalance, punto_minimo: forecast.minBalance, necesidad_caja: forecast.cashNeed },
    resultCount: summary.forecast.items.length
  });
}

export async function queryTreasuryMinimumBreach(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const date = summary.forecast.summary.minimumBreachDate;
  const text = date
    ? `Con los datos registrados, el saldo previsto cae por debajo del mínimo el ${formatDateShort(date)}. Necesidad estimada frente al mínimo: ${formatEuros(summary.forecast.summary.minimumCashNeed)}.`
    : summary.effectiveMinimumBalance === null
      ? "No hay saldo mínimo configurado. Puedes definir saldo mínimo, colchón y días de cobertura en /tesoreria."
      : "No se detecta incumplimiento del saldo mínimo dentro del horizonte seleccionado.";
  return treasuryResult({
    title: "Saldo mínimo",
    text: `${treasuryIntro(summary)}

${text}`,
    summary: { saldo_minimo: summary.effectiveMinimumBalance, fecha_incumplimiento: date ? formatDateShort(date) : null },
    resultCount: date ? 1 : 0
  });
}

export async function queryTreasuryDueInvoices(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "7d");
  const due = summary.receivables.filter((item) => item.effectiveDate).slice(0, 8);
  return treasuryResult({
    title: "Facturas que vencen",
    text: `${treasuryIntro(summary)}

${due.length ? due.map((item, index) => `${index + 1}. ${formatDateShort(item.effectiveDate ?? item.date ?? new Date())} · ${item.clientName ?? "Cliente"} · ${item.title} · ${formatEuros(item.amount)}`).join("\n") : "No hay facturas pendientes con vencimiento dentro del horizonte."}`,
    summary: { facturas: due.length, importe: due.reduce((sum, item) => sum + item.amount, 0) },
    resultCount: due.length
  });
}

export async function queryTreasuryCashflow(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "month_end");
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: "Flujo de caja",
    text: `${treasuryIntro(summary)}

Flujo de caja previsto = cobros menos pagos.

- Cobros: ${formatEuros(forecast.inflows)}
- Pagos: ${formatEuros(forecast.outflows)}
- Flujo neto: ${formatEuros(forecast.net)}

Las transferencias entre cuentas no cuentan como ingresos o gastos del negocio.`,
    summary: { cobros: forecast.inflows, pagos: forecast.outflows, flujo_neto: forecast.net },
    resultCount: summary.forecast.items.length
  });
}

export async function queryTreasuryWorkCashConsumption(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const work = [...summary.workProfitability].sort((a, b) => a.cashFlow - b.cashFlow)[0];
  if (!work || work.cashFlow >= 0) {
    return treasuryResult({
      title: "Caja por obra",
      text: "No hay obras con flujo de caja negativo calculado con los datos registrados.",
      summary: { obras_negativas: 0 },
      resultCount: 0
    });
  }
  return treasuryResult({
    title: "Obra que consume más caja",
    text: `${work.title}, de ${work.clientName}, tiene el flujo de caja de obra más bajo: ${formatEuros(work.cashFlow)}.

Entradas cobradas: ${formatEuros(work.collected)}.
Salidas pagadas/costes pagados: ${formatEuros(work.paidCost)}.
Necesidad de caja de la obra: ${formatEuros(work.cashNeed)}.

El presupuesto no se considera entrada de caja.`,
    summary: { obra: work.title, flujo_caja: work.cashFlow, necesidad_caja: work.cashNeed },
    resultCount: 1,
    href: `/obras/${work.workId}`
  });
}

export async function queryTreasuryBreakEven(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "month_end");
  const breakEven = summary.breakEven;
  const text = breakEven.canCalculate
    ? `Punto de equilibrio estimado: ${formatEuros(breakEven.breakEvenRevenue ?? 0)} de facturación.

Costes fijos: ${formatEuros(breakEven.fixedCosts)}.
Costes variables: ${formatEuros(breakEven.variableCosts)}.
Margen de contribución: ${roundForChat(breakEven.contributionMarginPercent)}%.

${breakEven.explanation}`
    : breakEven.explanation;
  return treasuryResult({
    title: "Punto de equilibrio",
    text,
    summary: { puede_calcular: breakEven.canCalculate, facturacion_necesaria: breakEven.breakEvenRevenue },
    resultCount: breakEven.canCalculate ? 1 : 0
  });
}

export async function queryTreasuryCoverage(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const coverage = summary.coverage;
  const text = coverage.canCalculate
    ? `Cobertura con saldo: ${roundForChat(coverage.daysWithBalance)} días.
Cobertura incluyendo cobros confirmados próximos: ${roundForChat(coverage.daysWithConfirmedInflows)} días.
Gasto medio mensual usado: ${formatEuros(coverage.monthlyExpenseAverage)}.

${coverage.explanation}`
    : coverage.explanation;
  return treasuryResult({
    title: "Cobertura de gastos",
    text,
    summary: { cobertura_dias: coverage.daysWithBalance, cobertura_con_cobros_confirmados: coverage.daysWithConfirmedInflows },
    resultCount: coverage.canCalculate ? 1 : 0
  });
}

export async function queryTreasuryScenario(intent: ChatIntentClassification, scenario: "conservative" | "base" | "optimistic"): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "30d", scenario);
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: `Escenario ${scenario === "conservative" ? "conservador" : scenario}`,
    text: `${treasuryIntro(summary)}

- Cobros incluidos: ${formatEuros(forecast.inflows)}
- Pagos incluidos: ${formatEuros(forecast.outflows)}
- Flujo neto: ${formatEuros(forecast.net)}
- Saldo final: ${forecast.finalBalance === null ? "sin saldo calculable" : formatEuros(forecast.finalBalance)}

Este escenario no modifica datos reales.`,
    summary: { escenario: scenario, saldo_final: forecast.finalBalance, flujo_neto: forecast.net },
    resultCount: summary.forecast.items.length
  });
}

export async function queryTreasuryScenarioCompare(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "30d");
  return treasuryResult({
    title: "Comparativa de escenarios",
    text: `Comparativa a ${summary.horizon.label}:

${summary.scenarioComparison.map((item) => `- ${item.label}: flujo ${formatEuros(item.net)}, saldo final ${item.finalBalance === null ? "sin saldo" : formatEuros(item.finalBalance)}${item.deficitDate ? `, déficit ${formatDateShort(item.deficitDate)}` : ""}`).join("\n")}

Los escenarios son simulaciones y no modifican tus datos.`,
    summary: {
      conservador: summary.scenarioComparison.find((item) => item.scenario === "conservative")?.finalBalance,
      base: summary.scenarioComparison.find((item) => item.scenario === "base")?.finalBalance,
      optimista: summary.scenarioComparison.find((item) => item.scenario === "optimistic")?.finalBalance
    },
    resultCount: summary.scenarioComparison.length
  });
}

export async function queryTreasuryReview(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const alerts = summary.alerts.slice(0, 5);
  const issues = summary.qualityIssues.filter((issue) => issue.count > 0).slice(0, 4);
  return treasuryResult({
    title: "Revisión de tesorería",
    text: `${treasuryIntro(summary)}

Alertas:
${alerts.length ? alerts.map((alert, index) => `${index + 1}. ${alert.title}: ${alert.detail}`).join("\n") : "No hay alertas relevantes."}

Calidad de datos:
${issues.length ? issues.map((issue, index) => `${index + 1}. ${issue.title}: ${issue.count}`).join("\n") : "No hay incidencias principales de calidad de datos."}`,
    summary: { alertas: alerts.length, incidencias_datos: issues.reduce((total, issue) => total + issue.count, 0) },
    resultCount: alerts.length + issues.length
  });
}

async function treasurySummaryForIntent(intent: ChatIntentClassification, horizon?: string, scenario: "conservative" | "base" | "optimistic" = "base") {
  const { companyId } = await requireCompanyContext();
  return getTreasuryOverview({
    companyId,
    horizon: horizon ?? treasuryHorizonForPeriod(intent.period),
    scenario
  });
}

function treasuryHorizonForPeriod(period: ChatIntentClassification["period"]) {
  if (period === "this_week") return "7d";
  if (period === "this_month") return "month_end";
  return "30d";
}

function treasuryIntro(summary: Awaited<ReturnType<typeof getTreasuryOverview>>) {
  return `Con el escenario ${summary.scenarioOptions.find((item) => item.id === summary.scenario)?.label ?? "Base"} y datos registrados a ${formatDateShort(summary.updatedAt)} (${summary.horizon.label}):`;
}

function treasuryResult({
  title,
  text,
  summary,
  resultCount,
  href = "/tesoreria"
}: {
  title: string;
  text: string;
  summary: Record<string, string | number | boolean | null | undefined>;
  resultCount: number;
  href?: string;
}): ChatCommandResult {
  return {
    handled: true,
    diagnostics: { resultCount },
    result: {
      type: "found",
      entityType: "business",
      title,
      summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, value ?? null])),
      actions: [{ label: "Abrir tesorería", href, style: "primary" }]
    },
    text
  };
}

export async function queryBusinessHealth(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const attention = summary.alerts.slice(0, 3);
  return {
    handled: true,
    diagnostics: { resultCount: attention.length },
    result: {
      type: "found",
      entityType: "business",
      title: "Salud del negocio",
      summary: {
        periodo: summary.period.label,
        facturado: summary.money.invoiced,
        cobrado: summary.money.collected,
        pendiente: summary.money.outstanding,
        vencido: summary.money.overdue,
        gastos: summary.money.expenses,
        salud: summary.health.score
      },
      actions: [{ label: "Abrir inteligencia", href: businessPanelHref(summary.period.id), style: "primary" }]
    },
    text: [
      summary.summaryText,
      summary.health.canCalculate ? `Índice de salud: ${summary.health.score}/100 (${summary.health.label}).` : "No hay datos suficientes para calcular el índice de salud.",
      attention.length ? `Conviene revisar:\n${attention.map((alert, index) => `${index + 1}. ${alert.title}: ${alert.detail} · ${alert.href}`).join("\n")}` : "No hay alertas relevantes ahora mismo.",
      `Definición: ${metricDefinitionText("invoiced")}`
    ].join("\n\n")
  };
}
