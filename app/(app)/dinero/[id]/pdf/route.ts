import { publicRequestContext } from "@/lib/platform/request-boundary";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { parseBudgetLines } from "@/lib/budget-lines";
import { createProfessionalDocumentPdf, documentMoney, professionalDocumentTemplateVersion } from "@/lib/document-pdf";
import { loadCompanyPdfLogo } from "@/lib/document-pdf-assets";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { assertScopedEntityAccess, requireCapability } from "@/lib/commercial/authorization";
import { companyCore } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return publicRequestContext("GET /dinero/[id]/pdf", request, async () => {
  const { id } = await context.params;
  const auth = await requireCapability("sales.invoices.view");
  const core = companyCore(prisma, auth.companyId);
  const invoice = await core.getInvoiceDocument(id);
  if (!invoice) notFound();
  if (invoice.obraId) await assertScopedEntityAccess(auth, "sales.invoices.view", "Work", invoice.obraId);
  else await assertScopedEntityAccess(auth, "sales.invoices.view", "Client", invoice.clienteId);

  const company = await core.company();
  const logo = await loadCompanyPdfLogo(auth.companyId, company.logoStoredObjectId);
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const liveStatus = invoice.estado === "borrador" ? "borrador" : deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
  const lines = parseBudgetLines(invoice.partidas);
  const fallbackLines = lines.length ? lines : [{
    descripcion: invoice.concepto,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: invoice.importeBase,
    total: invoice.importeBase,
    categoria: "Factura"
  }];
  const ivaPercent = invoice.importeBase > 0 ? (invoice.iva / invoice.importeBase) * 100 : company.defaultVat;
  const pdf = createProfessionalDocumentPdf({
    kind: "invoice",
    documentNumber: invoice.numero,
    title: invoice.concepto,
    status: liveStatus,
    issueDate: invoice.fechaEmision,
    dueDate: invoice.fechaVencimiento,
    company: {
      name: company?.nombreComercial ?? "Empresa sin configurar",
      legalName: company?.razonSocial,
      taxId: company.taxId,
      address: [company.direccion, company.codigoPostal, company.ciudad, company.provincia, company.pais].filter(Boolean).join(", "),
      contact: [company?.telefono, company?.email, company?.web].filter(Boolean).join(" · "),
      iban: invoice.datosBancarios ?? company?.iban,
      brandColor: company.brandColor,
      legalText: company.legalText,
      logo
    },
    client: {
      name: invoice.client.nombre,
      address: invoice.client.direccion,
      contact: [invoice.client.telefono, invoice.client.email].filter(Boolean).join(" · ")
    },
    work: invoice.work ? { title: invoice.work.titulo, address: invoice.work.direccion } : null,
    lines: fallbackLines,
    totals: {
      base: invoice.importeBase,
      ivaPercent,
      ivaTotal: invoice.iva,
      total: invoice.total,
      paid: invoice.pagado,
      pending: invoice.pendiente
    },
    paymentMethod: invoice.metodoPago ?? "transferencia",
    observations: paymentSummary(invoice),
    watermark: null
  });
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${invoice.numero}.pdf"`,
      "X-Orqena-Template-Version": professionalDocumentTemplateVersion,
      "X-Orqena-PDF-SHA256": createHash("sha256").update(pdf).digest("hex")
    }
  });

  });
}

function paymentSummary(invoice: {
  observaciones: string | null;
  payments: Array<{ fecha: Date; importe: number; metodo: string; tipo: string }>;
}) {
  const payments = invoice.payments.length
    ? `Pagos registrados: ${invoice.payments.map((payment) => `${new Intl.DateTimeFormat("es-ES").format(payment.fecha)} ${documentMoney(payment.importe)} ${payment.metodo} ${payment.tipo.replaceAll("_", " ")}`).join("; ")}`
    : "Sin pagos registrados.";
  return [invoice.observaciones, payments].filter(Boolean).join(" ");
}
