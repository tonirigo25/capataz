import { redirect } from "next/navigation";
import { LoginShell } from "@/components/auth/login-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getOptionalSession } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; returnTo?: string }>;
}) {
  if (await getOptionalSession()) redirect("/hoy");
  const params = await searchParams;
  const returnTo = params.next ?? params.returnTo;

  return (
    <LoginShell title="Iniciar sesión" description="Accede a tu cuenta de Orqena para continuar.">
      <LoginForm returnTo={returnTo} />
    </LoginShell>
  );
}
