import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/capataz-chat-query.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const sandbox = { exports: {}, require, console };
vm.runInNewContext(compiled, sandbox);

const { classifyChatIntent } = sandbox.exports;

const cases = [
  {
    text: "qué tareas pendientes tengo",
    expected: { kind: "pending", action: "pending_summary" }
  },
  {
    text: "resumen de pendientes",
    expected: { kind: "pending", action: "pending_summary" }
  },
  {
    text: "dime qué tengo pendiente",
    expected: { kind: "pending", action: "pending_summary" }
  },
  {
    text: "cuántas cosas tengo pendientes",
    expected: { kind: "pending", action: "pending_summary" }
  },
  {
    text: "enséñame los presupuestos",
    expected: { kind: "pending_detail", action: "pending_detail", detailCategory: "budgets" }
  },
  {
    text: "qué facturas son",
    expected: { kind: "pending_detail", action: "pending_detail", detailCategory: "invoices" }
  },
  {
    text: "detállame los seguimientos",
    expected: { kind: "pending_detail", action: "pending_detail", detailCategory: "followups" }
  },
  {
    text: "¿Cuál es el presupuesto más alto?",
    expected: { kind: "aggregate", action: "highest_budget" }
  },
  {
    text: "cuál es la factura más grande",
    expected: { kind: "aggregate", action: "highest_invoice" }
  },
  {
    text: "cuánto me deben",
    expected: { kind: "aggregate", action: "outstanding_invoices" }
  },
  {
    text: "cuánto he facturado este mes",
    expected: { kind: "aggregate", action: "revenue_summary", period: "this_month" }
  },
  {
    text: "cuánto he gastado esta semana",
    expected: { kind: "aggregate", action: "expenses_summary", period: "this_week" }
  },
  {
    text: "qué obras están activas",
    expected: { kind: "query", action: "active_projects" }
  },
  {
    text: "qué presupuesto tiene Juana",
    expected: { kind: "query", action: "client_budgets", clientName: "Juana" }
  },
  {
    text: "qué facturas están vencidas",
    expected: { kind: "query", action: "overdue_invoices" }
  },
  {
    text: "cuánto ha pagado Laura",
    expected: { kind: "aggregate", action: "client_payments", clientName: "Laura" }
  },
  {
    text: "qué clientes no tienen CIF",
    expected: { kind: "query", action: "clients_missing_tax_id" }
  },
  {
    text: "cuál es la obra con más gastos",
    expected: { kind: "aggregate", action: "project_highest_expenses" }
  },
  {
    text: "crea un presupuesto para Juan por 1000 euros",
    expected: { kind: "create" }
  }
];

let failed = 0;
for (const item of cases) {
  const result = classifyChatIntent(item.text);
  const ok = Object.entries(item.expected).every(([key, value]) => result[key] === value);
  if (!ok) {
    failed += 1;
    console.error("[chat-query] FAIL", item.text);
    console.error("expected subset:", item.expected);
    console.error("actual:", result);
  } else {
    console.log("[chat-query] OK", item.text);
  }
}

if (failed) process.exit(1);
