import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/crypto";

const email = process.env.CAPATAZ_VISUAL_EMAIL;
const password = process.env.CAPATAZ_VISUAL_PASSWORD;

if (!email || !password || process.env.CAPATAZ_TEST_DATABASE_ISOLATED !== "true") {
  throw new Error("Visual validation seed requires an isolated database and ephemeral credentials.");
}

const visualEmail = email;
const visualPassword = password;

async function main() {
  const company = await prisma.company.create({
  data: {
    slug: `visual-local-${Date.now()}`,
    nombreComercial: "Reformas Horizonte",
    razonSocial: "Reformas Horizonte Local",
    email: visualEmail,
    isDemo: true
  }
});

  const user = await prisma.user.create({
  data: {
    email: visualEmail,
    emailNormalized: visualEmail.toLowerCase(),
    passwordHash: await hashPassword(visualPassword),
    displayName: "Alex",
    status: "active",
    emailVerifiedAt: new Date(),
    memberships: {
      create: { companyId: company.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() }
    }
  }
});

  await prisma.usuarioPerfil.upsert({
  where: { id: user.id },
  create: { id: user.id, nombre: "Alex", email: visualEmail },
  update: { nombre: "Alex", email: visualEmail }
});

  await prisma.$transaction([
  prisma.client.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.work.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.budget.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.invoice.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.expense.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.material.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.reminder.updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  prisma.eventoAgenda.updateMany({ where: { companyId: null }, data: { companyId: company.id } })
]);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  await prisma.$disconnect();
  throw error;
});
