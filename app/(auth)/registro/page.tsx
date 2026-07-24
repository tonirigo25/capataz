import Link from "next/link";
import { hashToken } from "@/lib/auth/crypto";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { isPublicRegistrationEnabled } from "@/lib/public-registration";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation: token = "" } = await searchParams;
  const invite = token ? await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { company: true } }) : null;
  const valid = invite && ["PENDING", "PENDING_EMPLOYEE"].includes(invite.status) && invite.expiresAt > new Date();
  if (!valid && !isPublicRegistrationEnabled()) {
    return <AuthShell title="Orqena está en beta privada" description="El acceso se habilita únicamente mediante invitación de una empresa participante."><div className="grid gap-3"><Link className="primary-button justify-center" href="/login">Entrar</Link><Link className="secondary-button justify-center" href="/demo">Solicitar una demo</Link></div></AuthShell>;
  }
  return <AuthShell title={valid ? "Crea tu cuenta de empleado" : "Crea tu cuenta"} description={valid ? `Te incorporarás a ${invite.company.nombreComercial} sin crear otra empresa.` : "Tu empresa tendrá un espacio independiente desde el primer momento."}><RegisterForm invitationToken={valid ? token : undefined} invitationEmail={valid ? invite.emailNormalized : undefined} companyName={valid ? invite.company.nombreComercial : undefined}/></AuthShell>;
}
