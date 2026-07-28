import { publicRequestContext } from "@/lib/platform/request-boundary";
import { buildTreasuryCsvExport } from "@/lib/treasury";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRequestContext("GET /tesoreria/export", request, async () => {
  const auth = await requireCapability("reports.export");
  const { companyId } = auth;
  const requiredCapabilities = ["treasury.view", "banking.view", "sales.invoices.view", "purchases.received_invoices.view", "purchase_cost.view", "internal_cost.view", "margin_percent.view", "margin_amount.view", "profitability.view"] as const;
  const decisions = await Promise.all(requiredCapabilities.map((capability) => resolveAuthorization(auth, capability)));
  if (auth.scope !== "COMPANY" || decisions.some((decision) => !decision.allowed || decision.scope !== "COMPANY")) return new Response("Alcance insuficiente para exportar datos económicos combinados.", { status: 403 });
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

  });
}
