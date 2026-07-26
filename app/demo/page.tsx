import type { Metadata } from "next";
import { GuidedDemo } from "@/app/demo-v2/_components/guided-demo";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Demostración guiada de ${brand.productName}`,
  description: "Recorrido sintético de 15 minutos desde el primer contacto hasta el cobro, sin guardar ni enviar datos.",
  alternates: { canonical: "/demo" },
  openGraph: { title: `Demostración de ${brand.productName}`, description: "Una historia completa y controlada con datos ficticios.", images: [brand.socialImage] },
};

export default function DemoPage() {
  return <GuidedDemo />;
}
