import type { Metadata } from "next";
import { GuidedDemo } from "./_components/guided-demo";

export const metadata: Metadata = {
  title: { absolute: "Prueba Capataz — Demostración guiada" },
  description:
    "Demostración local y guiada del recorrido de trabajo de Capataz.",
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

export default function CapatazGuidedDemoPage() {
  return <GuidedDemo />;
}
