import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth/crypto";

const email = process.env.F8_BROWSER_EMAIL;
const password = process.env.F8_BROWSER_PASSWORD;
if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED !== "true" || !email || !password) throw new Error("F8_ISOLATED_BROWSER_SEED_GUARD");
const fixtureEmail = email;
const fixturePassword = password;

async function main() {
  const company = await prisma.company.create({ data: { slug: `f8-browser-${Date.now()}`, nombreComercial: "F8 Synthetic Browser", onboardingCompletedAt: new Date() } });
  await prisma.user.create({ data: {
    email: fixtureEmail,
    emailNormalized: fixtureEmail.toLowerCase(),
    displayName: "F8 Synthetic Owner",
    passwordHash: await hashPassword(fixturePassword),
    status: "active",
    emailVerifiedAt: new Date(),
    activeCompanyId: company.id,
    memberships: { create: { companyId: company.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() } },
  } });
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
