import { buildTreasuryCsvExport } from "@/lib/treasury";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { companyId } = await requireCapability("reports.export");
  await requireCapability("treasury.view");
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "forecast";
  const csv = await buildTreasuryCsvExport(tipo, {
    companyId,
    horizon: url.searchParams.get("horizonte") ?? undefined,
    scenario: url.searchParams.get("escenario") ?? undefined,
    accountId: url.searchParams.get("cuenta"),
    workId: url.searchParams.get("obra"),
    clientId: url.searchParams.get("cliente"),
    category: url.searchParams.get("categoria"),
    status: url.searchParams.get("estado"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to")
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orqena-tesoreria-${tipo}.csv"`
    }
  });
}
