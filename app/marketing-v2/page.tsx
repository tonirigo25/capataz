import type { Metadata } from "next";
import { HeroSection } from "./_components/hero-section";
import { LandingSections, MarketingFooter } from "./_components/landing-sections";
import { MarketingHeader } from "./_components/marketing-header";
import styles from "./page.module.css";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${brand.productName} — Vista previa preservada` },
  description: `Ruta de reversión no indexable de la web comercial de ${brand.productName}.`,
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

export default function MarketingPreviewPage() {
  return (
    <div className={styles.page} id="top">
      <a className={styles.skipLink} href="#main-content">
        Saltar al contenido
      </a>
      <MarketingHeader />
      <main id="main-content" className={styles.mainContent} tabIndex={-1}>
        <HeroSection />
        <LandingSections />
      </main>
      <MarketingFooter />
    </div>
  );
}
