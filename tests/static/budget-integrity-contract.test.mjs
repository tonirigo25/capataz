import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const listPage = read("app/(app)/presupuestos/page.tsx");
const detailPage = read("app/(app)/presupuestos/[id]/page.tsx");
const templatesPage = read("app/(app)/presupuestos/plantillas/page.tsx");
const financeUseCases = read("lib/application/finance/budget-use-cases.ts");
const managementUseCases = read("lib/application/operations/management-use-cases.ts");
const pdfRoute = read("app/(app)/presupuestos/[id]/pdf/route.ts");

test("presupuestos accepts legacy filter aliases and preserves list return paths", () => {
  assert.match(listPage, /query\.filtro \?\? query\.estado/);
  assert.match(listPage, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(detailPage, /normalizeLoginReturnPath\(query\.returnTo \?\? "\/presupuestos"\)/);
});

test("budget creation is server-authoritative and validates client-work relationships", () => {
  assert.match(managementUseCases, /company\.defaultVat/);
  assert.match(managementUseCases, /const \{ subtotal, iva, descuento, total \} = totals/);
  assert.match(managementUseCases, /BUDGET_WORK_CLIENT_MISMATCH/);
  assert.match(financeUseCases, /work\.clienteId !== clienteId/);
});

test("irreversible budget actions fail closed on unreconciled totals", () => {
  assert.match(financeUseCases, /assertBudgetRecordReconciled/);
  assert.match(pdfRoute, /BUDGET_TOTALS_MISMATCH/);
  assert.match(pdfRoute, /status: 409/);
  assert.match(detailPage, /Importes pendientes de reconciliar/);
  assert.match(detailPage, /¿Eliminar la partida/);
});

test("template catalog has one gated creation path and no duplicate submit bypass", () => {
  assert.equal((templatesPage.match(/action=\{createBudgetFromTemplate\}/g) ?? []).length, 1);
  assert.doesNotMatch(templatesPage, /Duplicar plantilla como presupuesto/);
  assert.match(templatesPage, /DemoLimitButton/);
});

test("sent status is explicitly a state change, not a transmission", () => {
  assert.doesNotMatch(detailPage, /Revisar y enviar/);
  assert.match(detailPage, /no transmite correo ni PDF/);
  assert.match(listPage, /Revisar presupuesto/);
});
