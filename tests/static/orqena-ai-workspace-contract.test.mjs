import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const workspace = read("components/portal/modules-c/orqena-ai-workspace.tsx");
const styles = read("components/portal/modules-c/orqena-ai-workspace.module.css");
const rail = read("components/portal/orqena-context-rail.tsx");
const modulePage = read("app/(app)/orqena-ia/[module]/page.tsx");

test("Orqena IA conserva seis áreas diferenciadas en una arquitectura compartida", () => {
  for (const area of ["general", "comercial", "operaciones", "finanzas", "documentos", "equipo"]) {
    assert.ok(workspace.includes(`area === "${area}"`) || workspace.includes(`${area}: {`), `Falta la composición ${area}`);
  }
  assert.match(workspace, /<AreaPrimary/);
  assert.match(workspace, /<AreaSecondary/);
  assert.match(workspace, /<DenseTable/);
  assert.doesNotMatch(modulePage, /InternalBreadcrumbs/);
  assert.doesNotMatch(workspace, />Abrir chat real</);
});

test("las consultas mantienen tenant, scopes y permisos", () => {
  for (const token of [
    "companyId: auth.companyId",
    'resolveAuthorization(auth, "orqena.use")',
    'resolveAuthorization(auth, "orqena.execute")',
    "resolveScopedEntityIds",
    "resolveScopedTaskIds",
    "recommendationVisible",
  ]) assert.ok(workspace.includes(token), `Falta ${token}`);
});

test("los accionables abren el registro seleccionado sin ejecutar automatizaciones", () => {
  for (const token of [
    "/recomendaciones?estado=all&seleccion=",
    "/documentos?documento=",
    "/equipo?perfil=",
    "/presupuestos/${item.id}",
    "/tareas/${item.id}",
    "/dinero/${item.id}",
    "Activar con revisión",
  ]) assert.ok(workspace.includes(token), `Falta ${token}`);
  assert.doesNotMatch(workspace, /form action=/);
});

test("la densidad evita desbordamientos y recompone tablas en móvil", () => {
  assert.match(styles, /font-size: 28px/);
  assert.match(styles, /\.metricValue[\s\S]*overflow: hidden[\s\S]*text-overflow: ellipsis/);
  assert.match(styles, /\.dataTable td[\s\S]*font-size: 8\.5px/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.dataTable tr[\s\S]*grid-template-columns: repeat\(2/);
  for (const area of ["documentos", "finanzas", "equipo"]) assert.ok(styles.includes(`[data-area="${area}"]`), `Falta geometría ${area}`);
});

test("el rail identifica el workspace y mantiene revisión humana", () => {
  assert.match(rail, /Asistente Orqena IA/);
  assert.match(rail, /WorkspaceCapabilities/);
  assert.match(rail, /Mantener confirmación humana/);
  assert.match(rail, /\/recomendaciones\?estado=all/);
});
