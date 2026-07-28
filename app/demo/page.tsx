import type { Metadata } from "next";
import { GuidedDemo } from "@/app/demo-v2/_components/guided-demo";
import { brand } from "@/lib/brand";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: `Demostración guiada de ${brand.productName}`,
  description: "Demostración guiada, editable y con datos sintéticos de Orqena, sin registro ni acciones reales.",
  alternates: { canonical: "/demo" },
  openGraph: { title: `Demostración de ${brand.productName}`, description: "Una historia completa y controlada con datos ficticios.", images: [brand.socialImage] },
};

const demoStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: `Demostración de ${brand.productName}`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  description: "Recorrido sintético y editable desde una entrada de obra hasta un resultado confirmado de forma simulada.",
} as const;

export default async function DemoPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(demoStructuredData).replace(/</gu, "\\u003c") }}
      />
      <GuidedDemo />
    </>
  );
}
