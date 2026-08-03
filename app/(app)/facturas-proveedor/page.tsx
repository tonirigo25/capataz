import { SupplierInvoiceDirectoryV2 } from "@/components/supplier-invoice-directory-v2";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { getPurchaseAccess } from "@/lib/commercial/purchase-access";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requireCapability("purchases.received_invoices.view");
  const [access, exportDecision] = await Promise.all([
    getPurchaseAccess(auth),
    resolveAuthorization(auth, "reports.export"),
  ]);
  return <SupplierInvoiceDirectoryV2 companyId={auth.companyId} searchParams={searchParams} access={access} canExport={exportDecision.allowed && exportDecision.scope === "COMPANY"} />;
}
