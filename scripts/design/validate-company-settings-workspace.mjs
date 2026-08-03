import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [page, workspace, styles, useCases] = await Promise.all([
  read("app/(app)/configuracion/page.tsx"),
  read("components/portal/modules-c/company-settings-workspace.tsx"),
  read("components/portal/modules-c/company-settings-workspace.module.css"),
  read("lib/application/company/settings-use-cases.ts"),
]);

assert.match(page, /ownerOnlyAreas = new Set\(\["empresa", "identidad-marca", "fiscal-documentos", "zona-sensible"\]\)/,
  "Las areas sensibles deben cerrarse para usuarios que no sean OWNER");
assert.match(page, /!owner && ownerOnlyAreas\.has\(requestedArea\) \? "perfil" : requestedArea/,
  "La navegacion directa no puede saltarse el control OWNER");
assert.match(page, /companyMembership\.count\(\{ where: \{ companyId: auth\.companyId/,
  "Los recuentos de equipo deben estar aislados por empresa");
assert.match(page, /integrationConnection\.count\(\{ where: \{ companyId: auth\.companyId/,
  "Las integraciones deben estar aisladas por empresa");
assert.match(page, /area === "empresa" \|\| area === "identidad-marca"/,
  "Las dos superficies maestras deben usar el workspace compartido");

for (const label of [
  "Empresa",
  "Identidad y marca",
  "Facturación y fiscalidad",
  "Sucursales",
  "Usuarios y permisos",
  "Integraciones",
  "Seguridad",
]) {
  assert.ok(workspace.includes(`label: "${label}"`) || workspace.includes(`>${label}<`), `Falta la pestaña ${label}`);
}

for (const marker of [
  "data-company-general-view",
  "data-company-identity-view",
  "Completitud de empresa",
  "Validaciones superadas",
  "Vista previa de marca",
  "Vista previa · no emitido",
  "Gestionada por Orqena",
]) {
  assert.ok(workspace.includes(marker), `Falta el contrato visual/funcional: ${marker}`);
}

assert.match(workspace, /<form action=\{saveCompanySettings\}/,
  "La edicion de empresa debe conservar la accion real");
assert.match(workspace, /<form action=\{uploadCompanyAsset\}/,
  "Los activos de marca deben conservar la subida real");
assert.match(workspace, /function PreservedIdentityFields/,
  "La edicion parcial de identidad debe preservar los ajustes omitidos");
assert.doesNotMatch(workspace, />Eliminar</,
  "No debe mostrarse una eliminacion de activo que no exista en servidor");
assert.doesNotMatch(workspace, /Duplicar configuraci[oó]n/i,
  "No debe existir una accion decorativa de duplicado");

assert.match(useCases, /requireActiveOwner\(\)/,
  "Las mutaciones de empresa deben exigir OWNER activo");
assert.match(useCases, /COMPANY_ASSET_MAX_BYTES = 5 \* 1024 \* 1024/,
  "El limite de 5 MB debe aplicarse en servidor");
assert.match(useCases, /COMPANY_ASSET_MIME_TYPES = new Set\(\["image\/png", "image\/jpeg", "image\/webp"\]\)/,
  "Los tipos de imagen deben validarse en servidor");
assert.match(useCases, /COMPANY_ASSET_TOO_LARGE/,
  "Debe existir un rechazo explicito para archivos grandes");
assert.match(useCases, /COMPANY_ASSET_TYPE_INVALID/,
  "Debe existir un rechazo explicito para formatos no permitidos");

assert.match(styles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/,
  "El resumen debe mantener cuatro KPI compactos en escritorio");
assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  "La arquitectura general debe mantener tres paneles por fila");
assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.35fr\) minmax\(3[23]0px, \.95fr\)/,
  "Identidad debe mantener una composicion equilibrada con vista previa");
assert.match(styles, /@media \(max-width: 1180px\)/,
  "Debe existir adaptacion para tablet y escritorio estrecho");
assert.match(styles, /@media \(max-width: 760px\)/,
  "Debe existir adaptacion movil");
assert.match(styles, /overflow-x:\s*auto/,
  "Las pestañas deben seguir accesibles en movil sin desbordar la pagina");

console.log("PASS validate-company-settings-workspace");
