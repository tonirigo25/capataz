import { prisma } from "@/lib/prisma";
import { requirePlatformAccount } from "@/lib/commercial/platform";
import { createSupportGrant, closeSupportGrant, toggleCompanySuspension } from "./actions";
import { UnitEconomicsCalculator } from "@/components/platform/unit-economics-calculator";

export default async function PlatformPage() {
  const actor = await requirePlatformAccount();
  const [companies, grants, demoRequests] = await Promise.all([
    prisma.company.findMany({ include: { subscriptions: { include: { plan: true }, take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { memberships: true, usageRecords: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.supportAccessGrant.findMany({ where: { platformAccountId: actor.platformAccountId, status: "ACTIVE" }, include: { company: true } }),
    prisma.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  ]);
  return <main className="screen">
    <p className="type-label">Plataforma interna · {actor.platformRole}</p>
    <h1 className="type-page-title mt-2">Administración de tenants</h1>
    <section className="mt-6" aria-labelledby="demo-requests-title">
      <h2 id="demo-requests-title" className="type-section-title">Solicitudes de demo</h2>
      <div className="mt-3 grid gap-3">
        {demoRequests.length ? demoRequests.map((request) => <article className="card p-4" key={request.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{request.displayName} · {request.companyName}</strong><p className="type-secondary">{request.emailNormalized} · {request.sectorKey ?? "Sector pendiente"} · {request.teamSize ?? "Tamaño pendiente"}</p></div><span className="status-chip">{request.status}</span></div>
          {request.message ? <p className="mt-3 text-sm text-content-secondary">{request.message}</p> : null}
          <p className="mt-2 text-xs text-content-tertiary">Consentimiento registrado · {request.createdAt.toLocaleString("es-ES")}</p>
        </article>) : <p className="empty-state">Todavía no hay solicitudes.</p>}
      </div>
    </section>
    <section className="mt-8" aria-labelledby="tenants-title"><h2 id="tenants-title" className="type-section-title">Empresas</h2><div className="mt-3 grid gap-3">{companies.map((company) => <article className="card grid gap-3 p-4 lg:grid-cols-[1fr_auto]" key={company.id}><div><strong>{company.nombreComercial}</strong><p className="type-secondary">{company.commercialStatus} · {company.subscriptions[0]?.plan.name ?? "Plan base"} · {company._count.memberships} membresías</p><p className="mt-1 text-xs text-content-tertiary">La plataforma no concede acceso a los datos del tenant.</p></div><div className="flex flex-wrap gap-2"><form action={createSupportGrant} className="flex flex-wrap gap-2"><input type="hidden" name="companyId" value={company.id}/><input required name="reason" className="field h-10 max-w-48" placeholder="Motivo obligatorio"/><input name="ticket" className="field h-10 max-w-32" placeholder="Ticket"/><input type="hidden" name="minutes" value="30"/><button className="secondary-button">Soporte 30 min</button></form>{actor.platformRole !== "PLATFORM_ANALYST" ? <form action={toggleCompanySuspension}><input type="hidden" name="companyId" value={company.id}/><input type="hidden" name="suspend" value={String(company.commercialStatus !== "SUSPENDED")}/><input type="hidden" name="reason" value="Cambio confirmado desde plataforma interna"/><button className="ghost-button">{company.commercialStatus === "SUSPENDED" ? "Reactivar" : "Suspender"}</button></form> : null}</div></article>)}</div></section>
    {actor.platformRole === "PLATFORM_OWNER" ? <UnitEconomicsCalculator /> : null}
    {grants.length ? <aside className="fixed inset-x-3 bottom-20 z-50 rounded-xl bg-amber-100 p-4 shadow-card lg:left-auto lg:right-5 lg:w-96"><strong>Acceso temporal activo</strong>{grants.map((grant) => <form action={closeSupportGrant} key={grant.id} className="mt-2 flex items-center justify-between gap-2"><span className="text-sm">{grant.company.nombreComercial} · hasta {grant.expiresAt.toLocaleTimeString("es-ES")}</span><input type="hidden" name="grantId" value={grant.id}/><button className="ghost-button">Finalizar</button></form>)}</aside> : null}
  </main>;
}
