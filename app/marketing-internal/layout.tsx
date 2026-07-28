import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://orqenatech.com"),
  title: { default: "Orqena Tech — Capataz", template: "%s · Orqena Tech" },
  description: "Capataz conecta clientes, trabajo, documentos y control económico para autónomos y empresas.",
  applicationName: "Orqena Tech",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: null,
};

export default function MarketingInternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
