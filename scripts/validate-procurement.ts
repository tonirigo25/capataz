import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeExpenseExtraction } from "../lib/expense-document";
import { parsePurchaseAmounts, purchaseInvoiceStatus, validateSpanishTaxId } from "../lib/procurement";

const root = process.cwd();
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260717120000_procurement_management/migration.sql");
const actions = read("app/(app)/proveedores/actions.ts");
const readerActions = read("app/(app)/gastos-materiales/actions.ts");
const treasury = read("lib/treasury.ts");
const navigation = read("lib/product-navigation.ts");

assert.equal(validateSpanishTaxId(" B-12345678 ").normalized, "B12345678");
assert.equal(validateSpanishTaxId("B12345678").valid, true);
assert.equal(validateSpanishTaxId("X").valid, false);

assert.deepEqual(
  parsePurchaseAmounts({ taxableBase: "100", vatAmount: "21", withholdingAmount: "15", total: "106" }),
  { taxableBase: 100, vatAmount: 21, withholdingAmount: 15, total: 106 }
);
assert.throws(() => parsePurchaseAmounts({ taxableBase: "100", vatAmount: "21", withholdingAmount: "0", total: "999" }));
assert.equal(purchaseInvoiceStatus({ total: 121, paidAmount: 0, dueDate: new Date("2027-01-01") }, new Date("2026-07-17")), "PENDING");
assert.equal(purchaseInvoiceStatus({ total: 121, paidAmount: 20, dueDate: new Date("2027-01-01") }, new Date("2026-07-17")), "PARTIALLY_PAID");
assert.equal(purchaseInvoiceStatus({ total: 121, paidAmount: 121, dueDate: new Date("2020-01-01") }, new Date("2026-07-17")), "PAID");
assert.equal(purchaseInvoiceStatus({ total: 121, paidAmount: 0, dueDate: new Date("2020-01-01") }, new Date("2026-07-17")), "OVERDUE");

const classifications = [
  ["MATERIAL_INVOICE", "materiales"],
  ["FUEL_RECEIPT", "combustible"],
  ["MEAL_RECEIPT", "restauracion"],
  ["TOOL_INVOICE", "herramientas"],
  ["MACHINERY_INVOICE", "maquinaria"],
  ["TRANSPORT_INVOICE", "transportes"],
  ["SUBCONTRACTOR_INVOICE", "subcontrata"],
  ["SERVICE_INVOICE", "servicios"],
  ["SUPPLY_INVOICE", "suministros"],
  ["UNKNOWN", "otros"]
] as const;
for (const [documentType, expected] of classifications) {
  assert.equal(normalizeExpenseExtraction({ documentType }).suggestedCategory, expected);
}

for (const model of ["BusinessPartner", "PurchaseInvoice", "PurchaseInvoicePayment", "PartnerLearning"]) {
  assert.match(schema, new RegExp(`model ${model}`));
  assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
}
for (const scope of [
  "companyId: context.companyId",
  "companyId: context.companyId, kind",
  "businessPartnerId_workId",
  "updatePartnerLearning",
  "purchaseInvoiceId"
]) assert.ok(actions.includes(scope) || readerActions.includes(scope), `Falta control funcional: ${scope}`);

assert.ok(readerActions.includes('status: "REGISTERED"'));
assert.ok(readerActions.includes('"POSSIBLE_DUPLICATE"'));
assert.ok(readerActions.includes('"AWAITING_PARTNER"'));
assert.ok(readerActions.includes("getPartnerSuggestion(companyId"));
assert.ok(treasury.includes("purchaseInvoice?.pendingAmount ?? expense.importe"));
assert.ok(navigation.includes('href: "/proveedores"'));
assert.ok(navigation.includes('href: "/subcontratas"'));
assert.ok(navigation.includes('href: "/facturas-proveedor"'));
assert.ok(navigation.includes('href: "/facturas-subcontratas"'));

console.log(JSON.stringify({
  ok: true,
  cases: 32,
  coverage: [
    "fiscalidad_es",
    "clasificacion_documental",
    "pagos_y_estados",
    "aislamiento_companyId",
    "aprendizaje_por_empresa",
    "tesoreria_sin_duplicados",
    "navegacion_separada"
  ]
}));

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}
