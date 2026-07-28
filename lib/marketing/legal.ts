const LEGAL_ENVIRONMENT_KEYS = [
  "LEGAL_ENTITY_NAME",
  "LEGAL_TAX_ID",
  "LEGAL_ADDRESS",
  "LEGAL_REGISTRY_DETAILS",
  "LEGAL_CONTACT_EMAIL",
  "PRIVACY_CONTACT_EMAIL",
] as const;

let warnedAboutMissingLegalConfiguration = false;

export type LegalConfiguration = {
  entityName?: string;
  taxId?: string;
  address?: string;
  registryDetails?: string;
  contactEmail?: string;
  privacyEmail?: string;
  missing: string[];
};

export function getLegalConfiguration(): LegalConfiguration {
  const values = Object.fromEntries(
    LEGAL_ENVIRONMENT_KEYS.map((key) => [key, clean(process.env[key])]),
  ) as Record<(typeof LEGAL_ENVIRONMENT_KEYS)[number], string | undefined>;
  const missing = LEGAL_ENVIRONMENT_KEYS.filter((key) => !values[key]);

  if (process.env.NODE_ENV === "production" && missing.length && !warnedAboutMissingLegalConfiguration) {
    warnedAboutMissingLegalConfiguration = true;
    console.warn("[legal-configuration] missing variables", { names: missing });
  }

  return {
    entityName: values.LEGAL_ENTITY_NAME,
    taxId: values.LEGAL_TAX_ID,
    address: values.LEGAL_ADDRESS,
    registryDetails: values.LEGAL_REGISTRY_DETAILS,
    contactEmail: values.LEGAL_CONTACT_EMAIL,
    privacyEmail: values.PRIVACY_CONTACT_EMAIL,
    missing,
  };
}

function clean(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : undefined;
}
