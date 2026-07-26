import type { Metadata } from "next";
import { HeroDemo } from "@/app/marketing-v2/_components/hero-demo";
import { LandingSections, MarketingFooter } from "@/app/marketing-v2/_components/landing-sections";
import { MarketingHeader } from "@/app/marketing-v2/_components/marketing-header";
import styles from "@/app/marketing-v2/page.module.css";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${brand.productName} — ${brand.tagline}` },
  description: `${brand.productName} organiza el recorrido desde el primer contacto hasta el cobro para empresas de obra, reformas e instalaciones.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.productName} — ${brand.tagline}`,
    description: "Trabajo, documentos y decisiones preparados para revisar.",
    images: [brand.socialImage],
  },
};

export default function PublicHomePage() {
  return (
    <div className={styles.page} id="top">
      <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
      <MarketingHeader />
      <main id="main-content" className={styles.mainContent} tabIndex={-1}>
        <HeroDemo />
        <LandingSections />
      </main>
      <MarketingFooter />
    </div>
  );
}
