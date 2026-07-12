import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-forms";
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <AuthShell title="Elige una nueva contraseña" description="El enlace es temporal y solo puede utilizarse una vez."><ResetPasswordForm token={token} /></AuthShell>; }
