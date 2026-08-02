import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PricingPageV2 } from "@/components/marketing/pricing-page-v2";
import { PublicStructuredData, breadcrumbList, faqPage, softwareApplication, structuredGraph } from "@/components/marketing/public-structured-data";
import { brand } from "@/lib/brand";
import { pricingFaq } from "@/lib/marketing/pricing-catalog";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Compara Starter, Professional y Business de Orqena por usuarios, capacidad operativa y operaciones de IA.",
  alternates: { canonical: "/precios" },
  openGraph: {
    title: "Planes y precios de Orqena",
    description: "Tres niveles de capacidad sobre una misma arquitectura segura y conectada.",
    images: [brand.socialImage],
  },
};

export default function PricingPage() {
  return <MarketingPage>
    <PublicStructuredData data={structuredGraph(
      softwareApplication("/precios", "Planes y precios de Orqena", "Compara Starter, Professional y Business por usuarios, capacidad operativa y operaciones de IA."),
      breadcrumbList([["Inicio", ""], ["Planes y precios", "/precios"]]),
      faqPage(pricingFaq),
    )} />
    <PricingPageV2 />
  </MarketingPage>;
}
