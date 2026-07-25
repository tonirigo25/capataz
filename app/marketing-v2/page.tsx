import type { Metadata } from "next";
import { HeroDemo } from "./_components/hero-demo";
import { MarketingHeader } from "./_components/marketing-header";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Capataz — Vista previa" },
  description: "Vista previa aislada de la nueva web comercial de Capataz.",
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

export default function CapatazMarketingPreviewPage() {
  return (
    <div className={styles.page} id="top">
      <MarketingHeader />
      <main>
        <HeroDemo />
      </main>
    </div>
  );
}
