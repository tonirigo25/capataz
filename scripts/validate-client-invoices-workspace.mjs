import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const list = read("app/(app)/facturas-cliente/page.tsx");
const detail = read("app/(app)/facturas-cliente/[id]/page.tsx");
const styles = read("app/(app)/facturas-cliente/client-invoices.module.css");
const client360 = read("components/portal/modules-a/client-360-real-workspaces.tsx");
const failures = [];
const check = (name, condition) => { if (!condition) failures.push(name); };

check("list-capability-guard", list.includes('requireCapability("sales.invoices.view")'));
check("list-company-scope", list.includes("where: { companyId, ...scope }") && list.includes("resolveScopedEntityIds"));
check("list-real-invoices", list.includes("prisma.invoice.findMany") && list.includes("deriveInvoiceStatus"));
check("list-master-kpis", ["Emitidas", "Cobrado", "Pendiente de cobro", "Vencido", "Cobro medio"].every((text) => list.includes(text)));
check("list-real-actions", ["Nueva factura", "Exportar pendientes", "Ver detalle"].every((text) => list.includes(text)));
check("detail-capability-guard", detail.includes('requireCapability("sales.invoices.view")'));
check("detail-tenant-and-relation-scope", detail.includes("companyId: auth.companyId") && detail.includes("assertScopedEntityAccess"));
check("detail-real-actions", ["Registrar cobro", "Programar seguimiento", "Vista PDF", "Editar"].every((text) => detail.includes(text)));
check("document-permission-gate", detail.includes('resolveAuthorization(auth, "documents.view")') && detail.includes("canSeeDocuments"));
check("client360-routes-to-new-detail", client360.includes("/facturas-cliente/${invoice.id}?returnTo="));
check("compact-responsive-layout", [".table", ".mobileList", ".detailGrid", "@media (max-width: 760px)", "@media (max-width: 430px)"].every((needle) => styles.includes(needle)));
check("no-demo-placeholders", !list.includes("Math.random") && !detail.includes("Math.random") && !detail.includes("Datos simulados"));

if (failures.length) {
  console.error(`Client invoices contract: FAIL (${failures.join(", ")})`);
  process.exit(1);
}
console.log("Client invoices contract: PASS");
