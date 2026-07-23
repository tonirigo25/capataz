export type DocumentTemplateKind = "budget" | "invoice";

export type DocumentTemplateAsset = {
  slug: string;
  kind: DocumentTemplateKind;
  format: "docx" | "pdf";
  label: string;
  fileName: string;
  relativePath: string;
  contentType: string;
};

export const documentCategories = [
  { id: "presupuestos", label: "Presupuestos", href: "/presupuestos" },
  { id: "facturas", label: "Facturas", href: "/dinero" },
  { id: "albaranes", label: "Albaranes", href: "/documentos#albaranes" },
  { id: "contratos", label: "Contratos", href: "/documentos#contratos" },
  { id: "archivos", label: "Archivos", href: "/documentos#archivos" },
  { id: "plantillas", label: "Plantillas", href: "/documentos#plantillas" }
];

export const documentPlaceholders = [
  "EMPRESA_NOMBRE",
  "EMPRESA_NIF",
  "CLIENTE_NOMBRE",
  "CLIENTE_NIF",
  "OBRA_DIRECCION",
  "DOCUMENTO_NUMERO",
  "FECHA",
  "PARTIDAS",
  "BASE_IMPONIBLE",
  "IVA_%",
  "IVA_TOTAL",
  "TOTAL"
] as const;

export type DocumentPlaceholder = (typeof documentPlaceholders)[number];
export type PlaceholderValues = Record<DocumentPlaceholder, string>;

export const documentTemplateAssets: DocumentTemplateAsset[] = [
  {
    slug: "presupuesto-docx",
    kind: "budget",
    format: "docx",
    label: "Plantilla presupuesto DOCX",
    fileName: "Plantilla_Presupuesto_Orqena.docx",
    relativePath: "templates/documents/Plantilla_Presupuesto_Capataz.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  {
    slug: "presupuesto-pdf",
    kind: "budget",
    format: "pdf",
    label: "Plantilla presupuesto PDF",
    fileName: "Plantilla_Presupuesto_Orqena.pdf",
    relativePath: "templates/documents/Plantilla_Presupuesto_Capataz.pdf",
    contentType: "application/pdf"
  },
  {
    slug: "factura-docx",
    kind: "invoice",
    format: "docx",
    label: "Plantilla factura DOCX",
    fileName: "Plantilla_Factura_Orqena.docx",
    relativePath: "templates/documents/Plantilla_Factura_Capataz.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  {
    slug: "factura-pdf",
    kind: "invoice",
    format: "pdf",
    label: "Plantilla factura PDF",
    fileName: "Plantilla_Factura_Orqena.pdf",
    relativePath: "templates/documents/Plantilla_Factura_Capataz.pdf",
    contentType: "application/pdf"
  }
];

export const documentTemplates = {
  budget: {
    kind: "budget" as const,
    title: "Presupuesto profesional",
    sourceDocx: "Plantilla_Presupuesto_Capataz.docx",
    sourcePdf: "Plantilla_Presupuesto_Capataz.pdf",
    visualLabel: "Plantilla profesional de presupuesto Orqena"
  },
  invoice: {
    kind: "invoice" as const,
    title: "Factura profesional",
    sourceDocx: "Plantilla_Factura_Capataz.docx",
    sourcePdf: "Plantilla_Factura_Capataz.pdf",
    visualLabel: "Plantilla profesional de factura Orqena"
  }
};

export function getTemplateAsset(slug: string) {
  return documentTemplateAssets.find((asset) => asset.slug === slug) ?? null;
}

export function fillTemplatePlaceholders(template: string, values: Partial<Record<DocumentPlaceholder, string>>) {
  return documentPlaceholders.reduce((result, placeholder) => {
    return result.replaceAll(`[[${placeholder}]]`, values[placeholder] ?? "");
  }, template);
}
