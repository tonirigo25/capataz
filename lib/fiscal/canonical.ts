import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

export const FISCAL_SEMANTIC_VERSION = "orqena-fiscal-1.0.0";

export type FiscalParty = {
  legalName: string;
  taxId: string;
  countryCode: string;
  addressLine: string;
  postalCode: string;
  city: string;
};

export type CanonicalInvoiceLineInput = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount?: string;
  taxRate: string;
};

export type CanonicalInvoiceLine = CanonicalInvoiceLineInput & {
  discountAmount: string;
  taxableBase: string;
  taxAmount: string;
  lineTotal: string;
};

export type CanonicalCorrection = {
  kind: "substitution" | "differences";
  reason: string;
  originalFiscalDocumentId: string;
  originalInvoiceNumber: string;
};

export type CanonicalInvoice = {
  semanticVersion: typeof FISCAL_SEMANTIC_VERSION;
  documentId: string;
  documentType: "F1" | "F2" | "R1" | "R2" | "R3" | "R4" | "R5";
  issueDate: string;
  dueDate?: string;
  currency: "EUR";
  seller: FiscalParty;
  buyer: FiscalParty;
  lines: CanonicalInvoiceLine[];
  withholdingAmount: string;
  totals: {
    grossAmount: string;
    discountAmount: string;
    taxableBase: string;
    taxAmount: string;
    withholdingAmount: string;
    payableAmount: string;
  };
  correction?: CanonicalCorrection;
  payment?: {
    meansCode: string;
    ibanMasked?: string;
  };
};

export type CanonicalInvoiceInput = Omit<CanonicalInvoice, "semanticVersion" | "lines" | "totals" | "withholdingAmount"> & {
  lines: CanonicalInvoiceLineInput[];
  withholdingAmount?: string;
};

const TWO_DECIMALS = 2;

function decimal(value: string, field: string) {
  if (!/^-?\d+(?:\.\d+)?$/u.test(value.trim())) throw new Error(`FISCAL_DECIMAL_INVALID:${field}`);
  return new Prisma.Decimal(value.trim());
}

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(TWO_DECIMALS, Prisma.Decimal.ROUND_HALF_UP);
}

export function money(value: Prisma.Decimal | string) {
  const amount = typeof value === "string" ? decimal(value, "money") : value;
  return roundMoney(amount).toFixed(TWO_DECIMALS);
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`FISCAL_REQUIRED:${field}`);
  return normalized;
}

function validateDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`FISCAL_DATE_INVALID:${field}`);
  }
  return value;
}

function normalizeParty(party: FiscalParty, field: string): FiscalParty {
  const taxId = required(party.taxId, `${field}.taxId`).toUpperCase();
  if (!/^[A-Z0-9-]{8,20}$/u.test(taxId)) throw new Error(`FISCAL_TAX_ID_INVALID:${field}`);
  const countryCode = required(party.countryCode, `${field}.countryCode`).toUpperCase();
  if (!/^[A-Z]{2}$/u.test(countryCode)) throw new Error(`FISCAL_COUNTRY_INVALID:${field}`);
  return {
    legalName: required(party.legalName, `${field}.legalName`),
    taxId,
    countryCode,
    addressLine: required(party.addressLine, `${field}.addressLine`),
    postalCode: required(party.postalCode, `${field}.postalCode`),
    city: required(party.city, `${field}.city`),
  };
}

export function createCanonicalInvoice(input: CanonicalInvoiceInput): CanonicalInvoice {
  if (!input.lines.length) throw new Error("FISCAL_LINES_REQUIRED");
  const lines = input.lines.map((line, index): CanonicalInvoiceLine => {
    const quantity = decimal(line.quantity, `lines.${index}.quantity`);
    const unitPrice = decimal(line.unitPrice, `lines.${index}.unitPrice`);
    const discountAmount = roundMoney(decimal(line.discountAmount ?? "0", `lines.${index}.discountAmount`));
    const taxRate = decimal(line.taxRate, `lines.${index}.taxRate`);
    if (quantity.lte(0) || unitPrice.lt(0) || discountAmount.lt(0) || taxRate.lt(0)) {
      throw new Error(`FISCAL_LINE_NEGATIVE:${index}`);
    }
    const gross = roundMoney(quantity.mul(unitPrice));
    if (discountAmount.gt(gross)) throw new Error(`FISCAL_DISCOUNT_EXCEEDS_GROSS:${index}`);
    const taxableBase = roundMoney(gross.minus(discountAmount));
    const taxAmount = roundMoney(taxableBase.mul(taxRate).div(100));
    return {
      id: required(line.id, `lines.${index}.id`),
      description: required(line.description, `lines.${index}.description`),
      quantity: quantity.toFixed(4),
      unitPrice: unitPrice.toFixed(4),
      discountAmount: discountAmount.toFixed(2),
      taxRate: taxRate.toFixed(2),
      taxableBase: taxableBase.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      lineTotal: taxableBase.plus(taxAmount).toFixed(2),
    };
  });
  const sum = (field: "taxableBase" | "taxAmount" | "discountAmount") =>
    lines.reduce((total, line) => total.plus(line[field]), new Prisma.Decimal(0));
  const grossAmount = lines.reduce(
    (total, line) => total.plus(decimal(line.quantity, "quantity").mul(decimal(line.unitPrice, "unitPrice"))),
    new Prisma.Decimal(0),
  );
  const withholding = roundMoney(decimal(input.withholdingAmount ?? "0", "withholdingAmount"));
  const taxableBase = roundMoney(sum("taxableBase"));
  const taxAmount = roundMoney(sum("taxAmount"));
  const payableAmount = roundMoney(taxableBase.plus(taxAmount).minus(withholding));
  if (payableAmount.lt(0)) throw new Error("FISCAL_PAYABLE_NEGATIVE");
  if (input.correction && !input.documentType.startsWith("R")) throw new Error("FISCAL_CORRECTION_TYPE_REQUIRED");
  if (!input.correction && input.documentType.startsWith("R")) throw new Error("FISCAL_CORRECTION_LINK_REQUIRED");
  return {
    semanticVersion: FISCAL_SEMANTIC_VERSION,
    documentId: required(input.documentId, "documentId"),
    documentType: input.documentType,
    issueDate: validateDate(input.issueDate, "issueDate"),
    ...(input.dueDate ? { dueDate: validateDate(input.dueDate, "dueDate") } : {}),
    currency: input.currency,
    seller: normalizeParty(input.seller, "seller"),
    buyer: normalizeParty(input.buyer, "buyer"),
    lines,
    withholdingAmount: withholding.toFixed(2),
    totals: {
      grossAmount: roundMoney(grossAmount).toFixed(2),
      discountAmount: roundMoney(sum("discountAmount")).toFixed(2),
      taxableBase: taxableBase.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      withholdingAmount: withholding.toFixed(2),
      payableAmount: payableAmount.toFixed(2),
    },
    ...(input.correction ? {
      correction: {
        kind: input.correction.kind,
        reason: required(input.correction.reason, "correction.reason"),
        originalFiscalDocumentId: required(input.correction.originalFiscalDocumentId, "correction.originalFiscalDocumentId"),
        originalInvoiceNumber: required(input.correction.originalInvoiceNumber, "correction.originalInvoiceNumber"),
      },
    } : {}),
    ...(input.payment ? { payment: input.payment } : {}),
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("CANONICAL_JSON_NON_FINITE");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toFixed());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  throw new Error("CANONICAL_JSON_UNSUPPORTED_VALUE");
}

export function sha256Hex(value: string | Uint8Array, uppercase = false) {
  const hash = createHash("sha256").update(value).digest("hex");
  return uppercase ? hash.toUpperCase() : hash;
}

export function canonicalInvoiceHash(invoice: CanonicalInvoice) {
  return sha256Hex(canonicalJson(invoice));
}

export function aeatDecimal(value: string) {
  const normalized = decimal(value, "aeatDecimal").toFixed(2).replace(/\.00$/u, "").replace(/(\.\d)0$/u, "$1");
  return normalized === "-0" ? "0" : normalized;
}
