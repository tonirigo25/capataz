import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

function compileModule(path, requireOverride = nativeRequire) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const sandbox = { exports: {}, require: requireOverride, console };
  vm.runInNewContext(compiled, sandbox, { filename: path });
  return sandbox.exports;
}

const parser = compileModule("lib/capataz-chat-parser.ts");
const engine = compileModule("lib/capataz-chat-engine.ts", (id) => {
  if (id === "@/lib/capataz-chat-parser") return parser;
  return nativeRequire(id);
});

const {
  createBudgetCompletionContext,
  createLastDocumentContext,
  createWorkSelectionContext,
  planChatMessage
} = engine;

const budgetCommand = parser.parseChatCommand("créame para el cliente Juana un presupuesto de la reforma integral, cocina + baño de 14000 euros, con material incluido");
const workSelectionContext = createWorkSelectionContext({
  clientId: "client_juana",
  clientName: "Juana",
  workOption: { id: "work_reforma", label: "Reforma integral cocina + baño", type: "work" },
  draftBudget: budgetCommand,
  lastQuestion: "Ya existe una obra parecida para Juana: Reforma integral cocina + baño. ¿Quieres usar esa obra o crear una nueva?"
});

const cases = [
  {
    name: "usar obra con esa",
    message: "esa",
    context: workSelectionContext,
    expected: { action: "use_existing_work_for_budget", workId: "work_reforma" }
  },
  {
    name: "usar obra con frase natural",
    message: "quiero usar esa",
    context: workSelectionContext,
    expected: { action: "use_existing_work_for_budget", workId: "work_reforma" }
  },
  {
    name: "usar obra y completar IVA",
    message: "esa y con IVA incluido",
    context: workSelectionContext,
    expected: { action: "use_existing_work_for_budget", ivaMode: "included" }
  },
  {
    name: "usar obra y actualizar telefono",
    message: "esa y el teléfono de Juana es 65898784",
    context: workSelectionContext,
    expected: { action: "use_existing_work_for_budget", phone: "65898784" }
  },
  {
    name: "crear obra nueva",
    message: "crea una nueva",
    context: workSelectionContext,
    expected: { action: "create_new_work_for_budget" }
  },
  {
    name: "completar presupuesto anterior",
    message: "iva incluido, es en mallorca la obra. teléfono de juana es 65898784",
    context: createBudgetCompletionContext({
      clientId: "client_juana",
      workId: "work_reforma",
      budgetId: "budget_juana",
      clientName: "Juana"
    }),
    expected: { action: "complete_budget", ivaMode: "included", workAddress: "Mallorca", phone: "65898784" }
  },
  {
    name: "pdf ultimo documento",
    message: "haz PDF",
    context: createLastDocumentContext({
      documentType: "budget",
      documentId: "budget_juana",
      clientId: "client_juana",
      workId: "work_reforma",
      clientName: "Juana"
    }),
    expected: { action: "generate_pdf" }
  },
  {
    name: "crear factura",
    message: "haz factura a Laura por la cocina, 4200 con IVA incluido",
    context: {},
    expected: { action: "create_invoice", clientName: "Laura", amount: 4200, ivaMode: "included" }
  },
  {
    name: "convertir presupuesto",
    message: "convierte el presupuesto de Juana en factura",
    context: {},
    expected: { action: "convert_budget_to_invoice", clientName: "Juana" }
  },
  {
    name: "marcar factura pagada",
    message: "marca pagada la factura de Juana",
    context: {},
    expected: { action: "mark_invoice_paid", clientName: "Juana", invoiceStatus: "pagada" }
  }
];

let failures = 0;

for (const item of cases) {
  const result = planChatMessage(item.message, item.context);
  const checks = {
    action: result.action,
    workId: result.context?.activeTask?.obraId,
    ivaMode: result.entities?.ivaMode,
    phone: result.entities?.phone,
    workAddress: result.entities?.workAddress,
    clientName: result.entities?.clientName,
    amount: result.entities?.amount,
    invoiceStatus: result.entities?.invoiceStatus
  };
  const failed = Object.entries(item.expected).filter(([key, value]) => checks[key] !== value);
  if (failed.length) {
    failures += 1;
    console.error("[chat-engine] FAIL", item.name);
    console.error("message:", item.message);
    console.error("expected subset:", item.expected);
    console.error("actual:", checks);
    console.error("plan:", result);
  } else {
    console.log("[chat-engine] OK", item.name);
  }
}

if (failures) process.exit(1);
