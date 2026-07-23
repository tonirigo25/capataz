"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth/config";
import { createOpaqueToken, hashPassword, hashToken, normalizeEmail, validatePassword, verifyPassword } from "@/lib/auth/crypto";
import { createSession, revokeCurrentSession } from "@/lib/auth/session";
import { recordSecurityEvent } from "@/lib/auth/audit";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import type { AuthActionState } from "@/lib/auth/state";
import { ensureBasePlans, provisionCompanyInTransaction } from "@/lib/commercial/provisioning";

const genericCredentials = "No hemos podido iniciar sesión con esos datos.";

function text(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }

export async function registerAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const displayName = text(form, "displayName");
  const email = text(form, "email");
  const emailNormalized = normalizeEmail(email);
  const companyName = text(form, "companyName");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("passwordConfirmation") ?? "");
  const acceptedTerms = form.get("acceptedTerms") === "on";
  const fields = { displayName, email, companyName };
  if (!displayName || !companyName || !/^\S+@\S+\.\S+$/.test(emailNormalized)) return { status: "error", message: "Revisa tu nombre, correo y empresa.", fields };
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length || password !== confirmation) return { status: "error", message: password !== confirmation ? "Las contraseñas no coinciden." : passwordErrors[0], fields };
  if (!acceptedTerms) return { status: "error", message: "Debes aceptar los términos y la política de privacidad.", fields };
  const existing = await prisma.user.findUnique({ where: { emailNormalized }, select: { id: true } });
  if (existing) return { status: "success", message: "Si el correo puede registrarse, recibirás las instrucciones para continuar." };
  const passwordHash = await hashPassword(password);
  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + authConfig.verificationMinutes * 60_000);
  let user: { id: string; email: string };
  try {
    await ensureBasePlans(prisma);
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, emailNormalized, passwordHash, displayName } });
      await provisionCompanyInTransaction(tx, { userId: created.id, name: companyName, organizationType: "COMPANY", sectorKey: "general_services", planKey: "STARTER", idempotencyKey: `registration:${created.id}` });
      await tx.emailVerificationToken.create({ data: { userId: created.id, tokenHash: hashToken(rawToken), expiresAt } });
      return { id: created.id, email: created.email };
    });
  } catch {
    return { status: "error", message: "No hemos podido completar el registro. Tus datos no se han guardado; inténtalo de nuevo.", fields };
  }
  await recordSecurityEvent({ type: "registration_created", outcome: "success", userId: user.id });
  try { await sendVerificationEmail(user.email, rawToken); } catch { return { status: "success", message: "Tu cuenta se ha creado, pero el mensaje está tardando. Usa el reenvío de verificación en unos minutos." }; }
  return { status: "success", message: "Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión." };
}

export async function loginAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const email = text(form, "email");
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { emailNormalized: normalizeEmail(email) } });
  if (!user) { await recordSecurityEvent({ type: "login_attempt", outcome: "failure" }); return { status: "error", message: genericCredentials, fields: { email } }; }
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) { await recordSecurityEvent({ type: "login_locked", outcome: "blocked", userId: user.id }); return { status: "error", message: genericCredentials, fields: { email } }; }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginCount + 1;
    const lockedUntil = attempts >= authConfig.maxLoginAttempts ? new Date(now.getTime() + authConfig.lockMinutes * 60_000) : null;
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: lockedUntil ? 0 : attempts, lockedUntil } });
    await recordSecurityEvent({ type: lockedUntil ? "login_locked" : "login_attempt", outcome: lockedUntil ? "blocked" : "failure", userId: user.id });
    return { status: "error", message: genericCredentials, fields: { email } };
  }
  if (user.status !== "active" || !user.emailVerifiedAt) { await recordSecurityEvent({ type: "login_unverified", outcome: "blocked", userId: user.id }); return { status: "error", message: "Debes verificar el correo antes de entrar.", fields: { email } }; }
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
  await createSession(user.id);
  await recordSecurityEvent({ type: "login_success", outcome: "success", userId: user.id });
  redirect("/hoy");
}

export async function logoutAction() { await revokeCurrentSession(); redirect("/login"); }

export async function requestPasswordResetAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const emailNormalized = normalizeEmail(text(form, "email"));
  const response = { status: "success" as const, message: "Si existe una cuenta con ese correo, recibirás las instrucciones." };
  const user = await prisma.user.findUnique({ where: { emailNormalized } });
  if (!user) { await recordSecurityEvent({ type: "password_reset_requested", outcome: "success" }); return response; }
  const rawToken = createOpaqueToken();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + authConfig.resetMinutes * 60_000) } })
  ]);
  await recordSecurityEvent({ type: "password_reset_requested", outcome: "success", userId: user.id });
  try { await sendPasswordResetEmail(user.email, rawToken); } catch { /* anti-enumeration response remains identical */ }
  return response;
}

export async function resetPasswordAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const token = text(form, "token");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("passwordConfirmation") ?? "");
  const errors = validatePassword(password);
  if (password !== confirmation || errors.length) return { status: "error", message: password !== confirmation ? "Las contraseñas no coinciden." : errors[0] };
  const reset = token ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } }) : null;
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return { status: "error", message: "El enlace ya no es válido. Solicita uno nuevo." };
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);
  await recordSecurityEvent({ type: "password_reset_completed", outcome: "success", userId: reset.userId });
  return { status: "success", message: "Contraseña actualizada. Ya puedes iniciar sesión." };
}

export async function verifyEmailToken(token: string) {
  const verification = token ? await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } }) : null;
  if (!verification || verification.usedAt || verification.expiresAt <= new Date()) return false;
  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: verification.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date(), status: "active" } })
  ]);
  await recordSecurityEvent({ type: "email_verified", outcome: "success", userId: verification.userId });
  return true;
}
