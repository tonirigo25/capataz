import type { Metadata } from "next";
import { GuidedDemo } from "@/app/demo-v2/_components/guided-demo";
import { ImmersiveJourney } from "@/app/marketing-v2/_components/immersive-journey";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Demostración guiada de ${brand.productName}`,
  description: "Demo rápida de 60–90 segundos y recorrido sintético profundo de 15 minutos, sin ejecutar acciones reales.",
  alternates: { canonical: "/demo" },
  openGraph: { title: `Demostración de ${brand.productName}`, description: "Una historia completa y controlada con datos ficticios.", images: [brand.socialImage] },
};

export default function DemoPage() {
  return (
    <>
      <ImmersiveJourney />
      <GuidedDemo />
    </>
  );
}
