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
    text: "qué tenemos pendiente",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "qué tareas pendientes tengo",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "resumen de pendientes",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "dime qué tengo pendiente",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "dime qué tenemos pendiente",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "cuántas cosas tengo pendientes",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "qué queda por hacer",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "cuántas tareas pendientes tengo",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "ver pendientes",
    expected: { kind: "pending_summary", action: "pending_summary" }
  },
  {
    text: "enséñame los presupuestos",
    expected: { kind: "pending_details", action: "pending_detail", detailCategory: "budgets" }
  },
  {
    text: "qué facturas son",
    expected: { kind: "pending_details", action: "pending_detail", detailCategory: "invoices" }
  },
  {
    text: "detállame los seguimientos",
    expected: { kind: "pending_details", action: "pending_detail", detailCategory: "followups" }
  },
  {
    text: "¿Cuál es el presupuesto más alto?",
    expected: { kind: "aggregate_query", action: "highest_budget" }
  },
  {
    text: "qué presupuesto tiene mayor importe",
    expected: { kind: "aggregate_query", action: "highest_budget", clientName: undefined }
  },
  {
    text: "cuál tiene más importe",
    expected: { kind: "aggregate_query", action: "highest_budget", clientName: undefined }
  },
  {
    text: "máximo presupuesto",
    expected: { kind: "aggregate_query", action: "highest_budget", clientName: undefined }
  },
  {
    text: "cuál es el presupuesto más bajo",
    expected: { kind: "aggregate_query", action: "lowest_budget" }
  },
  {
    text: "cuál es el último presupuesto",
    expected: { kind: "database_query", action: "latest_budget" }
  },
  {
    text: "cuál es la factura más grande",
    expected: { kind: "aggregate_query", action: "highest_invoice" }
  },
  {
    text: "cuánto me deben",
    expected: { kind: "aggregate_query", action: "outstanding_invoices" }
  },
  {
    text: "cuánto tengo pendiente de cobrar",
    expected: { kind: "aggregate_query", action: "outstanding_invoices" }
  },
  {
    text: "cuántas facturas tengo pendientes de cobro",
    expected: { kind: "aggregate_query", action: "pending_invoices_count" }
  },
  {
    text: "qué cliente me debe más",
    expected: { kind: "comparison_query", action: "client_highest_debt" }
  },
  {
    text: "quién me debe más",
    expected: { kind: "comparison_query", action: "client_highest_debt" }
  },
  {
    text: "cliente con mayor deuda",
    expected: { kind: "comparison_query", action: "client_highest_debt" }
  },
  {
    text: "cuánto he facturado este mes",
    expected: { kind: "aggregate_query", action: "revenue_summary", period: "this_month" }
  },
  {
    text: "cuánto he gastado esta semana",
    expected: { kind: "aggregate_query", action: "expenses_summary", period: "this_week" }
  },
  {
    text: "cuánto he gastado este mes",
    expected: { kind: "aggregate_query", action: "expenses_summary", period: "this_month" }
  },
  {
    text: "compara facturación frente a gastos de este mes",
    expected: { kind: "comparison_query", period: "this_month" }
  },
  {
    text: "qué obras están activas",
    expected: { kind: "database_query", action: "active_projects" }
  },
  {
    text: "qué presupuesto tiene Juana",
    expected: { kind: "database_query", action: "client_budgets", clientName: "Juana" }
  },
  {
    text: "qué facturas están vencidas",
    expected: { kind: "database_query", action: "overdue_invoices" }
  },
  {
    text: "dime cuáles son las facturas pendientes",
    expected: { kind: "pending_details", action: "pending_detail", detailCategory: "invoices" }
  },
  {
    text: "cuánto ha pagado Laura",
    expected: { kind: "aggregate_query", action: "client_payments", clientName: "Laura" }
  },
  {
    text: "qué clientes no tienen CIF",
    expected: { kind: "database_query", action: "clients_missing_tax_id" }
  },
  {
    text: "cuál es la obra con más gastos",
    expected: { kind: "aggregate_query", action: "project_highest_expenses" }
  },
  {
    text: "¿cuál es el presupuesto de 60000?",
    expected: { kind: "database_query", action: "budget_by_amount", amount: 60000, clientName: undefined }
  },
  {
    text: "crea un presupuesto para Juan por 1000 euros",
    expected: { kind: "create" }
  },
  {
    text: "quiero ver el último presupuesto",
    expected: { kind: "navigation" }
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
