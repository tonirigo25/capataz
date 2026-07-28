import { brandConfig } from "@/lib/config/brand";

const configuredController = process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim();
const configuredAddress = process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim();
const configuredRegistration = process.env.NEXT_PUBLIC_LEGAL_REGISTRATION?.trim();

export const legalConfig = Object.freeze({
  documentVersion: process.env.NEXT_PUBLIC_LEGAL_DOCUMENT_VERSION?.trim() || "1.0-draft",
  reviewStatus: "REVIEW_REQUIRED" as const,
  controllerName: configuredController || "Responsable pendiente de confirmación legal",
  controllerAddress: configuredAddress || "Domicilio pendiente de confirmación legal",
  registrationReference: configuredRegistration || "Datos registrales pendientes de confirmación legal",
  contactEmail: brandConfig.supportEmail,
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || brandConfig.supportEmail,
  identityComplete: Boolean(configuredController && configuredAddress && configuredRegistration),
  privateBeta: true,
  publicPricingApproved: false,
  nonEssentialCategories: Object.freeze({
    analytics: process.env.ANALYTICS_ENABLED === "true",
    marketing: false,
  }),
});

export type LegalConfig = typeof legalConfig;
