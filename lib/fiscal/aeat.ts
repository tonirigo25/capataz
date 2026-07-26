import QRCode from "qrcode";
import { aeatDecimal, sha256Hex } from "./canonical";

export const AEAT_HASH_SPEC_VERSION = "0.1.2";
export const AEAT_QR_SPEC_VERSION = "0.5.0";

export type AeatRegistrationHashInput = {
  issuerTaxId: string;
  invoiceNumber: string;
  issueDate: string;
  invoiceType: string;
  taxAmount: string;
  totalAmount: string;
  previousHash?: string | null;
  generatedAt: string;
};

export type AeatCancellationHashInput = {
  issuerTaxId: string;
  invoiceNumber: string;
  issueDate: string;
  previousHash?: string | null;
  generatedAt: string;
};

function trim(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function ddMmYyyy(value: string) {
  const normalized = trim(value);
  if (/^\d{2}-\d{2}-\d{4}$/u.test(normalized)) return normalized;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(normalized);
  if (!match) throw new Error("AEAT_DATE_INVALID");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function generationTimestamp(value: string) {
  const normalized = trim(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(normalized)) {
    throw new Error("AEAT_GENERATION_TIMESTAMP_INVALID");
  }
  return normalized;
}

function joinFields(fields: Array<[string, string]>) {
  return fields.map(([name, value]) => `${name}=${trim(value)}`).join("&");
}

export function aeatRegistrationCanonicalInput(input: AeatRegistrationHashInput) {
  return joinFields([
    ["IDEmisorFactura", input.issuerTaxId],
    ["NumSerieFactura", input.invoiceNumber],
    ["FechaExpedicionFactura", ddMmYyyy(input.issueDate)],
    ["TipoFactura", input.invoiceType],
    ["CuotaTotal", aeatDecimal(input.taxAmount)],
    ["ImporteTotal", aeatDecimal(input.totalAmount)],
    ["Huella", input.previousHash ?? ""],
    ["FechaHoraHusoGenRegistro", generationTimestamp(input.generatedAt)],
  ]);
}

export function aeatCancellationCanonicalInput(input: AeatCancellationHashInput) {
  return joinFields([
    ["IDEmisorFacturaAnulada", input.issuerTaxId],
    ["NumSerieFacturaAnulada", input.invoiceNumber],
    ["FechaExpedicionFacturaAnulada", ddMmYyyy(input.issueDate)],
    ["Huella", input.previousHash ?? ""],
    ["FechaHoraHusoGenRegistro", generationTimestamp(input.generatedAt)],
  ]);
}

export function aeatHash(canonicalInput: string) {
  return sha256Hex(Buffer.from(canonicalInput, "utf8"), true);
}

export function calculateAeatRegistrationHash(input: AeatRegistrationHashInput) {
  const canonicalInput = aeatRegistrationCanonicalInput(input);
  return { canonicalInput, hash: aeatHash(canonicalInput), algorithm: "SHA-256" as const };
}

export function calculateAeatCancellationHash(input: AeatCancellationHashInput) {
  const canonicalInput = aeatCancellationCanonicalInput(input);
  return { canonicalInput, hash: aeatHash(canonicalInput), algorithm: "SHA-256" as const };
}

export type AeatQrInput = {
  mode: "verifactu" | "non-verifiable";
  environment: "sandbox" | "live";
  issuerTaxId: string;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: string;
};

const QR_BASE = {
  sandbox: {
    verifactu: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
    "non-verifiable": "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu",
  },
  live: {
    verifactu: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
    "non-verifiable": "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu",
  },
} as const;

function ascii(value: string, field: string, max: number) {
  const normalized = trim(value);
  if (!normalized || normalized.length > max || !/^[\x20-\x7E]+$/u.test(normalized)) {
    throw new Error(`AEAT_QR_FIELD_INVALID:${field}`);
  }
  return normalized;
}

export function buildAeatQrPayload(input: AeatQrInput) {
  const nif = ascii(input.issuerTaxId.toUpperCase(), "nif", 9);
  if (nif.length !== 9) throw new Error("AEAT_QR_NIF_LENGTH");
  const invoiceNumber = ascii(input.invoiceNumber, "numserie", 60);
  const issueDate = ddMmYyyy(input.issueDate);
  const amount = aeatDecimal(input.totalAmount);
  if (!/^\d{1,12}(?:\.\d{1,2})?$/u.test(amount)) throw new Error("AEAT_QR_AMOUNT_INVALID");
  const query = [
    ["nif", nif],
    ["numserie", invoiceNumber],
    ["fecha", issueDate],
    ["importe", amount],
  ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  const payload = `${QR_BASE[input.environment][input.mode]}?${query}`;
  if (!/^[\x20-\x7E]+$/u.test(payload)) throw new Error("AEAT_QR_NON_ASCII");
  return {
    payload,
    version: AEAT_QR_SPEC_VERSION,
    heading: "QR tributario:",
    legend: input.mode === "verifactu" ? "Factura verificable en la sede electrónica de la AEAT" : null,
  };
}

export async function renderAeatQr(input: AeatQrInput) {
  const qr = buildAeatQrPayload(input);
  const png = await QRCode.toBuffer(qr.payload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 220,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return { ...qr, png, pngHash: sha256Hex(png) };
}
