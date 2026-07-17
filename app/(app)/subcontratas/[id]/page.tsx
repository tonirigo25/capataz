import { PartnerProfile } from "@/components/procurement-partners";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function SubcontractorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, { companyId }] = await Promise.all([params, requireCompanyContext()]);
  return <PartnerProfile companyId={companyId} kind="SUBCONTRACTOR" id={id} searchParams={searchParams} />;
}
