import { AuthShell } from "@/components/auth/auth-shell";
import { RequestResetForm } from "@/components/auth/reset-forms";
export default function RecoverPage() { return <AuthShell title="Recupera el acceso" description="Te enviaremos instrucciones si el correo corresponde a una cuenta."><RequestResetForm /></AuthShell>; }
