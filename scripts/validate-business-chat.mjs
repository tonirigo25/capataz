import fs from "node:fs";
import { expect, loadTsModule } from "./ts-test-loader.mjs";

const { classifyChatIntent } = loadTsModule("lib/capataz-chat-query.ts");

const cases = [
  ["cómo va mi negocio", { kind: "aggregate_query", action: "business_health", period: "this_month" }],
  ["cuánto he cobrado este mes", { kind: "aggregate_query", action: "business_collected", period: "this_month" }],
  ["cuánto tengo pendiente de cobrar", { kind: "aggregate_query", action: "business_outstanding" }],
  ["cuánto tengo vencido", { kind: "aggregate_query", action: "business_overdue", period: "this_month" }],
  ["cuánto beneficio tengo este mes", { kind: "aggregate_query", action: "business_profit", period: "this_month" }],
  ["cuál es mi margen este mes", { kind: "aggregate_query", action: "business_margin", period: "this_month" }],
  ["qué obra es más rentable", { kind: "aggregate_query", action: "business_best_work" }],
  ["qué cliente tarda más en pagar", { kind: "aggregate_query", action: "business_slowest_client" }],
  ["cuál es la conversión de presupuestos", { kind: "aggregate_query", action: "business_quote_conversion", period: "this_month" }],
  ["compárame este mes con el anterior", { kind: "comparison_query", action: "business_compare_periods", period: "this_month" }],
  ["qué debería revisar", { kind: "database_query", action: "business_review_today", period: "this_month" }]
];

for (const [text, expected] of cases) {
  const result = classifyChatIntent(text);
  const ok = Object.entries(expected).every(([key, value]) => result[key] === value);
  expect(ok, `[business-chat] bad classification for "${text}"`, { expected, result });
}

const actionsSource = fs.readFileSync("app/(app)/capataz/actions.ts", "utf8");
for (const action of [
  "business_health",
  "business_collected",
  "business_outstanding",
  "business_overdue",
  "business_profit",
  "business_margin",
  "business_best_work",
  "business_slowest_client",
  "business_quote_conversion",
  "business_compare_periods",
  "business_review_today"
]) {
  expect(actionsSource.includes(`case "${action}"`), `[business-chat] missing action handler for ${action}`);
}

expect(actionsSource.includes("getBusinessIntelligenceSummary"), "[business-chat] chat actions must use the central BI summary");
expect(actionsSource.includes("noMutation: true"), "[business-chat] query diagnostics must preserve no-mutation flag");

console.log("[business-chat] OK BI query classification and routing");
