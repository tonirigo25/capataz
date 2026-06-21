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
  ivaMode: "included" | "plus" | "unknown";
};

export type ParsedChatCommand =
  | ParsedBudgetCommand
  | { intent: "crear_factura" }
  | { intent: "registrar_gasto" }
  | { intent: "registrar_pago" }
  | { intent: "marcar_factura_pagada" }
  | { intent: "crear_recordatorio" }
  | { intent: "buscar_cliente" }
  | { intent: "completar_cliente" }
  | { intent: "buscar_documento" }
  | { intent: "convertir_presupuesto_en_factura" }
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
  "de"
]);

export function parseChatCommand(text: string): ParsedChatCommand {
  const normalized = normalizeText(text);

  if (looksLikeBudgetCommand(normalized)) {
    return parseBudgetCommand(text, normalized);
  }

  if (normalized.includes("factura")) return { intent: "crear_factura" };
  if (normalized.includes("gasto") || normalized.includes("apunta")) return { intent: "registrar_gasto" };
  if (normalized.includes("pagado") || normalized.includes("pago")) return { intent: "registrar_pago" };
  if (normalized.includes("recordatorio") || normalized.includes("recuerdame")) return { intent: "crear_recordatorio" };
  if (normalized.includes("cliente")) return { intent: "buscar_cliente" };
  if (normalized.includes("documento") || normalized.includes("pdf")) return { intent: "buscar_documento" };

  return null;
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

function parseBudgetCommand(original: string, normalized: string): ParsedBudgetCommand | null {
  const amount = extractMoneyAmount(original);
  const clientName = extractClientName(original, normalized);
  if (!amount || !clientName) return null;

  const rawWork = extractWorkText(original, normalized) ?? "Trabajo pendiente de definir";
  const workTitle = sentenceCase(cleanWorkTitle(rawWork));
  const materialIncluded = /material(?:es)? incluido|incluye material|con material/.test(normalized);
  const ivaMode = /mas iva|más iva|iva aparte|sin iva/.test(normalized)
    ? "plus"
    : /con iva incluido|iva incluido|incluye iva/.test(normalized)
      ? "included"
      : "unknown";

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

function extractClientName(original: string, normalized: string) {
  const patterns = [
    /(?:para\s+el\s+cliente|para\s+la\s+cliente|cliente)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /presupuesto\s+para\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /para\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)\s+(?:un\s+)?presupuesto/i,
    /(?:hazme|haz|creame|créame|crea|prepara|preparame|prepárame)\s+(?:un\s+)?presupuesto\s+para\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) return cleanClientName(match[1]);
  }

  const normalizedMatch = normalized.match(/presupuesto para ([a-z]+(?: [a-z]+)?)/);
  return normalizedMatch?.[1] ? titleCase(cleanClientName(normalizedMatch[1])) : null;
}

function cleanClientName(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ""))
    .filter((word) => word && !stopWords.has(normalizeText(word)));
  return titleCase(words.slice(0, 2).join(" "));
}

function extractWorkText(original: string, normalized: string) {
  const lowerOriginal = original.toLowerCase();
  const moneyIndex = findMoneyIndex(lowerOriginal);
  const beforeMoney = moneyIndex >= 0 ? original.slice(0, moneyIndex) : original;
  const cleanBeforeMoney = beforeMoney.replace(/\b(?:de|por)\s*$/i, "").trim();

  const afterBudgetOf = cleanBeforeMoney.match(/presupuesto\s+de\s+(.+)$/i)?.[1];
  if (afterBudgetOf) return afterBudgetOf;

  const afterClientOf = cleanBeforeMoney.match(/(?:para\s+(?:el\s+cliente\s+|la\s+cliente\s+)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?\s+de\s+)(.+)$/i)?.[1];
  if (afterClientOf) return afterClientOf;

  const normalizedWork = normalized.match(/presupuesto para [a-z]+(?: [a-z]+)? de (.+?)(?: por | de \d| \d|$)/)?.[1];
  return normalizedWork ?? null;
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
    .replace(/\bBano\b/g, "Baño");
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
