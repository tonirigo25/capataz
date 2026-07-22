import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CompanyRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authConfig, SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { createOpaqueToken, hashToken } from "@/lib/auth/crypto";
import { recordSecurityEvent } from "@/lib/auth/audit";

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  expiresAt: Date;
};

export type CompanyContext = AuthenticatedSession & {
  companyId: string;
  membershipId: string;
  role: CompanyRole;
  isDemo: boolean;
  companyName: string;
  companyStatus: string;
  commercialStatus: string;
};

export async function createSession(userId: string) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + authConfig.sessionDays * 86_400_000);
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent")?.slice(0, 180) ?? null;
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt, userAgent } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function getOptionalSession(): Promise<AuthenticatedSession | null> {
  if (process.env.CAPATAZ_VISUAL_QA === "true" && process.env.NODE_ENV !== "production") {
    const qaUser = await prisma.user.findFirst({ where: { status: "active", emailVerifiedAt: { not: null } }, orderBy: { createdAt: "asc" } });
    if (qaUser) return { sessionId: "visual-qa", userId: qaUser.id, email: qaUser.email, displayName: qaUser.displayName, expiresAt: new Date(Date.now() + 3_600_000) };
  }
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== "active" || !session.user.emailVerifiedAt) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return { sessionId: session.id, userId: session.userId, email: session.user.email, displayName: session.user.displayName, expiresAt: session.expiresAt };
}

export async function requireAuthenticatedUser() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireCompanyMembership(userId: string, companyId: string) {
  return prisma.companyMembership.findFirst({
    where: { userId, companyId, status: "active", company: { status: "active", archivedAt: null } },
    include: { company: true }
  });
}

export async function getAvailableCompanies(userId?: string) {
  const session = userId ? null : await requireAuthenticatedUser();
  return prisma.companyMembership.findMany({
    where: { userId: userId ?? session!.userId, status: "active", company: { status: "active", archivedAt: null, commercialStatus: { not: "SUSPENDED" } } },
    include: { company: true },
    orderBy: [{ company: { nombreComercial: "asc" } }]
  });
}

export async function resolveActiveCompany(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeCompanyId: true } });
  const memberships = await getAvailableCompanies(userId);
  const persisted = user?.activeCompanyId ? memberships.find((item) => item.companyId === user.activeCompanyId) : null;
  if (persisted) return { membership: persisted, requiresSelection: false };
  if (memberships.length === 1) {
    const [onlyMembership] = memberships;
    await prisma.user.update({ where: { id: userId }, data: { activeCompanyId: onlyMembership.companyId } });
    return { membership: onlyMembership, requiresSelection: false };
  }
  return { membership: null, requiresSelection: memberships.length > 1 };
}

export async function requireCompanyContext(): Promise<CompanyContext> {
  const session = await requireAuthenticatedUser();
  const resolved = await resolveActiveCompany(session.userId);
  if (resolved.requiresSelection) redirect("/seleccionar-empresa");
  const membership = resolved.membership;
  if (!membership) redirect("/crear-empresa");
  return { ...session, companyId: membership.companyId, membershipId: membership.id, role: membership.role, isDemo: membership.company.isDemo, companyName: membership.company.nombreComercial, companyStatus: membership.company.status, commercialStatus: membership.company.commercialStatus ?? "ACTIVE" };
}

const roleRank: Record<CompanyRole, number> = { OWNER: 5, ADMIN: 4, MANAGER: 3, MEMBER: 2, VIEWER: 1 };

export async function requireCompanyRole(roles: CompanyRole[]) {
  const context = await requireCompanyContext();
  if (!roles.some((role) => roleRank[context.role] >= roleRank[role])) redirect("/hoy?error=forbidden");
  return context;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash }, select: { userId: true } });
    await prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    if (session) await recordSecurityEvent({ type: "logout", outcome: "success", userId: session.userId });
  }
  cookieStore.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
