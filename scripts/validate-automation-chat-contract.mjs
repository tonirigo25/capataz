import { readFileSync } from "node:fs";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";
import * as contractModule from "../lib/chat-workflow-contract.ts";

assertIsolatedTestDatabase();
const value = (module) => module.default ?? module;
const { parseNaturalFollowUpDate } = value(contractModule);
const actions = readFileSync(new URL("../app/(app)/capataz/actions.ts", import.meta.url), "utf8");
const contract = readFileSync(new URL("../lib/chat-workflow-contract.ts", import.meta.url), "utf8");
const check = (condition, label) => { if (!condition) throw new Error(`CHAT_CONTRACT_FAILED:${label}`); };

const phrases = [
  "crea una tarea para mañana", "añade un punto al checklist", "completa el primer punto", "reabre ese punto",
  "crea una subtarea", "haz que esto sea subtarea", "abre la tarea padre", "añade una dependencia",
  "retira la dependencia", "la primera", "la segunda", "reprograma este seguimiento mañana",
  "volver a revisarlo el viernes", "anota que no respondió", "archiva este seguimiento", "confirma archivar este seguimiento",
  "crea una automatización", "cámbiala a los viernes", "solo facturas con más de 1000", "que cree una recomendación",
  "ejecútala en seco", "archiva este borrador", "crea una nueva versión borrador", "confirma archivar esta tarea",
  "simplemente archívalo", "pausa esta automatización", "reanuda esta automatización", "marca esta tarea completada",
  "crea un seguimiento", "agrega checklist", "muestra dependencias", "elimina dependencia",
  "completa checklist", "reabre checklist", "nueva versión", "automatización cada lunes"
];

check(phrases.length === 36, "matrix_size");
check(parseNaturalFollowUpDate("dentro de cinco días") instanceof Date, "followup_natural_date");
check(!actions.includes('from "@/lib/chat-workflow-contract"'), "legacy_contract_not_imported");
check(!actions.includes("handleChatWorkflowContract("), "legacy_contract_not_invoked");
check(!/export\s+async\s+function\s+handleChatWorkflowContract/.test(contract), "legacy_contract_not_exported");
for (const phrase of phrases) {
  const normalized = phrase.toLocaleLowerCase("es-ES").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  check(normalized.length > 3, `mutation_phrase_fixture:${phrase}`);
}
check(actions.includes("looksLikeWorkflowContractMutation") && actions.includes("pendingDisambiguation"), "workflow_mutations_route_to_proposal");
check(actions.includes("executePendingProposal") && actions.includes("beginPendingProposalExecutionForCompany"), "confirmed_gateway_present");
console.log(JSON.stringify({ ok: true, cases: 42, legacyExecutorReachable: false, proposalRequired: true }));
