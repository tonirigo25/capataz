import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const documents = read("app/(app)/documentos/page.tsx");
const reader = read("app/(app)/gastos-materiales/lector/[id]/page.tsx");
const expenseUseCases = read("lib/application/finance/expense-use-cases.ts");
const expenseDocument = read("lib/expense-document.ts");
const storage = read("lib/document-storage.ts");
const partners = read("components/procurement-partners.tsx");
const invoices = read("components/purchase-invoices.tsx");
const procurement = read("lib/procurement.ts");
const treasury = read("lib/treasury.ts");
const provisioner = read("scripts/readiness/provision-continuous-review.ts");
const results = [];

function test(name, check) {
  check();
  results.push(name);
}

test("Documentos integra bandeja, original y revisión en tres paneles", () => {
  for (const term of ["Bandeja documental", "Documento original", "Datos extraídos", "lg:grid-cols-[17rem_minmax(0,1fr)_21rem]"]) assert.ok(documents.includes(term), `Falta ${term}`);
});
test("Documentos conserva la secuencia móvil por apilado responsivo", () => {
  assert.match(documents, /lg:grid lg:min-h/);
  assert.doesNotMatch(documents, /overflow-x-auto[^]*Documento original/);
});
test("La bandeja representa todos los estados D6 en lenguaje de producto", () => {
  for (const state of ["UPLOADED", "PROCESSING", "REVIEW_REQUIRED", "POSSIBLE_DUPLICATE", "READY", "REGISTERED", "FAILED"]) assert.match(documents, new RegExp(state));
});
test("La extracción sigue siendo propuesta y exige confirmación humana", () => {
  assert.match(documents, /La extracción es una propuesta/);
  assert.match(reader, /name="confirmed" value="yes"/);
  assert.match(expenseUseCases, /confirmed.*!== "yes"/);
});
test("La carga valida tamaño, extensión, MIME, firma binaria y hash", () => {
  for (const token of ["MAX_EXPENSE_DOCUMENT_BYTES", "sniffExpenseDocumentMime", "browserMime", "sha256"]) assert.match(expenseDocument, new RegExp(token));
});
test("La carga usa cuarentena privada y promoción atómica", () => {
  assert.match(storage, /\.quarantine/);
  assert.match(storage, /writeFile\(quarantine/);
  assert.match(storage, /rename\(quarantine, target\)/);
  assert.match(storage, /rm\(quarantine, \{ force: true \}\)/);
});
test("Los documentos se aíslan con companyId derivado de sesión", () => {
  assert.match(expenseUseCases, /requireCapability\("purchases\.received_invoices\.manage"\)/);
  assert.match(expenseUseCases, /companyId: context\.companyId/);
  assert.doesNotMatch(expenseUseCases, /text\(formData, "companyId"\)/);
});
test("Los duplicados se detectan por hash y por factura/emisor dentro del tenant", () => {
  assert.match(expenseUseCases, /\{ sha256: document\.sha256 \}/);
  assert.match(expenseUseCases, /extractedInvoiceNo[\s\S]*extractedIssuerTaxId/);
  assert.match(expenseUseCases, /companyId,[\s\S]*AND: \[\{ OR: or \}\]/);
});
test("Proveedores ofrece vistas inteligentes de proveedores, subcontratas y documentación", () => {
  for (const term of ["Vistas inteligentes de compras", "Proveedores ·", "Subcontratas ·", "Documentación ·"]) assert.match(partners, new RegExp(term));
});
test("La tabla de compras muestra especialidad, documentación, trabajos, saldo y próxima acción", () => {
  for (const term of ["Especialidad y documentación", "Trabajos", "Saldo", "Próxima acción", "partnerNextAction"]) assert.match(partners, new RegExp(term));
});
test("Proveedores incluye preview contextual sin convertir cada fila en CTA primaria", () => {
  assert.match(partners, /data-d6-supplier-context/);
  assert.match(partners, /Contexto/);
  assert.doesNotMatch(partners, /className="primary-button mt-3 w-full">Abrir ficha/);
});
test("Facturas recibidas muestra revisión, pago, vencido e imputación calculada", () => {
  for (const term of ["Pendiente revisar", "Pendiente", "Vencido", "Imputado a trabajos", "attributedPercent"]) assert.match(invoices, new RegExp(term));
});
test("Facturas recibidas incluye vistas de revisión, pendientes, vencidas y pagadas", () => {
  for (const term of ["Revisión ·", "Pendientes ·", "Vencidas ·", "Pagadas ·"]) assert.match(invoices, new RegExp(term));
});
test("El detalle conserva base, IVA, retención, total, vencimiento y pagos parciales", () => {
  for (const term of ["Base imponible", "IVA", "IRPF", "Total", "Vencimiento", "Pagos parciales"]) assert.match(invoices, new RegExp(term));
});
test("Factura recibida enlaza un gasto único y lo declara sin doble salida", () => {
  assert.match(invoices, /Gasto enlazado/);
  assert.match(invoices, /No se registra una segunda salida/);
  assert.match(expenseUseCases, /purchaseInvoiceId,[\s\S]*tx\.expense\.create/);
});
test("Las fichas sintéticas sin binario no generan enlaces de descarga rotos", () => {
  assert.match(reader, /document\.storageKey \?/);
  assert.match(invoices, /document\.storageKey \?/);
});
test("La previsión enlaza la factura recibida que origina cada salida", () => {
  assert.match(read("lib/economic-control/metrics.ts"), /href: `\/facturas-proveedor\/\$\{invoice\.id\}`/);
});
test("Tesorería excluye la duplicación de salidas ya enlazadas", () => {
  assert.match(treasury, /purchaseInvoice\?\.pendingAmount \?\? expense\.importe/);
  assert.match(treasury, /cashMovements\.some\(\(movement\) => movement\.status !== "cancelled"\)/);
});
test("Las consultas de proveedores y facturas recibidas están aisladas por empresa", () => {
  assert.match(procurement, /where: \{[\s\S]*companyId,[\s\S]*kind/);
  assert.match(procurement, /purchaseInvoice\.findMany\(\{[\s\S]*companyId/);
});
test("Review contiene proveedor, subcontrata, factura parcial, gasto y estados documentales sintéticos", () => {
  for (const id of ["review-partner-1", "review-partner-2", "review-subcontractor-1", "review-purchase-invoice-1", "review-purchase-payment-1", "review-purchase-expense-1", "review-expense-document-1", "review-expense-document-duplicate-1"]) assert.match(provisioner, new RegExp(id));
});

console.log(`[design-d6] ${results.length}/${results.length}`);
for (const name of results) console.log(`[design-d6] OK ${name}`);
