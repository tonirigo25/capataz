import type { Metadata } from "next";
import { GuidedDemo } from "@/app/demo-v2/_components/guided-demo";
import { PublicStructuredData, breadcrumbList, softwareApplication, structuredGraph } from "@/components/marketing/public-structured-data";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Demostración guiada de ${brand.productName}`,
  description: "Demostración guiada, editable y con datos sintéticos de Orqena, sin registro ni acciones reales.",
  alternates: { canonical: "/demo" },
  openGraph: { title: `Demostración de ${brand.productName}`, description: "Una historia completa y controlada con datos ficticios.", images: [brand.socialImage] },
};

const demoStructuredData = structuredGraph(
  {
    ...softwareApplication("/demo", `Demostración de ${brand.productName}`, "Recorrido sintético y editable desde una entrada de obra hasta un resultado confirmado de forma simulada."),
    isAccessibleForFree: true,
  },
  breadcrumbList([["Inicio", ""], ["Demo", "/demo"]]),
);

export default function DemoPage() {
  return (
    <>
      <PublicStructuredData data={demoStructuredData} />
      <GuidedDemo />
    </>
  );
}
