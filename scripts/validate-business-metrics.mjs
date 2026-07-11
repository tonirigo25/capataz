import { expect, loadTsModule } from "./ts-test-loader.mjs";

const {
  calculateExpenseMetrics,
  calculateInvoiceMetrics,
  calculateProfitMetrics,
  calculateQuoteMetrics,
  calculateWorkProfitability,
  compareMetric,
  invoiceBalance,
  isBillableInvoiceStatus,
  metricDefinitionText,
  percentOf
} = loadTsModule("lib/business-metrics.ts");

const now = new Date(2026, 6, 11, 12, 0, 0);

expect(!isBillableInvoiceStatus("borrador"), "[business-metrics] borrador must be excluded");
expect(!isBillableInvoiceStatus("pendiente_emitir"), "[business-metrics] pendiente_emitir must be excluded");
expect(isBillableInvoiceStatus("emitida"), "[business-metrics] emitida must be billable");

const invoice = {
  id: "invoice-1",
  total: 1000,
  pagado: 9999,
  pendiente: 0,
  estado: "emitida",
  fechaEmision: new Date(2026, 6, 1),
  fechaVencimiento: new Date(2026, 6, 5),
  payments: [
    { id: "payment-1", importe: 300, fecha: new Date(2026, 6, 2) },
    { id: "payment-2", importe: 200, fecha: new Date(2026, 6, 3) }
  ]
};

const balance = invoiceBalance(invoice);
expect(balance.paid === 500, "[business-metrics] payments must override denormalized pagado", balance);
expect(balance.pending === 500, "[business-metrics] pending must be total minus payments", balance);

const overpaid = invoiceBalance({ ...invoice, total: 400 });
expect(overpaid.pending === 0 && overpaid.overpaid === 100, "[business-metrics] overpaid invoices must clamp pending to zero", overpaid);

const invoiceMetrics = calculateInvoiceMetrics([
  invoice,
  { ...invoice, id: "invoice-2", total: 2000, estado: "pagada", fechaVencimiento: new Date(2026, 6, 20), payments: [{ id: "payment-3", importe: 2000, fecha: new Date(2026, 6, 6) }] },
  { ...invoice, id: "invoice-draft", total: 5000, estado: "borrador", payments: [] },
  { ...invoice, id: "invoice-pending-issue", total: 7000, estado: "pendiente_emitir", payments: [] }
], now);
expect(invoiceMetrics.count === 2, "[business-metrics] invoice count must exclude non-billable statuses", invoiceMetrics);
expect(invoiceMetrics.total === 3000, "[business-metrics] invoice total must exclude non-billable statuses", invoiceMetrics);
expect(invoiceMetrics.pending === 500, "[business-metrics] pending total is wrong", invoiceMetrics);
expect(invoiceMetrics.overdue === 500 && invoiceMetrics.overdueCount === 1, "[business-metrics] overdue balance is wrong", invoiceMetrics);
expect(invoiceMetrics.partialCount === 1 && invoiceMetrics.paidCount === 1, "[business-metrics] paid and partial counts are wrong", invoiceMetrics);

const expenses = calculateExpenseMetrics([
  { importe: 300, categoria: "material" },
  { importe: 200, categoria: "material" },
  { importe: 150, categoria: "subcontrata" }
]);
expect(expenses.total === 650, "[business-metrics] expense total is wrong", expenses);
expect(expenses.byCategory.material === 500, "[business-metrics] expense category total is wrong", expenses);

const quotes = calculateQuoteMetrics([
  { total: 1000, estado: "aceptado", fechaEnvio: new Date(2026, 6, 1) },
  { total: 2000, estado: "rechazado", fechaEnvio: new Date(2026, 6, 2) },
  { total: 3000, estado: "pendiente_respuesta", fechaEnvio: new Date(2026, 6, 3) },
  { total: 4000, estado: "caducado", fechaEnvio: new Date(2026, 6, 4) }
]);
expect(quotes.validTotal === 4000, "[business-metrics] valid quote total must exclude rejected and expired", quotes);
expect(quotes.decidedCount === 3 && quotes.acceptedCount === 1, "[business-metrics] decided quote counts are wrong", quotes);
expect(Math.round(quotes.conversionRate) === 33, "[business-metrics] quote conversion must be accepted over decided", quotes);

const profit = calculateProfitMetrics({ invoiced: 3000, collected: 2500, expenses: 650 });
expect(profit.profitOnInvoiced === 2350, "[business-metrics] profit on invoiced is wrong", profit);
expect(Math.round(profit.marginOnInvoiced * 10) / 10 === 78.3, "[business-metrics] margin on invoiced is wrong", profit);

const work = calculateWorkProfitability({
  id: "work-1",
  titulo: "Reforma cocina",
  estado: "en_curso",
  costePrevisto: 800,
  presupuestoAprobado: 3000,
  client: { nombre: "Cliente" },
  invoices: [invoice],
  expenses: [{ importe: 650, categoria: "material" }],
  budgets: [{ total: 3000, estado: "aceptado" }]
});
expect(work.invoiced === 1000 && work.collected === 500, "[business-metrics] work invoice and collection totals are wrong", work);
expect(work.profitOnInvoiced === 350, "[business-metrics] work profit is wrong", work);
expect(work.deviation === -150, "[business-metrics] work deviation should be expense minus forecast", work);

expect(compareMetric(120, 100, "higher_better").tone === "positive", "[business-metrics] higher_better tone is wrong");
expect(compareMetric(120, 100, "lower_better").tone === "negative", "[business-metrics] lower_better tone is wrong");
expect(percentOf(25, 100) === 25, "[business-metrics] percentOf is wrong");

console.log("[business-metrics] OK formulas and status semantics");
