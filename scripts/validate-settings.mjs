import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const actions = fs.readFileSync("app/(app)/configuracion/actions.ts", "utf8");
const page = fs.readFileSync("app/(app)/configuracion/page.tsx", "utf8");
const numbering = fs.readFileSync("lib/numbering.ts", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[settings] FAIL", message);
    process.exit(1);
  }
}

for (const field of ["tratamiento", "idioma", "zonaHoraria", "preferenciaVisual", "notificacionesInternas", "notificacionesEmail"]) {
  expect(schema.includes(field) && actions.includes(field) && page.includes(field), `missing user setting ${field}`);
}

for (const field of ["municipio", "moneda", "validezPresupuestoDias", "formaPagoDefecto", "serieObras", "prefijoObra"]) {
  expect(schema.includes(field) && actions.includes(field) && page.includes(field), `missing company setting ${field}`);
}

expect(page.includes("Mi perfil") && page.includes("Datos de empresa"), "user/company settings are not clearly separated");
expect(numbering.includes('"work"') && numbering.includes("workPrefix") && numbering.includes("workSeries"), "work numbering is not configurable");
expect(numbering.includes("companyId") && numbering.includes("pg_advisory_xact_lock") && numbering.includes("padStart(3"), "numbering must be tenant-scoped and concurrency-safe");

console.log("[settings] OK user/company separation and configurable numbering");
