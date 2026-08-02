import { publicRequestContext } from "@/lib/platform/request-boundary";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { documentStatusLabel, getSubcontractorWorkspace, subcontractorStatusLabel } from "@/lib/subcontractor-workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRequestContext("GET /subcontratas/export", request, async () => {
    const auth = await requireCapability("reports.export");
    const view = await resolveAuthorization(auth, "purchases.suppliers.view");
    if (auth.scope !== "COMPANY" || !view.allowed || view.scope !== "COMPANY") return new Response("Alcance insuficiente.", { status: 403 });
    const url = new URL(request.url);
    const workspace = await getSubcontractorWorkspace(auth.companyId, {
      search: url.searchParams.get("buscar") ?? undefined,
      status: url.searchParams.get("estado") ?? undefined,
      specialty: url.searchParams.get("especialidad") ?? undefined,
      compliance: url.searchParams.get("cumplimiento") ?? undefined,
      works: url.searchParams.get("obras") ?? undefined,
      view: url.searchParams.get("seccion") ?? undefined,
    });
    const rows = workspace.filtered.map((item) => [item.commercialName, item.legalName, item.taxId ?? "", subcontractorStatusLabel(item.status), item.specialty, item.activeWorkCount, item.complianceScore ?? "", documentStatusLabel(item.documentStatus), item.documentCount, item.pendingAmount, item.overdueAmount, item.rating ?? ""]);
    const csv = encodeCsv(["Subcontrata", "Razón social", "CIF/NIF", "Estado", "Especialidad", "Obras activas", "Cumplimiento", "Estado documental", "Documentos", "Pendiente", "Vencido", "Evaluación"], rows);
    return new Response(`\uFEFF${csv}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="orqena-subcontratas.csv"', "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}

function encodeCsv(headers: string[], rows: Array<Array<string | number>>) { return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n"); }
function csvCell(value: string | number) { let normalized = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " "); if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`; return `"${normalized.replaceAll('"', '""')}"`; }
