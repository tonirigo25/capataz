import fs from "node:fs";

const page = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
const list = fs.readFileSync("app/(app)/obras/page.tsx", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

function expect(condition, message, details) {
  if (!condition) {
    console.error("[work-detail] FAIL", message);
    if (details !== undefined) console.error(details);
    process.exit(1);
  }
}

const requiredTabs = [
  "Resumen",
  "Cliente",
  "Contactos",
  "Presupuestos",
  "Facturas",
  "Cobros",
  "Gastos",
  "Materiales",
  "Horas",
  "Personal",
  "Subcontratas",
  "Documentos",
  "Fotografías",
  "Visitas",
  "Recordatorios",
  "Cronología",
  "IA",
  "Configuración"
];

for (const tab of requiredTabs) expect(page.includes(tab), `missing tab ${tab}`);
for (const action of ["Crear presupuesto", "Crear factura", "Registrar gasto", "Registrar pago", "Añadir visita", "Añadir material", "Añadir documento", "Añadir foto", "Crear recordatorio", "Abrir chat IA"]) {
  expect(page.includes(action), `missing quick action ${action}`);
}
for (const view of ["Tarjetas", "Tabla", "Compacta", "Kanban"]) expect(list.includes(view), `missing list view ${view}`);
for (const field of ["numeroInterno", "codigo", "prioridad", "fechaInicioReal", "fechaFinReal", "responsable", "jefeObra", "costePrevisto", "horasReales", "archivada"]) {
  expect(schema.includes(field), `missing Work field ${field}`);
}
expect(schema.includes("model WorkDocument"), "missing WorkDocument structure");
expect(schema.includes("model WorkPhoto"), "missing WorkPhoto structure");
expect(page.includes("No se muestran placeholders") || page.includes("No se muestran datos inventados") || page.includes("No hay"), "detail page must use real empty states");

console.log("[work-detail] OK 360 tabs, quick actions, list views and schema fields");
