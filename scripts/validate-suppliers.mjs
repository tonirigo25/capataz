import fs from "node:fs";

const files = {
  page: fs.readFileSync("app/(app)/proveedores/page.tsx", "utf8"),
  component: fs.readFileSync("components/supplier-directory-v2.tsx", "utf8"),
  data: fs.readFileSync("lib/supplier-workspace.ts", "utf8"),
  route: fs.readFileSync("app/(app)/proveedores/export/route.ts", "utf8"),
  rail: fs.readFileSync("components/portal/orqena-context-rail.tsx", "utf8"),
};

const failures = [];
for (const token of [
  "SupplierDirectoryV2",
  'requireCapability("purchases.suppliers.view")',
  'resolveAuthorization(context, "purchases.suppliers.manage")',
  'resolveAuthorization(context, "reports.export")',
]) if (!files.page.includes(token)) failures.push(`page missing ${token}`);

for (const token of [
  "Proveedores activos", "Gasto total (MTD)", "Facturas pendientes", "Riesgo promedio", "Calidad promedio",
  "Estado de pago", "Contacto principal", "Facturas vinculadas", "Última actividad",
  "Proveedores por categoría", "Top proveedores por gasto (MTD)", "Actividad reciente",
  "SupplierRailContext", "PartnerForm", "/proveedores/export", "/facturas-proveedor",
]) if (!files.component.includes(token)) failures.push(`workspace missing ${token}`);

for (const token of [
  "where: { companyId, kind: \"SUPPLIER\", archivedAt: null }",
  "pendingAmount", "overdueAmount", "internalRating", "documentStatus", "createdAt",
]) if (!files.data.includes(token)) failures.push(`tenant data query missing ${token}`);

for (const token of [
  'requireCapability("reports.export")',
  'resolveAuthorization(auth, "purchases.suppliers.view")',
  "getSupplierWorkspace(auth.companyId",
  "csvCell",
  '"cache-control": "private, no-store"',
]) if (!files.route.includes(token)) failures.push(`secure export missing ${token}`);

for (const token of ["SupplierRailContent", "isSupplierRailContext", 'pathname === "/proveedores"']) {
  if (!files.rail.includes(token)) failures.push(`context rail missing ${token}`);
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("suppliers workspace: PASS (tenant data, actions, export, contextual IA)\n");

