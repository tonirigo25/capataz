import type { Company } from "@prisma/client";

/** Temporary presentation adapter while legacy Empresa columns remain readable. */
export function companySettingsView(company: Company) {
  return {
    ...company,
    nifCif: company.taxId,
    direccionFiscal: company.direccion,
    municipio: null,
    personaContacto: company.contactPerson,
    condicionesPorDefecto: company.defaultConditions,
    textoLegal: company.legalText,
    selloUrl: company.sealUrl,
    colorMarca: company.brandColor,
    ivaDefecto: company.defaultVat,
    moneda: company.currency,
    validezPresupuestoDias: company.budgetValidityDays,
    formaPagoDefecto: company.defaultPaymentTerms,
    seriePresupuestos: company.budgetSeries,
    serieFacturas: company.invoiceSeries,
    serieObras: company.workSeries,
    prefijoPresupuesto: company.budgetPrefix,
    prefijoFactura: company.invoicePrefix,
    prefijoObra: company.workPrefix
  };
}
