import { requireActiveOwner } from "@/lib/commercial/owner-governance";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";

export default async function PortalPreviewPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const owner = await requireActiveOwner();
  const { membershipId } = await params;
  let member = await prisma.companyMembership.findFirst({ where: { id: membershipId, companyId: owner.companyId }, include: { user: true, company: true } });
  if (!member) {
    const invitation = await prisma.invitation.findFirstOrThrow({ where: { id: membershipId, companyId: owner.companyId, status: "PENDING_OWNER_APPROVAL" } });
    member = await prisma.companyMembership.findFirstOrThrow({ where: { companyId: owner.companyId, status: "pending_owner_approval", user: { emailNormalized: invitation.emailNormalized } }, include: { user: true, company: true } });
  }
  const manifest = await buildPortalManifest({ ...owner, userId: member.userId, membershipId: member.id, role: member.role, functionalProfileKey: member.functionalProfileKey, displayName: member.user.displayName, email: member.user.email, companyName: member.company.nombreComercial, isDemo: member.company.isDemo, companyStatus: member.company.status, commercialStatus: member.company.commercialStatus ?? "ACTIVE" });
  const rows = [{ label: "Clientes", value: manifest.searchableDomains.includes("clients") ? "Sí" : "No" }, { label: "Presupuestos", value: manifest.packages.includes("SALES_QUOTES") ? "Crear y editar" : "No" }, { label: "Precio de venta", value: manifest.fieldVisibility.sale_price ? "Sí" : "No" }, { label: "Coste de compra", value: manifest.fieldVisibility.purchase_cost ? "Sí" : "No" }, { label: "Margen", value: manifest.fieldVisibility.margin_percent || manifest.fieldVisibility.margin_amount ? "Sí" : "No" }, { label: "Tesorería", value: manifest.fieldVisibility.treasury ? "Sí" : "No" }, { label: "Trabajos", value: manifest.scopes.some((item) => item.scope !== "COMPANY") ? "Solo asignados" : "Según su perfil" }, { label: brand.productName, value: manifest.orqenaTools.length ? "Dentro de su alcance" : "No" }];
  return <main className="screen"><InternalBreadcrumbs items={[{ label: "Equipo", href: "/equipo" }, { label: member.user.displayName }]} /><p className="type-label mt-1">Previsualización segura</p><h1 className="type-page-title mt-2">Portal de {member.user.displayName}</h1><p className="type-secondary mt-2">{manifest.profileLabel} · {manifest.readOnly ? "Solo lectura" : "Acceso de trabajo"}. Esta vista no inicia sesión como la persona ni permite ejecutar acciones.</p><div className="mt-6 grid gap-4 lg:grid-cols-2"><section className="card p-4"><h2 className="type-section-title">Navegación</h2><ul className="mt-3 grid gap-2">{manifest.navigation.map((item) => <li key={item.href} className="rounded-lg bg-subtle px-3 py-2">{item.label}</li>)}</ul></section><section className="card p-4"><h2 className="type-section-title">Acceso comprensible</h2><dl className="mt-3 divide-y divide-border">{rows.map((row) => <div key={row.label} className="flex justify-between gap-4 py-2"><dt>{row.label}</dt><dd className="font-semibold">{row.value}</dd></div>)}</dl></section></div></main>;
}
