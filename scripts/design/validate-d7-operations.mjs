import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const agenda = read("app/(app)/agenda/page.tsx");
const agendaLib = read("lib/agenda.ts");
const tasks = read("app/(app)/tareas/page.tsx");
const taskDetail = read("app/(app)/tareas/[id]/page.tsx");
const alerts = read("app/(app)/alertas/page.tsx");
const alertUseCases = read("lib/application/operations/alert-use-cases.ts");
const recommendations = read("app/(app)/recomendaciones/page.tsx");
const recommendationUseCases = read("lib/application/intelligence/recommendation-use-cases.ts");
const followUps = read("app/(app)/seguimientos/page.tsx");
const followUpDetail = read("app/(app)/seguimientos/[id]/page.tsx");
const reminders = read("app/(app)/recordatorios/page.tsx");
const automations = read("app/(app)/automatizaciones/page.tsx");
const automationDetail = read("app/(app)/automatizaciones/[id]/page.tsx");
const automationRunner = read("lib/automations/automation-runner.ts");
const automationRetries = read("lib/automations/automation-retries.ts");
const provisioner = read("scripts/readiness/provision-continuous-review.ts");
const results = [];

function test(name, check) {
  check();
  results.push(name);
}

test("Agenda abre en semana con Mes, Lista y Vencimientos como vistas secundarias", () => {
  assert.match(agenda, /query\.vista\) \? query\.vista! : "semana"/);
  for (const label of ["Semana", "Mes", "Lista", "Vencimientos"]) assert.match(agenda, new RegExp(`label: "${label}"`));
});
test("Agenda reserva la CTA primaria para Nueva visita", () => {
  assert.match(agenda, /tipoEvento=visita[\s\S]*className="primary-button"[\s\S]*Nueva visita/);
  assert.doesNotMatch(agenda, /primary-button[^>]*>[\s\S]{0,80}Aplicar/);
});
test("Agenda mueve búsqueda y tipo a un cajón de filtros", () => {
  assert.match(agenda, /<details data-agenda-filters/);
  assert.match(agenda, /Filtros de agenda/);
});
test("Agenda semanal usa cinco columnas en escritorio y un día seleccionado en móvil", () => {
  assert.match(agenda, /data-agenda-week/);
  assert.match(agenda, /lg:grid-cols-5/);
  assert.match(agenda, /data-agenda-selected-day/);
});
test("Agenda conserva cliente, contacto, trabajo y origen autorizados", () => {
  for (const token of ["clienteNombre", "contactName", "obraTitulo", "item.href"]) assert.ok(agenda.includes(token) || agendaLib.includes(token), `Falta ${token}`);
  assert.match(agendaLib, /companyId/);
});
test("Tareas ofrece Mías, Equipo, Bloqueadas y Completadas", () => {
  for (const label of ["Mías", "Equipo", "Bloqueadas", "Completadas"]) assert.match(tasks, new RegExp(`"${label}"`));
});
test("Tareas combina alcance y propiedad sin sobrescribir el OR de tenant scope", () => {
  assert.match(tasks, /AND: \[taskScope, stateScope, ownershipScope\]/);
  assert.match(tasks, /companyId: auth\.companyId/);
});
test("Tareas alterna lista y tablero según volumen", () => {
  assert.match(tasks, /tasks\.length >= 6/);
  assert.match(tasks, /data-task-view="board"/);
  assert.match(tasks, /data-task-view="list"/);
});
test("Tareas conserva dependencias, checklist, subtareas y recurrencia", () => {
  for (const token of ["checklist", "subtasks", "dependencies"]) assert.match(tasks, new RegExp(token));
  for (const label of ["Guardar planificación", "Checklist", "Subtareas", "Dependencias", "Guardar recurrencia"]) assert.match(taskDetail, new RegExp(label));
});
test("Tareas evita una CTA primaria por fila", () => {
  assert.match(tasks, /<button className="secondary-button">Completar<\/button>/);
  assert.match(tasks, /query\.nuevo === "1"/);
});
test("Alertas muestra nivel, origen, entidad, impacto, regla y acción sin puntuación artificial", () => {
  for (const token of ["Nivel", "sourceLabel", "Entidad:", "relatedAmount", "Regla aplicada", "suggestedActions"]) assert.match(alerts, new RegExp(token));
  assert.doesNotMatch(alerts, /\/100|>Puntuación</);
});
test("Alertas conserva posponer, descartar y resolver en el ciclo de vida", () => {
  for (const token of ["snoozeSignalAction", "dismissSignalAction", "resolveSignalAction"]) assert.match(alerts, new RegExp(token));
  for (const token of ["snoozeBusinessSignal", "dismissBusinessSignal", "resolveBusinessSignal"]) assert.match(alertUseCases, new RegExp(token));
});
test("Recomendaciones deja una sola acción preferida primaria y el resto secundarias", () => {
  assert.match(recommendations, /<PrimaryAction recommendation=\{result\.summary\.top\} compact/);
  assert.match(recommendations, /compact \? "primary-button" : "secondary-button"/);
  assert.doesNotMatch(recommendations, /\/100|>Puntuación</);
});
test("Recomendaciones exige confirmación explícita antes del efecto", () => {
  assert.match(recommendations, /name="confirmed" value="true"/);
  assert.match(recommendationUseCases, /executeConfirmedRecommendationAction/);
});
test("Seguimientos funciona como cola con fecha, promesa, intento, canal, resultado y siguiente acción", () => {
  for (const label of ["Fecha", "Promesa", "Último intento", "Canal", "Resultado", "Siguiente acción"]) assert.match(followUps, new RegExp(`label="${label}"`));
  assert.match(followUps, /data-follow-up-queue-item/);
});
test("Seguimientos reserva la primaria para registrar el intento en detalle", () => {
  assert.match(followUps, /query\.nuevo === "1"/);
  assert.match(followUpDetail, /primary-button md:col-span-2"[\s\S]{0,80}Registrar intento/);
  assert.match(followUpDetail, /secondary-button md:col-span-2"[\s\S]{0,80}Guardar resultado/);
});
test("Recordatorios distingue preparado, programado y enviado simulado", () => {
  for (const label of ["Preparado", "Programado, sin envío real", "Enviado en simulación"]) assert.match(reminders, new RegExp(label));
  assert.match(reminders, /proveedores live siguen desactivados/);
});
test("Automatizaciones muestra estado, trigger, próxima ejecución, fallos y retries", () => {
  for (const token of ["data-automation-state", "Trigger:", "Próxima:", "fallos", "retries"]) assert.match(automations, new RegExp(token));
});
test("Automatizaciones conserva cooldown, retries y confirmación humana", () => {
  assert.match(automationDetail, /requiresConfirmation/);
  assert.match(automationDetail, /cooldownSeconds/);
  assert.match(automationRetries, /nextRetryAt/);
  assert.match(automationRunner, /waiting_confirmation/);
});
test("Review incluye estados sintéticos D7 sin providers live", () => {
  for (const id of ["review-contact-1", "review-event-5", "review-task-7", "review-followup-1", "review-reminder-prepared-1", "review-reminder-sent-1", "review-automation-1", "review-automation-run-1"]) assert.match(provisioner, new RegExp(id));
  assert.match(provisioner, /requiresConfirmation: true/);
  assert.match(provisioner, /ningún proveedor live/);
});

console.log(`[design-d7] ${results.length}/${results.length}`);
for (const name of results) console.log(`[design-d7] OK ${name}`);
