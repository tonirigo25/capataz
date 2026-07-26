import { hashPassword, normalizeEmail } from "../../lib/auth/crypto";
import { ensureBasePlans, provisionCompany } from "../../lib/commercial/provisioning";
import { prisma } from "../../lib/prisma";

const expectedEnvironment = "orqena-readiness-f2-staging";
const expectedService = "orqena-readiness-f2-web";
const email = process.env.ORQENA_READINESS_TEST_EMAIL;
const password = process.env.ORQENA_READINESS_TEST_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (
  process.env.ORQENA_READINESS_F2_SEED !== "true"
  || process.env.RAILWAY_ENVIRONMENT_NAME !== expectedEnvironment
  || process.env.RAILWAY_SERVICE_NAME !== expectedService
  || !email
  || !password
  || !databaseUrl
) {
  throw new Error("TEMPORARY_RAILWAY_SEED_GUARD_FAILED");
}

const parsed = new URL(databaseUrl);
if (!parsed.hostname.toLowerCase().includes("orqena-readiness-f2-postgres") || /production|orqena-web-staging/u.test(parsed.hostname)) {
  throw new Error("TEMPORARY_RAILWAY_DATABASE_ISOLATION_FAILED");
}

async function main() {
  await ensureBasePlans(prisma);
  const normalizedEmail = normalizeEmail(email!);
  const user = await prisma.user.upsert({
    where: { emailNormalized: normalizedEmail },
    update: { passwordHash: await hashPassword(password!), status: "active", emailVerifiedAt: new Date() },
    create: {
      email: email!,
      emailNormalized: normalizedEmail,
      passwordHash: await hashPassword(password!),
      displayName: "Readiness Owner",
      status: "active",
      emailVerifiedAt: new Date(),
    },
  });
  const company = await provisionCompany(prisma, {
    userId: user.id,
    name: "Orqena Readiness F2",
    organizationType: "COMPANY",
    sectorKey: "servicios-generales",
    planKey: "BUSINESS",
    idempotencyKey: "orqena-readiness-f2-staging",
    isDemo: true,
  });
  process.stdout.write(`${JSON.stringify({ ok: true, companyId: company.id, userId: user.id })}\n`);
}

main().finally(() => prisma.$disconnect());
