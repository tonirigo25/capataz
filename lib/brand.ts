const configuredSupportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

export const brand = {
  productName: "Orqena",
  assistantName: "Orqena",
  tagline: "Tu negocio, en orden.",
  brandMark: "/brand/mark.svg",
  wordmark: "Orqena",
  baseUrl: process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() || "http://localhost:3000",
  supportEmail: configuredSupportEmail && !configuredSupportEmail.toLowerCase().includes("capataz")
    ? configuredSupportEmail
    : "soporte@orqena.invalid",
  legalProductName: process.env.NEXT_PUBLIC_LEGAL_PRODUCT_NAME?.trim() || "Orqena",
  legalName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || "Orqena",
  socialImage: "/brand/social-card.svg",
  theme: {
    brand: "#087A68",
    brandStrong: "#07594E",
    information: "#0755C9",
  },
  supportName: "Soporte de Orqena",
  metadata: {
    title: "Orqena — Tu negocio, en orden.",
    titleTemplate: "%s · Orqena",
    description: "El sistema operativo empresarial que organiza clientes, trabajo, ventas, compras y tesorería.",
  },
  pwa: {
    name: "Orqena",
    shortName: "Orqena",
    icon: "/brand/app-icon.svg",
    maskableIcon: "/brand/icon-maskable-512.png",
  },
  futureSenderName: "Orqena",
  legacyAliases: ["Capataz", "Capataz IA", "/capataz", "CAPATAZ_*"] as const,
} as const;

export type BrandConfig = typeof brand;
