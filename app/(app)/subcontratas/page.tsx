import { PartnerDirectory } from "@/components/procurement-partners";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function SubcontractorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { companyId } = await requireCompanyContext();
  return <PartnerDirectory companyId={companyId} kind="SUBCONTRACTOR" searchParams={searchParams} />;
}
