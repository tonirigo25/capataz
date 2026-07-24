import { hashToken } from "@/lib/auth/crypto";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation: token = "" } = await searchParams;
  const invite = token ? await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { company: true } }) : null;
  const valid = invite && ["PENDING", "PENDING_EMPLOYEE"].includes(invite.status) && invite.expiresAt > new Date();
  return <AuthShell title={valid ? "Crea tu cuenta de empleado" : "Crea tu cuenta"} description={valid ? `Te incorporarás a ${invite.company.nombreComercial} sin crear otra empresa.` : "Tu empresa tendrá un espacio independiente desde el primer momento."}><RegisterForm invitationToken={valid ? token : undefined} invitationEmail={valid ? invite.emailNormalized : undefined} companyName={valid ? invite.company.nombreComercial : undefined}/></AuthShell>;
}
