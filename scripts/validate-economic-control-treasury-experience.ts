import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDueDateForecast, buildPayableDocuments, buildReceivableDocuments, ECONOMIC_PERIOD_DAYS, summarizeEconomicDocuments } from "../lib/economic-control/metrics";

const root = process.cwd();
const now = new Date("2026-07-18T10:00:00+02:00");
const date = (day: string) => new Date(`${day}T10:00:00+02:00`);
const results: string[] = [];
function test(name: string, check: () => void) { check(); results.push(name); }

const client = { id: "client-1", nombre: "Cliente Uno" };
const work = { id: "work-1", titulo: "Reforma Centro" };
const partner = { id: "partner-1", commercialName: "Proveedor Uno" };

test("los periodos públicos son exactamente 7, 30 y 90 días", () => assert.deepEqual(ECONOMIC_PERIOD_DAYS, { "7d": 7, "30d": 30, "90d": 90 }));
test("una factura emitida conserva documento, cliente y obra de origen", () => {
  const row = buildReceivableDocuments([{ id: "i1", numero: "F-1", concepto: "Trabajo", estado: "emitida", total: 1000, pagado: 0, fechaEmision: date("2026-07-01"), fechaVencimiento: date("2026-07-20"), client, work, payments: [] }])[0];
  assert.equal(row.href, "/dinero/i1"); assert.equal(row.partyId, client.id); assert.equal(row.workId, work.id);
});
test("los cobros parciales se deduplican mediante la fórmula existente", () => {
  const row = buildReceivableDocuments([{ id: "i2", numero: "F-2", concepto: "Trabajo", estado: "emitida", total: 1000, pagado: 200, fechaEmision: date("2026-07-01"), fechaVencimiento: date("2026-07-20"), client, work: null, payments: [{ id: "p1", importe: 300 }] }])[0];
  assert.equal(row.paid, 300); assert.equal(row.pending, 700);
});
test("un borrador no crea un cobro previsto", () => assert.equal(buildReceivableDocuments([{ id: "i3", numero: "BOR", concepto: "Borrador", estado: "borrador", total: 100, pagado: 0, fechaEmision: now, fechaVencimiento: now, client, work: null, payments: [] }]).length, 0));
test("una factura recibida anulada no crea salida", () => assert.equal(buildPayableDocuments([{ id: "pi0", invoiceNumber: "R-0", description: "Anulada", status: "VOID", total: 100, paidAmount: 0, issueDate: now, dueDate: now, voidedAt: now, businessPartner: partner, work: null, payments: [] }]).length, 0));
test("una factura totalmente cobrada no entra en pendiente ni previsión", () => { const rows = buildReceivableDocuments([{ id: "paid", numero: "F-P", concepto: "Cobrada", estado: "pagada", total: 100, pagado: 100, fechaEmision: now, fechaVencimiento: date("2026-07-20"), client, work: null, payments: [{ id: "p", importe: 100 }] }]); assert.equal(summarizeEconomicDocuments(rows, now).pending, 0); assert.equal(buildDueDateForecast(rows, "30d", null, now).future.length, 0); });
test("una factura recibida totalmente pagada no entra en pendiente", () => { const rows = buildPayableDocuments([{ id: "settled", invoiceNumber: "R-P", description: "Pagada", status: "PAID", total: 100, paidAmount: 100, issueDate: now, dueDate: date("2026-07-20"), voidedAt: null, businessPartner: partner, work: null, payments: [{ id: "pp", amount: 100 }] }]); assert.equal(summarizeEconomicDocuments(rows, now).pending, 0); });
test("un pago parcial de factura recibida conserva el saldo real", () => {
  const row = buildPayableDocuments([{ id: "pi1", invoiceNumber: "R-1", description: "Material", status: "PARTIALLY_PAID", total: 800, paidAmount: 250, issueDate: date("2026-07-01"), dueDate: date("2026-07-22"), voidedAt: null, businessPartner: partner, work, payments: [{ id: "pp1", amount: 250 }] }])[0];
  assert.equal(row.paid, 250); assert.equal(row.pending, 550); assert.equal(row.direction, "salida");
});
test("pagos repetidos por id no duplican importes", () => {
  const row = buildPayableDocuments([{ id: "pi2", invoiceNumber: "R-2", description: "Material", status: "PENDING", total: 500, paidAmount: 0, issueDate: now, dueDate: now, voidedAt: null, businessPartner: partner, work: null, payments: [{ id: "same", amount: 100 }, { id: "same", amount: 100 }] }])[0];
  assert.equal(row.paid, 100); assert.equal(row.pending, 400);
});
test("el gasto enlazado a factura recibida nunca duplica la salida", () => {
  const rows = buildPayableDocuments([], [{ id: "e1", proveedor: "Proveedor", concepto: "Material", importe: 500, fecha: now, paymentDueDate: now, paidAt: null, paymentStatus: "pending", purchaseInvoiceId: "pi1", businessPartner: partner, work }]);
  assert.equal(rows.length, 0);
});
test("un gasto independiente conserva trazabilidad y vencimiento", () => {
  const row = buildPayableDocuments([], [{ id: "e2", proveedor: "Proveedor", concepto: "Alquiler", importe: 300, fecha: now, paymentDueDate: date("2026-07-25"), paidAt: null, paymentStatus: "pending", purchaseInvoiceId: null, businessPartner: null, work: null }])[0];
  assert.equal(row.href, "/gastos-materiales"); assert.equal(row.pending, 300);
});

const docs = [
  ...buildReceivableDocuments([{ id: "due", numero: "F-DUE", concepto: "Cobro", estado: "emitida", total: 1000, pagado: 200, fechaEmision: date("2026-07-01"), fechaVencimiento: date("2026-07-20"), client, work, payments: [{ id: "paid-due", importe: 200 }] }]),
  ...buildPayableDocuments([{ id: "late", invoiceNumber: "R-LATE", description: "Pago", status: "PENDING", total: 300, paidAmount: 0, issueDate: date("2026-07-01"), dueDate: date("2026-07-17"), voidedAt: null, businessPartner: partner, work, payments: [] }]),
  ...buildPayableDocuments([{ id: "nodate", invoiceNumber: "R-NO", description: "Sin fecha", status: "PENDING", total: 200, paidAmount: 0, issueDate: date("2026-07-01"), dueDate: null, voidedAt: null, businessPartner: partner, work: null, payments: [] }])
];

test("el resumen separa pendiente, vencido y parcial", () => { const summary = summarizeEconomicDocuments(docs, now); assert.equal(summary.pending, 1300); assert.equal(summary.overdue, 300); assert.equal(summary.partialCount, 1); });
test("la previsión incluye solo vencimientos futuros dentro del periodo", () => { const forecast = buildDueDateForecast(docs, "7d", 500, now); assert.equal(forecast.inflows, 800); assert.equal(forecast.outflows, 0); assert.equal(forecast.overdue.length, 1); });
test("documentos sin vencimiento quedan fuera de la proyección", () => { const forecast = buildDueDateForecast(docs, "30d", 500, now); assert.equal(forecast.unscheduled.length, 1); assert.ok(!forecast.future.some((item) => item.id === "payable:nodate")); });
test("sin saldo inicial fiable no se inventa saldo proyectado", () => { const forecast = buildDueDateForecast(docs, "30d", null, now); assert.equal(forecast.openingBalance, null); assert.equal(forecast.closingBalance, null); assert.ok(forecast.points.every((point) => point.balance === null)); });
test("con saldo registrado el cierre suma únicamente flujo documentado", () => { const forecast = buildDueDateForecast(docs, "30d", 500, now); assert.equal(forecast.closingBalance, 1300); });
test("la cronología distingue vencido, próximos siete días y sin fecha", () => { const groups = buildDueDateForecast(docs, "30d", null, now).groups; assert.equal(groups.vencido.length, 1); assert.equal(groups.proximos_7_dias.length, 1); assert.equal(groups.sin_vencimiento.length, 1); });
test("Tesorería expone exactamente cinco áreas económicas", () => { const source = readFileSync(join(root, "components/economic-control-center.tsx"), "utf8"); for (const label of ["Resumen", "Cobros", "Pagos", "Previsión", "Rentabilidad"]) assert.match(source, new RegExp(`label: \"${label}\"`)); assert.equal((source.match(/label: \"(Resumen|Cobros|Pagos|Previsión|Rentabilidad)\"/g) ?? []).length, 5); });
test("Resumen es el área predeterminada y los filtros viven en URL", () => { const query = readFileSync(join(root, "lib/economic-control/queries.ts"), "utf8"); const page = readFileSync(join(root, "app/(app)/tesoreria/page.tsx"), "utf8"); assert.match(query, /: \"resumen\"/); for (const field of ["vista", "periodo", "cliente", "obra", "estado"]) assert.match(page, new RegExp(`${field}\\?: string`)); });
test("rentabilidad expone materiales, subcontratas, generales y datos insuficientes", () => { const source = readFileSync(join(root, "components/economic-control-center.tsx"), "utf8"); for (const term of ["Materiales", "Subcontratas", "Generales", "Coste", "Beneficio", "Margen", "Desviación", "Datos insuficientes"]) assert.match(source, new RegExp(term)); assert.match(source, /row\.href/); });
test("presupuestos no forman parte de la previsión de caja", () => { const source = readFileSync(join(root, "lib/economic-control/metrics.ts"), "utf8"); assert.doesNotMatch(source, /budget|presupuesto/i); });
test("tablas y gráfico tienen alternativa accesible", () => { const source = readFileSync(join(root, "components/economic-control-center.tsx"), "utf8"); assert.match(source, /ResponsiveTable label=/); assert.match(source, /role=\"img\"/); assert.match(source, /sr-only/); assert.match(source, /aria-label=\"Seleccionar periodo\"|label=\"Periodo\"/); });
test("Tesorería conserva carga y error seguros", () => { assert.ok(readFileSync(join(root, "app/(app)/tesoreria/loading.tsx"), "utf8").length > 0); assert.ok(readFileSync(join(root, "app/(app)/tesoreria/error.tsx"), "utf8").length > 0); });
test("la consulta deriva companyId de sesión y filtra todos los agregados", () => { const source = readFileSync(join(root, "lib/economic-control/queries.ts"), "utf8"); assert.match(source, /requireCompanyContext/); for (const model of ["invoice", "purchaseInvoice", "expense", "client", "work"]) assert.match(source, new RegExp(`prisma\\.${model}\\.findMany\\(\\{[\\s\\S]*?where: \\{ companyId`)); });
test("Cliente, Obra, Hoy y Dashboard consumen el control compartido", () => { for (const path of ["app/(app)/clientes/[id]/page.tsx", "app/(app)/obras/[id]/page.tsx", "app/(app)/hoy/page.tsx", "app/(app)/dashboard/page.tsx"]) assert.match(readFileSync(join(root, path), "utf8"), /getEconomicControl/); });
test("Capataz recibe agregados limitados y enlaza siempre al origen", () => { const page = readFileSync(join(root, "app/(app)/capataz/page.tsx"), "utf8"); const chat = readFileSync(join(root, "components/capataz-chat.tsx"), "utf8"); assert.match(page, /economicContext/); assert.match(chat, /Contexto limitado a cifras agregadas y trazables/); assert.match(chat, /Abrir origen/); });
test("el control económico no añade Prisma, migraciones, cron ni persistencia", () => { const sources = ["lib/economic-control/types.ts", "lib/economic-control/metrics.ts", "lib/economic-control/queries.ts", "components/economic-control-center.tsx"].map((path) => readFileSync(join(root, path), "utf8")).join("\n"); assert.doesNotMatch(sources, /prisma\.(create|update|delete)|cron|migrate|schema\.prisma|openai/i); });

console.log(`Economic control treasury experience: ${results.length}/${results.length}`);
for (const name of results) console.log(`✓ ${name}`);
