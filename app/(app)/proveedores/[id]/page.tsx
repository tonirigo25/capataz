import { PartnerProfile } from "@/components/procurement-partners";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, { companyId }] = await Promise.all([params, requireCapability("purchases.suppliers.view")]);
  return <>
    <BreadcrumbPrelude items={[{ label: "Proveedores", href: "/proveedores" }, { label: "Ficha de proveedor" }]} />
    <PartnerProfile companyId={companyId} kind="SUPPLIER" id={id} searchParams={searchParams} />
  </>;
}

function BreadcrumbPrelude({ items }: { items: Parameters<typeof InternalBreadcrumbs>[0]["items"] }) {
  return <div className="mx-auto -mb-6 w-full px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8" style={{ maxWidth: "var(--cap-content-max)" }}><InternalBreadcrumbs items={items} /></div>;
}
