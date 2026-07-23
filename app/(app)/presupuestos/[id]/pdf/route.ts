import { notFound } from "next/navigation";
import { parseBudgetLines } from "@/lib/budget-lines";
import { createProfessionalDocumentPdf, documentMoney } from "@/lib/document-pdf";
import { fillTemplatePlaceholders } from "@/lib/document-templates";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/commercial/authorization";
import { companyCore } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireCapability("sales.budgets.view");
  const core = companyCore(prisma, auth.companyId);
  const budget = await core.getBudgetDocument(id);
  if (!budget) notFound();

  const company = await core.company();
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const lines = parseBudgetLines(budget.partidas);
  const taxable = Math.max(0, budget.subtotal - budget.descuento);
  const ivaPercent = taxable > 0 ? (budget.iva / taxable) * 100 : company.defaultVat;
  const placeholderSummary = fillTemplatePlaceholders("[[DOCUMENTO_NUMERO]] [[CLIENTE_NOMBRE]] [[TOTAL]]", {
    EMPRESA_NOMBRE: company?.nombreComercial ?? "Empresa sin configurar",
    EMPRESA_NIF: company.taxId ?? "",
    CLIENTE_NOMBRE: budget.client.nombre,
    CLIENTE_NIF: "",
    OBRA_DIRECCION: budget.work?.direccion ?? budget.client.direccion,
    DOCUMENTO_NUMERO: budget.numero,
    FECHA: new Intl.DateTimeFormat("es-ES").format(budget.fechaCreacion),
    PARTIDAS: lines.map((line) => line.descripcion).join("; "),
    BASE_IMPONIBLE: documentMoney(taxable),
    "IVA_%": `${ivaPercent.toFixed(2)}%`,
    IVA_TOTAL: documentMoney(budget.iva),
    TOTAL: documentMoney(budget.total)
  });

  const pdf = createProfessionalDocumentPdf({
    kind: "budget",
    documentNumber: budget.numero,
    title: budget.titulo,
    status: budget.estado,
    issueDate: budget.fechaCreacion,
    validUntil: budget.fechaValidez,
    company: {
      name: company?.nombreComercial ?? "Empresa sin configurar",
      legalName: company?.razonSocial,
      taxId: company.taxId,
      address: [company.direccion, company.codigoPostal, company.ciudad, company.provincia, company.pais].filter(Boolean).join(", "),
      contact: [company?.telefono, company?.email, company?.web].filter(Boolean).join(" · "),
      iban: company?.iban,
      logoUrl: company?.logoUrl,
      sealUrl: company.sealUrl,
      brandColor: company.brandColor,
      legalText: company.legalText
    },
    client: {
      name: budget.client.nombre,
      address: budget.client.direccion,
      contact: [budget.client.telefono, budget.client.email].filter(Boolean).join(" · ")
    },
    work: budget.work ? { title: budget.work.titulo, address: budget.work.direccion } : null,
    lines,
    totals: {
      base: taxable,
      discount: budget.descuento,
      ivaPercent,
      ivaTotal: budget.iva,
      total: budget.total
    },
    conditions: budget.condiciones ?? company.defaultConditions,
    paymentMethod: budget.formaPago,
    observations: budget.observaciones,
    watermark: null
  });
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${budget.numero}.pdf"`,
      "X-Orqena-Template-Placeholders": encodeURIComponent(placeholderSummary)
    }
  });
}
