import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const source = {
  list: read("app/(app)/seguimientos/page.tsx"),
  detail: read("app/(app)/seguimientos/[id]/page.tsx"),
  actions: read("app/(app)/seguimientos/actions.ts"),
  useCases: read("lib/application/operations/follow-up-use-cases.ts"),
  engine: read("lib/followups/followup-engine.ts"),
  navigation: read("lib/product-navigation.ts"),
};

const passed = [];

function check(name, run) {
  run();
  passed.push(name);
}

function includesAll(text, tokens, context) {
  for (const token of tokens) assert.ok(text.includes(token), `${context}: falta ${token}`);
}

check("La cola conserva arquitectura operativa y estados esenciales", () => {
  includesAll(source.list, [
    "<h1>Seguimientos</h1>",
    "Gestiona el seguimiento comercial y las interacciones con tus clientes.",
    'aria-label="Filtros de seguimientos"',
    'label: "Pendiente"',
    'label: "En curso"',
    'label: "Esperando respuesta"',
    'label: "Compromiso"',
    'label: "Completado"',
    'label: "Cierre"',
    "data-follow-up-queue-item",
  ], "seguimientos/lista");
  for (const label of ["Fecha", "Promesa", "Último intento", "Canal", "Resultado", "Siguiente acción"]) {
    assert.ok(source.list.includes(`<dt>${label}</dt>`), `seguimientos/lista: falta el campo ${label}`);
  }
});

check("La lista y el detalle derivan empresa, permisos y alcance de la sesión", () => {
  includesAll(source.list, [
    'requireCapability("followups.view")',
    'resolveAuthorization(auth, "followups.manage")',
    'resolveScopedEntityIds(auth, "followups.view", "Work")',
    'resolveScopedEntityIds(auth, "followups.view", "Client")',
    "companyId: auth.companyId",
    "...scopeWhere",
  ], "seguimientos/lista tenant");
  includesAll(source.detail, [
    'requireCapability("followups.view")',
    "where: { id, companyId: auth.companyId }",
    'assertScopedEntityAccess(auth, "followups.view", "Work"',
    'assertScopedEntityAccess(auth, "followups.view", "Client"',
    'resolveAuthorization(auth,"sales.invoices.view")',
    'resolveAuthorization(auth,"followups.manage")',
  ], "seguimientos/detalle tenant");
});

check("Alta, filtros y navegación tienen destinos reales", () => {
  includesAll(source.list, [
    'href={hrefFor(query, { nuevo: "1" })}',
    "action={createFollowUpAction}",
    "href={`/seguimientos/${item.id}`}",
    'href={hrefFor(query, { nuevo: null })}',
    'href="/agenda"',
  ], "seguimientos/navegación");
  includesAll(source.detail, [
    "InternalBreadcrumbs",
    '{ label: "Seguimientos", href: "/seguimientos" }',
    'href="/seguimientos"',
  ], "seguimientos/migas");
  assert.ok(source.navigation.includes('{ href: "/seguimientos"'), "seguimientos: falta destino en la navegación de producto");
});

check("Todos los controles mutables están conectados a acciones server-side", () => {
  for (const action of [
    "createFollowUpAction",
    "editFollowUpAction",
    "changeFollowUpStatusAction",
    "registerAttemptAction",
    "recordOutcomeAction",
    "archiveFollowUpAction",
  ]) {
    assert.ok(source.list.includes(`action={${action}}`) || source.detail.includes(`action={${action}}`), `seguimientos: ${action} no está conectado a un formulario`);
    assert.ok(source.actions.includes(`export async function ${action}`), `seguimientos: falta frontera server-side para ${action}`);
    assert.ok(source.actions.includes(`${action}UseCase`), `seguimientos: ${action} no delega en caso de uso`);
  }
  assert.ok(source.actions.includes("executeNextAction"), "seguimientos: las acciones no usan la frontera canónica");
});

check("Las mutaciones rechazan IDs y relaciones fuera del tenant", () => {
  includesAll(source.useCases, [
    'requireCapability("followups.manage")',
    "where: { id, companyId: auth.companyId }",
    'throw new Error("FOLLOWUP_NOT_AVAILABLE")',
    'throw new Error("SCOPED_ENTITY_FORBIDDEN")',
    'throw new Error("SCOPED_ENTITY_REQUIRED")',
    'throw new Error("FOLLOWUP_RELATION_INVALID")',
  ], "seguimientos/casos de uso tenant");
  assert.match(source.useCases, /assertScopedEntityAccess\(\s*auth,\s*"followups\.manage",\s*"Work"/s, "seguimientos: falta control de alcance Work");
  assert.match(source.useCases, /assertScopedEntityAccess\(\s*auth,\s*"followups\.manage",\s*"Client"/s, "seguimientos: falta control de alcance Client");
  includesAll(source.engine, [
    "requireCompanyContext()",
    'throw new Error("FOLLOWUP_NOT_AVAILABLE")',
    "where:{id:followUpId,companyId}",
    "where:{id,companyId}",
  ], "seguimientos/motor tenant");
});

check("Intentos y resultados compuestos son atómicos y no ejecutan efectos externos", () => {
  assert.ok((source.engine.match(/prisma\.\$transaction/g) ?? []).length >= 2, "seguimientos: intento y resultado deben escribirse en transacción");
  includesAll(source.detail, [
    "Registrar intento manual",
    'value="email_manual"',
    'value="whatsapp_manual"',
    "Registrar este resultado no marca facturas pagadas ni cambia",
  ], "seguimientos/efectos supervisados");
  assert.doesNotMatch(`${source.actions}\n${source.useCases}\n${source.engine}`, /sendEmail|sendWhatsapp|sendWhatsApp|payment\.create|invoice\.update/, "seguimientos: una acción manual no debe disparar proveedor o mutación económica");
});

check("El archivo exige confirmación y conserva el historial", () => {
  includesAll(source.detail, [
    "ConfirmSubmitButton",
    "El seguimiento dejará de aparecer entre los activos, pero conservará todos sus intentos y resultados.",
    "El historial se conserva aunque se archive el seguimiento.",
  ], "seguimientos/archivo");
  includesAll(source.engine, [
    'data: { status: "archived", archivedAt: new Date() }',
  ], "seguimientos/archivo lógico");
  assert.doesNotMatch(`${source.useCases}\n${source.engine}`, /followUp\.delete|followUpAttempt\.delete|followUpOutcome\.delete/, "seguimientos: el archivo no puede borrar historial");
});

check("No quedan botones o enlaces decorativos", () => {
  const ui = `${source.list}\n${source.detail}`;
  assert.doesNotMatch(ui, /href=["']#["']|href=["']javascript:/i, "seguimientos: enlace decorativo detectado");
  assert.doesNotMatch(ui, /onClick=\{\(\) => \{\}\}/, "seguimientos: botón con manejador vacío detectado");
  assert.doesNotMatch(ui, /<button[^>]*disabled[^>]*>\s*(?:Abrir|Guardar|Crear|Registrar|Completar)/i, "seguimientos: acción principal decorativa detectada");
});

console.log(`[followups] ${passed.length}/${passed.length}`);
for (const name of passed) console.log(`[followups] OK ${name}`);
