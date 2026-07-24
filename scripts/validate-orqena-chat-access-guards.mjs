import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/(app)/capataz/actions.ts", import.meta.url), "utf8");

assert.match(source, /capabilitiesForLocalMutation\(plan\)/, "Orqena local plans must classify mutations");
assert.match(source, /canExecuteOrqenaMutation\(mutationCapabilities\)/, "Orqena mutations must be authorized before execution");
assert.match(source, /decision\.allowed && decision\.scope === "COMPANY"/, "scoped capabilities must not authorize indirect mutations");
for (const capability of [
  "orqena.execute",
  "sales.budgets.create",
  "sales.budgets.update",
  "sales.invoices.create",
  "agenda.manage",
  "treasury.collections.register",
]) {
  assert.ok(source.includes(`"${capability}"`), `missing mutation guard ${capability}`);
}
assert.match(source, /buildPortalManifest\(authorization\)/, "AI context must use PortalManifest field visibility");
for (const capability of ["clients.view", "work.view", "sales.budgets.view", "sales.invoices.view"]) {
  assert.ok(source.includes(`resolveAuthorization(authorization, "${capability}")`), `missing AI context capability ${capability}`);
}
assert.match(source, /resolveScopedEntityIds\(authorization, "clients\.view", "Client"\)/);
assert.match(source, /resolveScopedEntityIds\(authorization, "work\.view", "Work"\)/);
assert.match(source, /scopedRelationWhere\(budgetsDecision\.scope/);
assert.match(source, /scopedRelationWhere\(invoicesDecision\.scope/);
const aiContextSource = source.slice(source.indexOf("async function buildAIContext"), source.indexOf("async function executeAIChatCommand"));
for (const forbidden of ["telefono: true", "email: true", "notas: true", "nombre: true", "direccion: true", "titulo: true", "numero: true", "concepto: true", "client:", "id: true", "clienteId: true", "obraId: true"]) {
  assert.ok(!aiContextSource.includes(forbidden), `AI context must not load external identifier or PII: ${forbidden}`);
}
assert.match(source, /if \(scope === "SELECTED_WORKS"\) return \{ obraId:/);
assert.match(source, /if \(scope === "SELECTED_CLIENTS"\) return \{ clienteId:/);
assert.match(source, /return \{ obraId: \{ in: workIds \?\? \[\] \} \};/, "OWN, ASSIGNED and TEAM must not expand through client relations");
assert.match(source, /interpretCapatazMessageWithAI\(\{ message: text, context: safeAIChatContext\(context\), data \}\)/);
assert.match(source, /chatContext: safeAIChatContext\(context\)/);
const safeContextSource = source.slice(source.indexOf("function safeAIChatContext"), source.indexOf("function scopedRelationWhere"));
for (const forbidden of ["Id", "Name", "draftData", "lastQuestion", "title"]) {
  assert.ok(!safeContextSource.includes(forbidden), `safe AI chat context must omit ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "orqena-chat-access-guards",
  mutationGuard: true,
  readOnlyProtected: true,
  scopedAIContext: true,
  fieldVisibility: true,
  piiExcluded: true,
}));
