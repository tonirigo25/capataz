import { NextResponse } from "next/server";
import { buildBusinessCsvExport } from "@/lib/business-intelligence";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

const allowedTypes = ["summary", "works", "pending-invoices", "expenses"] as const;
type IntelligenceExportType = (typeof allowedTypes)[number];

function isAllowedType(value: string): value is IntelligenceExportType {
  return (allowedTypes as readonly string[]).includes(value);
}

function csvResponse(csv: string, tipo: IntelligenceExportType) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(`orqena-${tipo}.csv`)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function GET(request: Request) {
  const { companyId } = await requireCapability("reports.export");
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "summary";
  if (!isAllowedType(tipo)) {
    return NextResponse.json({ error: "Tipo de exportación no soportado." }, { status: 400, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  let csv: string;
  try {
    csv = await buildBusinessCsvExport(tipo, {
      companyId,
      period: url.searchParams.get("periodo") ?? undefined,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to")
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar la exportación." }, { status: 500, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }

  return csvResponse(csv, tipo);
}
