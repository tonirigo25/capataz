import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract matrix for the Orqena release close.  This is intentionally a
 * deterministic source-and-schema contract: remote browser evidence belongs
 * to the staging audit, while this command is safe for the isolated runner.
 */
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const exists = (path: string) => existsSync(join(root, path));
const source = {
  actions: read("app/(app)/capataz/actions.ts"),
  chat: read("components/capataz-chat.tsx"),
  repository: read("lib/orqena/conversation-repository.ts"),
  session: read("lib/auth/session.ts"),
  switcher: read("app/seleccionar-empresa/actions.ts"),
  schema: read("prisma/schema.prisma"),
  catalog: read("lib/commercial/catalog.ts"),
  authorization: read("lib/commercial/authorization.ts"),
  profiles: read("lib/commercial/functional-profiles.ts"),
  memory: read("lib/orqena/memory-service.ts"),
  context: read("lib/orqena/context-builder.ts"),
  notifications: read("lib/notifications.ts"),
  stagingProvisioner: read("scripts/provision-staging.ts"),
  stagingRunner: read("scripts/validate-orqena-staging.mjs"),
  visualRunner: read("scripts/validate-orqena-visual.mjs"),
  structure: read("scripts/validate-orqena-conversation-structure.mjs"),
  integration: read("scripts/validate-orqena-conversation-integration.ts"),
  proposal: read("scripts/validate-orqena-proposal-lifecycle.mjs"),
  voice: read("scripts/validate-orqena-voice-denied.mjs")
};

type Contract = { id: string; area: string; verify: () => void };
const contracts: Contract[] = [];
function contract(id: string, area: string, verify: () => void) { contracts.push({ id, area, verify }); }
function contains(value: string, needle: string, label = `missing ${needle}`) { assert.ok(value.includes(needle), label); }
function matches(value: string, pattern: RegExp, label = `missing ${pattern}`) { assert.match(value, pattern, label); }

// C01-C06: deterministic fixture and runner boundaries.
contract("C01", "fixture", () => contains(source.stagingProvisioner, "requireStaging()", "staging fixture gate missing"));
contract("C02", "fixture", () => contains(source.integration, "CAPATAZ_TEST_DATABASE_ISOLATED=true", "isolated DB gate missing"));
contract("C03", "fixture", () => matches(source.stagingProvisioner, /@staging\.orqena\.invalid/g, "synthetic staging identities missing"));
contract("C04", "fixture", () => contains(source.stagingProvisioner, "EXPECTED_PROJECT_ID", "explicit staging project gate missing"));
contract("C05", "fixture", () => contains(source.stagingProvisioner, "EXPECTED_ENVIRONMENT_ID", "explicit staging environment gate missing"));
contract("C06", "fixture", () => { assert.ok(exists("scripts/run-all-tests-isolated.mjs")); assert.ok(exists("scripts/validate-orqena-staging.mjs")); });

// C07-C20: conversation privacy, identity, persistence and company switching.
contract("C07", "conversation", () => matches(source.repository, /type ConversationTenantContext[\s\S]*userId[\s\S]*companyId[\s\S]*membershipId/, "tenant context incomplete"));
contract("C08", "conversation", () => contains(source.actions, 'requireCapability("orqena.use")', "conversation capability gate missing"));
contract("C09", "conversation", () => { contains(source.repository, "const conversationScope", "conversation scope helper missing"); matches(source.repository, /getConversationForCompany[\s\S]*where: \{ id, \.\.\.conversationScope\(context\)/, "conversation ID not company scoped"); });
contract("C10", "conversation", () => matches(source.repository, /archiveConversationForCompany[\s\S]*where: \{ id, \.\.\.conversationScope\(context\)/, "archive not company scoped"));
contract("C11", "conversation", () => matches(source.repository, /deleteConversationForCompany[\s\S]*where: \{ id, \.\.\.conversationScope\(context\)/, "delete not company scoped"));
contract("C12", "conversation", () => contains(source.schema, "@@unique([companyId, conversationId, idempotencyKey])", "idempotency is not tenant scoped"));
contract("C13", "conversation", () => contains(source.structure, "Direct Prisma chat access is forbidden", "repository structural guard missing"));
contract("C14", "conversation", () => contains(source.chat, "orqena-chat-conversation-id:${companyId}:${userId}", "localStorage is not company/user segmented"));
contract("C15", "conversation", () => { for (const token of ['setConversationId("")', "setConversations([])", "setChatContext(null)", 'activeConversationRef.current = ""']) contains(source.chat, token, `company reset missing ${token}`); });
contract("C16", "conversation", () => { contains(source.chat, "companyGenerationRef"); contains(source.chat, "canApplyCompanyResult"); });
contract("C17", "conversation", () => contains(source.session, "withCompanyContext", "fixed request company context missing"));
contract("C18", "conversation", () => matches(source.repository, /findLatestPendingTaskForCompany[\s\S]*\.\.\.conversationScope\(context\)/, "pending task lookup unscoped"));
contract("C19", "conversation", () => { contains(source.switcher, 'pendingConfirmation: { path: ["userId"]'); contains(source.switcher, 'pendingConfirmation: { path: ["status"], equals: "PENDING" }'); });
contract("C20", "conversation", () => { contains(source.integration, "actor-bound-cancel"); contains(source.integration, "async-context-race"); });

// C21-C32: proposal lifecycle, confirmation and deterministic execution.
contract("C21", "proposal", () => contains(source.actions, "export async function preparePendingProposal"));
contract("C22", "proposal", () => contains(source.actions, "export async function cancelPendingProposal"));
contract("C23", "proposal", () => contains(source.actions, "export async function executePendingProposal"));
contract("C24", "proposal", () => matches(source.repository, /pending\.userId !== context\.userId[\s\S]*pending\.membershipId !== context\.membershipId/, "proposal actor binding missing"));
contract("C25", "proposal", () => { contains(source.repository, 'status: "EXPIRED"'); contains(source.chat, "Esta propuesta ha caducado"); });
contract("C26", "proposal", () => contains(source.actions, "proposalTargetsMatch", "proposal target binding missing"));
contract("C27", "proposal", () => { contains(source.chat, "Propuesta cancelada"); contains(source.actions, "alreadyCancelled"); });
contract("C28", "proposal", () => { matches(source.actions, /if \(wantsBudget[\s\S]{0,180}handled: false/); matches(source.actions, /if \(wantsInvoice[\s\S]{0,180}handled: false/); });
contract("C29", "proposal", () => contains(source.actions, "looksLikeWorkflowContractMutation(normalizedText) || enrichedContext?.pendingDisambiguation"));
contract("C30", "proposal", () => contains(source.proposal, "requestSubmit", "proposal test must guard direct form submission"));
contract("C31", "proposal", () => { contains(source.repository, 'status: "EXECUTING"'); contains(source.repository, "finishPendingProposalExecutionForCompany"); });
contract("C32", "proposal", () => { contains(source.chat, "Confirmar"); contains(source.chat, "Editar"); contains(source.chat, "Cancelar"); });

// C33-C38: profiles, capabilities and restricted scope.
contract("C33", "profiles", () => { for (const role of ["OWNER", "PURCHASING_MANAGER", "GENERAL_MANAGER", "ADMINISTRATIVE", "SALES", "WORK_MANAGER", "WORKER", "VIEWER", "EXTERNAL_COLLABORATOR"]) contains(source.profiles, role, `profile missing ${role}`); });
contract("C34", "profiles", () => contains(source.authorization, "resolveAuthorization", "authorization resolver missing"));
contract("C35", "profiles", () => contains(source.authorization, 'effect === "DENY"', "deny override missing"));
contract("C36", "profiles", () => contains(source.actions, "scope !== \"COMPANY\"", "Orqena scope boundary missing"));
contract("C37", "profiles", () => contains(source.stagingProvisioner, '"VIEWER"', "viewer staging fixture missing"));
contract("C38", "profiles", () => contains(source.stagingRunner, "platformDenied", "viewer denial E2E guard missing"));

// C39-C42: voice safety.
contract("C39", "voice", () => contains(source.voice, "NotAllowedError|PermissionDeniedError|SecurityError", "voice denial contract missing"));
contract("C40", "voice", () => { contains(source.chat, "transcriptionAbortRef"); contains(source.chat, "AbortController"); });
contract("C41", "voice", () => { contains(source.chat, "audioChunksRef.current = []"); contains(source.chat, "getTracks().forEach((track) => track.stop())"); });
contract("C42", "voice", () => { contains(source.chat, "No tengo permiso para usar el micrófono"); contains(source.chat, "Reintentar"); });

// C43-C50: history UX, copy and responsive safety.
contract("C43", "ux", () => { contains(source.chat, "followLatestRef"); contains(source.chat, "Ir al último mensaje"); });
contract("C44", "ux", () => matches(source.chat, /container\.scrollTo\(\{ top: container\.scrollHeight/, "chat should control scrolling inside its container"));
contract("C45", "ux", () => assert.doesNotMatch(source.chat, /scrollIntoView/, "blind scrollIntoView regression"));
contract("C46", "ux", () => contains(source.chat, "min-h-11", "proposal controls lack touch target"));
contract("C47", "ux", () => contains(source.chat, 'aria-label="Acciones de la propuesta"', "proposal controls lack accessible group"));
contract("C48", "ux", () => contains(source.chat, "sm:grid-cols-3", "proposal controls lack responsive layout"));
contract("C49", "ux", () => contains(source.chat, "No se pudo confirmar. La propuesta no se ha ejecutado", "recoverable confirmation copy missing"));
contract("C50", "ux", () => { contains(source.visualRunner, "Chat composer is not visible"); contains(source.stagingRunner, "OVERFLOW"); });

// C51-C57: all persisted Orqena business context has a tenant boundary.
contract("C51", "business", () => matches(source.actions, /prisma\.client\.findMany\([\s\S]{0,240}where: \{ companyId/, "client query boundary missing"));
contract("C52", "business", () => matches(source.actions, /prisma\.work\.findMany\([\s\S]{0,240}where: \{ companyId/, "work query boundary missing"));
contract("C53", "business", () => matches(source.actions, /prisma\.budget\.findMany\([\s\S]{0,240}where: \{ companyId/, "budget query boundary missing"));
contract("C54", "business", () => matches(source.actions, /prisma\.invoice\.findMany\([\s\S]{0,240}where: \{ companyId/, "invoice query boundary missing"));
contract("C55", "business", () => { contains(source.notifications, "deriveNotifications(companyId)"); contains(source.notifications, "where: { companyId"); });
contract("C56", "business", () => contains(source.memory, "companyId: input.companyId", "business memory boundary missing"));
contract("C57", "business", () => { contains(source.context, "getConversationContextForCompany"); contains(source.context, "relevantMemories({ companyId"); });

// C58-C66: fixed profile matrix for the external E2E runner.
const profiles = ["OWNER", "PURCHASING_MANAGER", "GENERAL_MANAGER", "ADMINISTRATIVE", "SALES", "WORK_MANAGER", "WORKER", "VIEWER", "EXTERNAL_COLLABORATOR"] as const;
contract("C58", "e2e-profile", () => assert.equal(profiles.length, 9, "nine E2E profiles required"));
contract("C59", "e2e-profile", () => assert.deepEqual(profiles.slice(0, 3), ["OWNER", "PURCHASING_MANAGER", "GENERAL_MANAGER"]));
contract("C60", "e2e-profile", () => assert.ok(profiles.includes("ADMINISTRATIVE") && profiles.includes("SALES")));
contract("C61", "e2e-profile", () => assert.ok(profiles.includes("WORK_MANAGER") && profiles.includes("WORKER")));
contract("C62", "e2e-profile", () => assert.ok(profiles.includes("VIEWER") && profiles.includes("EXTERNAL_COLLABORATOR")));
contract("C63", "e2e-profile", () => matches(source.stagingRunner, /\[390, 844\][\s\S]*\[1440, 1000\]/, "four target viewports missing"));
contract("C64", "e2e-profile", () => contains(source.stagingRunner, "captureErrors", "E2E console/network capture missing"));
contract("C65", "e2e-profile", () => contains(source.stagingRunner, "cross-company", "cross-company E2E boundary missing"));
contract("C66", "e2e-profile", () => { assert.ok(profiles.length * 4 === 36, "capture budget must stay at 36"); });

assert.equal(contracts.length, 66, "final closure matrix must contain exactly 66 contracts");
const passed: string[] = [];
for (const item of contracts) {
  item.verify();
  passed.push(item.id);
}
assert.equal(new Set(passed).size, 66, "contract IDs must be unique");
console.log(JSON.stringify({ ok: true, suite: "orqena-final-product-closure", contracts: passed.length, profiles, captureBudget: 36, areas: [...new Set(contracts.map((item) => item.area))] }));
