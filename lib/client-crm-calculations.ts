export const ACTIVE_WORK_STATUSES = [
  "pendiente_inicio",
  "en_curso",
  "pausada",
  "pendiente_material",
  "pendiente_remates",
  "pendiente_cobro"
];

export const BILLABLE_INVOICE_EXCLUDED_STATUSES = ["borrador"];
export const PENDING_BUDGET_STATUSES = ["pendiente_revision", "enviado", "visto", "pendiente_respuesta"];
export const OPEN_REMINDER_STATUSES = ["borrador", "pendiente_confirmacion", "programado"];
export const CONTACT_EVENT_TYPES = ["visita", "llamada", "seguimiento_presupuesto", "seguimiento_cobro"];
export const CONTACT_EVENT_STATUSES = ["confirmado", "realizado"];

export type DateLike = Date | string | null | undefined;

export type CrmInvoiceInput = {
  id?: string;
  total: number;
  pagado?: number | null;
  pendiente?: number | null;
  estado: string;
  fechaVencimiento?: DateLike;
  payments?: Array<{ id?: string; importe: number; fecha?: DateLike }>;
};

export type CrmBudgetInput = {
  total: number;
  estado: string;
};

export type CrmClientFieldsInput = {
  nombre?: string | null;
  tipo?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  nifCif?: string | null;
  direccionFiscal?: string | null;
  codigoPostal?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  pais?: string | null;
  emailFacturacion?: string | null;
  telefonoFacturacion?: string | null;
  contactoPrincipalNombre?: string | null;
  contactoPrincipalCargo?: string | null;
  contactoPrincipalTelefono?: string | null;
  contactoPrincipalEmail?: string | null;
  contactoFacturacionNombre?: string | null;
};

export type CrmDuplicateCandidate = {
  id: string;
  nombre: string;
  nombreComercial?: string | null;
  razonSocial?: string | null;
  telefono?: string | null;
  email?: string | null;
  emailFacturacion?: string | null;
  nifCif?: string | null;
  telefonoFacturacion?: string | null;
  contactoPrincipalTelefono?: string | null;
  contactoPrincipalEmail?: string | null;
};

export type DuplicateMatch = {
  client: CrmDuplicateCandidate;
  strength: "strong" | "weak";
  reason: string;
};

export type CrmAgendaEventInput = {
  tipo: string;
  estado: string;
  fechaInicio: DateLike;
};

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIdentifier(value: string | null | undefined) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export function normalizeStatus(value: string | null | undefined) {
  return normalizeText(value).replace(/[\s-]+/g, "_");
}

export function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d+]/g, "").replace(/^\+34/, "");
}

export function classifyClientType(tipo: string | null | undefined) {
  const normalized = normalizeText(tipo);
  if (!normalized) return "Otro";
  if (normalized.includes("particular")) return "Particular";
  if (normalized.includes("autonom")) return "Autónomo";
  if (normalized.includes("comunidad")) return "Comunidad";
  if (
    normalized.includes("empresa") ||
    normalized.includes("pyme") ||
    normalized.includes("negocio") ||
    normalized.includes("sociedad") ||
    normalized.includes("sl") ||
    normalized.includes("s.l")
  ) {
    return "Empresa";
  }
  return tipo ?? "Otro";
}

export function displayClientName(client: CrmClientFieldsInput) {
  return firstFilled(client.nombreComercial, client.razonSocial, client.nombre) || "Cliente sin nombre";
}

export function fiscalClientName(client: CrmClientFieldsInput) {
  return firstFilled(client.razonSocial, client.nombre) || "Sin nombre fiscal";
}

export function primaryContactLabel(client: CrmClientFieldsInput) {
  return firstFilled(client.contactoPrincipalNombre, client.nombre) || "Sin contacto";
}

export function isBillableInvoiceStatus(status: string | null | undefined) {
  return !BILLABLE_INVOICE_EXCLUDED_STATUSES.includes(normalizeStatus(status));
}

export function uniquePaymentTotal(payments: Array<{ id?: string; importe: number }> | null | undefined) {
  if (!payments?.length) return 0;
  const seen = new Set<string>();
  return payments.reduce((sum, payment, index) => {
    const key = payment.id ?? `index:${index}`;
    if (seen.has(key)) return sum;
    seen.add(key);
    return sum + safeNumber(payment.importe);
  }, 0);
}

export function paidAmountForInvoice(invoice: CrmInvoiceInput) {
  if (invoice.payments) return uniquePaymentTotal(invoice.payments);
  return safeNumber(invoice.pagado);
}

export function pendingAmountForInvoice(invoice: CrmInvoiceInput) {
  if (!isBillableInvoiceStatus(invoice.estado)) return 0;
  const total = safeNumber(invoice.total);
  if (invoice.payments) return Math.max(0, total - paidAmountForInvoice(invoice));
  if (typeof invoice.pendiente === "number") return Math.max(0, invoice.pendiente);
  return Math.max(0, total - paidAmountForInvoice(invoice));
}

export function buildFinancialSummary(invoices: CrmInvoiceInput[], now: Date = new Date()) {
  const billableInvoices = invoices.filter((invoice) => isBillableInvoiceStatus(invoice.estado));
  const billedTotal = billableInvoices.reduce((sum, invoice) => sum + safeNumber(invoice.total), 0);
  const paidTotal = billableInvoices.reduce((sum, invoice) => sum + paidAmountForInvoice(invoice), 0);
  const pendingTotal = billableInvoices.reduce((sum, invoice) => sum + pendingAmountForInvoice(invoice), 0);
  const pendingInvoices = billableInvoices.filter((invoice) => pendingAmountForInvoice(invoice) > 0);
  const overdueInvoices = pendingInvoices.filter((invoice) => {
    const due = toDate(invoice.fechaVencimiento);
    return Boolean(due && due < startOfDay(now));
  });
  const lastPaymentAt = latestDate(
    billableInvoices.flatMap((invoice) => invoice.payments?.map((payment) => payment.fecha) ?? [])
  );

  return {
    billedTotal,
    paidTotal,
    pendingTotal,
    pendingInvoicesCount: pendingInvoices.length,
    overdueInvoicesCount: overdueInvoices.length,
    lastPaymentAt
  };
}

export function buildBudgetSummary(budgets: CrmBudgetInput[]) {
  const activeBudgets = budgets.filter((budget) => !["rechazado", "caducado"].includes(normalizeStatus(budget.estado)));
  return {
    budgetedTotal: activeBudgets.reduce((sum, budget) => sum + safeNumber(budget.total), 0),
    pendingBudgetsCount: activeBudgets.filter((budget) => PENDING_BUDGET_STATUSES.includes(normalizeStatus(budget.estado))).length
  };
}

export function isActiveWorkStatus(status: string | null | undefined) {
  return ACTIVE_WORK_STATUSES.includes(normalizeStatus(status));
}

export function getClientPendingFields(client: CrmClientFieldsInput) {
  const fields: string[] = [];
  const type = classifyClientType(client.tipo);
  const fiscalClient = type === "Empresa" || type === "Autónomo" || type === "Comunidad";

  if (!hasValue(client.nombre) && !hasValue(client.razonSocial)) fields.push("Falta nombre o razón social");
  if (!hasValue(client.telefono) && !hasValue(client.contactoPrincipalTelefono)) fields.push("Falta teléfono");
  if (!hasValue(client.email) && !hasValue(client.contactoPrincipalEmail)) fields.push("Falta email");

  if (fiscalClient) {
    if (!hasValue(client.razonSocial) && type !== "Autónomo") fields.push("Falta razón social");
    if (!hasValue(client.nifCif)) fields.push("Falta NIF/CIF");
    if (!hasValue(client.direccionFiscal)) fields.push("Falta dirección fiscal");
    if (!hasValue(client.emailFacturacion) && !hasValue(client.email)) fields.push("Falta email de facturación");
    if (!hasValue(client.contactoPrincipalNombre)) fields.push("Falta contacto principal");
  } else if (!hasValue(client.direccion) && !hasValue(client.direccionFiscal)) {
    fields.push("Falta dirección");
  }

  return fields;
}

export function lastContactDate(events: CrmAgendaEventInput[], now: Date = new Date()) {
  return latestDate(
    events
      .filter((event) => CONTACT_EVENT_TYPES.includes(normalizeStatus(event.tipo)))
      .filter((event) => CONTACT_EVENT_STATUSES.includes(normalizeStatus(event.estado)))
      .map((event) => toDate(event.fechaInicio))
      .filter((date): date is Date => Boolean(date && date <= now))
  );
}

export function latestDate(values: DateLike[]) {
  const dates = values
    .map(toDate)
    .filter((date): date is Date => Boolean(date));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function detectDuplicateClients(
  draft: CrmClientFieldsInput,
  candidates: CrmDuplicateCandidate[],
  excludeId?: string | null
): DuplicateMatch | null {
  const draftNif = normalizeIdentifier(draft.nifCif);
  const draftEmails = [normalizeText(draft.email), normalizeText(draft.emailFacturacion), normalizeText(draft.contactoPrincipalEmail)].filter(Boolean);
  const draftPhone = normalizePhone(draft.telefono || draft.contactoPrincipalTelefono);
  const draftName = normalizeText(firstFilled(draft.razonSocial, draft.nombreComercial, draft.nombre));

  for (const candidate of candidates) {
    if (candidate.id === excludeId) continue;
    if (draftNif && normalizeIdentifier(candidate.nifCif) === draftNif) {
      return { client: candidate, strength: "strong", reason: "Mismo NIF/CIF" };
    }
    const candidateEmails = [normalizeText(candidate.email), normalizeText(candidate.emailFacturacion), normalizeText(candidate.contactoPrincipalEmail)].filter(Boolean);
    if (draftEmails.length && candidateEmails.some((email) => draftEmails.includes(email))) {
      return { client: candidate, strength: "strong", reason: "Mismo email" };
    }
    const candidatePhones = [
      normalizePhone(candidate.telefono),
      normalizePhone(candidate.telefonoFacturacion),
      normalizePhone(candidate.contactoPrincipalTelefono)
    ].filter(Boolean);
    if (draftPhone && candidatePhones.includes(draftPhone)) {
      return { client: candidate, strength: "strong", reason: "Mismo teléfono" };
    }
  }

  if (draftName.length >= 5) {
    for (const candidate of candidates) {
      if (candidate.id === excludeId) continue;
      const candidateName = normalizeText(firstFilled(candidate.razonSocial, candidate.nombreComercial, candidate.nombre));
      if (candidateName && (candidateName.includes(draftName) || draftName.includes(candidateName))) {
        return { client: candidate, strength: "weak", reason: "Nombre parecido" };
      }
    }
  }

  return null;
}

export function toDate(value: DateLike) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function firstFilled(...values: Array<string | null | undefined>) {
  return values.find((value) => hasValue(value))?.trim() ?? null;
}

export function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}
