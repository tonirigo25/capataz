import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("app/(app)/oportunidades/page.tsx", "utf8");

test("opportunity values resolve the independent pricing scope", () => {
  assert.match(source, /resolveScopedEntityIds\(auth, "sales\.pricing\.view", "Work"\)/);
  assert.match(source, /resolveScopedEntityIds\(auth, "sales\.pricing\.view", "Client"\)/);
  assert.match(source, /pricingDecision\.scope,[\s\S]*?pricingWorkIds,[\s\S]*?pricingClientIds/);
});

test("aggregates and rows only expose individually authorized prices", () => {
  assert.match(source, /canSeeBudgetPricing\(budget\) \? budget\.total : 0/);
  assert.match(source, /canSeePricing=\{canSeeBudgetPricing\(budget\)\}/);
  assert.match(source, /canSeeBudgetPricing\(budget\) \? formatCurrency\(budget\.total\) : "Restringido"/);
});
