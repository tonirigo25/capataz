import fs from "node:fs";
import { expect, loadTsModule } from "./ts-test-loader.mjs";

const NOW = new Date(2026, 6, 11, 12, 0, 0);
const JUL = (day) => new Date(2026, 6, day, 12, 0, 0);
const JUN = (day) => new Date(2026, 5, day, 12, 0, 0);

function money(value) {
  return Math.round(value * 100) / 100;
}

function expectApprox(actual, expected, message) {
  expect(Math.abs(actual - expected) < 0.01, message, { actual, expected });
}

const clients = {
  one: { id: "client-1", nombre: "Cliente Uno" },
  two: { id: "client-2", nombre: "Cliente Dos" }
};

const worksLite = {
  one: { id: "work-1", titulo: "Reforma local", client: clients.one },
  two: { id: "work-2", titulo: "Instalacion urgente", client: clients.two }
};

function invoice(overrides = {}) {
  const total = overrides.total ?? 2000;
  return {
    id: "invoice-1",
    numero: "F-1",
    concepto: "Certificacion",
    total,
    importeBase: total,
    iva: 0,
    pagado: overrides.pagado ?? 0,
    pendiente: overrides.pendiente ?? total,
    estado: "emitida",
    fechaEmision: JUL(2),
    fechaVencimiento: JUL(20),
    clienteId: "client-1",
    obraId: "work-1",
    client: clients.one,
    work: { id: "work-1", titulo: "Reforma local" },
    payments: [],
    ...overrides
  };
}

function expense(overrides = {}) {
  const work = overrides.work ?? worksLite.one;
  return {
    id: "expense-1",
    proveedor: "Proveedor Uno",
    concepto: "Materiales",
    categoria: "material",
    importe: 600,
    fecha: JUL(9),
    obraId: work.id,
    clienteId: null,
    paymentStatus: "pending",
    paymentDueDate: JUL(13),
    paidAt: null,
    costBehavior: "fixed",
    work,
    client: null,
    cashMovements: [],
    ...overrides
  };
}

function movement(overrides = {}) {
  const account = overrides.account ?? { id: "account-1", name: "Banco principal", currency: "EUR" };
  return {
    id: "movement-1",
    accountId: account.id,
    account,
    type: "outflow",
    amount: 100,
    date: JUL(15),
    description: "Pago confirmado",
    notes: null,
    category: "operacion",
    provider: "Proveedor Uno",
    status: "confirmed",
    source: "manual",
    transferGroupId: null,
    invoiceId: null,
    paymentId: null,
    expenseId: null,
    clientId: null,
    workId: null,
    client: null,
    work: null,
    invoice: null,
    payment: null,
    expense: null,
    archivedAt: null,
    ...overrides
  };
}

function createFixture() {
  const invoiceOpen = invoice({
    id: "invoice-open",
    numero: "F-OPEN",
    total: 2000,
    pagado: 500,
    pendiente: 1500,
    payments: [{ id: "payment-open", importe: 500, fecha: JUL(4) }]
  });
  const invoicePaid = invoice({
    id: "invoice-paid",
    numero: "F-PAID",
    total: 1200,
    importeBase: 1200,
    iva: 0,
    pagado: 1200,
    pendiente: 0,
    fechaEmision: JUL(1),
    fechaVencimiento: JUL(5),
    payments: [{ id: "payment-paid", importe: 1200, fecha: JUL(6) }]
  });
  const invoiceOverdue = invoice({
    id: "invoice-overdue",
    numero: "F-OLD",
    total: 700,
    importeBase: 700,
    iva: 0,
    pagado: 0,
    pendiente: 700,
    fechaEmision: JUN(10),
    fechaVencimiento: JUL(5),
    payments: []
  });

  const expenses = [
    expense({ id: "expense-due", importe: 600, proveedor: "Proveedor Fijo", concepto: "Alquiler equipo", paymentDueDate: JUL(13), costBehavior: "fixed" }),
    expense({ id: "expense-unscheduled", importe: 300, proveedor: "Proveedor Variable", concepto: "Compra pendiente", paymentDueDate: null, costBehavior: "variable" }),
    expense({ id: "expense-paid", importe: 400, proveedor: "Proveedor Pagado", concepto: "Material pagado", paymentStatus: "paid", paidAt: JUL(3), paymentDueDate: null, costBehavior: "variable", fecha: JUL(3) }),
    expense({ id: "expense-negative-work", importe: 500, proveedor: "Proveedor Obra 2", concepto: "Anticipo subcontrata", paymentStatus: "paid", paidAt: JUL(6), paymentDueDate: null, costBehavior: "fixed", fecha: JUL(6), obraId: "work-2", work: worksLite.two }),
    expense({ id: "expense-history", importe: 900, proveedor: "Proveedor Historico", concepto: "Historico", paymentStatus: "paid", paidAt: JUN(20), paymentDueDate: null, costBehavior: "variable", fecha: JUN(20) })
  ];

  const transferGroup = "transfer-group-1";
  const movements = [
    movement({ id: "movement-past-in", type: "inflow", amount: 500, date: JUL(5), description: "Cobro historico", status: "confirmed" }),
    movement({ id: "movement-pending-out", type: "outflow", amount: 800, date: JUL(12), description: "Pago manual pendiente", status: "pending", workId: "work-1", work: { id: "work-1", titulo: "Reforma local" } }),
    movement({ id: "movement-confirmed-out", type: "outflow", amount: 100, date: JUL(15), description: "Pago confirmado horizonte", status: "confirmed" }),
    movement({ id: "movement-transfer-out", type: "transfer_out", amount: 200, date: JUL(13), description: "Traspaso salida", status: "confirmed", transferGroupId: transferGroup }),
    movement({ id: "movement-transfer-in", type: "transfer_in", amount: 200, date: JUL(13), description: "Traspaso entrada", status: "confirmed", transferGroupId: transferGroup, account: { id: "account-2", name: "Caja", currency: "EUR" }, accountId: "account-2" })
  ];

  const accounts = [
    {
      id: "account-1",
      name: "Banco principal",
      type: "bank",
      currency: "EUR",
      openingBalance: 1000,
      currentManualBalance: null,
      manualBalanceUpdatedAt: null,
      minimumBalance: 500,
      isActive: true,
      archivedAt: null,
      movements: [movements[0]]
    },
    {
      id: "account-2",
      name: "Caja",
      type: "cash",
      currency: "EUR",
      openingBalance: 0,
      currentManualBalance: 300,
      manualBalanceUpdatedAt: JUL(10),
      minimumBalance: 100,
      isActive: true,
      archivedAt: null,
      movements: []
    }
  ];

  const recurringExpenses = [
    {
      id: "recurring-1",
      name: "Alquiler nave",
      provider: "Arrendador",
      amount: 300,
      category: "alquiler",
      frequency: "monthly",
      fixedCost: true,
      nextDueDate: JUL(18),
      workId: null,
      work: null
    }
  ];

  const expectedCashFlows = [
    {
      id: "expected-uncertain",
      type: "expected_inflow",
      amount: 450,
      expectedDate: JUL(14),
      description: "Cobro probable sin factura",
      confidenceSource: "Conversacion comercial",
      probability: 0.4,
      status: "pending",
      source: "manual",
      clientId: "client-1",
      workId: "work-1",
      invoiceId: null,
      expenseId: null,
      recurringExpenseId: null,
      client: clients.one,
      work: { id: "work-1", titulo: "Reforma local" },
      invoice: null,
      expense: null,
      recurringExpense: null
    }
  ];

  const workOneExpenses = expenses.filter((item) => item.obraId === "work-1" && item.id !== "expense-history");
  const workTwoExpenses = expenses.filter((item) => item.obraId === "work-2");
  const works = [
    {
      id: "work-1",
      titulo: "Reforma local",
      clienteId: "client-1",
      estado: "en_curso",
      presupuestoAprobado: 2500,
      costePrevisto: 1200,
      gastoReal: 0,
      archivada: false,
      client: clients.one,
      budgets: [{ id: "budget-1", total: 2500, estado: "aceptado" }],
      invoices: [invoiceOpen, invoiceOverdue],
      payments: [{ id: "payment-open", importe: 500, fecha: JUL(4) }],
      expenses: workOneExpenses,
      cashMovements: [{ id: "paid-cost-1", type: "outflow", amount: 400, status: "confirmed" }]
    },
    {
      id: "work-2",
      titulo: "Instalacion urgente",
      clienteId: "client-2",
      estado: "en_curso",
      presupuestoAprobado: 500,
      costePrevisto: 300,
      gastoReal: 0,
      archivada: false,
      client: clients.two,
      budgets: [{ id: "budget-2", total: 500, estado: "aceptado" }],
      invoices: [],
      payments: [],
      expenses: workTwoExpenses,
      cashMovements: [{ id: "paid-cost-2", type: "outflow", amount: 500, status: "confirmed" }]
    }
  ];

  const clientRows = [
    {
      id: "client-1",
      nombre: "Cliente Uno",
      archivadoAt: null,
      invoices: [invoiceOpen, invoicePaid, invoiceOverdue],
      payments: [{ id: "payment-open", importe: 500, fecha: JUL(4) }, { id: "payment-paid", importe: 1200, fecha: JUL(6) }],
      expenses: [],
      works: [{ id: "work-1", expenses: workOneExpenses }]
    },
    {
      id: "client-2",
      nombre: "Cliente Dos",
      archivadoAt: null,
      invoices: [],
      payments: [],
      expenses: [],
      works: [{ id: "work-2", expenses: workTwoExpenses }]
    }
  ];

  return {
    settings: { minimumCashBalance: 1200, targetCoverageDays: 45 },
    accounts,
    movements,
    invoices: [invoiceOpen, invoicePaid, invoiceOverdue],
    expenses,
    recurringExpenses,
    expectedCashFlows,
    works,
    clients: clientRows
  };
}

function createPrismaMock(data = createFixture()) {
  return {
    treasurySettings: { findFirst: async () => data.settings },
    financialAccount: { findMany: async () => data.accounts },
    cashMovement: { findMany: async () => data.movements },
    invoice: { findMany: async () => data.invoices },
    expense: { findMany: async () => data.expenses },
    recurringExpense: { findMany: async () => data.recurringExpenses },
    expectedCashFlow: { findMany: async () => data.expectedCashFlows },
    work: { findMany: async () => data.works },
    client: { findMany: async () => data.clients }
  };
}

function loadTreasury(data = createFixture()) {
  return loadTsModule("lib/treasury.ts", {
    mocks: { "@/lib/prisma": { prisma: createPrismaMock(data) } }
  });
}

async function getOverview() {
  const { getTreasuryOverview } = loadTreasury();
  return getTreasuryOverview({ horizon: "30d", scenario: "base", now: NOW });
}

async function validateAccounts() {
  const overview = await getOverview();
  expect(overview.hasAccounts, "[treasury-accounts] accounts should be detected");
  expectApprox(overview.registeredBalance, 1800, "[treasury-accounts] registered balance should combine calculated and manual balances");
  expectApprox(overview.effectiveMinimumBalance, 1200, "[treasury-accounts] treasury setting should override account minimum aggregate");
  expect(overview.accounts.find((account) => account.id === "account-1")?.balanceMode === "calculated", "[treasury-accounts] calculated account mode missing", overview.accounts);
  expect(overview.accounts.find((account) => account.id === "account-2")?.balanceMode === "manual", "[treasury-accounts] manual account mode missing", overview.accounts);

  const noAccountFixture = createFixture();
  noAccountFixture.accounts = [];
  const { getTreasuryOverview } = loadTreasury(noAccountFixture);
  const empty = await getTreasuryOverview({ horizon: "30d", scenario: "base", now: NOW });
  expect(empty.registeredBalance === null && !empty.hasAccounts, "[treasury-accounts] no-account state should not invent balance", empty);
  expect(empty.qualityIssues.some((issue) => issue.id === "no-accounts"), "[treasury-accounts] no-account quality issue missing", empty.qualityIssues);
}

async function validateMovements() {
  const overview = await getOverview();
  expect(overview.movements.some((item) => item.isTransfer), "[cash-movements] transfers should be identifiable");
  expectApprox(overview.movementSummary.outflows, 100, "[cash-movements] transfer and pending movements must be excluded from confirmed business outflows");
  expectApprox(overview.movementSummary.net, -100, "[cash-movements] confirmed business movement net mismatch");
  expect(overview.forecast.items.some((item) => item.id === "movement:movement-pending-out" && item.certainty === "expected"), "[cash-movements] pending movement should enter forecast as expected");
}

async function validateForecast() {
  const overview = await getOverview();
  expectApprox(overview.forecast.summary.initialBalance, 1800, "[cashflow-forecast] initial balance mismatch");
  expectApprox(overview.forecast.summary.inflows, 2200, "[cashflow-forecast] base inflows should include due invoices only");
  expectApprox(overview.forecast.summary.outflows, 1800, "[cashflow-forecast] base outflows should include dated payables, recurring expenses and explicit movements");
  expectApprox(overview.forecast.summary.finalBalance, 2200, "[cashflow-forecast] final balance mismatch");
  expect(overview.forecast.summary.minimumBreachDate?.getFullYear() === 2026 && overview.forecast.summary.minimumBreachDate?.getMonth() === 6 && overview.forecast.summary.minimumBreachDate?.getDate() === 13, "[cashflow-forecast] minimum breach date should be deterministic", overview.forecast.summary);
  expect(overview.payablesSummary.unscheduledTotal === 300, "[cashflow-forecast] expenses without due date must remain unscheduled", overview.payablesSummary);
}

async function validateScenarios() {
  const overview = await getOverview();
  const conservative = overview.scenarioComparison.find((item) => item.scenario === "conservative");
  const base = overview.scenarioComparison.find((item) => item.scenario === "base");
  const optimistic = overview.scenarioComparison.find((item) => item.scenario === "optimistic");
  expect(conservative && base && optimistic, "[cashflow-scenarios] scenario comparison missing", overview.scenarioComparison);
  expectApprox(conservative.finalBalance, 0, "[cashflow-scenarios] conservative final balance should exclude expected inflows");
  expectApprox(base.finalBalance, 2200, "[cashflow-scenarios] base final balance mismatch");
  expectApprox(optimistic.finalBalance, 2650, "[cashflow-scenarios] optimistic final balance should include uncertain inflows");
  expect(optimistic.finalBalance > base.finalBalance && base.finalBalance > conservative.finalBalance, "[cashflow-scenarios] scenario ordering is wrong", overview.scenarioComparison);
}

async function validateRecurringExpenses() {
  const overview = await getOverview();
  const recurring = overview.payables.find((item) => item.id.startsWith("recurring:recurring-1"));
  expect(recurring, "[recurring-expenses] recurring forecast item missing", overview.payables);
  expect(recurring.amount === 300 && recurring.certainty === "expected", "[recurring-expenses] recurring amount or certainty mismatch", recurring);
  expect(overview.breakEven.fixedCosts === 1400, "[recurring-expenses] fixed recurring expense should feed break-even", overview.breakEven);
}

async function validateWorkProfitability() {
  const overview = await getOverview();
  const workOne = overview.workProfitability.find((work) => work.workId === "work-1");
  const workTwo = overview.workProfitability.find((work) => work.workId === "work-2");
  expect(workOne && workTwo, "[work-profitability-advanced] fixture works missing", overview.workProfitability);
  expectApprox(workOne.profitOnInvoiced, 1400, "[work-profitability-advanced] work profit on invoiced mismatch");
  expectApprox(workOne.cashFlow, 100, "[work-profitability-advanced] work cashflow mismatch");
  expectApprox(workTwo.cashNeed, 500, "[work-profitability-advanced] negative-cash work should expose cash need");
  expect(overview.alerts.some((alert) => alert.type === "work_cash_negative"), "[work-profitability-advanced] negative work cash alert missing", overview.alerts);
}

async function validateClientProfitability() {
  const overview = await getOverview();
  const client = overview.clientProfitability.find((item) => item.clientId === "client-1");
  expect(client, "[client-profitability] client row missing", overview.clientProfitability);
  expectApprox(client.invoiced, 3900, "[client-profitability] invoiced total mismatch");
  expectApprox(client.pending, 2200, "[client-profitability] pending total mismatch");
  expectApprox(client.expenses, 1300, "[client-profitability] client expenses should include work expenses once");
  expectApprox(client.debtShare, 100, "[client-profitability] debt concentration mismatch");
  expect(overview.concentration.topDebtClient?.clientId === "client-1", "[client-profitability] top debt client mismatch", overview.concentration);
}

async function validateBreakEven() {
  const overview = await getOverview();
  expect(overview.breakEven.canCalculate, "[break-even] break-even should be calculable with classified costs", overview.breakEven);
  expectApprox(overview.breakEven.fixedCosts, 1400, "[break-even] fixed costs mismatch");
  expectApprox(overview.breakEven.variableCosts, 700, "[break-even] variable costs mismatch");
  expectApprox(overview.breakEven.contributionMarginPercent, 78.125, "[break-even] contribution margin mismatch");
  expectApprox(overview.breakEven.breakEvenRevenue, 1792, "[break-even] break-even revenue mismatch");
}

async function validateCoverage() {
  const overview = await getOverview();
  expect(overview.coverage.canCalculate, "[coverage] coverage should be calculable", overview.coverage);
  expectApprox(overview.coverage.monthlyExpenseAverage, 900, "[coverage] 90-day monthly expense average mismatch");
  expectApprox(overview.coverage.daysWithBalance, 60, "[coverage] days with balance mismatch");
  expect(overview.coverage.targetCoverageDays === 45, "[coverage] target coverage setting mismatch", overview.coverage);
}

async function validateChat() {
  const { classifyChatIntent } = loadTsModule("lib/capataz-chat-query.ts");
  const cases = [
    ["como esta mi caja", "treasury_status"],
    ["cuanto dinero tengo disponible", "treasury_available_cash"],
    ["cuanto voy a cobrar esta semana", "treasury_collect_week"],
    ["cuanto tengo que pagar este mes", "treasury_pay_month"],
    ["como estara mi caja dentro de 30 dias", "treasury_forecast"],
    ["cuando me quedare por debajo del minimo", "treasury_minimum_breach"],
    ["que facturas vencen esta semana", "treasury_due_invoices"],
    ["que pagos tengo proximos", "treasury_upcoming_payments"],
    ["flujo de caja", "treasury_cashflow_month"],
    ["que obra consume mas caja", "treasury_work_cash_consumption"],
    ["punto de equilibrio", "treasury_break_even"],
    ["cobertura de caja", "treasury_coverage"],
    ["haz escenario conservador", "treasury_scenario_conservative"],
    ["compara base y conservador", "treasury_scenario_compare"],
    ["que deberia revisar en tesoreria", "treasury_review"]
  ];
  for (const [text, action] of cases) {
    const result = classifyChatIntent(text);
    expect(result.action === action, `[treasury-chat] bad classification for "${text}"`, { expected: action, result });
    expect(["aggregate_query", "comparison_query", "database_query"].includes(result.kind), `[treasury-chat] read-only query kind expected for "${text}"`, result);
  }

  const actionsSource = fs.readFileSync("app/(app)/capataz/actions.ts", "utf8");
  for (const [, action] of cases) {
    expect(actionsSource.includes(`case "${action}"`), `[treasury-chat] missing action handler for ${action}`);
  }
  expect(actionsSource.includes("getTreasuryOverview"), "[treasury-chat] chat actions must use central treasury overview");
  expect(actionsSource.includes("noMutation: true"), "[treasury-chat] treasury chat answers must preserve no-mutation diagnostics");
}

async function validateIntegration() {
  const treasuryPage = fs.readFileSync("app/(app)/tesoreria/page.tsx", "utf8");
  const treasuryActions = fs.readFileSync("app/(app)/tesoreria/actions.ts", "utf8");
  const hoyPage = fs.readFileSync("app/(app)/hoy/page.tsx", "utf8");
  const workPage = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
  const clientPage = fs.readFileSync("app/(app)/clientes/[id]/page.tsx", "utf8");
  const nav = fs.readFileSync("components/app-chrome.tsx", "utf8");
  const bottomNav = fs.readFileSync("components/bottom-nav.tsx", "utf8");
  const migration = fs.readFileSync("prisma/migrations/20260711200000_treasury_cashflow_profitability/migration.sql", "utf8");
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

  for (const needle of ["FinancialAccount", "CashMovement", "RecurringExpense", "ExpectedCashFlow", "TreasurySettings"]) {
    expect(schema.includes(`model ${needle}`), `[treasury-integration] schema missing model ${needle}`);
    expect(migration.includes(needle), `[treasury-integration] migration missing ${needle}`);
  }
  for (const needle of ["paymentStatus", "paymentDueDate", "paidAt", "costBehavior"]) {
    expect(schema.includes(needle), `[treasury-integration] Expense missing field ${needle}`);
  }
  expect(treasuryPage.includes("getTreasuryOverview") && treasuryPage.includes("QuickForms"), "[treasury-integration] treasury page missing overview or forms");
  expect(treasuryActions.includes("createCashTransfer") && treasuryActions.includes("saveTreasurySettings"), "[treasury-integration] treasury actions missing key commands");
  expect(fs.existsSync("app/(app)/tesoreria/export/route.ts"), "[treasury-integration] treasury CSV export route missing");
  expect(hoyPage.includes("getTodayTreasurySignals"), "[treasury-integration] Hoy page missing treasury signals");
  expect(workPage.includes("WorkTreasuryTab") && workPage.includes("getTreasuryOverview"), "[treasury-integration] Work 360 missing treasury tab");
  expect(clientPage.includes("ClientFinanceTab") && clientPage.includes("getTreasuryOverview"), "[treasury-integration] Client 360 missing finance tab");
  expect(nav.includes('href: "/tesoreria"') && bottomNav.includes('href: "/tesoreria"'), "[treasury-integration] navigation missing treasury links");

  await validateAccounts();
  await validateMovements();
  await validateForecast();
  await validateScenarios();
  await validateRecurringExpenses();
  await validateWorkProfitability();
  await validateClientProfitability();
  await validateBreakEven();
  await validateCoverage();
  await validateChat();
}

const validators = {
  accounts: validateAccounts,
  movements: validateMovements,
  forecast: validateForecast,
  scenarios: validateScenarios,
  recurring: validateRecurringExpenses,
  "work-profitability": validateWorkProfitability,
  "client-profitability": validateClientProfitability,
  "break-even": validateBreakEven,
  coverage: validateCoverage,
  chat: validateChat,
  integration: validateIntegration
};

const mode = process.argv[2] ?? "integration";
const validator = validators[mode];
expect(Boolean(validator), `[treasury-suite] unknown mode ${mode}`);
await validator();
console.log(`[treasury-suite] OK ${mode}`);
