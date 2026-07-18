import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildOperationalContext, buildOperationalSignals, OPERATIONAL_THRESHOLDS, selectDiverseSignals } from "../lib/operational-intelligence/rules";

const root = process.cwd();
const now = new Date("2026-07-18T10:00:00+02:00");
const day = (iso: string) => new Date(iso + "T10:00:00+02:00");
const results: string[] = [];
function test(name: string, check: () => void) { check(); results.push(name); }
const client = { id: "client-1", nombre: "Cliente Uno" };
const work = { id: "work-1", titulo: "Reforma Centro" };

test("tareas vencidas usan solo los tres niveles públicos", () => {
  const signals = buildOperationalSignals({ tasks: [
    { id: "a", title: "Hoy", status: "planned", dueAt: day("2026-07-17"), clientId: client.id, workId: work.id },
    { id: "b", title: "Antigua", status: "blocked", dueAt: day("2026-07-01"), clientId: null, workId: null }
  ] }, now);
  assert.deepEqual(new Set(signals.map((item) => item.level)), new Set(["atencion", "urgente"]));
  assert.ok(!JSON.stringify(signals).includes("score"));
});
test("una tarea completada nunca genera señal", () => {
  assert.equal(buildOperationalSignals({ tasks: [{ id: "a", title: "Hecha", status: "completed", dueAt: day("2026-07-01"), clientId: null, workId: null }] }, now).length, 0);
});
test("seguimientos vencidos explican antigüedad y siguiente paso", () => {
  const signal = buildOperationalSignals({ followUps: [{ id: "f", title: "Llamar", status: "planned", nextActionAt: day("2026-07-10"), clientId: client.id, workId: null }] }, now)[0];
  assert.equal(signal.rule, "seguimiento_vencido"); assert.match(signal.explanation, /8 días/); assert.match(signal.nextStep, /Contactar/);
});
test("agenda de hoy informa y agenda atrasada escala", () => {
  const signals = buildOperationalSignals({ agenda: [
    { id: "today", title: "Visita", status: "pendiente", type: "visita", startsAt: now, clientId: client.id, workId: work.id },
    { id: "late", title: "Llamada", status: "pendiente", type: "llamada", startsAt: day("2026-07-16"), clientId: client.id, workId: null }
  ] }, now);
  assert.equal(signals.find((item) => item.id.endsWith(":today"))?.level, "informacion");
  assert.equal(signals.find((item) => item.id.endsWith(":late"))?.level, "urgente");
});
test("borradores de factura no producen cobros ficticios", () => {
  const invoices = [{ id: "i", numero: "BOR-1", estado: "borrador", total: 1000, pagado: 0, fechaVencimiento: day("2026-07-01"), client, work: null, payments: [] }];
  assert.equal(buildOperationalSignals({ invoices }, now).length, 0);
});
test("saldo de factura usa pagos reales y conserva origen", () => {
  const invoices = [{ id: "i", numero: "F-1", estado: "emitida", total: 1000, pagado: 0, fechaVencimiento: day("2026-07-10"), client, work, payments: [{ id: "p", importe: 400 }] }];
  const signal = buildOperationalSignals({ invoices }, now)[0];
  assert.equal(signal.amount, 600); assert.equal(signal.entity.href, "/dinero/i");
});
test("cobro próximo usa umbral centralizado", () => {
  const invoices = [{ id: "i", numero: "F-2", estado: "emitida", total: 100, pagado: 0, fechaVencimiento: day("2026-07-25"), client, work: null, payments: [] }];
  assert.equal(OPERATIONAL_THRESHOLDS.dueSoonDays, 7);
  assert.equal(buildOperationalSignals({ invoices }, now)[0].rule, "factura_emitida_proxima");
});
test("presupuesto reciente no alerta y antiguo sí", () => {
  const recent = [{ id: "b", numero: "P-1", titulo: "Pintura", estado: "enviado", fechaCreacion: now, fechaEnvio: now, fechaSeguimiento: null, client, work: null }];
  const old = [{ ...recent[0], fechaCreacion: day("2026-07-01"), fechaEnvio: day("2026-07-02"), estado: "pendiente_respuesta", work }];
  assert.equal(buildOperationalSignals({ budgets: recent }, now).length, 0);
  assert.equal(buildOperationalSignals({ budgets: old }, now)[0].rule, "presupuesto_seguimiento");
});
test("obra cerrada no genera inactividad", () => {
  const works = [{ id: work.id, titulo: work.titulo, estado: "finalizada", updatedAt: day("2026-01-01"), presupuestoAprobado: 0, costePrevisto: 0, gastoReal: 0, client, activityDates: [] }];
  assert.equal(buildOperationalSignals({ works }, now).length, 0);
});
test("inactividad usa la actividad objetiva más reciente", () => {
  const works = [{ id: work.id, titulo: work.titulo, estado: "en_curso", updatedAt: day("2026-06-01"), presupuestoAprobado: 0, costePrevisto: 0, gastoReal: 0, client, activityDates: [day("2026-07-01")] }];
  const signal = buildOperationalSignals({ works }, now)[0];
  assert.equal(signal.days, 17); assert.equal(signal.level, "atencion");
});
test("margen negativo exige datos económicos suficientes", () => {
  const works = [{ id: work.id, titulo: work.titulo, estado: "en_curso", updatedAt: now, presupuestoAprobado: 0, costePrevisto: 0, gastoReal: 900, client, invoices: [{ id: "i", estado: "emitida", total: 500, pagado: 0, payments: [] }], expenses: [{ importe: 900 }], budgets: [] }];
  assert.equal(buildOperationalSignals({ works }, now).find((item) => item.rule === "obra_margen_negativo")?.amount, -400);
});
test("factura recibida anulada no alerta y vencida conserva importe", () => {
  const base = { id: "pi", invoiceNumber: "R-1", dueDate: day("2026-07-01"), pendingAmount: 500, businessPartner: { id: "p", commercialName: "Proveedor" }, work };
  assert.equal(buildOperationalSignals({ purchaseInvoices: [{ ...base, status: "VOID", voidedAt: now }] }, now).length, 0);
  assert.equal(buildOperationalSignals({ purchaseInvoices: [{ ...base, status: "PENDING", voidedAt: null }] }, now)[0].amount, 500);
});
test("documentación no requerida no alerta y caducada es urgente", () => {
  assert.equal(buildOperationalSignals({ partners: [{ id: "p", commercialName: "Proveedor", documentStatus: "NOT_REQUIRED", documentExpiresAt: null }] }, now).length, 0);
  assert.equal(buildOperationalSignals({ partners: [{ id: "p", commercialName: "Proveedor", documentStatus: "EXPIRED", documentExpiresAt: day("2026-07-17") }] }, now)[0].level, "urgente");
});
test("selección prioriza urgencia y diversidad", () => {
  const signals = buildOperationalSignals({
    tasks: [{ id: "t", title: "Tarea", status: "blocked", dueAt: day("2026-07-01"), clientId: null, workId: null }],
    followUps: [{ id: "f", title: "Llamada", status: "planned", nextActionAt: day("2026-07-01"), clientId: client.id, workId: null }],
    invoices: [{ id: "i", numero: "F-1", estado: "emitida", total: 100, pagado: 0, fechaVencimiento: day("2026-07-01"), client, work: null, payments: [] }]
  }, now);
  const selected = selectDiverseSignals(signals, 3);
  assert.equal(new Set(selected.map((item) => item.category)).size, 3); assert.equal(selected[0].level, "urgente");
});
test("contexto vacío no inventa una recomendación", () => {
  const context = buildOperationalContext([]); assert.equal(context.principal, null); assert.match(context.phrase, /No hay señales/);
});
test("consultas derivan y aplican empresa de sesión", () => {
  const source = readFileSync(join(root, "lib/operational-intelligence/queries.ts"), "utf8");
  assert.match(source, /requireCompanyContext/);
  for (const model of ["task", "followUp", "eventoAgenda", "invoice", "budget", "work", "purchaseInvoice", "businessPartner"]) assert.match(source, new RegExp("prisma\\." + model + "\\.findMany\\(\\{ where: \\{ companyId"));
});
test("todas las superficies consumen el motor compartido", () => {
  for (const path of ["app/(app)/hoy/page.tsx", "app/(app)/dashboard/page.tsx", "app/(app)/clientes/page.tsx", "app/(app)/obras/page.tsx", "app/(app)/clientes/[id]/page.tsx", "app/(app)/obras/[id]/page.tsx", "app/(app)/capataz/page.tsx"]) assert.match(readFileSync(join(root, path), "utf8"), /Operational|getOperational|operational/);
});
test("Capataz contextualiza por URL y aísla consultas profesionales", () => {
  const page = readFileSync(join(root, "app/(app)/capataz/page.tsx"), "utf8");
  const chat = readFileSync(join(root, "components/capataz-chat.tsx"), "utf8");
  const actions = readFileSync(join(root, "app/(app)/capataz/actions.ts"), "utf8");
  assert.match(page, /clienteId\?: string; obraId\?: string/); assert.match(chat, /suggestions\.map/);
  assert.match(actions, /queryProfessionalTasks[\s\S]*?where:\{companyId,/);
  assert.match(actions, /queryProfessionalFollowUps[\s\S]*?\{companyId,archivedAt:null\}/);
});

console.log("Operational intelligence context: " + results.length + "/" + results.length);
for (const name of results) console.log("✓ " + name);
