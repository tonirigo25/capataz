import { PurchaseInvoiceProfile } from "@/components/purchase-invoices";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function SupplierInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, { companyId }] = await Promise.all([params, requireCompanyContext()]);
  return <PurchaseInvoiceProfile companyId={companyId} kind="SUPPLIER" id={id} searchParams={searchParams} />;
}
