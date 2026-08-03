import { publicRequestContext } from "@/lib/platform/request-boundary";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { reconcileBudgetRecord, parseBudgetLines } from "@/lib/budget-lines";
import { createProfessionalDocumentPdf, professionalDocumentTemplateVersion } from "@/lib/document-pdf";
import { loadCompanyPdfLogo } from "@/lib/document-pdf-assets";
import { prisma } from "@/lib/prisma";
import { assertScopedEntityAccess, requireCapability } from "@/lib/commercial/authorization";
import { companyCore } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return publicRequestContext("GET /presupuestos/[id]/pdf", request, async () => {
  const { id } = await context.params;
  const auth = await requireCapability("sales.budgets.view");
  const core = companyCore(prisma, auth.companyId);
  const budget = await core.getBudgetDocument(id);
  if (!budget) notFound();
  if (budget.obraId) await assertScopedEntityAccess(auth, "sales.budgets.view", "Work", budget.obraId);
  else await assertScopedEntityAccess(auth, "sales.budgets.view", "Client", budget.clienteId);
  const pricing = await requireCapability("sales.pricing.view");
  if (budget.obraId) await assertScopedEntityAccess(pricing, "sales.pricing.view", "Work", budget.obraId);
  else await assertScopedEntityAccess(pricing, "sales.pricing.view", "Client", budget.clienteId);

  const company = await core.company();
  const logo = await loadCompanyPdfLogo(auth.companyId, company.logoStoredObjectId);
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const lines = parseBudgetLines(budget.partidas);
  if (!reconcileBudgetRecord(lines, budget).ok) {
    return new Response("BUDGET_TOTALS_MISMATCH", {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const taxable = Math.max(0, budget.subtotal - budget.descuento);
  const ivaPercent = taxable > 0 ? (budget.iva / taxable) * 100 : company.defaultVat;
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
      brandColor: company.brandColor,
      legalText: company.legalText,
      logo
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
      "X-Orqena-Template-Version": professionalDocumentTemplateVersion,
      "X-Orqena-PDF-SHA256": createHash("sha256").update(pdf).digest("hex")
    }
  });

  });
}
