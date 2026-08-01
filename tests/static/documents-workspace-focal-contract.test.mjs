import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/(app)/documentos/page.tsx");
const workspace = read("components/portal/modules-a/global-documents-workspace.tsx");
const rail = read("components/portal/orqena-context-rail.tsx");
const styles = read("app/globals.css");
const fileRoute = read("app/(app)/documentos/[id]/archivo/route.ts");
const uploadAction = read("app/(app)/documentos/actions.ts");
const uploadPage = read("app/(app)/documentos/subir/page.tsx");
const templateRoute = read("app/(app)/documentos/plantillas/[slug]/route.ts");

test("la visibilidad scoped usa IDs Document autorizados", () => {
  assert.match(page, /resolveScopedEntityIds\(auth, "documents\.view", "Document"\)/);
  assert.match(page, /id: \{ in: scopedDocumentIds \}/);
  assert.doesNotMatch(page, /scopedWorkIds/);
});

test("la ruta privada exige tenant, scope, clase visible y capability", () => {
  for (const token of [
    'requireCapability("documents.view")',
    'resolveScopedEntityIds(auth, "documents.view", "Document")',
    "companyId: auth.companyId",
    "classification: { in: manifest.documentClasses }",
    "documentStorage.presignGet",
    "documentStorage.get",
  ]) assert.ok(fileRoute.includes(token), `Falta ${token}`);
});

test("cada acción del lector tiene intención y ancla diferenciadas", () => {
  for (const token of [
    '"link-work", "document-work"',
    '"link-partner", "document-partner"',
    '"correct", "document-fields"',
    '"review", "document-review"',
  ]) assert.ok(page.includes(token), `Falta ${token}`);
});

test("la subida general valida contenido real y usa almacenamiento privado", () => {
  for (const token of [
    'requireCapability("documents.upload")',
    "validateRepositoryDocumentFile",
    "assertDocumentCreationAllowed",
    "documentStorage.put",
    'origin: "document_repository"',
  ]) assert.ok(uploadAction.includes(token), `Falta ${token}`);
  assert.doesNotMatch(uploadAction, /formData\.get\("companyId"\)/);
  assert.match(uploadPage, /PDF, JPG, PNG, WEBP o TXT/);
  assert.match(uploadPage, /Abrir lector de gastos/);
});

test("el preview usa partidas e importes canónicos cuando existen", () => {
  assert.match(page, /proposal\.lines\.map/);
  assert.match(page, /columns: \["Concepto", "Cantidad", "Precio", "Importe"\]/);
  assert.match(page, /proposal\.taxableBase/);
  assert.match(page, /proposal\.vatAmount/);
});

test("el responsive depende del ancho útil y no del viewport global", () => {
  assert.match(workspace, /global-documents-workspace/);
  assert.match(workspace, /data-mobile-step=\{mobileStep\}/);
  assert.match(styles, /container: global-documents \/ inline-size/);
  assert.match(styles, /@container global-documents \(min-width: 48rem\)/);
  assert.match(styles, /@container global-documents \(min-width: 56rem\)/);
});

test("el rail recibe sólo el contexto del documento seleccionado", () => {
  assert.match(workspace, /orqena:document-context/);
  assert.match(rail, /DocumentRailContent/);
  assert.match(rail, /isDocumentRailContext/);
  assert.match(rail, /Recomendación para este documento/);
});

test("las plantillas se exponen con preview y descarga bajo documents.view", () => {
  assert.match(page, /documentTemplateAssets\.map/);
  assert.match(workspace, /DocumentTemplatesPanel/);
  assert.match(workspace, /Plantillas autorizadas/);
  assert.match(templateRoute, /requireCapability\("documents\.view"\)/);
});
