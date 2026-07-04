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
  const sandbox = { exports: {}, require: requireOverride, console, Intl };
  vm.runInNewContext(compiled, sandbox, { filename: path });
  return sandbox.exports;
}

const rules = compileModule("lib/chat-conversation-rules.ts");
const parser = compileModule("lib/capataz-chat-parser.ts");
const engine = compileModule("lib/capataz-chat-engine.ts", (id) => {
  if (id === "@/lib/capataz-chat-parser") return parser;
  return nativeRequire(id);
});

const now = new Date("2026-07-04T10:00:00.000Z").getTime();
const cases = [
  {
    name: "inactividad mayor de cinco minutos crea nuevo chat",
    ok: rules.shouldCreateNewConversation(now - rules.CHAT_INACTIVITY_MS - 1, now) === true
  },
  {
    name: "actividad menor de cinco minutos restaura chat",
    ok: rules.shouldCreateNewConversation(now - rules.CHAT_INACTIVITY_MS + 1, now) === false
  },
  {
    name: "historial oculta conversaciones vacias",
    ok: rules.shouldShowConversationInHistory(0, false) === false && rules.shouldShowConversationInHistory(1, false) === true
  },
  {
    name: "anti race rechaza carga vieja",
    ok: rules.canApplyConversationLoad("new", "old", 1, 1) === false && rules.canApplyConversationLoad("new", "new", 1, 2) === false
  },
  {
    name: "saludo sin tarea activa no menciona tareas antiguas",
    ok: (() => {
      const result = engine.planChatMessage("Hola", {});
      return result.action === "answer_context" && /dime que necesitas|dime qué necesitas/i.test(result.response) && !/pendiente|presupuesto/i.test(result.response);
    })()
  },
  {
    name: "dimelos sin tarea activa no inventa datos",
    ok: (() => {
      const result = engine.planChatMessage("Dímelos", {});
      return result.action === "answer_context" && /No tengo una tarea activa/i.test(result.response);
    })()
  },
  {
    name: "tarea aparcada no se retoma con datos sueltos",
    ok: (() => {
      const context = engine.createBudgetCompletionContext({
        clientId: "client",
        workId: "work",
        budgetId: "budget",
        clientName: "Cliente de prueba",
        pendingFields: ["iva", "direccion_obra"],
        draftData: { amount: 60000 }
      });
      const parked = { ...context, activeTask: undefined, parkedTask: { ...context.activeTask, status: "aparcado" } };
      const result = engine.planChatMessage("con IVA incluido", parked);
      return result.source !== "context" || result.action !== "complete_budget";
    })()
  }
];

let failures = 0;
for (const item of cases) {
  if (item.ok) {
    console.log("[chat-conversations] OK", item.name);
  } else {
    failures += 1;
    console.error("[chat-conversations] FAIL", item.name);
  }
}

if (failures) process.exit(1);
