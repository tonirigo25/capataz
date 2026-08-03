import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync("lib/portal/today-overview.ts", "utf8");
const recommendation = readFileSync("lib/application/intelligence/today-recommendation.ts", "utf8");

test("Hoy combina scope Document, tenant y clasificaciones del PortalManifest", () => {
  assert.match(overview, /buildPortalManifest\(context\)/);
  assert.match(overview, /companyId,/);
  assert.match(overview, /id: \{ in: documentIds \}/);
  assert.match(overview, /classification: \{ in: documentManifest\?\.documentClasses \?\? \[\] \}/);
});

test("las recomendaciones de facturas resuelven scopes comerciales independientes", () => {
  assert.match(recommendation, /resolveScopedEntityIds\(context, "sales\.invoices\.view", "Work"\)/);
  assert.match(recommendation, /resolveScopedEntityIds\(context, "sales\.invoices\.view", "Client"\)/);
  assert.match(recommendation, /financialScopeWhere\("invoice", invoiceScopes\)/);
  assert.match(recommendation, /relationScopeAllows\(item, invoiceScopes\)/);
});

test("las recomendaciones de presupuestos resuelven scopes comerciales independientes", () => {
  assert.match(recommendation, /resolveScopedEntityIds\(context, "sales\.budgets\.view", "Work"\)/);
  assert.match(recommendation, /resolveScopedEntityIds\(context, "sales\.budgets\.view", "Client"\)/);
  assert.match(recommendation, /financialScopeWhere\("budget", budgetScopes\)/);
  assert.match(recommendation, /relationScopeAllows\(item, budgetScopes\)/);
});

test("el filtro conserva companyId y no aplica work o clients genéricos a entidades financieras", () => {
  assert.match(recommendation, /companyId: context\.companyId/);
  assert.match(recommendation, /if \(!financialKind && item\.workId/);
  assert.match(recommendation, /if \(!financialKind && item\.clientId/);
});
