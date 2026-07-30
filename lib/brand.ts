import { brandConfig } from "@/lib/config/brand";

export const brand = {
  ...brandConfig,
  legalName: brandConfig.legalEntityName,
  productSignature: `${brandConfig.legacyAliases[0]}, by ${brandConfig.wordmark}`,
  metadata: {
    title: `${brandConfig.productName} — ${brandConfig.tagline}`,
    titleTemplate: `%s · ${brandConfig.productName}`,
    description: "El sistema operativo empresarial que organiza clientes, trabajo, ventas, compras y tesorería.",
  },
  futureSenderName: brandConfig.senderName,
} as const;

export type BrandConfig = typeof brand;
