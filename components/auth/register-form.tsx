"use client";
import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/lib/auth/state";
import { AuthMessage } from "@/components/auth/auth-shell";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialAuthState);
  return <form action={action} className="grid gap-4">
    <AuthMessage state={state} />
    <label><span className="label mb-1 block">Tu nombre</span><input className="field" name="displayName" autoComplete="name" required defaultValue={state.fields?.displayName} /></label>
    <label><span className="label mb-1 block">Correo</span><input className="field" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} /></label>
    <label><span className="label mb-1 block">Nombre de la empresa</span><input className="field" name="companyName" autoComplete="organization" required defaultValue={state.fields?.companyName} /></label>
    <label><span className="label mb-1 block">Contraseña</span><input className="field" name="password" type="password" autoComplete="new-password" minLength={12} required aria-describedby="password-help" /><span id="password-help" className="mt-1 block text-xs text-slate-500">12 caracteres, mayúscula, minúscula, número y símbolo.</span></label>
    <label><span className="label mb-1 block">Repite la contraseña</span><input className="field" name="passwordConfirmation" type="password" autoComplete="new-password" required /></label>
    <label className="flex items-start gap-3 text-sm text-slate-700"><input className="mt-1 h-4 w-4" name="acceptedTerms" type="checkbox" required /><span>Acepto los <Link className="font-bold underline" href="/terminos">términos</Link> y la <Link className="font-bold underline" href="/privacidad">política de privacidad</Link>.</span></label>
    <button className="primary-button w-full" disabled={pending}>{pending ? "Creando cuenta…" : "Crear cuenta"}</button>
    <p className="text-center text-sm text-slate-600">¿Ya tienes cuenta? <Link href="/login" className="font-bold text-obra-yellowDark hover:underline">Entrar</Link></p>
  </form>;
}
