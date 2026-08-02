import { redirect } from "next/navigation";
import { SupplierDirectoryV2 } from "@/components/supplier-directory-v2";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requireCapability("purchases.suppliers.view");
  if (context.scope !== "COMPANY") redirect("/acceso-restringido?reason=scope");
  const [manage, exportDecision] = await Promise.all([
    resolveAuthorization(context, "purchases.suppliers.manage"),
    resolveAuthorization(context, "reports.export"),
  ]);
  return <SupplierDirectoryV2
    companyId={context.companyId}
    searchParams={searchParams}
    canManage={manage.allowed && manage.scope === "COMPANY"}
    canExport={exportDecision.allowed && exportDecision.scope === "COMPANY"}
  />;
}
