import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync("app/(app)/capataz/actions.ts", "utf8");
const component = readFileSync("components/capataz-chat.tsx", "utf8");
const repository = readFileSync("lib/orqena/conversation-repository.ts", "utf8");

assert.match(actions, /conversation-repository/, "Capataz server actions must delegate conversation persistence to the tenant-safe repository");
for (const unsafe of ["prisma.chatConversation.", "prisma.chatMessage.", "prisma.chatActionLog."]) {
  assert.equal(actions.includes(unsafe), false, `Capataz actions retain unsafe direct access: ${unsafe}`);
}

assert.match(component, /orqena-chat-conversation-id:\$\{companyId\}/, "Conversation selection storage must be segmented by company");
assert.doesNotMatch(component, /(?:const\s+chatConversationStorageKey\s*=\s*["'])capataz-chat-conversation-id/, "Legacy global conversation storage key remains");
for (const reset of [
  "setConversationId(\"\")", "setConversations([])", "setChatContext(null)",
  "activeConversationRef.current = \"\"", "followLatestRef.current = true"
]) assert.ok(component.includes(reset), `Company switch must reset ${reset}`);
assert.match(component, /companyGenerationRef/, "Late results need a company generation guard");
assert.match(component, /canApplyCompanyResult/, "Late company results must be rejected before rendering");

for (const invariant of [
  /where\s*:\s*\{[\s\S]{0,180}companyId/,
  /idempotencyKey[\s\S]{0,500}companyId/
]) assert.match(repository, invariant, `Repository is missing tenancy invariant ${invariant}`);
assert.match(repository, /companyId\s*:\s*string/, "Repository companyId must be mandatory; this also excludes legacy null conversations");
assert.doesNotMatch(repository, /companyId\s*\?\s*:/, "Repository must not admit an unscoped company context");

assert.match(repository, /count\s*!==?\s*1|count\s*===?\s*0|NOT_FOUND|not found|no disponible/i, "Cross-tenant mutations must fail closed without revealing existence");
console.log(JSON.stringify({ ok: true, checks: ["server-delegation", "cross-tenant-ids", "idempotency", "legacy-null", "company-storage", "late-result-generation"] }));
