import { EconomicControlCenter } from "@/components/economic-control-center";
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
  const data = await getEconomicControl({
    area: query.vista,
    period: query.periodo,
    clientId: query.cliente,
    workId: query.obra,
    status: query.estado
  });

  return <EconomicControlCenter data={data} />;
}
