import { expect, loadTsModule } from "./ts-test-loader.mjs";

const { buildBusinessHealth } = loadTsModule("lib/business-intelligence.ts", {
  mocks: { "@/lib/prisma": { prisma: {} } }
});

const empty = buildBusinessHealth({
  invoiced: 0,
  collected: 0,
  expenses: 0,
  outstanding: 0,
  overdue: 0,
  negativeMarginWorks: 0,
  expiredBudgets: 0,
  debtConcentration: 0,
  dataIssueCount: 0,
  activityCount: 0
});
expect(!empty.canCalculate && empty.status === "sin_datos", "[business-health] empty activity must not produce a score", empty);

const healthy = buildBusinessHealth({
  invoiced: 10000,
  collected: 8500,
  expenses: 3000,
  outstanding: 1500,
  overdue: 0,
  negativeMarginWorks: 0,
  expiredBudgets: 0,
  debtConcentration: 20,
  dataIssueCount: 1,
  activityCount: 12
});
expect(healthy.canCalculate && healthy.score === 100 && healthy.status === "saludable", "[business-health] healthy input should score 100", healthy);

const risky = buildBusinessHealth({
  invoiced: 10000,
  collected: 4000,
  expenses: 9500,
  outstanding: 6000,
  overdue: 3500,
  negativeMarginWorks: 2,
  expiredBudgets: 2,
  debtConcentration: 60,
  dataIssueCount: 7,
  activityCount: 20
});
expect(risky.canCalculate && risky.status === "riesgo", "[business-health] risky input should be classified as risk", risky);
expect(risky.score < 50, "[business-health] risky score should be below 50", risky);
expect(risky.factors.length >= 5, "[business-health] risky health should expose deterministic factors", risky);

console.log("[business-health] OK health index boundaries");
