"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Link2, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/lib/auth/state";
import { AuthMessage } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth-shell.module.css";

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return <form action={action} className={styles.loginForm} noValidate={false}>
    <AuthMessage state={state} />
    {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
    <label className={styles.loginField}>
      <span>Correo electrónico</span>
      <span className={styles.loginControl}><Mail aria-hidden="true" /><input name="email" type="email" autoComplete="email" required placeholder="tu@empresa.com" defaultValue={state.fields?.email} /></span>
    </label>
    <label className={styles.loginField}>
      <span>Contraseña</span>
      <span className={styles.loginControl}><LockKeyhole aria-hidden="true" /><input name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required placeholder="••••••••••••••" /><button type="button" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span>
    </label>
    <div className={styles.loginOptions}>
      <label><input name="remember" type="checkbox" defaultChecked /><span>Recordarme</span></label>
      <Link href="/recuperar-contrasena">¿Has olvidado tu contraseña?</Link>
    </div>
    <button className={styles.loginSubmit} disabled={pending}>{pending ? "Comprobando…" : "Entrar en Orqena"}</button>
    <div className={styles.loginDivider}><span>o</span></div>
    <Link href="/recuperar-contrasena" className={styles.secureLink} title="Recupera tu acceso mediante un enlace de un solo uso"><Link2 aria-hidden="true" />Acceso con enlace seguro</Link>
  </form>;
}
