import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(app)/presupuestos/[id]/page.tsx", "utf8");
const css = readFileSync("app/(app)/presupuestos/[id]/budget-detail.module.css", "utf8");

for (const contract of [
  "Partidas y capítulos",
  "Materiales y mano de obra",
  "Planificación y vencimientos",
  "Historial de revisiones",
  "Documentos asociados",
  "Cronología de aprobaciones",
  "Información comercial",
]) assert.match(page, new RegExp(contract), `Falta el bloque ${contract}`);

assert.match(page, /BudgetRailContext/, "El detalle debe alimentar el rail contextual de Orqena IA");
assert.match(page, /sales\.pricing\.view/, "Los importes deben conservar el gate económico");
assert.match(page, /margin_amount\.view/, "El margen debe conservar su gate específico");
assert.match(page, /reconcileBudgetRecord/, "Las acciones irreversibles deben depender de importes reconciliados");
assert.match(page, /calculateBudgetMargin/, "El margen debe calcularse desde partidas y costes");
assert.match(page, /No calculada/, "No debe inventarse una probabilidad comercial");
assert.match(page, /Sólo se muestran eventos auditados/, "El historial debe distinguir datos reales de ausencia de evidencia");
assert.match(page, /modo=editar/, "La edición debe abrirse de forma intencional y conservar el detalle compacto");
assert.match(css, /grid-template-columns:\s*repeat\(6/, "El resumen de escritorio debe mantener seis indicadores compactos");
assert.match(css, /@media \(max-width: 640px\)/, "Debe existir una adaptación móvil explícita");

console.log("[budget-detail-architecture] PASS");
