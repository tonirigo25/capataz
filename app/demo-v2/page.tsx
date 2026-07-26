import type { Metadata } from "next";
import { GuidedDemo } from "./_components/guided-demo";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `Prueba ${brand.productName} — Demostración preservada` },
  description:
    `Ruta de reversión no indexable de la demostración de ${brand.productName}.`,
  alternates: { canonical: null },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      nocache: true,
    },
  },
};

export default function GuidedDemoPreviewPage() {
  return <GuidedDemo />;
}
