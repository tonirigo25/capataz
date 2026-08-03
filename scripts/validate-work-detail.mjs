import fs from "node:fs";

const page = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
const routes = fs.readFileSync("app/(app)/obras/[id]/[...section]/page.tsx", "utf8");
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
  "Planificación",
  "Actividad",
  "Costes",
  "Documentos",
  "Equipo",
  "Facturación",
  "Incidencias"
];

for (const tab of requiredTabs) expect(page.includes(tab), `missing tab ${tab}`);
for (const action of ["Registrar avance", "Crear presupuesto", "Crear factura", "Registrar gasto", "Registrar pago", "Añadir visita", "Añadir material", "Añadir documento", "Añadir nota", "Crear recordatorio", "Abrir chat IA"]) {
  expect(page.includes(action), `missing quick action ${action}`);
}
expect(
  page.includes("/actividad/cronologia") &&
    page.includes("/actividad/galeria") &&
    routes.includes('actividad: { vista: "actividad", subvista: "cronologia" }') &&
    routes.includes('"actividad/cronologia": { vista: "actividad", subvista: "cronologia" }') &&
    routes.includes('"actividad/galeria": { vista: "actividad", subvista: "galeria" }'),
  "activity views must preserve canonical URL state",
);
expect(
  page.includes("TimelineList") && page.includes("WorkProgressGallery") && page.includes("<NotesTab"),
  "activity must preserve real chronology, gallery and notes",
);
expect(page.includes("WorkProgressGallery") && gallery.includes("AccessibleDialog"), "missing accessible visual progress gallery");
expect(!/\["partes",\s*"Partes"/.test(page), "retired Partes tab must not return to canonical navigation");
expect(!/\["ordenes",\s*"Órdenes"/.test(page), "retired Órdenes subview must not return to canonical navigation");
for (const view of ["Tarjetas", "Tabla", "Compacta", "Kanban"]) expect(list.includes(view), `missing list view ${view}`);
for (const field of ["numeroInterno", "codigo", "prioridad", "fechaInicioReal", "fechaFinReal", "responsable", "jefeObra", "costePrevisto", "horasReales", "archivada"]) {
  expect(schema.includes(field), `missing Work field ${field}`);
}
expect(schema.includes("model WorkDocument"), "missing WorkDocument structure");
expect(schema.includes("model WorkPhoto"), "missing WorkPhoto structure");
expect(page.includes("No se muestran placeholders") || page.includes("No se muestran datos inventados") || page.includes("No hay"), "detail page must use real empty states");

console.log("[work-detail] OK eight-area 360 workspace with real Activity, real actions, visual evidence, list views and schema fields");
