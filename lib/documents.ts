import type { DocumentCategory } from "@prisma/client";
import { formatDate } from "@/lib/format";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  presupuesto: "Presupuesto",
  factura: "Factura",
  contrato: "Contrato",
  albaran: "Albarán",
  ticket: "Ticket",
  fotografia: "Fotografía",
  garantia: "Garantía",
  certificado: "Certificado",
  plano: "Plano",
  informe: "Informe",
  otro: "Otro"
};

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain"
];

export type RepositoryDocumentInput = {
  id: string;
  name: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  storageKey?: string | null;
  url?: string | null;
  category: DocumentCategory | string;
  createdAt: Date;
  archivedAt?: Date | null;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
  budget?: { id: string; numero: string; titulo: string } | null;
  invoice?: { id: string; numero: string; concepto: string } | null;
  expense?: { id: string; concepto: string } | null;
};

export type DocumentDisplay = {
  id: string;
  key: string;
  type: string;
  name: string;
  relatedLabel: string;
  date: Date;
  href: string | null;
  source: string;
  canPreview: boolean;
  canDownload: boolean;
  archivedAt?: Date | null;
};

export function repositoryDocumentDisplay(document: RepositoryDocumentInput): DocumentDisplay {
  const type = documentCategoryLabel(document.category);
  return {
    id: document.id,
    key: `document-${document.id}`,
    type,
    name: document.name,
    relatedLabel: relatedLabel(document),
    date: document.createdAt,
    href: document.url ?? null,
    source: document.url ? "Repositorio documental" : "Ficha documental sin archivo adjunto",
    canPreview: canPreview(document.mimeType, document.url),
    canDownload: Boolean(document.url),
    archivedAt: document.archivedAt
  };
}

export function derivedBudgetDocument(budget: { id: string; numero: string; titulo: string; fechaCreacion: Date; work?: { titulo: string } | null }) {
  return {
    id: `budget-${budget.id}`,
    key: `budget-${budget.id}`,
    type: "Presupuesto",
    name: `${budget.numero} · ${budget.titulo}`,
    relatedLabel: budget.work?.titulo ?? budget.titulo,
    date: budget.fechaCreacion,
    href: `/presupuestos/${budget.id}/pdf?preview=1`,
    source: "PDF generado",
    canPreview: true,
    canDownload: true
  } satisfies DocumentDisplay;
}

export function derivedInvoiceDocument(invoice: { id: string; numero: string; concepto: string; fechaEmision: Date; work?: { titulo: string } | null }) {
  return {
    id: `invoice-${invoice.id}`,
    key: `invoice-${invoice.id}`,
    type: "Factura",
    name: `${invoice.numero} · ${invoice.concepto}`,
    relatedLabel: invoice.work?.titulo ?? invoice.concepto,
    date: invoice.fechaEmision,
    href: `/dinero/${invoice.id}/pdf?preview=1`,
    source: "PDF generado",
    canPreview: true,
    canDownload: true
  } satisfies DocumentDisplay;
}

export function documentCategoryLabel(category: string | null | undefined) {
  return DOCUMENT_CATEGORY_LABELS[(category ?? "otro") as DocumentCategory] ?? "Otro";
}

export function documentDetail(document: DocumentDisplay) {
  return `${document.type} · ${document.source} · ${formatDate(document.date)}`;
}

export function safeDocumentUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("https://")) return value;
  return null;
}

function relatedLabel(document: RepositoryDocumentInput) {
  if (document.work) return document.work.titulo;
  if (document.client) return document.client.nombre;
  if (document.budget) return `${document.budget.numero} · ${document.budget.titulo}`;
  if (document.invoice) return `${document.invoice.numero} · ${document.invoice.concepto}`;
  if (document.expense) return document.expense.concepto;
  return "Sin entidad asociada";
}

function canPreview(mimeType: string | null | undefined, url: string | null | undefined) {
  if (!url || !mimeType) return false;
  return mimeType === "application/pdf" || mimeType.startsWith("image/") || mimeType === "text/plain";
}
