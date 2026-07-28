"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { confirmMfaEnrollmentUseCase, startMfaEnrollmentUseCase, verifyMfaChallengeUseCase } from "@/lib/application/security/mfa-use-cases";

export async function startMfaEnrollment(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/seguridad/actions.ts#startMfaEnrollment" }, () => startMfaEnrollmentUseCase(formData));
}

export async function confirmMfaEnrollment(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/seguridad/actions.ts#confirmMfaEnrollment" }, () => confirmMfaEnrollmentUseCase(formData));
}

export async function verifyMfaChallenge(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/configuracion/seguridad/actions.ts#verifyMfaChallenge" }, () => verifyMfaChallengeUseCase(formData));
}
