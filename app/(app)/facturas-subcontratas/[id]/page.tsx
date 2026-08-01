import { PurchaseInvoiceProfile } from "@/components/purchase-invoices";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { requireCapability } from "@/lib/commercial/authorization";
import { getPurchaseAccess } from "@/lib/commercial/purchase-access";

export const dynamic = "force-dynamic";
export default async function SubcontractorInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, auth] = await Promise.all([params, requireCapability("purchases.received_invoices.view")]);
  return <>
    <BreadcrumbPrelude items={[{ label: "Dinero", href: "/dinero" }, { label: "Facturas de subcontrata", href: "/facturas-subcontratas" }, { label: "Detalle" }]} />
    <PurchaseInvoiceProfile companyId={auth.companyId} kind="SUBCONTRACTOR" id={id} searchParams={searchParams} access={await getPurchaseAccess(auth)} />
  </>;
}

function BreadcrumbPrelude({ items }: { items: Parameters<typeof InternalBreadcrumbs>[0]["items"] }) {
  return <div className="mx-auto -mb-6 w-full px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8" style={{ maxWidth: "var(--cap-content-max)" }}><InternalBreadcrumbs items={items} /></div>;
}
