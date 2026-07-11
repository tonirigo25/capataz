import { expect, loadTsModule } from "./ts-test-loader.mjs";

function invoice(overrides = {}) {
  return {
    id: "invoice-1",
    numero: "F-1",
    concepto: "Hito",
    total: 1000,
    pagado: 400,
    pendiente: 600,
    estado: "emitida",
    fechaEmision: new Date(2026, 6, 2),
    fechaVencimiento: new Date(2026, 6, 20),
    clienteId: "client-1",
    obraId: "work-1",
    client: { id: "client-1", nombre: "Cliente Uno", tipo: "empresa", nifCif: "B00000000", direccionFiscal: "Calle 1" },
    work: { id: "work-1", titulo: "Reforma cocina" },
    payments: [{ id: "payment-1", importe: 400, fecha: new Date(2026, 6, 5) }],
    ...overrides
  };
}

function budget(overrides = {}) {
  return {
    id: "budget-1",
    numero: "P-1",
    titulo: "Presupuesto",
    total: 1200,
    estado: "aceptado",
    fechaCreacion: new Date(2026, 6, 1),
    fechaEnvio: new Date(2026, 6, 1),
    fechaValidez: new Date(2026, 6, 15),
    client: { id: "client-1", nombre: "Cliente Uno" },
    work: { id: "work-1", titulo: "Reforma cocina" },
    ...overrides
  };
}

function expense(overrides = {}) {
  return {
    id: "expense-1",
    proveedor: "Proveedor",
    concepto: "Material",
    categoria: "material",
    importe: 300,
    fecha: new Date(2026, 6, 3),
    obraId: "work-1",
    work: { id: "work-1", titulo: "Reforma cocina", client: { id: "client-1", nombre: "Cliente Uno" } },
    ...overrides
  };
}

function createPrismaMock() {
  const currentInvoice = invoice();
  const previousInvoice = invoice({
    id: "invoice-prev",
    numero: "F-PREV",
    total: 500,
    pagado: 500,
    pendiente: 0,
    fechaEmision: new Date(2026, 5, 5),
    fechaVencimiento: new Date(2026, 5, 20),
    payments: [{ id: "payment-prev", importe: 500, fecha: new Date(2026, 5, 7) }]
  });
  const overdueOpenInvoice = invoice({
    id: "invoice-old-open",
    numero: "F-OLD",
    total: 500,
    pagado: 0,
    pendiente: 500,
    fechaEmision: new Date(2026, 5, 10),
    fechaVencimiento: new Date(2026, 5, 20),
    payments: []
  });
  const previousOpenInvoice = invoice({
    id: "invoice-prev-open",
    numero: "F-PREV-OPEN",
    total: 700,
    pagado: 100,
    pendiente: 600,
    fechaEmision: new Date(2026, 4, 10),
    fechaVencimiento: new Date(2026, 5, 15),
    payments: [{ id: "payment-prev-open", importe: 100, fecha: new Date(2026, 5, 1) }]
  });

  const calls = { invoice: 0, payment: 0, expense: 0, budget: 0 };
  return {
    usuarioPerfil: { findFirst: async () => ({ zonaHoraria: "Europe/Madrid" }) },
    invoice: {
      findMany: async () => {
        calls.invoice += 1;
        if (calls.invoice === 1) return [currentInvoice, invoice({ id: "invoice-draft", estado: "borrador", total: 9000, payments: [] })];
        if (calls.invoice === 2) return [previousInvoice];
        if (calls.invoice === 3) return [currentInvoice, overdueOpenInvoice];
        return [previousOpenInvoice];
      }
    },
    payment: {
      findMany: async () => {
        calls.payment += 1;
        if (calls.payment === 1) return [{ id: "payment-1", importe: 400, fecha: new Date(2026, 6, 5), invoice: { id: "invoice-1", numero: "F-1" }, client: { id: "client-1", nombre: "Cliente Uno" } }];
        return [{ id: "payment-prev", importe: 500, fecha: new Date(2026, 5, 7) }];
      }
    },
    expense: {
      findMany: async () => {
        calls.expense += 1;
        return calls.expense === 1 ? [expense()] : [expense({ id: "expense-prev", importe: 200, fecha: new Date(2026, 5, 3) })];
      }
    },
    budget: {
      findMany: async () => {
        calls.budget += 1;
        if (calls.budget === 1) return [budget(), budget({ id: "budget-rejected", numero: "P-2", total: 800, estado: "rechazado" }), budget({ id: "budget-pending", numero: "P-3", total: 500, estado: "pendiente_respuesta" })];
        if (calls.budget === 2) return [budget({ id: "budget-prev", fechaCreacion: new Date(2026, 5, 1) })];
        return [budget({ id: "budget-expiring", numero: "P-CAD", estado: "pendiente_respuesta", fechaValidez: new Date(2026, 6, 13) })];
      }
    },
    work: {
      findMany: async () => [{
        id: "work-1",
        titulo: "Reforma cocina",
        estado: "en_curso",
        costePrevisto: 250,
        gastoReal: 0,
        presupuestoAprobado: 1200,
        client: { id: "client-1", nombre: "Cliente Uno" },
        invoices: [currentInvoice],
        expenses: [{ id: "expense-1", importe: 300, categoria: "material" }],
        budgets: [{ id: "budget-1", total: 1200, estado: "aceptado" }]
      }]
    },
    client: {
      findMany: async () => [{
        id: "client-1",
        nombre: "Cliente Uno",
        tipo: "empresa",
        nifCif: "B00000000",
        direccionFiscal: "Calle 1",
        invoices: [currentInvoice, overdueOpenInvoice],
        payments: [{ id: "payment-1", importe: 400, fecha: new Date(2026, 6, 5) }],
        works: [{ id: "work-1" }]
      }]
    },
    reminder: {
      findMany: async () => [{
        id: "reminder-1",
        mensaje: "Llamar",
        fechaProgramada: new Date(2026, 6, 1),
        client: { id: "client-1", nombre: "Cliente Uno" },
        work: null
      }]
    },
    document: {
      findMany: async () => [{ id: "doc-1", name: "ticket.jpg", category: "ticket", metadata: {} }]
    }
  };
}

function loadBI() {
  const prisma = createPrismaMock();
  return loadTsModule("lib/business-intelligence.ts", { mocks: { "@/lib/prisma": { prisma } } });
}

const { buildBusinessCsvExport, getBusinessIntelligenceSummary, metricDefinitionText } = loadBI();
const summary = await getBusinessIntelligenceSummary({ period: "this_month", now: new Date(2026, 6, 11, 12, 0, 0) });

expect(summary.period.id === "this_month", "[business-intelligence] period id is wrong", summary.period);
expect(summary.money.invoiced === 1000, "[business-intelligence] invoiced must exclude non-billable invoices", summary.money);
expect(summary.money.collected === 400, "[business-intelligence] collected must use payments in period", summary.money);
expect(summary.money.expenses === 300, "[business-intelligence] expenses total is wrong", summary.money);
expect(summary.money.profitOnInvoiced === 700, "[business-intelligence] profit on invoiced is wrong", summary.money);
expect(summary.money.outstanding === 1100, "[business-intelligence] outstanding as-of balance is wrong", summary.money);
expect(summary.money.overdue === 500, "[business-intelligence] overdue as-of balance is wrong", summary.money);

const outstandingKpi = summary.kpis.find((item) => item.id === "outstanding");
expect(outstandingKpi?.comparison.previous === 600, "[business-intelligence] outstanding comparison must use previous as-of balance", outstandingKpi);
expect(summary.quotes.acceptedCount === 1 && summary.quotes.decidedCount === 2, "[business-intelligence] quote conversion inputs are wrong", summary.quotes);
expect(summary.works.byProfit[0].workId === "work-1", "[business-intelligence] work ranking is missing fixture work", summary.works);
expect(summary.clients.byDebt[0].debt === 1100, "[business-intelligence] client debt ranking is wrong", summary.clients);
expect(summary.alerts.some((alert) => alert.id.startsWith("overdue-")), "[business-intelligence] overdue alert is missing", summary.alerts);
expect(summary.qualityIssues.some((issue) => issue.id === "document-amount" && issue.count === 1), "[business-intelligence] document quality issue is missing", summary.qualityIssues);
expect(metricDefinitionText("invoiced").includes("Facturación emitida"), "[business-intelligence] metric dictionary text is missing");

const csvModule = loadBI();
const csv = await csvModule.buildBusinessCsvExport("summary", { period: "this_month", now: new Date(2026, 6, 11, 12, 0, 0) });
expect(csv.includes("metrica") && csv.includes("Facturado"), "[business-intelligence] summary CSV should include KPI rows", csv);

console.log("[business-intelligence] OK summary, rankings, alerts, quality and CSV");
