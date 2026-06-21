import { notFound } from "next/navigation";
import { getAppMode } from "@/lib/app-mode";
import { parseBudgetLines } from "@/lib/budget-lines";
import { prisma } from "@/lib/prisma";
import { createSimplePdf, pdfDate } from "@/lib/simple-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: { client: true, work: true }
  });
  if (!budget) notFound();

  const company = await prisma.empresa.findFirst();
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const lines = [
    { text: company?.nombreComercial ?? "Empresa sin configurar", size: 13, bold: true },
    { text: `${company?.razonSocial ?? ""} ${company?.nifCif ? `- ${company.nifCif}` : ""}`.trim() || "Razón social pendiente" },
    { text: [company?.direccionFiscal, company?.codigoPostal, company?.ciudad, company?.provincia, company?.pais].filter(Boolean).join(", ") || "Dirección fiscal pendiente" },
    { text: [company?.telefono, company?.email, company?.web].filter(Boolean).join(" · ") || "Contacto pendiente" },
    { text: company?.logoUrl ? `Logo configurado: ${company.logoUrl}` : "Logo no configurado" },
    { text: company?.selloUrl ? `Sello configurado: ${company.selloUrl}` : "Sello no configurado" },
    { text: " " },
    { text: `Presupuesto ${budget.numero}`, size: 16, bold: true },
    { text: `Cliente: ${budget.client.nombre}` },
    { text: `Dirección cliente: ${budget.client.direccion}` },
    { text: `Contacto cliente: ${[budget.client.telefono, budget.client.email].filter(Boolean).join(" · ")}` },
    { text: budget.work ? `Obra: ${budget.work.titulo}` : "Obra: sin asociar" },
    { text: `Título: ${budget.titulo}` },
    { text: `Fecha: ${pdfDate(budget.fechaCreacion)} · Envío: ${pdfDate(budget.fechaEnvio)} · Validez: ${pdfDate(budget.fechaValidez)}` },
    { text: " " },
    { text: "Partidas", size: 13, bold: true },
    ...parseBudgetLines(budget.partidas).map((line) => ({
      text: `${line.descripcion} · ${line.cantidad} ${line.unidad} x ${money(line.precioUnitario)} = ${money(line.total)} · ${line.categoria}`
    })),
    { text: " " },
    { text: `Subtotal: ${money(budget.subtotal)}` },
    { text: `Descuento: ${money(budget.descuento)}` },
    { text: `IVA: ${money(budget.iva)}` },
    { text: `Total: ${money(budget.total)}`, size: 14, bold: true },
    { text: `Margen estimado interno: ${money(budget.margenEstimado)}` },
    { text: " " },
    { text: `Condiciones: ${budget.condiciones ?? company?.condicionesPorDefecto ?? "-"}` },
    { text: `Forma de pago: ${budget.formaPago ?? "-"}` },
    { text: `Observaciones: ${budget.observaciones ?? "-"}` },
    { text: company?.textoLegal ? `Texto legal: ${company.textoLegal}` : "Completa tus datos de empresa para que el presupuesto salga profesional." }
  ];

  const pdf = createSimplePdf(`Presupuesto ${budget.numero}`, lines, getAppMode() === "demo" ? "Demo Capataz" : null);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${budget.numero}.pdf"`
    }
  });
}

function money(value: number) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`;
}
