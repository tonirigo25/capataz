import { PurchaseInvoiceDirectory } from "@/components/purchase-invoices";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SubcontractorInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { companyId } = await requireCapability("purchases.received_invoices.view");
  return <PurchaseInvoiceDirectory companyId={companyId} kind="SUBCONTRACTOR" searchParams={searchParams} />;
}
