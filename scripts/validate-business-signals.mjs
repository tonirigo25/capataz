import fs from "node:fs";
import { expect, loadTsModule } from "./ts-test-loader.mjs";

const mode = process.argv[2] ?? "all";
const NOW = new Date(2026, 6, 11, 12, 0, 0);
const MAY = (day) => new Date(2026, 4, day, 12, 0, 0);
const JUN = (day) => new Date(2026, 5, day, 12, 0, 0);
const JUL = (day) => new Date(2026, 6, day, 12, 0, 0);

const prismaMock = { prisma: {} };
const treasuryMock = { getTreasuryOverview: async () => ({ alerts: [], qualityIssues: [] }) };

const businessSignals = loadTsModule("lib/business-signals.ts", {
  aliases: {
    "@/lib/works": "lib/works.ts",
    "@/lib/business-metrics": "lib/business-metrics.ts",
    "@/lib/proactive-rules": "lib/proactive-rules.ts"
  },
  mocks: {
    "@/lib/prisma": prismaMock,
    "@/lib/proactive-audit": { logProactiveAuditEvent: async () => undefined },
    "@/lib/treasury": treasuryMock
  }
});

function invoice(overrides = {}) {
  const total = overrides.total ?? 1000;
  return {
    id: overrides.id ?? "invoice-1",
    numero: overrides.numero ?? "F-1",
    concepto: overrides.concepto ?? "Trabajo",
    total,
    pagado: overrides.pagado ?? 0,
    pendiente: overrides.pendiente ?? total,
    estado: overrides.estado ?? "emitida",
    fechaEmision: overrides.fechaEmision ?? JUN(1),
    fechaVencimiento: overrides.fechaVencimiento ?? JUL(20),
    clienteId: overrides.clienteId ?? "client-1",
    obraId: overrides.obraId ?? "work-1",
    client: overrides.client ?? { id: overrides.clienteId ?? "client-1", nombre: "Cliente Uno" },
    work: overrides.work ?? { id: overrides.obraId ?? "work-1", titulo: "Obra Uno" },
    payments: overrides.payments ?? [],
    ...overrides
  };
}

function buildFixture() {
  const clientOne = { id: "client-1", nombre: "Cliente Uno", nifCif: null, telefono: "600000000", direccion: "Calle Uno" };
  const clientTwo = { id: "client-2", nombre: "Cliente Dos", nifCif: "B222", telefono: "611111111", direccion: "Calle Dos" };
  const overdueBig = invoice({
    id: "invoice-overdue-big",
    numero: "F-OVERDUE",
    total: 8000,
    pendiente: 8000,
    fechaVencimiento: MAY(1),
    clienteId: clientOne.id,
    client: clientOne
  });
  const dueSoon = invoice({
    id: "invoice-due-soon",
    numero: "F-DUE",
    total: 500,
    pendiente: 500,
    fechaVencimiento: JUL(15),
    clienteId: clientOne.id,
    client: clientOne
  });
  const otherOverdue = invoice({
    id: "invoice-other",
    numero: "F-OTHER",
    total: 100,
    pendiente: 100,
    fechaVencimiento: JUL(10),
    clienteId: clientTwo.id,
    client: clientTwo,
    obraId: null,
    work: null
  });

  return {
    clients: [
      { ...clientOne, invoices: [overdueBig, dueSoon], budgets: [{ id: "budget-1" }], works: [{ id: "work-1", titulo: "Obra Uno", estado: "en_curso" }] },
      { ...clientTwo, invoices: [otherOverdue], budgets: [], works: [] }
    ],
    invoices: [overdueBig, dueSoon, otherOverdue],
    budgets: [
      {
        id: "budget-stalled",
        numero: "P-STOP",
        titulo: "Reforma parada",
        total: 6000,
        iva: 21,
        estado: "enviado",
        fechaCreacion: MAY(15),
        fechaEnvio: MAY(20),
        fechaValidez: JUL(1),
        clienteId: clientOne.id,
        client: clientOne,
        obraId: "work-1",
        work: { id: "work-1", titulo: "Obra Uno" }
      }
    ],
    works: [
      {
        id: "work-1",
        titulo: "Obra Uno",
        direccion: "Calle Uno",
        estado: "parada",
        prioridad: "alta",
        updatedAt: JUN(1),
        clienteId: clientOne.id,
        client: clientOne,
        presupuestoAprobado: 6000,
        costePrevisto: 3000,
        gastoReal: 8200,
        margenEstimado: 2500,
        subcontratasCoste: 0,
        invoices: [overdueBig, dueSoon],
        budgets: [{ total: 6000, estado: "aceptado" }],
        expenses: [{ id: "expense-work", importe: 8200, categoria: "material" }],
        materials: [{ id: "mat-1", nombre: "Azulejo", estado: "falta" }],
        reminders: [],
        agendaEvents: [],
        documents: [],
        repositoryDocuments: []
      }
    ],
    reminders: [
      { id: "reminder-1", tipo: "seguimiento_cobro", estado: "programado", mensaje: "Llamar por cobro", fechaProgramada: JUL(1), clienteId: clientOne.id, client: clientOne }
    ],
    agendaEvents: [
      { id: "agenda-1", titulo: "Visita pendiente", tipo: "visita", estado: "pendiente", fechaInicio: JUL(1), clienteId: clientOne.id, client: clientOne }
    ],
    documents: [
      { id: "doc-1", name: "Contrato obra", url: null, category: "contrato", createdAt: JUN(15), clientId: clientOne.id, client: clientOne }
    ],
    expenses: [
      {
        id: "expense-overdue",
        proveedor: "Proveedor Uno",
        concepto: "Material urgente",
        categoria: "material",
        importe: 900,
        fecha: JUN(20),
        paymentStatus: "pending",
        paymentDueDate: JUL(1),
        paidAt: null,
        costBehavior: "unknown",
        clienteId: clientOne.id,
        client: clientOne,
        obraId: "work-1",
        work: { id: "work-1", titulo: "Obra Uno" }
      }
    ],
    treasuryAlerts: [
      { id: "cash-negative", type: "negative_cash", level: "danger", date: JUL(20), title: "Caja prevista negativa", detail: "El saldo final previsto cae por debajo de cero.", amount: -1200, href: "/tesoreria", action: "Abrir tesorería" }
    ],
    treasuryQualityIssues: [
      { id: "missing-due", title: "Pagos sin fecha", count: 2, description: "Hay pagos previstos sin fecha.", href: "/tesoreria" }
    ]
  };
}

function runEngineChecks() {
  const signals = businessSignals.buildBusinessSignalsFromData(buildFixture(), NOW);
  expect(signals.length >= 12, "[business-signals] expected broad signal coverage", signals.map((signal) => signal.type));

  const fingerprints = new Set(signals.map((signal) => signal.fingerprint));
  expect(fingerprints.size === signals.length, "[business-signals] fingerprints must be unique");

  const overdue = signals.find((signal) => signal.fingerprint === "invoice:overdue:invoice-overdue-big");
  const dueSoon = signals.find((signal) => signal.fingerprint === "invoice:due-soon:invoice-due-soon");
  expect(overdue && dueSoon, "[business-signals] expected overdue and due-soon invoice signals");
  expect(overdue.score > dueSoon.score, "[business-signals] overdue invoice should outrank due-soon invoice", { overdue: overdue.score, dueSoon: dueSoon.score });
  expect(overdue.level === "critico", "[business-signals] 60+ day high amount invoice should be critical", overdue);

  const concentration = signals.find((signal) => signal.fingerprint === "client:debt-concentration:client-1");
  expect(concentration?.level === "critico", "[business-signals] concentrated client debt should be critical", concentration);

  for (const type of [
    "budget_stalled",
    "work_blocked",
    "work_low_margin",
    "work_cost_deviation",
    "materials_pending",
    "reminder_overdue",
    "agenda_event_overdue",
    "document_incomplete",
    "expense_payment_overdue",
    "expense_cost_unclassified",
    "treasury_negative_cash",
    "treasury_data_quality"
  ]) {
    expect(signals.some((signal) => signal.type === type), `[business-signals] missing signal type ${type}`, signals.map((signal) => signal.type));
  }

  for (const signal of signals) {
    expect(signal.explanation?.why && signal.explanation.rule, `[business-signals] signal ${signal.fingerprint} must explain why and rule`);
    expect(signal.explanation.dataUsed.length > 0, `[business-signals] signal ${signal.fingerprint} must expose data used`);
    expect(signal.explanation.scoreBreakdown.length > 0, `[business-signals] signal ${signal.fingerprint} must expose score breakdown`);
    expect(signal.suggestedActions.length > 0, `[business-signals] signal ${signal.fingerprint} must suggest actions`);
  }

  const tomorrow = businessSignals.resolveSnoozeUntil("tomorrow", NOW);
  const week = businessSignals.resolveSnoozeUntil("week", NOW);
  expect(tomorrow.getDate() === 12 && tomorrow.getHours() === 9, "[business-signals] tomorrow snooze should resolve to next day 09:00", tomorrow);
  expect(week.getDate() === 18 && week.getHours() === 9, "[business-signals] week snooze should resolve to +7 days 09:00", week);

  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "active", now: NOW }) === "active", "[business-signals] active signal should remain active while cause exists");
  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "snoozed", snoozedUntil: JUL(12), now: NOW }) === "snoozed", "[business-signals] snoozed signal must remain hidden until snooze date");
  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "snoozed", snoozedUntil: JUL(10), now: NOW }) === "active", "[business-signals] expired snooze must reactivate if cause remains");
  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "dismissed", lastPriority: 70, signalPriority: 75, now: NOW }) === "dismissed", "[business-signals] dismissed signal should not reappear without material change");
  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "dismissed", lastPriority: 50, signalPriority: 75, now: NOW }) === "active", "[business-signals] dismissed signal should reactivate after material score increase");
  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "resolved", now: NOW }) === "active", "[business-signals] resolved signal should reactivate if cause returns");
  expect(businessSignals.previewCurrentSignalStatusForTest({ status: "active", signalExpiresAt: JUL(10), now: NOW }) === "expired", "[business-signals] expired current signal must be marked expired");
  expect(businessSignals.previewMissingSignalStatusForTest({ expiresAt: JUL(10), now: NOW }) === "expired", "[business-signals] missing temporal signal should expire");
  expect(businessSignals.previewMissingSignalStatusForTest({ expiresAt: null, now: NOW }) === "resolved", "[business-signals] missing non-temporal signal should auto-resolve");
}

function runChatChecks() {
  const { classifyChatIntent } = loadTsModule("lib/capataz-chat-query.ts");
  const cases = [
    ["¿Qué debería revisar hoy?", "signals_review_today", "database_query"],
    ["¿Qué es lo más urgente?", "signals_urgent", "database_query"],
    ["¿Qué problemas tengo?", "signals_problems", "database_query"],
    ["¿Qué riesgos importantes detectas?", "signals_risks", "database_query"],
    ["¿Qué cliente requiere atención?", "signals_client_attention", "database_query"],
    ["¿Qué obra debo revisar?", "signals_work_attention", "database_query"],
    ["¿Qué facturas son prioritarias?", "signals_priority_invoices", "database_query"],
    ["¿Por qué esta alerta es importante?", "signals_explain_alert", "database_query"],
    ["¿Cuántas alertas críticas tengo?", "signals_critical_count", "aggregate_query"]
  ];
  for (const [text, action, kind] of cases) {
    const result = classifyChatIntent(text);
    expect(result.kind === kind && result.action === action, `[business-signals] bad chat classification for ${text}`, result);
  }

  const actionsSource = fs.readFileSync("app/(app)/capataz/actions.ts", "utf8");
  for (const action of cases.map(([, action]) => action)) {
    expect(actionsSource.includes(`case "${action}"`), `[business-signals] missing chat handler for ${action}`);
  }
  expect(actionsSource.includes("getBusinessSignals"), "[business-signals] chat must use central business signal engine");
  expect(actionsSource.includes("No he cambiado ningún registro"), "[business-signals] chat answer must state no business mutation");
}

function runUiChecks() {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  const migrationPath = "prisma/migrations/20260711213000_business_signals_risk_alerts/migration.sql";
  const page = fs.readFileSync("app/(app)/alertas/page.tsx", "utf8");
  const actions = fs.readFileSync("app/(app)/alertas/actions.ts", "utf8");
  const chrome = fs.readFileSync("components/app-chrome.tsx", "utf8");
  const bottomNav = fs.readFileSync("components/bottom-nav.tsx", "utf8");
  const today = fs.readFileSync("app/(app)/hoy/page.tsx", "utf8");
  const docs = fs.readFileSync("docs/BLOQUE_3_SENALES_RIESGOS_ALERTAS.md", "utf8");

  expect(schema.includes("model BusinessSignalState"), "[business-signals] schema must persist signal lifecycle");
  expect(schema.includes("model BusinessSignalPreference"), "[business-signals] schema must prepare deterministic preferences");
  for (const field of ["invoiceId", "budgetId", "amount", "startsAt", "expiresAt", "explanation", "suggestedActions"]) {
    expect(schema.includes(field), `[business-signals] schema must persist ${field}`);
  }
  expect(schema.includes("expired"), "[business-signals] schema must model expired lifecycle status");
  expect(fs.existsSync(migrationPath), "[business-signals] migration file missing");
  const migration = fs.readFileSync(migrationPath, "utf8");
  expect(!/\bDROP\b|\bTRUNCATE\b|\bDELETE\b/i.test(migration), "[business-signals] migration must be non-destructive");
  expect(migration.includes("'expired'"), "[business-signals] migration must create expired status");
  expect(migration.includes('"fingerprint" TEXT NOT NULL') && migration.includes("BusinessSignalState_fingerprint_key"), "[business-signals] migration must enforce deduplication");
  expect(page.includes("getBusinessSignals"), "[business-signals] /alertas must use central engine");
  expect(page.includes("Por qué aparece"), "[business-signals] /alertas must expose explanations");
  expect(page.includes("snoozeSignalAction") && page.includes("dismissSignalAction") && page.includes("resolveSignalAction"), "[business-signals] /alertas must expose lifecycle actions");
  expect(actions.includes("snoozeBusinessSignal") && actions.includes("dismissBusinessSignal") && actions.includes("resolveBusinessSignal"), "[business-signals] actions must call engine lifecycle helpers");
  expect(chrome.includes('href: "/alertas"') && bottomNav.includes('href: "/alertas"'), "[business-signals] navigation must expose /alertas");
  expect(today.includes("getTodaySignalBrief") && today.includes("/alertas"), "[business-signals] Hoy must show signal brief");
  expect(docs.includes("Fallback") && docs.includes("Railway") && docs.includes("Producción"), "[business-signals] docs must cover fallback, Railway and production");
}

if (mode === "all" || mode === "engine") runEngineChecks();
if (mode === "all" || mode === "chat") runChatChecks();
if (mode === "all" || mode === "ui") runUiChecks();

console.log(`[business-signals] OK ${mode}`);
