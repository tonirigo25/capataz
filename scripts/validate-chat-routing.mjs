import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const moduleCache = new Map();
let state;

process.env.NEXT_PUBLIC_APP_ENV = "production";
process.env.CAPATAZ_CHAT_DEBUG = "false";

function resetState() {
  const now = new Date("2026-07-11T10:00:00.000Z");
  const future = new Date("2026-08-01T10:00:00.000Z");
  const past = new Date("2026-06-01T10:00:00.000Z");
  state = {
    counters: { conversation: 0, message: 0, client: 0, work: 0, budget: 0, invoice: 0, log: 0 },
    mutations: { client: 0, work: 0, budget: 0, invoice: 0, payment: 0, event: 0, reminder: 0 },
    failNextBudgetFindFirst: false,
    conversations: [],
    messages: [],
    logs: [],
    clients: [
      {
        id: "client-alto",
        nombre: "Cliente Alto",
        telefono: "600000001",
        email: "alto@example.test",
        direccion: "Calle Alta 1",
        tipo: "Empresa",
        estado: "activo",
        archivadoAt: null,
        origen: "fixture",
        notas: "CIF A00000001",
        ultimaInteraccion: now,
        fechaCreacion: now,
        updatedAt: now
      },
      {
        id: "client-deuda",
        nombre: "Cliente Deuda",
        telefono: "600000002",
        email: "deuda@example.test",
        direccion: "Calle Deuda 2",
        tipo: "Empresa",
        estado: "activo",
        archivadoAt: null,
        origen: "fixture",
        notas: "CIF B00000002",
        ultimaInteraccion: now,
        fechaCreacion: now,
        updatedAt: now
      },
      {
        id: "client-incomplete",
        nombre: "Cliente Incompleto",
        telefono: null,
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        archivadoAt: null,
        origen: "fixture",
        notas: "",
        ultimaInteraccion: now,
        fechaCreacion: now,
        updatedAt: now
      }
    ],
    works: [
      {
        id: "work-alto",
        clienteId: "client-alto",
        titulo: "Obra alta",
        direccion: "Calle Alta 1",
        tipoTrabajo: "Reforma",
        estado: "en_curso",
        fechaInicio: past,
        fechaFinPrevista: null,
        presupuestoAprobado: 0,
        gastoReal: 0,
        margenEstimado: 0,
        notas: "",
        fechaCreacion: past,
        updatedAt: now
      },
      {
        id: "work-deuda",
        clienteId: "client-deuda",
        titulo: "Obra deuda",
        direccion: "Calle Deuda 2",
        tipoTrabajo: "Reparación",
        estado: "pendiente_cobro",
        fechaInicio: past,
        fechaFinPrevista: null,
        presupuestoAprobado: 0,
        gastoReal: 0,
        margenEstimado: 0,
        notas: "",
        fechaCreacion: past,
        updatedAt: now
      }
    ],
    budgets: [
      {
        id: "budget-high",
        clienteId: "client-alto",
        obraId: "work-alto",
        numero: "P-100",
        titulo: "Obra alta",
        partidas: "[]",
        subtotal: 100000,
        iva: 0,
        descuento: 0,
        total: 100000,
        margenEstimado: 0,
        estado: "enviado",
        fechaCreacion: past,
        fechaValidez: future,
        fechaSeguimiento: null,
        condiciones: "",
        observaciones: "",
        formaPago: ""
      },
      {
        id: "budget-exact",
        clienteId: "client-deuda",
        obraId: "work-deuda",
        numero: "P-060",
        titulo: "Obra deuda",
        partidas: "[]",
        subtotal: 60000,
        iva: 0,
        descuento: 0,
        total: 60000,
        margenEstimado: 0,
        estado: "borrador",
        fechaCreacion: now,
        fechaValidez: future,
        fechaSeguimiento: null,
        condiciones: "",
        observaciones: "",
        formaPago: ""
      }
    ],
    invoices: [
      {
        id: "invoice-alto",
        clienteId: "client-alto",
        obraId: "work-alto",
        numero: "F-010",
        concepto: "Factura alta",
        importeBase: 10000,
        iva: 0,
        total: 10000,
        pagado: 0,
        pendiente: 10000,
        estado: "pendiente_pago",
        fechaEmision: past,
        fechaVencimiento: future
      },
      {
        id: "invoice-deuda",
        clienteId: "client-deuda",
        obraId: "work-deuda",
        numero: "F-005",
        concepto: "Factura deuda",
        importeBase: 5000,
        iva: 0,
        total: 5000,
        pagado: 0,
        pendiente: 5000,
        estado: "vencida",
        fechaEmision: past,
        fechaVencimiento: past
      },
      {
        id: "invoice-paid",
        clienteId: "client-deuda",
        obraId: "work-deuda",
        numero: "F-001",
        concepto: "Factura pagada",
        importeBase: 1000,
        iva: 0,
        total: 1000,
        pagado: 1000,
        pendiente: 0,
        estado: "pagada",
        fechaEmision: past,
        fechaVencimiento: past
      }
    ],
    payments: [
      { id: "payment-alto", facturaId: "invoice-alto", clienteId: "client-alto", importe: 3000, fecha: past },
      { id: "payment-deuda", facturaId: "invoice-deuda", clienteId: "client-deuda", importe: 1000, fecha: past },
      { id: "payment-paid", facturaId: "invoice-paid", clienteId: "client-deuda", importe: 1000, fecha: past }
    ],
    expenses: [],
    documents: [],
    events: [
      {
        id: "event-visit",
        clienteId: "client-alto",
        obraId: "work-alto",
        tipo: "visita",
        estado: "pendiente",
        requiereConfirmacion: true,
        fechaInicio: future,
        horaInicio: "10:00",
        titulo: "Visita pendiente"
      }
    ],
    reminders: [
      {
        id: "reminder-1",
        clienteId: "client-alto",
        obraId: "work-alto",
        tipo: "seguimiento_presupuesto",
        estado: "programado",
        fechaProgramada: future
      },
      {
        id: "reminder-2",
        clienteId: "client-deuda",
        obraId: "work-deuda",
        tipo: "recordatorio_factura",
        estado: "pendiente_confirmacion",
        fechaProgramada: future
      }
    ]
  };
}

resetState();

const mockPrisma = {
  chatConversation: {
    findFirst: async (args = {}) => applyFindMany("chatConversation", state.conversations, args)[0] ?? null,
    findUnique: async (args = {}) => selectMaybe(state.conversations.find((item) => item.id === args.where?.id) ?? null, args.select),
    findMany: async (args = {}) => applyFindMany("chatConversation", state.conversations, args),
    create: async (args = {}) => {
      const item = withTimestamps({
        id: args.data?.id ?? nextId("conversation"),
        title: args.data?.title ?? "Nueva conversación",
        status: args.data?.status ?? "active",
        activeTask: args.data?.activeTask ?? null,
        metadata: args.data?.metadata ?? null,
        archivedAt: null,
        lastActivityAt: args.data?.lastActivityAt ?? new Date()
      });
      state.conversations.push(item);
      return includeChatConversation(item, args.include);
    },
    update: async (args = {}) => {
      const item = state.conversations.find((conversation) => conversation.id === args.where?.id);
      if (!item) throw new Error("Conversation not found");
      assignDefined(item, args.data ?? {});
      item.updatedAt = new Date();
      return includeChatConversation(item, args.include);
    },
    delete: async (args = {}) => {
      const index = state.conversations.findIndex((conversation) => conversation.id === args.where?.id);
      if (index >= 0) return state.conversations.splice(index, 1)[0];
      return null;
    }
  },
  chatMessage: {
    findUnique: async (args = {}) => {
      const item = args.where?.idempotencyKey
        ? state.messages.find((message) => message.idempotencyKey === args.where.idempotencyKey)
        : state.messages.find((message) => message.id === args.where?.id);
      return selectMaybe(item ?? null, args.select);
    },
    findFirst: async (args = {}) => selectMaybe(applyFindMany("chatMessage", state.messages, args)[0] ?? null, args.select),
    create: async (args = {}) => {
      const item = withTimestamps({
        id: args.data?.id ?? nextId("message"),
        conversationId: args.data?.conversationId,
        idempotencyKey: args.data?.idempotencyKey ?? null,
        role: args.data?.role,
        content: args.data?.content,
        status: args.data?.status,
        context: args.data?.context ?? null,
        metadata: args.data?.metadata ?? null
      });
      state.messages.push(item);
      return item;
    },
    upsert: async (args = {}) => {
      const existing = state.messages.find((message) => message.idempotencyKey === args.where?.idempotencyKey);
      if (existing) {
        assignDefined(existing, args.update ?? {});
        existing.updatedAt = new Date();
        return existing;
      }
      const item = withTimestamps({
        id: args.create?.id ?? nextId("message"),
        conversationId: args.create?.conversationId,
        idempotencyKey: args.create?.idempotencyKey ?? args.where?.idempotencyKey ?? null,
        role: args.create?.role,
        content: args.create?.content,
        status: args.create?.status,
        context: args.create?.context ?? null,
        metadata: args.create?.metadata ?? null
      });
      state.messages.push(item);
      return item;
    },
    update: async (args = {}) => {
      const item = state.messages.find((message) => message.id === args.where?.id);
      if (!item) throw new Error("Message not found");
      assignDefined(item, args.data ?? {});
      item.updatedAt = new Date();
      return item;
    },
    updateMany: async (args = {}) => {
      const matches = state.messages.filter((message) => matchesWhere(message, args.where ?? {}));
      for (const item of matches) {
        assignDefined(item, args.data ?? {});
        item.updatedAt = new Date();
      }
      return { count: matches.length };
    }
  },
  chatActionLog: {
    create: async (args = {}) => {
      const item = withTimestamps({ id: nextId("log"), ...(args.data ?? {}) });
      state.logs.push(item);
      return item;
    }
  },
  client: {
    findMany: async (args = {}) => applyFindMany("client", state.clients, args),
    findUnique: async (args = {}) => selectMaybe(state.clients.find((item) => item.id === args.where?.id) ?? null, args.select),
    create: async (args = {}) => {
      state.mutations.client += 1;
      const item = withTimestamps({
        id: args.data?.id ?? nextId("client"),
        tipo: "Particular",
        origen: "test",
        ...args.data
      });
      state.clients.push(item);
      return item;
    },
    update: async (args = {}) => {
      state.mutations.client += 1;
      const item = state.clients.find((client) => client.id === args.where?.id);
      if (!item) throw new Error("Client not found");
      assignDefined(item, args.data ?? {});
      item.updatedAt = new Date();
      return item;
    }
  },
  work: {
    count: async (args = {}) => applyFindMany("work", state.works, args).length,
    findMany: async (args = {}) => applyFindMany("work", state.works, args),
    findUnique: async (args = {}) => includeWork(state.works.find((item) => item.id === args.where?.id) ?? null, args.include, args.select),
    findUniqueOrThrow: async (args = {}) => {
      const item = await mockPrisma.work.findUnique(args);
      if (!item) throw new Error("Work not found");
      return item;
    },
    create: async (args = {}) => {
      state.mutations.work += 1;
      const item = withTimestamps({ id: args.data?.id ?? nextId("work"), ...args.data });
      state.works.push(item);
      return item;
    },
    update: async (args = {}) => {
      state.mutations.work += 1;
      const item = state.works.find((work) => work.id === args.where?.id);
      if (!item) throw new Error("Work not found");
      assignDefined(item, args.data ?? {});
      item.updatedAt = new Date();
      return item;
    }
  },
  budget: {
    count: async (args = {}) => applyFindMany("budget", state.budgets, args).length,
    findFirst: async (args = {}) => {
      if (state.failNextBudgetFindFirst) {
        state.failNextBudgetFindFirst = false;
        throw new Error("Injected budget query failure");
      }
      return applyFindMany("budget", state.budgets, args)[0] ?? null;
    },
    findMany: async (args = {}) => applyFindMany("budget", state.budgets, args),
    findUnique: async (args = {}) => includeBudget(state.budgets.find((item) => item.id === args.where?.id) ?? null, args.include, args.select),
    create: async (args = {}) => {
      state.mutations.budget += 1;
      const item = withTimestamps({
        id: args.data?.id ?? nextId("budget"),
        fechaCreacion: new Date(),
        ...args.data
      });
      state.budgets.push(item);
      return item;
    },
    update: async (args = {}) => {
      state.mutations.budget += 1;
      const item = state.budgets.find((budget) => budget.id === args.where?.id);
      if (!item) throw new Error("Budget not found");
      assignDefined(item, args.data ?? {});
      item.updatedAt = new Date();
      return item;
    }
  },
  invoice: {
    count: async (args = {}) => applyFindMany("invoice", state.invoices, args).length,
    findFirst: async (args = {}) => applyFindMany("invoice", state.invoices, args)[0] ?? null,
    findMany: async (args = {}) => applyFindMany("invoice", state.invoices, args),
    findUnique: async (args = {}) => includeInvoice(state.invoices.find((item) => item.id === args.where?.id) ?? null, args.include, args.select),
    create: async (args = {}) => {
      state.mutations.invoice += 1;
      const item = withTimestamps({ id: args.data?.id ?? nextId("invoice"), ...args.data });
      state.invoices.push(item);
      return item;
    },
    update: async (args = {}) => {
      state.mutations.invoice += 1;
      const item = state.invoices.find((invoice) => invoice.id === args.where?.id);
      if (!item) throw new Error("Invoice not found");
      assignDefined(item, args.data ?? {});
      item.updatedAt = new Date();
      return item;
    }
  },
  payment: {
    findMany: async (args = {}) => applyFindMany("payment", state.payments, args),
    create: async (args = {}) => {
      state.mutations.payment += 1;
      const item = withTimestamps({ id: args.data?.id ?? nextId("payment"), ...args.data });
      state.payments.push(item);
      return item;
    }
  },
  eventoAgenda: {
    count: async (args = {}) => applyFindMany("event", state.events, args).length,
    findMany: async (args = {}) => applyFindMany("event", state.events, args),
    findUnique: async (args = {}) => includeEvent(state.events.find((item) => item.id === args.where?.id) ?? null, args.include, args.select),
    create: async (args = {}) => {
      state.mutations.event += 1;
      const item = withTimestamps({ id: args.data?.id ?? nextId("event"), ...args.data });
      state.events.push(item);
      return item;
    }
  },
  reminder: {
    count: async (args = {}) => applyFindMany("reminder", state.reminders, args).length,
    findMany: async (args = {}) => applyFindMany("reminder", state.reminders, args),
    create: async (args = {}) => {
      state.mutations.reminder += 1;
      const item = withTimestamps({ id: args.data?.id ?? nextId("reminder"), ...args.data });
      state.reminders.push(item);
      return item;
    }
  },
  expense: {
    findMany: async (args = {}) => applyFindMany("expense", state.expenses, args)
  },
  document: {
    findMany: async (args = {}) => applyFindMany("document", state.documents, args)
  },
  empresa: {
    findFirst: async () => ({ ivaDefecto: 21, condicionesPorDefecto: "Condiciones de prueba" })
  },
  usuarioPerfil: {
    findFirst: async () => null
  },
  $transaction: async (callback) => callback(mockPrisma)
};

function loadTsModule(relativePath) {
  const absolutePath = path.resolve(relativePath);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath).exports;
  const source = fs.readFileSync(absolutePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(absolutePath, module);
  const localRequire = (specifier) => {
    if (specifier === "next/cache") return { revalidatePath: () => undefined };
    if (specifier === "@/lib/prisma") return { prisma: mockPrisma };
    if (specifier === "@/lib/ai/capataz-ai") {
      return {
        isCapatazAIConfigured: () => false,
        getCapatazAIErrorMeta: () => null,
        interpretCapatazMessageWithAI: async () => null
      };
    }
    if (specifier === "@/lib/numbering") return { nextDocumentNumber: async () => "P-TEST-001" };
    if (specifier === "@/lib/status") return { deriveInvoiceStatus: () => "pendiente_pago" };
    if (specifier.startsWith("@/")) return loadTsModule(`${specifier.slice(2)}.ts`);
    return require(specifier);
  };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    Intl,
    URL
  }, { filename: absolutePath });
  return module.exports;
}

const { runChatCommand } = loadTsModule("app/(app)/capataz/actions.ts");
const { classifyChatIntent } = loadTsModule("lib/capataz-chat-query.ts");

let runCounter = 0;

async function runMessage(text, context = null, conversationId = undefined) {
  runCounter += 1;
  return runChatCommand(text, context, {
    conversationId,
    messageId: `test-message-${runCounter}`,
    idempotencyKey: `test-idempotency-${runCounter}`,
    clientStartedAt: Date.now()
  });
}

function businessMutations() {
  return Object.values(state.mutations).reduce((sum, value) => sum + value, 0);
}

function lastLog(stage) {
  return [...state.logs].reverse().find((log) => log.stage === stage) ?? null;
}

function expect(condition, message, details) {
  if (!condition) {
    console.error("[chat-routing] FAIL", message);
    if (details !== undefined) console.error(details);
    process.exitCode = 1;
    throw new Error(message);
  }
}

function expectNoQueryMutation(result) {
  expect(!result.created, "database query created a business record", result);
  expect(!/He entendido estos datos/i.test(result.text), "database query fell through to parser response", result.text);
  expect(businessMutations() === 0, "database query mutated business tables", state.mutations);
}

function expectRoute(result, expected) {
  expect(result.handled === true, "message was not handled", result);
  expect(result.diagnostics?.intentKind === expected.intentKind, `unexpected intent kind for ${expected.handler}`, result.diagnostics);
  expect(result.diagnostics?.handler === expected.handler, `unexpected handler for ${expected.handler}`, result.diagnostics);
  expect(result.diagnostics?.noMutation === true, "query diagnostics did not mark noMutation", result.diagnostics);
  const intentLog = lastLog("chat:intent");
  const resultLog = lastLog("chat:database_result");
  expect(intentLog?.metadata?.routedKind === expected.intentKind, "chat:intent log did not record routed intent", intentLog?.metadata);
  expect(resultLog?.metadata?.handler === expected.handler, "chat:database_result log did not record handler", resultLog?.metadata);
}

async function testPendingSummary() {
  resetState();
  const before = businessMutations();
  const result = await runMessage("qué tenemos pendiente");
  expectRoute(result, { intentKind: "pending_summary", handler: "queryPendingTasksSummary" });
  expectNoQueryMutation(result);
  expect(businessMutations() === before, "pending summary changed business mutation count");
  expect(result.text.includes("Tienes:"), "pending summary did not return grouped quantities", result.text);
  expect(/presupuestos pendientes/i.test(result.text), "pending summary missed budget count", result.text);
  expect(/facturas pendientes de cobro/i.test(result.text), "pending summary missed invoice count", result.text);
  expect(!/Cliente Alto|Cliente Deuda|P-100|F-010/.test(result.text), "pending summary leaked detailed records", result.text);
  expect(!result.context?.activeTask, "pending summary used activeTask", result.context);
  expect(result.context?.lastQuery?.type === "pending_summary", "pending summary did not store lastQuery", result.context);
}

async function testHighestBudget() {
  resetState();
  const result = await runMessage("cuál es el presupuesto más alto");
  expectRoute(result, { intentKind: "aggregate_query", handler: "queryBudgetByAmount/highest" });
  expectNoQueryMutation(result);
  expect(result.text.includes("P-100"), "highest budget did not return real budget number", result.text);
  expect(result.text.includes("Cliente Alto"), "highest budget did not include real client", result.text);
  expect(!result.context?.activeTask, "highest budget activated activeTask", result.context);
}

async function testOutstandingDebt() {
  resetState();
  const result = await runMessage("cuánto me deben");
  expectRoute(result, { intentKind: "aggregate_query", handler: "queryBusinessMetric/outstanding" });
  expectNoQueryMutation(result);
  expect(/pendiente de cobro/i.test(result.text), "outstanding debt did not use BI pending collection wording", result.text);
  expect(result.text.includes("11.000"), "outstanding debt did not calculate invoices minus payments", result.text);
}

async function testClientHighestDebt() {
  resetState();
  const result = await runMessage("qué cliente me debe más");
  expectRoute(result, { intentKind: "comparison_query", handler: "queryBusinessClientHighestDebt" });
  expectNoQueryMutation(result);
  expect(result.text.includes("Cliente Alto"), "client highest debt did not group by client", result.text);
  expect(/7\.000|7000/.test(result.text), "client highest debt did not use computed open balance", result.text);
}

async function testExplicitCreateStillUsesParser() {
  resetState();
  const classified = classifyChatIntent("haz presupuesto para Pedro por 5000");
  expect(classified.kind === "create", "explicit budget request was not classified as create", classified);
  const result = await runMessage("haz presupuesto para Pedro por 5000");
  const intentLog = lastLog("chat:intent");
  expect(intentLog?.metadata?.classifiedKind === "create", "create request did not log create intent", intentLog?.metadata);
  expect(result.created?.budgetId, "explicit create did not create a budget", result);
  expect(state.mutations.budget === 1, "explicit create did not use budget creation path", state.mutations);
}

async function testPendingDetailFollowUp() {
  resetState();
  const conversationId = "conversation-followup";
  state.conversations.push(withTimestamps({
    id: conversationId,
    title: "Seguimiento pendientes",
    status: "active",
    activeTask: null,
    metadata: null,
    archivedAt: null,
    lastActivityAt: new Date()
  }));
  const first = await runMessage("qué tenemos pendiente", null, conversationId);
  const second = await runMessage("dímelos", first.context, conversationId);
  expectRoute(second, { intentKind: "pending_details", handler: "queryPendingTaskDetails" });
  expectNoQueryMutation(second);
  expect(/presupuestos pendientes|facturas|visitas|seguimientos/i.test(second.text), "follow-up did not show pending details", second.text);
  expect(second.context?.lastQuery?.type === "pending_detail", "follow-up did not update lastQuery", second.context);
}

async function testPendingDetailWithoutContext() {
  resetState();
  const result = await runMessage("dímelos");
  expect(result.handled === true, "context-free follow-up was not handled", result);
  expect(!result.created, "context-free follow-up created a record", result);
  expect(businessMutations() === 0, "context-free follow-up mutated business tables", state.mutations);
  expect(/No tengo una tarea activa|Dime qué categoría|Necesito/i.test(result.text), "context-free follow-up did not ask for clarification", result.text);
}

async function testBudgetByAmountDoesNotCreate() {
  resetState();
  const result = await runMessage("¿cuál es el presupuesto de 60000?");
  expectRoute(result, { intentKind: "database_query", handler: "queryBudgetByExactAmount" });
  expectNoQueryMutation(result);
  expect(result.text.includes("P-060"), "budget by amount did not query exact budget", result.text);
}

async function testNoResultsDoesNotInventData() {
  resetState();
  const result = await runMessage("¿cuál es el presupuesto de 12345?");
  expectRoute(result, { intentKind: "database_query", handler: "queryBudgetByExactAmount" });
  expectNoQueryMutation(result);
  expect(/No encuentro ningún presupuesto/i.test(result.text), "no-results query did not return clear empty response", result.text);
}

async function testQueryErrorReturnsVisibleMessage() {
  resetState();
  state.failNextBudgetFindFirst = true;
  const result = await runMessage("cuál es el presupuesto más alto");
  expect(result.handled === true, "query error was not handled", result);
  expect(/No he podido consultar esos datos/i.test(result.text), "query error did not return visible message", result.text);
  expect(!result.created, "query error created a business record", result);
  expect(businessMutations() === 0, "query error mutated business tables", state.mutations);
  expect(state.messages.some((message) => message.role === "assistant" && message.content.includes("No he podido consultar")), "conversation did not persist visible error response", state.messages);
}

const tests = [
  ["pending summary", testPendingSummary],
  ["highest budget", testHighestBudget],
  ["outstanding debt", testOutstandingDebt],
  ["client highest debt", testClientHighestDebt],
  ["explicit create", testExplicitCreateStillUsesParser],
  ["pending detail follow-up", testPendingDetailFollowUp],
  ["pending detail without context", testPendingDetailWithoutContext],
  ["budget by amount", testBudgetByAmountDoesNotCreate],
  ["no results", testNoResultsDoesNotInventData],
  ["query error", testQueryErrorReturnsVisibleMessage]
];

for (const [name, test] of tests) {
  await test();
  console.log(`[chat-routing] OK ${name}`);
}

function applyFindMany(model, rows, args = {}) {
  let result = rows.filter((row) => matchesWhere(row, args.where ?? {}));
  result = applyOrder(result, args.orderBy);
  if (typeof args.take === "number") result = result.slice(0, args.take);
  result = result.map((row) => includeModel(model, row, args.include, args.select));
  return result;
}

function includeModel(model, row, include, select) {
  if (model === "client") return includeClient(row, include, select);
  if (model === "budget") return includeBudget(row, include, select);
  if (model === "invoice") return includeInvoice(row, include, select);
  if (model === "work") return includeWork(row, include, select);
  if (model === "payment") return includePayment(row, include, select);
  if (model === "expense") return includeExpense(row, include, select);
  if (model === "event") return includeEvent(row, include, select);
  if (model === "reminder") return includeReminder(row, include, select);
  if (model === "chatConversation") return includeChatConversation(row, include, select);
  return selectMaybe(clone(row), select);
}

function includeClient(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.invoices || select?.invoices) item.invoices = state.invoices.filter((invoice) => invoice.clienteId === row.id).map((invoice) => includeInvoice(invoice, select?.invoices?.include, select?.invoices?.select));
  if (include?.payments || select?.payments) item.payments = clone(state.payments.filter((payment) => payment.clienteId === row.id));
  if (include?.works || select?.works) item.works = clone(state.works.filter((work) => work.clienteId === row.id));
  return selectMaybe(item, select);
}

function includeBudget(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.client || select?.client) item.client = clone(state.clients.find((client) => client.id === row.clienteId));
  if (include?.work || select?.work) item.work = clone(state.works.find((work) => work.id === row.obraId) ?? null);
  return selectMaybe(item, select);
}

function includeInvoice(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.client || select?.client) item.client = clone(state.clients.find((client) => client.id === row.clienteId));
  if (include?.work || select?.work) item.work = clone(state.works.find((work) => work.id === row.obraId) ?? null);
  if (include?.payments || select?.payments) item.payments = clone(state.payments.filter((payment) => payment.facturaId === row.id));
  return selectMaybe(item, select);
}

function includeWork(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.client || select?.client) item.client = clone(state.clients.find((client) => client.id === row.clienteId));
  if (include?.invoices || select?.invoices) item.invoices = state.invoices.filter((invoice) => invoice.obraId === row.id).map((invoice) => includeInvoice(invoice, select?.invoices?.include, select?.invoices?.select));
  if (include?.expenses || select?.expenses) item.expenses = clone(state.expenses.filter((expense) => expense.obraId === row.id));
  if (include?.budgets || select?.budgets) item.budgets = clone(state.budgets.filter((budget) => budget.obraId === row.id));
  return selectMaybe(item, select);
}

function includePayment(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.invoice || select?.invoice) item.invoice = clone(state.invoices.find((invoice) => invoice.id === row.facturaId) ?? null);
  if (include?.client || select?.client) item.client = clone(state.clients.find((client) => client.id === row.clienteId) ?? null);
  return selectMaybe(item, select);
}

function includeExpense(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.work || select?.work) item.work = includeWork(state.works.find((work) => work.id === row.obraId) ?? null, select?.work?.include, select?.work?.select);
  return selectMaybe(item, select);
}

function includeEvent(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.client) item.client = clone(state.clients.find((client) => client.id === row.clienteId) ?? null);
  if (include?.work) item.work = clone(state.works.find((work) => work.id === row.obraId) ?? null);
  return selectMaybe(item, select);
}

function includeReminder(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.client) item.client = clone(state.clients.find((client) => client.id === row.clienteId) ?? null);
  if (include?.work) item.work = clone(state.works.find((work) => work.id === row.obraId) ?? null);
  return selectMaybe(item, select);
}

function includeChatConversation(row, include, select) {
  if (!row) return null;
  const item = clone(row);
  if (include?.messages) {
    const messageArgs = typeof include.messages === "object" ? include.messages : {};
    item.messages = applyFindMany("chatMessage", state.messages.filter((message) => message.conversationId === row.id), messageArgs);
  }
  return selectMaybe(item, select);
}

function selectMaybe(row, select) {
  if (!row || !select) return row;
  const selected = {};
  for (const key of Object.keys(select)) {
    if (select[key]) selected[key] = row[key];
  }
  return selected;
}

function matchesWhere(row, where) {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue;
    if (key === "AND" && Array.isArray(expected)) {
      if (!expected.every((item) => matchesWhere(row, item))) return false;
      continue;
    }
    if (key === "OR" && Array.isArray(expected)) {
      if (!expected.some((item) => matchesWhere(row, item))) return false;
      continue;
    }
    if (key === "messages" && expected?.some !== undefined) {
      const hasMessages = state.messages.some((message) => message.conversationId === row.id);
      if (!hasMessages) return false;
      continue;
    }
    if (key === "messages" && expected?.none !== undefined) {
      const hasMessages = state.messages.some((message) => message.conversationId === row.id);
      if (hasMessages) return false;
      continue;
    }
    if (!matchesValue(row[key], expected)) return false;
  }
  return true;
}

function matchesValue(actual, expected) {
  if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
    if ("in" in expected) return expected.in.includes(actual);
    if ("notIn" in expected) return !expected.notIn.includes(actual);
    if ("not" in expected && actual === expected.not) return false;
    if ("gte" in expected && !(actual >= expected.gte)) return false;
    if ("gt" in expected && !(actual > expected.gt)) return false;
    if ("lte" in expected && !(actual <= expected.lte)) return false;
    if ("lt" in expected && !(actual < expected.lt)) return false;
    if ("gte" in expected || "gt" in expected || "lte" in expected || "lt" in expected) return true;
    if ("contains" in expected) return String(actual ?? "").toLowerCase().includes(String(expected.contains).toLowerCase());
    return Object.entries(expected).every(([key, value]) => matchesValue(actual?.[key], value));
  }
  return actual === expected;
}

function applyOrder(rows, orderBy) {
  if (!orderBy) return [...rows];
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [key, direction] = Object.entries(order)[0] ?? [];
      if (!key) continue;
      const valueA = a[key] instanceof Date ? a[key].getTime() : a[key];
      const valueB = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (valueA === valueB) continue;
      const diff = valueA > valueB ? 1 : -1;
      return direction === "desc" ? -diff : diff;
    }
    return 0;
  });
}

function assignDefined(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) target[key] = value;
  }
}

function withTimestamps(item) {
  const now = new Date();
  return {
    createdAt: item.createdAt ?? item.fechaCreacion ?? now,
    updatedAt: item.updatedAt ?? now,
    ...item
  };
}

function nextId(kind) {
  state.counters[kind] = (state.counters[kind] ?? 0) + 1;
  return `${kind}-${state.counters[kind]}`;
}

function clone(value) {
  if (value === null || value === undefined) return value;
  return structuredClone(value);
}
