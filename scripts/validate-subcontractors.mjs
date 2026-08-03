import fs from "node:fs";

const files = {
  page: fs.readFileSync("app/(app)/subcontratas/page.tsx", "utf8"),
  component: fs.readFileSync("components/subcontractor-directory-v2.tsx", "utf8"),
  data: fs.readFileSync("lib/subcontractor-workspace.ts", "utf8"),
  route: fs.readFileSync("app/(app)/subcontratas/export/route.ts", "utf8"),
  rail: fs.readFileSync("components/portal/orqena-context-rail.tsx", "utf8"),
};
const failures = [];
const checks = [
  [files.page, ["SubcontractorDirectoryV2", 'requireCapability("purchases.suppliers.view")', 'resolveAuthorization(context, "purchases.suppliers.manage")']],
  [files.component, ["Subcontratas activas", "Obras con subcontratas", "Cumplimiento medio", "Pagos al día", "Directorio", "Evaluaciones", "Aprobaciones pendientes", "Subcontratas por cumplimiento", "Indicadores de desempeño", "PartnerForm", "/subcontratas/export"]],
  [files.data, ['where: { companyId, kind: "SUBCONTRACTOR", archivedAt: null }', "documentStatus", "internalRating", "activeWorkCount", "overdueAmount", "paymentRate"]],
  [files.route, ['requireCapability("reports.export")', 'resolveAuthorization(auth, "purchases.suppliers.view")', "getSubcontractorWorkspace(auth.companyId", '"cache-control": "private, no-store"', "csvCell"]],
  [files.rail, ['pathname !== "/proveedores" && pathname !== "/subcontratas"', 'pathname === "/proveedores" || pathname === "/subcontratas"']],
];
for (const [source, tokens] of checks) for (const token of tokens) if (!source.includes(token)) failures.push(`missing ${token}`);
for (const forbidden of ["Math.random", "window.location", "javascript:"]) if (files.component.includes(forbidden) || files.data.includes(forbidden)) failures.push(`forbidden ${forbidden}`);
if (failures.length) { process.stderr.write(`${failures.join("\n")}\n`); process.exit(1); }
process.stdout.write("subcontractors workspace: PASS (tenant data, filters, actions, export, contextual IA)\n");
