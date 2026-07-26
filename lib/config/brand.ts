import { publicConfig } from "./public";

const configuredSupportEmail = publicConfig.supportEmail;

export const brandConfig = Object.freeze({
  productName: process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "Orqena",
  legalProductName: process.env.NEXT_PUBLIC_LEGAL_PRODUCT_NAME?.trim() || "Orqena",
  legalEntityName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || "Orqena",
  supportEmail:
    configuredSupportEmail && !configuredSupportEmail.toLowerCase().includes("capataz")
      ? configuredSupportEmail
      : "soporte@orqena.invalid",
  baseUrl: publicConfig.baseUrl,
  assistantName: process.env.NEXT_PUBLIC_ASSISTANT_NAME?.trim() || "Orqena",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() || "Tu negocio, en orden.",
  supportName: process.env.NEXT_PUBLIC_SUPPORT_NAME?.trim() || "Soporte de Orqena",
  senderName: process.env.NEXT_PUBLIC_SENDER_NAME?.trim() || "Orqena",
  brandMark: process.env.NEXT_PUBLIC_BRAND_MARK?.trim() || "/brand/mark.svg",
  wordmark: process.env.NEXT_PUBLIC_BRAND_WORDMARK?.trim() || "Orqena",
  socialImage: process.env.NEXT_PUBLIC_SOCIAL_IMAGE?.trim() || "/brand/social-card.svg",
  theme: {
    brand: process.env.NEXT_PUBLIC_BRAND_COLOR?.trim() || "#087A68",
    brandStrong: process.env.NEXT_PUBLIC_BRAND_STRONG_COLOR?.trim() || "#07594E",
    information: process.env.NEXT_PUBLIC_INFORMATION_COLOR?.trim() || "#0755C9",
  },
  pwa: {
    name: process.env.NEXT_PUBLIC_PWA_NAME?.trim() || "Orqena",
    shortName: process.env.NEXT_PUBLIC_PWA_SHORT_NAME?.trim() || "Orqena",
    icon: process.env.NEXT_PUBLIC_PWA_ICON?.trim() || "/brand/app-icon.svg",
    maskableIcon: process.env.NEXT_PUBLIC_PWA_MASKABLE_ICON?.trim() || "/brand/icon-maskable-512.png",
  },
  legacyAliases: ["Capataz", "Capataz IA", "/capataz", "CAPATAZ_*"] as const,
});

export type BrandConfig = typeof brandConfig;
