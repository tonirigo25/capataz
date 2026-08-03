import Link from "next/link";
import type { CompanyRole } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
  CircleUserRound,
  Ellipsis,
  Eye,
  HardHat,
  ShieldCheck,
  UserCog,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  requireCapability,
  resolveAuthorization,
} from "@/lib/commercial/authorization";
import { SoftBadge } from "@/components/portal/modules-b/module-frame";
import {
  accessPackageKeys,
  accessPackageLabels,
} from "@/lib/commercial/access-packages";
import {
  capabilityCatalog,
  scopeAssignableCapabilityKeys,
} from "@/lib/commercial/catalog";
import {
  functionalProfileKeys,
  functionalProfileLabels,
  profileDefaultPackages,
  resolveFunctionalProfile,
  type FunctionalProfileKey,
} from "@/lib/commercial/functional-profiles";
import { prisma } from "@/lib/prisma";
import {
  approveInvitation,
  changeFunctionalProfile,
  changeMembershipState,
  inviteMember,
  rejectInvitation,
  revokeInvitation,
  setAccessPackage,
  setApprovalAuthority,
  setFieldVisibility,
  setPermissionOverride,
  setScopeAssignment,
  transferOwnership,
  updatePendingInvitation,
} from "./actions";
import { TeamRailContext } from "@/components/portal/team-rail-context";
import styles from "./equipo.module.css";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    persona?: string;
    invitar?: string;
    perfil?: string;
    pagina?: string;
  }>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("company.members.view");
  const owner = auth.role === "OWNER";
  const workloadAuthorization = await resolveAuthorization(auth, "tasks.view");
  const canViewCompanyWorkload =
    workloadAuthorization.allowed && workloadAuthorization.scope === "COMPANY";
  const [
    members,
    invitations,
    pendingOutbox,
    works,
    clients,
    teams,
    taskLoads,
  ] = await Promise.all([
    prisma.companyMembership.findMany({
      where: { companyId: auth.companyId },
      include: {
        user: {
          include: {
            mfaFactors: {
              where: { status: "ACTIVE", disabledAt: null },
              select: { id: true },
            },
          },
        },
        teamMemberships: { include: { team: true } },
        permissionOverrides: true,
        accessPackages: true,
        approvalAuthorities: true,
        fieldVisibilityPolicies: true,
        scopeAssignments: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        companyId: auth.companyId,
        status: {
          in: [
            "PENDING",
            "PENDING_EMPLOYEE",
            "EMPLOYEE_ACCEPTED",
            "PENDING_OWNER_APPROVAL",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    owner
      ? prisma.emailOutbox.count({
          where: {
            companyId: auth.companyId,
            status: { in: ["PENDING", "FAILED", "RETRYING"] },
          },
        })
      : Promise.resolve(0),
    owner
      ? prisma.work.findMany({
          where: { companyId: auth.companyId },
          select: { id: true, titulo: true },
          orderBy: { titulo: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
    owner
      ? prisma.client.findMany({
          where: { companyId: auth.companyId, archivadoAt: null },
          select: { id: true, nombre: true, nombreComercial: true },
          orderBy: { nombre: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
    owner
      ? prisma.team.findMany({
          where: { companyId: auth.companyId, state: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canViewCompanyWorkload
      ? prisma.task.findMany({
          where: {
            companyId: auth.companyId,
            archivedAt: null,
            status: { notIn: ["completed", "cancelled", "archived"] },
          },
          select: {
            id: true,
            assigneeId: true,
            estimatedMinutes: true,
            assignments: {
              where: { removedAt: null, userId: { not: null } },
              select: { userId: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const profileFilter = query.perfil ?? "todos";
  const orderedMembers = [...members].sort((a, b) => {
    if (a.userId === auth.userId) return -1;
    if (b.userId === auth.userId) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const filteredMembers = orderedMembers.filter((member) =>
    memberMatchesFilter(
      member.functionalProfileKey,
      member.role,
      member.accessMode,
      profileFilter,
    ),
  );
  const selectedMember =
    (query.persona
      ? filteredMembers.find((member) => member.id === query.persona)
      : filteredMembers.find((member) => member.userId === auth.userId)) ?? null;
  const selectedProfile = selectedMember
    ? resolveFunctionalProfile(
        selectedMember.functionalProfileKey,
        selectedMember.role,
      )
    : null;
  const activeMembers = members.filter((member) => member.status === "active");
  const workloadByUser = new Map<string, { count: number; estimatedMinutes: number }>();
  for (const task of taskLoads) {
    const assignedUsers = new Set([
      task.assigneeId,
      ...task.assignments.map((assignment) => assignment.userId),
    ].filter((userId): userId is string => Boolean(userId)));
    for (const userId of assignedUsers) {
      const current = workloadByUser.get(userId) ?? { count: 0, estimatedMinutes: 0 };
      workloadByUser.set(userId, {
        count: current.count + 1,
        estimatedMinutes: current.estimatedMinutes + (task.estimatedMinutes ?? 0),
      });
    }
  }
  const maximumEstimatedMinutes = Math.max(
    0,
    ...workloadByUser.values().map((item) => item.estimatedMinutes),
  );
  const maximumTaskCount = Math.max(
    0,
    ...workloadByUser.values().map((item) => item.count),
  );
  const selectedWorkload = selectedMember
    ? (workloadByUser.get(selectedMember.userId) ?? null)
    : null;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const requestedPage = Number.parseInt(query.pagina ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const pageStart = (currentPage - 1) * pageSize;
  const visibleMembers = filteredMembers.slice(pageStart, pageStart + pageSize);

  const selectedMemberContext = selectedMember && selectedProfile
    ? {
        name: selectedMember.user.displayName,
        email: selectedMember.user.email,
        role: functionalProfileLabels[selectedProfile],
        area: profileAreaLabel(selectedProfile),
        access: memberAccessLabel(selectedMember),
        status: membershipStatusLabel(selectedMember.status),
        lastAccess: formatMemberActivity(selectedMember.user.lastLoginAt),
        workload: canViewCompanyWorkload ? workloadLabel(selectedWorkload) : "No disponible con este alcance",
        canEdit: owner && selectedMember.userId !== auth.userId && selectedMember.role !== "OWNER",
        editHref: owner && selectedMember.userId !== auth.userId && selectedMember.role !== "OWNER" ? "#ajustes-persona" : null,
        portalHref: owner ? `/equipo/${selectedMember.id}/portal` : null,
      }
    : null;

  return (
    <main className={styles.page} data-team-canonical>
      <TeamRailContext context={{ activeCount: activeMembers.length, totalCount: members.length, selected: selectedMemberContext }} />
      <header>
        <h1 className={styles.heading}>Equipo</h1>
        <p className={styles.subtitle}>Gestiona las personas, roles y permisos para coordinar tu empresa.</p>
      </header>

      <section className={styles.filterBlock} aria-labelledby="team-role-filters">
        <div className={styles.filterMeta}>
          <h2 id="team-role-filters">Filtros por rol</h2>
          <span className={styles.memberCount}>{activeMembers.length} miembros</span>
        </div>
        <div className={styles.filterActions}>
          <nav aria-label="Perfiles del equipo" className={styles.filters}>
            {teamFilters.map(([id, label]) => (
              <Link
                key={id}
                href={`/equipo?perfil=${id}`}
                aria-current={profileFilter === id ? "page" : undefined}
                className={`${styles.filter} ${profileFilter === id ? styles.filterActive : ""}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {owner ? (
            <Link href={`/equipo?perfil=${profileFilter}&invitar=1#invitar`} className={styles.invite}>
              <UserPlus size={14} aria-hidden="true" /> Invitar miembro
            </Link>
          ) : null}
        </div>
      </section>

      {owner && query.invitar === "1" ? (
        <details id="invitar" className="card mt-6 scroll-mt-24 p-4" open>
          <summary className="cursor-pointer type-section-title">
            Invitar a una persona
          </summary>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex items-start justify-between gap-3">
              <p className="type-secondary">
                La persona deberá aceptar y después esperar tu aprobación.
                Revisa perfil, alcance y campos antes de crear la invitación.
              </p>
              <Link
                href={`/equipo?perfil=${profileFilter}`}
                className="ghost-button shrink-0"
              >
                Cerrar
              </Link>
            </div>
            <form
              action={inviteMember}
              className="mt-4 grid gap-3 lg:grid-cols-4"
            >
              <input
                required
                type="email"
                name="email"
                aria-label="Correo"
                className="field"
                placeholder="persona@empresa.es"
              />
              <select
                name="functionalProfileKey"
                aria-label="Perfil profesional"
                className="field"
              >
                {functionalProfileKeys
                  .filter((key) => key !== "OWNER")
                  .map((key) => (
                    <option key={key} value={key}>
                      {functionalProfileLabels[key]}
                    </option>
                  ))}
              </select>
              <select
                name="accessMode"
                aria-label="Modo de acceso"
                className="field"
              >
                <option value="STANDARD">Trabajo normal</option>
                <option value="READ_ONLY">Solo lectura</option>
              </select>
              <div className="flex gap-2">
                <input
                  name="expiresInDays"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue="7"
                  aria-label="Días de validez"
                  className="field w-24"
                />
                <button className="primary-button flex-1">
                  Crear invitación
                </button>
              </div>
              <select
                name="workIds"
                multiple
                aria-label="Trabajos asignados"
                className="field h-28"
              >
                {works.map((work) => (
                  <option key={work.id} value={work.id}>
                    {work.titulo}
                  </option>
                ))}
              </select>
              <select
                name="clientIds"
                multiple
                aria-label="Clientes asignados"
                className="field h-28"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nombreComercial ?? client.nombre}
                  </option>
                ))}
              </select>
              <select
                name="approvalAuthorityKey"
                aria-label="Autoridad inicial"
                className="field"
              >
                <option value="">Sin autoridad inicial</option>
                <option value="quote.approve">Aprobar presupuesto</option>
                <option value="discount.approve">Aprobar descuento</option>
                <option value="purchase.approve">Aprobar compra</option>
                <option value="supplier_invoice.approve">
                  Aprobar factura recibida
                </option>
                <option value="invoice.issue">Emitir factura</option>
                <option value="payment.approve">Aprobar pago</option>
                <option value="payment.execute">Ejecutar pago</option>
              </select>
              <input
                name="maxApprovalAmount"
                type="number"
                min="0"
                step="0.01"
                aria-label="Límite de aprobación"
                className="field"
                placeholder="Límite opcional de aprobación"
              />
              <fieldset className="lg:col-span-2">
                <legend className="label mb-2">Equipos</legend>
                <div className="flex flex-wrap gap-3">
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input type="checkbox" name="teamIds" value={team.id} />
                      {team.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="lg:col-span-4">
                <legend className="label mb-2">Paquetes adicionales</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {accessPackageKeys
                    .filter((key) => key !== "ACCESS_GOVERNANCE")
                    .map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input type="checkbox" name="packages" value={key} />
                        {accessPackageLabels[key]}
                      </label>
                    ))}
                </div>
              </fieldset>
              <fieldset className="lg:col-span-4">
                <legend className="label mb-2">
                  Campos sensibles explícitos
                </legend>
                <div className="flex flex-wrap gap-3">
                  {[
                    ["purchase_cost", "Coste compra"],
                    ["internal_cost", "Coste interno"],
                    ["margin_percent", "Margen %"],
                    ["margin_amount", "Margen €"],
                    ["profit", "Beneficio"],
                    ["treasury", "Tesorería"],
                    ["banking", "Banca"],
                    ["tax", "Fiscalidad"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input type="checkbox" name="visibleFields" value={key} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </form>
          </div>
        </details>
      ) : null}

      <section className={styles.tableCard} aria-label="Miembros y acceso" data-d8-team-workspace>
        <div className={styles.tableHeader}>
          <span>Miembro</span><span>Rol</span><span>Área</span><span>Acceso a empresa</span><span>Estado</span><span>Último acceso</span><span>Carga de trabajo <CircleUserRound size={11} aria-hidden="true" /></span><span aria-hidden="true" />
        </div>
        <div className={styles.rows}>
          {visibleMembers.map((member) => {
            const profile = resolveFunctionalProfile(member.functionalProfileKey, member.role);
            const workload = workloadByUser.get(member.userId) ?? null;
            const workloadRatio = workload
              ? workload.estimatedMinutes > 0 && maximumEstimatedMinutes > 0
                ? workload.estimatedMinutes / maximumEstimatedMinutes
                : maximumTaskCount > 0 ? workload.count / maximumTaskCount : 0
              : 0;
            const workloadPercent = workload?.count ? Math.max(8, Math.round(workloadRatio * 100)) : 0;
            return (
              <Link
                key={member.id}
                href={`/equipo?persona=${member.id}&perfil=${profileFilter}&pagina=${currentPage}`}
                aria-current={member.id === selectedMember?.id ? "page" : undefined}
                className={`${styles.row} ${member.id === selectedMember?.id ? styles.selected : ""}`}
              >
                <span className={styles.identity}>
                  <span className={styles.avatar} aria-hidden="true">{memberInitials(member.user.displayName)}</span>
                  <span className={styles.identityText}>
                    <strong>{member.user.displayName}</strong>
                    <small>{member.user.email}</small>
                  </span>
                </span>
                <span><small className={styles.mobileLabel}>Rol</small><span className={styles.roleBadge} data-tone={roleTone(profile, member.accessMode)}>{functionalProfileLabels[profile]}</span></span>
                <span className={styles.cell}><small className={styles.mobileLabel}>Área</small>{profileAreaLabel(profile)}</span>
                <span className={styles.cell}><small className={styles.mobileLabel}>Acceso</small>{memberAccessLabel(member)}</span>
                <span><small className={styles.mobileLabel}>Estado</small><span className={styles.status} data-state={member.status}>{shortMembershipStatusLabel(member.status)}</span></span>
                <span className={styles.cell}><small className={styles.mobileLabel}>Último acceso</small>{formatMemberActivity(member.user.lastLoginAt)}</span>
                <span className={styles.workload}>
                  <small className={styles.mobileLabel}>Carga de trabajo</small>
                  <span><strong>{canViewCompanyWorkload ? workloadLabel(workload) : "No disponible"}</strong></span>
                  <span className={styles.bar} aria-label={canViewCompanyWorkload ? "Carga relativa entre tareas registradas" : "Carga no disponible"}><i style={{ width: `${workloadPercent}%` }} /></span>
                </span>
                <span className={styles.menu} aria-label={`Ver detalle de ${member.user.displayName}`}><Ellipsis size={15} aria-hidden="true" /></span>
              </Link>
            );
          })}
          {!visibleMembers.length ? <p className={styles.empty}>No hay miembros para este filtro.</p> : null}
        </div>
        <footer className={styles.pager}>
          <span>{filteredMembers.length ? `Mostrando ${pageStart + 1} a ${Math.min(pageStart + pageSize, filteredMembers.length)} de ${filteredMembers.length} miembros` : "Sin miembros visibles"}</span>
          <nav aria-label="Paginación del equipo">
            {currentPage > 1 ? <Link className={styles.pagerLink} aria-label="Página anterior" href={`/equipo?perfil=${profileFilter}&pagina=${currentPage - 1}&persona=${filteredMembers[Math.max(0, pageStart - pageSize)]?.id ?? ""}`}><ChevronLeft size={14} /></Link> : <span className={styles.pagerDisabled} aria-hidden="true"><ChevronLeft size={14} /></span>}
            {currentPage < pageCount ? <Link className={styles.pagerLink} aria-label="Página siguiente" href={`/equipo?perfil=${profileFilter}&pagina=${currentPage + 1}&persona=${filteredMembers[pageStart + pageSize]?.id ?? ""}`}><ChevronRight size={14} /></Link> : <span className={styles.pagerDisabled} aria-hidden="true"><ChevronRight size={14} /></span>}
          </nav>
        </footer>
      </section>

      <section className={styles.roles} aria-labelledby="team-role-capabilities">
        <h2 id="team-role-capabilities">Capacidades por rol</h2>
        <div className={styles.roleGrid}>
          {teamRoleCards.map((card) => {
            const Icon = card.icon;
            const packages = profileDefaultPackages[card.profile];
            return (
              <Link key={card.filter} href={`/equipo?perfil=${card.filter}`} className={styles.roleCard}>
                <span className={styles.roleTitle}><span className={styles.roleIcon}><Icon size={13} aria-hidden="true" /></span><strong>{card.label}</strong></span>
                <ul>{packages.slice(0, 4).map((key) => <li key={key}>{accessPackageLabels[key]}</li>)}</ul>
              </Link>
            );
          })}
        </div>
        <p className={styles.roleNote}>¿Necesitas un rol personalizado? <Link href="/contacto?motivo=acceso">Contáctanos</Link></p>
      </section>

      {owner &&
      selectedMember &&
      selectedMember.userId !== auth.userId &&
      selectedMember.role !== "OWNER" ? (
        <section className="mt-6 scroll-mt-24" id="ajustes-persona">
          <h2 className="type-section-title">
            Ajustes de la persona seleccionada
          </h2>
          <div className="mt-3 grid gap-3">
            {members
              .filter(
                (member) => !selectedMember || member.id === selectedMember.id,
              )
              .map((member) => {
                const profile = resolveFunctionalProfile(
                  member.functionalProfileKey,
                  member.role,
                );
                return (
                  <article key={member.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong>{member.user.displayName}</strong>
                        <p className="type-secondary">
                          {member.user.email} ·{" "}
                          {functionalProfileLabels[profile]}
                        </p>
                        <p className="mt-1 text-xs text-content-tertiary">
                          {member.status === "active"
                            ? member.teamMemberships
                                .map((item) => item.team.name)
                                .join(", ") || "Sin equipo"
                            : `Estado: ${membershipStatusLabel(member.status)}`}
                        </p>
                      </div>
                      {member.role === "OWNER" ? (
                        <span className="text-sm font-semibold text-brand-strong">
                          Propietario
                        </span>
                      ) : null}
                    </div>
                    {owner &&
                    member.userId !== auth.userId &&
                    member.role !== "OWNER" ? (
                      <div className="mt-4 grid gap-3 border-t border-border pt-3">
                        <div className="flex flex-wrap gap-2">
                          <form
                            action={changeFunctionalProfile}
                            className="flex flex-1 gap-2"
                          >
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <select
                              name="functionalProfileKey"
                              defaultValue={profile}
                              aria-label={`Perfil de ${member.user.displayName}`}
                              className="field h-10 py-1"
                            >
                              {functionalProfileKeys
                                .filter((key) => key !== "OWNER")
                                .map((key) => (
                                  <option key={key} value={key}>
                                    {functionalProfileLabels[key]}
                                  </option>
                                ))}
                            </select>
                            <button className="secondary-button">
                              Guardar
                            </button>
                          </form>
                          <Link
                            href={`/equipo/${member.id}/portal`}
                            className="ghost-button"
                          >
                            Previsualizar portal
                          </Link>
                        </div>
                        <details>
                          <summary className="cursor-pointer font-semibold">
                            Paquetes y campos
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <form
                              action={setAccessPackage}
                              className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                            >
                              <input
                                type="hidden"
                                name="membershipId"
                                value={member.id}
                              />
                              <select
                                name="packageKey"
                                className="field"
                                aria-label="Paquete"
                              >
                                {accessPackageKeys
                                  .filter((key) => key !== "ACCESS_GOVERNANCE")
                                  .map((key) => (
                                    <option key={key} value={key}>
                                      {accessPackageLabels[key]}
                                    </option>
                                  ))}
                              </select>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" name="enabled" />
                                Conceder
                              </label>
                              <button className="secondary-button">
                                Aplicar
                              </button>
                            </form>
                            <form
                              action={setFieldVisibility}
                              className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                            >
                              <input
                                type="hidden"
                                name="membershipId"
                                value={member.id}
                              />
                              <select
                                name="fieldKey"
                                className="field"
                                aria-label="Campo sensible"
                              >
                                <option value="purchase_cost">
                                  Coste de compra
                                </option>
                                <option value="internal_cost">
                                  Coste interno
                                </option>
                                <option value="margin_percent">
                                  Margen porcentual
                                </option>
                                <option value="margin_amount">
                                  Margen absoluto
                                </option>
                                <option value="profit">Beneficio</option>
                                <option value="treasury">Tesorería</option>
                                <option value="banking">Banca</option>
                                <option value="tax">Fiscalidad</option>
                              </select>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" name="visible" />
                                Visible
                              </label>
                              <button className="secondary-button">
                                Aplicar
                              </button>
                            </form>
                          </div>
                        </details>
                        <details>
                          <summary className="cursor-pointer font-semibold">
                            Alcances por capacidad
                          </summary>
                          <form
                            action={setScopeAssignment}
                            className="mt-3 grid gap-2 sm:grid-cols-2"
                          >
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <select
                              name="capabilityKey"
                              className="field"
                              aria-label="Capacidad con alcance"
                            >
                              {scopeAssignableCapabilityKeys.map((key) => (
                                <option key={key} value={key}>
                                  {capabilityCatalog[key].description}
                                </option>
                              ))}
                            </select>
                            <select
                              name="scope"
                              className="field"
                              aria-label="Alcance"
                            >
                              <option value="ASSIGNED">Solo asignados</option>
                              <option value="SELECTED_WORKS">
                                Trabajos seleccionados
                              </option>
                              <option value="SELECTED_CLIENTS">
                                Clientes seleccionados
                              </option>
                              <option value="TEAM">Su equipo</option>
                              <option value="OWN">Solo propio</option>
                              <option value="COMPANY">Toda la empresa</option>
                            </select>
                            <select
                              name="entityRef"
                              className="field"
                              aria-label="Recurso concreto"
                            >
                              <option value="">Sin recurso concreto</option>
                              <optgroup label="Trabajos">
                                {works.map((work) => (
                                  <option
                                    key={`work-${work.id}`}
                                    value={`Work:${work.id}`}
                                  >
                                    {work.titulo}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Clientes">
                                {clients.map((client) => (
                                  <option
                                    key={`client-${client.id}`}
                                    value={`Client:${client.id}`}
                                  >
                                    {client.nombreComercial ?? client.nombre}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <select
                              name="teamId"
                              className="field"
                              aria-label="Equipo"
                            >
                              <option value="">Sin equipo concreto</option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                            <button className="secondary-button sm:col-span-2">
                              Aplicar alcance
                            </button>
                          </form>
                          <div className="mt-3 grid gap-2">
                            {member.scopeAssignments.length ? (
                              member.scopeAssignments.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                                >
                                  <span>
                                    <strong>
                                      {capabilityCatalog[
                                        item.capabilityKey as keyof typeof capabilityCatalog
                                      ]?.description ?? item.capabilityKey}
                                    </strong>{" "}
                                    · {item.scope}
                                    {item.entityId
                                      ? ` · ${item.entityType === "Client" ? "cliente" : "trabajo"}`
                                      : ""}
                                  </span>
                                  <form action={setScopeAssignment}>
                                    <input
                                      type="hidden"
                                      name="membershipId"
                                      value={member.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="capabilityKey"
                                      value={item.capabilityKey}
                                    />
                                    <input
                                      type="hidden"
                                      name="scopeOperation"
                                      value="remove"
                                    />
                                    <input
                                      type="hidden"
                                      name="assignmentId"
                                      value={item.id}
                                    />
                                    <button className="ghost-button">
                                      Quitar
                                    </button>
                                  </form>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-content-tertiary">
                                Según perfil, sin restricciones adicionales.
                              </p>
                            )}
                          </div>
                        </details>
                        <details>
                          <summary className="cursor-pointer font-semibold">
                            Autoridad de aprobación
                          </summary>
                          <form
                            action={setApprovalAuthority}
                            className="mt-3 grid gap-2 sm:grid-cols-2"
                          >
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <select name="authorityKey" className="field">
                              <option value="quote.approve">
                                Aprobar presupuesto
                              </option>
                              <option value="discount.approve">
                                Aprobar descuento
                              </option>
                              <option value="purchase.approve">
                                Aprobar compra
                              </option>
                              <option value="supplier_invoice.approve">
                                Aprobar factura recibida
                              </option>
                              <option value="invoice.issue">
                                Emitir factura
                              </option>
                              <option value="payment.approve">
                                Aprobar pago
                              </option>
                              <option value="payment.execute">
                                Ejecutar pago
                              </option>
                            </select>
                            <input
                              name="maxAmount"
                              type="number"
                              min="0"
                              step="0.01"
                              className="field"
                              placeholder="Importe máximo"
                            />
                            <input
                              name="maxDiscountPercent"
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="field"
                              placeholder="Descuento máximo %"
                            />
                            <select name="scope" className="field">
                              <option value="COMPANY">Toda la empresa</option>
                              <option value="ASSIGNED">Solo asignado</option>
                              <option value="TEAM">Su equipo</option>
                            </select>
                            <button className="secondary-button sm:col-span-2">
                              Asignar autoridad
                            </button>
                          </form>
                        </details>
                        <details>
                          <summary className="cursor-pointer font-semibold">
                            Ajuste excepcional
                          </summary>
                          <form
                            action={setPermissionOverride}
                            className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
                          >
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <select
                              name="capabilityKey"
                              aria-label="Capacidad"
                              className="field"
                            >
                              {Object.entries(capabilityCatalog).map(
                                ([key, item]) => (
                                  <option key={key} value={key}>
                                    {item.description}
                                  </option>
                                ),
                              )}
                            </select>
                            <select
                              name="effect"
                              aria-label="Efecto"
                              className="field"
                            >
                              <option value="ROLE">Usar perfil</option>
                              <option value="GRANT">Conceder</option>
                              <option value="DENY">Denegar</option>
                            </select>
                            <button className="secondary-button">
                              Aplicar
                            </button>
                          </form>
                        </details>
                        <form
                          action={transferOwnership}
                          className="flex flex-wrap gap-2"
                        >
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />
                          <input
                            type="hidden"
                            name="confirm"
                            value="TRANSFERIR"
                          />
                          <input
                            required
                            type="password"
                            name="currentPassword"
                            autoComplete="current-password"
                            aria-label="Contraseña actual para transferir"
                            className="field max-w-xs"
                            placeholder="Contraseña actual"
                          />
                          <ConfirmSubmitButton
                            className="ghost-button"
                            message={`¿Transferir la propiedad de ${auth.companyName} a ${member.user.displayName}? Esta acción cambia el control de la empresa.`}
                          >
                            Transferir propiedad
                          </ConfirmSubmitButton>
                        </form>
                        <div className="flex flex-wrap gap-2">
                          {member.status === "active" ? (
                            <form action={changeMembershipState}>
                              <input
                                type="hidden"
                                name="membershipId"
                                value={member.id}
                              />
                              <input
                                type="hidden"
                                name="membershipAction"
                                value="suspend"
                              />
                              <ConfirmSubmitButton
                                className="secondary-button"
                                message={`¿Suspender temporalmente el acceso de ${member.user.displayName}?`}
                              >
                                Suspender
                              </ConfirmSubmitButton>
                            </form>
                          ) : member.status === "suspended" ? (
                            <form action={changeMembershipState}>
                              <input
                                type="hidden"
                                name="membershipId"
                                value={member.id}
                              />
                              <input
                                type="hidden"
                                name="membershipAction"
                                value="reactivate"
                              />
                              <ConfirmSubmitButton
                                className="secondary-button"
                                message={`¿Reactivar el acceso de ${member.user.displayName}?`}
                              >
                                Reactivar
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                          <form action={changeMembershipState}>
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <input
                              type="hidden"
                              name="membershipAction"
                              value="revoke"
                            />
                            <ConfirmSubmitButton
                              className="ghost-button"
                              message={`¿Revocar definitivamente el acceso de ${member.user.displayName}?`}
                            >
                              Revocar acceso
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
          </div>
        </section>
      ) : null}

      {owner ? (
        <details
          className="card mt-6 p-4"
          aria-labelledby="invitation-approvals"
        >
          <summary
            id="invitation-approvals"
            className="flex cursor-pointer list-none items-center justify-between gap-3 type-section-title"
          >
            <span>Invitaciones y aprobaciones · bandeja interna {pendingOutbox}</span>
            <SoftBadge tone={invitations.length ? "warning" : "success"}>
              {invitations.length}
            </SoftBadge>
          </summary>
          <div className="mt-3 grid gap-2">
            {invitations.length ? (
              invitations.map((item) => (
                <div key={item.id} className="card p-4">
                  <div>
                    <strong>{item.emailNormalized}</strong>
                    <p className="type-secondary">
                      {item.functionalProfileKey ?? item.role} ·{" "}
                      {invitationStatusLabel(item.status)} · caduca{" "}
                      {item.expiresAt.toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  {item.status === "PENDING_OWNER_APPROVAL" ? (
                    <>
                      <form
                        action={updatePendingInvitation}
                        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                      >
                        <input
                          type="hidden"
                          name="invitationId"
                          value={item.id}
                        />
                        <select
                          name="functionalProfileKey"
                          defaultValue={item.functionalProfileKey ?? "WORKER"}
                          aria-label="Perfil revisado"
                          className="field"
                        >
                          {functionalProfileKeys
                            .filter((key) => key !== "OWNER")
                            .map((key) => (
                              <option key={key} value={key}>
                                {functionalProfileLabels[key]}
                              </option>
                            ))}
                        </select>
                        <select
                          name="packages"
                          multiple
                          defaultValue={
                            Array.isArray(item.accessPackageKeys)
                              ? item.accessPackageKeys.filter(
                                  (value): value is string =>
                                    typeof value === "string",
                                )
                              : []
                          }
                          aria-label="Paquetes revisados"
                          className="field h-28"
                        >
                          {accessPackageKeys
                            .filter((key) => key !== "ACCESS_GOVERNANCE")
                            .map((key) => (
                              <option key={key} value={key}>
                                {accessPackageLabels[key]}
                              </option>
                            ))}
                        </select>
                        <select
                          name="workIds"
                          multiple
                          aria-label="Trabajos revisados"
                          className="field h-28"
                        >
                          {works.map((work) => (
                            <option key={work.id} value={work.id}>
                              {work.titulo}
                            </option>
                          ))}
                        </select>
                        <select
                          name="clientIds"
                          multiple
                          aria-label="Clientes revisados"
                          className="field h-28"
                        >
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.nombreComercial ?? client.nombre}
                            </option>
                          ))}
                        </select>
                        <select
                          name="approvalAuthorityKey"
                          aria-label="Autoridad revisada"
                          className="field"
                        >
                          <option value="">Sin autoridad</option>
                          <option value="quote.approve">
                            Aprobar presupuesto
                          </option>
                          <option value="discount.approve">
                            Aprobar descuento
                          </option>
                          <option value="purchase.approve">
                            Aprobar compra
                          </option>
                          <option value="supplier_invoice.approve">
                            Aprobar factura recibida
                          </option>
                          <option value="invoice.issue">Emitir factura</option>
                          <option value="payment.approve">Aprobar pago</option>
                          <option value="payment.execute">Ejecutar pago</option>
                        </select>
                        <input
                          name="maxApprovalAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Límite revisado"
                          className="field"
                          placeholder="Límite de aprobación"
                        />
                        <fieldset className="sm:col-span-2 lg:col-span-3">
                          <legend className="label mb-1">
                            Campos visibles
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {[
                              ["purchase_cost", "Coste compra"],
                              ["internal_cost", "Coste interno"],
                              ["margin_percent", "Margen %"],
                              ["margin_amount", "Margen €"],
                              ["profit", "Beneficio"],
                              ["treasury", "Tesorería"],
                            ].map(([key, label]) => (
                              <label key={key} className="text-sm">
                                <input
                                  type="checkbox"
                                  name="visibleFields"
                                  value={key}
                                  className="mr-1"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <button className="secondary-button self-start sm:col-span-2 lg:col-span-4">
                          Guardar revisión
                        </button>
                      </form>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/equipo/${item.id}/portal?invitation=1`}
                          className="ghost-button"
                        >
                          Previsualizar portal
                        </Link>
                        <form action={approveInvitation}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={item.id}
                          />
                          <button className="secondary-button">Aprobar</button>
                        </form>
                        <form action={rejectInvitation}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={item.id}
                          />
                          <button className="secondary-button">Rechazar</button>
                        </form>
                        <form action={revokeInvitation}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={item.id}
                          />
                          <button className="ghost-button">Revocar</button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <form action={revokeInvitation} className="mt-3">
                      <input
                        type="hidden"
                        name="invitationId"
                        value={item.id}
                      />
                      <button className="ghost-button">
                        Revocar invitación
                      </button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-state">No hay invitaciones pendientes.</p>
            )}
          </div>
        </details>
      ) : null}
    </main>
  );
}

const teamFilters = [
  ["todos", "Todos"],
  ["propiedad", "Propietario"],
  ["direccion", "Administración"],
  ["oficina", "Oficina"],
  ["comercial", "Comercial"],
  ["obra", "Jefe de obra"],
  ["operacion", "Operario"],
  ["lectura", "Solo lectura"],
] as const;

const teamRoleCards: Array<{
  filter: (typeof teamFilters)[number][0];
  profile: FunctionalProfileKey;
  label: string;
  icon: typeof ShieldCheck;
}> = [
  {
    filter: "propiedad",
    profile: "OWNER",
    label: "Propietario",
    icon: ShieldCheck,
  },
  {
    filter: "direccion",
    profile: "GENERAL_MANAGER",
    label: "Administración",
    icon: BriefcaseBusiness,
  },
  {
    filter: "oficina",
    profile: "ADMINISTRATIVE",
    label: "Oficina",
    icon: UserCog,
  },
  {
    filter: "comercial",
    profile: "SALES",
    label: "Comercial",
    icon: UsersRound,
  },
  {
    filter: "obra",
    profile: "PROJECT_MANAGER",
    label: "Jefe de obra",
    icon: HardHat,
  },
  {
    filter: "operacion",
    profile: "WORKER",
    label: "Operario",
    icon: CircleUserRound,
  },
  {
    filter: "lectura",
    profile: "ADVISOR_AUDITOR",
    label: "Solo lectura",
    icon: Eye,
  },
];

function memberMatchesFilter(
  profileKey: string | null,
  role: CompanyRole,
  accessMode: string,
  filter: string,
) {
  const profile = resolveFunctionalProfile(profileKey, role);
  if (filter === "todos") return true;
  if (filter === "propiedad") return role === "OWNER";
  if (filter === "direccion")
    return ["GENERAL_MANAGER", "FINANCE", "PROCUREMENT_MANAGER"].includes(
      profile,
    );
  if (filter === "oficina")
    return ["ADMINISTRATIVE", "FINANCE"].includes(profile);
  if (filter === "comercial")
    return ["SALES", "SALES_MANAGER"].includes(profile);
  if (filter === "obra")
    return ["PROJECT_MANAGER", "TEAM_SUPERVISOR"].includes(profile);
  if (filter === "operacion")
    return ["WORKER", "EXTERNAL_COLLABORATOR"].includes(profile);
  if (filter === "lectura")
    return accessMode === "READ_ONLY" || profile === "ADVISOR_AUDITOR";
  return true;
}

function profileAreaLabel(profile: FunctionalProfileKey) {
  const labels: Record<FunctionalProfileKey, string> = {
    OWNER: "Dirección",
    GENERAL_MANAGER: "Dirección",
    SALES_MANAGER: "Comercial",
    SALES: "Comercial",
    ADMINISTRATIVE: "Administración",
    FINANCE: "Finanzas",
    PROCUREMENT_MANAGER: "Compras",
    PROJECT_MANAGER: "Ejecución",
    TEAM_SUPERVISOR: "Ejecución",
    WORKER: "Ejecución",
    EXTERNAL_COLLABORATOR: "Colaboración",
    ADVISOR_AUDITOR: "Asesoría",
  };
  return labels[profile];
}

function memberAccessLabel(member: {
  role: string;
  accessMode: string;
  scopeAssignments: Array<{ scope: string }>;
}) {
  if (member.accessMode === "READ_ONLY") return "Solo lectura";
  if (member.role === "OWNER") return "Completo";
  const scopes = new Set(member.scopeAssignments.map((item) => item.scope));
  if (scopes.size > 1) return "Acceso mixto";
  if (scopes.has("COMPANY")) return "Empresa autorizada";
  if (scopes.has("SELECTED_WORKS")) return "Proyectos asignados";
  if (scopes.has("SELECTED_CLIENTS")) return "Clientes asignados";
  if (scopes.has("TEAM")) return "Equipo asignado";
  if (scopes.has("ASSIGNED")) return "Acceso asignado";
  if (scopes.has("OWN")) return "Acceso propio";
  return "Según perfil";
}

function shortMembershipStatusLabel(status: string) {
  const labels: Record<string, string> = {
    invited: "Invitado",
    pending_approval: "Pendiente",
    active: "Activo",
    suspended: "Suspendido",
    revoked: "Revocado",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatMemberActivity(value: Date | null) {
  if (!value) return "Sin acceso";
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(value);
  if (date === today) return `Hoy, ${time}`;
  const dayDifference = Math.floor((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${date}T12:00:00Z`).getTime()) / 86_400_000);
  if (dayDifference === 1) return `Ayer, ${time}`;
  if (dayDifference > 1 && dayDifference < 7) return `Hace ${dayDifference} días`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(value);
}

function memberInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function roleTone(profile: FunctionalProfileKey, accessMode: string) {
  if (accessMode === "READ_ONLY" || profile === "ADVISOR_AUDITOR") return "read";
  if (profile === "OWNER") return "owner";
  if (["SALES", "SALES_MANAGER"].includes(profile)) return "sales";
  if (["PROJECT_MANAGER", "TEAM_SUPERVISOR", "WORKER", "EXTERNAL_COLLABORATOR"].includes(profile)) return "field";
  return "office";
}

function workloadLabel(
  load: { count: number; estimatedMinutes: number } | null,
) {
  if (!load?.count) return "Sin tareas activas";
  if (!load.estimatedMinutes)
    return `${load.count} ${load.count === 1 ? "tarea" : "tareas"}`;
  const hours = Math.floor(load.estimatedMinutes / 60);
  const minutes = load.estimatedMinutes % 60;
  const duration = [hours ? `${hours} h` : "", minutes ? `${minutes} min` : ""]
    .filter(Boolean)
    .join(" ");
  return `${load.count} ${load.count === 1 ? "tarea" : "tareas"} · ${duration}`;
}

function membershipStatusLabel(status: string) {
  const labels: Record<string, string> = {
    invited: "Invitación pendiente",
    pending_approval: "Pendiente de aprobación",
    active: "Acceso activo",
    suspended: "Suspendido",
    revoked: "Revocado",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function invitationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente de aceptación",
    PENDING_EMPLOYEE: "Pendiente de la persona",
    EMPLOYEE_ACCEPTED: "Aceptada por la persona",
    PENDING_OWNER_APPROVAL: "Pendiente de aprobación del propietario",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}
