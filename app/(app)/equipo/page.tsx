import { requireCapability } from "@/lib/commercial/authorization";
import { capabilityCatalog } from "@/lib/commercial/catalog";
import { functionalProfileKeys, functionalProfileLabels, resolveFunctionalProfile } from "@/lib/commercial/functional-profiles";
import { prisma } from "@/lib/prisma";
import { changeFunctionalProfile, inviteMember, setPermissionOverride, transferOwnership } from "./actions";

export default async function TeamPage() {
  const auth = await requireCapability("company.members.view");
  const [members, invitations] = await Promise.all([
    prisma.companyMembership.findMany({ where: { companyId: auth.companyId }, include: { user: true, teamMemberships: { include: { team: true } }, permissionOverrides: true }, orderBy: { createdAt: "asc" } }),
    prisma.invitation.findMany({ where: { companyId: auth.companyId, status: "PENDING" }, orderBy: { createdAt: "desc" } })
  ]);
  return <main className="screen">
    <header><p className="type-label">Configuración · Equipo</p><h1 className="type-page-title mt-2">Roles y acceso</h1><p className="type-secondary mt-2">Perfiles funcionales, módulos visibles y acceso efectivo en {auth.companyName}.</p></header>
    <section className="card mt-6 p-4"><h2 className="type-section-title">Invitar a una persona</h2><form action={inviteMember} className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto]"><input required type="email" name="email" aria-label="Correo" className="field" placeholder="persona@empresa.es"/><select name="role" aria-label="Acceso técnico" className="field"><option value="MEMBER">Miembro</option><option value="VIEWER">Solo lectura</option><option value="MANAGER">Responsable</option><option value="ADMIN">Administración</option></select><button className="primary-button">Crear invitación</button></form></section>
    <section className="mt-6"><h2 className="type-section-title">Miembros</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{members.map((member) => {
      const profile = resolveFunctionalProfile(member.functionalProfileKey, member.role);
      return <article key={member.id} className="card p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><strong>{member.user.displayName}</strong><p className="type-secondary">{member.user.email} · {functionalProfileLabels[profile]}</p><p className="mt-1 text-xs text-content-tertiary">{member.teamMemberships.map((item) => item.team.name).join(", ") || "Sin equipo"}</p></div>{member.role === "OWNER" ? <span className="text-sm font-semibold text-brand-strong">Propietario</span> : null}</div>
        {member.userId !== auth.userId && member.role !== "OWNER" ? <><form action={changeFunctionalProfile} className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3"><input type="hidden" name="membershipId" value={member.id}/><select name="functionalProfileKey" defaultValue={profile} aria-label={`Perfil funcional de ${member.user.displayName}`} className="field h-10 py-1">{functionalProfileKeys.filter((key) => key !== "OWNER").map((key) => <option key={key} value={key}>{functionalProfileLabels[key]}</option>)}</select><button className="secondary-button">Asignar perfil</button>{auth.role === "OWNER" ? <button formAction={transferOwnership} name="confirm" value="TRANSFERIR" className="ghost-button">Transferir propiedad</button> : null}</form>
          <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer font-semibold">Ajuste excepcional</summary><form action={setPermissionOverride} className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"><input type="hidden" name="membershipId" value={member.id}/><select name="capabilityKey" aria-label="Capacidad" className="field">{Object.entries(capabilityCatalog).map(([key, item]) => <option key={key} value={key}>{item.description}</option>)}</select><select name="effect" aria-label="Efecto" className="field"><option value="ROLE">Usar perfil</option><option value="GRANT">Conceder</option><option value="DENY">Denegar</option></select><button className="secondary-button">Aplicar</button></form></details></> : null}
      </article>;
    })}</div></section>
    <section className="mt-6"><h2 className="type-section-title">Invitaciones pendientes</h2><div className="mt-3 grid gap-2">{invitations.length ? invitations.map((item) => <div key={item.id} className="card p-4"><strong>{item.emailNormalized}</strong><p className="type-secondary">Caduca {item.expiresAt.toLocaleDateString("es-ES")}</p></div>) : <p className="empty-state">No hay invitaciones pendientes.</p>}</div></section>
  </main>;
}
