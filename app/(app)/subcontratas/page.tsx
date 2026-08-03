import { redirect } from "next/navigation";
import { SubcontractorDirectoryV2 } from "@/components/subcontractor-directory-v2";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SubcontractorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requireCapability("purchases.suppliers.view");
  if (context.scope !== "COMPANY") redirect("/acceso-restringido?reason=scope");
  const [manage, exportDecision] = await Promise.all([
    resolveAuthorization(context, "purchases.suppliers.manage"),
    resolveAuthorization(context, "reports.export"),
  ]);
  return <SubcontractorDirectoryV2
    companyId={context.companyId}
    searchParams={searchParams}
    canManage={manage.allowed && manage.scope === "COMPANY"}
    canExport={exportDecision.allowed && exportDecision.scope === "COMPANY"}
  />;
}
