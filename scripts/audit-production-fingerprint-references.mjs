import { PrismaClient } from "@prisma/client";

const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!raw || !/(?:railway|rlwy)/i.test(new URL(raw).hostname)) throw new Error("AUDIT_REQUIRES_RAILWAY_DATABASE");
const prisma = new PrismaClient({ log: [], datasources: { db: { url: raw } } });
try {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `);
  const references = {};
  for (const { name } of tables) {
    const safe = `"${name.replaceAll('"', '""')}"`;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM ${safe} candidate
       WHERE row_to_json(candidate)::text ILIKE $1 OR row_to_json(candidate)::text ILIKE $2
       ORDER BY id`,
      "%4a33f773%",
      "%7a3b51a7%",
    );
    if (rows.length) references[name] = rows.map((row) => row.id);
  }
  const signalDetails = references.BusinessSignalState?.length
    ? await prisma.businessSignalState.findMany({
      where: { id: { in: references.BusinessSignalState } },
      select: {
        id: true, companyId: true, fingerprint: true, type: true, source: true, ruleId: true,
        entityType: true, entityId: true, clientId: true, workId: true, invoiceId: true, budgetId: true,
        createdAt: true, updatedAt: true,
      },
    })
    : [];
  const recommendationDetails = references.BusinessRecommendation?.length
    ? await prisma.businessRecommendation.findMany({
      where: { id: { in: references.BusinessRecommendation } },
      select: {
        id: true, companyId: true, fingerprint: true, signalFingerprint: true, type: true, source: true, ruleId: true,
        entityType: true, entityId: true, clientId: true, workId: true, invoiceId: true, budgetId: true,
        createdAt: true, updatedAt: true,
      },
    })
    : [];
  const signalFingerprints = signalDetails.map((row) => row.fingerprint);
  const recommendationFingerprints = recommendationDetails.map((row) => row.fingerprint);
  const proactiveAuditReferences = await prisma.proactiveAuditEvent.findMany({
    where: {
      OR: [
        { signalFingerprint: { in: signalFingerprints } },
        { recommendationFingerprint: { in: recommendationFingerprints } },
      ],
    },
    select: {
      id: true, runId: true, eventType: true, origin: true, signalFingerprint: true,
      recommendationFingerprint: true, entityType: true, entityId: true, ruleId: true, createdAt: true,
    },
    orderBy: { id: "asc" },
  });
  console.log(JSON.stringify({
    mode: "read-only-audit",
    references,
    total: Object.values(references).reduce((sum, ids) => sum + ids.length, 0),
    signalDetails,
    recommendationDetails,
    proactiveAuditReferences,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
