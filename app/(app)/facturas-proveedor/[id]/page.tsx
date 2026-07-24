import { PurchaseInvoiceProfile } from "@/components/purchase-invoices";
import { requireCapability } from "@/lib/commercial/authorization";
import { getPurchaseAccess } from "@/lib/commercial/purchase-access";

export const dynamic = "force-dynamic";
export default async function SupplierInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, auth] = await Promise.all([params, requireCapability("purchases.received_invoices.view")]);
  return <PurchaseInvoiceProfile companyId={auth.companyId} kind="SUPPLIER" id={id} searchParams={searchParams} access={await getPurchaseAccess(auth)} />;
}
