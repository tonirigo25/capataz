import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/crypto";
import { withCompanyContext, requireCompanyContext, type CompanyContext } from "../lib/auth/session";
import {
  appendMessageForCompany,
  archiveConversationForCompany,
  beginPendingProposalExecutionForCompany,
  cancelPendingProposalForCompany,
  createConversationForCompany,
  deleteConversationForCompany,
  getConversationForCompany,
  listConversationsForCompany,
  renameConversationForCompany,
  touchConversationForCompany,
  type ConversationTenantContext
} from "../lib/orqena/conversation-repository";

function assertIsolatedDatabase() {
  if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED !== "true") throw new Error("CAPATAZ_TEST_DATABASE_ISOLATED=true es obligatorio.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL aislada es obligatoria.");
  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, "");
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || !database.startsWith('capataz_test')) throw new Error("La prueba sólo puede usar PostgreSQL local capataz_test*.");
}

async function main() {
assertIsolatedDatabase();
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const companies = await Promise.all([
  prisma.company.create({ data: { slug: `orqena-a-${suffix}`, nombreComercial: `Orqena A ${suffix}` } }),
  prisma.company.create({ data: { slug: `orqena-b-${suffix}`, nombreComercial: `Orqena B ${suffix}` } })
]);
const [companyA, companyB] = companies;
const passwordHash = await hashPassword("Orqena-integration-fixture-2026!");
const [userA, userB] = await Promise.all([
  prisma.user.create({ data: { email: `a-${suffix}@orqena.invalid`, emailNormalized: `a-${suffix}@orqena.invalid`, displayName: "A", passwordHash, status: "active", emailVerifiedAt: new Date() } }),
  prisma.user.create({ data: { email: `b-${suffix}@orqena.invalid`, emailNormalized: `b-${suffix}@orqena.invalid`, displayName: "B", passwordHash, status: "active", emailVerifiedAt: new Date() } })
]);
const [membershipA, membershipB] = await Promise.all([
  prisma.companyMembership.create({ data: { userId: userA.id, companyId: companyA.id, role: "OWNER", status: "active" } }),
  prisma.companyMembership.create({ data: { userId: userB.id, companyId: companyB.id, role: "OWNER", status: "active" } })
]);
const contextA: ConversationTenantContext = { userId: userA.id, membershipId: membershipA.id, companyId: companyA.id };
const contextB: ConversationTenantContext = { userId: userB.id, membershipId: membershipB.id, companyId: companyB.id };

try {
  const [conversationA, conversationB] = await Promise.all([
    createConversationForCompany(contextA, { title: "Tenant A secret" }),
    createConversationForCompany(contextB, { title: "Tenant B own" })
  ]);
  await appendMessageForCompany(contextA, conversationA.id, { role: "user", content: "A private", idempotencyKey: "same-key" });
  await appendMessageForCompany(contextB, conversationB.id, { role: "user", content: "B private", idempotencyKey: "same-key" });
  assert.equal((await listConversationsForCompany(contextB)).some((item) => item.id === conversationA.id || item.title.includes("A secret")), false);
  assert.equal(await getConversationForCompany(contextB, conversationA.id), null);
  await assert.rejects(renameConversationForCompany(contextB, conversationA.id, "leak"), /no disponible/i);
  await assert.rejects(archiveConversationForCompany(contextB, conversationA.id), /no disponible/i);
  assert.equal(await deleteConversationForCompany(contextB, conversationA.id), false);

  const pending = { id: `confirmation-${suffix}`, companyId: companyA.id, conversationId: conversationA.id, userId: contextA.userId, membershipId: contextA.membershipId, action: "create_client", entityType: "client", payload: {}, review: {}, status: "PENDING", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  await touchConversationForCompany(contextA, conversationA.id, { pendingConfirmation: pending });
  await assert.rejects(cancelPendingProposalForCompany(contextB, conversationA.id, pending.id), /no disponible/i);
  await assert.rejects(cancelPendingProposalForCompany({ ...contextA, userId: "other-user" }, conversationA.id, pending.id), /no disponible/i);
  assert.equal((await cancelPendingProposalForCompany(contextA, conversationA.id, pending.id)).alreadyCancelled, false);
  assert.equal((await cancelPendingProposalForCompany(contextA, conversationA.id, pending.id)).alreadyCancelled, true);
  await assert.rejects(beginPendingProposalExecutionForCompany(contextA, conversationA.id, pending.id), /no disponible/i);

  const fullA: CompanyContext = { sessionId: "session-a", email: "a@example.invalid", displayName: "A", expiresAt: new Date(Date.now() + 60_000), role: "OWNER", isDemo: false, companyName: companyA.nombreComercial, companyStatus: "active", commercialStatus: "ACTIVE", ...contextA };
  const fullB: CompanyContext = { ...fullA, sessionId: "session-b", userId: contextB.userId, membershipId: contextB.membershipId, companyId: contextB.companyId, email: "b@example.invalid", displayName: "B", companyName: companyB.nombreComercial };
  const [fixedA, fixedB] = await Promise.all([
    withCompanyContext(fullA, async () => { await new Promise((resolve) => setTimeout(resolve, 20)); return (await requireCompanyContext()).companyId; }),
    withCompanyContext(fullB, async () => (await requireCompanyContext()).companyId)
  ]);
  assert.deepEqual([fixedA, fixedB], [companyA.id, companyB.id]);
  console.log(JSON.stringify({ ok: true, checks: ["cross-tenant-read", "cross-tenant-mutations", "tenant-idempotency", "actor-bound-cancel", "cancel-idempotency", "cancelled-cannot-execute", "async-context-race"] }));
} finally {
  await prisma.chatActionLog.deleteMany({ where: { companyId: { in: companies.map((item) => item.id) } } });
  await prisma.chatMessage.deleteMany({ where: { companyId: { in: companies.map((item) => item.id) } } });
  await prisma.chatConversation.deleteMany({ where: { companyId: { in: companies.map((item) => item.id) } } });
  await prisma.companyMembership.deleteMany({ where: { companyId: { in: companies.map((item) => item.id) } } });
  await prisma.company.deleteMany({ where: { id: { in: companies.map((item) => item.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
}
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
});
