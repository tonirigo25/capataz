import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { requestProductDemo } from "../../lib/commercial/demo-service";
import { pruneExpiredDemoRequests } from "../../lib/commercial/demo-retention";

const prisma = new PrismaClient();
const sourceAddress = "127.0.0.42";

async function main() {
  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  assert.equal(migrations[0]?.count, 45);

  const base = {
    email: "synthetic-lead@example.invalid",
    displayName: "Synthetic Lead",
    companyName: "Synthetic Reformas",
    teamSize: "2-5",
    sectorKey: "construction",
    message: "Necesitamos ordenar presupuestos y costes.",
    consent: true,
    sourceAddress,
    source: "home",
    tracking: {
      utmSource: "synthetic-suite",
      utmMedium: "test",
      utmCampaign: "c2",
      landingPath: "/",
      referrerHost: "example.invalid",
      consentVersion: "1.0",
    },
  };

  const created = await requestProductDemo(base);
  const replay = await requestProductDemo(base);
  assert.equal(created.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.id, created.id);
  assert.equal(await prisma.demoRequest.count(), 1);
  assert.equal(await prisma.auditLog.count({ where: { action: "demo_request.created" } }), 1);
  assert.equal(await prisma.emailOutbox.count({ where: { eventKey: "demo_requested" } }), 1);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "demo_request.created" } });
  const metadata = JSON.stringify(audit.metadata);
  assert.match(metadata, /synthetic-suite/u);
  assert.doesNotMatch(metadata, /synthetic-lead@/u);
  assert.match(audit.ipHash ?? "", /^[a-f0-9]{64}$/u);
  assert.notEqual(audit.ipHash, sourceAddress);

  await requestProductDemo({ ...base, companyName: "Synthetic Reformas 2" });
  await assert.rejects(
    () => requestProductDemo({ ...base, companyName: "Synthetic Reformas 3" }),
    /DEMO_RATE_LIMITED/u,
  );

  const now = new Date("2026-07-26T12:00:00.000Z");
  const old = new Date("2026-03-01T12:00:00.000Z");
  await prisma.demoRequest.createMany({ data: [
    { emailNormalized: "expired@example.invalid", displayName: "Expired", companyName: "Expired", consentAt: old, status: "PENDING", requestHash: "expired-retention", createdAt: old },
    { emailNormalized: "hold@example.invalid", displayName: "Hold", companyName: "Hold", consentAt: old, status: "LEGAL_HOLD", requestHash: "legal-hold-retention", createdAt: old },
    { emailNormalized: "fresh@example.invalid", displayName: "Fresh", companyName: "Fresh", consentAt: now, status: "PENDING", requestHash: "fresh-retention", createdAt: now },
  ] });
  const dryRun = await pruneExpiredDemoRequests(prisma, { now, retentionDays: 90, dryRun: true });
  assert.equal(dryRun.candidates, 1);
  assert.equal(dryRun.deleted, 0);
  const applied = await pruneExpiredDemoRequests(prisma, { now, retentionDays: 90, dryRun: false });
  assert.equal(applied.deleted, 1);
  assert.equal(await prisma.demoRequest.count({ where: { requestHash: "legal-hold-retention" } }), 1);
  assert.equal(await prisma.demoRequest.count({ where: { requestHash: "fresh-retention" } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { action: "demo_request.retention_applied" } }), 1);

  process.stdout.write(JSON.stringify({
    ok: true,
    phase: "C2",
    migrations: migrations[0]?.count,
    demoRequests: await prisma.demoRequest.count(),
    firstRequestSideEffects: { audit: 1, emailOutbox: 1 },
    replaySideEffects: 0,
    piiInAuditMetadata: false,
    retention: { dryRunCandidates: dryRun.candidates, deleted: applied.deleted, legalHoldPreserved: true, freshPreserved: true },
  }) + "\n");
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
