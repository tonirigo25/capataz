import { NextResponse } from "next/server";
import { buildBusinessCsvExport } from "@/lib/business-intelligence";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { companyId } = await requireCompanyContext();
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "summary";
  const csv = await buildBusinessCsvExport(tipo, {
    companyId,
    period: url.searchParams.get("periodo") ?? undefined,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to")
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"capataz-${tipo}.csv\"`
    }
  });
}
