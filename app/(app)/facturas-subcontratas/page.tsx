import { PurchaseInvoiceDirectory } from "@/components/purchase-invoices";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function SubcontractorInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { companyId } = await requireCompanyContext();
  return <PurchaseInvoiceDirectory companyId={companyId} kind="SUBCONTRACTOR" searchParams={searchParams} />;
}
