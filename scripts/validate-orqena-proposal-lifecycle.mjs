import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
function compile(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { exports: {}, require: nativeRequire, console, Date, crypto };
  vm.runInNewContext(output, sandbox, { filename: path });
  return sandbox.exports;
}

const service = compile("lib/orqena/confirmation-service.ts");
const component = readFileSync("components/capataz-chat.tsx", "utf8");
const actions = readFileSync("app/(app)/capataz/actions.ts", "utf8");
const now = Date.now();
const confirmation = service.createPendingConfirmation({ companyId: "company-a", conversationId: "conversation-a", userId: "owner-a", membershipId: "membership-a", action: "create", entityType: "client", payload: { name: "Synthetic" }, review: {} }, 15);
assert.doesNotThrow(() => service.assertConfirmationOwner(confirmation, { companyId: "company-a", conversationId: "conversation-a" }));
assert.throws(() => service.assertConfirmationOwner(confirmation, { companyId: "company-b", conversationId: "conversation-a" }), /no pertenece/i);

const expired = { ...confirmation, expiresAt: new Date(now - 1).toISOString() };
assert.throws(() => service.assertConfirmationOwner(expired, { companyId: "company-a", conversationId: "conversation-a" }), /caduc/i);

assert.match(actions, /export\s+async\s+function\s+preparePendingProposal\s*\(/, "Preparing a proposal must be an explicit server action");
assert.match(actions, /export\s+async\s+function\s+cancelPendingProposal\s*\(/, "Cancellation must be a first-class server action");
assert.match(actions, /export\s+async\s+function\s+executePendingProposal\s*\(/, "Confirmed execution must use a first-class server gateway");
assert.match(actions, /beginPendingProposalExecutionForCompany[\s\S]{0,4500}finishPendingProposalExecutionForCompany/, "The gateway must consume and finish the pending receipt around the business mutation");
assert.doesNotMatch(component, /requestSubmit\s*\(/, "Proposal confirmation must not invoke the original form action directly");
assert.match(component, /executePendingProposal\([^;]+new FormData\(form\)/, "Edited form data must be submitted through the confirmed gateway");
assert.match(actions, /looksLikeExplicitWorkflowMutation[\s\S]{0,600}handled:\s*false/, "Explicit chat mutations must be routed to proposal UI instead of executing immediately");
assert.doesNotMatch(actions, /handleChatWorkflowContract/, "The legacy workflow mutation executor must not be reachable from Orqena");
assert.doesNotMatch(actions, /if \(wantsBudget[\s\S]{0,120}createBudgetDraftFromAI|if \(wantsInvoice[\s\S]{0,120}createInvoiceDraftFromAI|if \(wantsActivity[\s\S]{0,160}registerActivityFromAI/, "AI mutations must emit proposals instead of executing directly");
assert.match(actions, /proposalTargetsMatch/, "Gateway must bind immutable target IDs to the reviewed proposal");
assert.match(actions, /cancelPendingProposal[\s\S]{0,2500}requireCompanyContext\s*\(/, "Cancellation must derive company and actor from the server session");
assert.match(actions, /cancelPendingProposal[\s\S]{0,3500}alreadyCancelled/, "Cancellation must return an idempotent receipt");
assert.match(actions, /cancelPendingProposal[\s\S]{0,3500}(?:companyId|assertConfirmationOwner)/, "Cancellation must validate tenant ownership");
assert.doesNotMatch(actions, /cancelPendingProposal\s*\([^)]*companyId/, "Cancellation must never accept companyId from the browser");

for (const label of ["Confirmar", "Editar", "Cancelar", "Propuesta cancelada", "Esta propuesta ha caducado", "Preparar de nuevo"]) {
  assert.ok(component.includes(label), `Proposal UI is missing: ${label}`);
}
assert.match(component, /type=["']button["'][^>]*>[\s\S]{0,80}Cancelar|aria-label=["'][^"']*Cancelar/i, "Cancelar must be a real accessible button, not navigation");
assert.match(component, /expiresAt|isExpired|expired/i, "Proposal UI must derive and render expiry state");
console.log(JSON.stringify({ ok: true, checks: ["owner", "cross-company", "expiry", "cancel-action", "cancel-idempotency-receipt", "ui-controls"] }));
