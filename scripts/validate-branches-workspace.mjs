import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("app/(app)/configuracion/sucursales/page.tsx");
const styles = read("app/(app)/configuracion/sucursales/branches.module.css");
const schema = read("prisma/schema.prisma");
const failures = [];
const check = (name, condition) => { if (!condition) failures.push(name); };

check("company-view-guard", page.includes('requireCapability("company.view")'));
check("company-update-decision", page.includes('resolveAuthorization(auth, "company.update")'));
check("tenant-scoped-company", page.includes("where: { id: auth.companyId }") && page.includes("companyId: auth.companyId"));
check("real-tenant-data-only", ["nombreComercial", "taxId", "direccion", "companyMembership.count"].every((needle) => page.includes(needle)));
check("no-branch-persistence", !/model\s+(Branch|Office|Warehouse|Sucursal)\b/.test(schema));
check("honest-unsupported-metrics", ["Sin atribución persistida", "Sin inventario por sede", "Mapa no disponible", "No hay coordenadas"].every((needle) => page.includes(needle)));
check("unsupported-actions-disabled", page.includes('disabled title="No existen coordenadas') && page.includes('disabled title="La aplicación aún no dispone'));
check("real-company-edit-action", page.includes('/configuracion?area=empresa&edit=1') && page.includes("canUpdate"));
check("no-destructive-actions", !/[Bb]orrar sucursal|[Ee]liminar sucursal|deleteBranch|removeBranch/.test(page));
check("master-sections", ["Sucursales", "Cobertura y territorio", "Sede fiscal", "Miembros activos", "Responsable registrado"].every((needle) => page.includes(needle)));
check("compact-responsive", [".metrics", ".contentGrid", ".mobileCard", "@media (max-width: 760px)", "@media (max-width: 430px)"].every((needle) => styles.includes(needle)));
check("no-synthetic-business-data", !/12\.450|128\.450|operaciones hoy|stock total|ventas \(30 días\)/i.test(page));

if (failures.length) {
  console.error(`Branches workspace contract: FAIL (${failures.join(", ")})`);
  process.exit(1);
}
console.log("Branches workspace contract: PASS");
