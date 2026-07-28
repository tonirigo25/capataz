import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { rotateSessionRecord } from "../../lib/auth/session-store";
import { enqueueBusinessEvent, claimOutboxBatch, completeOutboxEvent } from "../../lib/platform/outbox";
import { executeIdempotent } from "../../lib/platform/idempotency";
import { consumeRateLimit } from "../../lib/platform/rate-limit";
import { persistVerifiedWebhook } from "../../lib/platform/webhooks";
import { readEncryptedCredential, storeEncryptedCredential } from "../../lib/platform/credentials";
import { assignCompanyTeamMember, createCompanyTeam } from "../../lib/application/company/team-service";
import { createCorrelationProbe } from "../../lib/application/readiness/correlation-probe-service";
import { processCorrelationProbeEvent } from "../../lib/application/readiness/correlation-probe-worker";
import { withActionOperationContext } from "../../lib/platform/action-operation";
import { FakeObservabilityProvider } from "../../lib/platform/providers/fake";

async function main() {
 const prisma = new PrismaClient();
 try {
  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  if (migrations[0]?.count !== 44) throw new Error(`EXPECTED_44_MIGRATIONS_FOUND_${migrations[0]?.count}`);
  const companyA = await prisma.company.create({ data: { id: "f2-company-a", slug: "f2-company-a", nombreComercial: "F2 A" } });
  const companyB = await prisma.company.create({ data: { id: "f2-company-b", slug: "f2-company-b", nombreComercial: "F2 B" } });
  const keyring = { activeVersion: "f2", keys: new Map([["f2", randomBytes(32)]]) };
  const credential = await storeEncryptedCredential({ prisma, companyId: companyA.id, purpose: "stripe.webhook", plaintext: "f2-plaintext-secret", keyring });
  if (credential.ciphertext.includes("f2-plaintext-secret") || await readEncryptedCredential({ prisma, companyId: companyA.id, purpose: "stripe.webhook", keyring }) !== "f2-plaintext-secret") throw new Error("ENCRYPTED_CREDENTIAL_PERSISTENCE_FAILED");
  const user = await prisma.user.create({ data: { id: "f2-user", email: "f2@example.invalid", emailNormalized: "f2@example.invalid", passwordHash: "not-a-real-password", displayName: "F2", status: "active", emailVerifiedAt: new Date() } });
  const userB = await prisma.user.create({ data: { id: "f2-user-b", email: "f2-b@example.invalid", emailNormalized: "f2-b@example.invalid", passwordHash: "not-a-real-password", displayName: "F2 B", status: "active", emailVerifiedAt: new Date() } });
  const [membershipA, membershipB] = await Promise.all([
    prisma.companyMembership.create({ data: { userId: user.id, companyId: companyA.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() } }),
    prisma.companyMembership.create({ data: { userId: userB.id, companyId: companyB.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() } }),
  ]);
  const teamA = await createCompanyTeam(prisma, { companyId: companyA.id, userId: user.id }, { name: "F2 Team A" });
  let crossTenantRejected = false;
  try {
    await assignCompanyTeamMember(prisma, { companyId: companyA.id, userId: user.id }, { teamId: teamA.id, membershipId: membershipB.id });
  } catch (error) {
    crossTenantRejected = error instanceof Error && error.message === "CROSS_COMPANY_TEAM_FORBIDDEN";
  }
  if (!crossTenantRejected || await prisma.teamMembership.count({ where: { teamId: teamA.id, membershipId: membershipB.id } })) throw new Error("ACTION_SERVICE_TENANT_ISOLATION_FAILED");
  await prisma.auditLog.create({ data: { id: "f2-team-rollback", companyId: companyA.id, userActorId: user.id, action: "fixture", targetType: "Team" } });
  let teamTransactionRolledBack = false;
  try {
    await createCompanyTeam(prisma, { companyId: companyA.id, userId: user.id }, { name: "F2 Must Roll Back", auditId: "f2-team-rollback" });
  } catch {
    teamTransactionRolledBack = true;
  }
  if (!teamTransactionRolledBack || await prisma.team.count({ where: { companyId: companyA.id, name: "F2 Must Roll Back" } })) throw new Error("ACTION_SERVICE_TRANSACTION_ROLLBACK_FAILED");
  const correlationId = "f2-action-service-worker-provider";
  const requestId = "f2-action-request";
  const actionContext = {
    requestId,
    correlationId,
    actor: { type: "user" as const, id: user.id },
    companyId: companyA.id,
    membershipId: membershipA.id,
    operation: "action.readiness.correlation_probe",
    release: "f2-local-validation",
    environment: "isolated-test",
  };
  const probe = await withActionOperationContext(actionContext, () => createCorrelationProbe(prisma, { companyId: companyA.id, userId: user.id, membershipId: membershipA.id }, { targetCompanyId: companyA.id, idempotencyKey: "f2-correlation-probe" }));
  let probeTenantRejected = false;
  try {
    await withActionOperationContext({ ...actionContext, requestId: "f2-cross-tenant-request", correlationId: "f2-cross-tenant-correlation" }, () => createCorrelationProbe(prisma, { companyId: companyA.id, userId: user.id, membershipId: membershipA.id }, { targetCompanyId: companyB.id, idempotencyKey: "f2-cross-tenant-probe" }));
  } catch (error) {
    probeTenantRejected = error instanceof Error && error.message === "CORRELATION_PROBE_CROSS_TENANT_FORBIDDEN";
  }
  if (!probeTenantRejected || await prisma.businessEvent.count({ where: { idempotencyKey: "f2-cross-tenant-probe" } })) throw new Error("CORRELATION_PROBE_TENANT_NEGATIVE_FAILED");
  const probeEvents = await claimOutboxBatch(prisma, "fake-observability");
  if (probeEvents.length !== 1 || probeEvents[0].id !== probe.eventId) throw new Error("CORRELATION_PROBE_CLAIM_FAILED");
  const fakeObservability = new FakeObservabilityProvider();
  const delivered = await processCorrelationProbeEvent(prisma, probeEvents[0], fakeObservability);
  const replayedDelivery = await processCorrelationProbeEvent(prisma, probeEvents[0], fakeObservability);
  const [probeAudits, persistedProbe] = await Promise.all([
    prisma.auditLog.findMany({ where: { correlationId }, orderBy: { createdAt: "asc" } }),
    prisma.businessEvent.findUniqueOrThrow({ where: { id: probe.eventId } }),
  ]);
  if (delivered.replayed || !replayedDelivery.replayed || fakeObservability.events.length !== 1) throw new Error("CORRELATION_PROBE_REPLAY_EFFECT_FAILED");
  if (probeAudits.length !== 2 || probeAudits.some((audit) => audit.correlationId !== correlationId || audit.requestId == null || audit.operation == null)) throw new Error("CORRELATION_PROBE_AUDIT_CONTEXT_FAILED");
  if (persistedProbe.correlationId !== correlationId || persistedProbe.requestId !== requestId || persistedProbe.operation !== actionContext.operation) throw new Error("CORRELATION_PROBE_EVENT_CONTEXT_FAILED");
  if (fakeObservability.events[0].fields.correlationId !== correlationId || fakeObservability.events[0].requestId !== probe.eventId) throw new Error("CORRELATION_PROBE_PROVIDER_CONTEXT_FAILED");
  const old = await prisma.session.create({ data: { userId: user.id, tokenHash: "old-token-hash", expiresAt: new Date(Date.now() + 60_000) } });
  const rotated = await rotateSessionRecord({ prisma, sessionId: old.id, userId: user.id, expiresAt: new Date(Date.now() + 120_000) });
  const oldAfter = await prisma.session.findUniqueOrThrow({ where: { id: old.id } });
  if (!oldAfter.revokedAt || rotated.session.revokedAt) throw new Error("SESSION_ROTATION_DID_NOT_INVALIDATE_OLD_TOKEN");

  let operations = 0;
  const idempotentInput = { prisma, companyId: companyA.id, namespace: "f2", key: "same-key", request: { amount: "12.34" }, operation: async () => ({ operation: ++operations }) };
  const first = await executeIdempotent(idempotentInput);
  const replay = await executeIdempotent(idempotentInput);
  if (operations !== 1 || first.replayed || !replay.replayed) throw new Error("IDEMPOTENCY_REPLAY_FAILED");

  const attemptsA = await Promise.all(Array.from({ length: 8 }, () => consumeRateLimit({ prisma, scope: "concurrent", subject: "actor", companyId: companyA.id, limit: 5, windowMs: 60_000 })));
  const attemptsB = await Promise.all(Array.from({ length: 3 }, () => consumeRateLimit({ prisma, scope: "concurrent", subject: "actor", companyId: companyB.id, limit: 5, windowMs: 60_000 })));
  if (attemptsA.filter((item) => item.allowed).length !== 5 || attemptsB.some((item) => !item.allowed)) throw new Error("RATE_LIMIT_TENANT_ISOLATION_FAILED");

  let rolledBack = false;
  try {
    await prisma.$transaction(async (transaction) => {
      await enqueueBusinessEvent(transaction, { type: "f2.rollback", entityType: "Validation", entityId: "rollback", destination: "validation", idempotencyKey: "rollback", correlationId: "f2" });
      throw new Error("ROLLBACK_EXPECTED");
    });
  } catch { rolledBack = true; }
  if (!rolledBack || await prisma.businessEvent.count({ where: { idempotencyKey: "rollback" } })) throw new Error("OUTBOX_ROLLBACK_FAILED");
  await prisma.$transaction(async (transaction) => enqueueBusinessEvent(transaction, { type: "f2.commit", entityType: "Validation", entityId: "commit", destination: "validation", idempotencyKey: "commit", correlationId: "f2" }));
  const claimed = await claimOutboxBatch(prisma, "validation");
  if (claimed.length !== 1 || claimed[0].idempotencyKey !== "commit") throw new Error("OUTBOX_CLAIM_FAILED");
  await completeOutboxEvent(prisma, claimed[0].id);

  const rawBody = JSON.stringify({ id: "f2-event" });
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = "f2-webhook-secret";
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const webhookInput = { provider: "fiscal", externalEventId: "event-1", eventType: "accepted", rawBody, signature, timestamp, secret, companyId: companyA.id };
  const accepted = await persistVerifiedWebhook(prisma, webhookInput);
  const duplicate = await persistVerifiedWebhook(prisma, webhookInput);
  if (accepted.replayed || !duplicate.replayed || await prisma.webhookEvent.count({ where: { provider: "fiscal", externalEventId: "event-1" } }) !== 1) throw new Error("WEBHOOK_REPLAY_PROTECTION_FAILED");

  console.log(JSON.stringify({ ok: true, migrations: migrations[0].count, encryptedCredential: true, sessionRotation: true, idempotentOperations: operations, tenantAAllowed: attemptsA.filter((item) => item.allowed).length, tenantBAllowed: attemptsB.filter((item) => item.allowed).length, actionServiceCrossTenantRejected: crossTenantRejected, actionServiceTransactionRollback: teamTransactionRolledBack, correlationProbeTenantRejected: probeTenantRejected, correlationSearchAuditRows: probeAudits.length, correlationProviderEffects: fakeObservability.events.length, correlationReplayDetected: replayedDelivery.replayed, membershipA: membershipA.companyId === companyA.id, outboxRollback: true, outboxClaimed: claimed.length, webhookReplay: duplicate.replayed }, null, 2));
 } finally {
   await prisma.$disconnect();
 }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
