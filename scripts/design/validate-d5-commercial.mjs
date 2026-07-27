import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const work = read("app/(app)/obras/[id]/page.tsx");
const budget = read("app/(app)/presupuestos/[id]/page.tsx");
const preview = read("components/budget-live-preview.tsx");
const invoice = read("app/(app)/dinero/[id]/page.tsx");
const treasury = read("components/economic-control-center.tsx");
const provisioner = read("scripts/readiness/provision-continuous-review.ts");
const results = [];

function test(name, check) {
  check();
  results.push(name);
}

test("Trabajo 360 muestra estado real sin inventar porcentaje físico", () => {
  assert.match(work, /label="Estado real"/);
  assert.match(work, /Sin porcentaje físico inventado/);
  assert.doesNotMatch(work, /\d+\s*%\s*completado/);
});
test("Trabajo 360 conserva hitos, evidencia, bloqueos, actividad y próxima acción", () => {
  for (const term of ["WorkLifecycleRail", "Evidencia", "Riesgos", "Actividad reciente", "Próxima acción"]) assert.match(work, new RegExp(term));
});
test("Coste previsto, real y margen sólo aparecen en la rama económica autorizada", () => {
  for (const term of ["Coste previsto", "Coste real", "Margen autorizado", "fullEconomicAccessHere"]) assert.match(work, new RegExp(term));
  assert.ok(work.indexOf("fullEconomicAccessHere") < work.indexOf("Margen autorizado"));
});
test("Presupuesto mantiene autorización scoped y acciones existentes", () => {
  for (const term of ["assertScopedEntityAccess", "budgetDecisionAllowed", "sales.pricing.view", "updateBudgetStatus"]) assert.match(budget, new RegExp(term));
});
test("Presupuesto ofrece Guardar borrador y Revisar y enviar con confirmación", () => {
  assert.match(budget, /Guardar borrador/);
  assert.match(budget, /Revisar y enviar/);
  assert.match(budget, /ConfirmSubmitButton/);
});
test("Editor muestra partidas semánticas y nunca el JSON interno", () => {
  assert.match(budget, /BudgetLineFields/);
  assert.match(budget, /Edita cantidades y precios sin exponer el formato interno/);
  assert.doesNotMatch(preview, /JSON\.stringify|<pre|partidas:/);
});
test("Preview viva reacciona a inputs y explica que el PDF oficial no cambia", () => {
  assert.match(preview, /addEventListener\("input"/);
  assert.match(preview, /Vista previa viva del presupuesto/);
  assert.match(preview, /El PDF oficial conserva su generador, numeración y cálculos existentes/);
});
test("Presupuesto conserva datos pendientes, margen y PDF", () => {
  for (const term of ["Datos pendientes antes de enviar", "Margen", "Vista previa PDF", "Descargar PDF"]) assert.match(budget, new RegExp(term));
});
test("Factura calcula visualmente el cobro desde total y pendiente registrados", () => {
  assert.match(invoice, /const collected = Math\.max\(0, invoice\.total - invoice\.pendiente\)/);
  assert.match(invoice, /role="progressbar"/);
  for (const term of ["Cobrado", "Pendiente", "Vencimiento"]) assert.match(invoice, new RegExp(term));
});
test("Factura conserva pagos parciales y añade compromisos y recordatorios reales", () => {
  for (const relation of ["payments:", "reminders:", "agendaEvents:"]) assert.match(invoice, new RegExp(relation));
  assert.match(invoice, /Historial y compromisos/);
  assert.match(invoice, /Todavía no hay pagos, recordatorios ni promesas de pago registradas/);
});
test("Factura separa cobro, PDF y estado fiscal", () => {
  assert.match(invoice, /Cobro y fiscalidad separados/);
  assert.match(invoice, /Documento y estado fiscal/);
  assert.match(invoice, /fiscalDocuments:/);
  assert.match(invoice, /Vista PDF/);
});
test("Factura conserva confirmación humana y permisos de cobro", () => {
  for (const term of ["ConfirmedPaymentForm", "confirmadoPorUsuario", "treasury.collections.register", "canCollect"]) assert.match(invoice, new RegExp(term));
});
test("Tesorería muestra las cuatro cifras del contrato D5", () => {
  for (const term of ["Caja registrada", "Por cobrar", "Por pagar", "Flujo previsto"]) assert.match(treasury, new RegExp(term));
});
test("Tesorería conserva calendario, movimientos y trazabilidad", () => {
  for (const term of ["Calendario de caja", "Movimientos recientes", "documento que origina cada cifra", "TreasuryRegistration"]) assert.match(treasury, new RegExp(term));
});
test("Tesorería declara explícitamente que no inventa saldos ni previsiones", () => {
  for (const term of ["No se inventa posición bancaria", "Sólo vencimientos documentados", "no se inventan saldos bancarios"]) assert.match(treasury, new RegExp(term, "i"));
});
test("Review contiene fixture parcial, recordatorio y compromiso sin provider real", () => {
  for (const id of ["review-payment-1", "review-invoice-reminder-1", "review-invoice-promise-1"]) assert.match(provisioner, new RegExp(id));
  assert.match(provisioner, /sin comunicación ni proveedor real/i);
});

console.log(`[design-d5] ${results.length}/${results.length}`);
for (const name of results) console.log(`[design-d5] OK ${name}`);
