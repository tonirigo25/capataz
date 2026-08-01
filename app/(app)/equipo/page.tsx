import Link from "next/link";
import {
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

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    persona?: string;
    invitar?: string;
    perfil?: string;
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
      ? prisma.task.groupBy({
          by: ["assigneeId"],
          where: {
            companyId: auth.companyId,
            assigneeId: { not: null },
            archivedAt: null,
            status: { notIn: ["completed", "cancelled", "archived"] },
          },
          _count: { _all: true },
          _sum: { estimatedMinutes: true },
        })
      : Promise.resolve([]),
  ]);
  const profileFilter = query.perfil ?? "todos";
  const filteredMembers = members.filter((member) =>
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
      : null) ?? null;
  const selectedProfile = selectedMember
    ? resolveFunctionalProfile(
        selectedMember.functionalProfileKey,
        selectedMember.role,
      )
    : null;
  const activeMembers = members.filter((member) => member.status === "active");
  const workloadByUser = new Map(
    taskLoads
      .filter((item) => item.assigneeId)
      .map((item) => [
        item.assigneeId as string,
        {
          count: item._count._all,
          estimatedMinutes: item._sum.estimatedMinutes ?? 0,
        },
      ]),
  );
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

  return (
    <main className="screen !max-w-none" data-team-canonical>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-obra-ink">
            Equipo
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestiona personas, roles y permisos de {auth.companyName} sin
            ampliar su acceso desde esta vista.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-emerald-700">
            {activeMembers.length} de {members.length} miembros activos
          </span>
          {owner ? (
            <>
              <Link href="/equipo/outbox" className="secondary-button">
                Bandeja interna · {pendingOutbox}
              </Link>
              <Link
                href={`/equipo?perfil=${profileFilter}&invitar=1#invitar`}
                className="primary-button"
              >
                <UserPlus size={17} aria-hidden="true" /> Invitar miembro
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <section className="mt-5" aria-labelledby="team-role-filters">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2
            id="team-role-filters"
            className="text-sm font-bold text-obra-ink"
          >
            Filtros por rol
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {filteredMembers.length} visibles
          </span>
        </div>
        <nav
          aria-label="Perfiles del equipo"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {teamFilters.map(([id, label]) => (
            <Link
              key={id}
              href={`/equipo?perfil=${id}`}
              aria-current={profileFilter === id ? "page" : undefined}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-lg border px-3 py-1.5 text-sm font-bold transition ${profileFilter === id ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
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

      <section
        className="mt-6 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]"
        data-d8-team-workspace
      >
        <div
          className="card h-fit overflow-hidden"
          aria-label="Lista de personas"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-base font-extrabold text-obra-ink">
                Miembros y acceso
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Selecciona una persona para consultar su acceso y administrar
                sus permisos.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
              {filteredMembers.length}
            </span>
          </div>
          <div className="hidden grid-cols-[minmax(9.5rem,1.35fr)_minmax(6.5rem,.9fr)_minmax(5.5rem,.75fr)_minmax(6rem,.8fr)_5rem_5.25rem_minmax(6rem,.8fr)_1.75rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 lg:grid">
            <span>Miembro</span>
            <span>Rol</span>
            <span>Área</span>
            <span>Acceso</span>
            <span>Estado</span>
            <span>Último acceso</span>
            <span>Carga de trabajo</span>
            <span aria-hidden="true" />
          </div>
          <div className="divide-y divide-slate-100">
            {filteredMembers.map((member) => {
              const profile = resolveFunctionalProfile(
                member.functionalProfileKey,
                member.role,
              );
              const workload = workloadByUser.get(member.userId) ?? null;
              const workloadRatio = workload
                ? workload.estimatedMinutes > 0 && maximumEstimatedMinutes > 0
                  ? workload.estimatedMinutes / maximumEstimatedMinutes
                  : maximumTaskCount > 0
                    ? workload.count / maximumTaskCount
                    : 0
                : 0;
              return (
                <Link
                  key={member.id}
                  href={`/equipo?persona=${member.id}&perfil=${profileFilter}#detalle-equipo`}
                  aria-current={
                    member.id === selectedMember?.id ? "page" : undefined
                  }
                  className={`grid grid-cols-2 gap-x-3 gap-y-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 lg:grid-cols-[minmax(9.5rem,1.35fr)_minmax(6.5rem,.9fr)_minmax(5.5rem,.75fr)_minmax(6rem,.8fr)_5rem_5.25rem_minmax(6rem,.8fr)_1.75rem] lg:items-center ${member.id === selectedMember?.id ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-300" : "bg-white"}`}
                >
                  <span className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
                    <CircleUserRound
                      size={30}
                      className="shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-obra-ink">
                        {member.user.displayName}
                      </strong>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                        {member.user.email}
                        {member.user.mfaFactors.length ? (
                          <ShieldCheck
                            size={12}
                            className="shrink-0 text-emerald-600"
                            aria-label="MFA activa"
                          />
                        ) : null}
                      </span>
                    </span>
                  </span>
                  <span className="min-w-0 text-xs font-semibold text-slate-700">
                    <small className="mb-0.5 block text-[9px] font-bold uppercase text-slate-400 lg:hidden">
                      Rol
                    </small>
                    <span className="block truncate">
                      {functionalProfileLabels[profile]}
                    </span>
                  </span>
                  <span className="min-w-0 text-xs text-slate-600">
                    <small className="mb-0.5 block text-[9px] font-bold uppercase text-slate-400 lg:hidden">
                      Área
                    </small>
                    <span className="block truncate">
                      {profileAreaLabel(profile)}
                    </span>
                  </span>
                  <span className="min-w-0 text-xs text-slate-600">
                    <small className="mb-0.5 block text-[9px] font-bold uppercase text-slate-400 lg:hidden">
                      Acceso
                    </small>
                    <span className="block truncate">
                      {memberAccessLabel(member)}
                    </span>
                  </span>
                  <span>
                    <small className="mb-0.5 block text-[9px] font-bold uppercase text-slate-400 lg:hidden">
                      Estado
                    </small>
                    <SoftBadge
                      tone={member.status === "active" ? "success" : "warning"}
                    >
                      {shortMembershipStatusLabel(member.status)}
                    </SoftBadge>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600">
                    <small className="mb-0.5 block text-[9px] font-bold uppercase text-slate-400 lg:hidden">
                      Último acceso
                    </small>
                    {formatMemberActivity(
                      member.lastActivityAt ?? member.user.lastLoginAt,
                    )}
                  </span>
                  <span className="min-w-0 text-[11px] font-semibold text-slate-600">
                    <small className="mb-0.5 block text-[9px] font-bold uppercase text-slate-400 lg:hidden">
                      Carga de trabajo
                    </small>
                    {canViewCompanyWorkload
                      ? workloadLabel(workload)
                      : "No disponible"}
                    {canViewCompanyWorkload &&
                    workload &&
                    workload.count > 0 ? (
                      <span
                        className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200"
                        aria-label="Carga relativa entre miembros visibles"
                      >
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.max(6, Math.round(workloadRatio * 100))}%`,
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="hidden justify-self-end text-slate-500 lg:inline-flex"
                    aria-label={`Ver detalle de ${member.user.displayName}`}
                  >
                    <Ellipsis size={18} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
            {!filteredMembers.length ? (
              <p className="p-4 text-sm text-slate-500">
                No hay miembros para este filtro.
              </p>
            ) : null}
          </div>
        </div>
        <article
          id="detalle-equipo"
          className="card h-fit scroll-mt-24 p-4 2xl:sticky 2xl:top-20"
          data-d8-resulting-portal
        >
          <p className="type-label text-emerald-700">Detalle del miembro</p>
          {selectedMember && selectedProfile ? (
            <>
              <div className="mt-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="type-section-title">
                    {selectedMember.user.displayName}
                  </h2>
                  <p className="type-secondary mt-1">
                    {functionalProfileLabels[selectedProfile]} ·{" "}
                    {accessModeLabel(selectedMember.accessMode)}
                  </p>
                </div>
              </div>
              <dl className="mt-3 divide-y divide-slate-100">
                <PortalFact
                  label="Perfil"
                  value={functionalProfileLabels[selectedProfile]}
                />
                <PortalFact
                  label="Área"
                  value={profileAreaLabel(selectedProfile)}
                />
                <PortalFact
                  label="Alcance"
                  value={memberAccessLabel(selectedMember)}
                />
                <PortalFact
                  label="Modo"
                  value={accessModeLabel(selectedMember.accessMode)}
                />
                <PortalFact
                  label="Estado"
                  value={membershipStatusLabel(selectedMember.status)}
                />
                <PortalFact
                  label="Último acceso"
                  value={formatMemberActivity(
                    selectedMember.lastActivityAt ??
                      selectedMember.user.lastLoginAt,
                  )}
                />
                <PortalFact
                  label="Carga actual"
                  value={
                    canViewCompanyWorkload
                      ? workloadLabel(selectedWorkload)
                      : "No disponible con este alcance"
                  }
                />
                <PortalFact
                  label="MFA"
                  value={
                    selectedMember.user.mfaFactors.length
                      ? "Activa"
                      : "Pendiente"
                  }
                />
                <PortalFact
                  label="Configuración adicional"
                  value={configurationSummary(selectedMember)}
                />
                <PortalFact
                  label="Paquetes"
                  value={
                    selectedMember.accessPackages.length
                      ? `${selectedMember.accessPackages.length} configurados`
                      : "Según perfil"
                  }
                />
                <PortalFact
                  label="Campos económicos"
                  value={
                    selectedMember.fieldVisibilityPolicies.filter(
                      (item) => item.visible,
                    ).length
                      ? `${selectedMember.fieldVisibilityPolicies.filter((item) => item.visible).length} visibles`
                      : "Sin concesión adicional"
                  }
                />
                <PortalFact
                  label="Aprobación"
                  value={
                    selectedMember.approvalAuthorities.length
                      ? `${selectedMember.approvalAuthorities.length} autoridades`
                      : "Sin autoridad adicional"
                  }
                />
              </dl>
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <strong className="text-obra-ink">
                  Previsualizar antes de aplicar.
                </strong>{" "}
                Ningún ajuste se aplica desde este resumen.
              </p>
              {owner ? (
                <div className="mt-4 grid gap-2">
                  {selectedMember.userId !== auth.userId &&
                  selectedMember.role !== "OWNER" ? (
                    <Link
                      className="primary-button justify-center"
                      href="#ajustes-persona"
                    >
                      <UserCog size={16} aria-hidden="true" /> Editar permisos
                    </Link>
                  ) : null}
                  <Link
                    className="secondary-button justify-center"
                    href={`/equipo/${selectedMember.id}/portal`}
                  >
                    <Eye size={16} aria-hidden="true" /> Previsualizar portal
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-5 text-center">
              <UsersRound
                size={26}
                className="mx-auto text-slate-400"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-bold text-obra-ink">
                Selecciona un miembro
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                El detalle aparece sólo después de una selección explícita.
              </p>
            </div>
          )}
        </article>
      </section>

      <section className="mt-6" aria-labelledby="team-role-capabilities">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="team-role-capabilities" className="type-section-title">
              Acceso base por rol
            </h2>
            <p className="type-meta mt-1">
              Resumen del catálogo configurado; los permisos efectivos pueden
              estar limitados por alcance o excepciones.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {teamRoleCards.map((card) => {
            const Icon = card.icon;
            const packages = profileDefaultPackages[card.profile];
            return (
              <Link
                key={card.filter}
                href={`/equipo?perfil=${card.filter}`}
                className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <h3 className="mt-2 text-sm font-extrabold text-obra-ink">
                  {card.label}
                </h3>
                <ul className="mt-2 space-y-1 text-[11px] leading-4 text-slate-600">
                  {packages.slice(0, 3).map((key) => (
                    <li key={key}>• {accessPackageLabels[key]}</li>
                  ))}
                </ul>
                {packages.length > 3 ? (
                  <p className="mt-2 text-[10px] font-bold text-emerald-700">
                    + {packages.length - 3} áreas configuradas
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
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
            <span>Invitaciones y aprobaciones</span>
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

function PortalFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="max-w-[60%] text-right text-xs font-bold leading-5 text-obra-ink">
        {value}
      </dd>
    </div>
  );
}

const teamFilters = [
  ["todos", "Todos"],
  ["propiedad", "Propiedad"],
  ["direccion", "Dirección"],
  ["oficina", "Oficina"],
  ["comercial", "Comercial"],
  ["obra", "Jefatura de obra"],
  ["operacion", "Operación"],
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
    label: "Dirección",
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
  role: string,
  accessMode: string,
  filter: string,
) {
  if (filter === "todos") return true;
  if (filter === "propiedad") return role === "OWNER";
  if (filter === "direccion")
    return ["GENERAL_MANAGER", "FINANCE", "PROCUREMENT_MANAGER"].includes(
      profileKey ?? "",
    );
  if (filter === "oficina")
    return ["ADMINISTRATIVE", "FINANCE"].includes(profileKey ?? "");
  if (filter === "comercial")
    return ["SALES", "SALES_MANAGER"].includes(profileKey ?? "");
  if (filter === "obra")
    return ["PROJECT_MANAGER", "TEAM_SUPERVISOR"].includes(profileKey ?? "");
  if (filter === "operacion")
    return ["WORKER", "EXTERNAL_COLLABORATOR"].includes(profileKey ?? "");
  if (filter === "lectura")
    return accessMode === "READ_ONLY" || profileKey === "ADVISOR_AUDITOR";
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
  if (scopes.has("COMPANY")) return "Completo";
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
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(value);
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

function configurationSummary(member: {
  accessPackages: unknown[];
  scopeAssignments: unknown[];
  approvalAuthorities: unknown[];
  fieldVisibilityPolicies: Array<{ visible: boolean }>;
  teamMemberships: unknown[];
}) {
  const details = [
    member.scopeAssignments.length
      ? `${member.scopeAssignments.length} alcances`
      : "",
    member.accessPackages.length
      ? `${member.accessPackages.length} paquetes`
      : "",
    member.approvalAuthorities.length
      ? `${member.approvalAuthorities.length} aprobaciones`
      : "",
    member.fieldVisibilityPolicies.filter((item) => item.visible).length
      ? `${member.fieldVisibilityPolicies.filter((item) => item.visible).length} campos visibles`
      : "",
    member.teamMemberships.length
      ? `${member.teamMemberships.length} equipos`
      : "",
  ].filter(Boolean);
  return details.join(" · ") || "Según perfil";
}

function accessModeLabel(mode: string) {
  return mode === "READ_ONLY" ? "Solo lectura" : "Trabajo normal";
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
