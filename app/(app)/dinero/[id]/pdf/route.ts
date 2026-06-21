import { notFound } from "next/navigation";
import { getAppMode } from "@/lib/app-mode";
import { prisma } from "@/lib/prisma";
import { createSimplePdf, pdfDate } from "@/lib/simple-pdf";
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
  const liveStatus = deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
  const lines = [
    { text: company?.nombreComercial ?? "Empresa sin configurar", size: 13, bold: true },
    { text: `${company?.razonSocial ?? ""} ${company?.nifCif ? `- ${company.nifCif}` : ""}`.trim() || "Razón social pendiente" },
    { text: [company?.direccionFiscal, company?.codigoPostal, company?.ciudad, company?.provincia, company?.pais].filter(Boolean).join(", ") || "Dirección fiscal pendiente" },
    { text: [company?.telefono, company?.email, company?.web].filter(Boolean).join(" · ") || "Contacto pendiente" },
    { text: company?.iban || invoice.datosBancarios ? `Datos bancarios: ${invoice.datosBancarios ?? company?.iban}` : "Datos bancarios pendientes" },
    { text: company?.logoUrl ? `Logo configurado: ${company.logoUrl}` : "Logo no configurado" },
    { text: company?.selloUrl ? `Sello configurado: ${company.selloUrl}` : "Sello no configurado" },
    { text: " " },
    { text: `Factura / borrador ${invoice.numero}`, size: 16, bold: true },
    { text: `Cliente: ${invoice.client.nombre}` },
    { text: `Dirección cliente: ${invoice.client.direccion}` },
    { text: `Contacto cliente: ${[invoice.client.telefono, invoice.client.email].filter(Boolean).join(" · ")}` },
    { text: invoice.work ? `Obra: ${invoice.work.titulo}` : "Obra: sin asociar" },
    { text: `Concepto: ${invoice.concepto}` },
    { text: `Emisión: ${pdfDate(invoice.fechaEmision)} · Vencimiento: ${pdfDate(invoice.fechaVencimiento)} · Estado: ${liveStatus.replaceAll("_", " ")}` },
    { text: " " },
    { text: `Base imponible: ${money(invoice.importeBase)}` },
    { text: `IVA: ${money(invoice.iva)}` },
    { text: `Total: ${money(invoice.total)}`, size: 14, bold: true },
    { text: `Pagado: ${money(invoice.pagado)}` },
    { text: `Pendiente: ${money(invoice.pendiente)}` },
    { text: `Método de pago: ${invoice.metodoPago ?? "transferencia"}` },
    { text: " " },
    { text: "Pagos registrados", size: 13, bold: true },
    ...invoice.payments.map((payment) => ({
      text: `${pdfDate(payment.fecha)} · ${money(payment.importe)} · ${payment.metodo} · ${payment.tipo.replaceAll("_", " ")}`
    })),
    { text: invoice.payments.length ? " " : "Sin pagos registrados." },
    { text: `Observaciones: ${invoice.observaciones ?? "-"}` },
    { text: company?.textoLegal ? `Texto legal: ${company.textoLegal}` : "Documento interno/borrador. Revisa con tu gestoría antes de usarlo como factura legal." }
  ];

  const pdf = createSimplePdf(`Factura ${invoice.numero}`, lines, getAppMode() === "demo" ? "Demo Capataz" : null);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${invoice.numero}.pdf"`
    }
  });
}

function money(value: number) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`;
}
