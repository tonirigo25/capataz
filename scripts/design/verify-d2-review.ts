import { prisma } from "../../lib/prisma";

const EXPECTED_PROJECT_ID = "c54a5065-df2c-46b9-a82b-cfac3be07315";
const EXPECTED_ENVIRONMENT_ID = "e41b5add-511c-4697-b2b5-48164506f49a";
const EXPECTED_DATABASE_SERVICE_ID = "d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b";
const email = process.env.ORQENA_D2_SYNTHETIC_EMAIL?.trim().toLowerCase();

const guard = {
  approved: process.env.ORQENA_D2_REVIEW_VERIFY === "true",
  project: process.env.RAILWAY_PROJECT_ID === EXPECTED_PROJECT_ID,
  environment: process.env.RAILWAY_ENVIRONMENT_ID === EXPECTED_ENVIRONMENT_ID,
  databaseService:
    process.env.ORQENA_REVIEW_DATABASE_SERVICE_ID === EXPECTED_DATABASE_SERVICE_ID,
  previewEnvironment: process.env.NEXT_PUBLIC_APP_ENV === "preview",
  previewCredentials: process.env.CREDENTIAL_SCOPE === "preview",
  syntheticEmail: Boolean(email?.endsWith("@review.orqena.invalid")),
};
if (Object.values(guard).some((value) => !value)) {
  throw new Error(`D2_REVIEW_VERIFICATION_GUARD_FAILED:${JSON.stringify(guard)}`);
}

async function main() {
  const count = await prisma.demoRequest.count({
    where: { emailNormalized: email },
  });
  const row = await prisma.demoRequest.findFirst({
    where: { emailNormalized: email },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      source: true,
      consentAt: true,
    },
  });
  const auditCount = row
    ? await prisma.auditLog.count({
        where: { action: "demo_request.created", targetId: row.id },
      })
    : 0;
  const ok =
    count === 1 &&
    auditCount === 1 &&
    row?.status === "PENDING" &&
    row.source === "home" &&
    Boolean(row.consentAt);
  process.stdout.write(
    `${JSON.stringify({
      ok,
      persisted: count,
      auditCount,
      status: row?.status ?? null,
      source: row?.source ?? null,
      consentRecorded: Boolean(row?.consentAt),
      syntheticOnly: true,
      productionWrites: 0,
      stagingWrites: 0,
    })}\n`,
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
