export type BillingProfile = {
  legalName: string;
  email: string;
  addressLine: string;
  postalCode: string;
  city: string;
  countryCode: string;
  taxId: string;
};

export type LiveCheckoutCustomerDetails = {
  name?: string | null;
  email?: string | null;
  address?: {
    line1?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
};

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
]);

export const CHECKOUT_RESERVATION_TTL_MS = 15 * 60_000;

export function validateBillingProfile(profile: BillingProfile, livemode: boolean) {
  const required = [
    profile.legalName,
    profile.email,
    profile.addressLine,
    profile.postalCode,
    profile.city,
    profile.countryCode,
    profile.taxId,
  ];
  if (required.some((value) => !value.trim())) throw new Error("BILLING_B2B_PROFILE_INCOMPLETE");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) throw new Error("BILLING_B2B_EMAIL_INVALID");
  if (!/^[A-Z0-9 -]{8,18}$/.test(profile.taxId.toUpperCase())) throw new Error("BILLING_TAX_ID_INVALID");
  if (!EU_COUNTRIES.has(profile.countryCode)) throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  if (livemode && profile.countryCode !== "ES") throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  if (!/^[0-9A-Z -]{4,12}$/.test(profile.postalCode.toUpperCase())) {
    throw new Error("BILLING_POSTAL_CODE_INVALID");
  }
  if (livemode && /^(?:35|38|51|52)/.test(profile.postalCode.replace(/\s/g, ""))) {
    throw new Error("BILLING_TAX_TERRITORY_NOT_ALLOWED");
  }
  return profile;
}

export function validateLiveCheckoutCustomerDetails(details: LiveCheckoutCustomerDetails | null | undefined) {
  const address = details?.address;
  if (
    !details?.name?.trim()
    || !details.email?.trim()
    || !address?.line1?.trim()
    || !address.city?.trim()
    || !address.postal_code?.trim()
    || !address.country?.trim()
  ) {
    throw new Error("BILLING_B2B_PROFILE_INCOMPLETE");
  }
  if (address.country.trim().toUpperCase() !== "ES") {
    throw new Error("BILLING_COUNTRY_NOT_ALLOWED");
  }
  if (/^(?:35|38|51|52)/.test(address.postal_code.replace(/\s/g, ""))) {
    throw new Error("BILLING_TAX_TERRITORY_NOT_ALLOWED");
  }
  return details;
}

export function checkoutReservationIsFresh(metadata: unknown, now = new Date()) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const reservation = (metadata as Record<string, unknown>).billingCheckoutReservation;
  if (!reservation || typeof reservation !== "object" || Array.isArray(reservation)) return false;
  const createdAtValue = (reservation as Record<string, unknown>).createdAt;
  const createdAt = typeof createdAtValue === "string" ? Date.parse(createdAtValue) : Number.NaN;
  return Number.isFinite(createdAt)
    && now.getTime() - createdAt < CHECKOUT_RESERVATION_TTL_MS;
}

export function assertLocalPlanSimulationAllowed(environment: Record<string, string | undefined>) {
  const nodeEnvironment = environment.NODE_ENV?.trim().toLowerCase();
  const appEnvironment = (environment.NEXT_PUBLIC_APP_ENV || environment.APP_ENV || nodeEnvironment || "")
    .trim()
    .toLowerCase();
  if (!["development", "test"].includes(nodeEnvironment || "")) {
    throw new Error("LOCAL_PLAN_SIMULATION_FORBIDDEN");
  }
  if (!["development", "test", "local"].includes(appEnvironment)) {
    throw new Error("LOCAL_PLAN_SIMULATION_FORBIDDEN");
  }
  if (environment.BILLING_ENABLED === "true") {
    throw new Error("LOCAL_PLAN_SIMULATION_FORBIDDEN");
  }
}
