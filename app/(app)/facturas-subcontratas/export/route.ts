import { publicRequestContext } from "@/lib/platform/request-boundary";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { getPurchaseInvoiceList } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRequestContext("GET /facturas-subcontratas/export", request, async () => {
    const auth = await requireCapability("reports.export");
    const view = await resolveAuthorization(auth, "purchases.received_invoices.view");
    if (auth.scope !== "COMPANY" || !view.allowed || view.scope !== "COMPANY") return new Response("Alcance insuficiente para exportar facturas de subcontrata.", { status: 403 });
    const query = new URL(request.url).searchParams;
    const all = await getPurchaseInvoiceList(auth.companyId, "SUBCONTRACTOR");
    const invoices = all.filter((invoice) => matches(invoice, query));
    const csv = encodeCsv([
      "Factura", "Subcontratista", "CIF/NIF", "Proyecto", "Certificación/Partida", "Emisión", "Vencimiento", "Base imponible", "IVA", "Retención fiscal", "Total", "Pendiente", "Estado", "Documentos"
    ], invoices.map((invoice) => [
      invoice.invoiceNumber, invoice.businessPartner.commercialName, invoice.businessPartner.taxId ?? "", invoice.work?.titulo ?? "",
      certificationText(invoice.certifications, invoice.workDescription), invoice.issueDate.toISOString(), invoice.dueDate.toISOString(),
      invoice.taxableBase, invoice.vatAmount, invoice.withholdingAmount, invoice.total, invoice.pendingAmount, invoice.status, invoice.documents.length,
    ]));
    return new Response(`\uFEFF${csv}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="orqena-facturas-subcontrata.csv"', "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}

function matches(invoice: Awaited<ReturnType<typeof getPurchaseInvoiceList>>[number], query: URLSearchParams) {
  const state = query.get("estado") ?? "all";
  if (state === "revision" && (invoice.documents.length || invoice.status === "VOID")) return false;
  if (state === "pendiente" && !["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) return false;
  if (state === "revisada" && (!invoice.documents.length || !invoice.workId || invoice.status === "VOID")) return false;
  if (state === "anulada" && invoice.status !== "VOID") return false;
  if (state === "pagada" && invoice.status !== "PAID") return false;
  if (query.get("sinObra") === "1" && invoice.workId) return false;
  if (query.get("conDocumento") === "1" && !invoice.documents.length) return false;
  if (query.get("retencion") === "1" && invoice.withholdingAmount <= 0) return false;
  const search = normalize(query.get("buscar") ?? "");
  return !search || normalize(`${invoice.invoiceNumber} ${invoice.description} ${invoice.businessPartner.commercialName} ${invoice.businessPartner.taxId ?? ""} ${invoice.work?.titulo ?? ""} ${certificationText(invoice.certifications, invoice.workDescription)}`).includes(search);
}

function certificationText(value: unknown, fallback: string | null) {
  if (Array.isArray(value)) {
    const labels = value.map((item) => typeof item === "string" ? item : item && typeof item === "object" && "name" in item ? String((item as { name: unknown }).name) : "").filter(Boolean);
    if (labels.length) return labels.join(", ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const label = record.name ?? record.label ?? record.reference;
    if (label) return String(label);
  }
  return fallback || "";
}
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function encodeCsv(headers: string[], rows: Array<Array<string | number>>) { return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n"); }
function csvCell(value: string | number) { let normalized = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " "); if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`; return `"${normalized.replaceAll('"', '""')}"`; }
