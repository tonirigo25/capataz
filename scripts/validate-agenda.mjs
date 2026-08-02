import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const agendaLib = fs.readFileSync("lib/agenda.ts", "utf8");
const tenantCore = fs.readFileSync("lib/tenant/core.ts", "utf8");
const agendaPage = fs.readFileSync("app/(app)/agenda/page.tsx", "utf8");
const actions = fs.readFileSync("app/(app)/gestion/actions.ts", "utf8");
const managementUseCases = fs.readFileSync("lib/application/operations/management-use-cases.ts", "utf8");
const gestionPage = fs.readFileSync("app/(app)/gestion/page.tsx", "utf8");
const chatQuery = fs.readFileSync("lib/capataz-chat-query.ts", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[agenda] FAIL", message);
    process.exit(1);
  }
}

expect(schema.includes("model EventoAgenda") && schema.includes("model Reminder"), "missing agenda/reminder models");
expect(schema.includes("contactId") && schema.includes("Contact?"), "agenda/reminders are not contact-aware");
for (const view of ["Hoy", "Semana", "Mes", "Lista"]) expect(agendaPage.includes(view), `missing agenda view ${view}`);
for (const token of ["itemsForDay", "itemsBetween", "contactName", "filterAgendaItems"]) expect(agendaLib.includes(token) || agendaPage.includes(token), `missing agenda token ${token}`);
expect(schema.includes("enum EventoAgendaEstado") && managementUseCases.includes("EventoAgendaEstado"), "agenda state enum is not wired");
expect(managementUseCases.includes("contactId") && managementUseCases.includes("saveAgendaEvent") && managementUseCases.includes("saveReminder"), "agenda/reminder actions do not persist contact links");
expect(actions.includes("saveManualRecordUseCase"), "agenda management boundary is not wired");
expect(gestionPage.includes('tipoEvento=visita') || gestionPage.includes("eventoAgenda"), "missing agenda management form");
expect(chatQuery.includes('"agenda_today"') && chatQuery.includes('"upcoming_visits"') && chatQuery.includes('"pending_reminders_count"'), "chat does not cover agenda/visits/reminders");
expect(agendaLib.includes('resolveScopedEntityIds(context, "agenda.view", "Client")'), "agenda does not preserve selected-client scope");
expect(tenantCore.includes("scopedClientIds") && tenantCore.includes("clienteId: { in: scopedClientIds }"), "agenda source query is not client-scope aware");
expect(agendaLib.includes("presupuestoId: budgetAllowed &&") && agendaLib.includes("facturaId: invoiceAllowed &&"), "agenda leaks economic relations without their capability");
expect(agendaLib.includes("budget.fechaSeguimiento &&") && !agendaLib.includes("addDays(budget.fechaEnvio ?? budget.fechaCreacion, 3)"), "agenda presents a derived budget follow-up as a confirmed date");

console.log("[agenda] OK views, contact links, reminders and chat query support");
