export const brand = {
  productName: "Orqena",
  assistantName: "Orqena",
  tagline: "Tu negocio, en orden.",
  legalProductName: process.env.NEXT_PUBLIC_LEGAL_PRODUCT_NAME?.trim() || "Orqena",
  supportName: "Soporte de Orqena",
  metadata: {
    title: "Orqena — Tu negocio, en orden.",
    titleTemplate: "%s · Orqena",
    description: "El sistema operativo empresarial que organiza clientes, trabajo, ventas, compras y tesorería.",
  },
  pwa: { name: "Orqena", shortName: "Orqena" },
  futureSenderName: "Orqena",
  legacyAliases: ["Capataz", "Capataz IA", "/capataz", "CAPATAZ_*"] as const,
} as const;

export type BrandConfig = typeof brand;
