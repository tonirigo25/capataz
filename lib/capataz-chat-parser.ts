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
  fiscalAddress?: string;
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

export type ParsedActivityCommand = {
  intent: "registrar_visita" | "registrar_reunion" | "registrar_llamada" | "registrar_nota_obra";
  eventType: "visita" | "reunion" | "llamada" | "nota";
  clientName?: string;
  workTitle?: string;
  eventTime?: string;
  eventDateHint?: "today" | "tomorrow";
  topics: string[];
  materialsReviewed: boolean;
  pendingConfirmation: boolean;
  notes: string;
};

export type ParsedFollowUpCommand = {
  intent: "crear_seguimiento";
  clientName?: string;
  channel?: "whatsapp" | "email" | "interno";
  reminderDateHint?: "today" | "tomorrow";
  reminderTime?: string;
  message: string;
};

export type ParsedChatCommand =
  | ParsedBudgetCommand
  | ParsedInvoiceCommand
  | ParsedPdfCommand
  | ParsedConvertBudgetCommand
  | ParsedActivityCommand
  | ParsedFollowUpCommand
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
  },
  {
    text: "he tenido una visita con Laura referente a la obra completa, hemos revisado los materiales y me tiene que confirmar, la visita ha sido a las 17H",
    expected: { intent: "registrar_visita", clientName: "Laura", workTitle: "Obra completa", eventTime: "17:00" }
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
  if (looksLikeActivityCommand(normalized)) return parseActivityCommand(text, normalized);

  if (looksLikeBudgetCommand(normalized)) {
    return parseBudgetCommand(text, normalized);
  }

  if (looksLikeInvoiceCommand(normalized)) {
    return parseInvoiceCommand(text, normalized);
  }

  if (looksLikeFollowUpCommand(normalized)) return parseFollowUpCommand(text, normalized);
  if (looksLikeExpenseCommand(normalized, text)) return { intent: "registrar_gasto" };
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
  const fiscalAddress = extractFiscalAddress(text, normalized);
  const workAddress = extractWorkAddress(text, normalized);
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const nif = extractNif(text);
  const leavePending = /(dejalo pendiente|dejarlo pendiente|no tengo mas datos|luego te lo digo|dejalo asi|dejalo asi de momento|asi vale)/.test(normalized);
  const wantsPdf = looksLikePdfRequest(normalized);

  if (ivaMode !== "unknown") result.ivaMode = ivaMode;
  if (fiscalAddress) result.fiscalAddress = fiscalAddress;
  if (workAddress) result.workAddress = workAddress;
  if (phone) result.phone = phone;
  if (email) result.email = email;
  if (nif) result.nif = nif;
  if (leavePending) result.leavePending = true;
  if (wantsPdf) result.wantsPdf = true;

  result.useful = Boolean(result.ivaMode || result.workAddress || result.fiscalAddress || result.phone || result.email || result.nif || result.leavePending || result.wantsPdf);
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

function looksLikeActivityCommand(normalized: string) {
  return /\b(visita|reunion|llamada)\b/.test(normalized)
    || /(he ido a ver|hemos quedado|he quedado|he hablado con|hemos hablado con|me he reunido con|reunido con)/.test(normalized);
}

function looksLikeFollowUpCommand(normalized: string) {
  return /(mandale|mándale|enviar seguimiento|pon seguimiento|hacer seguimiento|dar un toque|mandar un toque|recuerdale|recuérdale|llamar si no responde)/.test(normalized);
}

function looksLikeExpenseCommand(normalized: string, original: string) {
  if (looksLikeActivityCommand(normalized)) return false;
  const amount = extractMoneyAmount(original);
  if (/\bgasto\b|\bgastos\b|factura de proveedor|recibo|proveedor|leroy merlin/.test(normalized)) return true;
  if (/(he comprado|comprado|compra de|pague|pagué|me costo|me costó|coste|material comprado)/.test(normalized)) return true;
  if ((normalized.includes("apunta") || normalized.includes("apuntame")) && amount && /\bmaterial(?:es)?\b/.test(normalized)) return true;
  return false;
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

function parseActivityCommand(original: string, normalized: string): ParsedActivityCommand {
  const eventType = normalized.includes("llamada") || normalized.includes("he hablado con") || normalized.includes("hemos hablado con")
    ? "llamada"
    : normalized.includes("reunion") || normalized.includes("hemos quedado") || normalized.includes("he quedado") || normalized.includes("reunido")
      ? "reunion"
      : normalized.includes("visita") || normalized.includes("he ido a ver")
        ? "visita"
        : "nota";

  const intent = eventType === "llamada"
    ? "registrar_llamada"
    : eventType === "reunion"
      ? "registrar_reunion"
      : eventType === "visita"
        ? "registrar_visita"
        : "registrar_nota_obra";

  const materialsReviewed = /(revisad[oa]s? (?:los |las )?material(?:es)?|material(?:es)? revisad[oa]s?)/.test(normalized)
    || (normalized.includes("materiales") && /(visita|reunion|hemos|revis)/.test(normalized));
  const pendingConfirmation = /(me tiene que confirmar|tiene que confirmar|debe confirmar|queda pendiente confirmar|pendiente de confirmar|me tiene que llamar|tiene que llamarme|si no responde)/.test(normalized);

  const topics: string[] = [];
  if (materialsReviewed) topics.push("materiales");
  if (pendingConfirmation) topics.push("confirmación pendiente");

  return {
    intent,
    eventType,
    clientName: extractActivityClientName(original, normalized),
    workTitle: extractActivityWorkTitle(original, normalized),
    eventTime: extractClockTime(original, normalized),
    eventDateHint: normalized.includes("manana") ? "tomorrow" : "today",
    topics,
    materialsReviewed,
    pendingConfirmation,
    notes: original.trim()
  };
}

function parseFollowUpCommand(original: string, normalized: string): ParsedFollowUpCommand {
  return {
    intent: "crear_seguimiento",
    clientName: extractLooseClientName(original, normalized) ?? extractActivityClientName(original, normalized),
    channel: normalized.includes("whatsapp") ? "whatsapp" : normalized.includes("email") || normalized.includes("correo") ? "email" : "interno",
    reminderDateHint: normalized.includes("manana") ? "tomorrow" : normalized.includes("hoy") ? "today" : undefined,
    reminderTime: extractClockTime(original, normalized),
    message: original.trim()
  };
}

function extractClientName(original: string, normalized: string, document: "budget" | "invoice") {
  const documentWord = document === "budget" ? "presupuesto" : "factura";
  const commandWords = "(?:hazme|haz|creame|créame|crea|crear|prepara|preparame|prepárame)";
  const nameWord = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+";
  const namePhrase = `${nameWord}(?:\\s+${nameWord}){0,3}?`;
  const beforeWorkOrAmount = "(?=\\s+(?:de|por|para|un|una|el|la|baño|bano|cocina|reforma|pintar|pintura|cambiar|alicatar|obra|piso|\\d)|\\s*$)";
  const patterns = document === "budget"
    ? [
        new RegExp(`(?:para\\s+el\\s+cliente|para\\s+la\\s+cliente|cliente)\\s+(${namePhrase})${beforeWorkOrAmount}`, "i"),
        new RegExp(`presupuesto\\s+para\\s+(?:el\\s+cliente\\s+|la\\s+cliente\\s+|cliente\\s+)?(${namePhrase})${beforeWorkOrAmount}`, "i"),
        new RegExp(`para\\s+(${namePhrase})\\s+(?:un\\s+)?presupuesto`, "i"),
        new RegExp(`${commandWords}\\s+(?:un\\s+)?${documentWord}\\s+para\\s+(?:el\\s+cliente\\s+|la\\s+cliente\\s+|cliente\\s+)?(${namePhrase})${beforeWorkOrAmount}`, "i")
      ]
    : [
        new RegExp(`factura\\s+(?:a|para)\\s+(?:el\\s+cliente\\s+|la\\s+cliente\\s+|cliente\\s+)?(${namePhrase})${beforeWorkOrAmount}`, "i"),
        new RegExp(`(?:a\\s+el\\s+cliente|a\\s+la\\s+cliente|cliente)\\s+(${namePhrase})${beforeWorkOrAmount}`, "i"),
        new RegExp(`${commandWords}\\s+(?:una\\s+)?factura\\s+(?:a|para)\\s+(?:el\\s+cliente\\s+|la\\s+cliente\\s+|cliente\\s+)?(${namePhrase})${beforeWorkOrAmount}`, "i"),
        new RegExp(`factura\\s+de\\s+(${namePhrase})${beforeWorkOrAmount}`, "i")
      ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) return cleanClientName(match[1]);
  }

  const normalizedMatch = normalized.match(new RegExp(`${documentWord} para ([a-z]+(?: [a-z]+){0,3})${beforeWorkOrAmount}`))
    ?? normalized.match(new RegExp(`${documentWord} a ([a-z]+(?: [a-z]+){0,3})${beforeWorkOrAmount}`));
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

function extractActivityClientName(original: string, normalized: string) {
  const patterns = [
    /(?:visita|reunión|reunion|llamada|quedado|hablado|reunido)\s+con\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)(?=\s+(?:referente|sobre|por|para|a\s+las|hemos|y|,|\.|$))/i,
    /\bcon\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)(?=\s+(?:referente|sobre|por|para|a\s+las|hemos|y|,|\.|$))/i,
    /\b(?:cliente|a)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)(?=\s+(?:referente|sobre|por|para|a\s+las|hemos|y|,|\.|$))/i
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanClientName(match[1]);
      if (cleaned) return cleaned;
    }
  }

  const normalizedMatch = normalized.match(/\bcon ([a-z]+(?: [a-z]+)?)(?= referente| sobre| por| para| a las| hemos| y |,|\.|$)/);
  return normalizedMatch?.[1] ? titleCase(cleanClientName(normalizedMatch[1])) : undefined;
}

function extractActivityWorkTitle(original: string, normalized: string) {
  const patterns = [
    /(?:referente a|sobre|por|para)\s+(?:la\s+|el\s+)?(.+?)(?:,|\.|\s+hemos\b|\s+a\s+las\b|\s+me\s+tiene\b|\s+tiene\s+que\b|$)/i,
    /\bobra\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+?)(?:,|\.|\s+hemos\b|\s+a\s+las\b|\s+me\s+tiene\b|\s+tiene\s+que\b|$)/i
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanWorkTitle(match[1]);
      if (cleaned) return sentenceCase(cleaned);
    }
  }

  const normalizedMatch = normalized.match(/(?:referente a|sobre|por|para) (?:la |el )?(.+?)(?:,| hemos| a las| me tiene| tiene que|$)/);
  return normalizedMatch?.[1] ? sentenceCase(cleanWorkTitle(normalizedMatch[1])) : undefined;
}

function extractClockTime(original: string, normalized: string) {
  const numeric = original.match(/\b(?:a\s+las\s+|las\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\s*h\b/i)
    ?? original.match(/\b(?:a\s+las\s+|las\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i)
    ?? original.match(/\b(?:a\s+las\s+|las\s+)([01]?\d|2[0-3])\b/i);
  if (numeric?.[1]) return `${numeric[1].padStart(2, "0")}:${numeric[2] ?? "00"}`;

  const hourWords: Record<string, number> = {
    una: 1,
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12
  };
  const word = normalized.match(/\ba las (una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?: de la (tarde|manana|mañana|noche))?\b/);
  if (!word?.[1]) return undefined;
  let hour = hourWords[word[1]] ?? 0;
  const dayPart = word[2];
  if ((dayPart === "tarde" || dayPart === "noche") && hour < 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:00`;
}

function cleanClientName(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ""))
    .filter(Boolean);
  while (words.length && stopWords.has(normalizeText(words[0]))) words.shift();
  while (words.length && stopWords.has(normalizeText(words[words.length - 1]))) words.pop();
  return titleCase(words.slice(0, 4).join(" "));
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
  if (/(mas iva|más iva|\+ iva|iva aparte|iva a parte|anade el iva|añade el iva|sumale iva|sumale el iva)/.test(normalized)) return "plus";
  if (/(sin iva|exento de iva|no lleva iva)/.test(normalized)) return "none";
  if (/(con iva incluido|iva incluido|incluye iva|con iva|va con iva|son con iva|los \d[\d.,]* son con iva)/.test(normalized)) return "included";
  return "unknown";
}

function extractWorkAddress(original: string, normalized: string) {
  const patterns = [
    /(?:la\s+obra\s+(?:es|será|sera)\s+en|obra\s+(?:es\s+)?en|direccion\s+de\s+la\s+obra|dirección\s+de\s+la\s+obra)\s+(.+?)(?:\.|,?\s+(?:sera|será|seran|serán|son|importe|por|telefono|teléfono|tel|movil|móvil|email|correo|nif|cif)\b|$)/i,
    /(?:es\s+en|en)\s+(.+?)\s+(?:la\s+obra|obra)(?:\.|,|$)/i,
    /(?:es\s+en|en)\s+((?:calle|c\/|avda\.?|avenida|plaza|paseo|camino|carretera|ctra\.?|ronda)\s+.+?)(?:\.|,?\s+(?:sera|será|seran|serán|son|importe|por|telefono|teléfono|tel|movil|móvil|email|correo|nif|cif)|$)/i
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanWorkAddress(match[1]);
      if (cleaned) return cleaned;
    }
  }

  const normalizedMatch = normalized.match(/(?:la obra (?:es|sera) en|obra (?:es )?en|direccion de la obra|direccion de obra) (.+?)(?: sera| seran| son| importe| por| telefono| tel | movil| email| nif| cif|$)/);
  return normalizedMatch?.[1] ? cleanWorkAddress(normalizedMatch[1]) : undefined;
}

function extractFiscalAddress(original: string, normalized: string) {
  const explicit = original.match(/(?:direccion\s+fiscal|dirección\s+fiscal|domicilio\s+fiscal)(?:\s+(?:es|:))?\s+(.+?)(?:\.|,?\s+(?:la\s+obra|obra\s+en|direccion\s+de\s+la\s+obra|dirección\s+de\s+la\s+obra|telefono|teléfono|tel|movil|móvil|email|correo|nif|cif)\b|$)/i)?.[1];
  const afterTaxId = original.match(/\b(?:nif|cif)?\s*([A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b\s+(.+?)(?:\.|,?\s+(?:la\s+obra|obra\s+en|direccion\s+de\s+la\s+obra|dirección\s+de\s+la\s+obra|telefono|teléfono|tel|movil|móvil|email|correo)\b|$)/i)?.[2];
  const candidate = explicit ?? afterTaxId;
  if (!candidate) return undefined;
  return cleanFiscalAddress(candidate, normalized);
}

function cleanWorkAddress(value: string) {
  return cleanAddress(value, "work");
}

function cleanFiscalAddress(value: string, fullNormalized = "") {
  return cleanAddress(value, "fiscal", fullNormalized);
}

function cleanAddress(value: string, kind: "work" | "fiscal" = "work", fullNormalized = "") {
  const cleaned = value
    .replace(/\b(la obra|obra|direccion|dirección|fiscal|domicilio)\b/gi, " ")
    .replace(/\b(?:sera|será|seran|serán|son)\s+\d[\d.,]*(?:\s+mil)?\s*(?:euros|eur|€)?\b.*$/i, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
  const candidate = normalizeText(cleaned);
  if (!cleaned || stopWords.has(candidate)) return undefined;
  if (/(ya te lo he dado|te lo he dado|ya lo he dado|lo tienes|ya esta|ya está)/.test(candidate) || /(ya te lo he dado|te lo he dado|ya lo he dado|lo tienes)/.test(fullNormalized)) return undefined;
  if (kind === "fiscal" && /^(ya|te|lo|he|dado|falta|faltaba|direccion|fiscal)\b/.test(candidate)) return undefined;
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
  const taxIdPattern = "([A-Z]\\d{7}[A-Z0-9]|\\d{8}[A-Z]|[XYZ]\\d{7}[A-Z])";
  const explicit = text.match(new RegExp(`\\b(?:nif|cif)\\s*(?:es|:)?\\s*${taxIdPattern}\\b`, "i"));
  const bare = text.match(new RegExp(`\\b${taxIdPattern}\\b`, "i"));
  const raw = explicit?.[1] ?? bare?.[1];
  return raw?.replace(/[\s.-]/g, "").toUpperCase();
}

function findMoneyIndex(text: string) {
  const match = firstMoneyMatch(text);
  return match?.index ?? -1;
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
  const thousands = text.match(/\b(\d[\d.,]*)\s+mil(?:\s*(?:euros|eur|€))?\b/i);
  if (thousands && !isTimeLikeNumber(text, thousands.index ?? 0, thousands[1])) return parseSpanishNumber(thousands[1]) * 1000;
  const match = firstMoneyMatch(text);
  if (!match) return null;
  return parseSpanishNumber(match.value);
}

function firstMoneyMatch(text: string) {
  const pattern = /(\d[\d.,]*)(?:\s*(euros|eur|€))?/gi;
  for (const match of text.matchAll(pattern)) {
    if (!match[1]) continue;
    if (isTimeLikeNumber(text, match.index ?? 0, match[1])) continue;
    return { value: match[1], index: match.index ?? 0 };
  }
  return null;
}

function isTimeLikeNumber(text: string, index: number, value: string) {
  const before = text.slice(Math.max(0, index - 12), index).toLowerCase();
  const after = text.slice(index + value.length, index + value.length + 4).toLowerCase();
  if (/^\s*(h|:)/.test(after)) return true;
  if (/\b(a\s+)?las\s+$/.test(before)) return true;
  return false;
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
