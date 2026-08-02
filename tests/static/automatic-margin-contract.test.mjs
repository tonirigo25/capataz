import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

test("budget margin is derived from line costs on the server", () => {
  const source = read("lib/budget-lines.ts");
  assert.match(source, /export function calculateBudgetMargin/);
  assert.match(source, /revenue - cost/);
  assert.match(source, /missingCostLines/);
});

test("manual margin inputs are absent from work and budget forms", () => {
  const management = read("app/(app)/gestion/page.tsx");
  const chat = read("components/capataz-chat.tsx");
  assert.doesNotMatch(management, /name="margenEstimado"/);
  assert.doesNotMatch(chat, /name="margenEstimado"/);
  assert.match(management, /Margen previsto.*Calculado|CalculatedValue/);
});

test("budget line editor captures costs and shows the automatic result", () => {
  const detail = read("app/(app)/presupuestos/[id]/page.tsx");
  const preview = read("components/budget-live-preview.tsx");
  assert.match(detail, /name="costeUnitario"/);
  assert.match(detail, /Margen calculado/);
  assert.match(preview, /margen calculado/);
});

test("work profitability no longer falls back to a stored manual margin", () => {
  const works = read("lib/works.ts");
  assert.doesNotMatch(works, /budgeted\s*-\s*safeNumber\(work\.margenEstimado\)/);
  assert.match(works, /forecastBenefit\s*=\s*budgeted\s*-\s*forecastCost/);
});

test("approval authority receives a derived percentage", () => {
  const budgets = read("lib/application/finance/budget-use-cases.ts");
  const management = read("lib/application/operations/management-use-cases.ts");
  assert.match(budgets, /marginPercent:\s*margin\.percent/);
  assert.match(management, /marginPercent:.*requiredCanonicalMargin/);
  assert.doesNotMatch(management, /marginPercent:\s*number\(formData,\s*"margenEstimado"\)/);
});
