"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/lib/auth/state";
import { AuthMessage } from "@/components/auth/auth-shell";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  return <form action={action} className="grid gap-4">
    <AuthMessage state={state} />
    <label><span className="label mb-1 block">Correo</span><input className="field" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} /></label>
    <label><span className="label mb-1 block">Contraseña</span><input className="field" name="password" type="password" autoComplete="current-password" required /></label>
    <Link href="/recuperar-contrasena" className="text-sm font-bold text-obra-yellowDark hover:underline">He olvidado mi contraseña</Link>
    <button className="primary-button w-full" disabled={pending}>{pending ? "Comprobando…" : "Entrar"}</button>
    <p className="text-center text-sm text-slate-600">¿Aún no tienes cuenta? <Link href="/registro" className="font-bold text-obra-yellowDark hover:underline">Crear cuenta</Link></p>
  </form>;
}
