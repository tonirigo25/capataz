import Link from "next/link";
import { requireCapability } from "@/lib/commercial/authorization";
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
  resolveFunctionalProfile,
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

export default async function TeamPage() {
  const auth = await requireCapability("company.members.view");
  const owner = auth.role === "OWNER";
  const [members, invitations, pendingOutbox, works, clients, teams] =
    await Promise.all([
      prisma.companyMembership.findMany({
        where: { companyId: auth.companyId },
        include: {
          user: true,
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
    ]);

  return (
    <main className="screen">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-label">Configuración · Equipo</p>
          <h1 className="type-page-title mt-2">Roles y acceso</h1>
          <p className="type-secondary mt-2">
            Perfiles profesionales, paquetes y alcance efectivo en{" "}
            {auth.companyName}.
          </p>
        </div>
        {owner ? (
          <Link href="/equipo/outbox" className="secondary-button">
            Bandeja interna · {pendingOutbox}
          </Link>
        ) : null}
      </header>

      {owner ? (
        <section className="card mt-6 p-4">
          <h2 className="type-section-title">Invitar a una persona</h2>
          <p className="type-secondary mt-1">
            La persona deberá aceptar y después esperar tu aprobación.
          </p>
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
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="visibleFields" value={key} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
        </section>
      ) : (
        <section className="card mt-6 p-4">
          <h2 className="type-section-title">Equipo</h2>
          <p className="type-secondary mt-2">
            Puedes consultar quién participa. Solo el propietario puede invitar
            o cambiar accesos.
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="type-section-title">Miembros</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {members.map((member) => {
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
                      {member.user.email} · {functionalProfileLabels[profile]}
                    </p>
                    <p className="mt-1 text-xs text-content-tertiary">
                      {member.status === "active"
                        ? member.teamMemberships
                            .map((item) => item.team.name)
                            .join(", ") || "Sin equipo"
                        : `Estado: ${member.status}`}
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
                        <button className="secondary-button">Guardar</button>
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
                          <button className="secondary-button">Aplicar</button>
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
                            <option value="internal_cost">Coste interno</option>
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
                          <button className="secondary-button">Aplicar</button>
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
                                <button className="ghost-button">Quitar</button>
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
                          <option value="invoice.issue">Emitir factura</option>
                          <option value="payment.approve">Aprobar pago</option>
                          <option value="payment.execute">Ejecutar pago</option>
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
                        <button className="secondary-button">Aplicar</button>
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
                        required
                        type="password"
                        name="currentPassword"
                        autoComplete="current-password"
                        aria-label="Contraseña actual para transferir"
                        className="field max-w-xs"
                        placeholder="Contraseña actual"
                      />
                      <button
                        name="confirm"
                        value="TRANSFERIR"
                        className="ghost-button"
                      >
                        Transferir propiedad
                      </button>
                    </form>
                    <form
                      action={changeMembershipState}
                      className="flex flex-wrap gap-2"
                    >
                      <input
                        type="hidden"
                        name="membershipId"
                        value={member.id}
                      />
                      {member.status === "active" ? (
                        <button
                          name="membershipAction"
                          value="suspend"
                          className="secondary-button"
                        >
                          Suspender
                        </button>
                      ) : member.status === "suspended" ? (
                        <button
                          name="membershipAction"
                          value="reactivate"
                          className="secondary-button"
                        >
                          Reactivar
                        </button>
                      ) : null}
                      <button
                        name="membershipAction"
                        value="revoke"
                        className="ghost-button"
                      >
                        Revocar acceso
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {owner ? (
        <section className="mt-6">
          <h2 className="type-section-title">Invitaciones y aprobaciones</h2>
          <div className="mt-3 grid gap-2">
            {invitations.length ? (
              invitations.map((item) => (
                <div key={item.id} className="card p-4">
                  <div>
                    <strong>{item.emailNormalized}</strong>
                    <p className="type-secondary">
                      {item.functionalProfileKey ?? item.role} · {item.status} ·
                      caduca {item.expiresAt.toLocaleDateString("es-ES")}
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
                          <button className="primary-button">Aprobar</button>
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
        </section>
      ) : null}
    </main>
  );
}
