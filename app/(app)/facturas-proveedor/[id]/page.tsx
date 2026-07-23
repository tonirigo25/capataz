import { PurchaseInvoiceProfile } from "@/components/purchase-invoices";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SupplierInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, { companyId }] = await Promise.all([params, requireCapability("purchases.received_invoices.view")]);
  return <PurchaseInvoiceProfile companyId={companyId} kind="SUPPLIER" id={id} searchParams={searchParams} />;
}
