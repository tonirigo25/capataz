import { createHash } from "node:crypto";

export const MAX_EXPENSE_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const EXPENSE_DOCUMENT_TYPES = [
  "MATERIAL_INVOICE", "FUEL_RECEIPT", "MEAL_RECEIPT", "TOOL_INVOICE", "MACHINERY_INVOICE",
  "TRANSPORT_INVOICE", "SUBCONTRACTOR_INVOICE", "SERVICE_INVOICE", "SUPPLY_INVOICE", "GENERAL_EXPENSE", "UNKNOWN"
] as const;
export type ExpenseDocumentTypeValue = (typeof EXPENSE_DOCUMENT_TYPES)[number];

export const EXPENSE_DOCUMENT_MIME_EXTENSIONS = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"]
} as const;

export type ExpenseDocumentLine = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
};

export type NormalizedExpenseDocument = {
  documentType: ExpenseDocumentTypeValue;
  issuerName: string | null;
  issuerTaxId: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  taxableBase: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  withholdingAmount: number | null;
  otherTaxes: number | null;
  total: number | null;
  paymentMethod: string | null;
  description: string | null;
  suggestedCategory: string | null;
  lines: ExpenseDocumentLine[];
  confidence: number;
  fieldConfidence: Record<string, number>;
  warnings: string[];
};

export function sanitizeFilename(value: string) {
  const leaf = value.replace(/\\/g, "/").split("/").pop() || "documento";
  const cleaned = leaf.normalize("NFKC").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "documento").slice(0, 160);
}

export function extensionOf(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function sniffExpenseDocumentMime(bytes: Uint8Array) {
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytes.length >= 12 && textAt(bytes, 0, 4) === "RIFF" && textAt(bytes, 8, 4) === "WEBP") return "image/webp";
  return null;
}

export function validateExpenseDocumentFile(input: { filename: string; browserMime: string; bytes: Uint8Array }) {
  if (!input.bytes.length) throw new Error("El archivo está vacío.");
  if (input.bytes.length > MAX_EXPENSE_DOCUMENT_BYTES) throw new Error("El archivo supera el límite de 10 MB.");
  const filename = sanitizeFilename(input.filename);
  const extension = extensionOf(filename);
  const mimeType = sniffExpenseDocumentMime(input.bytes);
  if (!mimeType) throw new Error("Formato no admitido. Usa JPG, JPEG, PNG, WEBP o PDF.");
  const allowedExtensions = EXPENSE_DOCUMENT_MIME_EXTENSIONS[mimeType as keyof typeof EXPENSE_DOCUMENT_MIME_EXTENSIONS] as readonly string[];
  if (!allowedExtensions?.includes(extension)) throw new Error("La extensión no coincide con el contenido real del archivo.");
  if (input.browserMime && input.browserMime !== mimeType && !(mimeType === "image/jpeg" && input.browserMime === "image/jpg")) {
    throw new Error("El tipo declarado no coincide con el contenido real del archivo.");
  }
  return { filename, extension, mimeType, sha256: createHash("sha256").update(input.bytes).digest("hex") };
}

export function normalizeExpenseExtraction(raw: unknown): NormalizedExpenseDocument {
  const data = record(raw);
  const documentType = EXPENSE_DOCUMENT_TYPES.includes(data.documentType as ExpenseDocumentTypeValue)
    ? data.documentType as ExpenseDocumentTypeValue : "UNKNOWN";
  const taxableBase = parseMoney(data.taxableBase);
  const vatAmount = parseMoney(data.vatAmount);
  const withholdingAmount = parseMoney(data.withholdingAmount);
  const otherTaxes = parseMoney(data.otherTaxes);
  const total = parseMoney(data.total);
  const warnings = stringArray(data.warnings).slice(0, 20);
  const expected = sumKnown(taxableBase, vatAmount, otherTaxes, withholdingAmount == null ? null : -withholdingAmount);
  if (total != null && total < 0) {
    warnings.push("El total negativo requiere revisión manual.");
  }
  if (total != null && expected != null && Math.abs(total - expected) > Math.max(0.05, total * 0.015)) {
    warnings.push("La base, los impuestos y el total no cuadran aproximadamente.");
  }
  const issueDate = parseDate(data.issueDate);
  const dueDate = parseDate(data.dueDate);
  if (data.issueDate && !issueDate) warnings.push("La fecha de emisión no es válida.");
  const confidence = clampNumber(data.confidence, 0, 1, 0);
  const fieldConfidence = Object.fromEntries(Object.entries(record(data.fieldConfidence)).map(([key, value]) => [key, clampNumber(value, 0, 1, 0)]));
  return {
    documentType,
    issuerName: cleanText(data.issuerName, 180),
    issuerTaxId: normalizeTaxId(data.issuerTaxId),
    invoiceNumber: cleanText(data.invoiceNumber, 80),
    issueDate,
    dueDate,
    currency: cleanText(data.currency, 3)?.toUpperCase() || "EUR",
    taxableBase: nonNegativeOrNull(taxableBase),
    vatAmount: nonNegativeOrNull(vatAmount),
    vatRate: percentage(data.vatRate),
    withholdingAmount: nonNegativeOrNull(withholdingAmount),
    otherTaxes: nonNegativeOrNull(otherTaxes),
    total: nonNegativeOrNull(total),
    paymentMethod: cleanText(data.paymentMethod, 80),
    description: cleanText(data.description, 500),
    suggestedCategory: normalizeCategory(data.suggestedCategory, documentType),
    lines: Array.isArray(data.lines) ? data.lines.slice(0, 50).map((line) => {
      const value = record(line);
      return { description: cleanText(value.description, 240) || "Línea sin descripción", quantity: nonNegativeOrNull(parseMoney(value.quantity)), unitPrice: nonNegativeOrNull(parseMoney(value.unitPrice)), total: nonNegativeOrNull(parseMoney(value.total)) };
    }) : [],
    confidence,
    fieldConfidence,
    warnings: [...new Set(warnings)]
  };
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? round(value) : null;
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/[^0-9,.'+-]/g, "").replace(/'/g, "");
  if (!text) return null;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    text = text.replace(decimal === "," ? /\./g : /,/g, "").replace(decimal, ".");
  } else if (comma >= 0) {
    const decimals = text.length - comma - 1;
    text = decimals === 3 && text.indexOf(",") === comma ? text.replace(",", "") : text.replace(/,/g, ".");
  } else if (dot >= 0) {
    const decimals = text.length - dot - 1;
    if (decimals === 3 && text.indexOf(".") === dot) text = text.replace(".", "");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? round(parsed) : null;
}

export function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  let year: number, month: number, day: number;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, year, month, day] = match.map(Number);
  else {
    match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if (!match) return null;
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
    if (year < 100) year += 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

export function normalizeTaxId(value: unknown) {
  const text = cleanText(value, 32)?.toUpperCase().replace(/[\s.\-]/g, "") ?? null;
  return text && /^[A-Z0-9]{7,16}$/.test(text) ? text : null;
}

export function categoryForDocument(type: ExpenseDocumentTypeValue, suggested?: string | null) {
  return normalizeCategory(suggested, type) || "otros";
}

function normalizeCategory(value: unknown, type: ExpenseDocumentTypeValue) {
  const category = cleanText(value, 40)?.toLowerCase().replace(/\s+/g, "_");
  if (["materiales", "combustible", "restauracion", "herramientas", "maquinaria", "transportes", "subcontrata", "servicios", "suministros", "otros"].includes(category || "")) return category!;
  if (type === "MATERIAL_INVOICE") return "materiales";
  if (type === "FUEL_RECEIPT") return "combustible";
  if (type === "MEAL_RECEIPT") return "restauracion";
  if (type === "TOOL_INVOICE") return "herramientas";
  if (type === "MACHINERY_INVOICE") return "maquinaria";
  if (type === "TRANSPORT_INVOICE") return "transportes";
  if (type === "SUBCONTRACTOR_INVOICE") return "subcontrata";
  if (type === "SERVICE_INVOICE") return "servicios";
  if (type === "SUPPLY_INVOICE") return "suministros";
  return "otros";
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function cleanText(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : null; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 240)) : []; }
function clampNumber(value: unknown, min: number, max: number, fallback: number) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function percentage(value: unknown) { const parsed = parseMoney(value); return parsed == null || parsed < 0 || parsed > 100 ? null : parsed; }
function nonNegativeOrNull(value: number | null) { return value == null || value < 0 ? null : value; }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function sumKnown(...values: Array<number | null>) { return values.every((value) => value == null) ? null : round(values.reduce<number>((sum, value) => sum + (value ?? 0), 0)); }
function starts(bytes: Uint8Array, signature: number[]) { return signature.every((value, index) => bytes[index] === value); }
function textAt(bytes: Uint8Array, offset: number, length: number) { return String.fromCharCode(...bytes.slice(offset, offset + length)); }
