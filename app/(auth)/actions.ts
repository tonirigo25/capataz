"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import type { AuthActionState } from "@/lib/auth/state";
import { registerAction as registerActionUseCase, loginAction as loginActionUseCase, logoutAction as logoutActionUseCase, requestPasswordResetAction as requestPasswordResetActionUseCase, resetPasswordAction as resetPasswordActionUseCase, verifyEmailToken as verifyEmailTokenUseCase } from "@/lib/application/auth/auth-use-cases";

export async function registerAction(_previous: AuthActionState, form: FormData) {
  return executeNextAction({ operation: "app/(auth)/actions.ts#registerAction" }, () => registerActionUseCase(_previous, form));
}

export async function loginAction(_previous: AuthActionState, form: FormData) {
  return executeNextAction({ operation: "app/(auth)/actions.ts#loginAction" }, () => loginActionUseCase(_previous, form));
}

export async function logoutAction() {
  return executeNextAction({ operation: "app/(auth)/actions.ts#logoutAction" }, () => logoutActionUseCase());
}

export async function requestPasswordResetAction(_previous: AuthActionState, form: FormData) {
  return executeNextAction({ operation: "app/(auth)/actions.ts#requestPasswordResetAction" }, () => requestPasswordResetActionUseCase(_previous, form));
}

export async function resetPasswordAction(_previous: AuthActionState, form: FormData) {
  return executeNextAction({ operation: "app/(auth)/actions.ts#resetPasswordAction" }, () => resetPasswordActionUseCase(_previous, form));
}

export async function verifyEmailToken(token: string) {
  return executeNextAction({ operation: "app/(auth)/actions.ts#verifyEmailToken" }, () => verifyEmailTokenUseCase(token));
}
