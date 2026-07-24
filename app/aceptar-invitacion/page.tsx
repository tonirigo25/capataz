import Link from "next/link";
import { hashToken } from "@/lib/auth/crypto";
import { getOptionalSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { acceptInvitation } from "./actions";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const [session, invitation] = await Promise.all([getOptionalSession(), token ? prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { company: true } }) : null]);
  const available = invitation && ["PENDING", "PENDING_EMPLOYEE"].includes(invitation.status) && invitation.expiresAt > new Date();
  return <main className="screen mx-auto max-w-lg py-12"><div className="card p-6"><p className="type-label">Invitación profesional</p><h1 className="type-page-title mt-2">{available ? `Únete a ${invitation.company.nombreComercial}` : "Este enlace ya no está disponible"}</h1>{available ? <><p className="type-secondary mt-3">Tu acceso quedará pendiente hasta que el propietario revise y apruebe el portal resultante.</p>{session ? <form action={acceptInvitation} className="mt-6"><input type="hidden" name="token" value={token}/><button className="primary-button w-full">Aceptar con {session.email}</button></form> : <div className="mt-6 grid gap-3"><Link className="primary-button justify-center" href={`/registro?invitation=${encodeURIComponent(token)}`}>Crear mi cuenta</Link><Link className="secondary-button justify-center" href={`/login?returnTo=${encodeURIComponent(`/aceptar-invitacion?token=${token}`)}`}>Ya tengo cuenta</Link></div>}</> : <p className="type-secondary mt-3">Pide al propietario que genere una invitación nueva.</p>}</div></main>;
}
