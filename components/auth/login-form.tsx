"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Link2, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/lib/auth/state";
import { AuthMessage } from "@/components/auth/auth-shell";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return <form action={action} className="auth-login-form">
    <AuthMessage state={state} />
    <label className="auth-login-form__field">
      <span>Correo electrónico</span>
      <span className="auth-login-form__control"><Mail aria-hidden="true" /><input name="email" type="email" autoComplete="email" required placeholder="tu@empresa.com" defaultValue={state.fields?.email} /></span>
    </label>
    <label className="auth-login-form__field">
      <span>Contraseña</span>
      <span className="auth-login-form__control"><LockKeyhole aria-hidden="true" /><input name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required placeholder="••••••••••••••" /><button type="button" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span>
    </label>
    <div className="auth-login-form__options">
      <label><input name="remember" type="checkbox" defaultChecked /><span>Recordarme</span></label>
      <Link href="/recuperar-contrasena">¿Has olvidado tu contraseña?</Link>
    </div>
    <button className="auth-login-form__submit" disabled={pending}>{pending ? "Comprobando…" : "Entrar en Orqena"}</button>
    <div className="auth-login-form__divider"><span>o</span></div>
    <Link href="/recuperar-contrasena" className="auth-login-form__secure-link"><Link2 aria-hidden="true" />Acceso con enlace seguro</Link>
  </form>;
}
