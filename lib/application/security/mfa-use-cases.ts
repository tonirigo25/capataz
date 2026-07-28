import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { confirmTotpEnrollment, startTotpEnrollment, verifySessionSecondFactor } from "@/lib/security/mfa";

export async function startMfaEnrollmentUseCase(formData: FormData) {
  const session = await requireAuthenticatedUser();
  await startTotpEnrollment({ prisma, userId: session.userId, email: session.email, label: String(formData.get("label") || "Autenticador principal") });
  revalidatePath("/configuracion/seguridad");
}

export async function confirmMfaEnrollmentUseCase(formData: FormData) {
  const session = await requireAuthenticatedUser();
  await confirmTotpEnrollment({ prisma, userId: session.userId, factorId: String(formData.get("factorId") || ""), token: String(formData.get("token") || "") });
  revalidatePath("/configuracion/seguridad");
}

export async function verifyMfaChallengeUseCase(formData: FormData) {
  const session = await requireAuthenticatedUser();
  await verifySessionSecondFactor({ prisma, userId: session.userId, sessionId: session.sessionId, token: String(formData.get("token") || "") });
  revalidatePath("/configuracion/seguridad");
  revalidatePath("/plataforma");
}
