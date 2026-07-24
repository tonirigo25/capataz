import { PartnerDirectory } from "@/components/procurement-partners";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SubcontractorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { companyId } = await requireCapability("purchases.suppliers.view");
  return <PartnerDirectory companyId={companyId} kind="SUBCONTRACTOR" searchParams={searchParams} />;
}
