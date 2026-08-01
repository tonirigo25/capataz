import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/(app)/tesoreria/page.tsx", "utf8");
const center = fs.readFileSync("components/economic-control-center.tsx", "utf8");
const css = fs.readFileSync("components/economic-control-center.module.css", "utf8");

test("Tesorería resuelve permisos de mutación antes de mostrar controles", () => {
  for (const capability of [
    "treasury.manage",
    "sales.invoices.create",
    "purchases.received_invoices.manage",
  ]) {
    assert.match(page, new RegExp(`resolveAuthorization\\(auth, "${capability.replaceAll(".", "\\.")}"\\)`));
  }
  assert.match(center, /canManage \? <div className=\{styles\.registration\}>/);
  assert.match(center, /!isSummary && canCreateInvoice/);
  assert.match(center, /!isSummary && canManagePurchases/);
  assert.match(center, /!isSummary && canManage \? <Link href="#treasury-registration"/);
});

test("El resumen conserva la composición compacta de Dinero", () => {
  assert.match(center, /const isSummary = data\.area === "resumen"/);
  assert.match(center, /<h1>\{isSummary \? "Dinero" : "Tesorería"\}<\/h1>/);
  assert.match(center, /\{!isSummary \? <nav className=\{styles\.tabs\}/);
  assert.match(center, /\{!isSummary \? <EconomicFilters data=\{data\} \/> : null\}/);
  assert.match(css, /\.summaryPage \.kpiStrip\s*\{[^}]*min-height:\s*150px/s);
  assert.match(css, /\.summaryPage \.primaryGrid\s*\{[^}]*1\.04fr[^}]*\.96fr/s);
});
