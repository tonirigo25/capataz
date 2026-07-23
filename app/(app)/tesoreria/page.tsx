import { EconomicControlCenter } from "@/components/economic-control-center";
import { requireCapability } from "@/lib/commercial/authorization";
import { getTreasuryRecommendations } from "@/lib/business-recommendations";
import { getEconomicControl } from "@/lib/economic-control/queries";

export const dynamic = "force-dynamic";

type TreasurySearchParams = {
  vista?: string;
  periodo?: string;
  cliente?: string;
  obra?: string;
  estado?: string;
};

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<TreasurySearchParams> }) {
  const query = await searchParams;
  const { companyId } = await requireCapability("treasury.view");
  const [data, recommendations] = await Promise.all([
    getEconomicControl({
      area: query.vista,
      period: query.periodo,
      clientId: query.cliente,
      workId: query.obra,
      status: query.estado
    }),
    getTreasuryRecommendations(5, companyId)
  ]);

  return <EconomicControlCenter data={data} recommendations={recommendations.recommendations} />;
}
