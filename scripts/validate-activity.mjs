import fs from "node:fs";

const files = {
  page: fs.readFileSync("app/(app)/actividad/page.tsx", "utf8"),
  workspace: fs.readFileSync("lib/activity-workspace.ts", "utf8"),
  rail: fs.readFileSync("components/portal/activity-rail-context.tsx", "utf8"),
  exportRoute: fs.readFileSync("app/(app)/actividad/export/route.ts", "utf8"),
};

const checks = [
  ["cronología real", files.page.includes("timelineRow") && files.page.includes("item.date.toISOString()")],
  ["ocho vistas funcionales", ["Eventos operativos", "Actualizaciones", "Órdenes de trabajo", "Incidencias", "Hitos", "Archivos", "Comentarios"].every((label) => files.page.includes(label))],
  ["filtros preservados", ["q", "obra", "equipo", "periodo", "fecha"].every((field) => files.page.includes(`name=\"${field}\"`))],
  ["fuentes tenant scoped", files.workspace.includes("where: { companyId") && files.workspace.includes("work: { companyId }")],
  ["acciones con destino", files.page.includes("/gestion?tipo=notaInterna") && files.page.includes("/actividad/export")],
  ["exportación real", files.exportRoute.includes("getActivityWorkspace") && files.exportRoute.includes("text/csv")],
  ["rail contextual", files.rail.includes("orqena:activity-context") && files.page.includes("ActivityRailContext")],
  ["sin métricas maestras hardcodeadas", !/\b48\b|\b19\b|\b\+20%\b/.test(files.page)],
];

let passed = 0;
for (const [label, ok] of checks) {
  if (!ok) throw new Error(`[activity] FAIL ${label}`);
  passed += 1;
  console.log(`[activity] OK ${label}`);
}
console.log(`[activity] ${passed}/${checks.length}`);
