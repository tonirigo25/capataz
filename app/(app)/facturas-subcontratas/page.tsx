import { PurchaseInvoiceDirectory } from "@/components/purchase-invoices";
import { requireCapability } from "@/lib/commercial/authorization";
import { getPurchaseAccess } from "@/lib/commercial/purchase-access";

export const dynamic = "force-dynamic";
export default async function SubcontractorInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requireCapability("purchases.received_invoices.view");
  return <PurchaseInvoiceDirectory companyId={auth.companyId} kind="SUBCONTRACTOR" searchParams={searchParams} access={await getPurchaseAccess(auth)} />;
}
