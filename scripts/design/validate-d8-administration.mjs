import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assistantPage = read("app/(app)/capataz/page.tsx");
const assistant = read("components/capataz-chat.tsx");
const team = read("app/(app)/equipo/page.tsx");
const teamActions = read("app/(app)/equipo/actions.ts");
const onboarding = read("app/(app)/onboarding/page.tsx");
const onboardingUseCase = read("lib/application/company/onboarding-use-case.ts");
const settings = read("app/(app)/configuracion/page.tsx");
const importPage = read("app/(app)/configuracion/importar/page.tsx");
const provisioner = read("scripts/readiness/provision-continuous-review.ts");
const results = [];

function test(name, check) {
  check();
  results.push(name);
}

test("Orqena usa historial, conversación y propuesta en tres paneles", () => {
  assert.match(assistant, /data-d8-assistant-workspace/);
  assert.match(assistant, /lg:grid-cols-\[240px_minmax\(0,1fr\)_340px\]/);
  assert.match(assistant, /data-d8-proposal-panel/);
  assert.match(assistant, /<ChatHistoryPanel/);
});
test("Orqena muestra campos y efectos antes de aplicar", () => {
  for (const label of ["Propuesta estructurada", "Revisar antes de guardar", "Efecto que ocurriría", "Nada se aplica sin tu confirmación"]) {
    assert.match(assistant, new RegExp(label));
  }
});
test("Orqena ofrece revisar, guardar y descartar con confirmación humana", () => {
  for (const label of ["Guardar y aplicar", "Revisar campos", "Descartar"]) assert.match(assistant, new RegExp(label));
  assert.match(assistant, /executePendingProposal/);
  assert.match(assistant, /cancelPendingProposal/);
});
test("Orqena conserva voz, transcripción, memoria e historial", () => {
  for (const token of ["Dictar por voz", "Transcribiendo audio", "Memoria de Orqena", "Historial aislado"]) assert.match(assistant, new RegExp(token));
});
test("Orqena mantiene aislamiento de empresa, persona y capacidades", () => {
  for (const token of ["requireCompanyContext", "getEffectiveCapabilities", "resolveScopedEntityIds"]) assert.match(assistantPage, new RegExp(token));
  assert.match(assistant, /canApplyCompanyResult/);
  assert.match(assistant, /expectedCompanyId === activeCompanyId/);
});
test("Orqena no presenta instrucciones o diagnósticos internos", () => {
  assert.match(assistant, /No se muestran instrucciones internas/);
  assert.doesNotMatch(assistant, />System prompt</i);
  assert.doesNotMatch(assistant, />Diagnóstico interno</i);
});

test("Equipo usa lista de personas y portal resultante", () => {
  assert.match(team, /data-d8-team-workspace/);
  assert.match(team, /aria-label="Lista de personas"/);
  assert.match(team, /data-d8-resulting-portal/);
});
test("Portal resultante resume perfil, alcance, modo y MFA", () => {
  for (const label of ["Perfil", "Alcance", "Modo", "MFA"]) assert.match(team, new RegExp(`label="${label}"`));
  assert.match(team, /mfaFactors/);
});
test("Portal resultante resume paquetes, campos económicos y aprobación", () => {
  for (const label of ["Paquetes", "Campos económicos", "Aprobación"]) assert.match(team, new RegExp(`label="${label}"`));
  assert.match(team, /accessPackages/);
  assert.match(team, /fieldVisibilityPolicies/);
  assert.match(team, /approvalAuthorities/);
});
test("Equipo exige preview antes de aplicar cambios sensibles", () => {
  assert.match(team, /Previsualizar antes de aplicar/);
  assert.match(team, /\/equipo\/\$\{selectedMember\.id\}\/portal/);
  assert.match(team, /Ningún ajuste se aplica desde este resumen/);
});
test("Equipo conserva el ciclo completo de invitación", () => {
  for (const action of ["inviteMember", "updatePendingInvitation", "approveInvitation", "rejectInvitation", "revokeInvitation"]) {
    assert.match(teamActions, new RegExp(action));
  }
  assert.match(team, /Pendiente de aprobación del propietario/);
  assert.match(provisioner, /review-invitation-1/);
});
test("Equipo muestra un único editor focal, no formularios en cascada", () => {
  assert.match(team, /members\.filter\(\(member\) => !selectedMember \|\| member\.id === selectedMember\.id\)/);
  assert.match(team, /id="ajustes-persona"/);
  assert.match(team, /<details id="invitar"/);
});

test("Onboarding presenta cinco hitos de primer valor", () => {
  for (const label of ["Empresa", "Perfil", "Primer cliente", "Primer presupuesto", "Primer documento"]) assert.match(onboarding, new RegExp(`label: "${label}"`));
  assert.match(onboarding, /data-onboarding-milestones/);
});
test("Onboarding declara y guía un objetivo inferior a quince minutos", () => {
  assert.match(onboarding, /menos de 15 minutos/);
  assert.match(onboarding, /Objetivo: &lt;15 min/);
});
test("Onboarding enlaza importación con preview, apply y rollback reales", () => {
  assert.match(onboarding, /previsualizar → aplicar → rollback/);
  assert.match(onboarding, /\/configuracion\/importar/);
  for (const action of ["previewImport", "applyImport", "rollbackImport"]) assert.match(importPage, new RegExp(action));
});
test("Onboarding conserva modo manual y explica configurar más tarde", () => {
  assert.match(onboarding, /Seguir en modo manual/);
  assert.match(onboarding, /Configurar más tarde/);
  assert.match(onboarding, /ningún provider se activará/);
});
test("Onboarding se protege para OWNER y ADMIN en servidor", () => {
  assert.match(onboardingUseCase, /requireCompanyRole\(\["OWNER", "ADMIN"\]\)/);
  assert.match(onboarding, /\["OWNER", "ADMIN"\]\.includes\(auth\.role\)/);
});

test("Configuración ofrece sidebar por áreas y deep links", () => {
  for (const label of ["Datos personales", "Empresa", "Fiscal y documentos", "Equipo", "Integraciones", "Seguridad", "Plan y uso", "Zona sensible"]) {
    assert.match(settings, new RegExp(label));
  }
  assert.match(settings, /data-d8-settings-workspace/);
});
test("Configuración separa perfil personal de empresa", () => {
  assert.match(settings, /id="perfil"/);
  assert.match(settings, /id="empresa"/);
  assert.match(settings, /no sustituyen los datos fiscales/);
});
test("Configuración incorpora checklist de preparación", () => {
  assert.match(settings, /data-settings-readiness/);
  for (const label of ["Perfil personal", "Datos de empresa", "Seguridad y MFA", "Equipo y permisos", "Modo manual"]) assert.match(settings, new RegExp(label));
});
test("Configuración reduce el mega formulario con áreas progresivas", () => {
  assert.match(settings, /<details id="fiscal-documentos"/);
  assert.match(settings, /<summary className="cursor-pointer font-black text-obra-ink">Marca<\/summary>/);
  assert.match(settings, /Archivos privados de marca/);
});
test("Configuración declara que el modo manual no depende de providers", () => {
  assert.match(settings, /Funciona sin providers live/);
  assert.match(settings, /Cada área aplica permisos y capacidades comerciales en servidor/);
});

console.log(`[design-d8] ${results.length}/${results.length}`);
for (const name of results) console.log(`[design-d8] OK ${name}`);
