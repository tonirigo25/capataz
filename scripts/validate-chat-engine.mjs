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
const murhotelContext = createBudgetCompletionContext({
  clientId: "client_murhotel",
  workId: "work_menorca",
  budgetId: "budget_murhotel",
  clientName: "MURHOTEL SL",
  contactName: "Alberto Ruiz",
  billingClientName: "MURHOTEL SL",
  workName: "Renovación de 25 baños en pequeño hotel en Menorca",
  pendingFields: ["iva", "direccion_obra", "datos_cliente", "datos_fiscales"],
  draftData: { amount: 60000 }
});
const murhotelParkedContext = {
  ...murhotelContext,
  activeTask: undefined,
  parkedTask: { ...murhotelContext.activeTask, status: "aparcado" }
};

const cases = [
  {
    name: "saludo no bloquea contexto activo",
    message: "Hola",
    context: murhotelContext,
    expected: { action: "answer_context", responseIncludes: "Hola", responseIncludes2: "MURHOTEL SL" }
  },
  {
    name: "pregunta datos pendientes lista campos concretos",
    message: "qué datos faltan?",
    context: murhotelContext,
    expected: { action: "answer_context", responseIncludes: "CIF de MURHOTEL SL", responseIncludes2: "Teléfono o email de Alberto Ruiz" }
  },
  {
    name: "pronombre dimelos lista campos concretos",
    message: "Dímelos",
    context: murhotelContext,
    expected: { action: "answer_context", responseIncludes: "CIF de MURHOTEL SL", responseIncludes2: "60.000" }
  },
  {
    name: "pregunta importe conserva dato guardado",
    message: "cuánto era?",
    context: murhotelContext,
    expected: { action: "answer_context", responseIncludes: "60.000" }
  },
  {
    name: "pregunta cliente distingue contacto y facturacion",
    message: "como se llama el cliente?",
    context: murhotelContext,
    expected: { action: "answer_context", responseIncludes: "Contacto: Alberto Ruiz", responseIncludes2: "Cliente de facturación: MURHOTEL SL" }
  },
  {
    name: "aparcar tarea activa",
    message: "déjalo pendiente",
    context: murhotelContext,
    expected: { action: "park_task", activeStatus: undefined, parkedStatus: "aparcado" }
  },
  {
    name: "nuevo chat limpia contexto activo sin borrar tarea",
    message: "nuevo chat",
    context: murhotelContext,
    expected: { action: "clear_context", activeStatus: undefined, parkedStatus: "aparcado" }
  },
  {
    name: "nuevo chat con tarea ya aparcada no cae a fallback",
    message: "nuevo chat",
    context: murhotelParkedContext,
    expected: { action: "clear_context", activeStatus: undefined, parkedStatus: "aparcado", responseIncludes: "Mantengo aparcado" }
  },
  {
    name: "volver a tarea aparcada",
    message: "volver al presupuesto de MURHOTEL",
    context: murhotelParkedContext,
    expected: { action: "resume_task", activeStatus: "activo", parkedStatus: undefined, responseIncludes: "MURHOTEL SL" }
  },
  {
    name: "completar tarea aparcada con datos fiscales no crea presupuesto nuevo",
    message: "b82837238 Calle francesc Frontera n13 3A. La obra es en florencio n13, seran 60 mil euros + IVA",
    context: murhotelParkedContext,
    expected: { action: "complete_budget", activeStatus: "activo", parkedStatus: undefined, ivaMode: "plus", workAddress: "Florencio N13", amount: 60000 }
  },
  {
    name: "frase ya te lo he dado no inventa nif ni direccion",
    message: "el cif y la direccion fiscal ya te lo he dado",
    context: murhotelContext,
    expected: { action: "ask_pending", amount: undefined }
  },
  {
    name: "quiero verlo aqui muestra pdf del ultimo documento",
    message: "quiero verlo aqui",
    context: createLastDocumentContext({
      documentType: "budget",
      documentId: "budget_murhotel",
      clientId: "client_murhotel",
      workId: "work_menorca",
      clientName: "MURHOTEL SL"
    }),
    expected: { action: "generate_pdf" }
  },
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
    name: "registrar visita sin convertir hora en importe",
    message: "he tenido una visita con Laura referente a la obra completa, hemos revisado los materiales y me tiene que confirmar, la visita ha sido a las 17H",
    context: {},
    expected: { action: "register_activity", clientName: "Laura", eventTime: "17:00", amount: undefined }
  },
  {
    name: "respuesta corta completa visita anterior",
    message: "mañana a las 10",
    context: engine.createActivityCompletionContext({
      clientId: "client_laura",
      workId: "work_obra_completa",
      eventId: "event_visita_laura",
      clientName: "Laura"
    }),
    expected: { action: "complete_activity", reminderDateHint: "tomorrow", reminderTime: "10:00" }
  },
  {
    name: "gasto real con material e importe",
    message: "Apunta 86 euros de material para la obra de Juan.",
    context: {},
    expected: { action: "register_expense", amount: 86 }
  },
  {
    name: "seguimiento preparado sin envio real",
    message: "Mándale un toque a Marta por el presupuesto mañana a las 10.",
    context: {},
    expected: { action: "create_reminder", clientName: "Marta", reminderDateHint: "tomorrow", reminderTime: "10:00" }
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
    eventTime: result.entities?.eventTime,
    reminderDateHint: result.entities?.reminderDateHint,
    reminderTime: result.entities?.reminderTime,
    clientName: result.entities?.clientName,
    amount: result.entities?.amount,
    invoiceStatus: result.entities?.invoiceStatus,
    activeStatus: result.context?.activeTask?.status,
    parkedStatus: result.context?.parkedTask?.status,
    responseIncludes: item.expected.responseIncludes ? result.response?.includes(item.expected.responseIncludes) : undefined,
    responseIncludes2: item.expected.responseIncludes2 ? result.response?.includes(item.expected.responseIncludes2) : undefined
  };
  const failed = Object.entries(item.expected).filter(([key, value]) => {
    if (key === "responseIncludes" || key === "responseIncludes2") return checks[key] !== true;
    return checks[key] !== value;
  });
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
