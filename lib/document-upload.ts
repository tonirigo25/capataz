import { createHash } from "node:crypto";
import type { DocumentCategory, DocumentClassification } from "@prisma/client";
import { sanitizeFilename, sniffExpenseDocumentMime } from "@/lib/expense-document";

export const MAX_REPOSITORY_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const repositoryDocumentCategories: Array<{
  value: DocumentCategory;
  label: string;
}> = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "factura", label: "Factura" },
  { value: "contrato", label: "Contrato" },
  { value: "albaran", label: "Albarán" },
  { value: "ticket", label: "Ticket" },
  { value: "fotografia", label: "Fotografía" },
  { value: "garantia", label: "Garantía" },
  { value: "certificado", label: "Certificado" },
  { value: "plano", label: "Plano" },
  { value: "informe", label: "Informe" },
  { value: "otro", label: "Otro" },
];

export const repositoryDocumentClassifications: Array<{
  value: DocumentClassification;
  label: string;
  description: string;
}> = [
  { value: "OPERATIONAL", label: "Operativo", description: "Trabajo, partes, planos y documentación de ejecución." },
  { value: "COMMERCIAL", label: "Comercial", description: "Clientes, ofertas, contratos y relación comercial." },
  { value: "FINANCIAL", label: "Financiero", description: "Facturas, tickets y documentación económica." },
  { value: "RESTRICTED", label: "Restringido", description: "Documentación reservada para perfiles autorizados." },
];

const extensionsByMime = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "text/plain": ["txt"],
} as const;

export function validateRepositoryDocumentFile(input: {
  filename: string;
  browserMime: string;
  bytes: Uint8Array;
}) {
  if (!input.bytes.length) throw new Error("EMPTY_DOCUMENT");
  if (input.bytes.length > MAX_REPOSITORY_DOCUMENT_BYTES) throw new Error("DOCUMENT_TOO_LARGE");

  const filename = sanitizeFilename(input.filename);
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const binaryMime = sniffExpenseDocumentMime(input.bytes);
  const mimeType = binaryMime ?? sniffPlainText(input.bytes, extension);
  if (!mimeType) throw new Error("DOCUMENT_FORMAT_UNSUPPORTED");

  const allowedExtensions = extensionsByMime[mimeType];
  if (!(allowedExtensions as readonly string[]).includes(extension)) {
    throw new Error("DOCUMENT_EXTENSION_MISMATCH");
  }
  const declaredMime = input.browserMime.trim().toLowerCase();
  if (
    declaredMime
    && declaredMime !== "application/octet-stream"
    && declaredMime !== mimeType
    && !(mimeType === "image/jpeg" && declaredMime === "image/jpg")
  ) {
    throw new Error("DOCUMENT_MIME_MISMATCH");
  }

  return {
    filename,
    mimeType,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

function sniffPlainText(bytes: Uint8Array, extension: string): "text/plain" | null {
  if (extension !== "txt" || bytes.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "text/plain";
  } catch {
    return null;
  }
}
