import { createOpaqueToken, hashPassword, hashToken, normalizeEmail } from "../lib/auth/crypto";
import { authConfig } from "../lib/auth/config";
import { sendPasswordResetEmail } from "../lib/email";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv.find((value) => value.startsWith("--email="))?.slice(8).trim();
  const displayName = process.argv.find((value) => value.startsWith("--name="))?.slice(7).trim() || "Propietario";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("USAGE: --email=propietario@empresa.es [--name=Nombre]");
  const company = await prisma.company.findFirst({ where: { legacyEmpresaId: { not: null } }, orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("LEGACY_COMPANY_NOT_BACKFILLED");
  const normalized = normalizeEmail(email);
  const rawToken = createOpaqueToken();
  const unusablePassword = await hashPassword(createOpaqueToken() + createOpaqueToken());
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({ where: { emailNormalized: normalized }, update: {}, create: { email, emailNormalized: normalized, displayName, passwordHash: unusablePassword } });
    await tx.companyMembership.upsert({ where: { userId_companyId: { userId: user.id, companyId: company.id } }, update: { role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() }, create: { userId: user.id, companyId: company.id, role: "OWNER", status: "active", acceptedAt: new Date(), joinedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + authConfig.resetMinutes * 60_000) } });
    return user;
  });
  await sendPasswordResetEmail(result.email, rawToken);
  console.log(JSON.stringify({ ok: true, userId: result.id, companyId: company.id, invitation: "sent" }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "OWNER_ACTIVATION_FAILED"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
