import { PrismaClient } from "@prisma/client";

const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!raw || !/(?:railway|rlwy)/i.test(new URL(raw).hostname)) throw new Error("AUDIT_REQUIRES_RAILWAY_DATABASE");
const expected = {
  RAILWAY_PROJECT_ID: "ca7ec244-e961-42dc-8573-23835e6db5f5",
  RAILWAY_ENVIRONMENT_ID: "42c14ac1-e933-485b-9b44-01272af389e0",
  RAILWAY_SERVICE_ID: "0f485ee7-0ab3-430d-9abd-791b8e3e2907",
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_SERVICE_NAME: "Postgres",
};
for (const [name, value] of Object.entries(expected)) {
  if (process.env[name] !== value) throw new Error(`PRODUCTION_TARGET_MISMATCH:${name}`);
}

const prisma = new PrismaClient({ log: [], datasources: { db: { url: raw } } });
try {
  const empresas = await prisma.empresa.findMany({
    select: { id: true, nombreComercial: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
  });
  const companies = await prisma.company.findMany({
    select: { id: true, slug: true, nombreComercial: true, legacyEmpresaId: true, status: true, archivedAt: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify({
    mode: "read-only-audit",
    empresaCount: empresas.length,
    companyCount: companies.length,
    linkedCompanyCount: companies.filter((company) => company.legacyEmpresaId != null).length,
    empresas,
    companies,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
