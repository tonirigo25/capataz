import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getOptionalSession } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getOptionalSession()) redirect("/hoy");

  return (
    <AuthShell title="Iniciar sesión" description="Accede a tu cuenta de Orqena para continuar.">
      <LoginForm />
    </AuthShell>
  );
}
