"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/lib/auth/state";
import { AuthMessage } from "@/components/auth/auth-shell";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialAuthState);
  return <form action={action} className="grid gap-4"><AuthMessage state={state} /><label><span className="label mb-1 block">Correo</span><input className="field" name="email" type="email" autoComplete="email" required /></label><button className="primary-button" disabled={pending}>{pending ? "Enviando…" : "Enviar instrucciones"}</button><Link href="/login" className="text-center text-sm font-bold text-obra-yellowDark">Volver a entrar</Link></form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialAuthState);
  return <form action={action} className="grid gap-4"><AuthMessage state={state} /><input type="hidden" name="token" value={token} /><label><span className="label mb-1 block">Nueva contraseña</span><input className="field" name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label><span className="label mb-1 block">Repite la contraseña</span><input className="field" name="passwordConfirmation" type="password" autoComplete="new-password" required /></label><button className="primary-button" disabled={pending || !token}>{pending ? "Actualizando…" : "Actualizar contraseña"}</button><Link href="/login" className="text-center text-sm font-bold text-obra-yellowDark">Volver a entrar</Link></form>;
}
