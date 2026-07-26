import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";
import { WorkMarginCalculator } from "./work-margin-calculator";

export const metadata: Metadata = {
  title: "Calculadora de margen de obra",
  description: "Calcula un margen orientativo con tus propios ingresos, costes, horas y contingencia. Sin guardar datos ni prometer resultados.",
  alternates: { canonical: "/recursos/calculadora-margen-obra" },
  openGraph: {
    title: `Calculadora de margen de obra · ${brand.productName}`,
    description: "Hipótesis editables para revisar una obra antes de decidir.",
    images: [brand.socialImage],
  },
};

export default function WorkMarginCalculatorPage() {
  return <MarketingPage><WorkMarginCalculator /></MarketingPage>;
}
