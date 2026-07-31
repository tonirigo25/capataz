import { publicConfig } from "./public";

const configuredSupportEmail = publicConfig.supportEmail;

const CANONICAL_BRAND = Object.freeze({
  companyName: "Orqena Tech",
  productName: "Orqena",
  assistantName: "Orqena IA",
  publicUrl: "https://orqenatech.com",
  appUrl: "https://app.orqenatech.com",
});

function canonicalPublicName(configured: string | undefined, canonical: string) {
  return configured?.trim().localeCompare(canonical, "es", { sensitivity: "accent" }) === 0
    ? canonical
    : canonical;
}

const configuredProductName = canonicalPublicName(
  process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "Orqena",
  CANONICAL_BRAND.productName,
);

export const brandConfig = Object.freeze({
  companyName: CANONICAL_BRAND.companyName,
  productName: configuredProductName,
  legalProductName: canonicalPublicName(
    process.env.NEXT_PUBLIC_LEGAL_PRODUCT_NAME,
    CANONICAL_BRAND.productName,
  ),
  legalEntityName: canonicalPublicName(
    process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME,
    CANONICAL_BRAND.companyName,
  ),
  supportEmail:
    configuredSupportEmail && !configuredSupportEmail.toLowerCase().includes("capataz")
      ? configuredSupportEmail
      : "soporte@orqena.invalid",
  baseUrl: publicConfig.baseUrl,
  publicUrl: CANONICAL_BRAND.publicUrl,
  appUrl: CANONICAL_BRAND.appUrl,
  assistantName: canonicalPublicName(
    process.env.NEXT_PUBLIC_ASSISTANT_NAME,
    CANONICAL_BRAND.assistantName,
  ),
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() || "Tu negocio, en orden.",
  supportName: canonicalPublicName(
    process.env.NEXT_PUBLIC_SUPPORT_NAME,
    "Soporte de Orqena",
  ),
  senderName: canonicalPublicName(process.env.NEXT_PUBLIC_SENDER_NAME, CANONICAL_BRAND.productName),
  brandMark: process.env.NEXT_PUBLIC_BRAND_MARK?.trim() || "/brand/mark.svg",
  wordmark: canonicalPublicName(process.env.NEXT_PUBLIC_BRAND_WORDMARK, CANONICAL_BRAND.productName),
  socialImage: process.env.NEXT_PUBLIC_SOCIAL_IMAGE?.trim() || "/brand/social-card.svg",
  theme: {
    brand: process.env.NEXT_PUBLIC_BRAND_COLOR?.trim() || "#087A68",
    brandStrong: process.env.NEXT_PUBLIC_BRAND_STRONG_COLOR?.trim() || "#07594E",
    information: process.env.NEXT_PUBLIC_INFORMATION_COLOR?.trim() || "#0755C9",
  },
  pwa: {
    name: canonicalPublicName(process.env.NEXT_PUBLIC_PWA_NAME, CANONICAL_BRAND.productName),
    shortName: canonicalPublicName(process.env.NEXT_PUBLIC_PWA_SHORT_NAME, CANONICAL_BRAND.productName),
    icon: process.env.NEXT_PUBLIC_PWA_ICON?.trim() || "/brand/app-icon.svg",
    maskableIcon: process.env.NEXT_PUBLIC_PWA_MASKABLE_ICON?.trim() || "/brand/icon-maskable-512.png",
  },
  mobile: {
    appId: process.env.CAPATAZ_MOBILE_APP_ID?.trim() || "com.orqena.app",
    appName: process.env.CAPATAZ_MOBILE_APP_NAME?.trim() || configuredProductName,
    urlScheme: process.env.CAPATAZ_MOBILE_URL_SCHEME?.trim() || "orqena",
  },
  legacyAliases: ["Capataz", "Capataz IA", "/capataz", "CAPATAZ_*"] as const,
});

export type BrandConfig = typeof brandConfig;
