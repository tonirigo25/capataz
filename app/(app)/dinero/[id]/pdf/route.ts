import { notFound } from "next/navigation";
import { getAppMode } from "@/lib/app-mode";
import { parseBudgetLines } from "@/lib/budget-lines";
import { createProfessionalDocumentPdf, documentMoney } from "@/lib/document-pdf";
import { fillTemplatePlaceholders } from "@/lib/document-templates";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, work: true, payments: { orderBy: { fecha: "asc" } } }
  });
  if (!invoice) notFound();

  const company = await prisma.empresa.findFirst();
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
  const ivaPercent = invoice.importeBase > 0 ? (invoice.iva / invoice.importeBase) * 100 : company?.ivaDefecto ?? 21;
  const placeholderSummary = fillTemplatePlaceholders("[[DOCUMENTO_NUMERO]] [[CLIENTE_NOMBRE]] [[TOTAL]]", {
    EMPRESA_NOMBRE: company?.nombreComercial ?? "Empresa sin configurar",
    EMPRESA_NIF: company?.nifCif ?? "",
    CLIENTE_NOMBRE: invoice.client.nombre,
    CLIENTE_NIF: "",
    OBRA_DIRECCION: invoice.work?.direccion ?? invoice.client.direccion,
    DOCUMENTO_NUMERO: invoice.numero,
    FECHA: new Intl.DateTimeFormat("es-ES").format(invoice.fechaEmision),
    PARTIDAS: fallbackLines.map((line) => line.descripcion).join("; "),
    BASE_IMPONIBLE: documentMoney(invoice.importeBase),
    "IVA_%": `${ivaPercent.toFixed(2)}%`,
    IVA_TOTAL: documentMoney(invoice.iva),
    TOTAL: documentMoney(invoice.total)
  });

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
      taxId: company?.nifCif,
      address: [company?.direccionFiscal, company?.codigoPostal, company?.ciudad, company?.provincia, company?.pais].filter(Boolean).join(", "),
      contact: [company?.telefono, company?.email, company?.web].filter(Boolean).join(" · "),
      iban: invoice.datosBancarios ?? company?.iban,
      logoUrl: company?.logoUrl,
      sealUrl: company?.selloUrl,
      brandColor: company?.colorMarca,
      legalText: company?.textoLegal ?? "Documento interno/borrador. Revisa con tu gestoría antes de usarlo como factura legal."
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
    watermark: getAppMode() === "demo" ? "Demo Capataz" : null
  });
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${invoice.numero}.pdf"`,
      "X-Capataz-Template-Placeholders": encodeURIComponent(placeholderSummary)
    }
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
