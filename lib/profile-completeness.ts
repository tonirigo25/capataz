type UserProfileLike = {
  nombre?: string | null;
  apellidos?: string | null;
  nombrePreferido?: string | null;
  telefono?: string | null;
  email?: string | null;
  cargo?: string | null;
  oficioPrincipal?: string | null;
  tonoPreferido?: string | null;
} | null;

type CompanyLike = {
  nombreComercial?: string | null;
  razonSocial?: string | null;
  nifCif?: string | null;
  direccionFiscal?: string | null;
  codigoPostal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  iban?: string | null;
  condicionesPorDefecto?: string | null;
  textoLegal?: string | null;
  logoUrl?: string | null;
  selloUrl?: string | null;
  ivaDefecto?: number | null;
  seriePresupuestos?: string | null;
  serieFacturas?: string | null;
  prefijoPresupuesto?: string | null;
  prefijoFactura?: string | null;
} | null;

export type CompletionResult = {
  percent: number;
  completed: number;
  total: number;
  missingRequired: string[];
  missingRecommended: string[];
};

export function userDisplayName(profile: UserProfileLike) {
  return firstText(profile?.nombrePreferido) ?? firstText(profile?.nombre) ?? null;
}

export function profileCompletion(profile: UserProfileLike): CompletionResult {
  const checks = [
    { label: "nombre o nombre preferido", ok: hasText(profile?.nombrePreferido) || hasText(profile?.nombre), required: true },
    { label: "tono preferido", ok: hasText(profile?.tonoPreferido), required: false },
    { label: "oficio principal", ok: hasText(profile?.oficioPrincipal), required: false },
    { label: "email", ok: hasText(profile?.email), required: false },
    { label: "teléfono", ok: hasText(profile?.telefono), required: false }
  ];

  return completionFromChecks(checks);
}

export function companyCompletion(company: CompanyLike): CompletionResult {
  const checks = [
    { label: "nombre comercial o razón social", ok: hasText(company?.nombreComercial) || hasText(company?.razonSocial), required: true },
    { label: "NIF/CIF", ok: hasText(company?.nifCif), required: true },
    { label: "dirección fiscal", ok: hasText(company?.direccionFiscal), required: true },
    { label: "teléfono o email de empresa", ok: hasText(company?.telefono) || hasText(company?.email), required: true },
    { label: "IVA por defecto", ok: typeof company?.ivaDefecto === "number", required: true },
    { label: "serie y prefijo de presupuestos", ok: hasText(company?.seriePresupuestos) && hasText(company?.prefijoPresupuesto), required: true },
    { label: "serie y prefijo de facturas", ok: hasText(company?.serieFacturas) && hasText(company?.prefijoFactura), required: true },
    { label: "logo", ok: hasText(company?.logoUrl), required: false },
    { label: "sello", ok: hasText(company?.selloUrl), required: false },
    { label: "IBAN", ok: hasText(company?.iban), required: false },
    { label: "condiciones por defecto", ok: hasText(company?.condicionesPorDefecto), required: false },
    { label: "texto legal", ok: hasText(company?.textoLegal), required: false },
    { label: "web", ok: hasText(company?.web), required: false }
  ];

  return completionFromChecks(checks);
}

function completionFromChecks(checks: Array<{ label: string; ok: boolean; required: boolean }>): CompletionResult {
  const completed = checks.filter((check) => check.ok).length;
  return {
    percent: Math.round((completed / checks.length) * 100),
    completed,
    total: checks.length,
    missingRequired: checks.filter((check) => check.required && !check.ok).map((check) => check.label),
    missingRecommended: checks.filter((check) => !check.required && !check.ok).map((check) => check.label)
  };
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function firstText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : null;
}
