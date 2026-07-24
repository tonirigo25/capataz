import { PartnerProfile } from "@/components/procurement-partners";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";
export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, { companyId }] = await Promise.all([params, requireCapability("purchases.suppliers.view")]);
  return <PartnerProfile companyId={companyId} kind="SUPPLIER" id={id} searchParams={searchParams} />;
}
