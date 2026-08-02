import { publicRequestContext } from "@/lib/platform/request-boundary";
import { requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import { getPurchaseInvoiceList } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRequestContext("GET /facturas-proveedor/export", request, async () => {
    const auth = await requireCapability("reports.export");
    const view = await resolveAuthorization(auth, "purchases.received_invoices.view");
    if (auth.scope !== "COMPANY" || !view.allowed || view.scope !== "COMPANY") return new Response("Alcance insuficiente para exportar facturas de proveedor.", { status: 403 });
    const url = new URL(request.url);
    const all = await getPurchaseInvoiceList(auth.companyId, "SUPPLIER");
    const invoices = all.filter((invoice) => matches(invoice, url.searchParams));
    const csv = encodeCsv([
      "Factura", "Proveedor", "CIF/NIF", "Descripción", "Emisión", "Vencimiento", "Base imponible", "IVA", "Total", "Pagado", "Pendiente", "Estado", "Proyecto", "Documentos"
    ], invoices.map((invoice) => [
      invoice.invoiceNumber, invoice.businessPartner.commercialName, invoice.businessPartner.taxId ?? "", invoice.description,
      invoice.issueDate.toISOString(), invoice.dueDate.toISOString(), invoice.taxableBase, invoice.vatAmount, invoice.total,
      invoice.paidAmount, invoice.pendingAmount, invoice.status, invoice.work?.titulo ?? "", invoice.documents.length,
    ]));
    return new Response(`\uFEFF${csv}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="orqena-facturas-proveedor.csv"', "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}

function matches(invoice: Awaited<ReturnType<typeof getPurchaseInvoiceList>>[number], query: URLSearchParams) {
  const state = query.get("estado") ?? "all";
  if (state === "revision" && invoice.documents.length) return false;
  if (state === "revisada" && (!invoice.documents.length || !invoice.workId || invoice.status === "VOID")) return false;
  if (state === "pendiente" && !["PENDING", "PARTIALLY_PAID"].includes(invoice.status)) return false;
  if (state === "vencida" && invoice.status !== "OVERDUE") return false;
  if (state === "pagada" && invoice.status !== "PAID") return false;
  const partner = query.get("proveedor"); if (partner && invoice.businessPartner.id !== partner) return false;
  const work = query.get("proyecto"); if (work && invoice.workId !== work) return false;
  if (query.get("sinObra") === "1" && invoice.workId) return false;
  if (query.get("conDocumento") === "1" && !invoice.documents.length) return false;
  const period = Number(query.get("periodo")); if (Number.isFinite(period) && period > 0) { const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period); if (invoice.issueDate < cutoff) return false; }
  const search = normalize(query.get("buscar") ?? "");
  return !search || normalize(`${invoice.invoiceNumber} ${invoice.description} ${invoice.businessPartner.commercialName} ${invoice.businessPartner.taxId ?? ""} ${invoice.work?.titulo ?? ""}`).includes(search);
}
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function encodeCsv(headers: string[], rows: Array<Array<string | number>>) { return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n"); }
function csvCell(value: string | number) { let normalized = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " "); if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`; return `"${normalized.replaceAll('"', '""')}"`; }
