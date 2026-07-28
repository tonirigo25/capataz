import type { Metadata } from "next";
import { getPublicRobotsMetadata } from "@/lib/public-indexing";

export const metadata: Metadata = {
  metadataBase: new URL("https://orqenatech.com"),
  title: { default: "Orqena Tech — Capataz", template: "%s · Orqena Tech" },
  description: "Capataz conecta clientes, trabajo, documentos y control económico para autónomos y empresas.",
  applicationName: "Orqena Tech",
  robots: getPublicRobotsMetadata(),
  manifest: null,
};

export default function MarketingInternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
