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
  assistantName: "Orqena",
  tagline: "Tu negocio, en orden.",
  supportName: "Soporte de Orqena",
  senderName: "Orqena",
  brandMark: "/brand/mark.svg",
  wordmark: "Orqena",
  socialImage: "/brand/social-card.svg",
  theme: {
    brand: "#087A68",
    brandStrong: "#07594E",
    information: "#0755C9",
  },
  pwa: {
    name: "Orqena",
    shortName: "Orqena",
    icon: "/brand/app-icon.svg",
    maskableIcon: "/brand/icon-maskable-512.png",
  },
  legacyAliases: ["Capataz", "Capataz IA", "/capataz", "CAPATAZ_*"] as const,
});

export type BrandConfig = typeof brandConfig;
