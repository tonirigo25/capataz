import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createOpaqueToken, hashPassword, hashToken, normalizeEmail, verifyPassword } from "../lib/auth/crypto";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

async function main() {
  const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
  if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
  const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
  const password = randomBytes(24).toString("hex");
  const port = Number(process.env.CAPATAZ_AUTH_POSTGRES_PORT ?? 55434);
  const pg = new EmbeddedPostgres({ databaseDir: join(root, `auth-${Date.now()}`), user: "postgres", password, port, persistent: true });
  let prisma: PrismaClient | undefined;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("capataz_test_auth");
    const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_auth?schema=public`, CAPATAZ_TEST_DATABASE_ISOLATED: "true", APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test" };
    assertIsolatedTestDatabase(env);
    execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "pipe", shell: true });
    const url = env.DATABASE_URL;
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const email = "Owner@Empresa-A.test";
    const normalized = normalizeEmail(email);
    const passwordHash = await hashPassword("Clave-segura-A-2026!");
    const registered = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, emailNormalized: normalized, displayName: "Owner A", passwordHash } });
      const company = await tx.company.create({ data: { slug: "empresa-a", nombreComercial: "Empresa A" } });
      const membership = await tx.companyMembership.create({ data: { userId: user.id, companyId: company.id, role: "OWNER", status: "active", joinedAt: new Date() } });
      return { user, company, membership };
    });
    assert.equal(registered.user.emailNormalized, "owner@empresa-a.test");
    assert.ok(!registered.user.passwordHash.includes("Clave-segura-A-2026!"));
    await assert.rejects(() => prisma!.user.create({ data: { email, emailNormalized: normalized, displayName: "Duplicado", passwordHash } }));
    const beforeRollback = await prisma.user.count();
    await assert.rejects(() => prisma!.$transaction(async (tx) => { await tx.user.create({ data: { email: "rollback@test.local", emailNormalized: "rollback@test.local", displayName: "Rollback", passwordHash } }); throw new Error("EXPECTED_ROLLBACK"); }));
    assert.equal(await prisma.user.count(), beforeRollback);

    await prisma.user.update({ where: { id: registered.user.id }, data: { status: "active", emailVerifiedAt: new Date() } });
    const rawSession = createOpaqueToken();
    const session = await prisma.session.create({ data: { userId: registered.user.id, tokenHash: hashToken(rawSession), expiresAt: new Date(Date.now() + 60_000) } });
    assert.notEqual(session.tokenHash, rawSession);
    assert.ok(await prisma.session.findUnique({ where: { tokenHash: hashToken(rawSession) } }));
    assert.equal(await prisma.session.findUnique({ where: { tokenHash: hashToken("incorrect") } }), null);
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    assert.ok((await prisma.session.findUnique({ where: { id: session.id } }))?.revokedAt);
    const expired = await prisma.session.create({ data: { userId: registered.user.id, tokenHash: hashToken(createOpaqueToken()), expiresAt: new Date(Date.now() - 1) } });
    assert.ok(expired.expiresAt < new Date());

    const verificationRaw = createOpaqueToken();
    const verification = await prisma.emailVerificationToken.create({ data: { userId: registered.user.id, tokenHash: hashToken(verificationRaw), expiresAt: new Date(Date.now() + 60_000) } });
    assert.ok(await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(verificationRaw) } }));
    assert.equal(await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken("bad") } }), null);
    await prisma.emailVerificationToken.update({ where: { id: verification.id }, data: { usedAt: new Date() } });
    assert.ok((await prisma.emailVerificationToken.findUnique({ where: { id: verification.id } }))?.usedAt);
    const expiredVerification = await prisma.emailVerificationToken.create({ data: { userId: registered.user.id, tokenHash: hashToken(createOpaqueToken()), expiresAt: new Date(Date.now() - 1) } });
    assert.ok(expiredVerification.expiresAt < new Date());

    const resetRaw = createOpaqueToken();
    const reset = await prisma.passwordResetToken.create({ data: { userId: registered.user.id, tokenHash: hashToken(resetRaw), expiresAt: new Date(Date.now() + 60_000) } });
    const newHash = await hashPassword("Clave-nueva-A-2026!");
    await prisma.$transaction([
      prisma.user.update({ where: { id: registered.user.id }, data: { passwordHash: newHash, passwordChangedAt: new Date() } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: registered.user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    assert.equal(await verifyPassword("Clave-segura-A-2026!", newHash), false);
    assert.equal(await verifyPassword("Clave-nueva-A-2026!", newHash), true);
    assert.equal(await prisma.session.count({ where: { userId: registered.user.id, revokedAt: null } }), 0);

    await prisma.companyMembership.update({ where: { id: registered.membership.id }, data: { status: "suspended" } });
    assert.equal(await prisma.companyMembership.findFirst({ where: { userId: registered.user.id, status: "active", company: { status: "active", archivedAt: null } } }), null);
    await prisma.companyMembership.update({ where: { id: registered.membership.id }, data: { status: "active" } });
    await prisma.company.update({ where: { id: registered.company.id }, data: { status: "archived", archivedAt: new Date() } });
    assert.equal(await prisma.companyMembership.findFirst({ where: { userId: registered.user.id, status: "active", company: { status: "active", archivedAt: null } } }), null);

    const safeMetadata = { reason: "invalid_credentials", attempts: 1 };
    for (const [type, outcome] of [["registration_created", "success"], ["login_success", "success"], ["login_attempt", "failure"], ["login_locked", "blocked"], ["logout", "success"], ["email_verified", "success"], ["password_reset_requested", "success"], ["password_reset_completed", "success"], ["cross_tenant_access", "blocked"]] as const) {
      await prisma.securityAuditEvent.create({ data: { type, outcome, userId: registered.user.id, metadata: safeMetadata } });
    }
    const serialized = JSON.stringify(await prisma.securityAuditEvent.findMany());
    for (const forbidden of ["Clave-segura", "Clave-nueva", resetRaw, verificationRaw, rawSession, "cookie", "passwordHash"]) assert.equal(serialized.includes(forbidden), false);
    console.log(JSON.stringify({ ok: true, users: await prisma.user.count(), companies: await prisma.company.count(), memberships: await prisma.companyMembership.count(), auditEvents: await prisma.securityAuditEvent.count(), rollback: true, sessions: true, tokens: true }));
  } finally {
    await prisma?.$disconnect(); await pg.stop();
  }
}

main().then(
  () => process.exit(0),
  (error) => { console.error(error); process.exit(1); }
);
