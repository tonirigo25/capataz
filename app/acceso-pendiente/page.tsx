import { requireAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function PendingAccessPage() {
  const session = await requireAuthenticatedUser();
  const membership = await prisma.companyMembership.findFirst({ where: { userId: session.userId, status: { in: ["invited", "pending_owner_approval", "rejected", "suspended"] } }, include: { company: true }, orderBy: { updatedAt: "desc" } });
  const message = membership?.status === "pending_owner_approval" ? "El propietario está revisando tu perfil, paquetes y alcance. Hasta que lo apruebe no puedes acceder a datos de la empresa." : membership?.status === "rejected" ? "El propietario ha revisado la solicitud y no ha activado el acceso." : membership?.status === "suspended" ? "Tu acceso está suspendido. Contacta con el propietario de la empresa." : "No hay un acceso empresarial activo asociado a esta cuenta.";
  return <main className="screen mx-auto max-w-xl py-12"><section className="card p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-xl" aria-hidden="true">⌛</div><h1 className="type-page-title mt-4">Acceso pendiente de aprobación</h1><p className="type-secondary mt-3">{message}</p>{membership ? <p className="mt-4 text-sm font-semibold">{membership.company.nombreComercial}</p> : null}</section></main>;
}
