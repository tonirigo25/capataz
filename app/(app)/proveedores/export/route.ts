import { publicRequestContext } from "@/lib/platform/request-boundary";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { getSupplierWorkspace, supplierQualityLabel, supplierRiskLabel, supplierStatusLabel } from "@/lib/supplier-workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRequestContext("GET /proveedores/export", request, async () => {
    const auth = await requireCapability("reports.export");
    const view = await resolveAuthorization(auth, "purchases.suppliers.view");
    if (auth.scope !== "COMPANY" || !view.allowed || view.scope !== "COMPANY") {
      return new Response("Alcance insuficiente para exportar proveedores.", { status: 403 });
    }

    const url = new URL(request.url);
    const ids = url.searchParams.getAll("id").filter((id) => /^[a-zA-Z0-9_-]{8,80}$/.test(id));
    const workspace = await getSupplierWorkspace(auth.companyId, {
      search: url.searchParams.get("buscar") ?? undefined,
      status: url.searchParams.get("estado") ?? undefined,
      category: url.searchParams.get("categoria") ?? undefined,
      risk: url.searchParams.get("riesgo") ?? undefined,
      quality: url.searchParams.get("calidad") ?? undefined,
      overdueOnly: url.searchParams.get("vencido") === "1",
      pendingOnly: url.searchParams.get("deuda") === "1",
      missingContractOnly: url.searchParams.get("sinContrato") === "1",
      order: url.searchParams.get("orden") ?? undefined,
    });
    const suppliers = ids.length ? workspace.filtered.filter((supplier) => ids.includes(supplier.id)) : workspace.filtered;
    const csv = encodeCsv([
      "Proveedor", "Razón social", "CIF/NIF", "Estado", "Categoría", "Riesgo", "Puntuación de riesgo",
      "Calidad", "Puntuación de calidad", "Contacto", "Email", "Teléfono", "Facturas", "Facturado",
      "Pendiente", "Vencido", "Contrato", "Última actividad"
    ], suppliers.map((supplier) => [
      supplier.commercialName,
      supplier.legalName,
      supplier.taxId ?? "",
      supplierStatusLabel(supplier.status),
      supplier.category,
      supplierRiskLabel(supplier.risk),
      supplier.riskScore,
      supplierQualityLabel(supplier.quality),
      supplier.qualityScore ?? "",
      supplier.contactPerson ?? "",
      supplier.email ?? "",
      supplier.phone ?? "",
      supplier.invoiceCount,
      supplier.totalSpend,
      supplier.pendingAmount,
      supplier.overdueAmount,
      supplier.contract ? "Registrado" : "Sin registrar",
      supplier.lastActivityAt.toISOString(),
    ]));

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="orqena-proveedores.csv"',
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}

function encodeCsv(headers: string[], rows: Array<Array<string | number>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function csvCell(value: string | number) {
  let normalized = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ");
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replaceAll('"', '""')}"`;
}
