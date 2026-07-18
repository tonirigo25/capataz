import fs from "node:fs";

const page = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
const list = fs.readFileSync("app/(app)/obras/page.tsx", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const gallery = fs.readFileSync("components/work-progress-gallery.tsx", "utf8");

function expect(condition, message, details) {
  if (!condition) {
    console.error("[work-detail] FAIL", message);
    if (details !== undefined) console.error(details);
    process.exit(1);
  }
}

const requiredTabs = [
  "Resumen",
  "Progreso",
  "Dinero",
  "Planificación",
  "Archivos",
  "Equipo"
];

for (const tab of requiredTabs) expect(page.includes(tab), `missing tab ${tab}`);
for (const action of ["Registrar avance", "Crear presupuesto", "Crear factura", "Registrar gasto", "Registrar pago", "Añadir visita", "Añadir material", "Añadir documento", "Añadir nota", "Crear recordatorio", "Abrir chat IA"]) {
  expect(page.includes(action), `missing quick action ${action}`);
}
expect(page.includes("modo=cronologia") && page.includes("modo=galeria"), "progress views must preserve URL state");
expect(page.includes("WorkProgressGallery") && gallery.includes("AccessibleDialog"), "missing accessible visual progress gallery");
for (const view of ["Tarjetas", "Tabla", "Compacta", "Kanban"]) expect(list.includes(view), `missing list view ${view}`);
for (const field of ["numeroInterno", "codigo", "prioridad", "fechaInicioReal", "fechaFinReal", "responsable", "jefeObra", "costePrevisto", "horasReales", "archivada"]) {
  expect(schema.includes(field), `missing Work field ${field}`);
}
expect(schema.includes("model WorkDocument"), "missing WorkDocument structure");
expect(schema.includes("model WorkPhoto"), "missing WorkPhoto structure");
expect(page.includes("No se muestran placeholders") || page.includes("No se muestran datos inventados") || page.includes("No hay"), "detail page must use real empty states");

console.log("[work-detail] OK six-area workspace, real actions, visual progress, list views and schema fields");
