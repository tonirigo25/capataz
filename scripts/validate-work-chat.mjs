import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/capataz-chat-query.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const sandbox = { exports: {}, require, console };
vm.runInNewContext(compiled, sandbox);
const { classifyChatIntent } = sandbox.exports;

const cases = [
  ["crea una obra", { kind: "create" }],
  ["abre la obra", { kind: "navigation" }],
  ["qué obras están paradas", { kind: "database_query", action: "paused_projects" }],
  ["qué obras están en curso", { kind: "database_query", action: "active_projects" }],
  ["qué obra factura más", { kind: "aggregate_query", action: "work_highest_revenue" }],
  ["qué obra gasta más", { kind: "aggregate_query", action: "project_highest_expenses" }],
  ["qué obra tiene menos margen", { kind: "aggregate_query", action: "work_lowest_margin" }],
  ["qué obras empiezan esta semana", { kind: "database_query", action: "works_starting_this_week" }],
  ["qué obras terminan hoy", { kind: "database_query", action: "works_ending_today" }]
];

for (const [text, expected] of cases) {
  const actual = classifyChatIntent(text);
  const ok = Object.entries(expected).every(([key, value]) => actual[key] === value);
  if (!ok) {
    console.error("[work-chat] FAIL", text);
    console.error("expected subset:", expected);
    console.error("actual:", actual);
    process.exit(1);
  }
  if (expected.kind !== "create" && expected.kind !== "navigation" && actual.kind === "create") {
    console.error("[work-chat] FAIL query classified as create", text, actual);
    process.exit(1);
  }
  console.log("[work-chat] OK", text);
}
