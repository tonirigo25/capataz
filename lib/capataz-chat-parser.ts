export type IvaMode = "included" | "plus" | "none" | "unknown";

export type ParsedBudgetCommand = {
  intent: "crear_presupuesto";
  clientName: string;
  workTitle: string;
  jobType: string;
  scope: string;
  lineConcept: string;
  lineDescription: string;
  amount: number;
  currency: "EUR";
  materialIncluded: boolean;
  ivaMode: IvaMode;
};

export type ParsedInvoiceCommand = {
  intent: "crear_factura";
  clientName: string;
  workTitle: string;
  lineDescription: string;
  amount: number;
  currency: "EUR";
  ivaMode: IvaMode;
  materialIncluded: boolean;
};

export type ParsedBudgetFollowUp = {
  useful: boolean;
  ivaMode?: Exclude<IvaMode, "unknown">;
  workAddress?: string;
  phone?: string;
  email?: string;
  nif?: string;
  leavePending?: boolean;
  wantsPdf?: boolean;
};

export type ParsedPdfCommand = {
  intent: "generar_pdf";
  documentKind?: "budget" | "invoice";
  clientName?: string;
};

export type ParsedConvertBudgetCommand = {
  intent: "convertir_presupuesto_en_factura";
  clientName?: string;
};

export type ParsedChatCommand =
  | ParsedBudgetCommand
  | ParsedInvoiceCommand
  | ParsedPdfCommand
  | ParsedConvertBudgetCommand
  | { intent: "registrar_gasto" }
  | { intent: "registrar_pago" }
  | { intent: "marcar_factura_pagada" }
  | { intent: "crear_recordatorio" }
  | { intent: "buscar_cliente" }
  | { intent: "completar_cliente" }
  | { intent: "buscar_documento" }
  | null;

export const chatIntentValidationCases = [
  {
    text: "hazme un presupuesto para Juan de cambiar el baño por 6.500",
    expected: { intent: "crear_presupuesto", clientName: "Juan", amount: 6500 }
  },
  {
    text: "créame para el cliente Juana un presupuesto de la reforma integral, cocina + baño de 14000 euros, con material incluido",
    expected: { intent: "crear_presupuesto", clientName: "Juana", amount: 14000, materialIncluded: true }
  },
  {
    text: "presupuesto para Pedro de pintar piso completo por 2300 más IVA",
    expected: { intent: "crear_presupuesto", clientName: "Pedro", amount: 2300, ivaMode: "plus" }
  }
] as const;

const stopWords = new Set([
  "un",
  "una",
  "el",
  "la",
  "los",
  "las",
  "cliente",
  "presupuesto",
  "factura",
  "para",
  "por",
  "de",
  "a",
  "en"
]);

export function parseChatCommand(text: string): ParsedChatCommand {
  const normalized = normalizeText(text);

  if (looksLikePdfRequest(normalized)) return parsePdfCommand(text, normalized);
  if (looksLikeBudgetToInvoiceCommand(normalized)) return parseBudgetToInvoiceCommand(text, normalized);

  if (looksLikeBudgetCommand(normalized)) {
    return parseBudgetCommand(text, normalized);
  }

  if (looksLikeInvoiceCommand(normalized)) {
    return parseInvoiceCommand(text, normalized);
  }

  if (normalized.includes("gasto") || normalized.includes("apunta")) return { intent: "registrar_gasto" };
  if (normalized.includes("pagado") || normalized.includes("pago")) return { intent: "registrar_pago" };
  if (normalized.includes("recordatorio") || normalized.includes("recuerdame")) return { intent: "crear_recordatorio" };
  if (normalized.includes("cliente")) return { intent: "buscar_cliente" };
  if (normalized.includes("documento") || normalized.includes("pdf")) return { intent: "buscar_documento" };

  return null;
}

export function parseBudgetFollowUp(text: string): ParsedBudgetFollowUp {
  const normalized = normalizeText(text);
  const result: ParsedBudgetFollowUp = { useful: false };
  const ivaMode = extractIvaMode(normalized);
  const workAddress = extractWorkAddress(text, normalized);
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const nif = extractNif(text);
  const leavePending = /(dejalo pendiente|dejarlo pendiente|no tengo mas datos|luego te lo digo|dejalo asi|dejalo asi de momento|asi vale)/.test(normalized);
  const wantsPdf = looksLikePdfRequest(normalized);

  if (ivaMode !== "unknown") result.ivaMode = ivaMode;
  if (workAddress) result.workAddress = workAddress;
  if (phone) result.phone = phone;
  if (email) result.email = email;
  if (nif) result.nif = nif;
  if (leavePending) result.leavePending = true;
  if (wantsPdf) result.wantsPdf = true;

  result.useful = Boolean(result.ivaMode || result.workAddress || result.phone || result.email || result.nif || result.leavePending || result.wantsPdf);
  return result;
}

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(text: string) {
  return normalizeText(text).replace(/[^a-z0-9 ]/g, "").trim();
}

function looksLikeBudgetCommand(normalized: string) {
  return normalized.includes("presupuesto") && /(haz|hazme|crea|creame|crear|prepara|preparame|presupuesto para|presupuesto de)/.test(normalized);
}

function looksLikeInvoiceCommand(normalized: string) {
  if (!normalized.includes("factura")) return false;
  if (looksLikePdfRequest(normalized) || looksLikeBudgetToInvoiceCommand(normalized)) return false;
  return /(haz|hazme|crea|creame|crear|prepara|preparame|factura a|factura para|factura de|factura del)/.test(normalized);
}

function looksLikeBudgetToInvoiceCommand(normalized: string) {
  return normalized.includes("presupuesto") && normalized.includes("factura") && /(convierte|convertir|pasar|pasalo|haz factura|hacer factura)/.test(normalized);
}

function looksLikePdfRequest(normalized: string) {
  return /\b(pdf|descarga|descargar|sacame|hazme.*pdf|genera|generar)\b/.test(normalized) && /(pdf|descarga|descargar|presupuesto|factura)/.test(normalized);
}

function parseBudgetCommand(original: string, normalized: string): ParsedBudgetCommand | null {
  const amount = extractMoneyAmount(original);
  const clientName = extractClientName(original, normalized, "budget");
  if (!amount || !clientName) return null;

  const rawWork = extractWorkText(original, normalized, "budget") ?? "Trabajo pendiente de definir";
  const workTitle = sentenceCase(cleanWorkTitle(rawWork));
  const materialIncluded = /material(?:es)? incluido|incluye material|con material/.test(normalized);
  const ivaMode = extractIvaMode(normalized);

  const lineConcept = workTitle;
  const lineDescription = buildLineDescription(workTitle, materialIncluded);

  return {
    intent: "crear_presupuesto",
    clientName,
    workTitle,
    jobType: extractJobType(workTitle),
    scope: extractScope(workTitle),
    lineConcept,
    lineDescription,
    amount,
    currency: "EUR",
    materialIncluded,
    ivaMode
  };
}

function parseInvoiceCommand(original: string, normalized: string): ParsedInvoiceCommand | null {
  const amount = extractMoneyAmount(original);
  const clientName = extractClientName(original, normalized, "invoice");
  if (!amount || !clientName) return null;

  const rawWork = extractWorkText(original, normalized, "invoice") ?? "Trabajo pendiente de definir";
  const workTitle = sentenceCase(cleanWorkTitle(rawWork));
  const materialIncluded = /material(?:es)? incluido|incluye material|con material/.test(normalized);

  return {
    intent: "crear_factura",
    clientName,
    workTitle,
    lineDescription: buildLineDescription(workTitle, materialIncluded),
    amount,
    currency: "EUR",
    ivaMode: extractIvaMode(normalized),
    materialIncluded
  };
}

function parsePdfCommand(original: string, normalized: string): ParsedPdfCommand {
  return {
    intent: "generar_pdf",
    documentKind: normalized.includes("factura") ? "invoice" : normalized.includes("presupuesto") ? "budget" : undefined,
    clientName: extractLooseClientName(original, normalized)
  };
}

function parseBudgetToInvoiceCommand(original: string, normalized: string): ParsedConvertBudgetCommand {
  return {
    intent: "convertir_presupuesto_en_factura",
    clientName: extractLooseClientName(original, normalized)
  };
}

function extractClientName(original: string, normalized: string, document: "budget" | "invoice") {
  const documentWord = document === "budget" ? "presupuesto" : "factura";
  const commandWords = "(?:hazme|haz|creame|créame|crea|crear|prepara|preparame|prepárame)";
  const patterns = document === "budget"
    ? [
        /presupuesto\s+para\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+(?=baño|bano|cocina|reforma|pintar|pintura|cambiar|alicatar|obra|piso)/i,
        /(?:para\s+el\s+cliente|para\s+la\s+cliente|cliente)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
        /presupuesto\s+para\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
        /para\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)\s+(?:un\s+)?presupuesto/i,
        new RegExp(`${commandWords}\\s+(?:un\\s+)?${documentWord}\\s+para\\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)`, "i")
      ]
    : [
        /factura\s+(?:a|para)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+(?=baño|bano|cocina|reforma|pintar|pintura|cambiar|alicatar|obra|piso|la\s+|el\s+)/i,
        /(?:factura\s+a|factura\s+para|a\s+el\s+cliente|a\s+la\s+cliente|cliente)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
        /(?:hazme|haz|creame|créame|crea|crear|prepara|preparame|prepárame)\s+(?:una\s+)?factura\s+(?:a|para)\s+([A-Za-zÁÉÍÓÚÜÑáéÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
        /factura\s+de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i
      ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) return cleanClientName(match[1]);
  }

  const normalizedMatch = normalized.match(new RegExp(`${documentWord} para ([a-z]+(?: [a-z]+)?)`))
    ?? normalized.match(new RegExp(`${documentWord} a ([a-z]+(?: [a-z]+)?)`));
  return normalizedMatch?.[1] ? titleCase(cleanClientName(normalizedMatch[1])) : null;
}

function extractLooseClientName(original: string, normalized: string) {
  const patterns = [
    /(?:factura|presupuesto)\s+(?:de|a|para)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /(?:cliente|de|a|para)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)(?:\s|$)/i
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanClientName(match[1]);
      if (cleaned) return cleaned;
    }
  }

  const normalizedMatch = normalized.match(/(?:cliente|de|a|para) ([a-z]+(?: [a-z]+)?)(?: |$)/);
  return normalizedMatch?.[1] ? titleCase(cleanClientName(normalizedMatch[1])) : undefined;
}

function cleanClientName(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ""))
    .filter((word) => word && !stopWords.has(normalizeText(word)));
  return titleCase(words.slice(0, 2).join(" "));
}

function extractWorkText(original: string, normalized: string, document: "budget" | "invoice") {
  const lowerOriginal = original.toLowerCase();
  const moneyIndex = findMoneyIndex(lowerOriginal);
  const beforeMoney = moneyIndex >= 0 ? original.slice(0, moneyIndex) : original;
  const cleanBeforeMoney = beforeMoney.replace(/\b(?:de|por)\s*$/i, "").trim();
  const documentWord = document === "budget" ? "presupuesto" : "factura";

  const afterDocumentOf = cleanBeforeMoney.match(new RegExp(`${documentWord}\\s+de\\s+(.+)$`, "i"))?.[1];
  if (afterDocumentOf) return afterDocumentOf;

  const afterClientOf = cleanBeforeMoney.match(/(?:para|a)\s+(?:el\s+cliente\s+|la\s+cliente\s+)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?\s+(?:un\s+|una\s+)?(?:presupuesto|factura)?\s*(?:de|por)\s+(.+)$/i)?.[1];
  if (afterClientOf) return afterClientOf;

  const directAfterClient = cleanBeforeMoney.match(new RegExp(`${documentWord}\\s+(?:para|a)\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?\\s+(.+)$`, "i"))?.[1];
  if (directAfterClient) {
    const cleaned = directAfterClient.replace(/^(?:de|por)\s+/i, "").trim();
    if (cleaned && !stopWords.has(normalizeText(cleaned))) return cleaned;
  }

  const afterPor = cleanBeforeMoney.match(/\spor\s+(.+)$/i)?.[1];
  if (afterPor && !/^\d/.test(afterPor.trim())) return afterPor;

  const normalizedWork = normalized.match(new RegExp(`${documentWord} (?:para|a) [a-z]+(?: [a-z]+)? de (.+?)(?: por | de \\d| \\d|$)`))?.[1];
  return normalizedWork ?? null;
}

function extractIvaMode(normalized: string): IvaMode {
  if (/(mas iva|más iva|iva aparte|iva a parte|anade el iva|añade el iva|sumale iva|sumale el iva)/.test(normalized)) return "plus";
  if (/(sin iva|exento de iva|no lleva iva)/.test(normalized)) return "none";
  if (/(con iva incluido|iva incluido|incluye iva|con iva|va con iva|son con iva|los \d[\d.,]* son con iva)/.test(normalized)) return "included";
  return "unknown";
}

function extractWorkAddress(original: string, normalized: string) {
  const patterns = [
    /(?:la\s+obra\s+es\s+en|obra\s+en|es\s+en|en)\s+(.+?)(?:\.|,?\s+(?:telefono|teléfono|tel|movil|móvil|email|correo|nif|cif)\b|$)/i,
    /(?:direccion|dirección)\s+(?:de\s+la\s+obra\s+)?(.+?)(?:\.|,?\s+(?:telefono|teléfono|tel|movil|móvil|email|correo|nif|cif)\b|$)/i
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanAddress(match[1]);
      if (cleaned) return cleaned;
    }
  }

  const normalizedMatch = normalized.match(/(?:la obra es en|obra en|es en|en) (.+?)(?: telefono| tel | movil| email| nif| cif|$)/);
  return normalizedMatch?.[1] ? cleanAddress(normalizedMatch[1]) : undefined;
}

function cleanAddress(value: string) {
  const cleaned = value
    .replace(/\b(la obra|obra|direccion|dirección)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
  if (!cleaned || stopWords.has(normalizeText(cleaned))) return undefined;
  return titleCase(cleaned);
}

function extractPhone(text: string) {
  const explicit = text.match(/(?:telefono|teléfono|tel\.?|movil|móvil|whatsapp)(?:\s+de\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?\s*(?:es|:)?\s*((?:\+?\d[\s.-]?){8,13})/i)?.[1];
  const loose = text.match(/\b((?:\+?\d[\s.-]?){8,13})\b/)?.[1];
  const raw = explicit ?? loose;
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 13 ? cleaned : undefined;
}

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase();
}

function extractNif(text: string) {
  const match = text.match(/\b(?:nif|cif)\s*(?:es|:)?\s*([A-Z0-9][A-Z0-9 .-]{6,14}[A-Z0-9])\b/i);
  return match?.[1]?.replace(/[\s.-]/g, "").toUpperCase();
}

function findMoneyIndex(text: string) {
  const matches = [...text.matchAll(/\d[\d.,]*(?:\s*(?:euros|eur|€))?/g)];
  return matches.length ? matches[0].index ?? -1 : -1;
}

function cleanWorkTitle(value: string) {
  return value
    .replace(/\b(un|una|el|la|los|las)\b/gi, " ")
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+y\s+/gi, " + ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLineDescription(workTitle: string, materialIncluded: boolean) {
  const normalized = normalizeText(workTitle);
  const base = normalized.includes("reforma integral cocina + bano")
    ? "Reforma integral de cocina y baño"
    : workTitle
      .replace(/\bcambiar\b/i, "Cambio de")
      .replace(/\bbano\b/i, "baño");
  return materialIncluded ? `${base} con material incluido` : base;
}

function extractJobType(workTitle: string) {
  const normalized = normalizeText(workTitle);
  if (normalized.includes("reforma integral")) return "reforma integral";
  if (normalized.includes("pintar") || normalized.includes("pintura")) return "pintura";
  if (normalized.includes("cambiar")) return "cambio";
  if (normalized.includes("bano")) return "reforma de baño";
  return normalized.split(" ").slice(0, 3).join(" ") || "trabajo";
}

function extractScope(workTitle: string) {
  const normalized = normalizeText(workTitle);
  if (normalized.includes("cocina") && normalized.includes("bano")) return "cocina + baño";
  if (normalized.includes("piso completo")) return "piso completo";
  if (normalized.includes("bano")) return "baño";
  if (normalized.includes("cocina")) return "cocina";
  return workTitle;
}

function extractMoneyAmount(text: string) {
  const match = text.match(/(\d[\d.,]*)(?:\s*(?:euros|eur|€))?/i);
  if (!match?.[1]) return null;
  return parseSpanishNumber(match[1]);
}

function parseSpanishNumber(value: string) {
  const cleaned = value.trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, ""));
  }
  if (/^\d+[,.]\d{1,2}$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  return Number(cleaned.replace(/[.,]/g, ""));
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word === "+") return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bBano\b/g, "Baño")
    .replace(/\bCif\b/g, "CIF")
    .replace(/\bNif\b/g, "NIF");
}

function sentenceCase(value: string) {
  const lower = value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word === "+" ? word : word.toLowerCase())
    .join(" ")
    .replace(/\bbano\b/g, "baño");
  return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
}
